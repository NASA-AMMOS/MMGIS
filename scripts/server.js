require("dotenv").config();

const fs = require("fs");
const http = require("http");
const https = require("https");
const { Pool } = require("pg");
var path = require("path");
const packagejson = require("../package.json");
var bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const express = require("express");
var swaggerUi = require("swagger-ui-express");
var swaggerDocumentMain = require("../documentation/pages/swaggers/swaggerMain.json");

const createError = require("http-errors");
const cors = require("cors");
const logger = require("../API/logger");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

const session = require("express-session");

const apiRouter = require("../API/Backend/APIs/routes/apis");

const testEnv = require("../API/testEnv");

const utils = require("../API/utils");

const { sequelize } = require("../API/connection");

const setups = require("../API/setups");

const { updateTools } = require("../API/updateTools");

const { websocket } = require("../API/websocket");

const { setSPICEKernelDownloadSchedule } = require("../spice/getKernels");

const initAdjacentServersProxy = require("../adjacent-servers/adjacent-servers-proxy");
const adjacentServers = require("../adjacent-servers/adjacent-servers");

const WebSocket = require("isomorphic-ws");

const chalk = require("chalk");
const webpack = require("webpack");
const WebpackDevServer = require("webpack-dev-server");
const clearConsole = require("react-dev-utils/clearConsole");
const checkRequiredFiles = require("react-dev-utils/checkRequiredFiles");
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
} = require("react-dev-utils/WebpackDevServerUtils");
const openBrowser = require("react-dev-utils/openBrowser");
const paths = require("../configuration/paths");
const configFactory = require("../configuration/webpack.config");
const createDevServerConfig = require("../configuration/webpackDevServer.config");

const middleware = require("./middleware").middleware;

const isDevEnv = process.env.NODE_ENV === "development";

//Username to use when not logged in
const guestUsername = "guest";

const ROOT_PATH = isDevEnv ? "" : process.env.ROOT_PATH || "";

if (!(process.env.PUBLIC_URL == null || process.env.PUBLIC_URL == ""))
  logger(
    "warn",
    `The 'PUBLIC_URL' env is deprecated. Please using 'ROOT_PATH' instead.`
  );

const rootDir = `${__dirname}/..`;

///////////////////////////
const app = express();

const isDocker = utils.isDocker();
process.env.IS_DOCKER = isDocker ? "true" : "false";

const apilimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20000, // limit each IP to 100 requests per windowMs
});
const APIlimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20000, // limit each IP to 100 requests per windowMs
});

// Load the permissions.json file, which maps LDAP groups to permission sets.
// This application has two permission sets: "users" and "admins".
let permissions = {};
permissions.users = process.env.CSSO_GROUPS
  ? JSON.parse(process.env.CSSO_GROUPS)
  : [];

// The port your application runs on must only be exposed locally. The CSSO
// proxy will run on a different port, which will be exposed externally.
const port = parseInt(process.env.PORT || "8888", 10);

/** set the session for application */
const cookieOptions = { maxAge: 86400000 };
if (process.env.THIRD_PARTY_COOKIES === "true") {
  cookieOptions.sameSite = "None";
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT || "5432",
});
app.use(
  session({
    secret: process.env.SECRET || "Shhhh, it is a secret!",
    name: "MMGISSession",
    proxy: true,
    resave: false,
    cookie: cookieOptions,
    saveUninitialized: false,
    store: new (require("connect-pg-simple")(session))({
      pool,
    }),
  })
);

if (process.env.SPICE_SCHEDULED_KERNEL_DOWNLOAD === "true")
  setSPICEKernelDownloadSchedule(
    process.env.SPICE_SCHEDULED_KERNEL_DOWNLOAD_ON_START,
    process.env.SPICE_SCHEDULED_KERNEL_CRON_EXPR
  );

///

///////////////////////////

// This is application-level middleware, written to run for all requests.
const cssoHandler = (req, res, next) => {
  // For this application, every HTTP request is a direct response to user
  // activity, so we can set the activity header to true on every response.
  res.set("X-Activity", "true");

  //Also hardcoded a few places on the front-end and maybe initial Lead file creation
  req.leadGroupName = "mmgis-group";

  // Get the user's and username information from the request headers and set
  // them as attributes of the req object.

  if (process.env.AUTH == "csso") {
    if (req.get("X-Groups") !== undefined) {
      req.groups = JSON.parse(
        Buffer.from(req.get("X-Groups"), "base64").toString("ascii")
      );
      if (req.groups[process.env.CSSO_LEAD_GROUP] === true) {
        req.groups[req.leadGroupName] = true;
      }
      req.user = req.get("X-Sub");
      req.session.user = req.user;
      let cssoSessionID = req.get("X-Session");
      if (cssoSessionID) req.cssoSessionID = cssoSessionID;
    }
  } else {
    req.user = req.session.user || guestUsername;
    let leads = process.env.LEADS ? JSON.parse(process.env.LEADS) : [];
    if (leads.indexOf(req.user) != -1) {
      req.groups = {};
      req.groups[req.leadGroupName] = true;
    } else {
      req.groups = {};
    }
  }

  next();
};

