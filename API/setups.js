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

    // Now read all private and plugin backend directories
    const apiPath = path.join(__dirname);
    fs.readdir(apiPath, { withFileTypes: true }, function (err, apiItems) {
      if (err) {
        logger(
          "warn",
          "Could not read API directory for plugin backends",
          "Setups",
          null,
          err
        );
        apiItems = [];
      }

      // Filter directories that match *Private-Backend* or *Plugin-Backend*
      const pluginDirs = (apiItems || []).filter(item => {
        try {
          return item.isDirectory() && 
                 (item.name.includes("Private-Backend") || 
                  item.name.includes("Plugin-Backend"));
        } catch (err) {
          return false;
        }
      });

      // Process each plugin directory
      let processedDirs = 0;
      
      if (pluginDirs.length === 0) {
        // No plugin directories found, proceed with sorting
        finalizeSorting();
      } else {
        pluginDirs.forEach((pluginDir) => {
          const pluginPath = `${apiPath}/${pluginDir.name}`;
          
          fs.readdir(pluginPath, { withFileTypes: true }, function (err, items) {
            if (err) {
              logger(
                "warn",
                `Could not read plugin directory: ${pluginDir.name}`,
                "Setups",
                null,
                err
              );
            } else {
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
                  continue;
                }

                if (isDir && items[i].name[0] != "_" && items[i].name[0] != ".") {
                  try {
                    setups[items[i].name] = require(path.join(
                      pluginPath,
                      items[i].name,
                      "setup.js"
                    ));
                    logger(
                      "info",
                      `Loaded backend setup: ${items[i].name} from ${pluginDir.name}`,
                      "Setups"
                    );
                  } catch (err) {
                    logger(
                      "error",
                      `The following backend setup could not be added from ${pluginDir.name}: ${items[i].name}`,
                      "Setups",
                      null,
                      err
                    );
                  }
                }
              }
            }
            
            processedDirs++;
            if (processedDirs === pluginDirs.length) {
              finalizeSorting();
            }
          });
        });
      }

      function finalizeSorting() {
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
      }
    });
  });
};

module.exports = { getBackendSetups };
