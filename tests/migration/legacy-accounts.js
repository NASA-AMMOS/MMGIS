#!/usr/bin/env node
/**
 * Cross-version login compatibility check for the auth refactor.
 *
 *   seed   - run against a server built from the previous release (AUTH=local).
 *            Creates accounts of every legacy kind through the public APIs with
 *            known passwords, records how each login probe behaves, and
 *            snapshots every stored password hash.
 *   verify - run against the upgraded server on the same database.
 *            Every recorded login probe must behave exactly as before and every
 *            stored password hash must be byte-for-byte unchanged.
 *
 * Usage:
 *   BASE_URL=http://localhost:8890 node tests/migration/legacy-accounts.js seed
 *   BASE_URL=http://localhost:8888 node tests/migration/legacy-accounts.js verify
 *
 * Only ever targets the mmgis-test database.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { Client } = require("pg");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:18888";
const FIXTURE =
  process.env.LEGACY_FIXTURE ||
  path.resolve(__dirname, "../../test-results/legacy-accounts.json");
const TEST_DB_NAME = "mmgis-test";
const MISSION = "LegacyCompatMission";
const OTHER_MISSION = "LegacyCompatOther";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run with NODE_ENV=production.");
  process.exit(1);
}

const ADMIN = { username: "legacy_admin", password: "Adm!n #Pass 1" };
// [username, password, legacy permission setup]
const ACCOUNTS = [
  { username: "mission.admin", password: "M1ss!on-Adm1n", permission: "110", missions_managing: [MISSION] },
  { username: "multi_admin", password: "Two missions 2!", permission: "110", missions_managing: [MISSION, OTHER_MISSION] },
  { username: "viewer-limited", password: "V1ewer'\"\\`$(x)", permission: "001", missions_viewing: [MISSION] },
  { username: "viewer_none", password: "Nothing-to-see9", permission: "001", missions_viewing: [] },
  { username: "plainuser", password: "Plain123!" },
  { username: "CaseUser", password: "UpperCase!1" },
  { username: "user@example.com", password: "Email-like username 7" },
  { username: "unicode_user", password: "Pässwörd—✓ 測試 🚀 9" },
  { username: "long_pw_user", password: "Xx1!".repeat(15) + "-tail-after-bcrypt-72-bytes-" + "y".repeat(30) },
  { username: "demoted_admin", password: "Was a mission admin 3", permission: "001", wasAdmin: true },
];

// Each login comes from its own loopback address so the per-IP login rate
// limiter (10 per 15 minutes) never skews the results
let nextAddress = 2;
function freshAddress() {
  const n = nextAddress++;
  return `127.0.${Math.floor(n / 250)}.${(n % 250) + 2}`;
}

function api(jar, method, url, body, localAddress) {
  const target = new URL(BASE_URL + url);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        localAddress,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(jar.cookie ? { Cookie: jar.cookie } : {}),
        },
      },
      (res) => {
        const setCookie = res.headers["set-cookie"] || [];
        if (setCookie.length)
          jar.cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (text += d));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (err) {}
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(username, password) {
  const jar = {};
  const r = await api(jar, "POST", "/api/users/login", { username, password }, freshAddress());
  return { ok: !!(r.json && r.json.status === "success"), jar, json: r.json };
}

function probesFor(a) {
  return [
    { name: "correct", username: a.username, password: a.password },
    { name: "wrong password", username: a.username, password: a.password + "x" },
    { name: "upper-cased username", username: a.username.toUpperCase(), password: a.password },
    { name: "trailing-space username", username: a.username + " ", password: a.password },
  ];
}

async function hashes() {
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER_TEST || process.env.DB_USER,
    password: process.env.DB_PASS_TEST || process.env.DB_PASS,
    database: TEST_DB_NAME,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, username, password FROM users ORDER BY id"
    );
    return rows;
  } finally {
    await client.end();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function seed() {
  const admin = {};
  let r = await api(admin, "POST", "/api/users/first_signup", { ...ADMIN, email: "admin@example.com" });
  must(r.json && r.json.status === "success", `first_signup failed: ${r.text.slice(0, 200)}`);
  const l = await login(ADMIN.username, ADMIN.password);
  must(l.ok, "admin login failed");
  Object.assign(admin, l.jar);

  for (const m of [MISSION, OTHER_MISSION]) {
    r = await api(admin, "POST", "/api/configure/add", { mission: m });
    must(r.json && r.json.status === "success", `add ${m} failed: ${r.text.slice(0, 200)}`);
  }

  for (const a of ACCOUNTS) {
    r = await api(admin, "POST", "/api/users/signup", {
      skipLogin: true,
      username: a.username,
      password: a.password,
      email: `${a.username.replace(/[^a-z0-9]/gi, "")}@example.com`,
    });
    must(r.json && r.json.status === "success", `signup ${a.username} failed: ${r.text.slice(0, 200)}`);
  }
  const entries = (await api(admin, "GET", "/api/accounts/entries")).json.body.entries;
  const idOf = (u) => entries.find((e) => e.username === u).id;
  for (const a of ACCOUNTS) {
    const id = idOf(a.username);
    if (a.wasAdmin) {
      r = await api(admin, "POST", "/api/accounts/update", { id, permission: "110", missions_managing: [MISSION] });
      must(r.json && r.json.status === "success", `promote ${a.username}`);
    }
    if (a.permission) {
      r = await api(admin, "POST", "/api/accounts/update", {
        id,
        permission: a.permission,
        missions_managing: a.missions_managing,
        ...(a.missions_viewing !== undefined ? { missions_viewing: a.missions_viewing } : {}),
      });
      must(r.json && r.json.status === "success", `update ${a.username}: ${r.text.slice(0, 200)}`);
    }
  }

  const probes = [];
  for (const a of [ADMIN, ...ACCOUNTS])
    for (const p of probesFor(a)) {
      probes.push({ ...p, ok: (await login(p.username, p.password)).ok });
      await sleep(50);
    }
  const final = (await api(admin, "GET", "/api/accounts/entries")).json.body.entries;
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(
    FIXTURE,
    JSON.stringify({ base: BASE_URL, accounts: [ADMIN, ...ACCOUNTS], legacy: final, probes, hashes: await hashes() }, null, 2)
  );
  console.log(`Seeded ${final.length} accounts and ${probes.length} login probes -> ${FIXTURE}`);
  console.table(final.map((e) => ({ username: e.username, permission: e.permission, managing: JSON.stringify(e.missions_managing), viewing: JSON.stringify(e.missions_viewing) })));
}

async function verify() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const failures = [];

  // 1. Stored hashes are byte-for-byte unchanged
  const before = new Map(fixture.hashes.map((h) => [h.id, h]));
  const after = await hashes();
  for (const h of after) {
    const b = before.get(h.id);
    if (!b) continue;
    if (b.username !== h.username) failures.push(`username changed for id ${h.id}`);
    if (b.password !== h.password) failures.push(`password hash changed for ${h.username}`);
  }
  if (after.length < before.size) failures.push("accounts were removed");

  // 2. Every login probe behaves exactly as on the previous release
  const results = [];
  for (const p of fixture.probes) {
    const now = await login(p.username, p.password);
    results.push({ username: p.username, probe: p.name, before: p.ok, after: now.ok });
    if (now.ok !== p.ok) failures.push(`login '${p.name}' for ${JSON.stringify(p.username)}: was ${p.ok}, now ${now.ok}`);
    await sleep(50);
  }
  must(fixture.probes.filter((p) => p.name === "correct").every((p) => p.ok), "fixture has failing correct-password probes");

  // 3. Hashes are still unchanged after all those logins
  const afterLogins = await hashes();
  for (const h of afterLogins) {
    const b = before.get(h.id);
    if (b && b.password !== h.password) failures.push(`password hash changed after login for ${h.username}`);
  }

  // 4. Legacy permissions were translated into role bindings
  const perms = {};
  for (const a of fixture.accounts) {
    const s = await login(a.username, a.password);
    const r = await api(s.jar, "GET", "/api/configure/user-permissions");
    perms[a.username] = r.json || {};
    perms[a.username].missions = ((await api(s.jar, "GET", "/api/configure/missions")).json || {}).missions;
  }
  const legacyOf = (u) => fixture.legacy.find((e) => e.username === u);
  for (const a of fixture.accounts) {
    const p = perms[a.username];
    const l = legacyOf(a.username);
    if (l.permission === "111" && p.superadmin !== true) failures.push(`${a.username} lost SuperAdmin`);
    if (l.permission === "110") {
      const want = (l.missions_managing || []).slice().sort();
      const got = (p.missions_managing || []).slice().sort();
      if (JSON.stringify(want) !== JSON.stringify(got)) failures.push(`${a.username} manages ${got}, expected ${want}`);
      if ((p.capabilities || []).some((c) => ["mission.create", "accounts.manage", "data.stac.write"].includes(c)))
        failures.push(`${a.username} kept site-wide capabilities`);
    }
    if (l.permission === "001" && p.superadmin) failures.push(`${a.username} became SuperAdmin`);

    // Mission viewing restrictions carry over: null = every mission
    const all = [MISSION, OTHER_MISSION];
    const expectedViewing =
      l.permission === "111" || l.missions_viewing == null
        ? all
        : all.filter((m) => l.missions_viewing.includes(m) || (l.missions_managing || []).includes(m));
    const seen = (p.missions || []).filter((m) => all.includes(m)).sort();
    if (JSON.stringify(seen) !== JSON.stringify(expectedViewing.slice().sort()))
      failures.push(`${a.username} views ${JSON.stringify(seen)}, expected ${JSON.stringify(expectedViewing)}`);
  }

  console.table(results);
  console.table(
    fixture.accounts.map((a) => ({
      username: a.username,
      legacy: legacyOf(a.username).permission,
      superadmin: perms[a.username].superadmin,
      managing: JSON.stringify(perms[a.username].missions_managing),
      viewing: JSON.stringify(perms[a.username].missions),
    }))
  );
  if (failures.length) {
    console.error(`FAILED (${failures.length}):\n- ` + failures.join("\n- "));
    process.exit(1);
  }
  console.log(`OK: ${after.length} password hashes unchanged, ${results.length} login probes identical.`);
}

const cmd = process.argv[2];
(cmd === "seed" ? seed : cmd === "verify" ? verify : () => {
  console.error("usage: legacy-accounts.js seed|verify");
  process.exit(2);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
