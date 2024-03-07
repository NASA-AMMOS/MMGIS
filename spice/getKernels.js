const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const schedule = require("node-schedule");

const logger = require("../API/logger");

const OUTPUT_DIR = "./kernels";
const SHOULD_LOG = false;

function setSPICEKernelDownloadSchedule(runImmeditately, cronExpression) {
  // Run immediately
  if (runImmeditately === "true") getKernelsFromConf();

  schedule.scheduleJob(
    cronExpression || "0 0 */2 * *", // Every other day
    function () {
      getKernelsFromConf();
    }
  );
}

async function getKernelsFromConf() {
  logger(`info`, `Starting scheduled download of SPICE kernels.`);

  try {
    //Look at latest kernels.json file
    const kernelsFile = path.join(
      __dirname,
      `../Missions/spice-kernels-conf.json`
    );
    const kernels = JSON.parse(fs.readFileSync(kernelsFile, "utf8"));

    Object.keys(kernels.body).forEach(async (b) => {
      const body = kernels.body[b];
      if (body.kernels) {
        await getKernels(body.kernels, `${OUTPUT_DIR}/${b}`, true, SHOULD_LOG);
      }
      if (body.targets) {
        Object.keys(body.targets).forEach(async (t) => {
          const target = kernels.body[b].targets[t];
          if (target.kernels) {
            await getKernels(
              target.kernels,
              `${OUTPUT_DIR}/${b}/${t}`,
              true,
              SHOULD_LOG
            );
          }
        });
      }
    });
  } catch (err) {
    logger(`error`, `getKernelsFromConf: ${err}`);
  }
}

/*
kernelUrls == [
  'url1',
  'url2',
  {
    url: '',
    mkRoot: ''
  }
]
*/
async function getKernels(
  kernelUrls,
  outputDir,
  includeMetaKernels,
  shouldLog
) {
  const outputPath = path.join(__dirname, `/${outputDir}`);

  // Make outputPath directories if they don't already exist
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  const loaded = {};
  kernelUrls.forEach((url) => {
    loaded[path.basename(url.url || url)] = false;
  });

  const fileMap = {};

  // Get all immediate kernels
  for (let i = 0; i < kernelUrls.length; i++) {
    const file = kernelUrls[i];

    const filename = file.url || file;
    const basename = path.basename(filename);

    if (shouldLog)
      logger(`info`, `Starting downloaded of SPICE kernel: ${filename}`);

    // Ignore duplicates
    if (fileMap[basename] != null) continue;

    fileMap[basename] = file;
    await fetch(filename)
      .then(
        async (response) =>
          new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(`${outputPath}/${basename}`);
            response.body.pipe(ws);
            response.body.on("close", () => {
              if (shouldLog)
                logger(`success`, `Successfully downloaded ${filename}`);
              loaded[basename] = true;
              proceed();
              resolve();
            });
            ws.on("error", (err) => {
              if (shouldLog)
                logger(`warn`, `Failed to downloaded ${filename}`, err);
              loaded[basename] = true;
              proceed();
              reject();
            });
          })
      )
      .catch((err) => {
        logger(`warn`, `Failed to download kernel: ${filename} - ${err}`);
      });
  }

  function proceed() {
    if (Object.values(loaded).every((item) => item === true)) {
      try {
        if (includeMetaKernels === true) {
          const regex = /'\$KERNELS\/.*\..*'\n/g;
          // Next any meta-kernels (mk) (.tm) need to be read and have their inner-kernels downloaded
          setTimeout(() => {
            fs.readdirSync(outputPath, "utf8").forEach(async (file) => {
              const mkRoot = fileMap[file]?.mkRoot;
              const mkRegex = fileMap[file]?.mkRegex;
              if (path.extname(file) === ".tm" && mkRoot) {
                const data = fs.readFileSync(`${outputPath}/${file}`, "utf8");
                let matches = [...data.matchAll(regex)].map((m) => m[0]);
                if (matches) {
                  matches = matches.map((m) =>
                    m
                      .replace(/'/g, "")
                      .replace(/\n/g, "")
                      .replace("$KERNELS", mkRoot)
                  );
                  if (matches.length > 0) {
                    if (mkRegex) {
                      const regex2 = new RegExp(mkRegex, "g");
                      matches = matches.filter((m) => m.match(regex2));
                    }
                    await getKernels(matches, outputDir, false, shouldLog);
                  }
                }
              }
            });
          }, 1000);
        } else {
          logger(
            `success`,
            `Finished downloading immediate kernels (meta-kernels may still be downloading).`
          );
        }
      } catch (err) {
        logger(
          `warn`,
          `Failed to proceed through meta-kernel download: ${err}`
        );
      }
    }
  }
}

module.exports = { setSPICEKernelDownloadSchedule };
