// Login providers answer "who is this?"; roles, bindings and groups decide
// what that person may do, whichever provider answered.
//
// Providers are core plugins under plugins/core/auth/<Name>/ whose plugin.json
// sets "type": "auth", "provider": "<id>", "tier": "core" and
// "overridable": false. Their plugin.js may export:
//   identify(req)          -> identity | null  per-request (header/proxy) login
//   routes(router, ctx)    mounts login/callback routes at /api/auth/<id>;
//                          ctx.completeLogin(req, identity) starts a session
//   validate(env)          -> string[]  problems that refuse startup
//   warnings(env)          -> string[]  problems logged at startup
//   loginForm(env)         -> { title?, usernameLabel?, hint? }  wording of the
//                          shared username/password form, for providers whose
//                          plugin.json sets "login_form": true
// An identity is { subject, username?, email?, groups?: string[], strictGroups?: string[], session? }.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Op } = require("sequelize");
const { rateLimit } = require("express-rate-limit");
const logger = require("../logger");
const { discoverPlugins } = require("../pluginDiscovery");
const siteAccess = require("./siteAccess");
const { withTimeout } = require("../connections/common");

// Ids of the shipped providers; only their own plugin folders may use them
const BUILTIN_PROVIDERS = { local: "Local", proxy: "Proxy" };
const DOCS_URL = "https://nasa-ammos.github.io/MMGIS/contributing/auth-providers";
const DEFAULT_PLUGINS_ROOT = path.join(__dirname, "..", "..", "plugins");

let registry = null;
// Provider ids claimed by more than one plugin folder
let conflicts = new Set();

function loadProviders(pluginsRoot = DEFAULT_PLUGINS_ROOT) {
  const found = new Map();
  conflicts = new Set();
  const discovered = discoverPlugins(pluginsRoot, "auth", "plugin.json", {
    loggerCategory: "AuthProviders",
  });
  for (const p of discovered) {
    const m = p.manifest || {};
    const refuse = (why) =>
      logger(
        "error",
        `Auth provider '${p.container}/auth/${p.name}' was not loaded: ${why}`,
        "AuthProviders"
      );
    if (p.container !== "core") {
      refuse("auth providers must be core plugins (plugins/core/auth/).");
      continue;
    }
    if (m.tier !== "core" || m.overridable !== false) {
      refuse('its plugin.json must set "tier": "core" and "overridable": false.');
      continue;
    }
    const id = typeof m.provider === "string" ? m.provider.toLowerCase() : "";
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) {
      refuse(
        'its plugin.json needs a "provider" id: lowercase letters, digits, "-" or "_", starting with a letter.'
      );
      continue;
    }
    if (BUILTIN_PROVIDERS[id] && p.name !== BUILTIN_PROVIDERS[id]) {
      refuse(`'${id}' is the id of the built-in ${BUILTIN_PROVIDERS[id]} provider. Pick another "provider" id.`);
      continue;
    }
    if (found.has(id)) {
      conflicts.add(id);
      refuse(`provider '${id}' is already provided by ${found.get(id).name}.`);
      continue;
    }
    let impl;
    try {
      const lifecyclePath = path.join(p.pluginPath, "plugin.js");
      delete require.cache[require.resolve(lifecyclePath)];
      impl = require(lifecyclePath) || {};
    } catch (err) {
      logger(
        "error",
        `Auth provider '${p.container}/auth/${p.name}' was not loaded: its plugin.js threw ${err && err.stack ? err.stack.split("\n").slice(0, 2).join(" ") : err}`,
        "AuthProviders"
      );
      continue;
    }
    found.set(id, { id, name: p.name, label: m.display_name || p.name, manifest: m, impl, dir: p.pluginPath, core: p.container === "core" });
  }
  registry = found;
  require("../pluginFaults").register("auth", Array.from(found.values()).filter((p) => !p.core).map((p) => p.dir));
  return availableProviders();
}

function providerMap() {
  if (registry == null) loadProviders();
  return registry;
}

const availableProviders = () => Array.from(providerMap().keys());
const conflictingProviders = () => {
  providerMap();
  return Array.from(conflicts);
};
const getProvider = (id) => providerMap().get(id) || null;
const enabledProviders = (ids = siteAccess.getProviders()) =>
  ids.map(getProvider).filter(Boolean);

function collect(hook, ids, env) {
  const out = [];
  enabledProviders(ids).forEach((p) => {
    if (typeof p.impl[hook] !== "function") return;
    let result;
    try {
      result = p.impl[hook](env);
    } catch (err) {
      out.push(`Auth provider '${p.id}': ${hook}(env) threw ${err && err.message ? err.message : err}`);
      return;
    }
    if (Array.isArray(result)) out.push(...result.map(String));
    else if (typeof result === "string" && result !== "") out.push(result);
    else if (result != null)
      out.push(
        `Auth provider '${p.id}': ${hook}(env) must return an array of strings${
          result && typeof result.then === "function" ? " synchronously (it returned a Promise)" : ""
        }.`
      );
  });
  return out;
}
const validateProviders = (ids, env = process.env) => collect("validate", ids, env);
const providerWarnings = (ids = siteAccess.getProviders(), env = process.env) => {
  const out = collect("warnings", ids, env);
  enabledProviders(ids).forEach((p) => {
    const lp = p.manifest.login_path;
    if (lp != null && (typeof lp !== "string" || !lp.startsWith("/")))
      out.push(
        `Auth provider '${p.id}': plugin.json "login_path" must start with "/", so no login ${p.manifest.login_form === true ? "form" : "button"} is shown.`
      );
  });
  if (!ids.includes("local"))
    out.push(
      `AUTH_PROVIDERS does not include local, so local admin accounts cannot sign in to /configure. Use ${JSON.stringify([...ids, "local"])} to keep them.`
    );
  return out;
};

function normalizeIdentity(provider, raw) {
  if (!raw || raw.subject == null || String(raw.subject) === "") return null;
  const subject = String(raw.subject);
  const groups = Array.isArray(raw.groups)
    ? Array.from(new Set(raw.groups.filter((g) => typeof g === "string" && g !== ""))).sort()
    : [];
  return {
    provider,
    subject,
    username: raw.username != null && String(raw.username) !== "" ? String(raw.username) : subject,
    email: typeof raw.email === "string" ? raw.email : null,
    groups,
    session: raw.session != null ? String(raw.session) : null,
    ...(typeof raw.dn === "string" && raw.dn !== "" ? { dn: raw.dn } : {}),
    ...(Array.isArray(raw.subjects) ? { subjects: raw.subjects.map(String).filter((v) => v !== "") } : {}),
    ...(Array.isArray(raw.strictGroups)
      ? { strictGroups: raw.strictGroups.filter((g) => typeof g === "string" && g !== "") }
      : {}),
  };
}

// identify runs on every request, so a hung provider must not hold requests open
const IDENTIFY_TIMEOUT_MS = 5000;
// lookup and locate may take longer when the provider says its own operations do
const lookupTimeout = (p) =>
  Math.max(IDENTIFY_TIMEOUT_MS, (typeof p.impl.lookupTimeoutMs === "function" && Number(p.impl.lookupTimeoutMs())) || 0);

// A person's request waits at most 5 s for a recheck, keeping its access meanwhile; a slower one applies once it ends
function requestWait(result, waitMs = IDENTIFY_TIMEOUT_MS, meanwhileValue = true) {
  let timer;
  const meanwhile = new Promise((resolve) => {
    timer = setTimeout(() => resolve(meanwhileValue), waitMs);
    if (timer.unref) timer.unref();
  });
  return Promise.race([result, meanwhile]).finally(() => clearTimeout(timer));
}

// The first enabled provider that recognizes this request, or null
async function identify(req) {
  for (const p of enabledProviders()) {
    if (typeof p.impl.identify !== "function") continue;
    let raw;
    try {
      raw = await withTimeout(p.impl.identify(req), "identify(req)", IDENTIFY_TIMEOUT_MS);
    } catch (err) {
      logger("error", `Auth provider '${p.id}': identify(req) ${err && err.code === "ETIMEDOUT" ? `took over ${IDENTIFY_TIMEOUT_MS / 1000} s` : "threw"}; treating the request as not identified.`, "AuthProviders", req, err);
      continue;
    }
    const identity = normalizeIdentity(p.id, raw);
    if (identity) return identity;
  }
  return null;
}

////// Accounts for session-based (redirect) providers

// err.message has the details for the server log; providers show users only err.userMessage
// Draw keeps group-shared and master files under the owner "group"
// and a deleted account's files under "~deleted~<id>~<random>"; signed-out visitors' session user is "guest"
const reservedUsername = (name) => {
  const n = String(name).normalize("NFKC").trim().replace(/\u0130/g, "I").toLowerCase();
  return n === "group" || n === "guest" || n.startsWith("~deleted~");
};

