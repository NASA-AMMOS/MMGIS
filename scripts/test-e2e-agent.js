require("dotenv").config();
const express = require("express");
const http = require("http");
const fetch = require("node-fetch");
const path = require("path");
const setup = require("../API/Backend/Agent/setup");

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

  // GET /api/agent/tools
  try {
    const r = await fetch(base + "/api/agent/tools");
    const j = await r.json();
    const ok = Array.isArray(j.tools) && j.tools.length > 0;
    console.log(`${ok ? "PASS" : "FAIL"}: GET /api/agent/tools`);
  } catch (e) {
    console.log("FAIL: /api/agent/tools", e && e.message);
  }

  // POST /api/agent/exec web_search_product
  try {
    const r = await fetch(base + "/api/agent/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: {
          tool: "web_search_product",
          args: { query: "nasa earthdata" },
        },
      }),
    });
    const j = await r.json();
    const ok = j && j.ok === true && j.result && Array.isArray(j.result.links);
    console.log(
      `${ok ? "PASS" : "FAIL"}: POST /api/agent/exec web_search_product`,
    );
  } catch (e) {
    console.log("FAIL: /api/agent/exec web_search_product", e && e.message);
  }

  server.close();
})();
