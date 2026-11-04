// LDAP directory login. The shared username/password form (login page, Configure
// sign-in, in-app modal) posts to /api/auth/ldap/login. MMGIS finds the person's
// entry (searching as a service account or anonymously, or from a DN template),
// checks the password by binding as that entry, then links the MMGIS account by a
// stable id and syncs the person's directory groups.
const fs = require("fs");
const net = require("net");
const crypto = require("crypto");
const { Client, InvalidCredentialsError, SizeLimitExceededError, NoSuchObjectError, ResultCodeError } = require("ldapts");

const setting = (v, fallback = "") => (v != null && String(v).trim() !== "" ? String(v).trim() : fallback);
const isTrue = (v) => String(v).trim().toLowerCase() === "true";
const MAX_USERNAME = 255;

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
// reads the same however the directory spaces, capitalizes or escapes it (\, and \2c alike)
function normalizeDn(dn) {
  const s = String(dn);
  const rdns = [];
  let avas = [];
  let type = null;
  let bytes = [];
  const text = (str) => bytes.push(...Buffer.from(str, "utf8"));
  const endAva = () => {
    const value = Buffer.from(bytes).toString("utf8").trim().toLowerCase();
    avas.push(type == null ? value : `${type.trim().toLowerCase()}=${value.replace(/[\\,+"<>;]/g, "\\$&").replace(/^[ #]/, "\\$&")}`);
    type = null;
    bytes = [];
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (ch === "\\" && i + 1 < s.length) text(s[++i]);
    else if (ch === "=" && type == null) {
      type = Buffer.from(bytes).toString("utf8");
      bytes = [];
    } else if (ch === "+" || ch === ",") {
      endAva();
      if (ch === ",") {
        rdns.push(avas.join("+"));
        avas = [];
      }
    } else text(ch);
  }
  endAva();
  rdns.push(avas.join("+"));
  return rdns.join(",");
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

const hexEscape = (buf) => Array.from(buf, (b) => `\\${b.toString(16).padStart(2, "0")}`).join("");

// The search filter matching a stored subject, the reverse of subjectOf
function subjectFilter(c, subject) {
  const a = c.subjectAttribute;
  if (/^objectguid$/i.test(a) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject)) {
    const h = subject.replace(/-/g, "");
    const swap = (s) => s.match(/../g).reverse().join("");
    const bytes = Buffer.from(swap(h.slice(0, 8)) + swap(h.slice(8, 12)) + swap(h.slice(12, 16)) + h.slice(16), "hex");
    return `(${a}=${hexEscape(bytes)})`;
  }
  if (isBinaryAttribute(a) && /^([0-9a-f]{2})+$/i.test(subject)) return `(${a}=${hexEscape(Buffer.from(subject, "hex"))})`;
  return `(${a}=${escapeFilter(subject)})`;
}

// Active Directory's "account disabled" flag and expiry, OpenLDAP ppolicy's lock, 389 DS / FreeIPA's lock
const STATE_ATTRIBUTES = ["userAccountControl", "accountExpires", "pwdAccountLockedTime", "nsAccountLock"];
// accountExpires counts 100 ns steps since 1601; 0 and 2^63-1 mean never
const AD_EPOCH_OFFSET_MS = 11644473600000;
function adExpired(entry) {
  const v = String(values(entry, "accountExpires")[0] || "");
  if (!/^\d+$/.test(v) || v === "0" || v === "9223372036854775807") return false;
  return Number(v) / 10000 - AD_EPOCH_OFFSET_MS < Date.now();
}
const accountDisabled = (entry) =>
  (parseInt(values(entry, "userAccountControl")[0], 10) & 2) !== 0 ||
  values(entry, "pwdAccountLockedTime").length > 0 ||
  values(entry, "nsAccountLock").some((v) => String(v).toLowerCase() === "true") ||
  adExpired(entry);

function userAttributes(c) {
  const attrs = [c.subjectAttribute, c.usernameAttribute, c.emailAttribute];
  if (!c.groupSearchBase) attrs.push(c.groupsAttribute);
  // To check a UPN-template bind found the same entry
  if (c.userDnTemplate && !c.userDnTemplate.includes("=")) attrs.push("userPrincipalName");
  return attrs.filter((a) => a.toLowerCase() !== "dn");
}

////// Errors the login route tells apart

// The password was right but the directory says it must be changed (Active Directory)
class PasswordExpiredError extends Error {}

// Active Directory says why it refused a bind in the message, e.g. "data 533"
function adCode(err) {
  const m = /\bdata ([0-9a-f]{3})\b/i.exec(String((err && err.message) || ""));
  return m ? m[1].toLowerCase() : null;
}

