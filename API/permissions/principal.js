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
  return rows.map(toBinding).filter((b) => b.scope != null);
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
  const { provider, username, groups: groupNames } = identity;
  return cached(`external:${provider}:${username}:${groupNames.join(",")}`, async () => {
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
    { token_hash: hash, token_prefix: raw.slice(0, 12), token: raw.slice(0, 12) },
    { where: { id: row.id } }
  );
  return row;
}

async function tokenPrincipal(authorization) {
  const raw = String(authorization).replace(/^Bearer:?\s+/i, "").trim();
  if (!raw) return null;
  const row = await findToken(raw);
  if (!row || row.created_by_user_id == null || tokenExpired(row)) return null;
  const creator = await userPrincipal(row.created_by_user_id);
  if (!creator) return null;
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
  // A logged-in session takes precedence over any Authorization header
  const session = req.session || {};
  if (session.uid != null) {
    const p = await userPrincipal(session.uid);
    if (p) return p;
  }
  const authorization = req.headers && req.headers.authorization;
  if (authorization && /^Bearer/i.test(String(authorization))) {
    const p = await tokenPrincipal(authorization);
    // An invalid token never falls back to anonymous access
    return p || { kind: "invalid_token", authenticated: false, bindings: [] };
  }
  if (req.identity) return externalPrincipal(req.identity);
  return anonymousPrincipal();
}

// Express middleware: attaches req.principal (never denies)
function principalMiddleware(req, res, next) {
  resolvePrincipal(req)
    .then((p) => {
      req.principal = p;
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
  invalidate,
  onInvalidate,
  hashToken,
  tokenExpired,
  siteAccess,
};
