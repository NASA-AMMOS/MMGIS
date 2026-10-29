// The Connect, callback, list and Disconnect routes
const crypto = require("crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const logger = require("../logger");
const { DOCS_URL, STATE_TTL_MS, MAX_PENDING_STATES, withTimeout, ConnectionRequiredError, envSecrets, scrubbed } = require("./common");
const { connectionMap, allConnections, getConnection, setupStatus } = require("./registry");
const { principalOf, storageFor, grantRecord, ownerKey, readStored, writeStored, removeStored, serialized, adoptSessionConnections, revokeQuietly } = require("./storage");
const { refreshScope, forgetRefreshes } = require("./refresh");

let mountedRoot = null;
const rootPath = () => (mountedRoot != null ? mountedRoot : process.env.ROOT_PATH || "");

// The host the browser used, with a trusted proxy's X-Forwarded-Port when its host has none
function publicHost(req) {
  const host = req.host || req.get("host");
  const port = String(req.get("x-forwarded-port") || "").split(",")[0].trim();
  const trusted = req.app && req.app.get("trust proxy fn");
  if (!host || !/^\d{1,5}$/.test(port) || /:\d+$/.test(host)) return host;
  if (!trusted || !trusted(req.socket && req.socket.remoteAddress, 0)) return host;
  const defaultPort = req.protocol === "https" ? "443" : "80";
  return port === defaultPort ? host : `${host}:${port}`;
}

let warnedCallbackBase = false;
function callbackUrl(req, c) {
  const base = process.env.CONNECTIONS_CALLBACK_BASE_URL;
  if (!base && process.env.NODE_ENV === "production" && !warnedCallbackBase) {
    warnedCallbackBase = true;
    logger(
      "warn",
      "CONNECTIONS_CALLBACK_BASE_URL is not set, so connection callback URLs are built from the request's X-Forwarded-Host/Host. Set it to this site's public URL.",
      "connections"
    );
  }
  // req.protocol can come from X-Forwarded-Proto
  const proto = req.protocol === "https" ? "https" : "http";
  const origin = base ? base.replace(/\/+$/, "") : `${proto}://${publicHost(req)}${rootPath()}`;
  return `${origin}/api/connections/${c.id}/callback`;
}

// What a plugin's authorize URL lacks of the values core created for this sign-in, or null
function authorizeUrlMissing(url, state, codeChallenge) {
  let params;
  try {
    params = new URL(url).searchParams;
  } catch (err) {
    return "a valid URL";
  }
  if (params.get("state") !== state) return "the state parameter";
  if (codeChallenge && (params.get("code_challenge") !== codeChallenge || params.get("code_challenge_method") !== "S256"))
    return 'code_challenge and code_challenge_method=S256 (set "pkce": false for a service without PKCE)';
  return null;
}

function sameSitePath(value) {
  const fallback = `${rootPath()}/`;
  if (typeof value !== "string" || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return fallback;
  return value;
}

async function describe(req, principal, c) {
  const status = setupStatus(c);
  const storage = storageFor(principal, c);
  let record = null;
  if (status.configured && storage) record = await readStored(req, principal, c);
  const expired = record && record.expiresAt && !record.refreshToken && new Date(record.expiresAt).getTime() <= Date.now();
  return {
    id: c.id,
    plugin: c.ref,
    label: c.label,
    configured: status.configured,
    guests: c.guests,
    canConnect: status.configured && storage != null,
    storage,
    connected: !!record && !expired,
    account: record ? record.account : null,
    expiresAt: record ? record.expiresAt : null,
  };
}

// States already redeemed in this process
const usedStates = new Map();

// Counts only code exchanges that failed; a refused or stale callback reaches no service
const flowLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req) => !req.connectionExchangeFailed,
    message: { status: "failure", message: "Too many attempts, try again later." },
  });

// Each Connect saves a session to hold its OAuth state, so count every one, not just failures
const connectLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: (req) => !getConnection(req.params.id),
    message: { status: "failure", message: "Too many attempts, try again later." },
  });

