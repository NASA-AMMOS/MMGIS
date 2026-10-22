const path = require("path");
const { fixRequestBody } = require("http-proxy-middleware");

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

// Re-sends a body that bodyParser already read. fixRequestBody sets Content-Length,
// so a chunked Transfer-Encoding from the caller must go or upstream rejects the request.
function forwardParsedBody(proxyReq, req) {
  const type = String(proxyReq.getHeader("content-type") || "");
  if (req.readableLength === 0 && req.body && /json|x-www-form-urlencoded|multipart\/form-data/.test(type))
    proxyReq.removeHeader("transfer-encoding");
  fixRequestBody(proxyReq, req);
}

module.exports = { routedPath, stripCredentials, forwardParsedBody };
