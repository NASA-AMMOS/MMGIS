// Resolves who is making a request (req.principal): anonymous, a session
// user, a user identified per request by a login provider (e.g. CSSO), or a
// long-term token acting for its creator.
const crypto = require("crypto");
const { Op } = require("sequelize");
const logger = require("../logger");
const siteAccess = require("./siteAccess");
const { scopeKey } = require("./policy");

const CACHE_TTL = 10 * 1000;
const cache = new Map();
let generation = 0;

function models() {
  // Lazy to avoid require cycles with plugin models
  const permissionModels = require("./models");
  const { User } = require("../../plugins/core/backend/Users/models/user");
  const {
    LongTermTokens,
  } = require("../../plugins/core/backend/LongTermToken/models/longtermtokens");
  return { ...permissionModels, User, LongTermTokens };
}

const invalidateListeners = [];
// Lets other per-principal caches clear whenever access changes
function onInvalidate(fn) {
  invalidateListeners.push(fn);
}

// Call after any change to bindings, groups, memberships or users
function invalidate() {
  generation++;
  cache.clear();
  invalidateListeners.forEach((fn) => fn());
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function toBinding(row) {
  return {
    id: row.id,
    role: row.role,
    scope: scopeKey(row.scope_type, row.mission_uuid, row.layer_uuid),
    subject_type: row.subject_type,
    subject_id: row.subject_id,
  };
}

async function bindingsFor(subjects) {
  const { RoleBinding } = models();
  if (subjects.length === 0) return [];
  const rows = await RoleBinding.findAll({
    where: {
      [Op.or]: subjects.map(([t, id]) => ({
        subject_type: t,
        subject_id: String(id),
      })),
    },
    raw: true,
  });
  // SuperAdmin only ever comes from a user's own binding
  return rows
    .filter((r) => r.role !== "superadmin" || r.subject_type === "user")
    .map(toBinding)
    .filter((b) => b.scope != null);
}

async function cached(key, build) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.value;
  const gen = generation;
  const value = await build();
  if (gen === generation) cache.set(key, { ts: Date.now(), value });
  return value;
}

async function userPrincipal(userId) {
  return cached(`user:${userId}`, async () => {
    const { User, AuthGroupMember } = models();
    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id", "username"],
      raw: true,
    });
    if (!user) return null;
    const memberships = await AuthGroupMember.findAll({
      where: { user_id: user.id },
      attributes: ["group_id"],
      raw: true,
    });
    const groupIds = memberships.map((m) => m.group_id);
    const subjects = [
      ["user", user.id],
      ["audience", "authenticated"],
      ["audience", "everyone"],
      ...groupIds.map((g) => ["group", g]),
    ];
    return {
      kind: "user",
      authenticated: true,
      userId: user.id,
      username: user.username,
      groupIds,
      bindings: await bindingsFor(subjects),
    };
  });
}

// identity: a normalized login-provider identity (see providers.js)
async function externalPrincipal(identity) {
  const { provider, subject, username, groups: groupNames } = identity;
  return cached(`external:${provider}:${subject}:${username}:${groupNames.join(",")}`, async () => {
    const { AuthGroup } = models();
    const matched =
      groupNames.length > 0
        ? await AuthGroup.findAll({
            where: { source: provider, external_name: groupNames },
            attributes: ["id"],
            raw: true,
          })
        : [];
    const groupIds = matched.map((g) => g.id);
    const subjects = [
      ["audience", "authenticated"],
      ["audience", "everyone"],
      ...groupIds.map((g) => ["group", g]),
    ];
    return {
      kind: "external",
      provider,
      authenticated: true,
      userId: null,
      subject,
      username,
      groupIds,
      bindings: await bindingsFor(subjects),
    };
  });
}

async function anonymousPrincipal() {
  return cached("anonymous", async () => ({
    kind: "anonymous",
    authenticated: false,
    guestsAllowed: siteAccess.guestsAllowed(),
    userId: null,
    username: null,
    groupIds: [],
    bindings: await bindingsFor([
      ["audience", "anonymous"],
      ["audience", "everyone"],
    ]),
  }));
}

function tokenExpired(row) {
  if (row.revoked_at) return true;
  if (row.expires_at) return new Date(row.expires_at).getTime() <= Date.now();
  if (row.period == null || row.period === "never") return false;
  const period = parseInt(row.period);
  if (isNaN(period)) return true;
  return Date.now() - new Date(row.createdAt).getTime() >= period;
}

// Value for the old plaintext `token` column of hashed rows. Older releases look
// tokens up by that column, so it must never be derivable from the real token.
function unusableLegacyToken() {
  return `unusable_${crypto.randomBytes(32).toString("hex")}`;
}

