// Service connections: credentials for external services (e.g. Earthdata) that
// tools use on a signed-in user's behalf. A connection never signs anyone in
// to MMGIS; login providers (API/permissions/providers.js) do that.
//
// Connection plugins live in plugins/<container>/connections/<Name>/ with a
// plugin.json ("type": "connection", "connection": "<id>") and a plugin.js:
//   authorizeUrl({ state, redirectUri, env })               -> URL of the service's sign-in page
//   exchange({ code, redirectUri, env })                    -> grant
//   refresh({ refreshToken, env })        (optional)        -> grant
//   revoke({ accessToken, refreshToken, env }) (optional)
//   validate(env) / warnings(env)         (optional)        -> string[]
// A grant is { accessToken, refreshToken?, expiresIn? (s) | expiresAt?, account? }.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const logger = require("../logger");
const { discoverPlugins } = require("../pluginDiscovery");
const secretBox = require("./secretBox");

const DOCS_URL = "https://nasa-ammos.github.io/MMGIS/contributing/connections";
const DEFAULT_PLUGINS_ROOT = path.join(__dirname, "..", "..", "plugins");
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_STATES = 5;
// Refresh tokens this close to expiring
const REFRESH_EARLY_MS = 60 * 1000;

let registry = null;

function loadConnections(pluginsRoot = DEFAULT_PLUGINS_ROOT) {
  const found = new Map();
  const discovered = discoverPlugins(pluginsRoot, "connections", "plugin.json", {
    loggerCategory: "Connections",
  });
  for (const p of discovered) {
    const m = p.manifest || {};
    const ref = `${p.container}/connections/${p.name}`;
    const refuse = (why) =>
      logger("error", `Connection '${ref}' was not loaded: ${why}`, "Connections");
    const id = typeof m.connection === "string" ? m.connection.toLowerCase() : "";
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) {
      refuse('its plugin.json needs a "connection" id: lowercase letters, digits, "-" or "_", starting with a letter.');
      continue;
    }
    if (found.has(id)) {
      refuse(`connection '${id}' is already provided by ${found.get(id).ref}.`);
      continue;
    }
    let impl;
    try {
      const lifecyclePath = path.join(p.pluginPath, "plugin.js");
      delete require.cache[require.resolve(lifecyclePath)];
      impl = require(lifecyclePath) || {};
    } catch (err) {
      refuse(`its plugin.js threw ${err && err.message ? err.message : err}`);
      continue;
    }
    if (typeof impl.authorizeUrl !== "function" || typeof impl.exchange !== "function") {
      refuse("its plugin.js must export authorizeUrl() and exchange().");
      continue;
    }
    found.set(id, {
      id,
      ref,
      name: p.name,
      label: m.display_name || p.name,
      description: typeof m.description === "string" ? m.description : "",
      guests: m.guests === true,
      env: Array.isArray(m.env) ? m.env.filter((e) => typeof e === "string") : [],
      manifest: m,
      impl,
    });
  }
  registry = found;
  return Array.from(found.keys());
}

function connectionMap() {
  if (registry == null) loadConnections();
  return registry;
}
const allConnections = () => Array.from(connectionMap().values());
const getConnection = (id) =>
  typeof id === "string" ? connectionMap().get(id.toLowerCase()) || null : null;

function hook(c, name, env) {
  if (typeof c.impl[name] !== "function") return [];
  try {
    const out = c.impl[name](env);
    if (Array.isArray(out)) return out.map(String);
    if (typeof out === "string" && out !== "") return [out];
    return [];
  } catch (err) {
    return [`${name}(env) threw ${err && err.message ? err.message : err}`];
  }
}

// What a site admin still has to do before users can connect
function setupStatus(c, env = process.env) {
  const missingEnv = c.env.filter((n) => env[n] == null || env[n] === "");
  const problems = hook(c, "validate", env);
  return { configured: missingEnv.length === 0 && problems.length === 0, missingEnv, problems };
}

function startupWarnings(env = process.env) {
  const out = [];
  allConnections().forEach((c) => {
    const s = setupStatus(c, env);
    // Unconfigured connections are only listed as "not set up"; real problems are logged
    if (s.missingEnv.length < c.env.length || c.env.length === 0)
      s.missingEnv.forEach((n) => out.push(`Connection '${c.id}': ${n} is not set, so users can't connect it.`));
    s.problems.forEach((p) => out.push(`Connection '${c.id}': ${p}`));
    hook(c, "warnings", env).forEach((w) => out.push(`Connection '${c.id}': ${w}`));
  });
  return out;
}

