"use strict";

/**
 * Build utility functions that replace react-dev-utils utilities.
 * Adapted from Create React App source (MIT licensed).
 * https://github.com/facebook/create-react-app
 */

const path = require("path");
const fs = require("fs");
const chalk = require("chalk");

// ---------------------------------------------------------------------------
// getPublicUrlOrPath
// Adapted from: react-dev-utils/getPublicUrlOrPath
// ---------------------------------------------------------------------------
function getPublicUrlOrPath(isEnvDevelopment, homepage, envPublicUrl) {
  const stubDomain = "https://create-react-app.dev";

  if (envPublicUrl) {
    // ensure last slash exists
    const publicUrl = envPublicUrl.endsWith("/")
      ? envPublicUrl
      : envPublicUrl + "/";

    // validate if `envPublicUrl` is a URL or path like
    // `stubDomain` is ignored if `publicUrl` contains a domain
    const validPublicUrl = new URL(publicUrl, stubDomain);

    return isEnvDevelopment
      ? envPublicUrl.startsWith(".")
        ? "/"
        : validPublicUrl.pathname
      : // Some apps do not use client-side routing with pushState.
        // For these, "homepage" can be set to "." to enable relative asset paths.
        publicUrl;
  }

  if (homepage) {
    // strip last slash if exists
    homepage = homepage.endsWith("/") ? homepage : homepage + "/";

    // validate if `homepage` is a URL or path like and use just pathname
    const validHomepagePathname = new URL(homepage, stubDomain).pathname;
    return isEnvDevelopment
      ? homepage.startsWith(".")
        ? "/"
        : validHomepagePathname
      : homepage.startsWith(".")
        ? homepage
        : validHomepagePathname;
  }

  return "/";
}

// ---------------------------------------------------------------------------
// formatWebpackMessages
// Adapted from: react-dev-utils/formatWebpackMessages
// ---------------------------------------------------------------------------

const friendlySyntaxErrorLabel = "Syntax error:";

function isLikelyASyntaxError(message) {
  return message.indexOf(friendlySyntaxErrorLabel) !== -1;
}

