// LDAP directory login. The shared username/password form (login page, Configure
// sign-in, in-app modal) posts to /api/auth/ldap/login. MMGIS finds the person's
// entry (searching as a service account or anonymously, or from a DN template),
// checks the password by binding as that entry, then links the MMGIS account by a
// stable id and syncs the person's directory groups.
const fs = require("fs");
const net = require("net");
const { Client, InvalidCredentialsError, SizeLimitExceededError, NoSuchObjectError, InvalidDNSyntaxError, ResultCodeError } = require("ldapts");

const setting = (v, fallback = "") => (v != null && String(v).trim() !== "" ? String(v).trim() : fallback);
const isTrue = (v) => String(v).trim().toLowerCase() === "true";
const MAX_USERNAME = 255;

// dn is how groups are reported without it
const groupNameAttribute = (v) => (/^dn$/i.test(v) ? "" : v);

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
    groupNameAttribute: groupNameAttribute(setting(env.LDAP_GROUP_NAME_ATTRIBUTE)),
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
// reads the same however the directory spaces, capitalizes, escapes (\, and \2c alike) or composes it (é)
// dn is inside base: it ends with ",base" at an unescaped comma (normalizeDn escapes "\\" as "\\\\")
function underBase(dn, base) {
  if (!dn.endsWith(`,${base}`)) return false;
  return dn.slice(0, dn.length - base.length - 1).match(/\\*$/)[0].length % 2 === 0;
}

