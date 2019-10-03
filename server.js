require("dotenv").config();

const fs = require("fs");
const http = require("http");
var path = require("path");
var bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const express = require("express");
var swaggerUi = require("swagger-ui-express");
var swaggerDocument = require("./public/docs/swagger.json");
var exec = require("child_process").exec;
var execFile = require("child_process").execFile;
const createError = require("http-errors");
const cors = require("cors");
const logger = require("./API/logger");
const rateLimit = require("express-rate-limit");

const session = require("express-session");
var MemoryStore = require("memorystore")(session);

const indexRouter = require("./API/routes/index");
const apiRouter = require("./API/routes/apis");
const configRouter = require("./API/routes/configs");
const usersRouter = require("./API/routes/users");
const filesRouter = require("./API/routes/files");
const drawRouter = require("./API/routes/draw").router;
const shortenerRouter = require("./API/routes/shortener");

//Username to use when not logged in
const guestUsername = "guest";

const apilimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200000 // limit each IP to 100 requests per windowMs
});
const APIlimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200000 // limit each IP to 100 requests per windowMs
});

// Load the permissions.json file, which maps LDAP groups to permission sets.
// This application has two permission sets: "users" and "admins".
let permissions = {};
permissions.users = process.env.CSSO_GROUPS
  ? JSON.parse(process.env.CSSO_GROUPS)
  : [];

// The port your application runs on must only be exposed locally. The CSSO
// proxy will run on a different port, which will be exposed externally.
const port = process.env.PORT || "3000";

const app = express();

/** set the session for application */
app.use(
  session({
    secret: process.env.SECRET || "Shhhh, it is a secret!",
    name: "MMGISSession",
    proxy: true,
    resave: false,
    cookie: { maxAge: 86400000 },
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  })
);

// Trust first proxy
app.set("trust proxy", 1);

app.use("/api/", apilimiter);
app.use("/API/", APIlimiter);

/***********************************************************
 * This part is for setting up the express framework and its
 * configuration for having more security
 **********************************************************/
const helmet = require("helmet");
app.use(helmet());
app.set("etag", false);
app.disable("x-powered-by");
app.disable("Origin");

app.use(cookieParser());

var swaggerOptions = {
  customCss: ".swagger-ui .topbar { display: none }"
};
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, swaggerOptions)
);

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
      if (Object.keys(req.groups).indexOf(process.env.CSSO_LEAD_GROUP) != -1) {
        req.groups[req.leadGroupName] = true;
      }
      req.user = req.get("X-Sub");
      req.session.user = req.user;
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

// Pug is used to render pages.
app.set("view engine", "pug");

// Ensure the CSSO handler runs on every request.
app.use(cssoHandler);

//app.use(logger('dev'));
//app.use(express.json());

app.use(bodyParser.json({ limit: "50mb" })); // support json encoded bodies
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true })); // support encoded bodies

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(cors());
// app.set('Origin', false);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(); //next(createError(404))
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

app.use("/dist", express.static(path.join(__dirname, "/dist")));
app.use("/public", express.static(path.join(__dirname, "/public")));
//app.use("/config", express.static(path.join(__dirname, "/config")));
app.use("/config/css", express.static(path.join(__dirname, "/config/css")));
app.use("/config/js", express.static(path.join(__dirname, "/config/js")));
app.use("/config/fonts", express.static(path.join(__dirname, "/config/fonts")));
app.use("/config/configconfig.json", express.static(path.join(__dirname, "/config/configconfig.json")));

app.use("/css", express.static(path.join(__dirname, "/css")));
app.use("/Missions", express.static(path.join(__dirname, "/Missions")));
app.use("/resources", express.static(path.join(__dirname, "/resources")));
app.use("/scripts", express.static(path.join(__dirname, "/scripts")));
//app.use("/API", express.static(path.join(__dirname, "/API")));

//app.use('/API', checkHeadersCodeInjection, indexRouter);
app.use("/API/users", checkHeadersCodeInjection, usersRouter);
app.use(
  "/API/configure",
  ensureAdmin(),
  checkHeadersCodeInjection,
  setContentType,
  configRouter
);
app.use("/API/apis", apiRouter);
app.use(
  "/API/files",
  checkHeadersCodeInjection,
  setContentType,
  stopGuests,
  filesRouter
);
app.use(
  "/API/draw",
  checkHeadersCodeInjection,
  setContentType,
  stopGuests,
  drawRouter
);
app.use(
  "/API/shortener",
  checkHeadersCodeInjection,
  setContentType,
  shortenerRouter
);