// Usernames are shown in pages (e.g. Draw's "by <owner>"); markup characters there would be script.
// Draw's shared-editor lists are comma-separated, so "smith, john" would make "smith" and "john" editors
const unsafeUsername = (name) => /[\u0000-\u001f\u007f<>"`\\,]/.test(String(name));

class LinkError extends Error {
  constructor(message, userMessage) {
    super(message);
    // The same for every refusal, so it doesn't reveal which usernames have accounts
    this.userMessage =
      userMessage || "This sign-in can't be used with MMGIS yet. Ask an administrator.";
  }
}

// "account 3 'sci01'", so log lines name the person the way Users & Access does
async function who(m, userId) {
  const u =
    m.User && typeof m.User.findOne === "function"
      ? await m.User.findOne({ where: { id: userId }, attributes: ["username"], raw: true }).catch(() => null)
      : null;
  return u && u.username ? `account ${userId} '${u.username}'` : `account ${userId}`;
}

// Usernames differing only in case or Unicode form ("josé" composed or not) would be look-alike accounts
function usernameTaken(username) {
  const { User } = require("../../plugins/core/backend/Users/models/user");
  const { sequelize } = require("../connection");
  // Both sides fold in Postgres, so its lower() and JavaScript's can't disagree (e.g. on a final sigma)
  const folded = (v) =>
    sequelize.fn("lower", sequelize.fn("replace", sequelize.fn("normalize", v, sequelize.literal("NFKC")), "\u0130", "I"));
  const name = String(username);
  // The exact name first, so a log naming the holder names the right account
  return User.findOne({ where: { username: name }, attributes: ["id"], raw: true }).then(
    (exact) =>
      exact ||
      User.findOne({ where: sequelize.where(folded(sequelize.col("username")), folded(name)), attributes: ["id"], raw: true })
  );
}

// Whether any account is linked to a provider other than local, enabled or not (siteAccess.selfSignupAllowed)
async function refreshProviderAccounts(m = accountModels()) {
  const exist = (await m.AuthIdentity.count({ where: { provider: { [Op.ne]: "local" } } })) > 0;
  siteAccess.setProviderAccounts(exist);
  return exist;
}

function accountModels() {
  const { AuthIdentity, AuthGroup, AuthGroupMember, AuthMeta } = require("./models");
  const { User } = require("../../plugins/core/backend/Users/models/user");
  const { sequelize } = require("../connection");
  return {
    User,
    AuthIdentity,
    AuthGroup,
    AuthGroupMember,
    AuthMeta,
    transaction: (fn) => sequelize.transaction(fn),
    usernameTaken,
    isSuperAdmin: async (userId) => (await require("./bindings").superAdminUserIds()).includes(Number(userId)),
    // connect-pg-simple's session table has no model; Local's password reset ends sessions the same way
    endSessionsOf: (userId) =>
      sequelize.query(`DELETE FROM "session" WHERE sess->>'uid' = :uid`, { replacements: { uid: String(userId) } }),
  };
}

const inTransaction = (m, fn) => (m.transaction ? m.transaction(fn) : fn(undefined));

// An admin can let the next login through a provider claim an existing account, e.g. after
// a directory rebuild gave everyone new subjects. Stored in auth_meta under relinkKey() as
// { username (at the provider), subject (when the provider could look it up), expires_at, by }.
const RELINK_HOURS = 24;
const relinkKey = (provider, userId) => `relink:${provider}:${userId}`;
// Set while a recheck finds the account's entry gone, so admins can tell leavers from active people
const missingKey = (provider, userId) => `missing:${provider}:${userId}`;
async function markMissing(m, provider, userId, gone, subject, reason) {
  if (!m.AuthMeta) return;
  const key = missingKey(provider, userId);
  if (!gone) return m.AuthMeta.destroy({ where: { key } });
  const marked = await m.AuthMeta.findOne({ where: { key }, raw: true });
  // Keeps when it went missing; the reason can change, e.g. a leaver found after a subject setting change,
  // which still needs the leaver warning: its username may now be someone else's
  if (marked && (marked.value || {}).reason !== reason)
    return m.AuthMeta.update(
      { value: { ...marked.value, reason, ...(reason === "subject" && !(marked.value || {}).reason ? { was_gone: true } : {}) } },
      { where: { key } }
    );
  if (!marked)
    // Another recheck (or process) may have marked it at the same moment
    await m.AuthMeta.create({ key, value: { since: new Date().toISOString(), subject, reason } }).catch((err) => {
      if (err.name !== "SequelizeUniqueConstraintError") throw err;
    });
}
// Directories match the dotted capital İ as i, which toLowerCase() alone turns into i + U+0307
const fold = (s) => String(s).normalize("NFKC").replace(/\u0130/g, "I").toLowerCase();
const sameUsername = (a, b) => fold(a) === fold(b);
// The exact name wins; otherwise a case- or Unicode-folded match, but only if it's the only one
function matchUsername(rows, name) {
  const alike = rows.filter((r) => sameUsername(r.username, name));
  return { match: rows.find((r) => r.username === name) || (alike.length === 1 ? alike[0] : null), alike };
}

// As directories usually match names: without case, Unicode compatibility forms or extra spaces
const foldValue = (v) => String(v).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const sameFolded = (a, b) => foldValue(a) === foldValue(b);

// The pinned subject is this entry's, even if a multi-valued attribute now lists it after another value
const pinnedTo = (v, identity) =>
  v.subject === identity.subject ||
  (!!v.dn && !!identity.dn && sameFolded(v.dn, identity.dn) && (identity.subjects || []).includes(v.subject));

async function findClaim(identity, m) {
  if (!m.AuthMeta) return null;
  const rows = await m.AuthMeta.findAll({
    where: { key: { [Op.like]: `relink:${identity.provider}:%` } },
    raw: true,
  });
  for (const r of rows) {
    // LIKE reads _ in a provider id as any character
    if (!r.key.startsWith(`relink:${identity.provider}:`)) continue;
    const v = r.value;
    // Flagged under another subject setting: People says it won't take effect until a check unflags it
    if (!v || (v.stale && v.stale.setting)) continue;
    if (!(Date.parse(v.expires_at) > Date.now())) {
      if (v.subject ? pinnedTo(v, identity) : sameUsername(v.username, identity.username))
        logger(
          "warn",
          `Auth provider '${identity.provider}': the relink for account ${r.key.split(":").pop()} expired at ${v.expires_at}, so '${identity.username}' didn't take it over. If they should, allow the relink again (and delete any account this sign-in created for them).`,
          "AuthProviders"
        );
      continue;
    }
    // A pin from under another subject setting may now be a different entry's value
    if (v.subject && v.subject_setting && v.subject_setting !== subjectSetting(getProvider(identity.provider))) continue;
    // Only the entry the admin was shown may claim it, whatever it is called by now
    if (v.subject ? !pinnedTo(v, identity) : !sameUsername(v.username, identity.username)) continue;
    // A value that isn't a permanent ID (e.g. cn) may be another entry's too
    const p = getProvider(identity.provider);
    if (v.subject && v.dn && p && typeof p.impl.subjectPermanent === "function" && !p.impl.subjectPermanent() && !(identity.dn && sameFolded(identity.dn, v.dn))) {
      // Refused rather than given a new account, which would then hold the subject the relink is waiting for
      await markStale(m, r.key, v, { dn: identity.dn || null, at: new Date().toISOString() });
      throw new LinkError(
        `The ${identity.provider} relink for account ${r.key.split(":").pop()} is pinned to ${v.dn}, but '${identity.username}' signs in from ${identity.dn || "another entry"} with the same subject '${identity.subject}', so it may be a different entry. If it's the same person after a rename, allow the relink again.`
      );
    }
    return { key: r.key, userId: parseInt(r.key.split(":").pop(), 10), by: v.by, dn: v.dn, superadmin: !!v.superadmin };
  }
  return null;
}

// Unless an admin allowed or cancelled it again since it was read
async function markStale(m, key, v, stale) {
  if (!m.AuthMeta.update) return;
  const now = await m.AuthMeta.findOne({ where: { key }, raw: true });
  if (!now || !now.value || now.value.expires_at !== v.expires_at) return;
  await m.AuthMeta.update({ value: { ...now.value, stale } }, { where: { key } });
}

// A relink pinned to an entry, while the same username now signs in from another one (the directory was
// rebuilt after the relink was allowed): flag it, so People and the log say to allow it again
async function flagStaleClaims(identity, m) {
  if (!m.AuthMeta || !m.AuthMeta.update) return;
  const rows = await m.AuthMeta.findAll({
    where: { key: { [Op.like]: `relink:${identity.provider}:%` } },
    raw: true,
  });
  for (const r of rows) {
    // LIKE reads _ in a provider id as any character
    if (!r.key.startsWith(`relink:${identity.provider}:`)) continue;
    const v = r.value;
    if (!v || !v.subject || pinnedTo(v, identity) || !(Date.parse(v.expires_at) > Date.now())) continue;
    if (!sameUsername(v.username, identity.username)) continue;
    await markStale(m, r.key, v, { subject: identity.subject, at: new Date().toISOString() });
    logger(
      "warn",
      `The ${identity.provider} relink for account ${r.key.split(":").pop()} is pinned to ${v.dn || `subject '${v.subject}'`}, but '${identity.username}' now signs in as subject '${identity.subject}'. If the directory changed since the relink was allowed, allow it again.`,
      "AuthProviders"
    );
  }
}

// The account this login takes over through a pending relink, or null
async function claimRelink(identity, m) {
  const claim = await findClaim(identity, m);
  if (!claim) {
    await flagStaleClaims(identity, m);
    return null;
  }
  const user = await m.User.findOne({ where: { id: claim.userId }, attributes: ["id", "username"], raw: true });
  if (!user) return null;
  // Made a SuperAdmin after the relink was allowed: whoever allowed it didn't hand over a SuperAdmin
  if (!claim.superadmin && m.isSuperAdmin && (await m.isSuperAdmin(user.id))) {
    await m.AuthMeta.destroy({ where: { key: claim.key } });
    throw new LinkError(
      `The ${identity.provider} relink for account ${user.id} '${user.username}' was cancelled: the account became a SuperAdmin after '${claim.by}' allowed it. If '${identity.username}' should take it over, a SuperAdmin can allow the relink again.`
    );
  }
  const claimed = await inTransaction(m, async (transaction) => {
    // Single use, even when two logins race for it
    if (!(await m.AuthMeta.destroy({ where: { key: claim.key }, transaction }))) return false;
    await m.AuthMeta.destroy({ where: { key: missingKey(identity.provider, user.id) }, transaction });
    await m.AuthIdentity.destroy({ where: { user_id: user.id, provider: identity.provider }, transaction });
    await m.AuthIdentity.create(
      {
        provider: identity.provider,
        subject: identity.subject,
        username: identity.username,
        last_login_at: new Date(),
        subject_setting: subjectSetting(getProvider(identity.provider)),
        user_id: user.id,
      },
      { transaction }
    );
    // A local password it had is no longer known to anyone
    await m.User.update(
      { password: crypto.randomBytes(32).toString("hex"), token: null, reset_token: null, reset_token_expiration: null },
      { where: { id: user.id }, transaction, individualHooks: true }
    );
    return true;
  });
  if (!claimed) return null;
  // Whoever is still signed in through the old login (a local password, or the replaced entry) is signed out
  if (m.endSessionsOf) await m.endSessionsOf(user.id);
  logger(
    "warn",
    `Account ${user.id} '${user.username}' is now linked to ${identity.provider} '${identity.username}' (subject '${identity.subject}'), as allowed by '${claim.by}'.`,
    "AuthProviders"
  );
  return user;
}

// A provider group's external name as the provider reports it, e.g. a DN in LDAP's canonical form
// A provider may throw to refuse a name that can never match; the message is shown to the admin
function groupName(providerId, name) {
  const p = getProvider(providerId);
  if (!(p && typeof p.impl.groupName === "function" && typeof name === "string")) return name;
  try {
    return p.impl.groupName(name);
  } catch (err) {
    throw new (require("./bindings").BindingError)(err.message);
  }
}

// The entry the provider has for a username right now and the groups it reports, so an admin can find a
// group's new name after a move: { subject, groups }, null when it has no such person, undefined when it
// can't look people up
async function reportedGroups(providerId, username) {
  const p = enabledProviders().find((x) => x.id === providerId);
  if (!p || typeof p.impl.findSubject !== "function" || typeof p.impl.lookup !== "function") return undefined;
  const target = await withTimeout(p.impl.findSubject(relinkUsername(providerId, username)), "findSubject(username)", lookupTimeout(p));
  if (!target) return target;
  const found = await withTimeout(p.impl.lookup(target.subject), "lookup(subject)", lookupTimeout(p));
  return found
    ? { subject: target.subject, username: found.username, groups: found.groups || [], groupsLeftOut: found.groupsLeftOut || [] }
    : found;
}

// Why a saved group name can never match what the provider now reports (e.g. after a setting changed its form), or null
function groupNameProblem(providerId, name) {
  try {
    const reported = groupName(providerId, name);
    // e.g. written by an older MMGIS process, which didn't put names in this form
    return reported === name ? null : `It's saved as ${name}, but ${providerId} reports it as ${reported}.`;
  } catch (err) {
    return err.message;
  }
}

// False when a stored subject can't be one under the provider's current settings (e.g. LDAP_SUBJECT_ATTRIBUTE changed)
const subjectSetting = (p) => (p && typeof p.impl.subjectSetting === "function" ? String(p.impl.subjectSetting()) : null);
// Whether a link was made under the provider's current subject setting; links from before subject_setting was
// recorded fall back to the subject's form
function subjectFits(p, link) {
  const now = subjectSetting(p);
  if (now != null && link.subject_setting) return link.subject_setting === now;
  return typeof p.impl.subjectFits !== "function" || p.impl.subjectFits(link.subject) !== false;
}

const settingPrefix = (providerId) => `subject_setting:${providerId}:`;
const SETTING_FRESH_MS = 3 * 60e3;
let settingBeat = null;

// Heartbeats are timed by the database's clock, so hosts whose clocks differ agree on their age
let dbClockOffset = 0;
const dbNow = () => Date.now() + dbClockOffset;
async function syncDbClock(m) {
  const db = m.AuthMeta && m.AuthMeta.sequelize;
  if (!db || typeof db.query !== "function") return;
  const [row] = await db.query("SELECT NOW() AS now", { type: db.QueryTypes.SELECT }).catch(() => []);
  if (row && row.now) dbClockOffset = new Date(row.now).getTime() - Date.now();
}

async function beatSetting(p, m, now) {
  await syncDbClock(m);
  const key = settingPrefix(p.id) + now;
  const value = { at: new Date(dbNow()).toISOString() };
  if (await m.AuthMeta.findOne({ where: { key }, raw: true })) await m.AuthMeta.update({ value }, { where: { key } });
  else await m.AuthMeta.create({ key, value }).catch(() => {});
}

// Each process notes its subject setting every minute, so processes sharing a database on different ones are noticed
// Also started when the server starts, in case the database was down then and the startup checks never ran
function startSettingBeat() {
  if (settingBeat) return;
  settingBeat = setInterval(() => {
    for (const q of enabledProviders()) {
      const s = subjectSetting(q);
      if (s != null) beatSetting(q, accountModels(), s).catch(() => {});
    }
  }, 60e3);
  if (settingBeat.unref) settingBeat.unref();
}

async function recordSetting(p, m) {
  const now = subjectSetting(p);
  if (now == null || !m.AuthMeta) return;
  // Started first, so a database error below doesn't leave this process unseen by the others
  startSettingBeat();
  const others = await otherSettings(p, m, true).catch(() => []);
  if (others.length)
    logger(
      "warn",
      `Auth provider '${p.id}': this process uses the subject setting '${now}' (e.g. LDAP_SUBJECT_ATTRIBUTE), but another MMGIS process on this database used ${others.map((o) => `'${o}'`).join(", ")} in the last ${SETTING_FRESH_MS / 60e3} minutes. If every process was just restarted with '${now}', this clears up within ${SETTING_FRESH_MS / 60e3} minutes; otherwise give every process the same setting.`,
      "AuthProviders"
    );
  await beatSetting(p, m, now).catch((err) => logger("warn", `Auth provider '${p.id}': couldn't record this process's subject setting yet; it retries every minute.`, "AuthProviders", null, err));
}

const settingChecks = new WeakMap();
// Subject settings other than this one's that a process on this database used in the last few minutes
async function otherSettings(p, m, fresh = false) {
  const now = subjectSetting(p);
  if (now == null || !m.AuthMeta) return [];
  const seen = settingChecks.get(m.AuthMeta) || new Map();
  settingChecks.set(m.AuthMeta, seen);
  const c = seen.get(p.id);
  if (fresh) return readOtherSettings(p, m, now, false);
  if (c && c.now === now && Date.now() - c.at < 60e3) return c.others;
  // Shared, so the parallel rechecks of one pass read and log it once
  const others = readOtherSettings(p, m, now, true);
  seen.set(p.id, { at: Date.now(), now, others });
  return others;
}

async function readOtherSettings(p, m, now, log) {
  const rows = await m.AuthMeta.findAll({ where: { key: { [Op.like]: `${settingPrefix(p.id)}%` } }, raw: true });
  const others = rows
    .filter((r) => r.key.startsWith(settingPrefix(p.id)) && r.key !== settingPrefix(p.id) + now && dbNow() - Date.parse(r.value && r.value.at) < SETTING_FRESH_MS)
    .map((r) => r.key.slice(settingPrefix(p.id).length));
  if (others.length && log)
    logger(
      "error",
      `Auth provider '${p.id}': another MMGIS process on this database uses the subject setting ${others.map((o) => `'${o}'`).join(", ")} (e.g. LDAP_SUBJECT_ATTRIBUTE), but this one uses '${now}'. Give every process the same setting. Until then, neither process clears the accounts or relinks the other flags for its setting; rechecks still end access for people who left.`,
      "AuthProviders"
    );
  return others;
}

// At startup, so a changed subject setting doesn't silently sign out every linked account
async function warnUnfitSubjects(m = accountModels()) {
  for (const p of enabledProviders()) {
    if (typeof p.impl.subjectFits !== "function" && typeof p.impl.subjectSetting !== "function") continue;
    await recordSetting(p, m);
    const links = await m.AuthIdentity.findAll({ where: { provider: p.id }, attributes: ["user_id", "subject", "subject_setting"], raw: true });
    const unfit = links.filter((l) => !subjectFits(p, l));
    if (unfit.length === 0) continue;
    const superAdmins = await require("./bindings").superAdminUserIds();
    const linkedIds = new Set((await m.AuthIdentity.findAll({ attributes: ["user_id"], raw: true })).map((l) => l.user_id));
    const unfitIds = new Set(unfit.map((l) => l.user_id));
    const localAdmin = siteAccess.getProviders().includes("local") && superAdmins.some((id) => !linkedIds.has(id));
    const strandedAdmins = superAdmins.filter((id) => unfitIds.has(id)).length;
    logger(
      localAdmin ? "warn" : "error",
      `Auth provider '${p.id}': ${unfit.length} of its ${links.length} linked accounts were linked under a different subject setting (e.g. LDAP_SUBJECT_ATTRIBUTE), so their sessions and API tokens end at their next recheck and their sign-ins are refused until each is relinked in Users & Access > People. To keep them, change the setting back.${
        strandedAdmins ? ` ${strandedAdmins} of them ${strandedAdmins === 1 ? "is a SuperAdmin" : "are SuperAdmins"}.` : ""
      }${localAdmin ? "" : " No SuperAdmin can sign in with an MMGIS password here, so nobody may be able to allow those relinks: enable local and keep a local SuperAdmin first."}`,
      "AuthProviders"
    );
  }
}

// At startup, so groups saved in a form the provider no longer reports don't silently lose every member
async function warnUnmatchableGroups(m = accountModels()) {
  for (const p of enabledProviders()) {
    if (typeof p.impl.groupName !== "function") continue;
    const groups = await m.AuthGroup.findAll({ where: { source: p.id }, attributes: ["name", "external_name"], raw: true });
    const bad = groups.map((g) => ({ g, problem: groupNameProblem(p.id, g.external_name) })).filter((x) => x.problem);
    if (bad.length === 0) continue;
    logger(
      "warn",
      `Auth provider '${p.id}': ${bad.length} of its groups can never have members, so they grant nothing: ${bad
        .slice(0, 5)
        .map((x) => `'${x.g.name}' (${x.g.external_name})`)
        .join(", ")}${bad.length > 5 ? ", …" : ""}. ${bad[0].problem} Update their external names in Users & Access > Groups.`,
      "AuthProviders"
    );
  }
}

// Whether the entry with this subject still exists at the provider, even disabled or moved where logins
// aren't searched: truthy if lookup or locate(subject) finds it, null when both say it's gone,
// undefined when that can't be told (no hooks, or one failed and the other found nothing)
async function locateSubject(providerId, subject) {
  const p = getProvider(providerId);
  const fns = p ? [p.impl.lookup, p.impl.locate].filter((f) => typeof f === "function") : [];
  let unknown = fns.length === 0;
  for (const fn of fns) {
    const found = await withTimeout(fn(subject), "locate(subject)", lookupTimeout(p)).catch(() => undefined);
    if (found) return found;
    if (found === undefined) unknown = true;
  }
  return unknown ? undefined : null;
}

// Only the directory-wide search: one entry anywhere with the subject, {} for several, null for none, undefined if it can't say
async function locateAnywhere(providerId, subject) {
  const p = getProvider(providerId);
  if (!p || typeof p.impl.locate !== "function") return undefined;
  return withTimeout(p.impl.locate(subject), "locate(subject)", lookupTimeout(p));
}

// Clears the provider's own failed-login count for the entry an admin just allowed a relink to
function resetFailures(providerId, target) {
  const p = enabledProviders().find((x) => x.id === providerId);
  if (p && typeof p.impl.resetFailures === "function") p.impl.resetFailures(target);
}

// The username a relink waits for, in the form the provider's logins report it
function relinkUsername(providerId, username) {
  const p = getProvider(providerId);
  return p && typeof p.impl.relinkUsername === "function" ? p.impl.relinkUsername(username) : username;
}

// The provider's entry for a username, so an admin can see who a relink would go to:
// { subject, dn } or null when the provider has none, undefined when it can't look people up
async function relinkTarget(providerId, username) {
  const p = enabledProviders().find((x) => x.id === providerId);
  if (!p || typeof p.impl.findSubject !== "function") return undefined;
  return withTimeout(p.impl.findSubject(username), "findSubject(username)", lookupTimeout(p));
}

// Finds the account linked to provider+subject, creating one on first login.
// Never links to, or changes, an existing account by matching its username, unless an admin allowed a relink.
async function linkIdentity(identity, m = accountModels(), retried = false) {
  const link = await m.AuthIdentity.findOne({
    where: { provider: identity.provider, subject: identity.subject },
    raw: true,
  });
  // Linked under another of this entry's values, which still finds only this entry
  if (!link && identity.dn && identity.subjects && identity.subjects.length > 1 && m.AuthIdentity.findAll) {
    const others = identity.subjects.filter((v) => v !== identity.subject);
    const other = (await m.AuthIdentity.findAll({ where: { provider: identity.provider }, attributes: ["user_id", "subject", "username"], raw: true })).find((l) => others.includes(l.subject));
    // Someone else's old value may be this entry's alias now (e.g. a leaver's mail)
    if (other && !sameUsername(other.username, identity.username))
      throw new LinkError(
        `'${identity.username}' (${identity.dn}) also has '${other.subject}', the ${identity.provider} subject of account ${other.user_id} ('${other.username}'). If it's the same person after a rename, allow a relink on account ${other.user_id}; if it's someone else, remove that value from their entry or delete account ${other.user_id} (giving its drawings to whoever should keep them).`
      );
    const at = other ? await locateAnywhere(identity.provider, other.subject).catch(() => undefined) : undefined;
    if (at && at.dn && sameFolded(at.dn, identity.dn)) return linkIdentity({ ...identity, subject: other.subject, subjects: undefined }, m, retried);
  }
  // Under another subject setting the same value can belong to a different entry
  const linkProvider = link && getProvider(identity.provider);
  if (linkProvider && !subjectFits(linkProvider, link)) {
    // Its value didn't change with the setting (e.g. uid to cn), and an admin pinned this entry to that account again
    const claim = await findClaim(identity, m);
    // A non-unique attribute (e.g. cn) may give another entry the same value, so it must be the entry the admin was shown
    // Unpinned (no service account to look it up): it matched the username, whose own password was checked
    const shown = claim && (!claim.dn || (identity.dn && sameFolded(claim.dn, identity.dn)));
    const claimed = shown && claim.userId === link.user_id ? await claimRelink(identity, m) : null;
    if (claimed) return claimed;
    throw new LinkError(
      `'${identity.username}' has the ${identity.provider} subject '${identity.subject}' of account ${link.user_id}, but that account was linked under a different subject setting (e.g. LDAP_SUBJECT_ATTRIBUTE), so this may be a different entry. Change the setting back; or, only if this is that account's own entry, allow a relink on it.`
    );
  }
  if (link) {
    const user = await m.User.findOne({
      where: { id: link.user_id },
      attributes: ["id", "username"],
      raw: true,
    });
    if (user) {
      await m.AuthIdentity.update(
        { username: identity.username, last_login_at: new Date() },
        { where: { provider: identity.provider, subject: identity.subject } }
      );
      await markMissing(m, identity.provider, user.id, false);
      // Its own entry still signs in, so a relink allowed for it isn't needed; left pending, a newcomer given its name could claim it
      if (m.AuthMeta && (await m.AuthMeta.destroy({ where: { key: relinkKey(identity.provider, user.id) } })) > 0)
        logger("info", `Auth provider '${identity.provider}': ${user.username} signed in with its existing link, so its pending relink was dropped.`, "AuthProviders");
      // Drawings and other content are keyed by username, so a rename at the provider isn't copied
      if (link.username !== identity.username && identity.username !== user.username)
        logger(
          "info",
          `Auth provider '${identity.provider}' now calls account ${user.id} '${identity.username}'; it keeps its MMGIS username '${user.username}'.`,
          "AuthProviders"
        );
      return user;
    }
  }
  const claimed = await claimRelink(identity, m);
  if (claimed) return claimed;
  // A recreated directory entry with a new ID but the old name: the account it belonged to needs a relink
  const sameName =
    m.AuthIdentity.findAll &&
    (await m.AuthIdentity.findAll({
      where: { provider: identity.provider },
      attributes: ["user_id", "username", "subject", "subject_setting"],
      raw: true,
    })).find((l) => l.username && sameUsername(l.username, identity.username));
  // Another sign-in linked this entry a moment ago; looking again finds that link
  if (sameName && sameName.subject === identity.subject && !retried) return linkIdentity(identity, m, true);
  if (sameName && sameName.subject === identity.subject)
    throw new LinkError(
      `'${identity.username}' was linked to account ${sameName.user_id} by another sign-in at the same moment; signing in again works.`
    );
  if (sameName) {
    // Its subject was stored under another setting, so it can't be looked up under this one
    const provider = getProvider(identity.provider);
    if (provider && !subjectFits(provider, sameName))
      throw new LinkError(
        `'${identity.username}' already signs in to account ${sameName.user_id}, which was linked under a different ${identity.provider} subject setting (e.g. LDAP_SUBJECT_ATTRIBUTE). Change the setting back, or allow a relink on that account.`
      );
    // If that account's own entry is still there, the name was handed to someone new: a relink would give them the account
    const still = await locateSubject(identity.provider, sameName.subject).catch(() => undefined);
    if (still === undefined)
      throw new LinkError(
        `'${identity.username}' already signs in to account ${sameName.user_id} with a different ${identity.provider} ID, and ${identity.provider} couldn't say whether that account's entry (subject '${sameName.subject}') still exists. Check before allowing a relink: if it does, the name was reused by someone else.`
      );
    // The same entry, its value only re-cased (e.g. uid ldap_alice to Ldap_Alice), which the directory matches either way
    // Only re-cased at what looks like the same entry: still possibly a newcomer, since the directory compares it without case
    // A DN is unique whatever its case, so a re-cased DN subject is the same entry
    if (subjectSetting(provider) === "dn" && sameFolded(sameName.subject, identity.subject) && !retried) {
      await m.AuthIdentity.update({ subject: identity.subject }, { where: { user_id: sameName.user_id, provider: identity.provider, subject: sameName.subject } });
      return linkIdentity(identity, m, true);
    }
    const anywhere = still && identity.dn && sameFolded(sameName.subject, identity.subject) && provider && typeof provider.impl.subjectPermanent === "function" && !provider.impl.subjectPermanent() ? await locateAnywhere(identity.provider, sameName.subject).catch(() => undefined) : undefined;
    if (anywhere === undefined && still && identity.dn && sameFolded(sameName.subject, identity.subject) && typeof provider.impl.subjectPermanent === "function" && !provider.impl.subjectPermanent())
      throw new LinkError(
        `'${identity.username}' (subject '${identity.subject}') matches account ${sameName.user_id}'s subject '${sameName.subject}' except for letter case or spacing, but ${identity.provider} couldn't search the whole directory to tell whether it's the same entry. Check that its service account can read the directory root, then allow a relink on account ${sameName.user_id} if it's the same person.`
      );
    if (anywhere && anywhere.dn && sameFolded(anywhere.dn, identity.dn))
      throw new LinkError(
        `'${identity.username}' (subject '${identity.subject}') matches account ${sameName.user_id}'s subject '${sameName.subject}' except for letter case, at ${identity.dn}. If it's the same person, allow a relink on account ${sameName.user_id}; if the directory gave the value to someone new, don't.`
      );
    if (still)
      throw new LinkError(
        `'${identity.username}' (subject '${identity.subject}') is a different ${identity.provider} entry from account ${sameName.user_id}'s, which still exists${still.dn ? ` at ${still.dn}` : ""}${still.username ? ` as '${still.username}'` : ""}. The name was reused: don't relink account ${sameName.user_id} to it. MMGIS usernames don't change, so to let this person in, create an account for them under another username (e.g. '${identity.username}2') and allow its relink as '${identity.username}'.`
      );
    throw new LinkError(
      `'${identity.username}' already signs in to account ${sameName.user_id} with a different ${identity.provider} ID, and that account's old entry is gone. Only allow a relink on that account if this is the same person: the directory may have given the name to someone new.`
    );
  }
  // e.g. a rename that also re-cased a cn: the directory still matches the old link, so a new account would be its twin
  const linking = getProvider(identity.provider);
  if (linking && typeof linking.impl.subjectPermanent === "function" && !linking.impl.subjectPermanent() && m.AuthIdentity.findAll) {
    const twin = (await m.AuthIdentity.findAll({ where: { provider: identity.provider }, attributes: ["user_id", "subject"], raw: true })).find(
      (l) => l.subject !== identity.subject && sameFolded(l.subject, identity.subject)
    );
    if (twin)
      throw new LinkError(
        `'${identity.username}' (subject '${identity.subject}') matches account ${twin.user_id}'s subject '${twin.subject}' except for letter case${identity.dn ? `, at ${identity.dn}` : ""}. If it's the same person, allow a relink on account ${twin.user_id}. If the directory gave the value to someone new, don't: they can sign in once the directory gives them a different value, or account ${twin.user_id} is deleted (giving its drawings to whoever should keep them).`
      );
  }
  // MMGIS stores both in 255-character columns
  if (identity.subject.length > 255 || identity.username.length > 255)
    throw new LinkError(`The ${identity.subject.length > 255 ? "subject" : "username"} is longer than the 255 characters MMGIS can store.`);
  if (reservedUsername(identity.username))
    throw new LinkError(`The username '${identity.username}' is reserved in MMGIS.`);
  if (unsafeUsername(identity.username))
    throw new LinkError(`The username ${JSON.stringify(identity.username)} contains a comma, < > " \` \\ or control characters, which MMGIS usernames can't (if LDAP_USERNAME_ATTRIBUTE is e.g. cn, use uid or sAMAccountName).`);
  const taken = m.usernameTaken
    ? await m.usernameTaken(identity.username)
    : await m.User.findOne({ where: { username: identity.username }, attributes: ["id"], raw: true });
  if (taken) {
    const holder = taken.id != null && m.AuthIdentity.findOne
      ? await m.AuthIdentity.findOne({ where: { user_id: taken.id, provider: identity.provider }, raw: true })
      : null;
    // A concurrent first sign-in of this same entry created it since the checks above
    if (holder && holder.subject === identity.subject && !retried) return linkIdentity(identity, m, true);
    if (holder)
      throw new LinkError(
        `The username '${identity.username}' belongs to account ${taken.id}, which signs in with ${identity.provider} as '${holder.username}'${sameUsername(holder.username, identity.username) ? ` under another ${identity.provider} ID` : " (renamed there)"}. Don't relink it to this entry. To let this person in under another MMGIS username, create an account for them (e.g. '${identity.username}2') and allow its relink as '${identity.username}'.`
      );
    const adminsOnly = siteAccess.localAdminsOnly();
    const lapsed = taken.id != null && m.AuthMeta ? await m.AuthMeta.findOne({ where: { key: relinkKey(identity.provider, taken.id) }, raw: true }) : null;
    throw new LinkError(
      `The username '${identity.username}' already belongs to account ${taken.id}, which doesn't sign in with ${identity.provider} yet.${
        lapsed && lapsed.value && lapsed.value.expires_at && !(Date.parse(lapsed.value.expires_at) > Date.now()) ? ` Its relink expired at ${lapsed.value.expires_at}.` : ""
      } If it is this person's, allow a relink to ${identity.provider} on account ${taken.id}${
        adminsOnly
          ? `. AUTH_LOCAL_LOGIN=admins stops it signing in with its MMGIS password meanwhile, unless it holds an admin role.`
          : `; until then they can keep using its MMGIS password.`
      }`
    );
  }
  // e.g. during a directory migration, when renamed people would otherwise get new, empty accounts before their relink
  if (process.env.AUTH_PROVIDER_NEW_ACCOUNTS === "false")
    throw new LinkError(
      `'${identity.username}' has no MMGIS account, and AUTH_PROVIDER_NEW_ACCOUNTS=false stops ${identity.provider} sign-ins from creating one. Allow a relink on their existing account (entering '${identity.username}' as the username at the provider), or create an account for them and allow its relink.`
    );
  // Random password: the account can only be used through its provider
  const fields = { username: identity.username, password: crypto.randomBytes(32).toString("hex") };
  // Email is optional and unique, so one already in use is left off
  if (identity.email && identity.email.length <= 255) {
    const emailTaken = await m.User.findOne({
      where: { email: identity.email },
      attributes: ["id"],
      raw: true,
    });
    if (!emailTaken) fields.email = identity.email;
  }
  try {
    return await inTransaction(m, async (transaction) => {
      let created;
      try {
        created = await m.User.create(fields, { transaction });
      } catch (err) {
        if (!fields.email || err.name !== "SequelizeValidationError") throw err;
        delete fields.email;
        created = await m.User.create(fields, { transaction });
      }
      siteAccess.setProviderAccounts(true);
      await m.AuthIdentity.create(
        {
          provider: identity.provider,
          subject: identity.subject,
          username: identity.username,
          last_login_at: new Date(),
          subject_setting: subjectSetting(getProvider(identity.provider)),
          user_id: created.id,
        },
        { transaction }
      );
      return { id: created.id, username: created.username };
    });
  } catch (err) {
    // Two first logins of the same person at once: the other one created the account
    if (!retried && err.name === "SequelizeUniqueConstraintError") return linkIdentity(identity, m, true);
    throw err;
  }
}

// Sets the user's membership of groups sourced from this provider to exactly
// the groups the provider reported; resolves whether anything changed
async function syncGroups(userId, identity, m = accountModels()) {
  const groups = await m.AuthGroup.findAll({
    where: { source: identity.provider },
    attributes: ["id", "name", "external_name"],
    raw: true,
  });
  if (groups.length === 0) return false;
  const reported = new Set(identity.groups);
  const want = new Set(groups.filter((g) => reported.has(g.external_name)).map((g) => g.id));
  const have = new Set(
    (
      await m.AuthGroupMember.findAll({
        where: { user_id: userId, group_id: groups.map((g) => g.id) },
        attributes: ["group_id"],
        raw: true,
      })
    ).map((r) => r.group_id)
  );
  const remove = [...have].filter((id) => !want.has(id));
  const add = [...want].filter((id) => !have.has(id));
  // So a group renamed or moved in the directory, which silently stops matching, shows up in the log
  if (remove.length > 0 || add.length > 0) {
    const names = (ids) =>
      ids
        .map((id) => groups.find((g) => g.id === id))
        .map((g) => `'${g.external_name}'${g.name ? ` (MMGIS group '${g.name}')` : ""}`)
        .join(", ");
    const used = new Set(groups.map((g) => g.external_name));
    const unmatched = [...reported].filter((g) => !used.has(g)).slice(0, 10);
    // A name in a form the provider no longer reports (e.g. a DN after switching to plain names) isn't a rename
    const problem = remove.map((id) => groups.find((g) => g.id === id)).map((g) => groupNameProblem(identity.provider, g.external_name)).find(Boolean);
    // A group renamed or moved there that the person is still in is reported under its new name, so
    // without an unmatched name this is an ordinary membership change
    const hint = !remove.length || !identity.subject
      ? ""
      : problem
        ? ` That group's name can never match what ${identity.provider} reports now: ${problem}`
        : unmatched.length
          ? ` Groups are matched by their exact name, so a group renamed or moved there needs its name updated in Users & Access. Groups reported now that no MMGIS group uses: ${unmatched.map((g) => `'${g}'`).join(", ")}.`
          : "";
    logger(
      "info",
      `Auth provider '${identity.provider}': ${await who(m, userId)}${remove.length ? ` left ${names(remove)}` : ""}${remove.length && add.length ? " and" : ""}${add.length ? ` joined ${names(add)}` : ""}.${hint}`,
      "AuthProviders"
    );
  }
  if (remove.length > 0)
    await m.AuthGroupMember.destroy({ where: { user_id: userId, group_id: remove } });
  if (add.length > 0)
    // ignoreDuplicates: two logins, or a login and a recheck, can sync the same person at once
    await m.AuthGroupMember.bulkCreate(add.map((group_id) => ({ group_id, user_id: userId })), { ignoreDuplicates: true });
  return remove.length > 0 || add.length > 0;
}

const recheckMs = () => {
  const n = parseFloat(process.env.AUTH_RECHECK_MINUTES);
  return (Number.isFinite(n) && n >= 0 ? n : 15) * 60 * 1000;
};
const rechecks = new Map();
// When a provider's last recheck couldn't reach it: other people's requests then wait only DOWN_WAIT_MS for theirs
const DOWN_WAIT_MS = 1000;
const groupsUnreadLogged = new Set();
const providerDown = new Map();
// A connection or TLS failure or a timeout, not an error about one person's entry
const unreachable = (err) =>
  !!err &&
  (/^(ETIMEDOUT|ECONN|EHOST|ENET|ENOTFOUND|EAI_|EPIPE|ERR_TLS|CERT_|UNABLE_TO_|DEPTH_ZERO|SELF_SIGNED|UND_ERR_CONNECT)/.test(String(err.code || "")) ||
    /connection|socket|timed? ?out/i.test(String(err.message || "")) ||
    // e.g. fetch's "fetch failed", with the network error as its cause
    (!!err.cause && err.cause !== err && unreachable(err.cause)));
const downNow = (providerId, ms) => Date.now() - (providerDown.get(providerId) || -Infinity) < ms;

// Re-reads a provider-linked account through the provider's lookup(subject) at most every
// AUTH_RECHECK_MINUTES, so directory changes reach existing sessions and tokens. Resolves false
// once the provider says the account is gone; keeps access when the provider can't be reached, unless it was already gone.
// With detail, resolves to "ok", "missing", "failed" (the provider couldn't be asked) or "unsupported" instead.
function stillLinked(userId, providerId, m, force = false, detail = false) {
  const p = getProvider(providerId);
  const ms = recheckMs();
  if (!p || typeof p.impl.lookup !== "function") return Promise.resolve(detail ? "ok" : true);
  // With rechecks off the directory isn't asked, but an admin's Check linked accounts still applies
  if (ms === 0 && !force)
    return (async () => {
      m = m || accountModels();
      const gone = !!(m.AuthMeta && (await m.AuthMeta.findOne({ where: { key: missingKey(providerId, userId) }, raw: true })));
      return detail ? (gone ? "missing" : "ok") : !gone;
    })();
  const key = `${providerId}:${userId}`;
  const hit = rechecks.get(key);
  if (!force && !detail && hit && Date.now() - hit.at < ms) {
    if (!hit.missing) return Promise.resolve(hit.wasMissing).then((gone) => requestWait(hit.result, downNow(providerId, ms) ? DOWN_WAIT_MS : IDENTIFY_TIMEOUT_MS, !gone));
    // Another process may have signed the person in again (a relink or a restored entry) since
    return (async () => {
      m = m || accountModels();
      const link = await m.AuthIdentity.findOne({ where: { user_id: userId, provider: providerId }, raw: true });
      const since = link && link.last_login_at ? new Date(link.last_login_at).getTime() : 0;
      return since > hit.at ? requestWait(stillLinked(userId, providerId, m, true), downNow(providerId, ms) ? DOWN_WAIT_MS : IDENTIFY_TIMEOUT_MS) : false;
    })();
  }
  m = m || accountModels();
  // Already not found (e.g. a leaver): an unanswered or failed recheck mustn't give its access back
  const wasMissing = (async () => !!(m.AuthMeta && (await m.AuthMeta.findOne({ where: { key: missingKey(providerId, userId) }, raw: true }))))().catch(() => false);
  const status = (async () => {
    const link = await m.AuthIdentity.findOne({ where: { user_id: userId, provider: providerId }, raw: true });
    if (!link) return "ok";
    let found;
    try {
      // Under another subject setting the stored value may now name a different entry
      found = subjectFits(p, link) ? await withTimeout(p.impl.lookup(link.subject), "lookup(subject)", lookupTimeout(p)) : null;
      // Matched only without case (e.g. a newcomer given a leaver's cn re-cased): a sign-in from it is refused too
      const permanent = typeof p.impl.subjectPermanent !== "function" || p.impl.subjectPermanent();
      if (found && found.current && found.current !== link.subject && !permanent) found = null;
      // Matched by a value that isn't first (e.g. an alias): only under the same directory username, so another entry's alias doesn't keep a leaver in
      if (found && found.first && found.first !== link.subject && !permanent && !sameUsername(found.username, link.username)) found = null;
    } catch (err) {
      const missing = await wasMissing;
      logger(
        "warn",
        `Auth provider '${providerId}': couldn't recheck ${await who(m, userId)}${err && err.code === "ETIMEDOUT" ? ` (no answer within ${lookupTimeout(p) / 1000} s)` : ""}; ${
          missing ? "it stays not found, without its sessions, tokens or provider groups, until a check finds it" : "it keeps its access until the next check"
        }.`,
        "AuthProviders",
        null,
        err
      );
      if (unreachable(err)) providerDown.set(providerId, Date.now());
      return "failed";
    }
    providerDown.delete(providerId);
    // e.g. LDAP without a service account: nothing can be read between logins
    if (found === undefined) return "unsupported";
    // A relink during the lookup replaced the subject; that login already synced the new one
    const now = await m.AuthIdentity.findOne({ where: { user_id: userId, provider: providerId }, raw: true });
    if (!now || now.subject !== link.subject) return "ok";
    const identity = normalizeIdentity(providerId, found && { ...found, subject: link.subject });
    const changed = await syncGroups(userId, identity || { provider: providerId, groups: [] }, m);
    // Logged when it starts, not at every recheck
    if (!(identity && found.groupsUnread)) groupsUnreadLogged.delete(key);
    else if (!groupsUnreadLogged.has(key) && groupsUnreadLogged.add(key))
      logger("warn", `Auth provider '${providerId}': couldn't read the groups of ${await who(m, userId)} (${found.groupsUnread}); its provider groups give it no roles until they can be read.`, "AuthProviders");
    // A process on another subject setting flagged it for that setting: leave that to it
    const flagged = identity && (await otherSettings(p, m)).length > 0 && (await m.AuthMeta.findOne({ where: { key: missingKey(providerId, userId) }, raw: true }));
    if (!(flagged && flagged.value && flagged.value.reason === "subject"))
      await markMissing(m, providerId, userId, !identity, link.subject, !identity && !subjectFits(p, link) ? "subject" : undefined);
    // So People shows a rename before the person's next login, and a newcomer with the old name isn't mistaken for them
    if (identity && identity.username && identity.username !== now.username) {
      await m.AuthIdentity.update({ username: identity.username }, { where: { user_id: userId, provider: providerId, subject: link.subject } });
      logger("info", `Auth provider '${providerId}': ${await who(m, userId)} is now '${identity.username}' there (was '${now.username}').`, "AuthProviders");
    }
    if (changed || !identity) require("./principal").invalidate();
    if (!identity)
      logger(
        "info",
        `Auth provider '${providerId}' no longer has ${await who(m, userId)} (subject '${link.subject}'); its sessions and API tokens stop working.`,
        "AuthProviders"
      );
    return identity ? "ok" : "missing";
  })().catch((err) => {
    rechecks.delete(key);
    throw err;
  });
  const result = status.then(async (s) => s !== "missing" && !(s === "failed" && (await wasMissing)));
  const entry = { at: Date.now(), result, wasMissing };
  rechecks.set(key, entry);
  result.then((ok) => (entry.missing = !ok), () => {});
  if (detail) return status;
  if (force) return result;
  return wasMissing.then((gone) => requestWait(result, downNow(providerId, ms) ? DOWN_WAIT_MS : IDENTIFY_TIMEOUT_MS, !gone));
}

// Rechecks every provider-linked account now, including ones nobody has used since a directory change,
// so People shows which entries are gone
// One run per process at a time, so a second click while a slow directory answers doesn't double its load
let recheckingAll = null;
let recheckQueued = null;
// again: a run already under way may have passed accounts before a change they need, so queue one more after it
function recheckLinked(m = accountModels(), again = false) {
  if (!recheckingAll) {
    recheckingAll = recheckAllNow(m).finally(() => (recheckingAll = null));
    return recheckingAll;
  }
  if (!again) return recheckingAll;
  if (!recheckQueued)
    recheckQueued = recheckingAll
      .catch(() => {})
      .then(() => {
        recheckQueued = null;
        return recheckLinked(m);
      });
  return recheckQueued;
}

// True when fillGroups skips providerId only because rechecks are off (AUTH_RECHECK_MINUTES=0)
function fillsOnlyAtSignIn(providerId) {
  const p = siteAccess.hasProvider(providerId) && getProvider(providerId);
  return !!p && typeof p.impl.lookup === "function" && recheckMs() === 0;
}

// Fills a new or repointed group of providerId from the accounts already linked to it; resolves
// undefined when rechecks are off (AUTH_RECHECK_MINUTES=0) or that provider can't look accounts up
function fillGroups(providerId, m = accountModels()) {
  const p = siteAccess.hasProvider(providerId) && getProvider(providerId);
  if (recheckMs() === 0 || !p || typeof p.impl.lookup !== "function") return Promise.resolve(undefined);
  return recheckLinked(m, true);
}

async function recheckAllNow(m) {
  const links = (await m.AuthIdentity.findAll({ attributes: ["user_id", "provider"], raw: true })).filter((l) => {
    const p = siteAccess.hasProvider(l.provider) && getProvider(l.provider);
    return p && typeof p.impl.lookup === "function";
  });
  let next = 0;
  const counts = { ok: 0, missing: 0, failed: 0, unsupported: 0 };
  const answered = new Set();
  const failedAt = new Set();
  const worker = async () => {
    while (next < links.length) {
      const l = links[next++];
      const status = await stillLinked(l.user_id, l.provider, m, true, true).catch(() => "failed");
      counts[status]++;
      (status === "failed" ? failedAt : answered).add(l.provider);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, links.length) }, worker));
  // A pending relink pinned to an entry that's gone can never be claimed; flag it now rather than at a failed sign-in
  let staleRelinks = 0;
  const relinks = m.AuthMeta && m.AuthMeta.update ? await m.AuthMeta.findAll({ where: { key: { [Op.like]: "relink:%" } }, raw: true }) : [];
  let nextRelink = 0;
  const relinkWorker = async () => {
    while (nextRelink < relinks.length) {
      const r = relinks[nextRelink++];
      const v = r.value;
      const providerId = r.key.split(":")[1];
      if (!v || !v.subject || !(Date.parse(v.expires_at) > Date.now()) || !siteAccess.hasProvider(providerId)) continue;
      const setting = subjectSetting(getProvider(providerId));
      const oldSetting = !!(v.subject_setting && setting != null && v.subject_setting !== setting);
      // While processes use two subject settings, which one is right is the admin's call
      const mixed = (oldSetting || (v.stale && v.stale.setting)) && (await otherSettings(getProvider(providerId), m)).length > 0;
      if (mixed) continue;
      if (v.stale) {
        // Flagged under another subject setting that is back now (e.g. a reverted change or a rolling restart)
        if (v.stale.setting && !oldSetting) {
          const { stale, ...fresh } = v;
          await m.AuthMeta.update({ value: fresh }, { where: { key: r.key } });
        }
        continue;
      }
      if (!oldSetting) {
        // Every lookup failed this pass (e.g. the directory hangs): asking again per relink would only wait out each timeout
        if (failedAt.has(providerId) && !answered.has(providerId)) continue;
        if ((await locateSubject(providerId, v.subject).catch(() => undefined)) !== null) continue;
      }
      // An admin may have cancelled or allowed it again while the directory was asked
      const now = await m.AuthMeta.findOne({ where: { key: r.key }, raw: true });
      if (!now || !now.value || now.value.subject !== v.subject || now.value.expires_at !== v.expires_at) continue;
      await m.AuthMeta.update(
        { value: { ...v, stale: { [oldSetting ? "setting" : "gone"]: true, at: new Date().toISOString() } } },
        { where: { key: r.key } }
      );
      staleRelinks++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, relinks.length) }, relinkWorker));
  // failed: the provider couldn't be asked (unreachable, or its service account was refused)
  return { checked: links.length - counts.unsupported, missing: counts.missing, failed: counts.failed, unsupported: counts.unsupported, staleRelinks };
}

