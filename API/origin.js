const { URL } = require("url");

function getAllowedOrigins(value = process.env.CORS_ORIGINS) {
  if (typeof value !== "string") return [];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isOriginAllowed(origin, requestHost, allowedOrigins = getAllowedOrigins()) {
  if (!origin) return true;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch (err) {
    return false;
  }

  if (
    typeof requestHost === "string" &&
    parsedOrigin.host.toLowerCase() === requestHost.toLowerCase()
  ) {
    return true;
  }

  return allowedOrigins.some((allowedOrigin) => {
    try {
      return parsedOrigin.origin === new URL(allowedOrigin).origin;
    } catch (err) {
      return parsedOrigin.origin === allowedOrigin;
    }
  });
}

module.exports = { getAllowedOrigins, isOriginAllowed };
