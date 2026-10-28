// Service connections: credentials for external services (e.g. Earthdata) that
// tools use on a signed-in user's behalf. A connection never signs anyone in
// to MMGIS; login providers (API/permissions/providers.js) do that.
//
// Connection plugins live in plugins/<container>/connections/<Name>/ with a
// plugin.json ("type": "connection", "connection": "<id>") and a plugin.js:
//   authorizeUrl({ state, redirectUri, env, codeChallenge, codeChallengeMethod }) -> URL of the service's sign-in page
//   exchange({ code, redirectUri, env, codeVerifier })      -> grant  (PKCE values only with "pkce": true)
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
// A plugin hook that doesn't settle in time fails, so a request never hangs on it
const HOOK_TIMEOUT_MS = 20 * 1000;
// How long a request with a still-valid token waits for an early refresh
const STILL_VALID_WAIT_MS = 2 * 1000;

function withTimeout(promiseOrValue, what, ms = HOOK_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    Promise.resolve(promiseOrValue),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${what} timed out`), { code: "ETIMEDOUT" })), ms);
      if (timer.unref) timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

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
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) {
      refuse('its plugin.json needs a "connection" id: lowercase letters, digits, "-" or "_", starting with a letter, at most 64 characters.');
      continue;
    }
    if (found.has(id)) {
      refuse(`connection '${id}' is already provided by ${found.get(id).ref}.`);
      continue;
    }
    const bad = [
      m.display_name !== undefined && typeof m.display_name !== "string" && "'display_name' must be a string",
      m.description !== undefined && typeof m.description !== "string" && "'description' must be a string",
      m.pkce !== undefined && typeof m.pkce !== "boolean" && "'pkce' must be true or false",
      m.guests !== undefined && typeof m.guests !== "boolean" && "'guests' must be true or false",
      m.env !== undefined && !(Array.isArray(m.env) && m.env.every((e) => typeof e === "string" && e !== "")) &&
        "'env' must be a list of environment variable names",
    ].filter(Boolean);
    if (bad.length) {
      refuse(bad.join("; ") + ".");
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
      label: (m.display_name || p.name).slice(0, 100),
      description: typeof m.description === "string" ? m.description : "",
      guests: m.guests === true,
      pkce: m.pkce === true,
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
  const clean = (s) => String(scrubbed(String(s), envSecrets(c, env || process.env)));
  try {
    const out = c.impl[name](env);
    if (out && typeof out.then === "function") {
      out.catch(() => {});
      return [`${name}(env) must return its list directly, not a Promise.`];
    }
    if (Array.isArray(out)) return out.map(clean);
    if (typeof out === "string" && out !== "") return [clean(out)];
    return [];
  } catch (err) {
    return [clean(`${name}(env) threw ${err && err.message ? err.message : err}`)];
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

const MAX_TOKEN_LENGTH = 64 * 1024;

function grantRecord(grant) {
  if (!grant || typeof grant.accessToken !== "string" || grant.accessToken === "")
    throw new Error("The service did not return an access token.");
  if (grant.accessToken.length > MAX_TOKEN_LENGTH || (typeof grant.refreshToken === "string" && grant.refreshToken.length > MAX_TOKEN_LENGTH))
    throw new Error("The service returned a token longer than MMGIS stores.");
  let expiresAt = null;
  // A relative lifetime doesn't depend on the service's clock, so it wins over an absolute expiry
  if (Number.isFinite(Number(grant.expiresIn)) && Number(grant.expiresIn) > 0)
    expiresAt = new Date(Date.now() + Number(grant.expiresIn) * 1000);
  else if (typeof grant.expiresAt === "number" || typeof grant.expiresAt === "string" || grant.expiresAt instanceof Date)
    expiresAt = new Date(grant.expiresAt);
  if (expiresAt && isNaN(expiresAt.getTime())) expiresAt = null;
  // A fresh token that is already expired means the clocks disagree; refreshing again won't
  // help, so treat it as unknown and rely on the service rejecting it (rejected())
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    logger("warn", "A service returned a token that had already expired; check the clocks of MMGIS and the service.", "Connections");
    expiresAt = null;
  }
  return {
    accessToken: grant.accessToken,
    refreshToken: typeof grant.refreshToken === "string" ? grant.refreshToken : null,
    account: grant.account != null ? String(grant.account).slice(0, 255) : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    issuedAt: new Date().toISOString(),
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
      logger("warn", `A stored ${c.label} connection couldn't be decrypted (was SECRET changed?), so it was removed and the user has to connect again.`, "Connections");
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
    if (!record)
      logger("warn", `A ${c.label} connection in a session couldn't be decrypted (was SECRET changed?), so it was dropped.`, "Connections");
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
      data: secretBox.seal({
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
        issuedAt: record.issuedAt || null,
      }),
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
  forgetRefreshes(req, principal, c);
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
      // Never replace a connection the account already has with one found in the browser session
      const existing = await models().AuthConnection.findOne({ where: { user_id: principal.userId, connection: c.id }, attributes: ["id"] });
      if (existing) {
        await revokeQuietly(c, record);
        continue;
      }
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
      // Pending sign-ins too: every page load re-checks the login and regenerates a guest's session
      const states = session.uid == null ? session.connectionStates : null;
      original((err) => {
        if (!err && carried && req.session) req.session.connections = carried;
        if (!err && states && req.session) req.session.connectionStates = states;
        if (typeof cb === "function") cb(err);
      });
    };
  }
  next();
}