// Hashed rows written before unusableLegacyToken kept a token prefix there
async function scrubLegacyTokenColumn() {
  const { LongTermTokens } = models();
  const rows = await LongTermTokens.findAll({
    where: {
      token_hash: { [Op.ne]: null },
      token: { [Op.notLike]: "unusable\\_%" },
    },
    attributes: ["id"],
  });
  for (const r of rows)
    await LongTermTokens.update(
      { token: unusableLegacyToken() },
      { where: { id: r.id } }
    );
  return rows.length;
}

// Finds a token row by hash, upgrading a not-yet-hashed legacy row in place
async function findToken(raw) {
  const { LongTermTokens } = models();
  const hash = hashToken(raw);
  let row = await LongTermTokens.findOne({ where: { token_hash: hash } });
  if (row) return row;
  row = await LongTermTokens.findOne({
    where: { token: raw, token_hash: null },
  });
  if (!row) return null;
  await LongTermTokens.update(
    { token_hash: hash, token_prefix: raw.slice(0, 12), token: unusableLegacyToken() },
    { where: { id: row.id } }
  );
  return row;
}

// Local accounts, and their tokens, only work while the login rules still let that account log in
function localAccountAllowed(p) {
  if (!siteAccess.hasProvider("local")) return false;
  return !siteAccess.localAdminsOnly() || require("./policy").isAdministrator(p);
}

// Accounts created by a login provider follow that provider; the rest are local accounts
async function accountAllowed(p) {
  const links = await models().AuthIdentity.findAll({
    where: { user_id: p.userId },
    attributes: ["provider"],
    raw: true,
  });
  if (links.length === 0) return localAccountAllowed(p);
  return links.some((l) => siteAccess.hasProvider(l.provider));
}

async function tokenPrincipal(authorization) {
  const raw = String(authorization).replace(/^Bearer:?\s+/i, "").trim();
  if (!raw) return null;
  const row = await findToken(raw);
  if (!row || row.created_by_user_id == null || tokenExpired(row)) return null;
  const creator = await userPrincipal(row.created_by_user_id);
  if (!creator || !(await accountAllowed(creator))) return null;
  const { LongTermTokens } = models();
  if (
    !row.last_used_at ||
    Date.now() - new Date(row.last_used_at).getTime() > 60 * 1000
  )
    LongTermTokens.update(
      { last_used_at: new Date() },
      { where: { id: row.id } }
    ).catch(() => {});
  return {
    ...creator,
    kind: "token",
    token: {
      id: row.id,
      name: row.name,
      scopes: Array.isArray(row.scopes) ? row.scopes : null,
      missions: Array.isArray(row.missions) ? row.missions : null,
    },
  };
}

async function resolvePrincipal(req) {
  // An explicit bearer token takes precedence over the session, so its limits always apply
  const authorization = req.headers && req.headers.authorization;
  if (authorization && /^Bearer/i.test(String(authorization))) {
    const p = await tokenPrincipal(authorization);
    const session = req.session || {};
    // An invalid token, or one used inside another user's session, never falls
    // back to the session or anonymous access
    if (!p || (session.uid != null && String(p.userId) !== String(session.uid)))
      return { kind: "invalid_token", authenticated: false, bindings: [] };
    return p;
  }
  const session = req.session || {};
  if (session.uid != null) {
    const p = await userPrincipal(session.uid);
    // Sessions started through a login provider follow that provider; the rest are local logins
    const allowed =
      p && (session.provider ? siteAccess.hasProvider(session.provider) : localAccountAllowed(p));
    if (allowed) return p;
    req.staleSession = true;
  }
  if (req.identity) return externalPrincipal(req.identity);
  return anonymousPrincipal();
}

// Express middleware: attaches req.principal (never denies)
function principalMiddleware(req, res, next) {
  resolvePrincipal(req)
    .then((p) => {
      req.principal = p;
      // The session's account was deleted or may no longer log in: sign it out
      if (req.staleSession && req.session) {
        req.session.uid = null;
        req.session.user = "guest";
        if (!req.identity) {
          req.user = "guest";
          req.groups = {};
        }
      }
      if (p.kind === "token") {
        req.isLongTermToken = true;
        req.user = p.username;
      }
      next();
    })
    .catch((err) => {
      logger("error", "Failed to resolve request principal.", req.originalUrl, req, err);
      req.principal = { kind: "anonymous", authenticated: false, bindings: [] };
      next();
    });
}

module.exports = {
  principalMiddleware,
  resolvePrincipal,
  userPrincipal,
  externalPrincipal,
  invalidate,
  onInvalidate,
  hashToken,
  tokenExpired,
  unusableLegacyToken,
  scrubLegacyTokenColumn,
  siteAccess,
};