function isPasswordExpired(err) {
  return ["532", "773"].includes(adCode(err));
}

const AD_REASONS = {
  525: "no such user",
  "52e": "wrong password",
  530: "not allowed to sign in at this time",
  531: "not allowed to sign in from this computer",
  533: "account disabled",
  701: "account expired",
  775: "account locked",
};

// After the directory rejects the service account, MMGIS stops trying it for a while:
// retrying at every login would lock the account (Active Directory locks after a few bad binds)
const SERVICE_RETRY_MS = 5 * 60 * 1000;
const rejectedServiceAccounts = new Map();

// Adds what to check to a connection or search error, for the server log
function explain(err) {
  const msg = String((err && err.message) || err);
  const text = `${(err && err.code) || ""} ${msg}`;
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|local issuer|ALTNAME/i.test(text))
    return `${msg}. The directory's TLS certificate isn't trusted: set LDAP_TLS_CA to the CA that signed it, and use the host name on the certificate in LDAP_URL.`;
  if (/ECONNREFUSED/.test(text)) return `${msg}. Nothing answered at LDAP_URL: check the host and port (ldaps:// is usually 636, ldap:// 389).`;
  if (/ENOTFOUND|EAI_AGAIN/.test(text)) return `${msg}. LDAP_URL's host name doesn't resolve.`;
  if (/wrong version number|ECONNRESET|packet length/i.test(text))
    return `${msg}. Check that ldaps:// points at the TLS port (usually 636) and ldap:// at the plain port (389, with LDAP_STARTTLS=true).`;
  if (/timeout|timed out|ETIMEDOUT/i.test(text)) return `${msg}. The directory didn't answer within LDAP_TIMEOUT_MS.`;
  if (err instanceof NoSuchObjectError)
    return `${msg}. A search base doesn't exist, or the service account can't read it: check LDAP_USER_SEARCH_BASE and LDAP_GROUP_SEARCH_BASE.`;
  return msg;
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

// { ok } or { ok: false, reason } when the directory refuses the password
async function bindAs(client, dn, password) {
  try {
    await client.bind(dn, password);
    return { ok: true };
  } catch (err) {
    if (!(err instanceof InvalidCredentialsError)) throw err;
    if (isPasswordExpired(err)) throw new PasswordExpiredError("password expired");
    return { ok: false, reason: AD_REASONS[adCode(err)] || "the directory refused the password" };
  }
}

async function bindService(client, c) {
  const key = `${c.url}\n${c.bindDn}`;
  const rejected = rejectedServiceAccounts.get(key);
  // Keyed on the password too, so a process whose settings change (tests) retries at once
  if (rejected && rejected.password === c.bindPassword && Date.now() - rejected.at < SERVICE_RETRY_MS)
    throw new Error("The directory rejected LDAP_BIND_DN / LDAP_BIND_PASSWORD; MMGIS retries it at most every 5 minutes so the account isn't locked.");
  const bind = await bindAs(client, c.bindDn, c.bindPassword);
  if (!bind.ok) {
    rejectedServiceAccounts.set(key, { at: Date.now(), password: c.bindPassword });
    throw new Error(`The directory rejected LDAP_BIND_DN / LDAP_BIND_PASSWORD (${bind.reason}). MMGIS won't retry it for 5 minutes so the account isn't locked.`);
  }
}

// { entry } or { reason } when exactly one entry doesn't match
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
    if (err instanceof SizeLimitExceededError) return { reason: `more than one entry under LDAP_USER_SEARCH_BASE matches ${filter}` };
    throw err;
  }
  if (result.searchEntries.length === 1) return { entry: result.searchEntries[0] };
  if (result.searchEntries.length > 1) return { reason: `more than one entry under LDAP_USER_SEARCH_BASE matches ${filter}` };
  return {
    reason: `no entry under LDAP_USER_SEARCH_BASE matches ${filter} (if nobody can sign in, check LDAP_USER_SEARCH_BASE and LDAP_USER_SEARCH_FILTER)`,
  };
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
  let searchEntries;
  try {
    ({ searchEntries } = await client.search(c.groupSearchBase, {
      scope: "sub",
      filter: fill(c.groupSearchFilter, { dn: escapeFilter(entry.dn), username: escapeFilter(username) }),
      attributes: c.groupNameAttribute ? [c.groupNameAttribute] : ["dn"],
      // Pages, so people in more groups than the server's size limit (e.g. AD's 1000) can still sign in
      paged: { pageSize: 500 },
    }));
  } catch (err) {
    if (err instanceof SizeLimitExceededError) err.tooManyGroups = true;
    if (err.tooManyGroups)
      err.message = `${err.message}. The person is in more groups than the directory returns to the service account; raise its size limit or narrow LDAP_GROUP_SEARCH_FILTER`;
    err.message = `Searching LDAP_GROUP_SEARCH_BASE for groups failed: ${err.message}`;
    throw err;
  }
  return searchEntries.map((g) => {
    const name = c.groupNameAttribute ? values(g, c.groupNameAttribute)[0] : null;
    return name != null ? String(name) : normalizeDn(g.dn);
  });
}