async function revokeQuietly(c, record) {
  if (typeof c.impl.revoke !== "function" || !record) return;
  try {
    await withTimeout(
      (async () => c.impl.revoke({ accessToken: record.accessToken, refreshToken: record.refreshToken, env: process.env }))(),
      "revoke()"
    );
  } catch (err) {
    logger("warn", `Revoking a ${c.label} token at the service failed; it was removed from MMGIS.`, "Connections");
  }
}

////// For backend plugins

// Short-lived tokens refresh in the last quarter of their life, others in the last minute
function refreshEarlyMs(record) {
  const expiresAt = new Date(record.expiresAt).getTime();
  const issuedAt = record.issuedAt ? new Date(record.issuedAt).getTime() : NaN;
  if (!Number.isFinite(issuedAt) || !(expiresAt > issuedAt)) return REFRESH_EARLY_MS;
  return Math.min(REFRESH_EARLY_MS, (expiresAt - issuedAt) / 4);
}

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

// A refresh() failure worth retrying later (network, 429, 5xx); anything else means the grant is no good
function isTransient(err) {
  if (!err) return false;
  if (typeof err.transient === "boolean") return err.transient;
  const status = Number(err.status || err.statusCode || (err.response && err.response.status));
  if (status === 429 || status >= 500) return true;
  const code = err.code || (err.cause && err.cause.code);
  if (TRANSIENT_CODES.has(code)) return true;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  return err.name === "TypeError" && /fetch failed/i.test(err.message || "");
}

const errText = (err) => (err && err.message ? String(err.message).slice(0, 200) : String(err));

// A plugin's error with known secrets (codes, tokens, client secrets) taken out, for logging
// The plugin's own env values, plus anything that looks like a credential
const SECRET_NAME = /SECRET|PASSWORD|PASS$|TOKEN|_KEY$|^KEY$/i;
const envSecrets = (c, env = process.env) => [
  ...c.env.map((n) => env[n]),
  ...Object.keys(env)
    .filter((n) => SECRET_NAME.test(n) && typeof env[n] === "string" && env[n].length >= 8)
    .map((n) => env[n]),
];
function scrubbed(err, secrets) {
  const values = secrets.filter((v) => typeof v === "string" && v.length >= 4);
  const clean = (str) =>
    logger.redactCredentials(values.reduce((out, v) => out.split(v).join("_redacted_"), String(str == null ? "" : str)));
  if (!(err instanceof Error)) return err == null ? err : clean(typeof err === "string" ? err : JSON.stringify(err));
  const e = new Error(clean(err.message));
  e.name = err.name;
  e.stack = clean(err.stack);
  return e;
}