// Connect and callback are page loads. A cross-site <img> or <script> pointing at them is
// refused before it counts against the IP's limits. Browsers without Fetch Metadata send neither header.
function navigationOnly(req, res, next) {
  const site = req.get("sec-fetch-site");
  const mode = req.get("sec-fetch-mode");
  res.set("Cache-Control", "no-store");
  if ((site === "cross-site" || site === "same-site") && mode && mode !== "navigate")
    return res.status(403).send({ status: "failure", message: "Open this link in the browser." });
  next();
}

// Text from a service, without control and bidirectional-override characters
const plainText = (str) => String(str).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "");

// The callback's query holds the OAuth code and state, so log without it
function logReq(req) {
  return { headers: req.headers, user: req.user, sessionID: req.sessionID, cssoSessionID: req.cssoSessionID };
}

function renderResult(res, view) {
  res.status(view.ok ? 200 : 400).render("connected", {
    HOME: `${rootPath()}/`,
    ok: !!view.ok,
    label: view.label || "The service",
    account: view.account || "",
    message: view.message || "",
    connection: view.id || "",
  });
}

function sameOriginOnly(req, res, next) {
  const site = req.get("sec-fetch-site");
  const origin = req.get("origin");
  // The browser sets Sec-Fetch-Site itself; a proxy that rewrites Host would otherwise refuse it
  if (site === "same-origin") return next();
  let foreign = site === "cross-site" || site === "same-site";
  if (!foreign && origin) {
    try {
      const host = new URL(origin).host;
      let baseHost = null;
      try {
        baseHost = new URL(process.env.CONNECTIONS_CALLBACK_BASE_URL).host;
      } catch (err) {}
      foreign = host !== req.get("host") && host !== publicHost(req) && host !== baseHost;
    } catch (err) {
      foreign = true;
    }
  }
  if (foreign) return res.status(403).send({ status: "failure", message: "Cross-site request refused." });
  next();
}

