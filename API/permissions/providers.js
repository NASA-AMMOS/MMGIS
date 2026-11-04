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
    ...(Array.isArray(raw.strictGroups)
      ? { strictGroups: raw.strictGroups.filter((g) => typeof g === "string" && g !== "") }
      : {}),
  };
}

// identify runs on every request, so a hung provider must not hold requests open
const IDENTIFY_TIMEOUT_MS = 5000;

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
// and a deleted account's files under "~deleted~<id>~<random>"
const reservedUsername = (name) => {
  const n = String(name).normalize("NFKC").trim().replace(/\u0130/g, "I").toLowerCase();
  return n === "group" || n.startsWith("~deleted~");
};

// Usernames are shown in pages (e.g. Draw's "by <owner>"); markup characters there would be script
const unsafeUsername = (name) => /[\u0000-\u001f\u007f<>"`]/.test(String(name));

class LinkError extends Error {
  constructor(message, userMessage) {
    super(message);
    // The same for every refusal, so it doesn't reveal which usernames have accounts
    this.userMessage =
      userMessage ||
      (siteAccess.hasProvider("local") && !siteAccess.localAdminsOnly()
        ? "This sign-in can't be used with MMGIS yet. Ask an administrator, and if you also have an MMGIS account, keep signing in with it for now."
        : "This sign-in can't be used with MMGIS yet. Ask an administrator.");
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
async function markMissing(m, provider, userId, gone, subject) {
  if (!m.AuthMeta) return;
  const key = missingKey(provider, userId);
  if (!gone) return m.AuthMeta.destroy({ where: { key } });
  if (!(await m.AuthMeta.findOne({ where: { key }, raw: true })))
    // Another recheck (or process) may have marked it at the same moment
    await m.AuthMeta.create({ key, value: { since: new Date().toISOString(), subject } }).catch((err) => {
      if (err.name !== "SequelizeUniqueConstraintError") throw err;
    });
}
// Directories match the dotted capital İ as i, which toLowerCase() alone turns into i + U+0307
const fold = (s) => String(s).normalize("NFKC").replace(/\u0130/g, "I").toLowerCase();
const sameUsername = (a, b) => fold(a) === fold(b);

async function findClaim(identity, m) {
  if (!m.AuthMeta) return null;
  const rows = await m.AuthMeta.findAll({
    where: { key: { [Op.like]: `relink:${identity.provider}:%` } },
    raw: true,
  });
  for (const r of rows) {
    const v = r.value;
    if (!v || !(Date.parse(v.expires_at) > Date.now())) continue;
    // Only the entry the admin was shown may claim it, whatever it is called by now
    if (v.subject ? v.subject !== identity.subject : !sameUsername(v.username, identity.username)) continue;
    return { key: r.key, userId: parseInt(r.key.split(":").pop(), 10), by: v.by };
  }
  return null;
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
    const v = r.value;
    if (!v || !v.subject || v.subject === identity.subject || !(Date.parse(v.expires_at) > Date.now())) continue;
    if (!sameUsername(v.username, identity.username)) continue;
    await m.AuthMeta.update(
      { value: { ...v, stale: { subject: identity.subject, at: new Date().toISOString() } } },
      { where: { key: r.key } }
    );
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
        user_id: user.id,
      },
      { transaction }
    );
    // A local password it had is no longer known to anyone
    await m.User.update(
      { password: crypto.randomBytes(32).toString("hex"), token: null },
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

// Whether the entry with this subject still exists at the provider, even disabled or moved where logins
// aren't searched: truthy if lookup or locate(subject) finds it, null when both say it's gone,
// undefined when that can't be told (no hooks, or one failed and the other found nothing)
async function locateSubject(providerId, subject) {
  const p = getProvider(providerId);
  const fns = p ? [p.impl.lookup, p.impl.locate].filter((f) => typeof f === "function") : [];
  let unknown = fns.length === 0;
  for (const fn of fns) {
    const found = await withTimeout(fn(subject), "locate(subject)", IDENTIFY_TIMEOUT_MS).catch(() => undefined);
    if (found) return found;
    if (found === undefined) unknown = true;
  }
  return unknown ? undefined : null;
}

// The provider's entry for a username, so an admin can see who a relink would go to:
// { subject, dn } or null when the provider has none, undefined when it can't look people up
async function relinkTarget(providerId, username) {
  const p = enabledProviders().find((x) => x.id === providerId);
  if (!p || typeof p.impl.findSubject !== "function") return undefined;
  return p.impl.findSubject(username);
}

// Finds the account linked to provider+subject, creating one on first login.
// Never links to, or changes, an existing account by matching its username, unless an admin allowed a relink.
async function linkIdentity(identity, m = accountModels(), retried = false) {
  const link = await m.AuthIdentity.findOne({
    where: { provider: identity.provider, subject: identity.subject },
    raw: true,
  });
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
      // Drawings and other content are keyed by username, so a rename at the provider isn't copied
      if (identity.username !== user.username)
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
      attributes: ["user_id", "username", "subject"],
      raw: true,
    })).find((l) => l.username && sameUsername(l.username, identity.username));
  if (sameName && sameName.subject === identity.subject)
    throw new LinkError(
      `'${identity.username}' was linked to account ${sameName.user_id} by another sign-in at the same moment; signing in again works.`
    );
  if (sameName) {
    // If that account's own entry is still there, the name was handed to someone new: a relink would give them the account
    const still = await locateSubject(identity.provider, sameName.subject).catch(() => undefined);
    if (still === undefined)
      throw new LinkError(
        `'${identity.username}' already signs in to account ${sameName.user_id} with a different ${identity.provider} ID, and ${identity.provider} couldn't say whether that account's entry (subject '${sameName.subject}') still exists. Check before allowing a relink: if it does, the name was reused by someone else.`
      );
    if (still)
      throw new LinkError(
        `'${identity.username}' (subject '${identity.subject}') is a different ${identity.provider} entry from account ${sameName.user_id}'s, which still exists${still.dn ? ` at ${still.dn}` : ""}${still.username ? ` as '${still.username}'` : ""}. The name was reused: don't relink account ${sameName.user_id} to it. MMGIS usernames don't change, so this person can't sign in while account ${sameName.user_id} holds the name.`
      );
    throw new LinkError(
      `'${identity.username}' already signs in to account ${sameName.user_id} with a different ${identity.provider} ID, and that account's old entry is gone. Only allow a relink on that account if this is the same person: the directory may have given the name to someone new.`
    );
  }
  // MMGIS stores both in 255-character columns
  if (identity.subject.length > 255 || identity.username.length > 255)
    throw new LinkError(`The ${identity.subject.length > 255 ? "subject" : "username"} is longer than the 255 characters MMGIS can store.`);
  if (reservedUsername(identity.username))
    throw new LinkError(`The username '${identity.username}' is reserved in MMGIS.`);
  if (unsafeUsername(identity.username))
    throw new LinkError(`The username ${JSON.stringify(identity.username)} contains < > " \` or control characters, which MMGIS usernames can't.`);
  const taken = m.usernameTaken
    ? await m.usernameTaken(identity.username)
    : await m.User.findOne({ where: { username: identity.username }, attributes: ["id"], raw: true });
  if (taken) {
    const holder = taken.id != null && m.AuthIdentity.findOne
      ? await m.AuthIdentity.findOne({ where: { user_id: taken.id, provider: identity.provider }, raw: true })
      : null;
    if (holder)
      throw new LinkError(
        `The username '${identity.username}' belongs to account ${taken.id}, which signs in with ${identity.provider} as '${holder.username}' (renamed there). Don't relink it to this entry; this person can't sign in while that account holds the name.`
      );
    const adminsOnly = siteAccess.localAdminsOnly();
    throw new LinkError(
      `The username '${identity.username}' already belongs to account ${taken.id}, which doesn't sign in with ${identity.provider} yet. If it is this person's, allow a relink to ${identity.provider} on account ${taken.id}${
        adminsOnly
          ? `. AUTH_LOCAL_LOGIN=admins stops it signing in with its MMGIS password meanwhile, unless it holds an admin role.`
          : `; until then they can keep using its MMGIS password.`
      }`
    );
  }
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
      await m.AuthIdentity.create(
        {
          provider: identity.provider,
          subject: identity.subject,
          username: identity.username,
          last_login_at: new Date(),
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
    logger(
      "info",
      `Auth provider '${identity.provider}': ${await who(m, userId)}${remove.length ? ` left ${names(remove)}` : ""}${remove.length && add.length ? " and" : ""}${add.length ? ` joined ${names(add)}` : ""}. Groups are matched by their exact name, so a group renamed or moved there needs its name updated in Users & Access.`,
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

// Re-reads a provider-linked account through the provider's lookup(subject) at most every
// AUTH_RECHECK_MINUTES, so directory changes reach existing sessions and tokens. Resolves false
// once the provider says the account is gone; keeps access when the provider can't be reached.
// With detail, resolves to "ok", "missing", "failed" (the provider couldn't be asked) or "unsupported" instead.
function stillLinked(userId, providerId, m, force = false, detail = false) {
  const p = getProvider(providerId);
  const ms = recheckMs();
  if ((ms === 0 && !force) || !p || typeof p.impl.lookup !== "function") return Promise.resolve(detail ? "ok" : true);
  const key = `${providerId}:${userId}`;
  const hit = rechecks.get(key);
  if (!force && !detail && hit && Date.now() - hit.at < ms) {
    if (!hit.missing) return hit.result;
    // Another process may have signed the person in again (a relink or a restored entry) since
    return (async () => {
      m = m || accountModels();
      const link = await m.AuthIdentity.findOne({ where: { user_id: userId, provider: providerId }, raw: true });
      const since = link && link.last_login_at ? new Date(link.last_login_at).getTime() : 0;
      return since > hit.at ? stillLinked(userId, providerId, m, true) : false;
    })();
  }
  const status = (async () => {
    m = m || accountModels();
    const link = await m.AuthIdentity.findOne({ where: { user_id: userId, provider: providerId }, raw: true });
    if (!link) return "ok";
    let found;
    try {
      found = await withTimeout(p.impl.lookup(link.subject), "lookup(subject)", IDENTIFY_TIMEOUT_MS);
    } catch (err) {
      logger("warn", `Auth provider '${providerId}': couldn't recheck ${await who(m, userId)}; it keeps its access until the next check.`, "AuthProviders", null, err);
      return "failed";
    }
    // e.g. LDAP without a service account: nothing can be read between logins
    if (found === undefined) return "unsupported";
    // A relink during the lookup replaced the subject; that login already synced the new one
    const now = await m.AuthIdentity.findOne({ where: { user_id: userId, provider: providerId }, raw: true });
    if (!now || now.subject !== link.subject) return "ok";
    const identity = normalizeIdentity(providerId, found && { ...found, subject: link.subject });
    const changed = await syncGroups(userId, identity || { provider: providerId, groups: [] }, m);
    await markMissing(m, providerId, userId, !identity, link.subject);
    // So People shows a rename before the person's next login, and a newcomer with the old name isn't mistaken for them
    if (identity && identity.username && identity.username !== now.username) {
      await m.AuthIdentity.update({ username: identity.username }, { where: { user_id: userId, provider: providerId, subject: link.subject } });
      logger("info", `Auth provider '${providerId}': ${await who(m, userId)} is now '${identity.username}' there (was '${now.username}').`, "AuthProviders");
    }
    if (changed || !identity) require("./principal").invalidate();
    if (!identity)
      logger("info", `Auth provider '${providerId}' no longer has ${await who(m, userId)} (subject '${link.subject}'); its sessions and API tokens stop working.`, "AuthProviders");
    return identity ? "ok" : "missing";
  })().catch((err) => {
    rechecks.delete(key);
    throw err;
  });
  const result = status.then((s) => s !== "missing");
  const entry = { at: Date.now(), result };
  rechecks.set(key, entry);
  result.then((ok) => (entry.missing = !ok), () => {});
  return detail ? status : result;
}

// Rechecks every provider-linked account now, including ones nobody has used since a directory change,
// so People shows which entries are gone
// One run per process at a time, so a second click while a slow directory answers doesn't double its load
let recheckingAll = null;
function recheckLinked(m = accountModels()) {
  if (!recheckingAll) recheckingAll = recheckAllNow(m).finally(() => (recheckingAll = null));
  return recheckingAll;
}

async function recheckAllNow(m) {
  const links = (await m.AuthIdentity.findAll({ attributes: ["user_id", "provider"], raw: true })).filter((l) => {
    const p = getProvider(l.provider);
    return p && typeof p.impl.lookup === "function";
  });
  let next = 0;
  const counts = { ok: 0, missing: 0, failed: 0, unsupported: 0 };
  const worker = async () => {
    while (next < links.length) {
      const l = links[next++];
      counts[await stillLinked(l.user_id, l.provider, m, true, true).catch(() => "failed")]++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, links.length) }, worker));
  // failed: the provider couldn't be asked (unreachable, or its service account was refused)
  return { checked: links.length - counts.unsupported, missing: counts.missing, failed: counts.failed, unsupported: counts.unsupported };
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
// requests, refused account links and directory outages can't lock out everyone behind one address
const providerLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
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
  missingKey,
  groupName,
  relinkTarget,
  locateSubject,
  sameUsername,
  syncGroups,
  stillLinked,
  recheckLinked,
  completeLogin,
  leadGroups,
  returnTo,
  loginForms,
  providerLabel,
  loginLinks,
  logoutUrl,
  mountProviderRoutes,
};