// One refresh per refresh token: parallel requests (and ones still holding the old
// token a moment later) share the result, so a rotating refresh token is used once.
// Per process; several MMGIS instances can still race.
const REFRESH_SHARE_MS = 30 * 1000;
const refreshing = new Map();

// Refreshes of a grant the user has since replaced or removed are neither shared nor saved
const superseded = new WeakSet();

function refreshScope(req, principal, c) {
  const owner = storageFor(principal, c) === "account" ? `user:${principal.userId}` : `session:${req.sessionID}`;
  return `${owner}|${c.id}|`;
}

function forgetRefreshes(req, principal, c) {
  const prefix = refreshScope(req, principal, c);
  for (const [k, job] of refreshing)
    if (k.startsWith(prefix)) {
      superseded.add(job);
      refreshing.delete(k);
    }
}

const digest = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

function startRefresh(keys, c, record) {
  const job = (async () => {
    const fresh = grantRecord(
      await withTimeout((async () => c.impl.refresh({ refreshToken: record.refreshToken, env: process.env }))(), "refresh()")
    );
    if (!fresh.refreshToken) fresh.refreshToken = record.refreshToken;
    if (!fresh.account) fresh.account = record.account;
    return fresh;
  })();
  const forget = () => keys.forEach((k) => refreshing.get(k) === job && refreshing.delete(k));
  keys.forEach((k) => refreshing.set(k, job));
  job.then(
    () => {
      const t = setTimeout(forget, REFRESH_SHARE_MS);
      if (t.unref) t.unref();
    },
    forget
  );
  return job;
}

// Several MMGIS servers can share one account's connection. Only the one that bumps the row
// first refreshes; the others wait for its result, so a rotating refresh token is used once.
const CLAIM_WAIT_MS = 10 * 1000;
async function claimRefresh(req, principal, c, record) {
  if (storageFor(principal, c) !== "account") return null;
  const { AuthConnection } = models();
  const row = await AuthConnection.findOne({ where: { user_id: principal.userId, connection: c.id } });
  if (!row) return null;
  const newer = async () => {
    const latest = await readStored(req, principal, c).catch(() => null);
    return latest && latest.refreshToken !== record.refreshToken ? latest : null;
  };
  const already = await newer();
  if (already) return already;
  const [claimed] = await AuthConnection.update(
    { expires_at: row.expires_at },
    { where: { id: row.id, updatedAt: row.updatedAt } }
  );
  if (claimed > 0) return null;
  for (const until = Date.now() + CLAIM_WAIT_MS; Date.now() < until; ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const latest = await newer();
    if (latest) return latest;
  }
  return null;
}

async function refreshStored(req, principal, c, record, rejected) {
  const scope = refreshScope(req, principal, c);
  const byGrant = `${scope}r:${digest(record.refreshToken)}`;
  let job = refreshing.get(byGrant);
  if (rejected) {
    // Everyone refused with the same access token shares one refresh. A refresh already
    // made with this grant only helps if it gave a different access token.
    const shared = job && (await job.catch(() => null));
    if (!shared || shared.accessToken === record.accessToken) {
      const byRefused = `${scope}a:${digest(record.accessToken)}`;
      job = refreshing.get(byRefused) || startRefresh([byRefused, byGrant], c, record);
    }
  } else if (job) {
    // A shared result only helps while it is itself fresh; a non-rotating refresh token
    // would otherwise keep handing out the same expired access token for REFRESH_SHARE_MS
    const shared = await job.catch(() => null);
    if (shared && shared.expiresAt != null && new Date(shared.expiresAt).getTime() - refreshEarlyMs(shared) <= Date.now())
      job = startRefresh([byGrant], c, record);
  } else {
    const other = await claimRefresh(req, principal, c, record);
    if (other) return other;
    job = refreshing.get(byGrant) || startRefresh([byGrant], c, record);
  }
  const fresh = await job;
  if (superseded.has(job)) return (await current(req, c.id)).record;
  await writeStored(req, principal, c, fresh);
  return fresh;
}