// A DN template is compared as a DN; a UPN template (alice@corp.example.org) by userPrincipalName
function isBoundEntry(entry, boundAs) {
  if (boundAs.includes("=")) return normalizeDn(entry.dn) === normalizeDn(boundAs);
  return values(entry, "userPrincipalName").some((u) => String(u).toLowerCase() === boundAs.toLowerCase());
}

// The person's identity if the password is right, null if it isn't (refused(reason) says why);
// throws when the directory can't be reached or doesn't answer as configured
async function authenticate(username, password, c = config(), createClient = newClient, refused = () => {}) {
  const refuse = (reason) => {
    refused(reason);
    return null;
  };
  const client = createClient(c);
  try {
    if (c.startTls) await client.startTLS(startTlsOptions(c));
    let entry;
    if (c.userDnTemplate) {
      const dn = fill(c.userDnTemplate, { username: escapeDn(username) });
      const bind = await bindAs(client, dn, password);
      if (!bind.ok) return refuse(`${bind.reason} for ${dn} (if nobody can sign in, check LDAP_USER_DN_TEMPLATE)`);
      entry = c.searchBase ? (await findUser(client, c, username)).entry : await readEntry(client, c, dn);
      if (!entry) throw new Error("Signed in to the directory but could not read the person's entry.");
      // The password was checked for dn, so the identity must come from that same entry
      if (!isBoundEntry(entry, dn))
        return refuse(
          `the password is right for ${dn}, but LDAP_USER_SEARCH_FILTER found a different entry, ${entry.dn} (make LDAP_USER_DN_TEMPLATE and LDAP_USER_SEARCH_FILTER name the same attribute)`
        );
    } else {
      if (c.bindDn) await bindService(client, c);
      const found = await findUser(client, c, username);
      if (!found.entry) return refuse(found.reason);
      entry = found.entry;
      const bind = await bindAs(client, entry.dn, password);
      if (!bind.ok) return refuse(`${bind.reason} for ${entry.dn}`);
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
      // The directory's username, as at recheck, so group filters don't depend on how it was typed
      groups: await groupsOf(client, c, entry, name != null ? String(name) : username),
    };
  } finally {
    await client.unbind().catch(() => {});
  }
}

// The person's current identity, read with the service account, for rechecking existing sessions
// and tokens: null when the entry is gone or disabled, undefined when there's no service account
// to read it with; throws when the directory can't be reached
async function lookup(subject, c = config(), createClient = newClient) {
  if (!c.bindDn || !c.searchBase) return undefined;
  const attributes = [...userAttributes(c), ...STATE_ATTRIBUTES];
  const explicitBufferAttributes = attributes.filter(isBinaryAttribute);
  const client = createClient(c);
  try {
    if (c.startTls) await client.startTLS(startTlsOptions(c));
    await bindService(client, c);
    let entries;
    try {
      ({ searchEntries: entries } =
        c.subjectAttribute.toLowerCase() === "dn"
          ? await client.search(subject, { scope: "base", filter: "(objectClass=*)", attributes, explicitBufferAttributes })
          : await client.search(c.searchBase, { scope: "sub", filter: subjectFilter(c, subject), attributes, explicitBufferAttributes, sizeLimit: 2 }));
    } catch (err) {
      if (err instanceof NoSuchObjectError) return null;
      throw err;
    }
    if (entries.length !== 1 || accountDisabled(entries[0])) return null;
    const entry = entries[0];
    const name = values(entry, c.usernameAttribute)[0];
    const email = values(entry, c.emailAttribute)[0];
    return {
      subject,
      username: name != null ? String(name) : undefined,
      email: email != null ? String(email) : undefined,
      groups: await groupsOf(client, c, entry, name != null ? String(name) : ""),
    };
  } finally {
    await client.unbind().catch(() => {});
  }
}

// The entry a username belongs to, read with the service account, so an admin can check who a
// relink will go to: { subject, dn }, null when no single entry has it, undefined without a
// service account; throws when the directory can't be reached
async function findSubject(username, c = config(), createClient = newClient) {
  if (!c.bindDn || !c.searchBase) return undefined;
  const client = createClient(c);
  try {
    if (c.startTls) await client.startTLS(startTlsOptions(c));
    await bindService(client, c);
    const found = await findUser(client, c, stripDomain(String(username).normalize("NFKC").trim(), c));
    return found.entry ? { subject: subjectOf(found.entry, c), dn: found.entry.dn } : null;
  } finally {
    await client.unbind().catch(() => {});
  }
}

