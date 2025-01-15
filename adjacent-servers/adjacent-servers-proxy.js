const {
  createProxyMiddleware,
  responseInterceptor,
} = require("http-proxy-middleware");

function initAdjacentServersProxy(app, isDocker, ensureAdmin) {
  ///////////////////////////
  // Proxies
  //// STAC
  if (process.env.WITH_STAC === "true") {
    app.use(
      `${process.env.ROOT_PATH || ""}/stac`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: `http://${isDocker ? "stac-fastapi" : "localhost"}:${
          process.env.STAC_PORT || 8881
        }`,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/stac`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("stac"),
        },
      })
    );
  }

  //// Tipg
  if (process.env.WITH_TIPG === "true") {
    app.use(
      `${process.env.ROOT_PATH || ""}/tipg`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: `http://${isDocker ? "tipg" : "localhost"}:${
          process.env.TIPG_PORT || 8882
        }`,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/tipg`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("tipg"),
        },
      })
    );
  }

  //// TiTiler
  if (process.env.WITH_TITILER === "true") {
    app.use(
      `${process.env.ROOT_PATH || ""}/titiler`,
      ensureAdmin(false, false, true, ["/cog/stac"]), // true to allow all GETs (except /cog/stac) - others require admin auth
      createProxyMiddleware({
        target: `http://${isDocker ? "titiler" : "localhost"}:${
          process.env.TITILER_PORT || 8883
        }`,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/titiler`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("titiler"),
        },
      })
    );
  }

  /// TiTiler-pgSTAC
  if (process.env.WITH_TITILER_PGSTAC === "true") {
    app.use(
      `${process.env.ROOT_PATH || ""}/titilerpgstac`,
      ensureAdmin(false, false, true), // true to allow all GETs - others require admin auth
      createProxyMiddleware({
        target: `http://${isDocker ? "titiler-pgstac" : "localhost"}:${
          process.env.TITILER_PGSTAC_PORT || 8884
        }`,
        changeOrigin: true,
        pathRewrite: {
          [`^${process.env.ROOT_PATH || ""}/titilerpgstac`]: "",
        },
        selfHandleResponse: true,
        on: {
          proxyRes: createSwaggerInterceptor("titilerpgstac"),
        },
      })
    );
  }
}

const createSwaggerInterceptor = (path) => {
  return responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    if (req.originalUrl.endsWith(`/${path}/api`)) {
      const response = JSON.parse(responseBuffer.toString("utf8")); // convert buffer to string
      response.servers = [
        {
          url: `${
            (process.env.EXTERNAL_ROOT_PATH || "") +
            (process.env.ROOT_PATH || "")
          }/${path}`,
        },
      ];
      return JSON.stringify(response); // manipulate response and return the result
    } else if (req.originalUrl.endsWith(`/${path}/api.html`)) {
      const response = responseBuffer.toString("utf8"); // convert buffer to string
      return response
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
        ); // manipulate response and return the result
    }
    return responseBuffer;
  });
};

module.exports = initAdjacentServersProxy;
