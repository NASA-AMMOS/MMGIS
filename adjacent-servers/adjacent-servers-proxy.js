const {
  createProxyMiddleware,
  responseInterceptor,
} = require("http-proxy-middleware");

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
        xfwd: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/stac`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("stac", stacTarget),
          proxyReq: (proxyReq, req, res) => {
            // Always set X-Forwarded-Proto to the first value or to req.protocol
            proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
          },
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
        xfwd: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/tipg`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("tipg", tipgTarget),
          proxyReq: (proxyReq, req, res) => {
            // Always set X-Forwarded-Proto to the first value or to req.protocol
            proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
          },
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
        xfwd: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/titiler`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("titiler", titilerTarget),
          proxyReq: (proxyReq, req, res) => {
            // Always set X-Forwarded-Proto to the first value or to req.protocol
            proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
          },
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
        xfwd: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/titilerpgstac`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor(
            "titilerpgstac",
            titilerpgstacTarget
          ),
          proxyReq: (proxyReq, req, res) => {
            // Always set X-Forwarded-Proto to the first value or to req.protocol
            proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
          },
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
      // Build regex to match any backend URL with port (both http and https)
      const backendUrlRegex = new RegExp(
        `https?://[^/]+(?::\\d+)+/?`,
        "g"
      );
      // Build the public path
      const publicPath = `${(req.protocol || "http").split(",")[0]}://${req.get("host")}${(process.env.EXTERNAL_ROOT_PATH || "") + (process.env.ROOT_PATH || "")}/${path}/`;
      // Replace all backend URLs with the public path
      newResponse = newResponse.replace(backendUrlRegex, publicPath);
    }

    return newResponse || finalReturn;
  });
};

module.exports = initAdjacentServersProxy;
