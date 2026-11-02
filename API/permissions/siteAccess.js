// Site access (who may view the site) and login providers (how people log in).
// Replaces the former AUTH ENV.

const SITE_ACCESS_VALUES = ["public", "optional", "required"];

const LEGACY_AUTH_REPLACEMENTS = {
  off: { SITE_ACCESS: "public", AUTH_PROVIDERS: '["local"]' },
  none: { SITE_ACCESS: "optional", AUTH_PROVIDERS: '["local"]' },
  local: { SITE_ACCESS: "required", AUTH_PROVIDERS: '["local"]' },
  csso: { SITE_ACCESS: "required", AUTH_PROVIDERS: '["proxy","local"]', note: "PROXY_TRUST=network (or PROXY_SECRET)" },
};

// The csso provider is now proxy; its ENVs are not read under the old names
const RENAMED_ENVS = {
  CSSO_GROUPS: "PROXY_GROUPS",
  CSSO_LEAD_GROUP: "PROXY_LEAD_GROUP",
  CSSO_PROXY_SECRET: "PROXY_SECRET", // pragma: allowlist secret
};

function parseProviders(raw) {
  if (raw == null || String(raw).trim() === "") return ["local"];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    parsed = String(raw)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (typeof parsed === "string") parsed = [parsed];
  if (!Array.isArray(parsed)) return null;
  return Array.from(new Set(parsed.map((p) => String(p).toLowerCase())));
}

// all: any local account may log in; admins: only accounts holding an admin role
const LOCAL_LOGIN_VALUES = ["all", "admins"];
const localAdminsOnly = () => process.env.AUTH_LOCAL_LOGIN === "admins";

// Whether visitors may create their own local accounts
const selfSignupAllowed = () =>
  hasProvider("local") &&
  !localAdminsOnly() &&
  (isOptional() ||
    (isRequired() &&
      (process.env.AUTH_LOCAL_ALLOW_SIGNUP === true ||
        process.env.AUTH_LOCAL_ALLOW_SIGNUP === "true")));

// Returns a list of human-readable problems with the current ENV (empty if valid)
function validate(env = process.env) {
  const errors = [];
  if (env.AUTH != null && env.AUTH !== "") {
    // Messages only echo known values, never raw ENV contents
    const key = Object.keys(LEGACY_AUTH_REPLACEMENTS).find(
      (k) => k === String(env.AUTH).toLowerCase()
    );
    const legacy = key && LEGACY_AUTH_REPLACEMENTS[key];
    errors.push(
      legacy
        ? `The AUTH ENV has been removed. Replace 'AUTH=${key}' with 'SITE_ACCESS=${legacy.SITE_ACCESS}' and 'AUTH_PROVIDERS=${legacy.AUTH_PROVIDERS}'${legacy.note ? ` and set ${legacy.note}` : ""}.`
        : `The AUTH ENV has been removed. Unset AUTH and set SITE_ACCESS (public | optional | required) and AUTH_PROVIDERS instead.`
    );
  }
  Object.entries(RENAMED_ENVS).forEach(([from, to]) => {
    if (env[from] != null && env[from] !== "") errors.push(`${from} has been renamed. Use ${to} instead.`);
  });
  if (!SITE_ACCESS_VALUES.includes(env.SITE_ACCESS))
    errors.push(
      `SITE_ACCESS must be set to one of: ${SITE_ACCESS_VALUES.join(" | ")}.`
    );
  if (env.AUTH_LOCAL_LOGIN != null && env.AUTH_LOCAL_LOGIN !== "" && !LOCAL_LOGIN_VALUES.includes(env.AUTH_LOCAL_LOGIN))
    errors.push(`AUTH_LOCAL_LOGIN must be one of: ${LOCAL_LOGIN_VALUES.join(" | ")}.`);
  const providers = parseProviders(env.AUTH_PROVIDERS);
  if (providers == null || providers.length === 0) {
    errors.push(`AUTH_PROVIDERS must be a JSON array, e.g. ["local"].`);
    return errors;
  }
  // Lazy: the provider registry depends on this module
  const registry = require("./providers");
  const available = registry.availableProviders();
  const conflicting = registry.conflictingProviders();
  providers.forEach((p) => {
    if (conflicting.includes(p))
      errors.push(`AUTH_PROVIDERS: more than one plugin folder provides '${p}'. Give each one its own "provider" id.`);
    if (available.includes(p)) return;
    errors.push(
      `AUTH_PROVIDERS lists an unknown provider '${String(p).replace(/[^\w.-]/g, "").slice(0, 40)}'. Available: ${available.join(", ")}. A provider must be in plugins/core/auth/<Name>/ with a plugin.json whose "provider" is this id; if it is, see the errors logged above for why it did not load. Guide: ${registry.DOCS_URL}`
    );
  });
  if (errors.length === 0) errors.push(...registry.validateProviders(providers, env));
  return errors;
}

function getSiteAccess() {
  return SITE_ACCESS_VALUES.includes(process.env.SITE_ACCESS)
    ? process.env.SITE_ACCESS
    : "required";
}

function getProviders() {
  return parseProviders(process.env.AUTH_PROVIDERS) || ["local"];
}

const hasProvider = (p) => getProviders().includes(p);
const isPublic = () => getSiteAccess() === "public";
const isOptional = () => getSiteAccess() === "optional";
const isRequired = () => getSiteAccess() === "required";
// Guests (no login) may browse the main site
const guestsAllowed = () => !isRequired();
// End users (not only admins at /configure) may log in on the main site
const endUserLoginEnabled = () => !isPublic();

module.exports = {
  SITE_ACCESS_VALUES,
  LEGACY_AUTH_REPLACEMENTS,
  RENAMED_ENVS,
  parseProviders,
  validate,
  getSiteAccess,
  getProviders,
  hasProvider,
  isPublic,
  isOptional,
  isRequired,
  guestsAllowed,
  endUserLoginEnabled,
  localAdminsOnly,
  selfSignupAllowed,
  LOCAL_LOGIN_VALUES,
};