// Refreshes the record, or drops it and asks the user to connect again.
// `rejected`: the service already refused this access token.
async function renew(req, principal, c, record, rejected) {
  const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
  const stillValid = !rejected && expiresAt != null && expiresAt > Date.now();
  if (record.refreshToken && typeof c.impl.refresh === "function") {
    try {
      return await refreshStored(req, principal, c, record, rejected);
    } catch (err) {
      if (isTransient(err)) {
        logger("warn", `Refreshing a ${c.label} token failed for now (${errText(scrubbed(err, [record.refreshToken, record.accessToken, ...envSecrets(c)]))}); the connection is kept.`, "Connections");
        if (stillValid) return record;
        throw new ConnectionRequiredError(c.id, "unavailable", `${c.label} isn't responding. Try again in a moment.`);
      }
      // Another request may have saved a newer grant meanwhile; keep it
      const latest = await readStored(req, principal, c).catch(() => null);
      if (latest && latest.refreshToken !== record.refreshToken) {
        if (!rejected || latest.accessToken !== record.accessToken) return latest;
        // The newer grant still has the refused token: refresh it once
        try {
          return await refreshStored(req, principal, c, latest, true);
        } catch (retryErr) {
          if (isTransient(retryErr))
            throw new ConnectionRequiredError(c.id, "unavailable", `${c.label} isn't responding. Try again in a moment.`);
          // Otherwise fall through and ask the user to connect again
        }
      }
      logger("warn", `Refreshing a ${c.label} token failed (${errText(scrubbed(err, [record.refreshToken, record.accessToken, ...envSecrets(c)]))}); the user has to connect again.`, "Connections");
    }
  } else if (stillValid) return record;
  await removeStored(req, principal, c);
  if (rejected)
    throw new ConnectionRequiredError(c.id, "rejected", `${c.label} no longer accepts your connection. Connect again to continue.`);
  throw new ConnectionRequiredError(c.id, "expired", `Your ${c.label} connection expired. Connect again to continue.`);
}

async function current(req, id) {
  const c = getConnection(id);
  if (!c) throw new ConnectionRequiredError(String(id), "unknown", `No '${id}' connection is installed.`);
  if (!setupStatus(c).configured)
    throw new ConnectionRequiredError(c.id, "not_configured", `${c.label} isn't set up on this site.`);
  const principal = await principalOf(req);
  if (principal && principal.kind !== "token" && !require("../permissions/policy").can(principal, "site.view"))
    throw new ConnectionRequiredError(c.id, "sign_in", `Sign in to MMGIS to connect ${c.label}.`);
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
  if (!record) throw new ConnectionRequiredError(c.id, "not_connected", `Connect ${c.label} to continue.`);
  return { c, principal, record };
}

// The current user's access token for a service, refreshed when needed.
// Throws ConnectionRequiredError when the user has to connect (again).
async function token(req, id) {
  const { c, principal, record } = await current(req, id);
  const expiresAt = record.expiresAt == null ? null : new Date(record.expiresAt).getTime();
  if (expiresAt == null || expiresAt - refreshEarlyMs(record) > Date.now()) return record.accessToken;
  const renewing = renew(req, principal, c, record, false);
  // While the current token still works, don't keep the request waiting on a slow service
  if (expiresAt > Date.now() + STILL_VALID_WAIT_MS) {
    renewing.catch(() => {});
    const waited = await Promise.race([renewing, new Promise((resolve) => setTimeout(resolve, STILL_VALID_WAIT_MS))]);
    return (waited || record).accessToken;
  }
  return (await renewing).accessToken;
}

// For when the service refused a token from token() (say, a 401): refreshes it once and
// returns the new one, or throws ConnectionRequiredError so the user connects again.
async function rejected(req, id, accessToken) {
  const { c, principal, record } = await current(req, id);
  if (accessToken != null && record.accessToken !== accessToken) return record.accessToken;
  return (await renew(req, principal, c, record, true)).accessToken;
}