function formatMessage(message) {
  let lines = [];

  if (typeof message === "string") {
    lines = message.split("\n");
  } else if ("message" in message) {
    lines = message["message"].split("\n");
  } else if (Array.isArray(message)) {
    lines = message;
  }

  // Strip webpack-added headers off errors/warnings
  // https://github.com/webpack/webpack/blob/master/lib/ModuleError.js
  lines = lines.filter((line) => !/Module [A-z ]+\(from/.test(line));

  // Transform parsing error into syntax error
  // TODO: move this to webpack
  lines = lines.map((line) => {
    const parsingError = /Line (\d+):(?:(\d+):)?\s*Parsing error: (.+)$/.exec(
      line
    );
    if (!parsingError) {
      return line;
    }
    const [, errorLine, errorColumn, errorMessage] = parsingError;
    return `${friendlySyntaxErrorLabel} ${errorMessage} (${errorLine}:${errorColumn})`;
  });

  message = lines.join("\n");
  // Smoosh syntax errors (commonly found in CSS)
  message = message.replace(
    /SyntaxError\s+\((\d+):(\d+)\)\s*(.+?)\n/g,
    `${friendlySyntaxErrorLabel} $3 ($1:$2)\n`
  );
  // Clean up export errors
  message = message.replace(
    /^.*export '(.+?)' was not found in '(.+?)'.*$/gm,
    `Attempted import error: '$1' is not exported from '$2'.`
  );
  message = message.replace(
    /^.*export 'default' \(imported as '(.+?)'\) was not found in '(.+?)'.*$/gm,
    `Attempted import error: '$2' does not contain a default export (imported as '$1').`
  );
  message = message.replace(
    /^.*export '(.+?)' \(imported as '(.+?)'\) was not found in '(.+?)'.*$/gm,
    `Attempted import error: '$1' is not exported from '$3' (imported as '$2').`
  );
  lines = message.split("\n");

  // Remove leading newline
  if (lines.length > 2 && lines[1].trim() === "") {
    lines.splice(1, 1);
  }
  // Clean up file name
  lines[0] = lines[0].replace(/^(.*) \d+:\d+-\d+$/, "$1");

  // Clamp at 100 lines.
  if (lines.length > 100) {
    lines = lines.slice(0, 100);
    lines.push("... and more.");
  }

  return lines.join("\n");
}

function formatWebpackMessages(json) {
  const formattedErrors = json.errors.map(formatMessage);
  const formattedWarnings = json.warnings.map(formatMessage);
  const result = { errors: formattedErrors, warnings: formattedWarnings };
  if (result.errors.some(isLikelyASyntaxError)) {
    // If there are any syntax errors, show just them.
    result.errors = result.errors.filter(isLikelyASyntaxError);
  }
  return result;
}

// ---------------------------------------------------------------------------
// printBuildError
// Adapted from: react-dev-utils/printBuildError
// ---------------------------------------------------------------------------
function printBuildError(err) {
  const message = err != null && err.message;
  const stack = err != null && err.stack;

  // Add more helpful message for Terser error
  if (
    stack &&
    typeof message === "string" &&
    message.indexOf("from Terser") !== -1
  ) {
    try {
      const matched = /(.+)\[(.+):(\d+),(\d+)\]\[.+\]/.exec(stack);
      if (!matched) {
        throw new Error("Using stack trace for output.");
      }
      const problemPath = matched[2];
      const line = matched[3];
      const column = matched[4];
      console.log(
        "Failed to minify the code from this file: \n\n",
        chalk.yellow(
          `\t${problemPath}:${line}${column !== "0" ? ":" + column : ""}`
        ),
        "\n"
      );
    } catch (ignored) {
      console.log("Failed to minify the bundle.", err);
    }
  } else {
    console.log((message || err) + "\n");
  }
  console.log();
}

// ---------------------------------------------------------------------------
// FileSizeReporter (measureFileSizesBeforeBuild, printFileSizesAfterBuild)
// Adapted from: react-dev-utils/FileSizeReporter
// ---------------------------------------------------------------------------
const gzipSize = require("gzip-size");
const recursiveReaddir = require("recursive-readdir");

function canReadAsset(asset) {
  return (
    /\.(js|css)$/.test(asset) &&
    !/service-worker\.js/.test(asset) &&
    !/precache-manifest\.[0-9a-f]+\.js/.test(asset)
  );
}

// Prints a detailed summary of build files.
function printFileSizesAfterBuild(
  webpackStats,
  previousSizeMap,
  buildFolder,
  maxBundleGzipSize,
  maxChunkGzipSize
) {
  const root = previousSizeMap.root;
  const sizes = previousSizeMap.sizes;
  const assets = (webpackStats.stats || [webpackStats])
    .map((stats) =>
      stats
        .toJson({ all: false, assets: true })
        .assets.filter((asset) => canReadAsset(asset.name))
        .map((asset) => {
          const fileContents = fs.readFileSync(path.join(root, asset.name));
          const size = gzipSize.sync(fileContents);
          const previousSize = sizes[removeFileNameHash(root, asset.name)];
          const difference = getDifferenceLabel(size, previousSize);
          return {
            folder: path.join(
              path.basename(buildFolder),
              path.dirname(asset.name)
            ),
            name: path.basename(asset.name),
            size: size,
            sizeLabel:
              filesize(size) + (difference ? " (" + difference + ")" : ""),
          };
        })
    )
    .reduce((single, all) => all.concat(single), []);
  assets.sort((a, b) => b.size - a.size);
  const longestSizeLabelLength = Math.max.apply(
    null,
    assets.map((a) => stripAnsi(a.sizeLabel).length)
  );
  let suggestBundleSplitting = false;
  assets.forEach((asset) => {
    let sizeLabel = asset.sizeLabel;
    const sizeLength = stripAnsi(sizeLabel).length;
    if (sizeLength < longestSizeLabelLength) {
      const rightPadding = " ".repeat(longestSizeLabelLength - sizeLength);
      sizeLabel += rightPadding;
    }
    const isMainBundle = asset.name.indexOf("main.") === 0;
    const maxRecommendedSize = isMainBundle
      ? maxBundleGzipSize
      : maxChunkGzipSize;
    const isLarge = maxRecommendedSize && asset.size > maxRecommendedSize;
    if (isLarge && path.extname(asset.name) === ".js") {
      suggestBundleSplitting = true;
    }
    console.log(
      "  " +
        (isLarge ? chalk.yellow(sizeLabel) : sizeLabel) +
        "  " +
        chalk.dim(asset.folder + path.sep) +
        chalk.cyan(asset.name)
    );
  });
  if (suggestBundleSplitting) {
    console.log();
    console.log(
      chalk.yellow("The bundle size is significantly larger than recommended.")
    );
    console.log(
      chalk.yellow(
        "Consider reducing it with code splitting: https://goo.gl/9VhYWB"
      )
    );
    console.log(
      chalk.yellow(
        "You can also analyze the project dependencies: https://goo.gl/LeUzfb"
      )
    );
  }
}

function removeFileNameHash(buildFolder, fileName) {
  return fileName
    .replace(buildFolder, "")
    .replace(/\\/g, "/")
    .replace(
      /\/?(.*)(\.[0-9a-f]+)(\.chunk)?(\.js|\.css)/,
      (match, p1, p2, p3, p4) => p1 + p4
    );
}

// Input: 1024, 2048
// Output: "(+1 KB)"
function getDifferenceLabel(currentSize, previousSize) {
  const FIFTY_KILOBYTES = 1024 * 50;
  const difference = currentSize - previousSize;
  const fileSize = !Number.isNaN(difference)
    ? filesize(difference)
    : 0;
  if (difference >= FIFTY_KILOBYTES) {
    return chalk.red("+" + fileSize);
  } else if (difference < FIFTY_KILOBYTES && difference > 0) {
    return chalk.yellow("+" + fileSize);
  } else if (difference < 0) {
    return chalk.green(fileSize);
  }
  return "";
}

function filesize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001B\[[0-9;]*m/g, "");
}

