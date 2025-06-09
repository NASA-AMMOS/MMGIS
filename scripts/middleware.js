const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const rootDir = `${__dirname}/..`;
const rootDirMissions = `${rootDir}/Missions`;

const dirStore = {};
const DIR_STORE_MAX_AGE =
  process.env.COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS == null ||
  isNaN(parseInt(process.env.COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS))
    ? 3600000 / 2
    : parseInt(process.env.COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS); // defaults to 1hours / 2

async function compositeImageUrls(urls) {
  try {
    const output = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(
        urls.map((url) => {
          return { input: `${rootDirMissions}${url}` };
        })
      )
      .png()
      .toBuffer();
    return output;
  } catch (err) {
    return false;
  }
}

async function onlyExistingFilepaths(paths) {
  const filePromises = [];
  paths.forEach((path) => {
    filePromises.push(
      new Promise(async (resolve, reject) => {
        try {
          await fs.promises.access(`${rootDirMissions}${path}`);
          resolve(path);
        } catch (err) {
          resolve(false);
        }
      })
    );
  });
  const filesExist = await Promise.all(filePromises).catch((err) => {});

  return paths.filter((p) => filesExist.includes(p));
}

function getTimePath(prepath, suffixPath, time, starttime, returnUrls) {
  let dirs = dirStore[prepath];
  if (dirs) {
    dirs = dirs.dirs;
    time = time.replace(/:/g, "_").replace("Z", "");

    if (starttime != null) {
      starttime = starttime.replace(/:/g, "_").replace("Z", "");
    }

    let closestTimeWithoutGoingOver = dirs.filter(function (v) {
      const s = v.split("--")[0].replace(/Z/g, "");
      if (s.indexOf("-to-") > -1) {
        const t = s.split("-to-");

        if (starttime != null) return !(time < t[0] || starttime > t[1]);
        else return t[1] <= time;
      } else {
        if (starttime != null) return s >= starttime && s <= time;
        else return s <= time;
      }
    });
    if (returnUrls) {
      closestTimeWithoutGoingOver = closestTimeWithoutGoingOver.map((v) => {
        return `${prepath}${v}${suffixPath}`;
      });
      return closestTimeWithoutGoingOver;
    }

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

async function sendImage(req, res, next, relUrlSplit) {
  if (req.query.composite === "true") {
    let compositeUrls = getTimePath(
      relUrlSplit[0],
      relUrlSplit[1],
      req.query.time,
      req.query.starttime,
      true
    );

    compositeUrls = await onlyExistingFilepaths(compositeUrls);
    // Never composite more than 100 images
    compositeUrls = compositeUrls.slice(-100);

    if (compositeUrls.length > 1) {
      const outputImage = await compositeImageUrls(compositeUrls);
      if (outputImage === false) res.sendStatus(404);
      else {
        res.contentType("image/webp");
        res.send(Buffer.from(outputImage, "binary"));
      }
    } else if (compositeUrls.length === 1 && compositeUrls[0] != null) {
      req.url = compositeUrls[0];
      next();
    } else {
      res.sendStatus(404);
    }
  } else {
    const newUrl = getTimePath(
      relUrlSplit[0],
      relUrlSplit[1],
      req.query.time,
      req.query.starttime
    );
    if (!newUrl) res.sendStatus(404);
    else {
      req.url = newUrl;
      next();
    }
  }
}

function isPathInsideRoot(logicalRootDirName, targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  const pathParts = resolvedTarget.split(path.sep);

  const rootIndex = pathParts.indexOf(logicalRootDirName);
  if (rootIndex === -1) return false;

  const resolvedRoot =
    pathParts.slice(0, rootIndex + 1).join(path.sep) + path.sep;

  return resolvedTarget.startsWith(resolvedRoot);
}

const middleware = {
  missions: function (ROOT_PATH) {
    return (req, res, next) => {
      const originalUrl = req.originalUrl.split("?")[0];
      const relUrl = req.url.split("?")[0];

      // Validate URL starts with /Missions to prevent path traversal
      if (!originalUrl.startsWith(`${ROOT_PATH}/Missions`)) {
        return res.sendStatus(404);
      }
      // Additional validation: ensure no path traversal sequences
      if (!isPathInsideRoot("Missions", originalUrl)) {
        return res.sendStatus(404);
      }

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

                sendImage(req, res, next, relUrlSplit);
              } else {
                res.sendStatus(404);
              }
            }
          );
        } else {
          sendImage(req, res, next, relUrlSplit);
        }
      } else next();
    };
  },
};

module.exports = { middleware };