function setContentType(req, res, next) {
  res.setHeader("Content-Type", "application/json");
  next();
}

function checkHeadersCodeInjection(req, res, next) {
  let injectionWords = [
    "pass",
    "pw",
    "password",
    "delete",
    "insert",
    "update",
    "select",
    "disable",
    "enable",
    "drop",
    "set",
    "script",
    "<script>"
  ];

  let code_injected = false;

  // Get the whole requested link from users
  let fullUrl = req.protocol + "://" + req.get("host") + "/apis" + req.url;
  let lowerURL = fullUrl.toLowerCase();

  for (w in injectionWords) {
    if (lowerURL.includes(injectionWords[w])) {
      code_injected = true;
    }
  }

  if (code_injected) {
    res.send({
      Warning:
        "You are not allowed to inject bad code to the application. Your action will be reported!",
      "Your IP": req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      "Requested URL": fullUrl
    });
    res.end();
  } else {
    // Set header parameters for this request
    // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:80');
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:8642");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    // res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requsted-with, Content-Type, Methods"
    );

    let responseHeader = {
      "x-dns-prefetch-control": res.getHeader("x-dns-prefetch-control"),
      "x-frame-options": res.getHeader("x-frame-options"),
      "strict-transport-security": res.getHeader("strict-transport-security"),
      "x-download-options": res.getHeader("x-download-options"),
      "x-content-type-options": res.getHeader("x-content-type-options"),
      "x-xss-protection": res.getHeader("x-xss-protection"),
      "access-control-allow-origin": res.getHeader(
        "access-control-allow-origin"
      ),
      "access-control-allow-methods": res.getHeader(
        "access-control-allow-methods"
      ),
      "content-type": res.getHeader("content-type")
    };

    let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    next();
  }
}

