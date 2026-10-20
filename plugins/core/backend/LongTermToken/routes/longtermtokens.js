/***********************************************************
 * Long-term tokens: hashed at rest, scoped to capabilities and
 * missions, and never more powerful than their creator.
 **********************************************************/
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { Op } = require("sequelize");

const logger = require("../../../../../API/logger");
const policy = require("../../../../../API/authz/policy");
const missions = require("../../../../../API/authz/missions");
const { authorize, ensurePrincipal } = require("../../../../../API/authz/authorize");
const { hashToken, invalidate } = require("../../../../../API/authz/principal");
const LongTermTokens = require("../models/longtermtokens").LongTermTokens;
const { User } = require("../../Users/models/user");

const TOKEN_PREFIX = "mmgis_";

// Tokens can't be used to manage tokens
function sessionOnly(req, res, next) {
  if (req.principal && req.principal.kind === "token") {
    res.status(403).send({ status: "failure", message: "Unauthorized!" });
    return;
  }
  next();
}

async function present(rows) {
  const users = await User.findAll({
    where: { id: rows.map((r) => r.created_by_user_id).filter((i) => i != null) },
    attributes: ["id", "username"],
    raw: true,
  });
  const names = Object.fromEntries(users.map((u) => [u.id, u.username]));
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      // Only a prefix is ever shown after creation
      token: r.token_prefix ? `${r.token_prefix}...` : `${String(r.token).slice(0, 12)}...`,
      period: r.period,
      scopes: r.scopes,
      missions: r.missions ? await missions.namesForUUIDs(r.missions) : null,
      expires_at: r.expires_at,
      last_used_at: r.last_used_at,
      created_by_user_id: r.created_by_user_id,
      created_by_username: names[r.created_by_user_id] || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
}

router.get("/get", authorize("tokens.create"), sessionOnly, async (req, res) => {
  try {
    const principal = req.principal;
    const where = { revoked_at: null };
    if (!policy.can(principal, "tokens.manage")) where.created_by_user_id = principal.userId;
    if (where.created_by_user_id == null && !policy.can(principal, "tokens.manage"))
      return res.send({ status: "success", tokens: [] });
    const rows = await LongTermTokens.findAll({
      where,
      order: [["createdAt", "DESC"]],
      raw: true,
    });
    res.send({ status: "success", tokens: await present(rows) });
  } catch (err) {
    logger("error", "Failed to get all tokens.", req.originalUrl, req, err);
    res.send({ status: "failure", message: "Failed to get tokens." });
  }
});

class TokenError extends Error {}

// Validates requested scopes/missions against what the creator holds right now
async function resolveRequest(principal, body) {
  const holds = (cap) =>
    policy.MISSION_SCOPED.has(cap)
      ? policy.capabilitiesOf(principal).includes(cap)
      : policy.can(principal, cap);
  let scopes = body.scopes;
  if (scopes === "read" || scopes == null) {
    scopes = scopes === "read" || !hasAnyWrite(principal) ? policy.READ_CAPABILITIES.slice() : null;
    // A default read set only carries the read capabilities the creator holds
    if (scopes != null) scopes = scopes.filter(holds);
    if (scopes != null && scopes.length === 0)
      throw new TokenError("You have no read access to put in a token.");
  }
  if (scopes != null) {
    if (!Array.isArray(scopes) || scopes.length === 0)
      throw new TokenError("scopes must be 'read', null (all of your access) or an array of capabilities.");
    scopes = Array.from(new Set(scopes.map(String)));
    for (const cap of scopes) {
      if (!policy.CAPABILITIES[cap]) throw new TokenError(`Unknown capability '${cap}'.`);
      if (cap === "tokens.create" || cap === "tokens.manage")
        throw new TokenError("Tokens cannot manage tokens.");
      if (!holds(cap)) throw new TokenError(`You do not have '${cap}'.`);
    }
  } else if (!policy.isSuperAdmin(principal) && !hasAnyWrite(principal)) {
    scopes = policy.READ_CAPABILITIES.filter(holds);
  }
  let missionUUIDs = null;
  if (Array.isArray(body.missions)) {
    missionUUIDs = [];
    const reachable = policy.missionsWith(principal, "mission.view");
    for (const name of body.missions) {
      const uuid = await missions.uuidForName(name);
      if (!uuid) throw new TokenError(`Unknown mission '${name}'.`);
      if (reachable != null && !reachable.includes(uuid))
        throw new TokenError(`You do not have access to mission '${name}'.`);
      missionUUIDs.push(uuid);
    }
  }
  return { scopes, missions: missionUUIDs };
}

