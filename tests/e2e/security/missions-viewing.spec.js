import { test, expect, request as apiRequest } from "@playwright/test";
import fs from "fs";
import http from "http";
import path from "path";
const {
  SHARED_MISSION_FOLDER_NAME,
} = require("../../../plugins/core/backend/Config/constants");

/**
 * Per-user mission viewing permissions (users.missions_viewing).
 *
 * Under AUTH=local:
 *   - missions_viewing = null  -> unrestricted (legacy behavior)
 *   - missions_viewing = []    -> no missions
 *   - missions_viewing = [...] -> only those (Admins also get missions_managing)
 *   - SuperAdmins (111) always see everything
 *   - GET /api/configure/get is rejected for non-viewable missions
 *   - GET /Missions/<mission>/... static files are rejected for non-viewable missions
 *   - GET /Missions/shared/... is readable by any authenticated user, never guests
 *   - "shared" is reserved and never a mission
 * Under any other AUTH mode the field is ignored and all missions are visible.
 */

const baseURL = process.env.TEST_BASE_URL || "http://localhost:18888";
const ADMIN = { username: "test_admin", password: "TestAdmin1!" }; // pragma: allowlist secret
const PASSWORD = "Viewing1!x"; // pragma: allowlist secret
const isLocal = process.env.AUTH === "local";

const stamp = Date.now();
const missionA = `test_view_a_${stamp}`;
const missionB = `test_view_b_${stamp}`;
const missionC = `test_view_c_${stamp}`;
const userName = `test_view_user_${stamp}`;
const adminName = `test_view_admin_${stamp}`;
const missionsDir = path.resolve(process.cwd(), "Missions");
const assetRel = "Data/viewing-test.json";
const sharedRel = `Data/viewing-test-${stamp}.json`;
const sharedFile = path.join(missionsDir, SHARED_MISSION_FOLDER_NAME, sharedRel);

