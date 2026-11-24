const logger = require("../API/logger");

// Used when TITILER_ALLOWED_URL_PATTERNS is unset, empty or has no valid pattern:
// only the local Missions paths MMGIS itself sends (Docker: /Missions/..., otherwise ../../Missions/...)
const DEFAULT_PATTERNS = [
  "^/Missions/(?:(?!\\.)[^/\\\\\\x00]+/\\.\\./shared/)?(?!.*\\.\\.)[^\\x00]*$",
  "^\\.\\./\\.\\./Missions/(?:(?!\\.)[^/\\\\\\x00]+/\\.\\./shared/)?(?!.*\\.\\.)[^\\x00]*$",
];

function compilePatterns(patterns) {
  return patterns
    .map((pattern) => {
      if (typeof pattern !== "string") return null;
      try {
        return new RegExp(pattern);
      } catch (error) {
        logger(
          "error",
          `Invalid regex pattern in TITILER_ALLOWED_URL_PATTERNS: ${pattern}`,
          "validateTitilerUrl",
          null,
          error
        );
        return null;
      }
    })
    .filter((regex) => regex !== null);
}

function configuredPatterns() {
  const raw = process.env.TITILER_ALLOWED_URL_PATTERNS;
  if (raw == null || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return compilePatterns(parsed);
    logger(
      "error",
      "TITILER_ALLOWED_URL_PATTERNS must be a JSON array of regex strings",
      "validateTitilerUrl"
    );
  } catch (error) {
    logger(
      "error",
      "Failed to parse TITILER_ALLOWED_URL_PATTERNS as JSON",
      "validateTitilerUrl",
      null,
      error
    );
  }
  return [];
}

/**
 * Creates middleware to validate TiTiler URL parameters against allowed patterns.
 * Prevents SSRF attacks by restricting URLs to configured regex patterns.
 * Fails closed: without a valid configured pattern only local Missions paths are allowed.
 * Allowing every URL requires an explicit '[".*"]'.
 *
 * @returns {Function} Express middleware function
 */
function createTitilerUrlValidator() {
  let allowedPatterns = configuredPatterns();
  if (allowedPatterns.length > 0) {
    logger(
      "info",
      `TiTiler URL validation enabled with ${allowedPatterns.length} pattern(s)`,
      "validateTitilerUrl"
    );
  } else {
    allowedPatterns = compilePatterns(DEFAULT_PATTERNS);
    logger(
      "info",
      "TITILER_ALLOWED_URL_PATTERNS has no valid pattern; TiTiler only accepts local /Missions paths",
      "validateTitilerUrl"
    );
  }

  return function validateTitilerUrl(req, res, next) {
    // URLs from the query string, and from the body for other methods
    const urls = [req.query.url, req.method !== "GET" ? req.body?.url : undefined]
        .filter((v) => v !== undefined && v !== null);

    // Every URL must match at least one allowed pattern
    const url = urls.find(
      (u) => typeof u !== "string" || !allowedPatterns.some((regex) => regex.test(u))
    );

    if (url !== undefined) {
      // Log blocked request for security audit
      logger(
        "warn",
        `Blocked TiTiler request with disallowed URL: ${url}`,
        "validateTitilerUrl",
        req
      );

      return res.status(403).json({
        error: "Forbidden",
        message: "The requested URL does not match allowed patterns",
        detail:
          "URL parameter must match one of the configured TITILER_ALLOWED_URL_PATTERNS",
      });
    }

    next();
  };
}

module.exports = createTitilerUrlValidator;
module.exports.DEFAULT_PATTERNS = DEFAULT_PATTERNS;
