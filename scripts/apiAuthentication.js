const crypto = require("crypto");

const PUBLIC_AUTH_MODES = new Set(["none", "off"]);
const AUTHENTICATED_SESSION_PERMISSIONS = new Set(["111", "110", "001"]);

const DEFAULT_UNAUTHORIZED = Object.freeze({
  code: "ApiAuthenticationRequired",
  message: "Authentication is required.",
});
const DEFAULT_UNAVAILABLE = Object.freeze({
  code: "ApiAuthenticationUnavailable",
  message: "Authentication could not be verified.",
});

function normalizeAuthMode(authMode) {
  return String(authMode || "")
    .trim()
    .toLowerCase();
}

function isPublicNoAuthMode(authMode) {
  return PUBLIC_AUTH_MODES.has(normalizeAuthMode(authMode));
}

/**
 * Parse the two long-term-token header forms historically documented by MMGIS.
 * The complete value must be either `Bearer <token>` or `Bearer: <token>`.
 */
function parseBearerAuthorization(authorization) {
  if (typeof authorization !== "string") return null;

  const match = /^Bearer:?[ \t]+([^ \t]+)$/i.exec(authorization);
  return match ? match[1] : null;
}

function hasAuthenticatedSession(req, authMode, guestUsername = "guest") {
  if (!req || !req.user || req.user === guestUsername) return false;

  const normalizedAuthMode = normalizeAuthMode(authMode);

  if (normalizedAuthMode === "local") {
    return AUTHENTICATED_SESSION_PERMISSIONS.has(req.session?.permission);
  }

  // CSSO identity is hydrated from trusted proxy headers by cssoHandler. Do
  // not infer CSSO for blank, misspelled, or future modes: protected API gates
  // must fail closed when the host authentication configuration is unknown.
  return normalizedAuthMode === "csso";
}

function isLongTermTokenRecordValid(tokenData, token, now = Date.now()) {
  if (
    !tokenData ||
    typeof token !== "string" ||
    tokenData.token !== token ||
    tokenData.created_by_user_id === null ||
    tokenData.created_by_user_id === undefined
  ) {
    return false;
  }

  if (tokenData.period === "never") return true;

  const createdAt = new Date(tokenData.createdAt).getTime();
  const period = Number.parseInt(tokenData.period, 10);
  return (
    Number.isFinite(now) &&
    Number.isFinite(createdAt) &&
    Number.isFinite(period) &&
    now - createdAt < period
  );
}

/**
 * Adapt the host's callback-based long-term-token validator to a Promise.
 * Invalid/expired records resolve to null; storage or validator failures reject.
 */
function createLongTermTokenResolver(validateLongTermToken) {
  if (typeof validateLongTermToken !== "function") {
    throw new TypeError("validateLongTermToken must be a function.");
  }

  return function resolveLongTermToken(token) {
    return new Promise((resolve, reject) => {
      const pending = validateLongTermToken(
        token,
        resolve,
        () => resolve(null),
        reject,
      );

      // The host validator reports query errors through its fourth callback.
      // Also observe a returned Promise so an unexpected asynchronous throw
      // cannot leave an API request pending forever.
      if (pending && typeof pending.catch === "function") {
        pending.catch(reject);
      }
    });
  };
}

function deriveApiAuthIdentity(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("A parsed long-term token is required.");
  }

  const digest = crypto.createHash("sha256").update(token, "utf8").digest("hex");
  return `long-term-token:sha256:${digest}`;
}

function establishPublicSessionApiAuthIdentity(req) {
  if (
    !req?.session ||
    typeof req.sessionID !== "string" ||
    req.sessionID.length === 0
  ) {
    return null;
  }

  const digest = crypto
    .createHash("sha256")
    .update(req.sessionID, "utf8")
    .digest("hex");
  const identity = `session:sha256:${digest}`;

  // Persisting a nonsecret value marks a new express-session as initialized,
  // allowing saveUninitialized:false clients to receive and reuse its cookie.
  req.session.apiAuthIdentity = identity;
  req.apiAuthIdentity = identity;
  return identity;
}

function hydrateRequestFromLongTermToken(req, tokenData, parsedToken) {
  req.isLongTermToken = true;
  req.tokenUserPermission = tokenData.permission;
  req.tokenUserMissions = tokenData.missions_managing;
  req.user = tokenData.username;
  if (parsedToken !== undefined) {
    req.apiAuthIdentity = deriveApiAuthIdentity(parsedToken);
  }
}

function configuredFailure(options, defaults, prefix = "") {
  const codeKey = prefix ? `${prefix}Code` : "code";
  const messageKey = prefix ? `${prefix}Message` : "message";
  const code = options?.[codeKey];
  const message = options?.[messageKey];

  return {
    code: typeof code === "string" && code.trim() ? code.trim() : defaults.code,
    message:
      typeof message === "string" && message.trim()
        ? message.trim()
        : defaults.message,
  };
}

function sendTypedError(res, status, failure) {
  if (status === 401) res.set("WWW-Authenticate", "Bearer");
  return res.status(status).json({
    error: failure.message,
    code: failure.code,
  });
}

/**
 * Build the plugin-facing typed API authentication middleware factory.
 *
 * `resolveLongTermToken` receives only the strictly parsed token value and must
 * resolve to the host token/user record, resolve to null for an invalid or
 * expired token, or reject when authentication cannot be checked.
 */
function createEnsureUserForApi({
  getAuthMode = () => process.env.AUTH,
  resolveLongTermToken,
  guestUsername = "guest",
} = {}) {
  if (typeof resolveLongTermToken !== "function") {
    throw new TypeError("resolveLongTermToken must be a function.");
  }

  return function ensureUserForApi(options = {}) {
    const unauthorized = configuredFailure(options, DEFAULT_UNAUTHORIZED);
    const unavailable = configuredFailure(
      options,
      DEFAULT_UNAVAILABLE,
      "unavailable",
    );

    return async function requireApiUser(req, res, next) {
      const authMode = getAuthMode();

      // Public installations do not require credentials. In particular, an
      // unrelated/bogus Authorization header must not make a public route fail.
      if (isPublicNoAuthMode(authMode)) {
        establishPublicSessionApiAuthIdentity(req);
        return next();
      }

      if (hasAuthenticatedSession(req, authMode, guestUsername)) return next();

      const token = parseBearerAuthorization(req?.headers?.authorization);
      if (!token) return sendTypedError(res, 401, unauthorized);

      let tokenData;
      try {
        tokenData = await resolveLongTermToken(token);
      } catch (_error) {
        return sendTypedError(res, 503, unavailable);
      }

      const tokenUsername =
        typeof tokenData?.username === "string"
          ? tokenData.username.trim()
          : "";
      if (!tokenUsername || tokenUsername === guestUsername) {
        return sendTypedError(res, 401, unauthorized);
      }

      hydrateRequestFromLongTermToken(req, tokenData, token);
      return next();
    };
  };
}

module.exports = {
  createEnsureUserForApi,
  createLongTermTokenResolver,
  deriveApiAuthIdentity,
  establishPublicSessionApiAuthIdentity,
  hasAuthenticatedSession,
  hydrateRequestFromLongTermToken,
  isPublicNoAuthMode,
  isLongTermTokenRecordValid,
  normalizeAuthMode,
  parseBearerAuthorization,
};