function hasAnyWrite(principal) {
  const caps = policy.capabilitiesOf(principal);
  return caps.some((c) => !policy.READ_CAPABILITIES.includes(c) && !policy.BASELINE.authenticated.has(c));
}

function expiryFrom(period) {
  if (period == null || period === "never") return null;
  const ms = parseInt(period);
  if (isNaN(ms) || ms <= 0) throw new TokenError("period must be 'never' or a positive number of milliseconds.");
  return new Date(Date.now() + ms);
}

router.post("/generate", authorize("tokens.create"), sessionOnly, async (req, res) => {
  try {
    const principal = req.principal;
    if (principal.userId == null) throw new TokenError("Only signed-in accounts may create tokens.");
    const body = req.body || {};
    const { scopes, missions: missionUUIDs } = await resolveRequest(principal, body);
    const expires_at = expiryFrom(body.period);
    const label = body.name ? String(body.name).replace(/[^0-9a-zA-Z]/g, "").toLowerCase() : "";
    const secret = crypto.randomBytes(32).toString("hex");
    const token = `${TOKEN_PREFIX}${label ? label + "_" : ""}${secret}`;
    const token_prefix = token.slice(0, TOKEN_PREFIX.length + (label ? label.length + 1 : 0) + 6);
    const created = await LongTermTokens.create({
      token: token_prefix,
      token_hash: hashToken(token),
      token_prefix,
      name: body.name ? String(body.name) : null,
      period: body.period == null ? "never" : String(body.period),
      scopes,
      missions: missionUUIDs,
      expires_at,
      created_by_user_id: principal.userId,
    });
    res.send({
      status: "success",
      message: "Successfully created long term token. Copy it now; it will not be shown again.",
      body: {
        id: created.id,
        token,
        name: created.name,
        period: created.period,
        scopes,
        missions: Array.isArray(body.missions) ? body.missions : null,
        expires_at,
        created_by_user_id: principal.userId,
      },
    });
  } catch (err) {
    if (err instanceof TokenError) return res.send({ status: "failure", message: err.message });
    logger("error", "Failed to create long term token.", req.originalUrl, req, err);
    res.send({ status: "failure", message: "Failed to create long term token!" });
  }
});

router.post("/clear", authorize("tokens.create"), sessionOnly, async (req, res) => {
  try {
    if (req.body.id == null)
      return res.send({
        status: "failure",
        message: `Failed to delete long term token. body.id is undefined.`,
      });
    const token = await LongTermTokens.findOne({ where: { id: parseInt(req.body.id) } });
    const principal = req.principal;
    if (
      !token ||
      (!policy.can(principal, "tokens.manage") && token.created_by_user_id !== principal.userId)
    )
      return res.send({
        status: "failure",
        message: `Token with id ${req.body.id} not found.`,
      });
    await token.destroy();
    invalidate();
    res.send({
      status: "success",
      message: `Successfully deleted long term token with id ${req.body.id}.`,
    });
  } catch (err) {
    logger("error", "Failed to delete long term token.", req.originalUrl, req, err);
    res.send({
      status: "failure",
      message: `Failed to delete long term token with id ${req.body.id}!`,
    });
  }
});

module.exports = router;
module.exports.TOKEN_PREFIX = TOKEN_PREFIX;
