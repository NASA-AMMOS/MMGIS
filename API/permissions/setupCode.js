/**
 * One-time setup code that gates creating the first account on an empty site.
 *
 * While no accounts exist, the server prints a random code to its log and
 * /api/users/first_signup only succeeds when that code is supplied, so only
 * someone who can read the server's output can claim the first SuperAdmin.
 * Only a hash of the code is kept, it is consumed on first successful use and
 * a restart prints a fresh one. SETUP_CODE lets deployers provide the code
 * themselves (scripted installs, several replicas behind one URL).
 */
const crypto = require("crypto");

// Crockford-style alphabet: no 0/O, 1/I/L confusion when copying from a log
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // pragma: allowlist secret
const GROUPS = 4;
const GROUP_LEN = 4;
const RULE =
  "================================================================";

let currentHash = null;

function normalize(code) {
  return String(code == null ? "" : code)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

function hash(code) {
  return crypto.createHash("sha256").update(normalize(code)).digest();
}

function generate() {
  const groups = [];
  for (let g = 0; g < GROUPS; g++) {
    let s = "";
    for (let i = 0; i < GROUP_LEN; i++)
      s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    groups.push(s);
  }
  return groups.join("-");
}

function fromEnv() {
  const v = process.env.SETUP_CODE;
  return typeof v === "string" && normalize(v).length > 0 ? v : null;
}

function announce(code) {
  const out = [
    "",
    RULE,
    "  MMGIS has no accounts yet.",
    "  Open /configure and create the first (SuperAdmin) account",
    code
      ? `  with this one-time setup code:  ${String(code).replace(/[\r\n]/g, "")}`
      : "  with the setup code from the SETUP_CODE environment variable.",
    RULE,
    "",
  ].join("\n");
  // Printed straight to stdout rather than through the logger so it is never
  // written to the persistent log files.
  console.log(out);
}

// Issue a code if none is active. Returns true when a new one was printed.
function ensure() {
  if (currentHash) return false;
  const env = fromEnv();
  if (env) {
    currentHash = hash(env);
    announce(null);
  } else {
    const code = generate();
    currentHash = hash(code);
    announce(code);
  }
  return true;
}

function isActive() {
  return currentHash != null;
}

// Constant-time check; a correct code is consumed so it can only be used once.
function consume(code) {
  if (!currentHash || normalize(code).length === 0) return false;
  const ok = crypto.timingSafeEqual(hash(code), currentHash);
  if (ok) currentHash = null;
  return ok;
}

function clear() {
  currentHash = null;
}

module.exports = { ensure, consume, clear, isActive, normalize, generate };
