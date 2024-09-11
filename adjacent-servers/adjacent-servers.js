require("dotenv").config();
const logger = require("../API/logger");
const { spawn } = require("child_process");

const IS_WINDOWS = /^win/i.test(process.platform) ? true : false;
const EXT = IS_WINDOWS ? ".bat" : ".sh";

const adjacentServers = [
  {
    name: "stac",
    command: `cd adjacent-servers/stac/ && start-stac${EXT}`,
    port: process.env.STAC_PORT || 8881,
    env: "WITH_STAC",
  },
  {
    name: "tipg",
    command: `cd adjacent-servers/tipg/ && start-tipg${EXT}`,
    port: process.env.TIPG_PORT || 8882,
    env: "WITH_TIPG",
  },
  {
    name: "titiler",
    command: `cd adjacent-servers/titiler/ && start-titiler${EXT}`,
    port: process.env.TITILER_PORT || 8883,
    env: "WITH_TITILER",
  },
  {
    name: "titiler-pgstac",
    command: `cd adjacent-servers/titiler-pgstac/ && start-titiler-pgstac${EXT}`,
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
    });
  }
});

let running = true;

function killProcess() {
  logger("info", `Terminating adjacent servers...`, "adjacent-servers");
  serverProcesses.forEach((process) => {
    process.kill();
  });
  logger(
    "success",
    `Successfully terminated all adjacent servers.`,
    "adjacent-servers"
  );
  running = false;
}

process.on("SIGTERM", killProcess);
process.on("SIGINT", killProcess);
process.on("uncaughtException", function (e) {
  logger(
    "error",
    `[uncaughtException] app will be terminated: ${e.stack}`,
    "adjacent-servers"
  );
  killProcess();
});

function run() {
  setTimeout(function () {
    if (running) run();
  }, 1000);
}

run();
