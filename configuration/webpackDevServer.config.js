"use strict";

const fs = require("fs");
const errorOverlayMiddleware = require("react-dev-utils/errorOverlayMiddleware");
const evalSourceMapMiddleware = require("react-dev-utils/evalSourceMapMiddleware");
const noopServiceWorkerMiddleware = require("react-dev-utils/noopServiceWorkerMiddleware");
const ignoredFiles = require("react-dev-utils/ignoredFiles");
const redirectServedPath = require("react-dev-utils/redirectServedPathMiddleware");
const paths = require("./paths");
const getHttpsConfig = require("./getHttpsConfig");
const chalk = require("chalk");

const host = process.env.HOST || "0.0.0.0";
const sockHost = process.env.WDS_SOCKET_HOST;
const sockPath = process.env.WDS_SOCKET_PATH; // default: '/sockjs-node'
const sockPort = process.env.WDS_SOCKET_PORT;

const port = parseInt(process.env.PORT || "8888", 10);

module.exports = function (proxy, allowedHost, options) {
  return {
    port: port + 1,
    allowedHosts:
      !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === "true"
        ? "all"
        : "auto",
    static: {
      directory: paths.appPublic,
      publicPath: paths.publicUrlOrPath,
      watch: true,
    },
    hot: true,
    webSocketServer: "ws",
    devMiddleware: {
      // It is important to tell WebpackDevServer to use the same "publicPath" path as
      // we specified in the webpack config. When homepage is '.', default to serving
      // from the root.
      // remove last slash so user can land on `/test` instead of `/test/`
      publicPath: paths.publicUrlOrPath.slice(0, -1),
    },
    https: getHttpsConfig(),
    host,
    client: {
      // Silence WebpackDevServer's own logs since they're generally not useful.
      // It will still show compile warnings and errors with this setting.
      logging: "none",
      overlay: false,
      // Enable custom sockjs pathname for websocket connection to hot reloading server.
      // Enable custom sockjs hostname, pathname and port for websocket connection
      // to hot reloading server.
      webSocketURL: {
        hostname: sockHost,
        pathname: sockPath,
        port: sockPort,
      },
    },
    historyApiFallback: {
      // Paths with dots should still use the history fallback.
      // See https://github.com/facebook/create-react-app/issues/387.
      disableDotRule: true,
      index: paths.publicUrlOrPath,
    },
    setupMiddlewares(middlewares, devServer) {
      if (!devServer) {
        throw new Error("webpack-dev-server is not defined");
      }

      if (fs.existsSync(paths.proxySetup)) {
        require(paths.proxySetup)(devServer.app);
      }
      middlewares.push(
        evalSourceMapMiddleware(devServer),
        redirectServedPath(paths.publicUrlOrPath),
        noopServiceWorkerMiddleware(paths.publicUrlOrPath)
      );

      return middlewares;
    },
    // `proxy` is run between `before` and `after` `webpack-dev-server` hooks
    proxy,
    onListening(server) {
      console.log(chalk.cyan(`MMGIS Dev server successfully started!\n`));
      console.log(
        chalk.hex("#00FF00")(
          `The main application can be accessed at\n    http://localhost:${
            port + 1
          }\n\nThe rest of the pages can be accessed at\n    http://localhost:${port}\n`
        )
      );

      console.log(chalk.cyan(`Compiling...\n`));
    },
  };
};
