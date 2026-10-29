// Tokens for backend plugins, refreshed when needed (one refresh per refresh token, per process)
const crypto = require("crypto");
const logger = require("../logger");
const common = require("./common");
const { REFRESH_EARLY_MS, STILL_VALID_WAIT_MS, withTimeout, ConnectionRequiredError, isTransient, errText, envSecrets, scrubbed } = common;
const { getConnection, setupStatus } = require("./registry");
const storage = require("./storage");
const { principalOf, storageFor, grantRecord, readStored, writeStored, removeStored, serialized, adoptSessionConnections, revokeQuietly } = storage;

// Short-lived tokens refresh in the last quarter of their life, others in the last minute
function refreshEarlyMs(record) {
  const expiresAt = new Date(record.expiresAt).getTime();
  const issuedAt = record.issuedAt ? new Date(record.issuedAt).getTime() : NaN;
  if (!Number.isFinite(issuedAt) || !(expiresAt > issuedAt)) return REFRESH_EARLY_MS;
  return Math.min(REFRESH_EARLY_MS, (expiresAt - issuedAt) / 4);
}


// One refresh per refresh token: parallel requests (and ones still holding the old
// token a moment later) share the result, so a rotating refresh token is used once.
// Per process: MMGIS runs as one server.
const REFRESH_SHARE_MS = 30 * 1000;
// A service that is down is asked again after this, not on every request
const FAILED_REFRESH_SHARE_MS = 5 * 1000;
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
  const forgetIn = (ms) => {
    const t = setTimeout(forget, ms);
    if (t.unref) t.unref();
  };
  job.then(
    () => forgetIn(REFRESH_SHARE_MS),
    (err) => (isTransient(err) ? forgetIn(FAILED_REFRESH_SHARE_MS) : forget())
  );
  return job;
}

// express-session's reload()/save() as a promise; false when the session is gone
function sessionCall(req, method) {
  const s = req.session;
  if (!s || typeof s[method] !== "function") return Promise.resolve(false);
  return new Promise((resolve) => s[method]((err) => resolve(!err)));
}

// A refreshed grant nobody keeps (the user disconnected or reconnected meanwhile) is revoked once
const orphaned = new WeakSet();
function dropOrphan(c, job, fresh) {
  if (orphaned.has(job)) return;
  orphaned.add(job);
  revokeQuietly(c, fresh);
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
  } else job = startRefresh([byGrant], c, record);
  const fresh = await job;
  // Save it only if the connection is still the one refreshed: not disconnected, reconnected or saved by another request
  return serialized(refreshScope(req, principal, c), async () => {
    // A refresh that outlasted its response (see tokenFor) works on the stored session, since
    // this request's copy is no longer saved
    const detached = storageFor(principal, c) === "session" && !!(req.res && req.res.headersSent);
    const loaded = !detached || (await sessionCall(req, "reload"));
    const now = loaded ? await readStored(req, principal, c) : null;
    if (!superseded.has(job) && now && now.refreshToken === record.refreshToken) {
      await writeStored(req, principal, c, { ...fresh, connectedAt: record.connectedAt });
      if (detached) await sessionCall(req, "save");
      return fresh;
    }
    if (!now) {
      if (detached && loaded) await sessionCall(req, "save");
      dropOrphan(c, job, fresh);
      throw new ConnectionRequiredError(c.id, "not_connected", `Connect ${c.label} to continue.`);
    }
    if (superseded.has(job) && now.accessToken !== fresh.accessToken && now.refreshToken !== fresh.refreshToken)
      dropOrphan(c, job, fresh);
    return now;
  });
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
      if (err instanceof ConnectionRequiredError || isDbError(err)) throw err;
      if (isTransient(err)) {
        logger("warn", `Refreshing a ${c.label} token failed for now (${errText(scrubbed(err, [record.refreshToken, record.accessToken, ...envSecrets(c)]))}); the connection is kept.`, "Connections");
        // The refresh may have outlasted the token; only hand back one that still works
        if (stillValid && expiresAt > Date.now()) return record;
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

const isDbError = (err) => !!err && /^Sequelize/.test(String(err.name));

// A database failure while reading or saving a connection: the user stays connected and can try again
function readable(c, fn) {
  return fn().catch((err) => {
    if (err instanceof ConnectionRequiredError) throw err;
    logger("error", `Reading or saving a ${c.label} connection failed.`, "Connections", null, err);
    throw new ConnectionRequiredError(c.id, "unavailable", `MMGIS couldn't reach your ${c.label} connection. Try again in a moment.`);
  });
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
  const record = await readable(c, async () => {
    await adoptSessionConnections(req, principal);
    return readStored(req, principal, c);
  });
  if (!record) throw new ConnectionRequiredError(c.id, "not_connected", `Connect ${c.label} to continue.`);
  return { c, principal, record };
}

// The current user's access token for a service, refreshed when needed.
// Throws ConnectionRequiredError when the user has to connect (again).
async function token(req, id) {
  const { c, principal, record } = await current(req, id);
  return readable(c, () => tokenFor(req, c, principal, record));
}
async function tokenFor(req, c, principal, record) {
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
  return readable(c, async () => (await renew(req, principal, c, record, true)).accessToken);
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

module.exports = { refreshScope, forgetRefreshes, current, token, rejected, unavailable, connectionRequired };
