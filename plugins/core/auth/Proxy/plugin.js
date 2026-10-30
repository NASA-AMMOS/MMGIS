// Authenticating reverse proxy: a proxy in front of MMGIS signs the user in and
// forwards identity headers on every request. MMGIS only believes those headers
// from the proxy, proven by a shared secret (default), the proxy's IP address,
// or (PROXY_TRUST=network) the network keeping MMGIS reachable only through it.
const crypto = require("crypto");
const net = require("net");

const TRUST_MODES = ["secret", "ips", "network"];
const GROUP_FORMATS = ["base64-json", "json", "list"];
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const URL_VALUE = /^(\/(?!\/)|https?:\/\/)/;

const setting = (v, fallback) => (v != null && String(v).trim() !== "" ? String(v).trim() : fallback);

function config(env = process.env) {
  return {
    trust: setting(env.PROXY_TRUST, "secret").toLowerCase(),
    secret: env.PROXY_SECRET || "",
    secretHeader: setting(env.PROXY_SECRET_HEADER, "X-MMGIS-Proxy-Secret"),
    trustedIps: setting(env.PROXY_TRUSTED_IPS, ""),
    userHeader: setting(env.PROXY_USER_HEADER, "X-Sub"),
    groupsHeader: setting(env.PROXY_GROUPS_HEADER, "X-Groups"),
    groupsFormat: setting(env.PROXY_GROUPS_FORMAT, "base64-json").toLowerCase(),
    sessionHeader: setting(env.PROXY_SESSION_HEADER, "X-Session"),
    statusUrl: setting(env.PROXY_STATUS_URL, "/ssostatus"),
    logoutUrl: setting(env.PROXY_LOGOUT_URL, "/ssologoutredirect"),
    loginUrl: setting(env.PROXY_LOGIN_URL, "/ssologinredirect"),
    refreshUrl: setting(env.PROXY_REFRESH_URL, "/ssorefreshtimeout"),
  };
}

// PROXY_TRUSTED_IPS: JSON array or comma list of addresses and CIDR ranges
function parseTrustedIps(raw) {
  let entries;
  try {
    entries = JSON.parse(raw);
  } catch (err) {
    entries = String(raw).split(",");
  }
  if (typeof entries === "string") entries = [entries];
  if (!Array.isArray(entries)) return null;
  entries = entries.map((e) => String(e).trim()).filter(Boolean);
  if (entries.length === 0) return null;
  const list = new net.BlockList();
  for (const entry of entries) {
    const [addr, bits, extra] = entry.split("/");
    const type = net.isIPv4(addr) ? "ipv4" : net.isIPv6(addr) ? "ipv6" : null;
    if (!type || extra !== undefined) return null;
    if (bits === undefined) list.addAddress(addr, type);
    else {
      const prefix = Number(bits);
      if (!/^\d+$/.test(bits) || prefix > (type === "ipv4" ? 32 : 128)) return null;
      list.addSubnet(addr, prefix, type);
    }
  }
  return list;
}

let ipCache = { raw: null, list: null };
function trustedIps(raw) {
  if (ipCache.raw !== raw) ipCache = { raw, list: parseTrustedIps(raw) };
  return ipCache.list;
}

function remoteAddress(req) {
  const addr = String((req.socket && req.socket.remoteAddress) || "");
  return addr.startsWith("::ffff:") && net.isIPv4(addr.slice(7)) ? addr.slice(7) : addr;
}

function proxyTrusted(req, c) {
  if (c.trust === "network") return true;
  if (c.trust === "ips") {
    const list = trustedIps(c.trustedIps);
    const addr = remoteAddress(req);
    const type = net.isIPv4(addr) ? "ipv4" : net.isIPv6(addr) ? "ipv6" : null;
    return !!(list && type && list.check(addr, type));
  }
  if (c.trust !== "secret" || !c.secret) return false;
  const sent = Buffer.from(String(req.get(c.secretHeader) || ""));
  const expected = Buffer.from(String(c.secret));
  return sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
}

