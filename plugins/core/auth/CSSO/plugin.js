// Cloud Single Sign-On: a proxy in front of MMGIS authenticates the user and
// forwards identity headers on every request.
const crypto = require("crypto");

// When CSSO_PROXY_SECRET is set, identity headers are only trusted if the
// proxy also sends the matching X-MMGIS-Proxy-Secret header
function proxyTrusted(req) {
  const secret = process.env.CSSO_PROXY_SECRET;
  if (!secret) return true;
  const sent = Buffer.from(String(req.get("X-MMGIS-Proxy-Secret") || ""));
  const expected = Buffer.from(String(secret));
  return sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
}

function parseGroups(header) {
  if (header === undefined) return [];
  try {
    const groups = JSON.parse(Buffer.from(header, "base64").toString("ascii")) || {};
    return Object.keys(groups).filter((g) => groups[g] === true);
  } catch (err) {
    return [];
  }
}

module.exports = {
  identify(req) {
    const sub = req.get("X-Sub");
    if (sub === undefined || !proxyTrusted(req)) return null;
    return {
      subject: sub,
      username: sub,
      groups: parseGroups(req.get("X-Groups")),
      session: req.get("X-Session") || null,
    };
  },
  warnings(env) {
    return env.CSSO_PROXY_SECRET
      ? []
      : [
          "AUTH_PROVIDERS includes csso but CSSO_PROXY_SECRET is not set. Identity headers will be trusted from any request.",
        ];
  },
};
