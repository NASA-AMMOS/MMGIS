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
// An identity is { subject, username?, email?, groups?: string[], session? }.
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const logger = require("../logger");
const { discoverPlugins } = require("../pluginDiscovery");
const siteAccess = require("./siteAccess");

// Ids of the shipped providers; only their own plugin folders may use them
const BUILTIN_PROVIDERS = { local: "Local", csso: "CSSO" };
const DOCS_URL = "https://nasa-ammos.github.io/MMGIS/contributing/auth-providers";
const DEFAULT_PLUGINS_ROOT = path.join(__dirname, "..", "..", "plugins");

let registry = null;

function loadProviders(pluginsRoot = DEFAULT_PLUGINS_ROOT) {
  const found = new Map();
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
        `Auth provider '${p.container}/auth/${p.name}' was not loaded: its plugin.js threw ${err && err.stack ? err.stack : err}`,
        "AuthProviders"
      );
      continue;
    }
    found.set(id, { id, name: p.name, label: m.display_name || p.name, manifest: m, impl });
  }
  registry = found;
  return availableProviders();
}

function providerMap() {
  if (registry == null) loadProviders();
  return registry;
}

const availableProviders = () => Array.from(providerMap().keys());
const getProvider = (id) => providerMap().get(id) || null;
const enabledProviders = (ids = siteAccess.getProviders()) =>
  ids.map(getProvider).filter(Boolean);

function collect(hook, ids, env) {
  const out = [];
  enabledProviders(ids).forEach((p) => {
    if (typeof p.impl[hook] !== "function") return;
    const result = p.impl[hook](env);
    if (Array.isArray(result)) out.push(...result.map(String));
  });
  return out;
}
const validateProviders = (ids, env = process.env) => collect("validate", ids, env);
const providerWarnings = (ids = siteAccess.getProviders(), env = process.env) => {
  const out = collect("warnings", ids, env);
  if (ids.includes("csso") && !ids.includes("local"))
    out.push(
      'AUTH_PROVIDERS does not include local, so local admin accounts cannot sign in to /configure. Use ["csso","local"] to keep them.'
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
  };
}

// The first enabled provider that recognizes this request, or null
async function identify(req) {
  for (const p of enabledProviders()) {
    if (typeof p.impl.identify !== "function") continue;
    const identity = normalizeIdentity(p.id, await p.impl.identify(req));
    if (identity) return identity;
  }
  return null;
}

////// Accounts for session-based (redirect) providers

class LinkError extends Error {}

function accountModels() {
  const { AuthIdentity, AuthGroup, AuthGroupMember } = require("./models");
  const { User } = require("../../plugins/core/backend/Users/models/user");
  return { User, AuthIdentity, AuthGroup, AuthGroupMember };
}

// Finds the account linked to provider+subject, creating one on first login.
// Never links to, or changes, an existing account by matching its username.
async function linkIdentity(identity, m = accountModels()) {
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
    if (user) return user;
  }
  const taken = await m.User.findOne({
    where: { username: identity.username },
    attributes: ["id"],
    raw: true,
  });
  if (taken)
    throw new LinkError(
      `The username '${identity.username}' already belongs to another account.`
    );
  // Random password: the account can only be used through its provider
  const fields = { username: identity.username, password: crypto.randomBytes(32).toString("hex") };
  // Email is optional and unique, so one already in use is left off
  if (identity.email) {
    const emailTaken = await m.User.findOne({
      where: { email: identity.email },
      attributes: ["id"],
      raw: true,
    });
    if (!emailTaken) fields.email = identity.email;
  }
  let created;
  try {
    created = await m.User.create(fields);
  } catch (err) {
    if (!fields.email || err.name !== "SequelizeValidationError") throw err;
    delete fields.email;
    created = await m.User.create(fields);
  }
  await m.AuthIdentity.create({
    provider: identity.provider,
    subject: identity.subject,
    user_id: created.id,
  });
  return { id: created.id, username: created.username };
}

// Sets the user's membership of groups sourced from this provider to exactly
// the groups the provider reported
async function syncGroups(userId, identity, m = accountModels()) {
  const groups = await m.AuthGroup.findAll({
    where: { source: identity.provider },
    attributes: ["id", "external_name"],
    raw: true,
  });
  if (groups.length === 0) return;
  const want = new Set(
    groups.filter((g) => identity.groups.includes(g.external_name)).map((g) => g.id)
  );
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
  if (remove.length > 0)
    await m.AuthGroupMember.destroy({ where: { user_id: userId, group_id: remove } });
  if (add.length > 0)
    await m.AuthGroupMember.bulkCreate(add.map((group_id) => ({ group_id, user_id: userId })));
}

async function completeLogin(req, identity) {
  if (!identity) throw new LinkError("The provider did not return an identity.");
  const user = await linkIdentity(identity);
  await syncGroups(user.id, identity);
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

const rootPath = () => process.env.ROOT_PATH || "";

// A same-site path to send the browser to after login; anything else falls back to the site root
function returnTo(value, fallback = `${rootPath()}/`) {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return fallback;
  return value;
}

// Login entry points that the login page, Configure sign-in and the in-app modal show.
// A provider gets one by setting "login_path" in its plugin.json.
function loginLinks(ids = siteAccess.getProviders()) {
  return enabledProviders(ids)
    .filter((p) => typeof p.manifest.login_path === "string" && p.manifest.login_path.startsWith("/"))
    .map((p) => ({
      id: p.id,
      label: p.manifest.login_label || `Log in with ${p.label}`,
      path: `api/auth/${p.id}${p.manifest.login_path}`,
    }));
}

// Where "Sign out" sends a user signed in by this provider (plugin.json "logout_url"), if anywhere
function logoutUrl(id) {
  const p = getProvider(id);
  const url = p && p.manifest.logout_url;
  return typeof url === "string" && url !== "" ? url : null;
}

// Only failed responses (status >= 400) count, so a provider answers bad credentials with 401
const providerLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { status: "failure", message: "Too many attempts, try again later." },
  });

// Mounts GET /api/auth (the login entry points) and each enabled provider's routes at /api/auth/<id>
function mountProviderRoutes(app, { registerRouter, authorize }) {
  const list = express.Router();
  const { apilimiter } = require("../../scripts/rateLimiters");
  list.get("/", apilimiter, authorize.public("lists the enabled login providers"), (req, res) => {
    res.send({
      status: "success",
      providers: enabledProviders().map((p) => ({ id: p.id, label: p.label })),
      loginLinks: loginLinks(),
    });
  });
  app.use("/api/auth", registerRouter("/api/auth", list));

  enabledProviders().forEach((p) => {
    if (typeof p.impl.routes !== "function") return;
    const prefix = `/api/auth/${p.id}`;
    const router = express.Router();
    p.impl.routes(router, {
      authorize,
      logger,
      LinkError,
      returnTo: (value) => returnTo(value),
      completeLogin: (req, raw) => completeLogin(req, normalizeIdentity(p.id, raw)),
    });
    app.use(prefix, providerLimiter(), registerRouter(prefix, router));
  });
}

module.exports = {
  BUILTIN_PROVIDERS,
  DOCS_URL,
  loadProviders,
  availableProviders,
  getProvider,
  enabledProviders,
  validateProviders,
  providerWarnings,
  normalizeIdentity,
  identify,
  LinkError,
  linkIdentity,
  syncGroups,
  completeLogin,
  returnTo,
  loginLinks,
  logoutUrl,
  mountProviderRoutes,
};
