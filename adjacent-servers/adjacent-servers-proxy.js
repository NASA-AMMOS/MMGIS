const {
  createProxyMiddleware,
  responseInterceptor,
} = require("http-proxy-middleware");

const logger = require("../API/logger");

function initAdjacentServersProxy(app, isDocker, ensureAdmin) {
  ///////////////////////////
  // Proxies
  //// STAC
  if (process.env.WITH_STAC === "true") {
    const stacTarget = `http://${isDocker ? "stac-fastapi" : "localhost"}:${
      process.env.STAC_PORT || 8881
    }`;
    app.use(
      `${process.env.ROOT_PATH || ""}/stac`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: stacTarget,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/stac`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("stac", stacTarget),
        },
      })
    );
  }

  //// Tipg
  if (process.env.WITH_TIPG === "true") {
    const tipgTarget = `http://${isDocker ? "tipg" : "localhost"}:${
      process.env.TIPG_PORT || 8882
    }`;
    app.use(
      `${process.env.ROOT_PATH || ""}/tipg`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: tipgTarget,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/tipg`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("tipg", tipgTarget),
        },
      })
    );
  }

  //// TiTiler
  if (process.env.WITH_TITILER === "true") {
    const titilerTarget = `http://${isDocker ? "titiler" : "localhost"}:${
      process.env.TITILER_PORT || 8883
    }`;
    app.use(
      `${process.env.ROOT_PATH || ""}/titiler`,
      ensureAdmin(false, false, true, ["/cog/stac"]), // true to allow all GETs (except /cog/stac) - others require admin auth
      createProxyMiddleware({
        target: titilerTarget,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/titiler`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("titiler", titilerTarget),
        },
      })
    );
  }

  /// TiTiler-pgSTAC
  if (process.env.WITH_TITILER_PGSTAC === "true") {
    const titilerpgstacTarget = `http://${
      isDocker ? "titiler-pgstac" : "localhost"
    }:${process.env.TITILER_PGSTAC_PORT || 8884}`;
    app.use(
      `${process.env.ROOT_PATH || ""}/titilerpgstac`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: titilerpgstacTarget,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/titilerpgstac`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor(
            "titilerpgstac",
            titilerpgstacTarget
          ),
        },
      })
    );
  }

  // Veloserver
  if (process.env.WITH_VELOSERVER === "true") {
    app.use(
      `${process.env.ROOT_PATH || ""}/veloserver`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: `http://${isDocker ? "veloserver" : "localhost"}:${
          process.env.VELOSERVER_PORT || 8104
        }`,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/veloserver`]: "",
        },
      })
    );
  }

  // Custom Adjacent Servers
  setupCustomAdjacentServers(app, isDocker, ensureAdmin);
}

/**
 * Sets up custom adjacent servers based on environment variables
 * Format: ADJACENT_SERVER_CUSTOM_X=["isEnabled", "routeName", "serviceName", "port"]
 * Example: ADJACENT_SERVER_CUSTOM_0=["true", "frozon_api", "frozon_api", "8104"]
 */
function setupCustomAdjacentServers(app, isDocker, ensureAdmin) {
  const customServerPrefix = "ADJACENT_SERVER_CUSTOM_";

  // Find all custom server environment variables
  const customServerEnvs = Object.keys(process.env)
    .filter((key) => key.startsWith(customServerPrefix))
    .sort(); // Sort to ensure consistent processing order

  customServerEnvs.forEach((envKey) => {
    try {
      const configValue = process.env[envKey];
      if (!configValue) return;

      // Parse the JSON array configuration
      const config = JSON.parse(configValue);

      if (!Array.isArray(config) || config.length !== 4) {
        logger(
          "warn",
          `Invalid configuration for ${envKey}: Expected array with 4 elements [isEnabled, routeName, serviceName, port]`
        );
        return;
      }

      const [isEnabled, routeName, serviceName, port] = config;

      // Convert isEnabled to boolean
      const enabled = String(isEnabled).toLowerCase() === "true";

      if (!enabled) {
        logger("warn", `Custom adjacent server '${routeName}' is disabled`);
        return;
      }

      // Validate configuration
      if (!routeName || !serviceName || !port) {
        logger(
          "warn",
          `Invalid configuration for ${envKey}: routeName, serviceName, and port are required`
        );
        return;
      }

      // Setup the custom adjacent server
      setupCustomAdjacentServer(app, isDocker, ensureAdmin, {
        routeName: String(routeName),
        serviceName: String(serviceName),
        port: parseInt(port, 10),
      });

      logger(
        "info",
        `Custom adjacent server '${routeName}' configured on port ${port}`
      );
    } catch (error) {
      logger(
        "error",
        `Error parsing configuration for ${envKey}:`,
        error.message
      );
    }
  });
}

/**
 * Sets up a single custom adjacent server
 */
function setupCustomAdjacentServer(app, isDocker, ensureAdmin, config) {
  const { routeName, serviceName, port } = config;

  const target = `http://${isDocker ? serviceName : "localhost"}:${port}`;
  const routePath = `${process.env.ROOT_PATH || ""}/${routeName}`;

  app.use(
    routePath,
    ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      pathRewrite: {
        [`^${process.env.ROOT_PATH || ""}/${routeName}`]: "",
      },
    })
  );
}

const createSwaggerInterceptor = (path, target) => {
  return responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    let finalReturn = responseBuffer;
    let newResponse;

    if (req.originalUrl.endsWith(`/${path}/api`)) {
      newResponse = newResponse || responseBuffer.toString("utf8");
      const responseJSON = JSON.parse(newResponse); // convert buffer to string
      responseJSON.servers = [
        {
          url: `${
            (process.env.EXTERNAL_ROOT_PATH || "") +
            (process.env.ROOT_PATH || "")
          }/${path}`,
        },
      ];
      newResponse = JSON.stringify(responseJSON); // manipulate response
    } else if (req.originalUrl.endsWith(`/${path}/api.html`)) {
      newResponse = newResponse || responseBuffer.toString("utf8");
      newResponse = newResponse
        .replace(
          "'/api'",
          `'${
            (process.env.EXTERNAL_ROOT_PATH || "") +
            (process.env.ROOT_PATH || "")
          }/${path}/api'`
        )
        .replace(
          "'/docs/oauth2-redirect'",
          `'${
            (process.env.EXTERNAL_ROOT_PATH || "") +
            (process.env.ROOT_PATH || "")
          }/${path}/docs/oauth2-redirect'`
        ); // manipulate response
    }

    if (
      res.get("Content-Type") &&
      (res.get("Content-Type").includes("json") ||
        res.get("Content-Type").includes("html"))
    ) {
      newResponse = newResponse || responseBuffer.toString("utf8");
      newResponse = newResponse.replaceAll(
        target,
        `${req.protocol}://${req.get("host")}/${path}`
      );
    }

    return newResponse || finalReturn;
  });
};

module.exports = initAdjacentServersProxy;
