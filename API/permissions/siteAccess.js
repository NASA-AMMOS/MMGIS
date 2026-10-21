// Site access (who may view the site) and login providers (how people log in).
// Replaces the former AUTH ENV.

const SITE_ACCESS_VALUES = ["public", "optional", "required"];

const LEGACY_AUTH_REPLACEMENTS = {
  off: { SITE_ACCESS: "public", AUTH_PROVIDERS: '["local"]' },
  none: { SITE_ACCESS: "optional", AUTH_PROVIDERS: '["local"]' },
  local: { SITE_ACCESS: "required", AUTH_PROVIDERS: '["local"]' },
  csso: { SITE_ACCESS: "required", AUTH_PROVIDERS: '["csso"]' },
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

// Returns a list of human-readable problems with the current ENV (empty if valid)
function validate(env = process.env) {
  const errors = [];
  if (env.AUTH != null && env.AUTH !== "") {
    const legacy = LEGACY_AUTH_REPLACEMENTS[String(env.AUTH).toLowerCase()];
    errors.push(
      legacy
        ? `The AUTH ENV has been removed. Replace 'AUTH=${env.AUTH}' with 'SITE_ACCESS=${legacy.SITE_ACCESS}' and 'AUTH_PROVIDERS=${legacy.AUTH_PROVIDERS}'.`
        : `The AUTH ENV has been removed. Unset 'AUTH=${env.AUTH}' and set SITE_ACCESS (public | optional | required) and AUTH_PROVIDERS instead.`
    );
  }
  if (!SITE_ACCESS_VALUES.includes(env.SITE_ACCESS))
    errors.push(
      `SITE_ACCESS must be one of: ${SITE_ACCESS_VALUES.join(" | ")} (got '${
        env.SITE_ACCESS == null ? "" : env.SITE_ACCESS
      }').`
    );
  const providers = parseProviders(env.AUTH_PROVIDERS);
  if (providers == null || providers.length === 0) {
    errors.push(`AUTH_PROVIDERS must be a JSON array, e.g. ["local"].`);
    return errors;
  }
  // Lazy: the provider registry depends on this module
  const registry = require("./providers");
  const available = registry.availableProviders();
  providers.forEach((p) => {
    if (available.includes(p)) return;
    if (registry.RESERVED_PROVIDERS.includes(p))
      errors.push(`AUTH_PROVIDERS: '${p}' is not supported yet.`);
    else
      errors.push(
        `AUTH_PROVIDERS: unknown provider '${p}'. Available: ${available.join(", ")}.`
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
};