function setContentType(req, res, next) {
  res.setHeader("Content-Type", "application/json");
  next();
}

function checkHeadersCodeInjection(req, res, next) {
  let injectionWords = [
    "pass",
    "pw",
    "password",
    "insert",
    "select",
    "disable",
    "enable",
    "drop",
    "script",
    "<script>",
  ];

  let code_injected = false;

  // Get the whole requested link from users
  let fullUrl = req.protocol + "://" + req.get("host") + "/apis" + req.url;
  let lowerURL = fullUrl.toLowerCase();

  for (let w in injectionWords) {
    if (lowerURL.includes(injectionWords[w])) {
      code_injected = true;
    }
  }

  if (code_injected) {
    res.send({
      Warning:
        "You are not allowed to inject bad code to the application. Your action will be reported!",
      "Your IP": req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      "Requested URL": fullUrl,
    });
    res.end();
  } else {
    // Set header parameters for this request
    // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:80');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    // res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-with, Content-Type, Methods"
    );
    next();
  }
}

function stopGuests(req, res, next) {
  let url = req.originalUrl.split("?")[0].toLowerCase();

  if (
    url.endsWith("/api/configure/get") ||
    url.endsWith("/api/configure/missions") ||
    url.endsWith("/api/files/getfile")
  ) {
    next();
    return;
  }

  if (req.user == guestUsername || process.env.AUTH === "off") {
    res.send({ status: "failure", message: "User is not logged in." });
    res.end();
    return;
  } else next();
}

/**
 * ensureGroup - Checks if user is in ANY of the allowed groups.
 *
 * Returns an Express/Connect middleware function that calls the next handler
 * if the user is authorized, and sends a 403 Forbidden error message if not.
 *
 * @param {array} allowedGroups - An array of group names.
 * @return {function}
 */
function ensureGroup(allowedGroups) {
  return (req, res, next) => {
    // req.groups is an object, set by cssoHandler (which runs on every
    // request), where each key is a group and each value is a boolean
    // indicating if the user is in that group. For each allowed group, this
    // will check if the group is present in req.groups, and if the value for
    // that group is True. If that is the case, continue to the next handler,
    // otherwise continue checking the list of allowed groups. If the user is
    // not in any allowed groups, the next handler will never be called and a
    // 403 Forbidden response will be returned to the user.
    //console.log( 'ensureGroup', req );
    if (process.env.AUTH != "csso") {
      next();
      return;
    }

    if (req.groups !== undefined) {
      for (const group of allowedGroups) {
        if (Object.keys(req.groups).indexOf(group) != -1 && req.groups[group]) {
          next();
          return;
        } else if (process.env.NODE_ENV === "development") {
          next();
          return;
        }
      }
    } else if (process.env.NODE_ENV === "development") {
      next();
      return;
    }

    res.render("unauthorized", { user: req.user });
    return;
  };
}

function ensureAdmin(toLoginPage, denyLongTermTokens, allowGets, disallow) {
  return (req, res, next) => {
    let url = req.originalUrl.split("?")[0].toLowerCase();
    const remoteAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    if (
      url.endsWith("/api/configure/get") ||
      url.endsWith("/api/configure/missions") ||
      url.endsWith("/api/geodatasets/get") ||
      url.endsWith("/api/geodatasets/search") ||
      url.endsWith("/api/datasets/get") ||
      req.session.permission === "111"
    ) {
      next();
      return;
    }

    if (allowGets === true && req.method === "GET") {
      if (
        disallow == null ||
        disallow.filter((path) => url.endsWith(path)).length == 0
      ) {
        next();
        return;
      }
    }

    if (toLoginPage) {
      res.render("adminlogin", { user: req.user });
      return;
    }

    if (!denyLongTermTokens && req.headers.authorization) {
      validateLongTermToken(
        req.headers.authorization,
        () => {
          req.isLongTermToken = true;
          next();
        },
        () => {
          res.send({ status: "failure", message: "Unauthorized Token!" });
          logger(
            "warn",
            `Unauthorized token call made and rejected (from ${remoteAddress}, with token ${req.headers.authorization})`,
            req.originalUrl,
            req
          );
        }
      );
      return;
    }

    res.send({ status: "failure", message: "Unauthorized!" });
    logger(
      "warn",
      `Unauthorized call made and rejected (from ${remoteAddress})`,
      req.originalUrl,
      req
    );
    return;
  };
}