// The user's groups, or null when the header can't be read (the request is then not trusted).
// Like AUTH=csso, any truthy value is membership; "strict" holds the groups whose value is exactly
// true, which is what the lead group (PROXY_LEAD_GROUP) needs.
function parseGroups(header, format) {
  if (header === undefined) return { groups: [], strict: [] };
  if (format === "list") {
    const names = String(header)
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    return { groups: names, strict: names };
  }
  let groups;
  try {
    groups = JSON.parse(format === "json" ? header : Buffer.from(header, "base64").toString("ascii"));
  } catch (err) {
    return null;
  }
  if (Array.isArray(groups)) {
    if (format !== "json") return null;
    const names = groups.filter((g) => typeof g === "string");
    return { groups: names, strict: names };
  }
  if (groups === null || typeof groups !== "object") return null;
  return {
    groups: Object.keys(groups).filter((g) => !!groups[g]),
    strict: Object.keys(groups).filter((g) => groups[g] === true),
  };
}

module.exports = {
  config,
  // Header names (lowercase) that carry proxy identity, so they are never forwarded upstream
  identityHeaders(env = process.env) {
    const c = config(env);
    return [c.userHeader, c.groupsHeader, c.sessionHeader, c.secretHeader].map((h) => h.toLowerCase());
  },
  identify(req) {
    const c = config();
    const sub = req.get(c.userHeader);
    if (sub === undefined || !proxyTrusted(req, c)) return null;
    const parsed = parseGroups(req.get(c.groupsHeader), c.groupsFormat);
    if (parsed === null) return null;
    return {
      subject: sub,
      username: sub,
      groups: parsed.groups,
      strictGroups: parsed.strict,
      session: req.get(c.sessionHeader) || null,
    };
  },
  validate(env) {
    const c = config(env);
    const errors = [];
    if (!TRUST_MODES.includes(c.trust)) errors.push(`PROXY_TRUST must be one of: ${TRUST_MODES.join(" | ")}.`);
    else if (c.trust === "secret" && !c.secret)
      errors.push(
        `AUTH_PROVIDERS includes proxy, so PROXY_SECRET must be set and the proxy must send it in the ${c.secretHeader} header. To trust the identity headers on any request instead, as AUTH=csso did, set PROXY_TRUST=network (MMGIS must then be reachable only through the proxy), or set PROXY_TRUST=ips with PROXY_TRUSTED_IPS.`
      );
    else if (c.trust === "ips" && !trustedIps(c.trustedIps))
      errors.push(`PROXY_TRUST=ips needs PROXY_TRUSTED_IPS: a JSON array of the proxy's addresses or CIDR ranges, e.g. ["10.0.0.5","10.1.0.0/16"].`);
    if (!GROUP_FORMATS.includes(c.groupsFormat))
      errors.push(`PROXY_GROUPS_FORMAT must be one of: ${GROUP_FORMATS.join(" | ")}.`);
    const names = { PROXY_USER_HEADER: c.userHeader, PROXY_GROUPS_HEADER: c.groupsHeader, PROXY_SESSION_HEADER: c.sessionHeader, PROXY_SECRET_HEADER: c.secretHeader };
    Object.entries(names).forEach(([k, v]) => {
      if (!HEADER_NAME.test(v)) errors.push(`${k} must be an HTTP header name.`);
    });
    if (new Set(Object.values(names).map((v) => v.toLowerCase())).size !== 4)
      errors.push("PROXY_USER_HEADER, PROXY_GROUPS_HEADER, PROXY_SESSION_HEADER and PROXY_SECRET_HEADER must all be different headers.");
    if (c.statusUrl !== "off" && !URL_VALUE.test(c.statusUrl))
      errors.push('PROXY_STATUS_URL must be a path starting with "/", an http(s) URL, or off.');
    for (const [k, v] of [["PROXY_LOGOUT_URL", c.logoutUrl], ["PROXY_LOGIN_URL", c.loginUrl], ["PROXY_REFRESH_URL", c.refreshUrl]])
      if (!URL_VALUE.test(v)) errors.push(`${k} must be a path starting with "/" or an http(s) URL.`);
    return errors;
  },
  warnings(env) {
    const c = config(env);
    const out = [];
    if (c.trust === "network")
      out.push("PROXY_TRUST=network: proxy identity headers are trusted on any request. MMGIS must be reachable only through the proxy, which must strip those headers from what clients send.");
    if (c.trust !== "secret" && c.secret) out.push(`PROXY_SECRET is set but ignored because PROXY_TRUST=${c.trust}.`);
    return out;
  },
};
