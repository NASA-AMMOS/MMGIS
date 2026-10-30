// Constants and helpers shared by the connection modules
const logger = require("../logger");

const DOCS_URL = "https://nasa-ammos.github.io/MMGIS/contributing/connections";
const STATE_TTL_MS = 10 * 60 * 1000;
// Sign-ins in progress per browser session (several tabs can each be connecting)
const MAX_PENDING_STATES = 20;
// Refresh tokens this close to expiring
const REFRESH_EARLY_MS = 60 * 1000;
// A plugin hook that doesn't settle in time fails, so a request never hangs on it
const HOOK_TIMEOUT_MS = 20 * 1000;
// How long a request with a still-valid token waits for an early refresh
const STILL_VALID_WAIT_MS = 2 * 1000;

function withTimeout(promiseOrValue, what, ms = HOOK_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    Promise.resolve(promiseOrValue),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${what} timed out`), { code: "ETIMEDOUT" })), ms);
      if (timer.unref) timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

class ConnectionRequiredError extends Error {
  constructor(service, reason, message) {
    super(message || `Connect ${service} to continue.`);
    this.service = service;
    this.reason = reason;
  }
}


const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

// A refresh() failure worth retrying later (network, 429, 5xx); anything else means the grant is no good
function isTransient(err) {
  if (!err) return false;
  if (typeof err.transient === "boolean") return err.transient;
  const status = Number(err.status || err.statusCode || (err.response && err.response.status));
  if (status === 429 || status >= 500) return true;
  const code = err.code || (err.cause && err.cause.code);
  if (TRANSIENT_CODES.has(code)) return true;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  return err.name === "TypeError" && /fetch failed/i.test(err.message || "");
}

const errText = (err) => (err && err.message ? String(err.message).slice(0, 200) : String(err));

// A plugin's error with known secrets (codes, tokens, client secrets) taken out, for logging
// The plugin's own env values, plus anything that looks like a credential
const SECRET_NAME = /SECRET|PASSW|PASS$|PWD|TOKEN|APIKEY|(^|_)KEYS?($|_)|CREDENTIAL|PRIVATE/i;
const envSecrets = (c, env = process.env) => [
  ...c.env.map((n) => env[n]),
  ...Object.keys(env)
    .filter(
      (n) =>
        SECRET_NAME.test(n) &&
        typeof env[n] === "string" &&
        env[n].length >= 6 &&
        !/^(true|false|\d+)$/i.test(env[n])
    )
    .map((n) => env[n]),
];
function scrubbed(err, secrets) {
  const values = secrets.filter((v) => typeof v === "string" && v.length >= 4);
  const clean = (str) =>
    logger.redactCredentials(values.reduce((out, v) => out.split(v).join("_redacted_"), String(str == null ? "" : str)));
  if (!(err instanceof Error)) return err == null ? err : clean(typeof err === "string" ? err : JSON.stringify(err));
  const e = new Error(clean(err.message));
  e.name = err.name;
  e.stack = clean(err.stack);
  return e;
}

module.exports = {
  DOCS_URL,
  STATE_TTL_MS,
  MAX_PENDING_STATES,
  REFRESH_EARLY_MS,
  HOOK_TIMEOUT_MS,
  STILL_VALID_WAIT_MS,
  withTimeout,
  ConnectionRequiredError,
  TRANSIENT_CODES,
  isTransient,
  errText,
  envSecrets,
  scrubbed,
};