////// Who can hold a connection, and where it's kept

function principalOf(req) {
  return require("../permissions/authorize").ensurePrincipal(req);
}

// "account": stored against the MMGIS user; "session": this browser session only
function storageFor(principal, c) {
  if (!principal) return null;
  if (principal.kind === "user" && principal.userId != null) return "account";
  if (principal.kind === "external") return "session";
  if (principal.kind === "anonymous" && c.guests) return "session";
  return null;
}

class ConnectionRequiredError extends Error {
  constructor(service, reason, message) {
    super(message || `Connect ${service} to continue.`);
    this.service = service;
    this.reason = reason;
  }
}

const models = () => require("./models");

function grantRecord(grant) {
  if (!grant || typeof grant.accessToken !== "string" || grant.accessToken === "")
    throw new Error("The service did not return an access token.");
  let expiresAt = null;
  if (grant.expiresAt != null) expiresAt = new Date(grant.expiresAt);
  else if (Number.isFinite(Number(grant.expiresIn)) && Number(grant.expiresIn) > 0)
    expiresAt = new Date(Date.now() + Number(grant.expiresIn) * 1000);
  if (expiresAt && isNaN(expiresAt.getTime())) expiresAt = null;
  return {
    accessToken: grant.accessToken,
    refreshToken: typeof grant.refreshToken === "string" ? grant.refreshToken : null,
    account: grant.account != null ? String(grant.account).slice(0, 255) : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}

// Who a session-stored connection belongs to, so a different identity in the same browser session doesn't get it
function ownerKey(principal) {
  if (!principal || principal.kind === "anonymous") return "guest";
  if (principal.kind === "external") return `external:${principal.provider}:${principal.username}`;
  if (principal.kind === "user") return `user:${principal.userId}`;
  return null;
}

function sessionBag(req) {
  if (!req.session) return null;
  if (req.session.connections == null || typeof req.session.connections !== "object")
    req.session.connections = {};
  return req.session.connections;
}

async function readStored(req, principal, c) {
  const where = storageFor(principal, c);
  if (where === "account") {
    const row = await models().AuthConnection.findOne({
      where: { user_id: principal.userId, connection: c.id },
    });
    if (!row) return null;
    const secrets = secretBox.open(row.data);
    if (!secrets) {
      await row.destroy();
      return null;
    }
    return {
      ...secrets,
      account: row.account,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      connectedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      storage: "account",
    };
  }
  if (where === "session") {
    const sealed = req.session && req.session.connections && req.session.connections[c.id];
    if (!sealed) return null;
    const record = secretBox.open(sealed);
    const owner = ownerKey(principal);
    // A guest's connection only moves to an account at local sign-in (adoptSessionConnections)
    if (record && record.owner === "guest" && owner !== "guest") return null;
    if (!record || owner == null || record.owner !== owner) {
      delete req.session.connections[c.id];
      return null;
    }
    return { ...record, storage: "session" };
  }
  return null;
}

async function writeStored(req, principal, c, record) {
  const where = storageFor(principal, c);
  if (where === "account") {
    const { AuthConnection } = models();
    const fields = {
      account: record.account,
      data: secretBox.seal({ accessToken: record.accessToken, refreshToken: record.refreshToken }),
      expires_at: record.expiresAt,
    };
    const row = await AuthConnection.findOne({ where: { user_id: principal.userId, connection: c.id } });
    if (row) await row.update(fields);
    else await AuthConnection.create({ ...fields, user_id: principal.userId, connection: c.id });
    return "account";
  }
  if (where === "session") {
    sessionBag(req)[c.id] = secretBox.seal({ ...record, owner: ownerKey(principal), connectedAt: new Date().toISOString() });
    return "session";
  }
  throw new ConnectionRequiredError(c.id, "not_allowed", `Sign in to MMGIS to connect ${c.label}.`);
}

async function removeStored(req, principal, c) {
  if (storageFor(principal, c) === "account")
    await models().AuthConnection.destroy({ where: { user_id: principal.userId, connection: c.id } });
  if (req.session && req.session.connections && req.session.connections[c.id])
    delete req.session.connections[c.id];
}

// A guest's connections become the account's once they sign in
async function adoptSessionConnections(req, principal) {
  const bag = req.session && req.session.connections;
  if (!principal || principal.kind !== "user" || principal.userId == null || !bag) return;
  for (const id of Object.keys(bag)) {
    const c = getConnection(id);
    const record = secretBox.open(bag[id]);
    delete bag[id];
    if (!c || !record || record.owner !== "guest") continue;
    try {
      await writeStored(req, principal, c, record);
    } catch (err) {
      logger("error", `Failed to keep the ${c.label} connection after sign-in.`, "Connections", req, err);
    }
  }
  delete req.session.connections;
}

// Keeps a guest's session-only connections when the session is regenerated at sign-in
const wrappedSessions = new WeakSet();
function carryGuestConnections(req, res, next) {
  const session = req.session;
  if (session && typeof session.regenerate === "function" && !wrappedSessions.has(session)) {
    wrappedSessions.add(session);
    const original = session.regenerate.bind(session);
    session.regenerate = (cb) => {
      const carried = session.uid == null ? session.connections : null;
      original((err) => {
        if (!err && carried && req.session) req.session.connections = carried;
        if (typeof cb === "function") cb(err);
      });
    };
  }
  next();
}

async function revokeQuietly(c, record) {
  if (typeof c.impl.revoke !== "function" || !record) return;
  try {
    await c.impl.revoke({ accessToken: record.accessToken, refreshToken: record.refreshToken, env: process.env });
  } catch (err) {
    logger("warn", `Revoking a ${c.label} token at the service failed; it was removed from MMGIS.`, "Connections");
  }
}

////// For backend plugins

// The current user's access token for a service, refreshed when needed.
// Throws ConnectionRequiredError when the user has to connect (again).
async function token(req, id) {
  const c = getConnection(id);
  if (!c) throw new ConnectionRequiredError(String(id), "unknown", `No '${id}' connection is installed.`);
  if (!setupStatus(c).configured)
    throw new ConnectionRequiredError(c.id, "not_configured", `${c.label} isn't set up on this site.`);
  const principal = await principalOf(req);
  if (!storageFor(principal, c))
    throw new ConnectionRequiredError(
      c.id,
      principal && principal.kind === "token" ? "not_allowed" : "sign_in",
      principal && principal.kind === "token"
        ? "API tokens can't use service connections."
        : `Sign in to MMGIS to connect ${c.label}.`
    );
  await adoptSessionConnections(req, principal);
  const record = await readStored(req, principal, c);
  if (!record) throw new ConnectionRequiredError(c.id, "not_connected");
  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
  if (expiresAt == null || expiresAt - REFRESH_EARLY_MS > Date.now()) return record.accessToken;
  if (record.refreshToken && typeof c.impl.refresh === "function") {
    try {
      const fresh = grantRecord(
        await c.impl.refresh({ refreshToken: record.refreshToken, env: process.env })
      );
      if (!fresh.refreshToken) fresh.refreshToken = record.refreshToken;
      if (!fresh.account) fresh.account = record.account;
      await writeStored(req, principal, c, fresh);
      return fresh.accessToken;
    } catch (err) {
      logger("warn", `Refreshing a ${c.label} token failed; the user has to connect again.`, "Connections");
    }
  }
  if (expiresAt > Date.now()) return record.accessToken;
  await removeStored(req, principal, c);
  throw new ConnectionRequiredError(c.id, "expired", `Your ${c.label} connection expired. Connect again to continue.`);
}

// Standard reply for "connect first", which the main site's connection card understands
function connectionRequired(res, errOrService, reason) {
  const err =
    errOrService instanceof ConnectionRequiredError
      ? errOrService
      : new ConnectionRequiredError(String(errOrService), reason || "not_connected");
  res.status(403).send({
    status: "failure",
    code: "connection_required",
    service: err.service,
    reason: err.reason,
    message: err.message,
  });
}

////// Routes

let mountedRoot = null;
const rootPath = () => (mountedRoot != null ? mountedRoot : process.env.ROOT_PATH || "");

function callbackUrl(req, c) {
  const base = process.env.CONNECTIONS_CALLBACK_BASE_URL;
  const origin = base ? base.replace(/\/+$/, "") : `${req.protocol}://${req.get("host")}${rootPath()}`;
  return `${origin}/api/connections/${c.id}/callback`;
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

const flowLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    skipSuccessfulRequests: true,
    message: { status: "failure", message: "Too many attempts, try again later." },
  });

