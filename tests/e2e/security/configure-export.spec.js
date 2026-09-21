import { test, expect, request as apiRequest } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:18888";
const ADMIN = { username: "test_admin", password: "TestAdmin1!" }; // pragma: allowlist secret
const PASSWORD = "Export1!x"; // pragma: allowlist secret
const isLocal = process.env.AUTH === "local";

const stamp = Date.now();
const missionA = `test_export_a_${stamp}`;
const missionB = `test_export_b_${stamp}`;
const userName = `test_export_user_${stamp}`;

test.describe.serial("configure export", () => {
  let superadmin;
  let user;
  let userId;
  let ready = false;

  async function json(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loginAs(username, password = PASSWORD) {
    const ctx = await apiRequest.newContext({ baseURL });
    const body = await json(
      await ctx.post("/api/users/login", {
        data: { username, password },
      }),
    );
    expect(body?.status, `login ${username}`).toBe("success");
    return ctx;
  }

  test("GET /missions?full=true returns only mission names", async () => {
    const anon = await apiRequest.newContext({ baseURL });
    const body = await json(
      await anon.get("/api/configure/missions?full=true"),
    );
    expect(body?.status).toBe("success");
    expect(Array.isArray(body?.missions)).toBe(true);
    expect(body.missions.every((mission) => typeof mission === "string")).toBe(
      true,
    );
    await anon.dispose();
  });

  test.beforeAll(async () => {
    if (!isLocal) return;

    superadmin = await apiRequest.newContext({ baseURL });
    const login = await json(
      await superadmin.post("/api/users/login", { data: ADMIN }),
    );
    if (login?.status !== "success") return;

    for (const mission of [missionA, missionB]) {
      const body = await json(
        await superadmin.post("/api/configure/add", {
          data: { mission, makedir: true },
        }),
      );
      if (body?.status !== "success") return;
    }

    const full = await json(
      await superadmin.get(`/api/configure/get?mission=${missionA}&full=true`),
    );
    if (full?.status !== "success") return;
    const upsert = await json(
      await superadmin.post("/api/configure/upsert", {
        data: { mission: missionA, config: full.config },
      }),
    );
    if (upsert?.status !== "success") return;

    const signup = await json(
      await superadmin.post("/api/users/signup", {
        data: {
          username: userName,
          password: PASSWORD,
          email: `${userName}@test.com`,
          skipLogin: true,
        },
      }),
    );
    if (signup?.status !== "success") return;

    const entries = await json(await superadmin.get("/api/accounts/entries"));
    const userEntry = entries?.body?.entries?.find(
      (entry) => entry.username === userName,
    );
    if (!userEntry) return;
    userId = userEntry.id;

    const update = await json(
      await superadmin.post("/api/accounts/update", {
        data: { id: userId, missions_viewing: [missionA] },
      }),
    );
    if (update?.status !== "success") return;

    user = await loginAs(userName);
    ready = true;
  });

  test.afterAll(async () => {
    if (!superadmin) return;
    for (const mission of [missionA, missionB]) {
      await superadmin
        .post("/api/configure/destroy", { data: { mission } })
        .catch(() => {});
    }
    if (userId)
      await superadmin.delete(`/api/accounts/remove/${userId}`).catch(() => {});
    await superadmin.dispose();
    if (user) await user.dispose();
  });

  test.describe("AUTH=local", () => {
    test.beforeEach(() => {
      test.skip(!isLocal || !ready, "Requires AUTH=local with test accounts");
    });

    test("anonymous GET /export is unauthorized", async () => {
      const anon = await apiRequest.newContext({ baseURL });
      const body = await json(await anon.get("/api/configure/export"));
      expect(body?.status).toBe("failure");
      await anon.dispose();
    });

    test("viewing user exports only viewable latest missions", async () => {
      const body = await json(await user.get("/api/configure/export"));
      expect(body?.status).toBe("success");
      expect(body.missions.some((row) => row.mission === missionA)).toBe(true);
      expect(body.missions.some((row) => row.mission === missionB)).toBe(false);
      for (const row of body.missions.filter(
        (entry) => entry.mission === missionA,
      )) {
        expect(row).toHaveProperty("mission");
        expect(row).toHaveProperty("version");
        expect(row.config).toEqual(expect.any(Object));
        expect(row).toHaveProperty("createdAt");
      }
    });

    test("specific config versions require mission admin access", async () => {
      const denied = await json(
        await user.get(`/api/configure/get?mission=${missionA}&version=1`),
      );
      expect(denied?.status).toBe("failure");
      expect(denied?.message).toContain("Unauthorized");

      const latest = await json(
        await user.get(`/api/configure/get?mission=${missionA}`),
      );
      expect(latest).toEqual(expect.any(Object));
      expect(latest.status).not.toBe("failure");
      expect(latest.config).toBeUndefined();

      const version = await json(
        await superadmin.get(
          `/api/configure/get?mission=${missionA}&version=1&full=true`,
        ),
      );
      expect(version?.status).toBe("success");
      expect(version?.version).toBe(1);
    });

    test("session permissions take precedence over authorization tokens", async () => {
      const generated = await json(
        await superadmin.post("/api/longtermtoken/generate", {
          data: { name: `configure${stamp}`, period: "never" },
        }),
      );
      expect(generated?.status).toBe("success");
      const token = generated.body.token;
      const tokens = await json(
        await superadmin.get("/api/longtermtoken/get"),
      );
      const tokenRow = tokens.tokens.find((entry) => entry.token === token);
      expect(tokenRow).toBeTruthy();

      try {
        const body = await json(
          await user.get(
            `/api/configure/get?mission=${missionA}&version=1`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
        expect(body?.status).toBe("failure");
        expect(body?.message).toContain("Unauthorized");
      } finally {
        await superadmin
          .post("/api/longtermtoken/clear", { data: { id: tokenRow.id } })
          .catch(() => {});
      }
    });
  });
});
