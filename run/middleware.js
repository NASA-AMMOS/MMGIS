const fs = require("fs");
const path = require("path");
const rootDir = `${__dirname}/..`;

const dirStore = {};
const DIR_STORE_MAX_AGE = 10800000; // 3hours
function getTimePath(prepath, suffixPath, time) {
  let dirs = dirStore[prepath];
  if (dirs) {
    dirs = dirs.dirs;
    time = time.replace(/:/g, "_").replace("Z", "");

    let closestTimeWithoutGoingOver = dirs.filter(function (v) {
      return v <= time;
    });
    if (closestTimeWithoutGoingOver.length > 0)
      closestTimeWithoutGoingOver =
        closestTimeWithoutGoingOver[closestTimeWithoutGoingOver.length - 1];
    else return false;

    if (closestTimeWithoutGoingOver)
      return `${prepath}${closestTimeWithoutGoingOver}${suffixPath}`;

    return false;
  }
  return false;
}

const middleware = {
  missions: function () {
    return (req, res, next) => {
      const originalUrl = req.originalUrl.split("?")[0];
      const relUrl = req.url.split("?")[0];
      if (req.query.time != null && originalUrl.indexOf("_time_") > -1) {
        const urlSplit = originalUrl.split("_time_");
        const relUrlSplit = relUrl.split("_time_");

        if (dirStore[relUrlSplit[0]] == null) {
          dirStore[relUrlSplit[0]] = {
            lastUpdated: 0,
            dirs: [],
          };
        }
        if (
          Date.now() - dirStore[relUrlSplit[0]].lastUpdated >
          DIR_STORE_MAX_AGE
        ) {
          fs.readdir(
            path.join(rootDir, urlSplit[0]),
            { withFileTypes: true },
            (error, files) => {
              if (!error) {
                const dirs = files
                  .filter((item) => item.isDirectory())
                  .map((item) => item.name);

                dirStore[relUrlSplit[0]].lastUpdated = Date.now();
                dirStore[relUrlSplit[0]].dirs = dirs.sort();

                const newUrl = getTimePath(
                  relUrlSplit[0],
                  relUrlSplit[1],
                  req.query.time
                );
                if (!newUrl) res.sendStatus(404);
                else {
                  req.url = newUrl;
                  next();
                }
              } else {
                res.sendStatus(404);
              }
            }
          );
        } else {
          const newUrl = getTimePath(
            relUrlSplit[0],
            relUrlSplit[1],
            req.query.time
          );
          if (!newUrl) res.sendStatus(404);
          else {
            req.url = newUrl;
            next();
          }
        }
      } else next();
    };
  },
};

module.exports = { middleware };