function mountConnectionRoutes(app, { registerRouter, authorize, rootPath: root }) {
  if (process.env.NODE_ENV === "production" && !process.env.CONNECTIONS_CALLBACK_BASE_URL && connectionMap().size) {
    warnedCallbackBase = true;
    logger(
      "warn",
      "CONNECTIONS_CALLBACK_BASE_URL is not set, so connection callback URLs are built from each request's X-Forwarded-Host/Host, which a client can spoof. Set it to this site's public URL (with ROOT_PATH).",
      "connections"
    );
  }
  if (typeof root === "string") mountedRoot = root;
  const router = express.Router();
  const limiter = flowLimiter();

  router.get("/", authorize("site.view"), async (req, res) => {
    try {
      const principal = await principalOf(req);
      await adoptSessionConnections(req, principal);
      const list = [];
      for (const c of allConnections()) list.push(await describe(req, principal, c));
      res.send({ status: "success", signedIn: principal.kind === "user" || principal.kind === "external", connections: list });
    } catch (err) {
      logger("error", "Failed to list connections.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to list connections." });
    }
  });

  // Setup status only; never which users have connected
  router.get(
    "/setup",
    authorize("groups.manage", null, { or: ["accounts.manage", "options.manage"] }),
    (req, res) => {
      res.send({
        status: "success",
        docs: DOCS_URL,
        connections: allConnections().map((c) => {
          const s = setupStatus(c);
          return {
            id: c.id,
            plugin: c.ref,
            label: c.label,
            description: c.description,
            guests: c.guests,
            env: c.env,
            configured: s.configured,
            missingEnv: s.missingEnv,
            problems: s.problems,
            redirectUri: callbackUrl(req, c),
          };
        }),
      });
    }
  );

  router.get("/:id/connect", navigationOnly, connectLimiter(), authorize("site.view"), async (req, res) => {
    const c = getConnection(req.params.id);
    if (!c) return res.status(404).send({ status: "failure", message: "No such connection." });
    const principal = await principalOf(req);
    if (!setupStatus(c).configured)
      return renderResult(res, { label: c.label, message: `${c.label} isn't set up on this site yet. Ask a site admin.` });
    if (!storageFor(principal, c))
      return renderResult(res, { label: c.label, message: `Sign in to MMGIS first, then connect ${c.label}.` });
    const state = crypto.randomBytes(24).toString("hex");
    const pending = Object.entries(req.session.connectionStates || {})
      .filter(([, v]) => v && Date.now() - v.at < STATE_TTL_MS)
      .slice(-(MAX_PENDING_STATES - 1));
    req.session.connectionStates = Object.fromEntries(pending);
    // PKCE (RFC 7636), when the plugin asks for it
    const verifier = c.pkce ? crypto.randomBytes(32).toString("base64url") : null;
    const codeChallenge = verifier ? crypto.createHash("sha256").update(verifier).digest("base64url") : null;
    // The token request must repeat this exact redirect_uri (RFC 6749 4.1.3)
    const redirectUri = callbackUrl(req, c);
    req.session.connectionStates[state] = {
      id: c.id,
      owner: ownerKey(principal),
      verifier,
      redirectUri,
      at: Date.now(),
      mode: req.query.mode === "page" ? "page" : "tab",
      returnTo: sameSitePath(req.query.returnTo),
    };
    let url;
    try {
      url = await withTimeout((async () => c.impl.authorizeUrl({
        state,
        redirectUri,
        env: process.env,
        ...(verifier ? { codeChallenge, codeChallengeMethod: "S256" } : {}),
      }))(), "authorizeUrl()");
    } catch (err) {
      logger("error", `Connection '${c.id}': authorizeUrl() threw.`, req.originalUrl, req, scrubbed(err, envSecrets(c)));
    }
    if (typeof url !== "string" || !/^https?:\/\//i.test(url))
      return renderResult(res, { label: c.label, message: `${c.label} couldn't be reached. Try again later.` });
    // Without state (and the PKCE challenge) the callback can't be tied to this sign-in
    const missing = authorizeUrlMissing(url, state, codeChallenge);
    if (missing) {
      logger("error", `Connection '${c.id}': authorizeUrl() returned a URL without ${missing}, so the sign-in was not started.`, "Connections");
      return renderResult(res, { label: c.label, message: `${c.label} couldn't be reached. Try again later.` });
    }
    req.session.save(() => res.redirect(url));
  });

  router.get("/:id/callback", navigationOnly, limiter, authorize("site.view"), async (req, res) => {
    const c = getConnection(req.params.id);
    if (!c) return res.status(404).send({ status: "failure", message: "No such connection." });
    const states = req.session.connectionStates || {};
    const state = typeof req.query.state === "string" && /^[0-9a-f]{48}$/.test(req.query.state) ? req.query.state : "";
    const match = state ? Object.entries(states).find(([k]) => k === state) : null;
    const pending = match ? match[1] : null;
    if (pending) req.session.connectionStates = Object.fromEntries(Object.entries(states).filter(([k]) => k !== state));
    if (!pending || pending.id !== c.id || Date.now() - pending.at > STATE_TTL_MS)
      return renderResult(res, { id: c.id, label: c.label, message: "This sign-in link has expired. Go back to MMGIS and click Connect again." });
    if (typeof req.query.error === "string" || typeof req.query.code !== "string") {
      const detail = typeof req.query.error_description === "string" ? plainText(req.query.error_description).slice(0, 300) : "";
      if (typeof req.query.error === "string")
        logger("warn", `Connecting '${c.id}': the service returned '${plainText(req.query.error).slice(0, 100)}'${detail ? `: ${detail}` : ""}.`, req.baseUrl + req.path, logReq(req));
      return renderResult(res, { id: c.id, label: c.label, message: `${c.label} wasn't connected.${detail ? ` ${c.label} said: ${detail}` : ""}` });
    }
    // A state is redeemed once, even when two callbacks race and each saves its own copy of the session
    if (usedStates.has(state))
      return renderResult(res, { id: c.id, label: c.label, message: "This sign-in link has expired. Go back to MMGIS and click Connect again." });
    usedStates.set(state, Date.now());
    for (const [k, at] of usedStates) if (Date.now() - at > STATE_TTL_MS) usedStates.delete(k);
    const principal = await principalOf(req);
    // Signed in or out since clicking Connect: a guest's connect may finish into an account that
    // has none for this service, the same rule as guest connections on sign-in; nothing else may
    if (pending.owner !== ownerKey(principal)) {
      const adoptable =
        pending.owner === "guest" &&
        ownerKey(principal) !== "guest" &&
        !(await readStored(req, principal, c).catch(() => null));
      if (!adoptable)
        return renderResult(res, {
          id: c.id,
          label: c.label,
          message: `You signed in or out while connecting ${c.label}. Go back to MMGIS and click Connect again.`,
        });
    }
    // The service sends the browser back to the redirect_uri of the authorization request; another host means it didn't
    if (typeof pending.redirectUri !== "string" || callbackUrl(req, c) !== pending.redirectUri)
      return renderResult(res, { id: c.id, label: c.label, message: "This sign-in link has expired. Go back to MMGIS and click Connect again." });
    const uidAtStart = req.session.uid;
    let record;
    try {
      record = grantRecord(
        await withTimeout((async () => c.impl.exchange({
          code: req.query.code,
          redirectUri: pending.redirectUri,
          env: process.env,
          ...(pending.verifier ? { codeVerifier: pending.verifier } : {}),
        }))(), "exchange()")
      );
      // The person may have signed out or in while the service answered. Don't bring that session back.
      const alive = await new Promise((resolve) => req.session.reload((err) => resolve(!err)));
      if (!alive || req.session.uid !== uidAtStart) {
        revokeQuietly(c, record);
        if (!alive) await new Promise((resolve) => req.session.destroy(() => resolve()));
        return renderResult(res, { id: c.id, label: c.label, message: `You signed in or out while connecting ${c.label}. Go back to MMGIS and click Connect again.` });
      }
      // Two tabs finishing a connect at once: the one saved second revokes the first
      await serialized(refreshScope(req, principal, c), async () => {
        if (storageFor(principal, c) === "session")
          await new Promise((resolve, reject) => req.session.reload((err) => (err ? reject(err) : resolve())));
        if (req.session.connectionStates)
          req.session.connectionStates = Object.fromEntries(Object.entries(req.session.connectionStates).filter(([k]) => k !== state));
        const replaced = await readStored(req, principal, c).catch(() => null);
        forgetRefreshes(req, principal, c);
        await writeStored(req, principal, c, record);
        await new Promise((resolve) => req.session.save(() => resolve()));
        if (replaced && replaced.accessToken !== record.accessToken) revokeQuietly(c, replaced);
      });
    } catch (err) {
      req.connectionExchangeFailed = true;
      logger(
        "error",
        `Connecting '${c.id}' (${c.ref}) failed.`,
        req.baseUrl + req.path,
        logReq(req),
        scrubbed(err, [req.query.code, pending.verifier, ...envSecrets(c)])
      );
      return renderResult(res, {
        id: c.id,
        label: c.label,
        message:
          err instanceof ConnectionRequiredError ? err.message : `${c.label} couldn't be connected. Try again.`,
      });
    }
    logger("info", `${principal.username || "A guest"} connected ${c.label}.`, req.baseUrl + req.path, logReq(req));
    if (pending.mode === "page") return req.session.save(() => res.redirect(pending.returnTo));
    req.session.save(() => renderResult(res, { ok: true, id: c.id, label: c.label, account: record.account }));
  });

  router.post("/:id/disconnect", authorize("site.view"), sameOriginOnly, async (req, res) => {
    const c = getConnection(req.params.id);
    if (!c) return res.status(404).send({ status: "failure", message: "No such connection." });
    try {
      const principal = await principalOf(req);
      const record = await serialized(refreshScope(req, principal, c), async () => {
        const stored = await readStored(req, principal, c);
        await removeStored(req, principal, c);
        return stored;
      });
      // Save the removal (a guest's lives in the session) before telling the service; don't wait on it
      req.session.save(() => res.send({ status: "success" }));
      revokeQuietly(c, record);
    } catch (err) {
      logger("error", `Disconnecting '${c.id}' failed.`, req.originalUrl, req, scrubbed(err, envSecrets(c)));
      res.send({ status: "failure", message: "Failed to disconnect." });
    }
  });

  const prefix = `${rootPath()}/api/connections`;
  app.use(prefix, registerRouter(prefix, router));
}

module.exports = { mountConnectionRoutes, callbackUrl, sameSitePath, authorizeUrlMissing, sameOriginOnly };