test.describe.serial("missions_viewing permissions", () => {
  let superadmin;
  let user;
  let admin;
  let ready = false;
  const userIds = {};

  async function json(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loginAs(username) {
    const ctx = await apiRequest.newContext({ baseURL });
    const body = await json(
      await ctx.post("/api/users/login", {
        data: { username, password: PASSWORD },
      }),
    );
    expect(body?.status, `login ${username}`).toBe("success");
    return ctx;
  }

  async function setViewing(id, missions_viewing, extra = {}) {
    const body = await json(
      await superadmin.post("/api/accounts/update", {
        data: { id, missions_viewing, ...extra },
      }),
    );
    expect(body?.status).toBe("success");
  }

  async function listMissions(ctx) {
    const body = await json(await ctx.get("/api/configure/missions"));
    expect(body?.status).toBe("success");
    return body.missions.filter(
      (m) => m.startsWith(`test_view_`) && m.includes(`_${stamp}`),
    );
  }

  // Sends the path verbatim; Playwright would normalize "%2e%2e" client-side
  async function rawGet(ctx, rawPath) {
    const { cookies } = await ctx.storageState();
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const u = new URL(baseURL);
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: u.hostname, port: u.port, path: rawPath, headers: { cookie } },
        (res) => {
          let body = "";
          res.on("data", (d) => (body += d));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        },
      );
      req.on("error", reject);
      req.end();
    });
  }

  async function getConfig(ctx, mission) {
    return json(await ctx.get(`/api/configure/get?mission=${mission}`));
  }

  test.beforeAll(async () => {
    if (!isLocal) return;
    superadmin = await apiRequest.newContext({ baseURL });
    const login = await json(
      await superadmin.post("/api/users/login", { data: ADMIN }),
    );
    if (login?.status !== "success") return;

    for (const m of [missionA, missionB, missionC]) {
      const body = await json(
        await superadmin.post("/api/configure/add", {
          data: { mission: m, makedir: true },
        }),
      );
      if (body?.status !== "success") return;
      fs.writeFileSync(path.join(missionsDir, m, assetRel), `{"m":"${m}"}`);
    }
    fs.mkdirSync(path.dirname(sharedFile), { recursive: true });
    fs.writeFileSync(sharedFile, `{"shared":true}`);
    for (const u of [userName, adminName]) {
      const body = await json(
        await superadmin.post("/api/users/signup", {
          data: {
            username: u,
            password: PASSWORD,
            email: `${u}@test.com`,
            skipLogin: true,
          },
        }),
      );
      if (body?.status !== "success") return;
    }
    const entries = await json(await superadmin.get("/api/accounts/entries"));
    for (const e of entries?.body?.entries || []) {
      if (e.username === userName || e.username === adminName)
        userIds[e.username] = e.id;
    }
    if (!userIds[userName] || !userIds[adminName]) return;

    await setViewing(userIds[adminName], null, {
      permission: "110",
      missions_managing: [missionC],
    });
    user = await loginAs(userName);
    admin = await loginAs(adminName);
    ready = true;
  });

  test.afterAll(async () => {
    fs.rmSync(sharedFile, { force: true });
    if (!superadmin) return;
    for (const m of [missionA, missionB, missionC]) {
      await superadmin
        .post("/api/configure/destroy", { data: { mission: m } })
        .catch(() => {});
    }
    for (const id of Object.values(userIds)) {
      await superadmin.delete(`/api/accounts/remove/${id}`).catch(() => {});
    }
    await superadmin.dispose();
    if (user) await user.dispose();
    if (admin) await admin.dispose();
  });

  test.beforeEach(() => {
    test.skip(!ready, "Requires AUTH=local with the test admin account");
  });

  test("accounts API persists and returns missions_viewing", async () => {
    await setViewing(userIds[userName], [missionA, 42, missionB]);
    let entries = await json(await superadmin.get("/api/accounts/entries"));
    let row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toEqual([missionA, missionB]);

    await setViewing(userIds[userName], []);
    entries = await json(await superadmin.get("/api/accounts/entries"));
    row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toEqual([]);

    await setViewing(userIds[userName], null);
    entries = await json(await superadmin.get("/api/accounts/entries"));
    row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toBeNull();
  });

  test("Admins (110) cannot change missions_viewing", async () => {
    await setViewing(userIds[userName], [missionA]);
    const body = await json(
      await admin.post("/api/accounts/update", {
        data: { id: userIds[userName], missions_viewing: null },
      }),
    );
    expect(body?.status).toBe("success");

    const entries = await json(await superadmin.get("/api/accounts/entries"));
    const row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toEqual([missionA]);
  });

  test("null missions_viewing sees all missions", async () => {
    await setViewing(userIds[userName], null);
    expect((await listMissions(user)).sort()).toEqual(
      [missionA, missionB, missionC].sort(),
    );
    expect((await getConfig(user, missionB))?.status).not.toBe("failure");
  });

  test("restricted list filters /missions and blocks direct /get", async () => {
    await setViewing(userIds[userName], [missionA]);
    expect(await listMissions(user)).toEqual([missionA]);
    expect((await getConfig(user, missionA))?.status).not.toBe("failure");

    const denied = await getConfig(user, missionB);
    expect(denied?.status).toBe("failure");
    expect(denied?.message).toContain("Unauthorized");
  });

  test("static mission files follow missions_viewing", async () => {
    await setViewing(userIds[userName], [missionA]);
    expect((await user.get(`/Missions/${missionA}/${assetRel}`)).status()).toBe(
      200,
    );
    expect((await user.get(`/Missions/${missionB}/${assetRel}`)).status()).toBe(
      403,
    );
    expect(
      (await user.get(`/Missions/${missionA}/../${missionB}/${assetRel}`)).status(),
    ).toBe(403);
    expect(
      (await user.get(`/Missions/${missionB.replace("_", "%5F")}/${assetRel}`)).status(),
    ).toBe(403);

    await setViewing(userIds[userName], null);
    expect((await user.get(`/Missions/${missionB}/${assetRel}`)).status()).toBe(
      200,
    );
    expect((await admin.get(`/Missions/${missionC}/${assetRel}`)).status()).toBe(
      200,
    );
    expect(
      (await superadmin.get(`/Missions/${missionB}/${assetRel}`)).status(),
    ).toBe(200);

    const anon = await apiRequest.newContext({ baseURL });
    for (const url of [`/Missions/${missionA}/${assetRel}`, "/build/mmgis.css"]) {
      const res = await anon.get(url);
      expect(res.status()).toBe(403);
      expect(res.headers()["content-type"] || "").not.toContain("text/html");

      const page = await anon.get(url, { headers: { Accept: "text/html" } });
      expect(page.status()).toBe(403);
      expect(page.headers()["content-type"]).toContain("text/html");
      expect(await page.text()).toContain('href="/"');
    }
    await anon.dispose();

    await setViewing(userIds[userName], [missionA]);
    const denied = await user.get(`/Missions/${missionB}/${assetRel}`, {
      headers: { Accept: "text/html" },
    });
    expect(denied.status()).toBe(403);
    expect(denied.headers()["content-type"]).toContain("text/html");
  });

  test("/Missions/shared is readable by any authenticated user", async () => {
    const url = `/Missions/${SHARED_MISSION_FOLDER_NAME}/${sharedRel}`;
    await setViewing(userIds[userName], [missionA]);
    const res = await user.get(url);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ shared: true });

    await setViewing(userIds[userName], []);
    expect((await user.get(url)).status()).toBe(200);
    expect((await superadmin.get(url)).status()).toBe(200);

    // Shared access must not become a path to other missions' files
    await setViewing(userIds[userName], [missionA]);
    for (const from of [SHARED_MISSION_FOLDER_NAME, missionA]) {
      const res = await rawGet(
        user,
        `/Missions/${from}/%2e%2e/${missionB}/${assetRel}`,
      );
      expect(res.status, from).not.toBe(200);
      expect(res.body).not.toContain(missionB);
    }

    const anon = await apiRequest.newContext({ baseURL });
    expect((await anon.get(url)).status()).toBe(403);
    const page = await anon.get(url, { headers: { Accept: "text/html" } });
    expect(page.status()).toBe(403);
    expect(await page.text()).toContain('href="/"');
    await anon.dispose();

    const badToken = await apiRequest.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: "Bearer not-a-real-token" },
    });
    // Rejected upstream by ensureUser ("Unauthorized Token!")
    expect(await (await badToken.get(url)).text()).not.toContain('"shared"');
    await badToken.dispose();
  });

  test("shared is reserved and never listed as a mission", async () => {
    for (const name of [
      SHARED_MISSION_FOLDER_NAME,
      SHARED_MISSION_FOLDER_NAME.toUpperCase(),
    ]) {
      const add = await json(
        await superadmin.post("/api/configure/add", {
          data: { mission: name, makedir: true },
        }),
      );
      expect(add?.status).toBe("failure");
      expect(add?.message).toContain("reserved");
    }

    const rename = await json(
      await superadmin.post("/api/configure/rename", {
        data: { mission: missionA, newName: SHARED_MISSION_FOLDER_NAME },
      }),
    );
    expect(rename?.status).toBe("failure");
    expect(rename?.message).toContain("reserved");

    for (const name of [
      SHARED_MISSION_FOLDER_NAME,
      SHARED_MISSION_FOLDER_NAME.toUpperCase(),
    ]) {
      const renameFrom = await json(
        await superadmin.post("/api/configure/rename", {
          data: { mission: name, newName: `${missionA}_renamed` },
        }),
      );
      expect(renameFrom?.status).toBe("failure");
      expect(renameFrom?.message).toContain("reserved");

      const destroy = await json(
        await superadmin.post("/api/configure/destroy", {
          data: { mission: name },
        }),
      );
      expect(destroy?.status).toBe("failure");
      expect(destroy?.message).toContain("reserved");
    }
    expect(fs.existsSync(sharedFile)).toBe(true);

    const clone = await json(
      await superadmin.post("/api/configure/clone", {
        data: {
          existingMission: missionA,
          cloneMission: SHARED_MISSION_FOLDER_NAME,
        },
      }),
    );
    expect(clone?.status).toBe("failure");

    for (const ctx of [superadmin, user]) {
      const body = await json(await ctx.get("/api/configure/missions"));
      expect(body?.status).toBe("success");
      expect(body.missions).not.toContain(SHARED_MISSION_FOLDER_NAME);
    }
  });

  test("guests (not logged in) see no missions and cannot load configs", async () => {
    const anon = await apiRequest.newContext({ baseURL });
    expect(await listMissions(anon)).toEqual([]);
    const full = await json(await anon.get("/api/configure/missions?full=true"));
    expect(
      (full?.missions || []).filter((m) => m.mission === missionA),
    ).toEqual([]);
    const denied = await getConfig(anon, missionA);
    expect(denied?.status).toBe("failure");
    expect(denied?.message).toContain("Unauthorized");
    // Garbage bearer tokens grant nothing
    expect(
      (
        await getConfig(
          await apiRequest.newContext({
            baseURL,
            extraHTTPHeaders: { Authorization: "Bearer not-a-real-token" },
          }),
          missionA,
        )
      )?.status,
    ).toBe("failure");
    await anon.dispose();
  });

  test("long-term tokens inherit their creator's viewing scope", async () => {
    const tokenIds = [];
    const mint = async (ctx) => {
      const body = await json(
        await ctx.post("/api/longtermtoken/generate", {
          data: { name: `view${stamp}`, period: "never" },
        }),
      );
      expect(body?.status).toBe("success");
      const list = await json(await ctx.get("/api/longtermtoken/get"));
      const row = list.tokens.find((t) => t.token === body.body.token);
      tokenIds.push(row.id);
      return apiRequest.newContext({
        baseURL,
        extraHTTPHeaders: { Authorization: `Bearer ${body.body.token}` },
      });
    };
    try {
      await setViewing(userIds[adminName], [missionA], {
        permission: "110",
        missions_managing: [missionC],
      });
      const adminTok = await mint(admin);
      expect((await listMissions(adminTok)).sort()).toEqual(
        [missionA, missionC].sort(),
      );
      expect((await getConfig(adminTok, missionB))?.status).toBe("failure");
      expect((await getConfig(adminTok, missionA))?.status).not.toBe("failure");
      expect(
        (await adminTok.get(`/Missions/${missionB}/${assetRel}`)).status(),
      ).toBe(403);
      expect(
        (await adminTok.get(`/Missions/${missionA}/${assetRel}`)).status(),
      ).toBe(200);

      const superTok = await mint(superadmin);
      expect((await listMissions(superTok)).length).toBe(3);
      expect((await getConfig(superTok, missionB))?.status).not.toBe("failure");
      await adminTok.dispose();
      await superTok.dispose();
    } finally {
      for (const id of tokenIds)
        await superadmin
          .post("/api/longtermtoken/clear", { data: { id } })
          .catch(() => {});
      await setViewing(userIds[adminName], null, {
        permission: "110",
        missions_managing: [missionC],
      });
    }
  });

  test("static files honor msv.missionFolderName", async () => {
    const folder = `test_view_folder_${stamp}`;
    fs.mkdirSync(path.join(missionsDir, folder, "Data"), { recursive: true });
    fs.writeFileSync(path.join(missionsDir, folder, assetRel), "{}");
    const full = await json(
      await superadmin.get(`/api/configure/get?mission=${missionA}&full=true`),
    );
    const cfg = full.config;
    cfg.msv.missionFolderName = folder;
    try {
      const up = await json(
        await superadmin.post("/api/configure/upsert", {
          data: { mission: missionA, config: cfg },
        }),
      );
      expect(up?.status).toBe("success");

      await setViewing(userIds[userName], [missionB]);
      expect((await user.get(`/Missions/${folder}/${assetRel}`)).status()).toBe(
        403,
      );
      await setViewing(userIds[userName], [missionA]);
      expect((await user.get(`/Missions/${folder}/${assetRel}`)).status()).toBe(
        200,
      );
    } finally {
      delete cfg.msv.missionFolderName;
      await superadmin.post("/api/configure/upsert", {
        data: { mission: missionA, config: cfg },
      });
      fs.rmSync(path.join(missionsDir, folder), { recursive: true, force: true });
    }
  });

  test("empty missions_viewing sees no missions", async () => {
    await setViewing(userIds[userName], []);
    expect(await listMissions(user)).toEqual([]);
    expect((await getConfig(user, missionA))?.status).toBe("failure");
  });

  test("Admins (110) see missions_viewing ∪ missions_managing", async () => {
    await setViewing(userIds[adminName], [missionA]);
    expect((await listMissions(admin)).sort()).toEqual(
      [missionA, missionC].sort(),
    );
    expect((await getConfig(admin, missionC))?.status).not.toBe("failure");
    expect((await getConfig(admin, missionB))?.status).toBe("failure");
  });

  test("SuperAdmins (111) always see all missions", async () => {
    expect((await listMissions(superadmin)).sort()).toEqual(
      [missionA, missionB, missionC].sort(),
    );
    expect((await getConfig(superadmin, missionB))?.status).not.toBe("failure");
  });

  test("renaming a mission follows missions_viewing", async () => {
    const renamed = `${missionA}_renamed`;
    await setViewing(userIds[userName], [missionA]);
    const rename = await json(
      await superadmin.post("/api/configure/rename", {
        data: { mission: missionA, newName: renamed },
      }),
    );
    expect(rename?.status).toBe("success");
    try {
      expect(await listMissions(user)).toEqual([renamed]);
      expect((await user.get(`/Missions/${renamed}/${assetRel}`)).status()).toBe(
        200,
      );
      const relogin = await loginAs(userName);
      await relogin.dispose();
    } finally {
      await superadmin.post("/api/configure/rename", {
        data: { mission: renamed, newName: missionA },
      });
    }
  });

  test("default missions_viewing is stamped onto new accounts", async () => {
    const setDefaults = async (ctx, missions_viewing) =>
      json(
        await ctx.post("/api/accounts/updateDefaults", {
          data: { missions_viewing },
        }),
      );
    const getDefaults = async () =>
      (await json(await superadmin.get("/api/accounts/defaults")))?.body
        ?.missions_viewing;
    const signup = async (name, extra = {}) => {
      const body = await json(
        await superadmin.post("/api/users/signup", {
          data: {
            username: name,
            password: PASSWORD,
            email: `${name}@test.com`,
            skipLogin: true,
            ...extra,
          },
        }),
      );
      expect(body?.status).toBe("success");
      const entries = await json(await superadmin.get("/api/accounts/entries"));
      const e = entries.body.entries.find((x) => x.username === name);
      userIds[name] = e.id;
      return e;
    };

    // Admins (110) may not change the defaults
    expect((await setDefaults(admin, []))?.status).toBe("failure");

    const original = await getDefaults();
    try {
      expect((await setDefaults(superadmin, [missionA]))?.status).toBe(
        "success",
      );
      expect(await getDefaults()).toEqual([missionA]);
      const u1 = await signup(`${userName}_d1`);
      expect(u1.missions_viewing).toEqual([missionA]);
      const ctx1 = await loginAs(u1.username);
      expect(await listMissions(ctx1)).toEqual([missionA]);
      await ctx1.dispose();

      expect((await setDefaults(superadmin, []))?.status).toBe("success");
      const u2 = await signup(`${userName}_d2`);
      expect(u2.missions_viewing).toEqual([]);

      expect((await setDefaults(superadmin, null))?.status).toBe("success");
      expect(await getDefaults()).toBe(null);
      const u3 = await signup(`${userName}_d3`);
      expect(u3.missions_viewing).toBe(null);

      // SuperAdmins may override the default per account at signup
      const u4 = await signup(`${userName}_d4`, { missions_viewing: [missionC] });
      expect(u4.missions_viewing).toEqual([missionC]);
      // Admins (110) cannot; signup is allowed but the default applies
      const adminSignup = await json(
        await admin.post("/api/users/signup", {
          data: {
            username: `${userName}_d5`,
            password: PASSWORD,
            skipLogin: true,
            missions_viewing: [missionC],
          },
        }),
      );
      if (adminSignup?.status === "success") {
        const entries = await json(await superadmin.get("/api/accounts/entries"));
        const e = entries.body.entries.find(
          (x) => x.username === `${userName}_d5`,
        );
        userIds[e.username] = e.id;
        expect(e.missions_viewing).toBe(null);
      }

      // Defaults follow mission renames like per-user grants do
      await setDefaults(superadmin, [missionB]);
      const renamed = `${missionB}_renamed`;
      await superadmin.post("/api/configure/rename", {
        data: { mission: missionB, newName: renamed },
      });
      try {
        expect(await getDefaults()).toEqual([renamed]);
      } finally {
        await superadmin.post("/api/configure/rename", {
          data: { mission: renamed, newName: missionB },
        });
      }
    } finally {
      await setDefaults(superadmin, original ?? null);
    }
  });
});