function validateLongTermToken(token, successCallback, failureCallback) {
  token = token.replace(/Bearer:?\s+/g, "");

  sequelize
    .query('SELECT * FROM "long_term_tokens" WHERE "token"=:token', {
      replacements: {
        token: token,
      },
    })
    .then((result) => {
      try {
        result = result[0][0];
      } catch (err) {
        failureCallback();
      }

      if (
        result &&
        result.token == token &&
        (result.period == "never" ||
          Date.now() - new Date(result.createdAt).getTime() <
            parseInt(result.period))
      ) {
        successCallback(result);
      } else {
        failureCallback();
      }
    });
}

function ensureUser() {
  return (req, res, next) => {
    if (
      process.env.AUTH != "local" ||
      (typeof req.session.permission === "string" &&
        req.session.permission[req.session.permission.length - 1] === "1")
    ) {
      next();
    } else {
      if (req.headers.authorization) {
        const remoteAddress =
          req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        validateLongTermToken(
          req.headers.authorization,
          () => {
            req.isLongTermToken = true;
            next();
          },
          () => {
            res.send({ status: "failure", message: "Unauthorized Token!" });
            logger(
              "warn",
              `Unauthorized token call made and rejected (from ${remoteAddress}, with token ${req.headers.authorization})`,
              req.originalUrl,
              req
            );
          }
        );
      } else {
        res.render("login", {
          user: req.user,
          CLEARANCE_NUMBER: process.env.CLEARANCE_NUMBER || "CL##-####",
        });
      }
    }
    return;
  };
}

var swaggerOptions = {
  customCssUrl: "/documentation/pages/swaggers/swaggerCSS.css",
  customJs: "/documentation/pages/swaggers/swaggerJS.js",
};

const useSwaggerSchema =
  (schema) =>
  (...args) =>
    swaggerUi.setup(schema, swaggerOptions)(...args);

///
adjacentServers();
initAdjacentServersProxy(app, isDocker, ensureAdmin);
//

let s = {
  app: app,
  cssoHandler,
  setContentType,
  checkHeadersCodeInjection,
  stopGuests,
  ensureGroup,
  ensureAdmin,
  ensureUser,
  swaggerUi,
  useSwaggerSchema,
  permissions,
  ROOT_PATH,
};

// Trust first proxy
app.set("trust proxy", 1);

app.use("/api/", apilimiter);
app.use("/API/", APIlimiter);

// gzip!!
app.use(compression({ filter: shouldCompress }));
function shouldCompress(req, res) {
  // Disable compression of images since they're already compressed
  if (
    req.headers["content-type"] &&
    req.headers["content-type"].indexOf("image") != -1
  ) {
    return false;
  }

  // fallback to standard filter function
  return compression.filter(req, res);
}

/***********************************************************
 * This part is for setting up the express framework and its
 * configuration for having more security
 **********************************************************/
const helmet = require("helmet");
let helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "blob:", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["*", "data:", "blob:", "'unsafe-inline'"],
      styleSrc: ["*", "data:", "blob:", "'unsafe-inline'"],
      fontSrc: ["*", "data:", "blob:", "'unsafe-inline'"],
      connectSrc: ["*"],
      frameAncestors: process.env.FRAME_ANCESTORS
        ? JSON.parse(process.env.FRAME_ANCESTORS)
        : "none",
      frameSrc: process.env.FRAME_SRC
        ? JSON.parse(process.env.FRAME_SRC)
        : "none",
    },
  },
};

app.use(helmet(helmetConfig));

app.set("etag", false);
app.disable("x-powered-by");
app.disable("Origin");

app.use(
  `${ROOT_PATH}/api/docs/main`,
  swaggerUi.serve,
  useSwaggerSchema(swaggerDocumentMain)
);

// Pug is used to render pages.
app.set("view engine", "pug");

// Ensure the CSSO handler runs on every request.
app.use(cssoHandler);

//app.use(logger('dev'));
//app.use(express.json());

app.use(bodyParser.json({ limit: "500mb" })); // support json encoded bodies
app.use(bodyParser.urlencoded({ limit: "500mb", extended: true })); // support encoded bodies

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(cors());
// app.set('Origin', false);

