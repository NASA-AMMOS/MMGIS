const fs = require("fs");

const logger = require("./logger");

function updateTools() {
  let tools = {};

  let items = null;

  // First read all the standard tools
  let toolsPath = "./src/essence/Tools";
  try {
    items = fs.readdirSync(toolsPath, { withFileTypes: true });
  } catch (err) {
    items = [];
    logger(
      "warn",
      "Could not find any default tools: ${toolsPath}. Did you mean to do this?",
      "Tools",
      null,
      err
    );
  }
  items = items || [];
  for (let i = 0; i < items.length; i++) {
    let isDir = false;
    try {
      isDir = items[i].isDirectory();
    } catch (err) {
      logger(
        "error",
        "No tools could be added. Is your node version >= v10.10.0?",
        "Tools",
        null,
        err
      );
      return;
    }

    if (isDir && items[i].name[0] != "_" && items[i].name[0] != ".") {
      try {
        const contents = fs.readFileSync(
          toolsPath + "/" + items[i].name + "/config.json"
        );
        const jsonContent = JSON.parse(contents);
        tools[items[i].name] = jsonContent;
      } catch (err) {
        logger(
          "error",
          "The following tool could not be added: " + items[i].name,
          "Tools",
          null,
          err
        );
      }
    }
  }

  // Now the potential private ones
  toolsPath = "./src/essence/MMGIS-Private-Tools";
  try {
    items = fs.readdirSync(toolsPath, { withFileTypes: true });
  } catch (err) {
    items = [];
  }
  items = items || [];
  for (let i = 0; i < items.length; i++) {
    if (
      items[i].isDirectory() &&
      items[i].name[0] != "_" &&
      items[i].name[0] != "."
    ) {
      try {
        const contents = fs.readFileSync(
          toolsPath + "/" + items[i].name + "/config.json"
        );
        const jsonContent = JSON.parse(contents);
        tools[items[i].name] = jsonContent;
      } catch (err) {
        logger(
          "error",
          "The following tool could not be added: " + items[i].name,
          "Tools",
          null,
          err
        );
      }
    }
  }

  // Sort the tools by toolbarPriority
  tools = Object.keys(tools)
    .sort(function (a, b) {
      return (
        (tools[a].toolbarPriority || 1000) - (tools[b].toolbarPriority || 1000)
      );
    })
    .reduce((obj, key) => {
      obj[key] = tools[key];
      return obj;
    }, {});

  // Build dynamic /config/pre/toolConfigs.json file
  // (configure page is still old school)
  try {
    fs.writeFileSync("./config/pre/toolConfigs.json", JSON.stringify(tools));
    fs.writeFileSync(
      "./configure/public/toolConfigs.json",
      JSON.stringify(tools)
    );
    logger(
      "success",
      "Successfully updated source tool configurations.",
      "Tools"
    );
  } catch (err) {
    logger("error", "Failed to write toolConfigs.json", "Tools", null, err);
  }

  //Build dynamic /src/pre/tools.js file
  let toolConfigs = "";
  let toolModules = {};
  let testModules = {};
  let kindsModule = null;
  for (let t in tools) {
    for (let p in tools[t].paths) {
      let pname;
      if (p === "Kinds") {
        kindsModule = p;
        pname = "kinds";
      } else toolModules[p] = p;
      toolConfigs += `import ${pname || p} from '../${tools[t].paths[p]}'\n`;
    }
    if (tools[t].tests) {
      for (let test in tools[t].tests) {
        testModules[test] = test;
        toolConfigs += `import ${test} from '../${tools[t].tests[test]}'\n`;
      }
    }
  }

  toolConfigs += `\n`;
  toolConfigs += `export const toolConfigs = ${JSON.stringify(tools)}\n`;
  toolConfigs += `export const toolModules = ${JSON.stringify(
    toolModules
  ).replace(/"/g, "")}\n`;
  toolConfigs += `export const testModules = ${JSON.stringify(
    testModules
  ).replace(/"/g, "")}\n`;
  toolConfigs += `export const Kinds = kinds`;

  if (kindsModule == null) {
    logger(
      "error",
      "Kinds tool is required but is not found. Are you missing a config.js?",
      "Tools",
      null
    );
  } else {
    try {
      fs.writeFileSync("./src/pre/tools.js", toolConfigs);
      logger("success", "Successfully plugged-in tools.", "Tools");
    } catch (err) {
      logger(
        "error",
        "Failed to write tool paths to src tools.js",
        "Tools",
        null,
        err
      );
    }
  }
}

module.exports = { updateTools };
