require("dotenv").config();
const logger = require("../API/logger");
const { spawn } = require("child_process");

function adjacentServers() {
  const IS_WINDOWS = /^win/i.test(process.platform) ? true : false;
  const EXT = IS_WINDOWS ? ".bat" : ".sh";
  const CMD = IS_WINDOWS ? "" : "sh ";

  const adjacentServers = [
    {
      name: "stac",
      command: `cd adjacent-servers/stac/ && ${CMD}start-stac${EXT}`,
      port: process.env.STAC_PORT || 8881,
      env: "WITH_STAC",
    },
    {
      name: "tipg",
      command: `cd adjacent-servers/tipg/ && ${CMD}start-tipg${EXT}`,
      port: process.env.TIPG_PORT || 8882,
      env: "WITH_TIPG",
    },
    {
      name: "titiler",
      command: `cd adjacent-servers/titiler/ && ${CMD}start-titiler${EXT}`,
      port: process.env.TITILER_PORT || 8883,
      env: "WITH_TITILER",
    },
    {
      name: "titiler-pgstac",
      command: `cd adjacent-servers/titiler-pgstac/ && ${CMD}start-titiler-pgstac${EXT}`,
      port: process.env.TITILER_PGSTAC_PORT || 8884,
      env: "WITH_TITILER_PGSTAC",
    },
  ];

  const serverProcesses = [];
  adjacentServers.forEach((s) => {
    if (process.env[s.env] === "true") {
      logger(
        "info",
        `Starting ${s.name} server on port ${s.port}...`,
        "adjacent-servers"
      );
      let cmd = spawn(s.command, [s.port], { shell: true });
      serverProcesses.push(cmd);

      cmd.stdout.on("data", (data) => {
        if (`${data}`.indexOf("running") != -1)
          process.stdout.write(`${s.name} - ${data}`);
      });

      cmd.stderr.on("data", (data) => {
        if (`${data}`.indexOf("running") != -1)
          process.stdout.write(`${s.name} - ${data}`);
      });

      cmd.on("error", (err) => {
        process.stdout.write(`${s.name} ERROR - ${err}`);
        logger("error", `[${s.name}] ${err}`, "adjacent-servers");
      });
    }
  });
}

module.exports = adjacentServers;
