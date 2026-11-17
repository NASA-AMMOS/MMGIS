// Service connections: credentials for external services (e.g. Earthdata) that
// tools use on a signed-in user's behalf. A connection never signs anyone in
// to MMGIS; login providers (API/permissions/providers.js) do that.
//
// Connection plugins live in plugins/<container>/connections/<Name>/ with a
// plugin.json ("type": "connection", "connection": "<id>") and a plugin.js:
//   authorizeUrl({ state, redirectUri, env, codeChallenge, codeChallengeMethod }) -> URL of the service's sign-in page
//   exchange({ code, redirectUri, env, codeVerifier })      -> grant  (PKCE is on unless "pkce": false)
//   refresh({ refreshToken, env })        (optional)        -> grant
//   revoke({ accessToken, refreshToken, env }) (optional)
//   validate(env) / warnings(env)         (optional)        -> string[]
// A grant is { accessToken, refreshToken?, expiresIn? (s) | expiresAt?, account? }.
//
// This file is the public API; the work is split across common.js, registry.js,
// storage.js, refresh.js and routes.js (secretBox.js does the encryption).
const secretBox = require("./secretBox");
const common = require("./common");
const registry = require("./registry");
const storage = require("./storage");
const refresh = require("./refresh");
const routes = require("./routes");
const { getConnection } = registry;
const { revokeQuietly, models } = storage;

// The grants stored for an account, read before it is deleted (the rows go with it)
async function accountGrants(userId, options = {}) {
  const rows = await models().AuthConnection.findAll({ where: { user_id: userId }, ...options });
  return rows
    .map((row) => ({ c: getConnection(row.connection), record: secretBox.open(row.data) }))
    .filter((g) => g.c && g.record);
}
// Revokes them at each service, in the background
function revokeGrants(grants) {
  (grants || []).forEach((g) => revokeQuietly(g.c, g.record));
}

module.exports = {
  accountGrants,
  revokeGrants,
  scrubbed: common.scrubbed,
  callbackUrl: routes.callbackUrl,
  DOCS_URL: common.DOCS_URL,
  loadConnections: registry.loadConnections,
  allConnections: registry.allConnections,
  getConnection: registry.getConnection,
  setupStatus: registry.setupStatus,
  startupWarnings: registry.startupWarnings,
  storageFor: storage.storageFor,
  grantRecord: storage.grantRecord,
  readStored: storage.readStored,
  writeStored: storage.writeStored,
  removeStored: storage.removeStored,
  forgetRefreshes: refresh.forgetRefreshes,
  current: refresh.current,
  adoptSessionConnections: storage.adoptSessionConnections,
  carryGuestConnections: storage.carryGuestConnections,
  token: refresh.token,
  rejected: refresh.rejected,
  unavailable: refresh.unavailable,
  isTransient: common.isTransient,
  connectionRequired: refresh.connectionRequired,
  ConnectionRequiredError: common.ConnectionRequiredError,
  mountConnectionRoutes: routes.mountConnectionRoutes,
  sameSitePath: routes.sameSitePath,
  authorizeUrlMissing: routes.authorizeUrlMissing,
  ownerKey: storage.ownerKey,
  withTimeout: common.withTimeout,
  sameOriginOnly: routes.sameOriginOnly,
};
