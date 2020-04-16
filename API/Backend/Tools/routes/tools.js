const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const logger = require("../../../logger");
const Tools = require("../models/tools");

router.get("/get", function(req, res, next) {
  Tools.findOne({ order: [["createdAt", "DESC"]] })
    .then(t => {
      return t.tools;
    })
    .then(t => {
      res.send({
        status: "success",
        tools: t
      });
      return null;
    })
    .catch(err => {
      res.send({ status: "failure", message: "Tool definitions not found." });
      return null;
    });
  return null;
});

function updateToolDefinitions() {
  let tools = {};

  //First read all the standard tools
  let toolsPath = "./scripts/essence/Tools";
  fs.readdir(toolsPath, { withFileTypes: true }, function(err, items) {
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

    toolsPath = "./scripts/essence/MMGIS-Private-Tools";
    fs.readdir(toolsPath, { withFileTypes: true }, function(err, items) {
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
        .sort(function(a, b) {
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
        .then(created => {
          logger("info", "Successfully updated tool definitions.", "Tools");
          return null;
        })
        .catch(err => {
          logger(
            "error",
            "Failed to update tool definitions.",
            "Tools",
            null,
            err
          );
          return null;
        });

      let toolConfigs = "mmgisglobal.toolConfigs = " + JSON.stringify(tools);
      fs.writeFile("./scripts/pre/toolConfigs.js", toolConfigs, err => {
        if (err) {
          logger(
            "error",
            "Failed to write tool paths to toolConfigs.js",
            "Tools",
            null,
            err
          );
        } else {
          logger("info", "Successfully updated tool configurations.", "Tools");
        }
      });
    });
  });
}

module.exports = { router, updateToolDefinitions };
