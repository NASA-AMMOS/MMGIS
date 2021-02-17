const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const logger = require("../../../logger");
const Tools = require("../models/tools");

router.get("/get", function (req, res, next) {
  Tools.findOne({ order: [["createdAt", "DESC"]] })
    .then((t) => {
      return t.tools;
    })
    .then((t) => {
      res.send({
        status: "success",
        tools: t,
      });
      return null;
    })
    .catch((err) => {
      res.send({ status: "failure", message: "Tool definitions not found." });
      return null;
    });
  return null;
});

function updateToolDefinitions() {
  let tools = {};

  //First read all the standard tools
  let toolsPath = "./src/essence/Tools";
  fs.readdir(toolsPath, { withFileTypes: true }, function (err, items) {
    items = items || [];
    for (var i = 0; i < items.length; i++) {
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
          var contents = fs.readFileSync(
            toolsPath + "/" + items[i].name + "/config.json"
          );
          var jsonContent = JSON.parse(contents);
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

    toolsPath = "./src/essence/MMGIS-Private-Tools";
    fs.readdir(toolsPath, { withFileTypes: true }, function (err, items) {
      items = items || [];
      for (var i = 0; i < items.length; i++) {
        if (
          items[i].isDirectory() &&
          items[i].name[0] != "_" &&
          items[i].name[0] != "."
        ) {
          try {
            var contents = fs.readFileSync(
              toolsPath + "/" + items[i].name + "/config.json"
            );
            var jsonContent = JSON.parse(contents);
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
            (tools[a].toolbarPriority || 1000) -
            (tools[b].toolbarPriority || 1000)
          );
        })
        .reduce((obj, key) => {
          obj[key] = tools[key];
          return obj;
        }, {});

      Tools.create({ tools: tools })
        .then((created) => {
          logger("info", "Successfully updated tool definitions.", "Tools");
          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Failed to update tool definitions.",
            "Tools",
            null,
            err
          );
          return null;
        });

      //Build dynamic toolConfigs file
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
          toolConfigs += `import ${pname || p} from '../${
            tools[t].paths[p]
          }'\n`;
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
        fs.writeFile("./src/pre/tools.js", toolConfigs, (err) => {
          if (err) {
            logger(
              "error",
              "Failed to write tool paths to src tools.js",
              "Tools",
              null,
              err
            );
          } else {
            logger(
              "info",
              "Successfully updated source tool configurations.",
              "Tools"
            );
          }
        });
      }
    });
  });
}

module.exports = { router, updateToolDefinitions };