// For when the service is down or failing during a data call: the user stays connected
// and the card offers Try again. Throw it, or pass it to connectionRequired().
function unavailable(id, message) {
  const c = getConnection(id);
  const label = c ? c.label : String(id);
  return new ConnectionRequiredError(c ? c.id : String(id), "unavailable", message || `${label} isn't responding. Try again in a moment.`);
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
  const origin = base ? base.replace(/\/+$/, "") : `${req.protocol}://${publicHost(req)}${rootPath()}`;
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

// States already redeemed in this process
const usedStates = new Map();

const flowLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    skipSuccessfulRequests: true,
    message: { status: "failure", message: "Too many attempts, try again later." },
  });

// Each Connect saves a session to hold its OAuth state, so count every one, not just failures
const connectLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { status: "failure", message: "Too many attempts, try again later." },
  });

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
  let foreign = site === "cross-site" || site === "same-site";
  if (!foreign && origin) {
    try {
      const host = new URL(origin).host;
      foreign = host !== req.get("host") && host !== publicHost(req);
    } catch (err) {
      foreign = true;
    }
  }
  if (foreign) return res.status(403).send({ status: "failure", message: "Cross-site request refused." });
  next();
}

function mountConnectionRoutes(app, { registerRouter, authorize, rootPath: root }) {
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

  router.get("/:id/connect", connectLimiter(), authorize("site.view"), async (req, res) => {
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
    req.session.connectionStates[state] = {
      id: c.id,
      owner: ownerKey(principal),
      verifier,
      at: Date.now(),
      mode: req.query.mode === "page" ? "page" : "tab",
      returnTo: sameSitePath(req.query.returnTo),
    };
    let url;
    try {
      url = await withTimeout((async () => c.impl.authorizeUrl({
        state,
        redirectUri: callbackUrl(req, c),
        env: process.env,
        ...(verifier
          ? {
              codeChallenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
              codeChallengeMethod: "S256",
            }
          : {}),
      }))(), "authorizeUrl()");
    } catch (err) {
      logger("error", `Connection '${c.id}': authorizeUrl() threw.`, req.originalUrl, req, scrubbed(err, envSecrets(c)));
    }
    if (typeof url !== "string" || !/^https?:\/\//i.test(url))
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
      return renderResult(res, { id: c.id, label: c.label, message: "This sign-in link has expired. Go back to MMGIS and click Connect again." });
    if (typeof req.query.error === "string" || typeof req.query.code !== "string") {
      const detail = typeof req.query.error_description === "string" ? req.query.error_description.slice(0, 300) : "";
      if (typeof req.query.error === "string")
        logger("warn", `Connecting '${c.id}': the service returned '${req.query.error.slice(0, 100)}'${detail ? `: ${detail}` : ""}.`, req.baseUrl + req.path, logReq(req));
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
    const uidAtStart = req.session.uid;
    let record;
    try {
      record = grantRecord(
        await withTimeout((async () => c.impl.exchange({
          code: req.query.code,
          redirectUri: callbackUrl(req, c),
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
      if (req.session.connectionStates)
        req.session.connectionStates = Object.fromEntries(Object.entries(req.session.connectionStates).filter(([k]) => k !== state));
      const replaced = await readStored(req, principal, c).catch(() => null);
      forgetRefreshes(req, principal, c);
      await writeStored(req, principal, c, record);
      if (replaced && replaced.accessToken !== record.accessToken) revokeQuietly(c, replaced);
    } catch (err) {
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
      const record = await readStored(req, principal, c);
      await removeStored(req, principal, c);
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

module.exports = {
  scrubbed,
  callbackUrl,
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
  forgetRefreshes,
  current,
  adoptSessionConnections,
  carryGuestConnections,
  token,
  rejected,
  unavailable,
  isTransient,
  connectionRequired,
  ConnectionRequiredError,
  mountConnectionRoutes,
  sameSitePath,
  ownerKey,
  withTimeout,
  sameOriginOnly,
};
