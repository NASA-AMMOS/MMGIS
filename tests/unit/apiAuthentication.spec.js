import { test, expect } from "@playwright/test";
import express from "express";

const crypto = require("crypto");
const expressSession = require("express-session");

const {
  createEnsureUserForApi,
  createLongTermTokenResolver,
  isLongTermTokenRecordValid,
  parseBearerAuthorization,
} = require("../../scripts/apiAuthentication");

const TOKEN_TEST_NOW = Date.parse("2026-08-18T12:00:00.000Z");

function resolveFromTokenRecords(
  records,
  { now = TOKEN_TEST_NOW, storageErrorToken = null } = {},
) {
  return createLongTermTokenResolver(
    (token, successCallback, failureCallback, errorCallback) => {
      if (token === storageErrorToken) {
        errorCallback(new Error("database unavailable"));
        return;
      }

      const tokenData = records[token];
      if (isLongTermTokenRecordValid(tokenData, token, now)) {
        successCallback(tokenData);
      } else {
        failureCallback();
      }
    },
  );
}

async function withApiServer(
  {
    authMode = "local",
    resolveLongTermToken = async () => null,
    configureRequest = () => {},
    sessionMiddleware = null,
    options = {},
  },
  callback,
) {
  const app = express();
  if (sessionMiddleware) {
    app.use(sessionMiddleware);
  } else {
    app.use((req, _res, next) => {
      req.session = {};
      next();
    });
  }
  app.use((req, _res, next) => {
    configureRequest(req);
    next();
  });

  const ensureUserForApi = createEnsureUserForApi({
    getAuthMode: () => authMode,
    resolveLongTermToken,
  });
  app.get("/protected", ensureUserForApi(options), (req, res) =>
    res.status(200).json({
      user: req.user || null,
      isLongTermToken: req.isLongTermToken || false,
      tokenUserPermission: req.tokenUserPermission || null,
      tokenUserMissions: req.tokenUserMissions || null,
      apiAuthIdentity: req.apiAuthIdentity || null,
    }),
  );

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });
  const address = server.address();

  try {
    await callback(`http://127.0.0.1:${address.port}/protected`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

const agentFailure = {
  code: "AgentAuthenticationRequired",
  message: "Sign in to use MMGIS Copilot.",
  unavailableCode: "AgentAuthenticationUnavailable",
  unavailableMessage: "MMGIS authentication is temporarily unavailable.",
};

test.describe("@unit typed API authentication", () => {
  test("strictly parses only Bearer and Bearer: authorization forms", () => {
    expect(parseBearerAuthorization("Bearer token-123")).toBe("token-123");
    expect(parseBearerAuthorization("Bearer: token-456")).toBe("token-456");
    expect(parseBearerAuthorization("bearer token-789")).toBe("token-789");

    for (const malformed of [
      "token-123",
      "Basic token-123",
      "Bearer",
      "Bearer:",
      "Bearer:token-123",
      "Bearer token-123 trailing",
      "prefix Bearer token-123",
      " Bearer token-123",
      "Bearer token-123 ",
    ]) {
      expect(parseBearerAuthorization(malformed)).toBeNull();
    }
    expect(parseBearerAuthorization(["Bearer token-123"])).toBeNull();
  });

  test("validates active token records and rejects expired or malformed records", () => {
    const active = {
      token: "active-token",
      created_by_user_id: 7,
      createdAt: new Date(TOKEN_TEST_NOW - 500).toISOString(),
      period: "1000",
    };

    expect(
      isLongTermTokenRecordValid(active, "active-token", TOKEN_TEST_NOW),
    ).toBe(true);
    expect(
      isLongTermTokenRecordValid(
        { ...active, period: "never", createdAt: "not-a-date" },
        "active-token",
        TOKEN_TEST_NOW,
      ),
    ).toBe(true);
    expect(
      isLongTermTokenRecordValid(
        { ...active, createdAt: new Date(TOKEN_TEST_NOW - 1001).toISOString() },
        "active-token",
        TOKEN_TEST_NOW,
      ),
    ).toBe(false);

    for (const invalid of [
      null,
      { ...active, token: "different-token" },
      { ...active, created_by_user_id: null },
      { ...active, created_by_user_id: undefined },
      { ...active, createdAt: "not-a-date" },
      { ...active, period: "not-a-period" },
    ]) {
      expect(
        isLongTermTokenRecordValid(invalid, "active-token", TOKEN_TEST_NOW),
      ).toBe(false);
    }
  });

  test("AUTH=off/none stays public despite an incidental bogus header", async () => {
    for (const authMode of ["off", " NONE "]) {
      let resolverCalled = false;
      await withApiServer(
        {
          authMode,
          resolveLongTermToken: async () => {
            resolverCalled = true;
            throw new Error("resolver must not run in public mode");
          },
        },
        async (url) => {
          const response = await fetch(url, {
            headers: { Authorization: "not-a-bearer-credential" },
          });
          expect(response.status).toBe(200);
          expect(resolverCalled).toBe(false);
        },
      );
    }
  });

  test("persists a stable hashed identity for public browser sessions", async () => {
    let generatedSessionIds = 0;
    let resolverCalled = false;
    const persistedIdentitiesBeforeGate = [];
    const rawSessionId = "public-session-1";
    const expectedDigest = crypto
      .createHash("sha256")
      .update(rawSessionId, "utf8")
      .digest("hex");
    const expectedIdentity = `session:sha256:${expectedDigest}`;

    await withApiServer(
      {
        authMode: "off",
        resolveLongTermToken: async () => {
          resolverCalled = true;
          throw new Error("resolver must not run in public mode");
        },
        sessionMiddleware: expressSession({
          secret: "typed-api-auth-unit-test-session-secret",
          name: "TypedApiAuthSession",
          resave: false,
          saveUninitialized: false,
          genid: () => `public-session-${++generatedSessionIds}`,
        }),
        configureRequest: (req) => {
          persistedIdentitiesBeforeGate.push(
            req.session.apiAuthIdentity || null,
          );
        },
      },
      async (url) => {
        const firstResponse = await fetch(url, {
          headers: { Authorization: "not-a-bearer-credential" },
        });
        expect(firstResponse.status).toBe(200);
        const firstBody = await firstResponse.json();
        const setCookie = firstResponse.headers.get("set-cookie");

        expect(setCookie).toBeTruthy();
        expect(firstBody.apiAuthIdentity).toBe(expectedIdentity);
        expect(JSON.stringify(firstBody)).not.toContain(rawSessionId);

        const secondResponse = await fetch(url, {
          headers: {
            Authorization: "Basic still-not-a-bearer-credential",
            Cookie: setCookie.split(";", 1)[0],
          },
        });
        expect(secondResponse.status).toBe(200);
        const secondBody = await secondResponse.json();

        expect(secondBody.apiAuthIdentity).toBe(firstBody.apiAuthIdentity);
        expect(JSON.stringify(secondBody)).not.toContain(rawSessionId);
      },
    );

    expect(generatedSessionIds).toBe(1);
    expect(persistedIdentitiesBeforeGate).toEqual([null, expectedIdentity]);
    expect(resolverCalled).toBe(false);
  });

  test("accepts hydrated local sessions and trusted CSSO identities", async () => {
    let resolverCalled = false;
    await withApiServer(
      {
        authMode: "local",
        resolveLongTermToken: async () => {
          resolverCalled = true;
          return null;
        },
        configureRequest: (req) => {
          req.user = "session-user";
          req.session.permission = "001";
        },
      },
      async (url) => {
        const response = await fetch(url);
        expect(response.status).toBe(200);
        expect((await response.json()).user).toBe("session-user");
      },
    );
    expect(resolverCalled).toBe(false);

    await withApiServer(
      {
        authMode: "csso",
        configureRequest: (req) => {
          req.user = "proxy-user";
        },
      },
      async (url) => {
        const response = await fetch(url);
        expect(response.status).toBe(200);
        expect((await response.json()).user).toBe("proxy-user");
      },
    );
  });

  test("fails closed for blank or unknown auth modes despite a stale session", async () => {
    for (const authMode of ["", "locla", "future-auth-mode"]) {
      await withApiServer(
        {
          authMode,
          configureRequest: (req) => {
            req.user = "stale-session-user";
            req.session.permission = "001";
          },
        },
        async (url) => {
          const response = await fetch(url);
          expect(response.status).toBe(401);
          expect(await response.json()).toEqual({
            error: "Authentication is required.",
            code: "ApiAuthenticationRequired",
          });
        },
      );
    }
  });

  test("rejects local sessions without an authenticated permission", async () => {
    for (const permission of [undefined, null, "000", 1]) {
      await withApiServer(
        {
          authMode: "local",
          configureRequest: (req) => {
            req.user = "session-user";
            req.session.permission = permission;
          },
        },
        async (url) => {
          const response = await fetch(url);
          expect(response.status).toBe(401);
        },
      );
    }
  });

  test("returns configurable typed 401s for missing and malformed credentials", async () => {
    let resolverCalls = 0;
    await withApiServer(
      {
        resolveLongTermToken: async () => {
          resolverCalls += 1;
          return null;
        },
        options: agentFailure,
      },
      async (url) => {
        for (const authorization of [
          null,
          "Basic abc",
          "Bearer",
          "Bearer:abc",
          "Bearer abc trailing",
        ]) {
          const response = await fetch(url, {
            headers: authorization ? { Authorization: authorization } : {},
          });
          expect(response.status).toBe(401);
          expect(response.headers.get("www-authenticate")).toBe("Bearer");
          expect(await response.json()).toEqual({
            error: agentFailure.message,
            code: agentFailure.code,
          });
        }
      },
    );
    expect(resolverCalls).toBe(0);
  });

  test("rejects invalid, expired, and guest credentials with HTTP 401", async () => {
    const tokenRecords = {
      "invalid-token": {
        token: "different-token",
        created_by_user_id: 1,
        createdAt: new Date(TOKEN_TEST_NOW - 100).toISOString(),
        period: "1000",
        username: "token-user",
      },
      "expired-token": {
        token: "expired-token",
        created_by_user_id: 1,
        createdAt: new Date(TOKEN_TEST_NOW - 1001).toISOString(),
        period: "1000",
        username: "token-user",
      },
    };
    await withApiServer(
      {
        resolveLongTermToken: resolveFromTokenRecords(tokenRecords),
        options: agentFailure,
        configureRequest: (req) => {
          req.user = "guest";
          req.session.permission = "001";
        },
      },
      async (url) => {
        for (const token of ["invalid-token", "expired-token"]) {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          expect(response.status).toBe(401);
          expect(await response.json()).toEqual({
            error: agentFailure.message,
            code: agentFailure.code,
          });
        }

        const guestWithoutToken = await fetch(url);
        expect(guestWithoutToken.status).toBe(401);
      },
    );
  });

  test("accepts both valid token forms and preserves legacy request hydration", async () => {
    const resolvedTokens = [];
    const tokenRecord = (token) => ({
      token,
      created_by_user_id: 1,
      createdAt: new Date(TOKEN_TEST_NOW - 100).toISOString(),
      period: "1000",
      username: "token-user",
      permission: "110",
      missions_managing: ["Mission A", "Mission B"],
    });
    const resolveTokenRecord = resolveFromTokenRecords({
      "opaque-token": tokenRecord("opaque-token"),
      "legacy-token": tokenRecord("legacy-token"),
    });
    await withApiServer(
      {
        resolveLongTermToken: async (token) => {
          resolvedTokens.push(token);
          return resolveTokenRecord(token);
        },
      },
      async (url) => {
        for (const authorization of [
          "Bearer opaque-token",
          "Bearer: legacy-token",
        ]) {
          const response = await fetch(url, {
            headers: { Authorization: authorization },
          });
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({
            user: "token-user",
            isLongTermToken: true,
            tokenUserPermission: "110",
            tokenUserMissions: ["Mission A", "Mission B"],
          });
        }
      },
    );
    expect(resolvedTokens).toEqual(["opaque-token", "legacy-token"]);
  });

  test("derives a stable nonsecret identity for stateless token requests", async () => {
    const stableToken = "stable-secret-token";
    const differentToken = "different-secret-token";
    const cookieHeaders = [];
    const tokenRecord = (token) => ({
      token,
      created_by_user_id: 1,
      createdAt: new Date(TOKEN_TEST_NOW - 100).toISOString(),
      period: "1000",
      username: "token-user",
      permission: "001",
      missions_managing: [],
    });

    await withApiServer(
      {
        resolveLongTermToken: resolveFromTokenRecords({
          [stableToken]: tokenRecord(stableToken),
          [differentToken]: tokenRecord(differentToken),
        }),
        configureRequest: (req) => {
          cookieHeaders.push(req.headers.cookie || null);
        },
      },
      async (url) => {
        const request = async (authorization) => {
          const response = await fetch(url, {
            headers: { Authorization: authorization },
          });
          expect(response.status).toBe(200);
          return response.json();
        };

        const first = await request(`Bearer ${stableToken}`);
        const second = await request(`Bearer: ${stableToken}`);
        const different = await request(`Bearer ${differentToken}`);
        const expectedDigest = crypto
          .createHash("sha256")
          .update(stableToken, "utf8")
          .digest("hex");

        expect(first.apiAuthIdentity).toBe(
          `long-term-token:sha256:${expectedDigest}`,
        );
        expect(second.apiAuthIdentity).toBe(first.apiAuthIdentity);
        expect(different.apiAuthIdentity).not.toBe(first.apiAuthIdentity);

        const serializedResponses = JSON.stringify([first, second, different]);
        expect(serializedResponses).not.toContain(stableToken);
        expect(serializedResponses).not.toContain(differentToken);
      },
    );

    expect(cookieHeaders).toEqual([null, null, null]);
  });

  test("rejects otherwise valid tokens with missing, blank, or guest usernames", async () => {
    const usernames = {
      "missing-username": undefined,
      "empty-username": "",
      "blank-username": "   ",
      "guest-username": "guest",
    };
    await withApiServer(
      {
        resolveLongTermToken: async (token) => ({
          username: usernames[token],
          permission: "001",
          missions_managing: ["Mission A"],
        }),
        options: agentFailure,
      },
      async (url) => {
        for (const token of Object.keys(usernames)) {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          expect(response.status).toBe(401);
          expect(await response.json()).toEqual({
            error: agentFailure.message,
            code: agentFailure.code,
          });
        }
      },
    );
  });

  test("fails closed with a typed non-200 response when token storage fails", async () => {
    const secretToken = "secret-token-that-must-not-leak";
    await withApiServer(
      {
        resolveLongTermToken: resolveFromTokenRecords(
          {},
          { storageErrorToken: secretToken },
        ),
        options: agentFailure,
      },
      async (url) => {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${secretToken}` },
        });
        expect(response.status).toBe(503);
        const body = await response.json();
        expect(body).toEqual({
          error: agentFailure.unavailableMessage,
          code: agentFailure.unavailableCode,
        });
        expect(JSON.stringify(body)).not.toContain(secretToken);
      },
    );
  });
});