/*Require all dynamic backend setup scripts
and return functions that bulk run their functions
*/
setups.getBackendSetups(function (setups) {
  //Sync all tables
  sequelize
    .sync()
    .then(() => {
      logger(
        "success",
        "All needed tables exist or have been successfully created!",
        "server"
      );

      //////Setups SYNC//////
      setups.synced(s);

      return null;
    })
    .catch((error) =>
      logger(
        "infrastructure_error",
        "Database tables might not be synced properly! " + error,
        "server"
      )
    );

  // STATICS

  app.use(
    `${ROOT_PATH}/build`,
    ensureUser(),
    express.static(path.join(rootDir, "/build"))
  );
  app.use(
    `${ROOT_PATH}/documentation`,
    express.static(path.join(rootDir, "/documentation"))
  );
  app.use(
    `${ROOT_PATH}/docs/helps`,
    express.static(path.join(rootDir, "/docs/helps"))
  );
  app.use(
    `${ROOT_PATH}/README.md`,
    express.static(path.join(rootDir, "/README.md"))
  );
  app.use(
    `${ROOT_PATH}/config/login`,
    express.static(path.join(rootDir, "/config/login"))
  );
  app.use(
    `${ROOT_PATH}/config/css`,
    ensureUser(),
    express.static(path.join(rootDir, "/config/css"))
  );
  app.use(
    `${ROOT_PATH}/config/js`,
    ensureUser(),
    express.static(path.join(rootDir, "/config/js"))
  );
  app.use(
    `${ROOT_PATH}/config/pre`,
    ensureUser(),
    express.static(path.join(rootDir, "/config/pre"))
  );
  app.use(
    `${ROOT_PATH}/config/fonts`,
    ensureUser(),
    express.static(path.join(rootDir, "/config/fonts"))
  );
  app.use(
    `${ROOT_PATH}/configure/build`,
    ensureUser(),
    express.static(path.join(rootDir, "/configure/build"))
  );
  app.use(
    `${ROOT_PATH}/configure/public`,
    ensureUser(),
    express.static(path.join(rootDir, "/configure/public"))
  );

  if (process.argv.includes("--with_examples"))
    app.use(
      `${ROOT_PATH}/examples`,
      express.static(path.join(rootDir, "/examples"))
    );
  app.use(`${ROOT_PATH}/public`, express.static(path.join(rootDir, "/public")));
  app.use(
    `${ROOT_PATH}/Missions`,
    ensureUser(),
    middleware.missions(),
    express.static(path.join(rootDir, "/Missions"))
  );

  if (isDevEnv) {
    app.use(
      `${ROOT_PATH}/css`,
      ensureUser(),
      express.static(path.join(rootDir, "/css"))
    );
    app.use(
      `${ROOT_PATH}/src`,
      ensureUser(),
      express.static(path.join(rootDir, "/src"))
    );
  }

  // Disable for now
  //app.use("/API/apis", apiRouter);

  // PAGES

  //docs
  app.get(
    `${ROOT_PATH}/docs`,
    ensureUser(),
    ensureGroup(permissions.users),
    (req, res) => {
      res.render("docs", {});
    }
  );

  // Validate envs
  if (process.env.NODE_ENV === "development") {
    console.log(chalk.cyan("Validating Environment Variables...\n"));
  }
  testEnv.test(setups.envs, port);

  // Attach any tool plugins to the application
  // We're only doing this for dev because we're assuming
  // build will also call this.
  if (process.env.NODE_ENV === "development") {
    console.log(chalk.cyan("Updating Tools...\n"));
    updateTools();
  }

  //////Setups Init//////
  setups.init(s);

  let httpServer;
  if (process.env.HTTPS == "true") {
    httpServer = https.createServer(
      {
        key: fs.readFileSync(process.env.HTTPS_KEY),
        cert: fs.readFileSync(process.env.HTTPS_CERT),
      },
      app
    );
  } else httpServer = http.createServer(app);

  // Start listening for requests.
  httpServer.listen(port, (err) => {
    if (process.env.NODE_ENV === "development") {
      setTimeout(setupDevServer, 2000);
      app.get("/", ensureUser(), (req, res) => {
        res.redirect(`http://localhost:${port + 1}`);
      });
    } else {
      // Each calls the ensureGroup middleware,
      // passing to it an array of LDAP group names (which were loaded
      // from the permissions.json file at the top of the file).

      app.get(
        `${ROOT_PATH}/`,
        ensureUser(),
        ensureGroup(permissions.users),
        (req, res) => {
          let user = guestUsername;
          if (process.env.AUTH === "csso" || req.user != null) user = req.user;

          let permission = "000";
          if (process.env.AUTH === "csso") permission = "001";
          if (req.session.permission) permission = req.session.permission;

          const groups = req.groups ? Object.keys(req.groups) : [];
          res.render("../build/index.pug", {
            user: user,
            permission: permission,
            groups: JSON.stringify(groups),
            AUTH: process.env.AUTH,
            NODE_ENV: process.env.NODE_ENV,
            VERSION: packagejson.version,
            FORCE_CONFIG_PATH: process.env.FORCE_CONFIG_PATH,
            CLEARANCE_NUMBER: process.env.CLEARANCE_NUMBER,
            LINK_PREVIEW_TITLE: process.env.LINK_PREVIEW_TITLE || "MMGIS",
            LINK_PREVIEW_DESCRIPTION:
              process.env.LINK_PREVIEW_DESCRIPTION ||
              "A web-based mapping and localization solution for science operation on planetary missions.",
            ENABLE_MMGIS_WEBSOCKETS: process.env.ENABLE_MMGIS_WEBSOCKETS,
            MAIN_MISSION: process.env.MAIN_MISSION,
            IS_DOCKER: process.env.IS_DOCKER,
            SKIP_CLIENT_INITIAL_LOGIN: process.env.SKIP_CLIENT_INITIAL_LOGIN,
            THIRD_PARTY_COOKIES: process.env.THIRD_PARTY_COOKIES,
            PORT: process.env.PORT,
            ROOT_PATH: ROOT_PATH,
            WEBSOCKET_ROOT_PATH: process.env.WEBSOCKET_ROOT_PATH,
            HOSTS: JSON.stringify({
              scienceIntent: process.env.SCIENCE_INTENT_HOST,
            }),
          });
        }
      );
    }
    if (err) {
      logger("infrastructure_error", "MMGIS did not start!", "server");
      return err;
    }

    //////Setups Started//////
    setups.started(s);

    // error handler
    app.all("*", (req, res, next) => {
      // render the error page
      res.status(404).render("error");
    });

    logger(
      "success",
      "MMGIS successfully started! It's listening on port: " + port,
      "server"
    );

    if (process.env.ENABLE_MMGIS_WEBSOCKETS) {
      console.log(chalk.cyan("Starting websocket...\n"));
      websocket.init(httpServer);
    }
  });
});

