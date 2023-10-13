const fs = require("fs");
const path = require("path");

const logger = require("./logger");

let getBackendSetups = (cb) => {
  let setups = {};

  //First read all the standard tools
  let setupsPath = "./API/Backend";
  fs.readdir(setupsPath, { withFileTypes: true }, function (err, items) {
    items = items || [];
    for (var i = 0; i < items.length; i++) {
      let isDir = false;
      try {
        isDir = items[i].isDirectory();
      } catch (err) {
        logger(
          "error",
          "No backend setups could be added. Is your node version >= v10.10.0?",
          "Setups",
          null,
          err
        );
        return;
      }

      if (isDir && items[i].name[0] != "_" && items[i].name[0] != ".") {
        try {
          setups[items[i].name] = require("." +
            setupsPath +
            "/" +
            items[i].name +
            "/setup.js");
        } catch (err) {
          logger(
            "error",
            "The following backend setup could not be added: " + items[i].name,
            "Setups",
            null,
            err
          );
        }
      }
    }

    setupsPath = "./API/MMGIS-Private-Backend";
    fs.readdir(setupsPath, { withFileTypes: true }, function (err, items) {
      items = items || [];
      for (var i = 0; i < items.length; i++) {
        let isDir = false;
        try {
          isDir = items[i].isDirectory();
        } catch (err) {
          logger(
            "error",
            "No backend setups could be added. Is your node version >= v10.10.0?",
            "Setups",
            null,
            err
          );
          return;
        }

        if (isDir && items[i].name[0] != "_" && items[i].name[0] != ".") {
          try {
            setups[items[i].name] = require("." +
              setupsPath +
              "/" +
              items[i].name +
              "/setup.js");
          } catch (err) {
            logger(
              "error",
              "The following private backend setup could not be added: " +
                items[i].name,
              "Setups",
              null,
              err
            );
          }
        }
      }

      // Sort the tools by priority
      setups = Object.keys(setups)
        .sort(function (a, b) {
          return (setups[a].priority || 1000) - (setups[b].priority || 1000);
        })
        .reduce((obj, key) => {
          obj[key] = setups[key];
          return obj;
        }, {});

      // Aggregate all setup envs
      let envs = {};
      for (let f in setups) {
        if (setups[f].envs) {
          for (let e in setups[f].envs) {
            if (envs[setups[f].envs[e].name] == null) {
              envs[setups[f].envs[e].name] = setups[f].envs[e];
            } else {
              logger(
                "warning",
                "ENV variable name duplicated: " + setups[f].envs[e].name,
                "Setups"
              );
            }
          }
        }
      }

      cb({
        init: (s) => {
          for (let f in setups) {
            if (typeof setups[f].onceInit === "function") setups[f].onceInit(s);
          }
        },
        started: (s) => {
          for (let f in setups)
            if (typeof setups[f].onceStarted === "function")
              setups[f].onceStarted(s);
        },
        synced: (s) => {
          for (let f in setups)
            if (typeof setups[f].onceSynced === "function")
              setups[f].onceSynced(s);
        },
        envs: envs,
      });
    });
  });
};

module.exports = { getBackendSetups };