function stopGuests(req, res, next) {
  let url = req.originalUrl.split("?")[0];
  if (
    url === "/api/configure/get" ||
    url === "/api/configure/missions" ||
    url === "/API/files/getfile"
  ) {
    next();
    return;
  }

  if (req.user == guestUsername) {
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
    if (process.env.AUTH == "none") {
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

function ensureAdmin(toLoginPage) {
  return (req, res, next) => {
    let url = req.originalUrl.split("?")[0];
    if (
      url == "/api/configure/get" ||
      url === "/api/configure/missions" ||
      req.session.permission === "111"
    )
      next();
    else if (toLoginPage) res.render("login", { user: req.user });
    else {
      res.send({ status: "failure", message: "Unauthorized!" });
      logger.info("Unauthorized call made and rejected: " + req.originalUrl);
    }
    return;
  };
}

// Each calls the ensureGroup middleware,
// passing to it an array of LDAP group names (which were loaded
// from the permissions.json file at the top of the file).

// PAGES
app.get("/", ensureGroup(permissions.users), (req, res) => {
  const user = process.env.AUTH === "csso" ? req.user : guestUsername;
  const groups = req.groups ? Object.keys(req.groups) : [];
  res.render("index", {
    user: user,
    groups: JSON.stringify(groups),
    AUTH: process.env.AUTH,
    NODE_ENV: process.env.NODE_ENV,
    CONFIGCONFIG_PATH: process.env.CONFIGCONFIG_PATH,
    FORCE_CONFIG_PATH: process.env.FORCE_CONFIG_PATH
  });
});

// API
//TEST
app.post("/api/test", function(req, res) {
  res.send("Hello World!");
});

if (
  !process.env.hasOwnProperty("HIDE_CONFIG") ||
  process.env.HIDE_CONFIG != "true"
) {
  app.get(
    "/configure",
    ensureGroup(permissions.users),
    ensureAdmin(true),
    (req, res) => {
      const user = process.env.AUTH === "csso" ? req.user : null;
      res.render("configure", {
        user: user,
        AUTH: process.env.AUTH,
        NODE_ENV: process.env.NODE_ENV,
        CONFIGCONFIG_PATH: process.env.CONFIGCONFIG_PATH
      });
    }
  );

  //config verify
  app.post("/api/config/verify", ensureGroup(permissions.users), ensureAdmin(), function(
    req,
    res
  ) {
    const m = encodeURIComponent(req.body.m);
    const p = encodeURIComponent(req.body.p);

    execFile("php", ["private/api/verify.php", m, p], function(
      error,
      stdout,
      stderr
    ) {
      res.send(stdout);
    });
  });

  //config write_json
  app.post("/api/config/write_json", ensureGroup(permissions.users), ensureAdmin(), function(
    req,
    res
  ) {
    //const filename = req.body.filename;
    const mission = req.body.mission;
    const json = req.body.json;

    fs.writeFile("Missions/" + mission + "/config.json", json, "utf8", function(
      err
    ) {
      if (err) res.send("failure");
      else res.send("success");
    });
  });

  //config make_mission
  app.post("/api/config/make_mission", ensureGroup(permissions.users), ensureAdmin(), function(
    req,
    res
  ) {
    const m = encodeURIComponent(req.body.missionname);
    const p = encodeURIComponent(req.body.password);

    execFile("php", ["private/api/make_mission.php", m, p], function(
      error,
      stdout,
      stderr
    ) {
      res.send(stdout);
    });
  });

  //config delete_mission
  app.post(
    "/api/config/delete_mission",
    ensureGroup(permissions.users),
    ensureAdmin(),
    function(req, res) {
      const m = encodeURIComponent(req.body.mission);

      execFile("php", ["private/api/delete_mission.php", m], function(
        error,
        stdout,
        stderr
      ) {
        res.send(stdout);
      });
    }
  );

  //config clone_mission
  app.post(
    "/api/config/clone_mission",
    ensureGroup(permissions.users),
    ensureAdmin(),
    function(req, res) {
      const existing = encodeURIComponent(req.body.existing);
      const cloneName = encodeURIComponent(req.body.cloneName);
      const clonePassword = encodeURIComponent(req.body.clonePassword);

      execFile(
        "php",
        ["private/api/clone_mission.php", existing, cloneName, clonePassword],
        function(error, stdout, stderr) {
          res.send(stdout);
        }
      );
    }
  );

  //config rename_mission
  app.post(
    "/api/config/rename_mission",
    ensureGroup(permissions.users),
    ensureAdmin(),
    function(req, res) {
      const mission = encodeURIComponent(req.body.mission);
      const tomission = encodeURIComponent(req.body.tomission);

      execFile(
        "php",
        ["private/api/rename_mission.php", mission, tomission],
        function(error, stdout, stderr) {
          res.send(stdout);
        }
      );
    }
  );
}

//utils getprofile
app.post("/api/utils/getprofile", ensureGroup(permissions.users), function(
  req,
  res
) {
  const path = encodeURIComponent(req.body.path);
  const lat1 = encodeURIComponent(req.body.lat1);
  const lon1 = encodeURIComponent(req.body.lon1);
  const lat2 = encodeURIComponent(req.body.lat2);
  const lon2 = encodeURIComponent(req.body.lon2);
  const steps = encodeURIComponent(req.body.steps);
  const axes = encodeURIComponent(req.body.axes);

  execFile(
    "php",
    ["private/api/getprofile.php", path, lat1, lon1, lat2, lon2, steps, axes],
    function(error, stdout, stderr) {
      res.send(stdout);
    }
  );
});

//utils getpoint
app.post(
  "/api/utils/lnglats_to_demtile_elevs",
  ensureGroup(permissions.users),
  function(req, res) {
    const lnglats = req.body.lnglats;
    const demtilesets = req.body.demtilesets;

    execFile(
      "php",
      ["private/api/lnglats_to_demtile_elevs.php", lnglats, demtilesets],
      function(error, stdout, stderr) {
        res.send(stdout);
      }
    );
  }
);

//utils getpoint
app.post("/api/utils/getpoint", ensureGroup(permissions.users), function(
  req,
  res
) {
  const path = encodeURIComponent(req.body.path);
  const lat = encodeURIComponent(req.body.lat);
  const lon = encodeURIComponent(req.body.lon);

  execFile("php", ["private/api/getpoint.php", path, lat, lon], function(
    error,
    stdout,
    stderr
  ) {
    res.send(stdout);
  });
});

//utils getbands
app.post("/api/utils/getbands", ensureGroup(permissions.users), function(
  req,
  res
) {
  const path = encodeURIComponent(req.body.path);
  const x = encodeURIComponent(req.body.x);
  const y = encodeURIComponent(req.body.y);
  const xyorll = encodeURIComponent(req.body.xyorll);
  const bands = encodeURIComponent(req.body.bands);

  execFile(
    "php",
    ["private/api/getbands.php", path, x, y, xyorll, bands],
    function(error, stdout, stderr) {
      res.send(stdout);
    }
  );
});

//draw write_to_polygon_geojson
app.post(
  "/api/draw/write_to_polygon_geojson",
  ensureGroup(permissions.users),
  function(req, res) {
    const rawfilename = req.body.rawfilename;
    const mode = req.body.mode;
    const featuretodelete = req.body.featuretodelete || "null";
    const feature = req.body.feature || "null";
    const replacing = req.body.replacing || "null";
    const replacer = req.body.replacer || "null";
    const movingTo = req.body.movingTo || "null";
    const moving = req.body.moving || "null";
    const mission = req.body.mission || "";

    execFile(
      "php",
      [
        "private/api/write_to_polygon_geojson.php",
        rawfilename,
        mode,
        featuretodelete,
        feature,
        replacing,
        replacer,
        movingTo,
        moving,
        mission
      ],
      function(error, stdout, stderr) {
        res.send(stdout);
      }
    );
  }
);

//files getfiledata
app.post("/api/files/getfiledata", ensureGroup(permissions.users), function(
  req,
  res
) {
  const filename = req.body.filename;
  const mission = req.body.mission || "";

  execFile("php", ["private/api/getfiledata.php", filename, mission], function(
    error,
    stdout,
    stderr
  ) {
    res.send(stdout);
  });
});

//files getalluserswithfiles
app.post(
  "/api/files/getalluserswithfiles",
  ensureGroup(permissions.users),
  function(req, res) {
    const username = req.body.username;
    const mission = req.body.mission || "";

    execFile(
      "php",
      ["private/api/getalluserswithfiles.php", username, mission],
      function(error, stdout, stderr) {
        res.send(stdout);
      }
    );
  }
);

//files getproperties
app.post("/api/files/getproperties", ensureGroup(permissions.users), function(
  req,
  res
) {
  const filename = req.body.filename;
  const mission = req.body.mission || "";

  execFile(
    "php",
    ["private/api/getproperties.php", filename, mission],
    function(error, stdout, stderr) {
      res.send(stdout);
    }
  );
});

//files saveproperties
app.post("/api/files/saveproperties", ensureGroup(permissions.users), function(
  req,
  res
) {
  const filename = req.body.filename;
  const name = req.body.name;
  const description = req.body.description;
  const public = req.body.public;
  const mission = req.body.mission || "";

  execFile(
    "php",
    [
      "private/api/saveproperties.php",
      filename,
      name,
      description,
      public,
      mission
    ],
    function(error, stdout, stderr) {
      res.send(stdout);
    }
  );
});

//files createfile
app.post("/api/files/createfile", ensureGroup(permissions.users), function(
  req,
  res
) {
  const username = req.body.username;
  const name = req.body.name;
  const filedata = req.body.filedata || "";
  const mission = req.body.mission || "";

  execFile(
    "php",
    ["private/api/createfile.php", username, name, filedata, mission],
    function(error, stdout, stderr) {
      res.send(stdout);
    }
  );
});

//files deletefile
app.post("/api/files/deletefile", ensureGroup(permissions.users), function(
  req,
  res
) {
  const filename = req.body.filename;
  const mission = req.body.mission || "";

  execFile("php", ["private/api/deletefile.php", filename, mission], function(
    error,
    stdout,
    stderr
  ) {
    res.send(stdout);
  });
});

const httpServer = http.createServer(app);

// Start listening for requests.
httpServer.listen(port, err => {
  if (err) {
    console.log(err);
    return err;
  }
  logger.info("MMGIS successfully started! It's listening on port: " + port);
});