function setupDevServer() {
  const HOST = "localhost";
  const config = configFactory("development");
  const protocol = process.env.HTTPS === "true" ? "https" : "http";
  const appName = require(paths.appPackageJson).name;
  const useYarn = fs.existsSync(paths.yarnLockFile);
  const useTypeScript = fs.existsSync(paths.appTsConfig);
  const isInteractive = process.stdout.isTTY;
  const tscCompileOnError = process.env.TSC_COMPILE_ON_ERROR === "true";
  const urls = prepareUrls(
    protocol,
    HOST,
    port,
    paths.publicUrlOrPath.slice(0, -1)
  );
  const devSocket = {
    warnings: (warnings) =>
      devServer.sockWrite(devServer.sockets, "warnings", warnings),
    errors: (errors) =>
      devServer.sockWrite(devServer.sockets, "errors", errors),
  };
  // Create a webpack compiler that is configured with custom messages.
  const compiler = createCompiler({
    appName,
    config,
    devSocket,
    urls,
    useYarn,
    useTypeScript,
    tscCompileOnError,
    webpack,
  });
  // Load proxy config
  const proxySetting = `http://localhost:${port}`;
  const proxyConfig = prepareProxy(
    proxySetting,
    paths.appPublic,
    paths.publicUrlOrPath
  );

  // Serve webpack assets generated by the compiler over a web server.
  const serverConfig = createDevServerConfig(proxyConfig, urls.lanUrlForConfig);
  const devServer = new WebpackDevServer(serverConfig, compiler);

  // Launch WebpackDevServer.
  //devServer.listen(port + 1, HOST, (err) => {
  devServer.startCallback((err) => {
    if (err) {
      return console.log(err);
    }
    if (isInteractive) {
      clearConsole();
    }

    // We used to support resolving modules according to `NODE_PATH`.
    // This now has been deprecated in favor of jsconfig/tsconfig.json
    // This lets you use absolute paths in imports inside large monorepos:
    if (process.env.NODE_PATH) {
      console.log(
        chalk.yellow(
          "Setting NODE_PATH to resolve modules absolutely has been deprecated in favor of setting baseUrl in jsconfig.json (or tsconfig.json if you are using TypeScript) and will be removed in a future major release of create-react-app."
        )
      );
      console.log();
    }

    console.log(chalk.cyan("Starting the development server...\n"));
  });

  ["SIGINT", "SIGTERM"].forEach(function (sig) {
    process.on(sig, function () {
      devServer.stop();
      process.exit();
    });
  });
}
