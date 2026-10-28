const winston = require("winston");
const util = require("util");
const moment = require("moment");
var os = require("os");
const chalk = require("chalk");
const { combine, timestamp, label, printf } = winston.format;

const hostname = os.hostname();
const cs3Format = printf(({ level, body, label, timestamp, a, b, c }) => {
  //console.log(level, body, label);
  if (typeof body === "string" || body == null) body = { message: body };
  return JSON.stringify({
    level: level,
    ts: timestamp,
    caller: "build/csso_proxy.go:144",
    msg: body.message,
    domain: hostname,
    sessionID: "d2aaf94b-2893-42a8-b0a0-b186129d7ed3",
    user: body.user || "HOST",
  });
});

const filelogger = winston.createLogger({
  level: "info",
  //format: cs3Format,
  defaultMeta: { user: "HOST" },
  transports: [
    new winston.transports.File({
      filename: __dirname + "/logs/error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: __dirname + "/logs/combined.log" }),
  ],
});

const SECRET_LOG_KEYS = new Set(["password", "token", "retypepassword"]);
function redactSecrets(key, value) {
  if (typeof key === "string" && SECRET_LOG_KEYS.has(key.toLowerCase()) && value != null)
    return "_redacted_";
  return value;
}

// Credentials that plugins and libraries put in error messages (URLs, headers, JSON)
function redactCredentials(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/\b(access_token|refresh_token|id_token|client_secret|code_verifier|code|password|token|api_?key)=[^\s&"',;]+/gi, "$1=_redacted_")
    .replace(/(["']?\b(?:access_token|refresh_token|id_token|client_secret|code_verifier|password|api_?key)["']?\s*:\s*["']?)[^\s"',}]+/gi, "$1_redacted_")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, "$1 _redacted_");
}

function sanitizeForLog(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\x1B\[[0-9;]*m/g, "").replace(/[\x00-\x08\x0B-\x1F\x7F]/g, " ");
}

const logger = function (level, message, caller, req, err) {
  let log = {
    level: level,
    ts: Date.now(),
    caller: caller || "server",
    msg: message,
    domain: req && req.headers && req.headers.host ? req.headers.host : "HOST",
    hostname: hostname,
    sessionID: req && req.cssoSessionID ? req.cssoSessionID : "HOST",
    internalSessionID: req && req.sessionID ? req.sessionID : "HOST",
    user: req && req.user ? req.user : "HOST",
  };

  try {
    let crop = 512;
    if (req && req.body) {
      let cleanBody = JSON.parse(JSON.stringify(req.body));
      if (cleanBody.password) {
        cleanBody.password = "_redacted_";
      }
      for (let k in cleanBody) {
        if (JSON.stringify(cleanBody[k]).length > crop)
          cleanBody[k] = "[Too Long...]";
      }
      if (Object.keys(cleanBody).length > 0) {
        log.req = log.req || {};
        log.req.body = cleanBody;
      }
    }
    if (req && req.query) {
      let cleanQuery = JSON.parse(JSON.stringify(req.query));
      if (cleanQuery.password) {
        cleanQuery.password = "_redacted_";
      }
      for (let k in cleanQuery) {
        if (JSON.stringify(cleanQuery[k]).length > crop)
          cleanQuery[k] = "[Too Long...]";
      }
      if (Object.keys(cleanQuery).length > 0) {
        log.req = log.req || {};
        log.req.query = cleanQuery;
      }
    }
    if (err) {
      log.err =
        err instanceof Error
          ? { name: err.name, message: redactCredentials(err.message), stack: redactCredentials(err.stack) }
          : err;
    }

    log.msg = sanitizeForLog(redactCredentials(log.msg));
    log.caller = sanitizeForLog(log.caller);
    log = JSON.stringify(log, redactSecrets);
  } catch (err2) {
    log.err = err2;
  }

  if (process.env.NODE_ENV === "development") {
    switch (level) {
      case "infrastructure_error":
        process.stdout.write(chalk.bgRedBright("\r " + level + " "));
        break;
      case "error":
        process.stdout.write(chalk.bgRed("\r " + level + " "));
        break;
      case "warn":
        process.stdout.write(chalk.black(chalk.bgYellow("\r " + level + " ")));
        break;
      case "success":
        process.stdout.write(
          chalk.black(chalk.bgGreenBright("\r " + level + " "))
        );
        break;
      case "loaded":
        process.stdout.write(
          chalk.white(chalk.bgHex("#a855f7")("\r " + level + " "))
        );
        break;
      default:
        process.stdout.write(
          chalk.black(chalk.bgHex("#009eff")("\r " + level + " "))
        );
    }
    if (message)
      console.log(
        " ",
        sanitizeForLog(
          typeof message === "string" ? message : util.inspect(message)
        ).replace(/\r/g, "").replace(/\n/g, "")
      );
    if (caller && level != "success" && level != "info" && level != "loaded")
      console.log(
        "   Caller:",
        sanitizeForLog(String(caller)).replace(/\r/g, "").replace(/\n/g, "")
      );
    if (err) console.log("   Error:", sanitizeForLog(err instanceof Error ? err.stack || String(err) : String(err)));
  } else {
    console.log(log);
  }

  switch (level) {
    case "infrastructure_error":
    case "error":
      filelogger.error(log);
      break;
    default:
      filelogger.info(log);
  }
};

module.exports = logger;
module.exports.redactSecrets = redactSecrets;
module.exports.redactCredentials = redactCredentials;
