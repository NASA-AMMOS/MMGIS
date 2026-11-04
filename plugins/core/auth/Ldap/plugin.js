// LDAP directory login. The shared username/password form (login page, Configure
// sign-in, in-app modal) posts to /api/auth/ldap/login. MMGIS finds the person's
// entry (searching as a service account or anonymously, or from a DN template),
// checks the password by binding as that entry, then links the MMGIS account by a
// stable id and syncs the person's directory groups.
const fs = require("fs");
const net = require("net");
const { Client, InvalidCredentialsError, SizeLimitExceededError } = require("ldapts");

const setting = (v, fallback = "") => (v != null && String(v).trim() !== "" ? String(v).trim() : fallback);
const isTrue = (v) => String(v).trim().toLowerCase() === "true";
const MAX_USERNAME = 256;

function config(env = process.env) {
  const timeout = Number(setting(env.LDAP_TIMEOUT_MS, "5000"));
  return {
    url: setting(env.LDAP_URL),
    startTls: isTrue(env.LDAP_STARTTLS),
    allowInsecure: isTrue(env.LDAP_ALLOW_INSECURE),
    ca: setting(env.LDAP_TLS_CA),
    bindDn: setting(env.LDAP_BIND_DN),
    bindPassword: env.LDAP_BIND_PASSWORD || "",
    userDnTemplate: setting(env.LDAP_USER_DN_TEMPLATE),
    searchBase: setting(env.LDAP_USER_SEARCH_BASE),
    searchFilter: setting(env.LDAP_USER_SEARCH_FILTER, "(uid={{username}})"),
    subjectAttribute: setting(env.LDAP_SUBJECT_ATTRIBUTE, "entryUUID"),
    usernameAttribute: setting(env.LDAP_USERNAME_ATTRIBUTE, "uid"),
    emailAttribute: setting(env.LDAP_EMAIL_ATTRIBUTE, "mail"),
    groupsAttribute: setting(env.LDAP_GROUPS_ATTRIBUTE, "memberOf"),
    groupSearchBase: setting(env.LDAP_GROUP_SEARCH_BASE),
    groupSearchFilter: setting(env.LDAP_GROUP_SEARCH_FILTER, "(member={{dn}})"),
    groupNameAttribute: setting(env.LDAP_GROUP_NAME_ATTRIBUTE),
    timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : 5000,
    displayName: setting(env.LDAP_DISPLAY_NAME, "LDAP"),
    usernameLabel: setting(env.LDAP_USERNAME_LABEL, "Username"),
    hint: setting(env.LDAP_LOGIN_HINT),
    domain: setting(env.LDAP_USERNAME_DOMAIN),
  };
}

// "CORP\\alice" -> "alice" when LDAP_USERNAME_DOMAIN=CORP (Windows-style sign-in)
function stripDomain(username, c) {
  const prefix = c.domain ? `${c.domain.toLowerCase()}\\` : null;
  return prefix && username.toLowerCase().startsWith(prefix) ? username.slice(prefix.length) : username;
}

////// Escaping user input into filters (RFC 4515) and DNs (RFC 4514)

