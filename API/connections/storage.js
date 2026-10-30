// Where a connection's grant is kept: encrypted against the MMGIS account, or in the browser session
const logger = require("../logger");
const secretBox = require("./secretBox");
const { withTimeout, ConnectionRequiredError } = require("./common");
const { getConnection } = require("./registry");

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
  // By subject: two people can share a username at one provider
  if (principal.kind === "external")
    return `external:${principal.provider}:${principal.subject != null ? principal.subject : principal.username}`;
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
      // Kept, so putting the old SECRET back restores it; connecting again replaces it
      logger("warn", `A stored ${c.label} connection couldn't be decrypted (was SECRET changed?), so the user has to connect again.`, "Connections");
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
    const bag = req.session && req.session.connections;
    // Own keys only: an id like "constructor" must not read Object.prototype
    const sealed = bag && Object.prototype.hasOwnProperty.call(bag, c.id) ? bag[c.id] : null;
    if (typeof sealed !== "string") return null;
    const record = secretBox.open(sealed);
    if (!record)
      logger("warn", `A ${c.label} connection in a session couldn't be decrypted (was SECRET changed?), so it was dropped.`, "Connections");
    const owner = ownerKey(principal);
    // A guest's connection only moves to an account at local sign-in (adoptSessionConnections)
    if (record && record.owner === "guest" && owner !== "guest") return null;
    // A request that began before a Disconnect still holds the session as it was then
    const gone = disconnectedAt.get(sessionKey(req, c));
    const stale = record && gone != null && !(Date.parse(record.connectedAt) > gone);
    if (!record || owner == null || record.owner !== owner || stale) {
      delete req.session.connections[c.id];
      return null;
    }
    return { ...record, storage: "session" };
  }
  return null;
}

// When each browser session last disconnected a session-stored connection. Kept as long as a
// session can live (the cookie maxAge in scripts/server.js), since a request that began before
// the Disconnect can save its older copy of the session at any point after it
const DISCONNECT_MEMORY_MS = 24 * 60 * 60 * 1000;
const disconnectedAt = new Map();
const sessionKey = (req, c) => `${req.sessionID}|${c.id}`;

// Runs fn after any earlier fn with the same key, so a read-then-write of one stored
// connection isn't interleaved with another (one MMGIS server)
const locks = new Map();
function serialized(key, fn) {
  const run = (locks.get(key) || Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => locks.get(key) === tail && locks.delete(key));
  return run;
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
    sessionBag(req)[c.id] = secretBox.seal({
      ...record,
      owner: ownerKey(principal),
      connectedAt: record.connectedAt || new Date().toISOString(),
    });
    return "session";
  }
  throw new ConnectionRequiredError(c.id, "not_allowed", `Sign in to MMGIS to connect ${c.label}.`);
}

async function removeStored(req, principal, c) {
  require("./refresh").forgetRefreshes(req, principal, c);
  if (storageFor(principal, c) === "account")
    await models().AuthConnection.destroy({ where: { user_id: principal.userId, connection: c.id } });
  if (req.sessionID) {
    const now = Date.now();
    for (const [k, at] of disconnectedAt) if (now - at > DISCONNECT_MEMORY_MS) disconnectedAt.delete(k);
    disconnectedAt.set(sessionKey(req, c), now);
  }
  if (req.session && req.session.connections && Object.prototype.hasOwnProperty.call(req.session.connections, c.id))
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
        // In the background: a slow service shouldn't hold up sign-in. revokeQuietly never throws.
        revokeQuietly(c, record);
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

module.exports = {
  principalOf,
  storageFor,
  models,
  grantRecord,
  ownerKey,
  readStored,
  writeStored,
  removeStored,
  serialized,
  adoptSessionConnections,
  carryGuestConnections,
  revokeQuietly,
};