function measureFileSizesBeforeBuild(buildFolder) {
  return new Promise((resolve) => {
    recursiveReaddir(buildFolder, (err, fileNames) => {
      let sizes;
      if (!err && fileNames) {
        sizes = fileNames
          .filter(canReadAsset)
          .reduce((memo, fileName) => {
            const contents = fs.readFileSync(fileName);
            const key = removeFileNameHash(buildFolder, fileName);
            memo[key] = gzipSize.sync(contents);
            return memo;
          }, {});
      }
      resolve({
        root: buildFolder,
        sizes: sizes || {},
      });
    });
  });
}

const FileSizeReporter = {
  measureFileSizesBeforeBuild,
  printFileSizesAfterBuild,
};

// ---------------------------------------------------------------------------
// checkBrowsers
// Adapted from: react-dev-utils/browsersHelper
// ---------------------------------------------------------------------------
const browserslist = require("browserslist");

function checkBrowsers(dir, isInteractive) {
  const current = browserslist.loadConfig({ path: dir });
  if (current != null) {
    return Promise.resolve(current);
  }

  const defaultBrowsers = [">0.2%", "not dead", "not op_mini all"];

  if (isInteractive) {
    console.log(
      chalk.yellow(
        "We're unable to detect target browsers.\n\n" +
          "Would you like to add the defaults to your " +
          chalk.bold("package.json") +
          "?\n\n" +
          chalk.bold("Browserslist") +
          ": " +
          defaultBrowsers.join(", ") +
          "\n"
      )
    );
  }

  return Promise.resolve(defaultBrowsers);
}

// ---------------------------------------------------------------------------
// noopServiceWorkerMiddleware
// ---------------------------------------------------------------------------
function noopServiceWorkerMiddleware(servedPath) {
  return function (req, res, next) {
    if (req.url === servedPath + "service-worker.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.send(
        "// This service worker file is effectively a no-op.\n" +
          'self.addEventListener("install", () => self.skipWaiting());\n' +
          'self.addEventListener("activate", () => {\n' +
          '  self.clients.matchAll({ type: "window" }).then(windowClients => {\n' +
          "    for (const windowClient of windowClients) {\n" +
          "      windowClient.navigate(windowClient.url);\n" +
          "    }\n" +
          "  });\n" +
          "});\n"
      );
    } else {
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// redirectServedPathMiddleware
// ---------------------------------------------------------------------------
function redirectServedPathMiddleware(servedPath) {
  return function (req, res, next) {
    if (servedPath !== "/" && req.url === "/") {
      res.redirect(servedPath);
    } else {
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  getPublicUrlOrPath,
  formatWebpackMessages,
  printBuildError,
  FileSizeReporter,
  checkBrowsers,
  noopServiceWorkerMiddleware,
  redirectServedPathMiddleware,
};