function renderResult(res, view) {
  res.status(view.ok ? 200 : 400).render("connected", {
    HOME: `${rootPath()}/`,
    ok: !!view.ok,
    label: view.label || "The service",
    account: view.account || "",
    message: view.message || "",
  });
}

function mountConnectionRoutes(app, { registerRouter, authorize, rootPath: root }) {
  if (typeof root === "string") mountedRoot = root;
  const router = express.Router();
  const { apilimiter } = require("../../scripts/rateLimiters");
  const limiter = flowLimiter();

  router.get("/", apilimiter, authorize("site.view"), async (req, res) => {
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
    apilimiter,
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
          };
        }),
      });
    }
  );

  router.get("/:id/connect", limiter, authorize("site.view"), async (req, res) => {
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
    req.session.connectionStates[state] = {
      id: c.id,
      at: Date.now(),
      mode: req.query.mode === "page" ? "page" : "tab",
      returnTo: sameSitePath(req.query.returnTo),
    };
    let url;
    try {
      url = await c.impl.authorizeUrl({ state, redirectUri: callbackUrl(req, c), env: process.env });
    } catch (err) {
      logger("error", `Connection '${c.id}': authorizeUrl() threw.`, req.originalUrl, req, err);
    }
    if (typeof url !== "string" || !/^https?:\/\//.test(url))
      return renderResult(res, { label: c.label, message: `${c.label} couldn't be reached. Try again later.` });
    req.session.save(() => res.redirect(url));
  });

  router.get("/:id/callback", limiter, authorize("site.view"), async (req, res) => {
    const c = getConnection(req.params.id);
    if (!c) return res.status(404).send({ status: "failure", message: "No such connection." });
    const states = req.session.connectionStates || {};
    const state = typeof req.query.state === "string" && /^[0-9a-f]{48}$/.test(req.query.state) ? req.query.state : "";
    const match = state ? Object.entries(states).find(([k]) => k === state) : null;
    const pending = match ? match[1] : null;
    if (pending) req.session.connectionStates = Object.fromEntries(Object.entries(states).filter(([k]) => k !== state));
    if (!pending || pending.id !== c.id || Date.now() - pending.at > STATE_TTL_MS)
      return renderResult(res, { label: c.label, message: "This sign-in link has expired. Go back to MMGIS and click Connect again." });
    if (typeof req.query.error === "string" || typeof req.query.code !== "string")
      return renderResult(res, { label: c.label, message: `${c.label} wasn't connected.` });
    const principal = await principalOf(req);
    let record;
    try {
      record = grantRecord(
        await c.impl.exchange({ code: req.query.code, redirectUri: callbackUrl(req, c), env: process.env })
      );
      await writeStored(req, principal, c, record);
    } catch (err) {
      logger("error", `Connecting '${c.id}' failed.`, req.originalUrl, req, err);
      return renderResult(res, {
        label: c.label,
        message:
          err instanceof ConnectionRequiredError ? err.message : `${c.label} couldn't be connected. Try again.`,
      });
    }
    logger("info", `${principal.username || "A guest"} connected ${c.label}.`, req.originalUrl, req);
    if (pending.mode === "page") return req.session.save(() => res.redirect(pending.returnTo));
    req.session.save(() => renderResult(res, { ok: true, label: c.label, account: record.account }));
  });

  router.post("/:id/disconnect", apilimiter, authorize("site.view"), async (req, res) => {
    const c = getConnection(req.params.id);
    if (!c) return res.status(404).send({ status: "failure", message: "No such connection." });
    try {
      const principal = await principalOf(req);
      const record = await readStored(req, principal, c);
      await removeStored(req, principal, c);
      await revokeQuietly(c, record);
      res.send({ status: "success" });
    } catch (err) {
      logger("error", `Disconnecting '${c.id}' failed.`, req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to disconnect." });
    }
  });

  const prefix = `${rootPath()}/api/connections`;
  app.use(prefix, registerRouter(prefix, router));
}

module.exports = {
  DOCS_URL,
  loadConnections,
  allConnections,
  getConnection,
  setupStatus,
  startupWarnings,
  storageFor,
  grantRecord,
  readStored,
  writeStored,
  removeStored,
  adoptSessionConnections,
  carryGuestConnections,
  token,
  connectionRequired,
  ConnectionRequiredError,
  mountConnectionRoutes,
  sameSitePath,
  ownerKey,
};
