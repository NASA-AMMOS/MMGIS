const logger = require("./logger");
const fetch = require("node-fetch");

const test = (setupEnvs, port) => {
  let envSample = {
    SERVER: process.env.SERVER,
    PORT: port,
    AUTH: process.env.AUTH,
    NODE_ENV: process.env.NODE_ENV,
    SECRET: process.env.SECRET ? "_redacted_" : null,
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING || false,
    ALLOW_EMBED: process.env.ALLOW_EMBED || false,
    DISABLE_LINK_SHORTENER: process.env.DISABLE_LINK_SHORTENER || false,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS ? "_redacted_" : null,
    HIDE_CONFIG: process.env.HIDE_CONFIG || false,
    FORCE_CONFIG_PATH: process.env.FORCE_CONFIG_PATH || "",
    CSSO_GROUPS: process.env.CSSO_GROUPS || [],
    CSSO_LEAD_GROUP: process.env.CSSO_LEAD_GROUP || "",
    LEADS: process.env.LEADS || [],
  };

  // include setupEnvs
  for (let e in setupEnvs) {
    if (envSample[e] == null) {
      envSample[e] = process.env[e] || (setupEnvs[e].required ? null : "");
      if (process.env[e] && setupEnvs[e].private) envSample[e] = "_redacted_";
    } else {
      logger("warn", "ENV variable name duplicated: " + e, "testEnv");
    }
  }

  logger("info", envSample, "testEnv");

  for (let e in envSample) {
    if (envSample[e] == null)
      logger("warn", "The following env variable is null: " + e, "testEnv");
    else if (envSample[e] == "")
      logger("info", "The following env variable is empty: " + e, "testEnv");
    else if (e.indexOf("HOST") != -1 && envSample[e].substr(0, 4) === "http") {
      let target = envSample[e];
      fetch(target, {
        method: "HEAD",
      })
        .then((res) => {
          if (res.status >= 200 && res.status <= 299) {
            logger(
              "info",
              target + ": Alive and Well (" + res.status + ")",
              "testEnv"
            );
          } else if (res.status == 404) {
            logger(
              "error",
              target + ": Not found (" + res.status + ")",
              "testEnv"
            );
          } else {
            logger(
              "info",
              target + ": Alive but possibly Unwell (" + res.status + ")",
              "testEnv"
            );
          }
        })
        .catch((err) => {
          logger(
            "error",
            "Could not connect to: " + target,
            "testEnv",
            null,
            err
          );
        });
    }
  }
};

module.exports = { test };
