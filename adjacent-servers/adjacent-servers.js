require("dotenv").config();
const logger = require("../API/logger");
const { spawn } = require("child_process");

// Lines of a server's output kept to explain why it exited
const TAIL_LINES = 15;

function adjacentServers(mode = "embedded") {
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

  const enabled = adjacentServers.filter((s) => process.env[s.env] === "true");

  // In external mode the proxy targets other hosts, so a server started here
  // would run unused.
  if (mode !== "embedded") {
    if (enabled.length > 0)
      logger(
        "info",
        `Not starting ${enabled
          .map((s) => s.name)
          .join(", ")}: adjacent servers are external.`,
        "adjacent-servers"
      );
    return [];
  }

  const serverProcesses = [];
  enabled.forEach((s) => {
    logger(
      "info",
      `Starting ${s.name} server on port ${s.port}...`,
      "adjacent-servers"
    );
    let cmd = spawn(s.command, [s.port], { shell: true });
    serverProcesses.push(cmd);

    const tail = [];
    const remember = (data) => {
      for (const line of `${data}`.split(/\r?\n/)) {
        if (line.trim() === "") continue;
        tail.push(line);
        if (tail.length > TAIL_LINES) tail.shift();
      }
    };

    cmd.stdout.on("data", (data) => {
      remember(data);
      if (`${data}`.indexOf("running") != -1)
        process.stdout.write(`${s.name} - ${data}`);
    });

    cmd.stderr.on("data", (data) => {
      remember(data);
      if (`${data}`.indexOf("running") != -1)
        process.stdout.write(`${s.name} - ${data}`);
    });

    cmd.on("error", (err) => {
      process.stdout.write(`${s.name} ERROR - ${err}`);
      logger("error", `[${s.name}] ${err}`, "adjacent-servers");
    });

    // These servers are meant to run for as long as MMGIS does, so any exit
    // leaves the /{name} proxy route answering 504.
    cmd.on("close", (code, signal) => {
      const how = signal ? `was stopped by ${signal}` : `exited with code ${code}`;
      const output =
        tail.length > 0
          ? ` Last output:\n${tail.map((l) => `  ${l}`).join("\n")}`
          : " It printed no output.";
      logger(
        code === 0 || signal ? "warn" : "error",
        `[${s.name}] server ${how}; it is no longer running on port ${s.port}.${output}`,
        "adjacent-servers"
      );
    });
  });

  return serverProcesses;
}

module.exports = adjacentServers;