// The legacy lead group (LEADS) a login response reports, as a page reload does
function leadGroups(username, leadGroupName) {
  const leads = process.env.LEADS ? JSON.parse(process.env.LEADS) : [];
  return leads.indexOf(username) != -1 ? [leadGroupName] : [];
}

async function completeLogin(req, identity) {
  if (!identity) throw new LinkError("The provider did not return an identity.");
  let user;
  try {
    user = await linkIdentity(identity);
  } catch (err) {
    if (err instanceof LinkError)
      logger("warn", `Refused ${identity.provider} login (subject '${identity.subject}'): ${err.message}`, "AuthProviders", req);
    throw err;
  }
  await syncGroups(user.id, identity);
  // The provider answered
  providerDown.delete(identity.provider);
  rechecks.set(`${identity.provider}:${user.id}`, { at: Date.now(), result: Promise.resolve(true) });
  require("./principal").invalidate();
  await new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
  req.session.user = user.username;
  req.session.uid = user.id;
  req.session.provider = identity.provider;
  req.session.token = crypto.randomBytes(128).toString("hex");
  await new Promise((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
  return user;
}

let mountedRoot = null;
const rootPath = () => (mountedRoot != null ? mountedRoot : process.env.ROOT_PATH || "");

// A same-site path to send the browser to after login; anything else falls back to the site root
function returnTo(value, fallback = `${rootPath()}/`) {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return fallback;
  return value;
}

const isFormProvider = (p) =>
  p.manifest.login_form === true && typeof p.manifest.login_path === "string" && p.manifest.login_path.startsWith("/");

const ICON_NAME = /^[a-z0-9-]+$/;
const text = (v, fallback = "") => (typeof v === "string" && v.trim() !== "" ? v.trim() : fallback);

function formWording(p) {
  if (typeof p.impl.loginForm !== "function") return {};
  try {
    const w = p.impl.loginForm(process.env);
    return w && typeof w === "object" ? w : {};
  } catch (err) {
    logger("error", `Auth provider '${p.id}': loginForm(env) threw; using its default wording.`, "AuthProviders", null, err);
    return {};
  }
}

// The providers that take a username and password in the shared form on the login page,
// Configure sign-in and the in-app modal, in AUTH_PROVIDERS order. With AUTH_LOCAL_LOGIN=admins,
// local accounts are only offered at Configure sign-in (configure: true).
function loginForms(ids = siteAccess.getProviders(), { configure = false } = {}) {
  const out = [];
  enabledProviders(ids).forEach((p) => {
    if (!isFormProvider(p)) return;
    if (p.id === "local" && siteAccess.localAdminsOnly() && !configure) return;
    const w = formWording(p);
    out.push({
      id: p.id,
      title: text(w.title, p.label),
      usernameLabel: text(w.usernameLabel, "Username"),
      hint: text(w.hint),
      icon: ICON_NAME.test(p.manifest.login_icon || "") ? p.manifest.login_icon : "account-outline",
      path: `api/auth/${p.id}${p.manifest.login_path}`,
    });
  });
  return out;
}

// The name people know a provider by: its login form title, else its display_name
function providerLabel(id) {
  const p = getProvider(id);
  if (!p) return null;
  return isFormProvider(p) ? text(formWording(p).title, p.label) : p.label;
}

// What Users & Access shows for each enabled provider: its name, and whether its plugin.json opts
// in to "Allow relink" ("relink": true)
function providerInfo(ids = siteAccess.getProviders()) {
  return enabledProviders(ids)
    .filter((p) => p.id !== "local")
    .map((p) => ({ id: p.id, label: providerLabel(p.id), relink: p.manifest.relink === true }));
}

// Login buttons that the login page, Configure sign-in and the in-app modal show for
// providers that don't use the shared form. "login_path" (a route of the provider) gets
// returnTo appended; "login_url" (e.g. a proxy's own login page, for per-request
// providers) is linked as is.
function loginLinks(ids = siteAccess.getProviders()) {
  const out = [];
  enabledProviders(ids).forEach((p) => {
    const m = p.manifest;
    if (m.login_form === true) return;
    const label = m.login_label || `Log in with ${p.label}`;
    if (typeof m.login_path === "string" && m.login_path.startsWith("/"))
      out.push({ id: p.id, label, path: `api/auth/${p.id}${m.login_path}` });
    else if (typeof m.login_url === "string" && /^(\/(?!\/)|https?:\/\/)/.test(m.login_url))
      out.push({ id: p.id, label, url: m.login_url });
  });
  return out;
}

// Where "Sign out" sends a user signed in by this provider (plugin.json "logout_url"), if anywhere
function logoutUrl(id) {
  const p = getProvider(id);
  const url = p && p.manifest.logout_url;
  return typeof url === "string" && url !== "" ? url : null;
}

// Per address. Only wrong credentials count (a 401, or res.locals.loginFailed), so malformed
// requests, refused account links and directory outages can't lock out everyone behind one address,
// and the ceiling is 10x the per-account one so colleagues' typos behind one NAT or VPN don't either
const providerLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: () => 10 * require("../../scripts/rateLimiters").failedLoginLimit(),
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401 && !res.locals.loginFailed,
    message: { status: "failure", message: "Too many attempts. Try again in 15 minutes." },
  });

