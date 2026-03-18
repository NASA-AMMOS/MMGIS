const logger = require("../API/logger");

/**
 * Creates middleware to validate TiTiler URL parameters against allowed patterns.
 * Prevents SSRF attacks by restricting URLs to configured regex patterns.
 *
 * @returns {Function} Express middleware function
 */
function createTitilerUrlValidator() {
  // Parse ENV variable at startup (once per server start)
  let allowedPatterns = [];
  let validationEnabled = false;

  if (process.env.TITILER_ALLOWED_URL_PATTERNS) {
    try {
      const parsed = JSON.parse(process.env.TITILER_ALLOWED_URL_PATTERNS);

      // Empty array [] means disable validation (allow all)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Compile regex patterns with error handling
        allowedPatterns = parsed
          .map((pattern) => {
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

        validationEnabled = allowedPatterns.length > 0;

        if (validationEnabled) {
          logger(
            "info",
            `TiTiler URL validation enabled with ${allowedPatterns.length} pattern(s)`,
            "validateTitilerUrl"
          );
        }
      }
    } catch (error) {
      logger(
        "error",
        "Failed to parse TITILER_ALLOWED_URL_PATTERNS as JSON",
        "validateTitilerUrl",
        null,
        error
      );
    }
  }

  // Return middleware function
  return function validateTitilerUrl(req, res, next) {
    // If validation disabled, allow all requests
    if (!validationEnabled) {
      return next();
    }

    // Extract URL from query parameter (GET) or request body (POST)
    const url = req.method === "GET" ? req.query.url : req.body?.url;

    // If no URL parameter, let request through (TiTiler will handle the error)
    if (!url) {
      return next();
    }

    // Check if URL matches at least one allowed pattern
    const isAllowed = allowedPatterns.some((regex) => regex.test(url));

    if (!isAllowed) {
      // Log blocked request for security audit
      logger(
        "warn",
        `Blocked TiTiler request with disallowed URL: ${url}`,
        "validateTitilerUrl",
        req
      );

      // Return 403 Forbidden with JSON error
      return res.status(403).json({
        error: "Forbidden",
        message: "The requested URL does not match allowed patterns",
        detail:
          "URL parameter must match one of the configured TITILER_ALLOWED_URL_PATTERNS",
      });
    }

    // URL is valid, continue to proxy
    next();
  };
}

module.exports = createTitilerUrlValidator;