function normalizeDn(dn) {
  const s = String(dn);
  const rdns = [];
  let avas = [];
  let type = null;
  let bytes = [];
  const text = (str) => bytes.push(...Buffer.from(str, "utf8"));
  const endAva = () => {
    const value = Buffer.from(bytes).toString("utf8").normalize("NFC").trim().toLowerCase();
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
  if (Buffer.isBuffer(v)) {
    if (v.length === 16 && /^objectguid$/i.test(c.subjectAttribute)) return guidString(v);
    // Rechecks would search for the hex as text, find nothing and sign everyone out
    if (!isBinaryAttribute(c.subjectAttribute))
      throw new Error(`LDAP_SUBJECT_ATTRIBUTE ${c.subjectAttribute} holds binary values, which MMGIS can't search for again at rechecks. Use entryUUID, or objectGUID on Active Directory.`);
    return v.toString("hex");
  }
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

// Active Directory's "account disabled" flag and expiry, OpenLDAP ppolicy's administrative lock, 389 DS / FreeIPA's lock
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
  // Only ppolicy's administrative lock: a timestamp is a lockout after failed passwords, which ends by itself
  values(entry, "pwdAccountLockedTime").some((v) => String(v) === "000001010000Z") ||
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
// The directory answered, but this person's entry lacks something MMGIS needs
class UnusableEntryError extends Error {}

// Wrong passwords per directory entry, so every name that reaches one entry (uid, mail, UPN) shares one
// AUTH_MAX_FAILED_LOGINS allowance, and nobody else's typos count against it. Kept in this process's memory.
// A locked entry gets the same answer as a wrong password, so the lock doesn't reveal that the name exists.
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const entryFailures = new Map();
const failureLimit = () => {
  const n = parseInt(process.env.AUTH_MAX_FAILED_LOGINS, 10);
  return Number.isInteger(n) && n > 0 ? n : 5;
};
function entryLocked(dn) {
  const f = entryFailures.get(normalizeDn(dn));
  return f && f.until > Date.now() && f.count >= failureLimit()
    ? `${dn} had ${f.count} wrong passwords in the last 15 minutes (AUTH_MAX_FAILED_LOGINS), so the password wasn't tried`
    : null;
}
function entryFailed(dn) {
  const now = Date.now();
  if (entryFailures.size > 10000) for (const [k, f] of entryFailures) if (f.until <= now) entryFailures.delete(k);
  const key = normalizeDn(dn);
  const f = entryFailures.get(key);
  entryFailures.set(key, f && f.until > now ? { count: f.count + 1, until: f.until } : { count: 1, until: now + FAILURE_WINDOW_MS });
}

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
// Until a service password is known to work, one bind tries it and concurrent callers wait for that
// result, so a burst of logins or rechecks can't send the directory several wrong passwords at once
const trustedServiceAccounts = new Map();
const serviceProbes = new Map();

// Adds what to check to a connection or search error, for the server log
function explain(err) {
  const msg = String((err && err.message) || err);
  const text = `${(err && err.code) || ""} ${msg}`;
  if (/CERT_HAS_EXPIRED|CERT_NOT_YET_VALID|certificate has expired|certificate is not yet valid/i.test(text))
    return `${msg}. The directory's TLS certificate is outside its validity dates; the directory admins need to renew it (changing LDAP_TLS_CA won't help).`;
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|local issuer|ALTNAME/i.test(text))
    return `${msg}. The directory's TLS certificate isn't trusted: set LDAP_TLS_CA to the CA that signed it, and use the host name on the certificate in LDAP_URL.`;
  if (/ECONNREFUSED/.test(text)) return `${msg}. Nothing answered at LDAP_URL: check the host and port (ldaps:// is usually 636, ldap:// 389).`;
  if (/ENOTFOUND|EAI_AGAIN/.test(text)) return `${msg}. LDAP_URL's host name doesn't resolve.`;
  if (/wrong version number|ECONNRESET|packet length/i.test(text))
    return `${msg}. Check that ldaps:// points at the TLS port (usually 636) and ldap:// at the plain port (389, with LDAP_STARTTLS=true).`;
  if (/ExtendedRequest/.test(text))
    return `${msg}. The directory closed the connection at StartTLS: LDAP_STARTTLS=true needs ldap:// at the plain port (usually 389); for the TLS port (636) use ldaps:// without LDAP_STARTTLS.`;
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
  for (;;) {
    const rejected = rejectedServiceAccounts.get(key);
    // Keyed on the password too, so a new password is tried at once (a probe of the old one isn't awaited)
    if (rejected && rejected.password === c.bindPassword && Date.now() - rejected.at < SERVICE_RETRY_MS)
      throw new Error("The directory rejected LDAP_BIND_DN / LDAP_BIND_PASSWORD; MMGIS retries it at most every 5 minutes so the account isn't locked.");
    if (trustedServiceAccounts.get(key) === c.bindPassword) break;
    const probe = serviceProbes.get(key);
    if (!probe || probe.password !== c.bindPassword) break;
    // A probe that couldn't reach the directory fails its waiters the same way, rather than releasing them all to bind at once
    const result = await probe.done;
    if (result.outcome === "error") throw result.err;
  }
  const probing = trustedServiceAccounts.get(key) !== c.bindPassword && !serviceProbes.has(key);
  let finish = () => {};
  if (probing) serviceProbes.set(key, { password: c.bindPassword, done: new Promise((r) => (finish = r)) });
  let outcome = "error";
  let failure;
  try {
    let bind;
    try {
      bind = await bindAs(client, c.bindDn, c.bindPassword);
    } catch (err) {
      // The service account's password, not the person's, so it mustn't read as theirs having expired
      if (!(err instanceof PasswordExpiredError)) throw err;
      bind = { ok: false, reason: "LDAP_BIND_DN's password has expired" };
    }
    if (!bind.ok) {
      outcome = "rejected";
      trustedServiceAccounts.delete(key);
      rejectedServiceAccounts.set(key, { at: Date.now(), password: c.bindPassword });
      throw new Error(`The directory rejected LDAP_BIND_DN / LDAP_BIND_PASSWORD (${bind.reason}). MMGIS won't retry it for 5 minutes so the account isn't locked.`);
    }
    outcome = "ok";
    trustedServiceAccounts.set(key, c.bindPassword);
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    if (probing) {
      serviceProbes.delete(key);
      finish({ outcome, err: failure });
    }
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
async function groupsOf(client, c, entry, username, leftOut = []) {
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
  // A group without LDAP_GROUP_NAME_ATTRIBUTE is left out: Users & Access only takes names in that mode
  return searchEntries.flatMap((g) => {
    if (!c.groupNameAttribute) return [normalizeDn(g.dn)];
    const name = values(g, c.groupNameAttribute)[0];
    if (name == null) leftOut.push(normalizeDn(g.dn));
    return name != null ? [String(name).normalize("NFC")] : [];
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
      if (entryLocked(dn)) return refuse(entryLocked(dn));
      const bind = await bindAs(client, dn, password);
      if (!bind.ok) entryFailed(dn);
      else entryFailures.delete(normalizeDn(dn));
      if (!bind.ok) return refuse(`${bind.reason} for ${dn} (if nobody can sign in, check LDAP_USER_DN_TEMPLATE)`);
      const found = c.searchBase ? await findUser(client, c, username) : { entry: await readEntry(client, c, dn) };
      entry = found.entry;
      // Someone LDAP_USER_SEARCH_FILTER leaves out is refused like in search mode, not told the directory is down
      if (!entry && found.reason) return refuse(`${found.reason}, though the password for ${dn} was accepted`);
      if (!entry) throw new Error("Signed in to the directory but could not read the person's entry.");
      // The password was checked for dn, so the identity must come from that same entry
      if (!isBoundEntry(entry, dn))
        return refuse(
          `the password is right for ${dn}, but LDAP_USER_SEARCH_FILTER found a different entry, ${entry.dn} (make LDAP_USER_DN_TEMPLATE and LDAP_USER_SEARCH_FILTER name the same attribute)`
        );
      // Groups are read as the service account, as at rechecks, where people may not read the group OU
      if (c.bindDn) await bindService(client, c);
    } else {
      if (c.bindDn) await bindService(client, c);
      const found = await findUser(client, c, username);
      if (!found.entry) return refuse(found.reason);
      entry = found.entry;
      if (entryLocked(entry.dn)) return refuse(entryLocked(entry.dn));
      const bind = await bindAs(client, entry.dn, password);
      if (!bind.ok) entryFailed(entry.dn);
      else entryFailures.delete(normalizeDn(entry.dn));
      if (!bind.ok) return refuse(`${bind.reason} for ${entry.dn}`);
      // Group searches run as the service account, as the user search did
      if (c.groupSearchBase && c.bindDn) await bindService(client, c);
    }
    const subject = subjectOf(entry, c);
    if (!subject) throw new UnusableEntryError(`${entry.dn} has no ${c.subjectAttribute} (LDAP_SUBJECT_ATTRIBUTE).`);
    const name = values(entry, c.usernameAttribute)[0];
    const email = values(entry, c.emailAttribute)[0];
    const groupsLeftOut = [];
    return {
      subject,
      username: name != null ? String(name) : username,
      email: email != null ? String(email) : undefined,
      // The directory's username, as at recheck, so group filters don't depend on how it was typed
      groups: await groupsOf(client, c, entry, name != null ? String(name) : "", groupsLeftOut),
      groupsLeftOut,
    };
  } finally {
    await client.unbind().catch(() => {});
  }
}

// LDAP_USER_SEARCH_FILTER for anyone, so a recheck drops whoever the filter no longer lets sign in. A
// negated {{username}} term says nothing about anyone, and in an extensible (uid:caseExactMatch:=) or
// ~= <= >= term a * isn't a wildcard, so that term becomes (uid=*).
const PLACEHOLDER_TERM = String.raw`\(([A-Za-z0-9.;-]*)(?::[^()=]*)?(?::=|~=|<=|>=|=)[^()]*\{\{username\}\}[^()]*\)`;
const peopleFilter = (c) =>
  fill(
    c.searchFilter
      .replace(new RegExp(String.raw`\(!\s*${PLACEHOLDER_TERM}\s*\)`, "g"), "(objectClass=*)")
      .replace(/\(([A-Za-z0-9.;-]*)(?::[^()=]*)?(?::=|~=|<=|>=)[^()]*\{\{username\}\}[^()]*\)/g, (_, attr) => (attr ? `(${attr}=*)` : "(objectClass=*)")),
    { username: "*" }
  ).replace(/\*{2,}/g, "*");

// With LDAP_SUBJECT_ATTRIBUTE=dn, a stored subject that isn't a DN (one saved under entryUUID/objectGUID
// before the setting changed) names no entry
const notADn = (subject) => !/^[^=,]+=/.test(String(subject));
const noDnEntry = (err) => err instanceof NoSuchObjectError || err instanceof InvalidDNSyntaxError;

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
    const byDn = c.subjectAttribute.toLowerCase() === "dn";
    if (byDn && notADn(subject)) return null;
    let entries;
    try {
      ({ searchEntries: entries } =
        byDn
          ? await client.search(subject, { scope: "base", filter: peopleFilter(c), attributes, explicitBufferAttributes })
          : await client.search(c.searchBase, { scope: "sub", filter: `(&${subjectFilter(c, subject)}${peopleFilter(c)})`, attributes, explicitBufferAttributes, sizeLimit: 2 }));
    } catch (err) {
      if (byDn ? noDnEntry(err) : err instanceof NoSuchObjectError) return null;
      throw err;
    }
    if (entries.length !== 1 || accountDisabled(entries[0])) return null;
    const entry = entries[0];
    const name = values(entry, c.usernameAttribute)[0];
    const email = values(entry, c.emailAttribute)[0];
    const groupsLeftOut = [];
    return {
      subject,
      username: name != null ? String(name) : undefined,
      email: email != null ? String(email) : undefined,
      groups: await groupsOf(client, c, entry, name != null ? String(name) : "", groupsLeftOut),
      groupsLeftOut,
    };
  } finally {
    await client.unbind().catch(() => {});
  }
}

// The directory root LDAP_USER_SEARCH_BASE sits in (its dc= suffix), which also holds moved-out entries
function directoryRoot(base) {
  const rdns = String(base).split(/(?<!\\),/).map((r) => r.trim());
  const i = rdns.findIndex((r, k) => rdns.slice(k).every((x) => /^dc=/i.test(x)));
  return i > 0 ? rdns.slice(i).join(",") : base;
}

// Where locate searches: the dc= suffix of LDAP_USER_SEARCH_BASE, else the directory's naming context
// that holds it (e.g. o=corp); null when neither is known
async function searchRoot(client, c) {
  const root = directoryRoot(c.searchBase);
  if (root !== c.searchBase) return root;
  const { searchEntries } = await client.search("", { scope: "base", filter: "(objectClass=*)", attributes: ["namingContexts"] });
  const base = normalizeDn(c.searchBase);
  const holding = values(searchEntries[0] || {}, "namingContexts")
    .map(String)
    .filter((n) => base === normalizeDn(n) || base.endsWith(`,${normalizeDn(n)}`))
    .sort((a, b) => a.length - b.length);
  return holding[0] || null;
}

// Whether an entry with this subject still exists anywhere in the directory, even disabled or moved
// out of LDAP_USER_SEARCH_BASE (e.g. to a leavers' OU): { dn, username }, null when it doesn't,
// undefined without a service account; throws when the directory can't be reached or searched from the root
async function locate(subject, c = config(), createClient = newClient) {
  if (!c.bindDn || !c.searchBase) return undefined;
  const attributes = [c.usernameAttribute];
  const client = createClient(c);
  try {
    if (c.startTls) await client.startTLS(startTlsOptions(c));
    await bindService(client, c);
    const byDn = c.subjectAttribute.toLowerCase() === "dn";
    if (byDn && notADn(subject)) return null;
    const root = byDn ? null : await searchRoot(client, c);
    if (!byDn && !root) throw new Error("No naming context in the directory's root DSE holds LDAP_USER_SEARCH_BASE, so MMGIS can't search outside it.");
    let entries;
    try {
      ({ searchEntries: entries } =
        byDn
          ? await client.search(subject, { scope: "base", filter: "(objectClass=*)", attributes })
          : await client.search(root, { scope: "sub", filter: subjectFilter(c, subject), attributes, sizeLimit: 2 }));
    } catch (err) {
      if (byDn && noDnEntry(err)) return null;
      // Several entries with this subject: it still exists, however ambiguously
      if (err instanceof SizeLimitExceededError) return {};
      // e.g. a service account that can't read the root, which says nothing about the entry
      throw err;
    }
    if (entries.length === 0) return null;
    const name = values(entries[0], c.usernameAttribute)[0];
    return { dn: entries[0].dn, username: name != null ? String(name) : undefined };
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
  checked.warnings = [];
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
    // A misspelled subject or username attribute passes everything above and then fails every sign-in
    if (c.bindDn && c.searchBase) {
      const anyMatch = async (filter) => {
        try {
          const { searchEntries } = await client.search(c.searchBase, { scope: "sub", filter, attributes: ["1.1"], sizeLimit: 1 });
          return searchEntries.length > 0;
        } catch (err) {
          if (err instanceof SizeLimitExceededError) return true;
          if (err instanceof ResultCodeError) return undefined;
          throw err;
        }
      };
      const people = peopleFilter(c);
      if (await anyMatch(people))
        for (const [name, attr, effect] of [
          ["LDAP_SUBJECT_ATTRIBUTE", c.subjectAttribute, "every LDAP sign-in will fail"],
          ["LDAP_USERNAME_ATTRIBUTE", c.usernameAttribute, "each new MMGIS account is named (for good) by how its person typed their first sign-in"],
        ]) {
          if (attr.toLowerCase() === "dn") continue;
          if ((await anyMatch(`(&${people}(${attr}=*))`)) === false)
            checked.warnings.push(`no entry that LDAP_USER_SEARCH_FILTER finds under LDAP_USER_SEARCH_BASE has the attribute ${attr} (${name}), so ${effect}. Check its spelling.`);
        }
    }
    // locate(subject) searches from there, so a leaver moved out of LDAP_USER_SEARCH_BASE still counts
    const root = c.bindDn && c.searchBase && c.subjectAttribute.toLowerCase() !== "dn" ? await searchRoot(client, c).catch(() => null) : undefined;
    if (root === null)
      checked.warnings.push(
        `LDAP_USER_SEARCH_BASE (${c.searchBase}) has no dc= suffix and the directory names no naming context holding it, so MMGIS can't tell whether a person moved out of it still exists, and refuses relinks to a different entry.`
      );
    else if (root)
      try {
        await client.search(root, { scope: "base", filter: "(objectClass=*)", attributes: ["objectClass"] });
        checked.push(`the directory root ${root} is readable`);
      } catch (err) {
        if (!(err instanceof ResultCodeError)) throw err;
        checked.warnings.push(
          `the service account can't search the directory root ${root} (${err.message}), so MMGIS can't tell whether a person moved out of LDAP_USER_SEARCH_BASE still exists, and refuses relinks to a different entry. Give it read access to the whole directory.`
        );
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
    errors.push(
      /[\s,]/.test(String(c.url || "").trim())
        ? "LDAP_URL must be a single ldap:// or ldaps:// URL; MMGIS doesn't fail over between directory hosts."
        : "LDAP_URL must be set to the directory's address, e.g. ldaps://ldap.example.org:636."
    );
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
  if (c.userDnTemplate && c.userDnTemplate.includes("\\{{username}}"))
    errors.push(
      "LDAP_USER_DN_TEMPLATE can't be DOMAIN\\{{username}}: MMGIS has to find the entry it signed in as. Use the UPN form ({{username}}@corp.example.org) with LDAP_USER_SEARCH_BASE, or a DN; LDAP_USERNAME_DOMAIN lets people still type DOMAIN\\name."
    );
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
  if (c.bindDn && !c.searchBase)
    out.push(
      "LDAP_BIND_DN is set without LDAP_USER_SEARCH_BASE, so MMGIS can't look people up between logins: sessions and tokens aren't rechecked (changes apply at the next login) and relinks match on the username alone. Set LDAP_USER_SEARCH_BASE to turn both on."
    );
  if (c.groupNameAttribute && !c.groupSearchBase)
    out.push(`LDAP_GROUP_NAME_ATTRIBUTE=${c.groupNameAttribute} has no effect without LDAP_GROUP_SEARCH_BASE: groups read from ${c.groupsAttribute} are reported by their full DN.`);
  if (!/^(dn|entryuuid|objectguid|objectsid|nsuniqueid|ipauniqueid|guid)$/i.test(c.subjectAttribute))
    out.push(
      `LDAP_SUBJECT_ATTRIBUTE=${c.subjectAttribute} isn't a permanent entry ID: if it changes (a rename, a new email address), that person's next sign-in creates a new, empty MMGIS account instead of using theirs, and whoever is later given the old value signs in as that account. Prefer entryUUID or objectGUID.`
    );
  if (c.subjectAttribute.toLowerCase() === "dn")
    out.push(
      "LDAP_SUBJECT_ATTRIBUTE=dn: a person's DN changes when they are renamed or moved, which then creates a new MMGIS account, and whoever is later given a leaver's DN signs in as the leaver's account, roles and drawings included. Prefer entryUUID or objectGUID."
    );
  return out;
}

module.exports = {
  // A lookup is up to five directory operations (connect, TLS, service bind, user and group search)
  lookupTimeoutMs: () => 5 * config().timeoutMs,
  // A DN stored before a switch to entryUUID/objectGUID, or an ID stored before a switch to dn
  subjectFits: (subject) => (config().subjectAttribute.toLowerCase() === "dn") !== notADn(subject),
  routes(router, ctx) {
    const startup = config();
    selfCheck(startup).then(
      (checked) => {
        ctx.logger("info", `LDAP settings check passed: ${checked.join(", ")}.`, "Ldap");
        for (const w of checked.warnings) ctx.logger("warn", `LDAP settings check: ${w}`, "Ldap");
      },
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
        if (err instanceof UnusableEntryError) {
          ctx.logger("warn", `LDAP login for '${username}' refused: ${err.message}`, "Ldap", req);
          return res.status(403).send({ status: "failure", message: `Your ${name} entry can't be used with MMGIS. Ask an administrator.` });
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
          `${user.username} logged in with LDAP. Directory groups: ${identity.groups.length ? identity.groups.join(" | ") : "none"}.${
            identity.groupsLeftOut && identity.groupsLeftOut.length
              ? ` Left out, having no ${config().groupNameAttribute} (LDAP_GROUP_NAME_ATTRIBUTE): ${identity.groupsLeftOut.join(" | ")}.`
              : ""
          }`,
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
  // Group DNs are matched in the form groupsOf reports them; a plain name would never match one
  groupName: (name) => {
    const c = config();
    if (c.groupNameAttribute && c.groupSearchBase) {
      const rdn = new RegExp(`^\\s*(cn|ou|o|dc|uid|${c.groupNameAttribute.replace(/[^\w.-]/g, "")})\\s*=`, "i");
      if (/^\s*[A-Za-z][\w.-]*=[^,]*[^\\],\s*[A-Za-z][\w.-]*=/.test(name) || rdn.test(name))
        throw new Error(
          `LDAP_GROUP_NAME_ATTRIBUTE=${c.groupNameAttribute} reports groups by their ${c.groupNameAttribute}, not their DN, so enter just the group's ${c.groupNameAttribute} (e.g. science-team), as listed under "Directory groups" in the server log at each LDAP sign-in.`
        );
      return name.normalize("NFC").trim();
    }
    if (!name.includes("="))
      throw new Error(
        `LDAP reports groups by DN, so enter the group's DN (e.g. cn=${name.trim() || "science-team"},ou=groups,dc=example,dc=org), as listed under "Directory groups" in the server log at each LDAP sign-in.`
      );
    const dn = normalizeDn(name.trim());
    // Groups are only searched for under LDAP_GROUP_SEARCH_BASE, so one elsewhere would never have members
    const base = c.groupSearchBase && normalizeDn(c.groupSearchBase);
    if (base && dn !== base && !underBase(dn, base))
      throw new Error(`MMGIS only finds groups under LDAP_GROUP_SEARCH_BASE (${c.groupSearchBase}), so ${dn} would never have members. Widen LDAP_GROUP_SEARCH_BASE to include it.`);
    return dn;
  },
  // The username as login reads it, so a relink typed as CORP\\alice waits for alice
  relinkUsername: (name) => stripDomain(String(name).normalize("NFKC").trim(), config()),
  resetFailures: ({ username, dn }) => {
    const c = config();
    // Direct bind counts under the filled template (e.g. alice@corp.example.org), search mode under the entry DN
    if (dn) entryFailures.delete(normalizeDn(dn));
    if (c.userDnTemplate && username) entryFailures.delete(normalizeDn(fill(c.userDnTemplate, { username: escapeDn(username) })));
  },
  lookup: (subject) => lookup(subject),
  locate: (subject) => locate(subject),
  findSubject: (username) => findSubject(username),
  validate,
  warnings,
  // For tests
  _internal: { config, stripDomain, escapeFilter, escapeDn, normalizeDn, guidString, subjectFilter, authenticate, lookup, locate, directoryRoot, findSubject, selfCheck, explain, PasswordExpiredError, UnusableEntryError, entryFailures, peopleFilter },
};