// Mounts GET /api/auth (the login entry points) and each enabled provider's routes at /api/auth/<id>
function mountProviderRoutes(app, { registerRouter, authorize, rootPath: root }) {
  if (typeof root === "string") mountedRoot = root;
  const list = express.Router();
  const { apilimiter, accountLimiterFor } = require("../../scripts/rateLimiters");
  list.get("/", apilimiter, authorize.public("lists the enabled login providers"), (req, res) => {
    res.send({
      status: "success",
      providers: enabledProviders().map((p) => ({ id: p.id, label: providerLabel(p.id) })),
      loginForms: loginForms(),
      loginLinks: loginLinks(),
    });
  });
  const base = `${rootPath()}/api/auth`;
  app.use(base, registerRouter(base, list));
  refreshProviderAccounts().catch((err) => {
    if (/relation "auth_identities" does not exist/.test(err.message)) return;
    siteAccess.setProviderAccounts(true);
    logger("error", "Couldn't check for provider-linked accounts; visitor sign-up stays closed until a check succeeds (at the next sign-up attempt, account deletion or restart).", "AuthProviders", null, err);
  });
  warnUnmatchableGroups().catch((err) => {
    // A new database gets its tables after this runs, and then has no groups to check
    if (/relation "auth_groups" does not exist/.test(err.message)) return;
    logger("error", "Couldn't check the login providers' group names.", "AuthProviders", null, err);
  });
  // Posts to the shared login form's route from other sites are refused, so a page can't sign a visitor in to
  // someone else's account; other routes (e.g. a SAML or OIDC form_post callback) check their own state
  const { sameOriginOnly } = require("../connections/routes");

  enabledProviders().forEach((p) => {
    if (typeof p.impl.routes !== "function") return;
    const prefix = `${base}/${p.id}`;
    const router = express.Router();
    if (p.manifest.login_form === true && typeof p.manifest.login_path === "string")
      router.use(p.manifest.login_path, (req, res, next) =>
        req.method === "POST" ? sameOriginOnly(req, res, next) : next()
      );
    p.impl.routes(router, {
      authorize,
      logger,
      LinkError,
      returnTo: (value) => returnTo(value),
      completeLogin: (req, raw) => completeLogin(req, normalizeIdentity(p.id, raw)),
      sessionGroups: (req, username) => leadGroups(username, req.leadGroupName),
    });
    app.use(prefix, providerLimiter(), accountLimiterFor(p.id), registerRouter(prefix, router));
  });
}

