const winston = require("winston");
const moment = require("moment");
var os = require("os");
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
    "X-Amzn-Trace-Id": "Root = 1 - 67891233 - abcdef012345678912345678",
    user: body.user || "HOST"
  });
});

const logger = winston.createLogger({
  level: "info",
  //format: cs3Format,
  defaultMeta: { user: "HOST" },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({
      filename: __dirname + "/logs/error.log",
      level: "error"
    }),
    new winston.transports.File({ filename: __dirname + "/logs/combined.log" })
  ]
});

module.exports = logger;