test.describe("default missions_viewing is stored in every AUTH mode", () => {
  test.skip(isLocal, "Non-local AUTH only");

  test("new accounts receive the default even though it is not enforced", async () => {
    const superadmin = await apiRequest.newContext({ baseURL });
    const login = await superadmin
      .post("/api/users/login", { data: ADMIN })
      .then((r) => r.json());
    test.skip(login?.status !== "success", "Requires the test admin account");

    const name = `${userName}_nonlocal`;
    const original = (
      await superadmin.get("/api/accounts/defaults").then((r) => r.json())
    )?.body?.missions_viewing;
    let id;
    try {
      const set = await superadmin
        .post("/api/accounts/updateDefaults", {
          data: { missions_viewing: [] },
        })
        .then((r) => r.json());
      expect(set.status).toBe("success");

      const signup = await superadmin
        .post("/api/users/signup", {
          data: {
            username: name,
            password: PASSWORD,
            email: `${name}@test.com`,
            skipLogin: true,
          },
        })
        .then((r) => r.json());
      expect(signup.status).toBe("success");

      const entries = await superadmin
        .get("/api/accounts/entries")
        .then((r) => r.json());
      const e = entries.body.entries.find((x) => x.username === name);
      id = e.id;
      expect(e.missions_viewing).toEqual([]);

      // Not enforced outside AUTH=local: the new user still lists every mission
      const ctx = await apiRequest.newContext({ baseURL });
      await ctx.post("/api/users/login", {
        data: { username: name, password: PASSWORD },
      });
      const body = await ctx.get("/api/configure/missions").then((r) => r.json());
      expect(body.status).toBe("success");
      expect(Array.isArray(body.missions)).toBe(true);
      await ctx.dispose();
    } finally {
      if (id) await superadmin.delete(`/api/accounts/remove/${id}`);
      await superadmin.post("/api/accounts/updateDefaults", {
        data: { missions_viewing: original ?? null },
      });
      await superadmin.dispose();
    }
  });
});

test.describe("missions_viewing is ignored when AUTH is not local", () => {
  test.skip(isLocal, "Non-local AUTH only");

  test("/missions returns every mission for an anonymous session", async () => {
    const ctx = await apiRequest.newContext({ baseURL });
    const body = await ctx.get("/api/configure/missions").then((r) => r.json());
    expect(body.status).toBe("success");
    expect(Array.isArray(body.missions)).toBe(true);
    await ctx.dispose();
  });
});
