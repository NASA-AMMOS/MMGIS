import { test, expect } from "@playwright/test";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createEnsureUserForApi, hasUserSessionPermission } from "../../scripts/apiAuthentication";

test("@unit legacy and typed gates share the exact session permission set", () => {
  for (const permission of ["111", "110", "001", "000", "010", 111, null, undefined]) {
    expect(hasUserSessionPermission({ session: { permission } })).toBe(
      ["111", "110", "001"].includes(permission),
    );
  }
  expect(hasUserSessionPermission({})).toBe(false);
});

test("@unit core Shortener mount returns typed failures and explicitly preserves public access", async () => {
  // Exercise the real plugin mount with a terminal router in place of the
  // database-backed shortening operation; no host build or mission is needed.
  const router = express.Router();
  router.post("/shorten", (req, res) => res.json({ user: req.user || null }));
  const sandbox = {
    module: { exports: {} },
    require: (name) => {
      expect(name).toBe("./routes/shortener");
      return router;
    },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(
    __dirname, "../../plugins/core/backend/Shortener/plugin.js",
  ), "utf8"), sandbox);
  for (const authMode of ["local", "csso", "off", "none"]) {
    const app = express();
    app.use((req, _res, next) => { req.session = {}; next(); });
    sandbox.module.exports.onceInit({
      app, ROOT_PATH: "/mmgis",
      ensureUserForApi: createEnsureUserForApi({
        getAuthMode: () => authMode,
        resolveLongTermToken: async (token) => {
          if (token === "storage-error") throw new Error("database unavailable");
          return token === "valid" ? { username: "token-user" } : null;
        },
      }),
      checkHeadersCodeInjection: (_req, _res, next) => next(),
      setContentType: (_req, _res, next) => next(),
    });
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    try {
      const url = `http://127.0.0.1:${server.address().port}/mmgis/api/shortener/shorten`;
      for (const credential of [null, "Basic invalid", "Bearer invalid", "Bearer storage-error", "Bearer valid"]) {
        const response = await fetch(url, {
          method: "POST", headers: credential ? { Authorization: credential } : {},
        });
        const expectedStatus = ["off", "none"].includes(authMode) || credential === "Bearer valid"
          ? 200 : credential === "Bearer storage-error" ? 503 : 401;
        expect(response.status).toBe(expectedStatus);
        const body = await response.json();
        if (expectedStatus !== 200) expect(body.code).toBe(
          expectedStatus === 503 ? "ApiAuthenticationUnavailable" : "ApiAuthenticationRequired",
        );
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});