function escapeFilter(value) {
  return String(value).replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function escapeDn(value) {
  return String(value)
    .replace(/[\\,+"<>;=]/g, (c) => `\\${c}`)
    .replace(/\0/g, "\\00")
    .replace(/^([ #])/, "\\$1")
    .replace(/ $/, "\\ ");
}

const fill = (template, values) =>
  template.replace(/\{\{(username|dn)\}\}/g, (m, key) => (values[key] != null ? values[key] : m));

// "CN=Science Team, OU=Groups,DC=corp" -> "cn=science team,ou=groups,dc=corp", so one group always
// reads the same however the directory spaces or capitalizes it
function normalizeDn(dn) {
  const rdns = [];
  let cur = "";
  const s = String(dn);
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      cur += s.slice(i, i + 2);
      i++;
    } else if (s[i] === ",") {
      rdns.push(cur);
      cur = "";
    } else cur += s[i];
  }
  rdns.push(cur);
  return rdns
    .map((r) => r.trim().replace(/^([^=]*?)\s*=\s*/, "$1="))
    .join(",")
    .toLowerCase();
}

////// Directory entries

function values(entry, name) {
  const key = Object.keys(entry).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return [];
  const v = entry[key];
  return (Array.isArray(v) ? v : [v]).filter((x) => x != null && x !== "");
}

// Active Directory's objectGUID is binary, written in its usual mixed-endian form
function guidString(buf) {
  const h = buf.toString("hex");
  const swap = (s) => s.match(/../g).reverse().join("");
  return `${swap(h.slice(0, 8))}-${swap(h.slice(8, 12))}-${swap(h.slice(12, 16))}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function subjectOf(entry, c) {
  if (c.subjectAttribute.toLowerCase() === "dn") return entry.dn;
  const v = values(entry, c.subjectAttribute)[0];
  if (v == null) return null;
  if (Buffer.isBuffer(v)) return v.length === 16 && /^objectguid$/i.test(c.subjectAttribute) ? guidString(v) : v.toString("hex");
  return String(v);
}

const isBinaryAttribute = (name) => /^(objectguid|objectsid)$/i.test(name);

function userAttributes(c) {
  const attrs = [c.subjectAttribute, c.usernameAttribute, c.emailAttribute];
  if (!c.groupSearchBase) attrs.push(c.groupsAttribute);
  return attrs.filter((a) => a.toLowerCase() !== "dn");
}

////// Errors the login route tells apart

// The password was right but the directory says it must be changed (Active Directory)
class PasswordExpiredError extends Error {}

function isPasswordExpired(err) {
  return /\bdata (532|773)\b/.test(String((err && err.message) || ""));
}

////// Login

function tlsOptions(c) {
  const opts = {};
  if (c.ca) opts.ca = [fs.readFileSync(c.ca)];
  return opts;
}

// StartTLS upgrades the existing socket, so the host to check the certificate against is given here
function startTlsOptions(c) {
  const host = new URL(c.url).hostname.replace(/^\[|\]$/g, "");
  const opts = { ...tlsOptions(c), host };
  if (!net.isIP(host)) opts.servername = host;
  return opts;
}

function newClient(c) {
  const options = { url: c.url, timeout: c.timeoutMs, connectTimeout: c.timeoutMs };
  // ldapts opens a TLS connection whenever tlsOptions is given, so only ldaps:// gets them here
  if (/^ldaps:/i.test(c.url)) options.tlsOptions = tlsOptions(c);
  return new Client(options);
}

async function bindAs(client, dn, password) {
  try {
    await client.bind(dn, password);
    return true;
  } catch (err) {
    if (!(err instanceof InvalidCredentialsError)) throw err;
    if (isPasswordExpired(err)) throw new PasswordExpiredError("password expired");
    return false;
  }
}

async function findUser(client, c, username) {
  const filter = fill(c.searchFilter, { username: escapeFilter(username) });
  let result;
  try {
    result = await client.search(c.searchBase, {
      scope: "sub",
      filter,
      attributes: userAttributes(c),
      sizeLimit: 2,
      explicitBufferAttributes: userAttributes(c).filter(isBinaryAttribute),
    });
  } catch (err) {
    // More than one match: treat as no match rather than guess
    if (err instanceof SizeLimitExceededError) return null;
    throw err;
  }
  return result.searchEntries.length === 1 ? result.searchEntries[0] : null;
}

async function readEntry(client, c, dn) {
  const { searchEntries } = await client.search(dn, {
    scope: "base",
    filter: "(objectClass=*)",
    attributes: userAttributes(c),
    explicitBufferAttributes: userAttributes(c).filter(isBinaryAttribute),
  });
  return searchEntries[0] || null;
}

// Groups are reported by DN: two groups named "admins" in different OUs must not become one MMGIS group
async function groupsOf(client, c, entry, username) {
  if (!c.groupSearchBase) return values(entry, c.groupsAttribute).map((v) => normalizeDn(v));
  const { searchEntries } = await client.search(c.groupSearchBase, {
    scope: "sub",
    filter: fill(c.groupSearchFilter, { dn: escapeFilter(entry.dn), username: escapeFilter(username) }),
    attributes: c.groupNameAttribute ? [c.groupNameAttribute] : ["dn"],
  });
  return searchEntries.map((g) => {
    const name = c.groupNameAttribute ? values(g, c.groupNameAttribute)[0] : null;
    return name != null ? String(name) : normalizeDn(g.dn);
  });
}

// The person's identity if the password is right, null if it isn't; throws when the
// directory can't be reached or doesn't answer as configured
async function authenticate(username, password, c = config(), createClient = newClient) {
  const client = createClient(c);
  try {
    if (c.startTls) await client.startTLS(startTlsOptions(c));
    let entry;
    if (c.userDnTemplate) {
      const dn = fill(c.userDnTemplate, { username: escapeDn(username) });
      if (!(await bindAs(client, dn, password))) return null;
      entry = c.searchBase ? await findUser(client, c, username) : await readEntry(client, c, dn);
      if (!entry) throw new Error("Signed in to the directory but could not read the person's entry.");
    } else {
      if (c.bindDn && !(await bindAs(client, c.bindDn, c.bindPassword)))
        throw new Error("The directory rejected LDAP_BIND_DN / LDAP_BIND_PASSWORD.");
      entry = await findUser(client, c, username);
      if (!entry) return null;
      if (!(await bindAs(client, entry.dn, password))) return null;
      // Group searches run as the service account, as the user search did
      if (c.groupSearchBase && c.bindDn) await client.bind(c.bindDn, c.bindPassword);
    }
    const subject = subjectOf(entry, c);
    if (!subject) throw new Error(`The directory entry has no ${c.subjectAttribute} (LDAP_SUBJECT_ATTRIBUTE).`);
    const name = values(entry, c.usernameAttribute)[0];
    const email = values(entry, c.emailAttribute)[0];
    return {
      subject,
      username: name != null ? String(name) : username,
      email: email != null ? String(email) : undefined,
      groups: await groupsOf(client, c, entry, username),
    };
  } finally {
    await client.unbind().catch(() => {});
  }
}

const validUsername = (u) =>
  typeof u === "string" && u.trim() !== "" && u.length <= MAX_USERNAME && !/[\u0000-\u001f\u007f]/.test(u);

////// Startup checks

function validate(env) {
  const c = config(env);
  const errors = [];
  let protocol = null;
  try {
    protocol = new URL(c.url).protocol;
  } catch (err) {
    // reported below
  }
  if (protocol !== "ldap:" && protocol !== "ldaps:")
    errors.push("LDAP_URL must be set to the directory's address, e.g. ldaps://ldap.example.org:636.");
  if (protocol === "ldaps:" && c.startTls)
    errors.push("LDAP_STARTTLS=true is for ldap:// URLs; an ldaps:// URL is already encrypted.");
  if (protocol === "ldap:" && !c.startTls && !c.allowInsecure)
    errors.push(
      "LDAP_URL uses ldap://, which sends passwords unencrypted. Use ldaps://, set LDAP_STARTTLS=true, or, for local testing only, LDAP_ALLOW_INSECURE=true."
    );
  if (!c.userDnTemplate && !c.searchBase)
    errors.push("Set LDAP_USER_SEARCH_BASE (to search for people) or LDAP_USER_DN_TEMPLATE (to sign in as them directly).");
  if (c.userDnTemplate && !c.userDnTemplate.includes("{{username}}"))
    errors.push("LDAP_USER_DN_TEMPLATE must contain {{username}}.");
  if (c.userDnTemplate && !c.searchBase && !c.userDnTemplate.includes("="))
    errors.push(
      "LDAP_USER_DN_TEMPLATE isn't a DN (e.g. {{username}}@corp.example.org), so MMGIS can't read the person's entry from it. Also set LDAP_USER_SEARCH_BASE."
    );
  if (c.searchBase && !/^\(.*\{\{username\}\}.*\)$/.test(c.searchFilter))
    errors.push("LDAP_USER_SEARCH_FILTER must be a parenthesized filter containing {{username}}, e.g. (uid={{username}}).");
  if (c.bindDn && !c.bindPassword) errors.push("LDAP_BIND_DN is set but LDAP_BIND_PASSWORD is empty.");
  if (!c.bindDn && c.bindPassword) errors.push("LDAP_BIND_PASSWORD is set but LDAP_BIND_DN is empty.");
  if (c.groupSearchBase && !/\{\{(dn|username)\}\}/.test(c.groupSearchFilter))
    errors.push("LDAP_GROUP_SEARCH_FILTER must contain {{dn}} or {{username}}, e.g. (member={{dn}}).");
  if (c.ca) {
    try {
      fs.accessSync(c.ca, fs.constants.R_OK);
    } catch (err) {
      errors.push("LDAP_TLS_CA must be the path of a readable PEM file.");
    }
  }
  if (setting(env.LDAP_TIMEOUT_MS) && String(c.timeoutMs) !== setting(env.LDAP_TIMEOUT_MS))
    errors.push("LDAP_TIMEOUT_MS must be a whole number of milliseconds.");
  return errors;
}

function warnings(env) {
  const c = config(env);
  const out = [];
  if (c.allowInsecure && !c.startTls && /^ldap:/i.test(c.url))
    out.push("LDAP_ALLOW_INSECURE=true: LDAP passwords cross the network unencrypted. Use it only for local testing.");
  if (c.subjectAttribute.toLowerCase() === "dn")
    out.push("LDAP_SUBJECT_ATTRIBUTE=dn: a person's DN changes when they are renamed or moved, which then creates a new MMGIS account.");
  return out;
}

module.exports = {
  routes(router, ctx) {
    router.post("/login", ctx.authorize.public("LDAP directory login"), async (req, res) => {
      const c = config();
      const name = c.displayName;
      const body = req.body || {};
      if (!validUsername(body.username) || typeof body.password !== "string" || body.password === "")
        return res.status(400).send({ status: "failure", message: "Enter your username and password." });
      let identity;
      try {
        identity = await authenticate(stripDomain(body.username.trim(), c), body.password, c);
      } catch (err) {
        if (err instanceof PasswordExpiredError)
          return res.status(401).send({ status: "failure", message: `Your ${name} password has expired.` });
        ctx.logger("error", `LDAP login could not reach or read the directory: ${err && err.message}`, "Ldap", req, err);
        return res.status(503).send({ status: "failure", message: `${name} is unavailable. Try again later.` });
      }
      // 401 so failed attempts count towards the rate limit
      if (!identity)
        return res.status(401).send({ status: "failure", message: `Invalid ${name} username or password.` });
      try {
        const user = await ctx.completeLogin(req, identity);
        ctx.logger(
          "info",
          `${user.username} logged in with LDAP. Directory groups: ${identity.groups.length ? identity.groups.join(" | ") : "none"}.`,
          "Ldap",
          req
        );
        res.send({ status: "success", username: user.username, provider: "ldap", groups: ctx.sessionGroups(req, user.username) });
      } catch (err) {
        if (err instanceof ctx.LinkError)
          return res.status(409).send({ status: "failure", message: err.userMessage });
        ctx.logger("error", "LDAP login failed.", "Ldap", req, err);
        res.status(500).send({ status: "failure", message: "Login failed." });
      }
    });
  },
  loginForm(env) {
    const c = config(env);
    return { title: c.displayName, usernameLabel: c.usernameLabel, hint: c.hint };
  },
  validate,
  warnings,
  // For tests
  _internal: { config, stripDomain, escapeFilter, escapeDn, normalizeDn, guidString, authenticate, PasswordExpiredError },
};