// Checks the settings at startup without anyone's password, so a wrong service account,
// certificate or search base shows in the log right away; returns what was checked
async function selfCheck(c = config(), createClient = newClient) {
  const client = createClient(c);
  const checked = [`connected to ${c.url}`];
  try {
    if (c.startTls) await client.startTLS(startTlsOptions(c));
    try {
      await client.search("", { scope: "base", filter: "(objectClass=*)", attributes: ["supportedLDAPVersion"] });
    } catch (err) {
      // The directory answered, it just won't show its root entry anonymously
      if (!(err instanceof ResultCodeError)) throw err;
    }
    if (c.bindDn) {
      await bindService(client, c);
      checked.push("the service account signed in");
    }
    // Without a service account, directories usually only allow searches once the person has signed in
    const bases = c.bindDn || !c.userDnTemplate ? [["LDAP_USER_SEARCH_BASE", c.searchBase], ["LDAP_GROUP_SEARCH_BASE", c.groupSearchBase]] : [];
    for (const [name, dn] of bases) {
      if (!dn) continue;
      try {
        await client.search(dn, { scope: "base", filter: "(objectClass=*)", attributes: ["objectClass"] });
      } catch (err) {
        err.message = `${name} (${dn}): ${err.message}`;
        throw err;
      }
      checked.push(`${name} exists`);
    }
  } finally {
    await client.unbind().catch(() => {});
  }
  return checked;
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
    let pem = null;
    try {
      pem = fs.readFileSync(c.ca, "utf8");
    } catch (err) {
      errors.push("LDAP_TLS_CA must be the path of a readable PEM file.");
    }
    if (pem != null && !pem.includes("-----BEGIN CERTIFICATE-----"))
      errors.push(
        "LDAP_TLS_CA isn't a PEM certificate (text starting with -----BEGIN CERTIFICATE-----). Convert a binary .cer file with: openssl x509 -inform der -in ca.cer -out ca.pem"
      );
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
    const startup = config();
    selfCheck(startup).then(
      (checked) => ctx.logger("info", `LDAP settings check passed: ${checked.join(", ")}.`, "Ldap"),
      (err) => ctx.logger("error", `LDAP settings check failed: ${explain(err)}`, "Ldap", null, err)
    );
    router.post("/login", ctx.authorize.public("LDAP directory login"), async (req, res) => {
      const c = config();
      const name = c.displayName;
      const body = req.body || {};
      if (!validUsername(body.username) || typeof body.password !== "string" || body.password === "")
        return res.status(400).send({ status: "failure", message: "Enter your username and password." });
      // NFKC, so fullwidth look-alikes the directory treats as the same person are also one account to MMGIS
      const username = stripDomain(body.username.normalize("NFKC").trim(), c);
      let identity;
      let reason = "";
      try {
        identity = await authenticate(username, body.password, c, newClient, (r) => (reason = r));
      } catch (err) {
        if (err instanceof PasswordExpiredError) {
          ctx.logger("warn", `LDAP login for '${username}' refused: password expired.`, "Ldap", req);
          // 403, not 401: the password was right, so it doesn't count toward AUTH_MAX_FAILED_LOGINS
          return res.status(403).send({ status: "failure", message: `Your ${name} password has expired. Change it, then sign in again.` });
        }
        ctx.logger("error", `LDAP login could not reach or read the directory: ${explain(err)}`, "Ldap", req, err);
        if (err.tooManyGroups)
          return res.status(503).send({
            status: "failure",
            message: `MMGIS can't read all of your ${name} groups. Ask an administrator to raise the directory's size limit.`,
          });
        return res.status(503).send({ status: "failure", message: `${name} is unavailable. Try again later.` });
      }
      // 401 so failed attempts count towards the rate limit
      if (!identity) {
        ctx.logger("warn", `LDAP login for '${username}' refused: ${reason}.`, "Ldap", req);
        return res.status(401).send({ status: "failure", message: `Invalid ${name} username or password.` });
      }
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
  // Group DNs are matched in the form groupsOf reports them
  groupName: (name) => (!config().groupNameAttribute && name.includes("=") ? normalizeDn(name.trim()) : name),
  lookup: (subject) => lookup(subject),
  findSubject: (username) => findSubject(username),
  validate,
  warnings,
  // For tests
  _internal: { config, stripDomain, escapeFilter, escapeDn, normalizeDn, guidString, subjectFilter, authenticate, lookup, findSubject, selfCheck, explain, PasswordExpiredError },
};
