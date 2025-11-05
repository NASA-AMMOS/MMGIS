require("dotenv").config();
const express = require("express");
const http = require("http");
const fetch = require("node-fetch");
const setup = require("../API/Frozon-MMGIS-Plugin-Backend/Agent/setup");

(async () => {
  const app = express();
  const server = http.createServer(app);

  const s = {
    app,
    ROOT_PATH: "",
    checkHeadersCodeInjection: (req, _res, next) => next(),
    setContentType: (_req, res, next) => {
      res.setHeader("Content-Type", "application/json");
      next();
    },
  };
  setup.onceInit(s);

  const addr = await new Promise((resolve) => {
    const srv = server.listen(0, () => resolve(srv.address()));
  });
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    const r = await fetch(base + "/api/agent/tools");
    const j = await r.json();
    const ok = Array.isArray(j.tools) && j.tools.length > 0;
    console.log(`${ok ? "PASS" : "FAIL"}: GET /api/agent/tools`);
  } catch (e) {
    console.log("FAIL: GET /api/agent/tools", e && e.message);
  }

  server.close();
})();
