const path = require("path");

// The request path as an upstream server routes it: percent-decoded, backslashes
// and dot segments resolved, lowercased. null if it can't be decoded.
function routedPath(originalUrl) {
  let p = String(originalUrl).split("?")[0];
  for (let i = 0; i < 5 && /%[0-9a-f]{2}/i.test(p); i++) {
    try {
      p = decodeURIComponent(p);
    } catch (err) {
      return null;
    }
  }
  if (/%[0-9a-f]{2}/i.test(p)) return null;
  return path.posix.normalize(p.replace(/\\/g, "/")).toLowerCase();
}

// Upstream servers never receive the caller's MMGIS token, session cookies or CSSO identity headers
const MMGIS_COOKIES = /^(MMGISSession|MMGISUser)=/;
const IDENTITY_HEADERS = ["authorization", "x-mmgis-proxy-secret", "x-sub", "x-groups", "x-session"];
function stripCredentials(proxyReq) {
  for (const h of IDENTITY_HEADERS) proxyReq.removeHeader(h);
  const cookie = proxyReq.getHeader("cookie");
  if (cookie == null) return;
  const kept = String(cookie)
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c && !MMGIS_COOKIES.test(c));
  if (kept.length > 0) proxyReq.setHeader("cookie", kept.join("; "));
  else proxyReq.removeHeader("cookie");
}

module.exports = { routedPath, stripCredentials };