module.exports = {
  BUILTIN_PROVIDERS,
  DOCS_URL,
  loadProviders,
  availableProviders,
  conflictingProviders,
  getProvider,
  enabledProviders,
  validateProviders,
  providerWarnings,
  normalizeIdentity,
  identify,
  LinkError,
  reservedUsername,
  unsafeUsername,
  usernameTaken,
  linkIdentity,
  RELINK_HOURS,
  relinkKey,
  findClaim,
  missingKey,
  groupName,
  groupNameProblem,
  reportedGroups,
  warnUnmatchableGroups,
  warnUnfitSubjects,
  startSettingBeat,
  relinkUsername,
  resetFailures,
  relinkTarget,
  locateSubject,
  locateAnywhere,
  matchUsername,
  sameFolded,
  subjectSettingOf: (providerId) => subjectSetting(getProvider(providerId)),
  linkFits: (providerId, link) => {
    const p = getProvider(providerId);
    return !p || subjectFits(p, link);
  },
  sameUsername,
  syncGroups,
  stillLinked,
  // For tests: forget which accounts and providers were rechecked
  forgetRechecks: () => (rechecks.clear(), providerDown.clear(), groupsUnreadLogged.clear()),
  recheckLinked,
  fillGroups,
  fillsOnlyAtSignIn,
  refreshProviderAccounts,
  completeLogin,
  leadGroups,
  returnTo,
  loginForms,
  providerLabel,
  providerInfo,
  loginLinks,
  logoutUrl,
  mountProviderRoutes,
};
