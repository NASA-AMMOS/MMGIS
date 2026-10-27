#!/usr/bin/env node
/**
 * Re-upgrade after a rollback: access removed on the previous release must stay
 * removed. Driven by tests/migration/run-rollback-cycle.sh; only uses mmgis-test.
 *   seed          - previous release: accounts of each legacy kind
 *   rollbackEdits - previous release again, after one upgrade: demote / narrow / delete
 *   bindings      - print each account's grants (verify=1 checks the expected result)
 *   tokenNew      - this release: the previous release's long-term token still works (and is hashed)
 */
require("dotenv").config();
const http = require("http");
const { Client } = require("pg");
const BASE = process.env.BASE_URL;
const PW = "Roll!back-Pass1"; // pragma: allowlist secret
function api(jar, method, url, body) {
  const t = new URL(BASE + url); const payload = body ? JSON.stringify(body) : null;
  return new Promise((res, rej) => {
    const r = http.request({ method, hostname: t.hostname, port: t.port, path: t.pathname,
      headers: { "Content-Type": "application/json", ...(jar.cookie ? { Cookie: jar.cookie } : {}), ...(jar.authorization ? { Authorization: jar.authorization } : {}) } }, (s) => {
      const sc = s.headers["set-cookie"] || []; if (sc.length) jar.cookie = sc.map((c) => c.split(";")[0]).join("; ");
      let x = ""; s.on("data", (d) => (x += d)); s.on("end", () => { let j = null; try { j = JSON.parse(x); } catch (e) {} res({ json: j, text: x }); });
    });
    r.on("error", rej); if (payload) r.write(payload); r.end();
  });
}
const must = (c, m) => { if (!c) throw new Error(m); };
const TOKEN_FILE = require("path").resolve(__dirname, "../../test-results/rb-token.json");
async function tokenMissions(token) {
  const r = await api({ authorization: `Bearer ${token}` }, "GET", "/api/configure/missions");
  return ((r.json || {}).missions || []).slice().sort();
}
if (process.env.NODE_ENV === "production") { console.error("Refusing to run with NODE_ENV=production."); process.exit(1); }
const EXPECTED = {
  rb_admin: ["superadmin@global"],
  rb_sa2: ["viewer@global"],
  rb_ma: ["mission_admin@RbA", "viewer@global"],
  rb_vall: ["viewer@RbA"],
  rb_vlim: ["viewer@RbB"],
  rb_newbie: ["viewer@RbB"],
};
async function adminJar() {
  const jar = {};
  const r = await api(jar, "POST", "/api/users/login", { username: "rb_admin", password: PW });
  must(r.json && r.json.status === "success", "admin login " + r.text.slice(0, 200));
  return jar;
}
async function upd(jar, username, fields) {
  const e = (await api(jar, "GET", "/api/accounts/entries")).json.body.entries.find((x) => x.username === username);
  const r = await api(jar, "POST", "/api/accounts/update", { id: e.id, ...fields });
  must(r.json && r.json.status === "success", `update ${username}: ${r.text.slice(0, 200)}`);
}
async function signup(jar, username) {
  const r = await api(jar, "POST", "/api/users/signup", { skipLogin: true, username, password: PW, email: `${username}@example.test` });
  must(r.json && r.json.status === "success", `signup ${username}: ${r.text.slice(0, 200)}`);
}
async function seed() {
  let r = await api({}, "POST", "/api/users/first_signup", { username: "rb_admin", password: PW, email: "rb_admin@example.test" });
  must(r.json && r.json.status === "success", "first_signup " + r.text.slice(0, 200));
  const jar = await adminJar();
  for (const m of ["RbA", "RbB"]) { r = await api(jar, "POST", "/api/configure/add", { mission: m }); must(r.json && r.json.status === "success", "add " + m); }
  for (const u of ["rb_sa2", "rb_ma", "rb_vall", "rb_vlim", "rb_plain", "rb_gone"]) await signup(jar, u);
  await setPermission("rb_sa2", "111");
  await upd(jar, "rb_ma", { permission: "110", missions_managing: ["RbA", "RbB"] });
  await upd(jar, "rb_vall", { permission: "001", missions_viewing: null });
  await upd(jar, "rb_vlim", { permission: "001", missions_viewing: ["RbA", "RbB"] });
  await upd(jar, "rb_plain", { permission: "001" });
  await upd(jar, "rb_gone", { permission: "001" });
  r = await api(jar, "POST", "/api/longtermtoken/generate", { period: "never", name: "rb" });
  must(r.json && r.json.status === "success", "token " + r.text.slice(0, 200));
  require("fs").writeFileSync(TOKEN_FILE, JSON.stringify({ token: r.json.body.token, missions: await tokenMissions(r.json.body.token) }));
  console.log("seeded");
}
async function tokenNew() {
  const t = JSON.parse(require("fs").readFileSync(TOKEN_FILE, "utf8"));
  const now = await tokenMissions(t.token);
  must(JSON.stringify(now) === JSON.stringify(t.missions), `legacy token sees ${JSON.stringify(now)} on this release, was ${JSON.stringify(t.missions)}`);
  console.log("legacy token works on this release");
}
async function rollbackEdits() {
  // Documented: a token used on this release gives no access on the previous one
  const t = JSON.parse(require("fs").readFileSync(TOKEN_FILE, "utf8"));
  const seen = await tokenMissions(t.token);
  must(seen.length === 0, `token used on this release still sees ${JSON.stringify(seen)} after rollback`);
  console.log("legacy token used on this release gives no access after rollback");
  const jar = await adminJar();
  await upd(jar, "rb_sa2", { permission: "001" });
  await upd(jar, "rb_ma", { permission: "110", missions_managing: ["RbA"] });
  await upd(jar, "rb_vall", { permission: "001", missions_viewing: ["RbA"] });
  await upd(jar, "rb_vlim", { permission: "001", missions_viewing: ["RbB"] });
  await setPermission("rb_plain", "000");
  await signup(jar, "rb_newbie");
  await upd(jar, "rb_newbie", { permission: "001", missions_viewing: ["RbB"] });
  const e = (await api(jar, "GET", "/api/accounts/entries")).json.body.entries.find((x) => x.username === "rb_gone");
  const r = await api(jar, "DELETE", `/api/accounts/remove/${e.id}`);
  must(r.json && r.json.status === "success", "remove rb_gone " + r.text.slice(0, 200));
  console.log("rollback edits done");
}
function db() {
  return new Client({ host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER_TEST || process.env.DB_USER, password: process.env.DB_PASS_TEST || process.env.DB_PASS, database: "mmgis-test" });
}
// The previous release only lets the API set 110/001; 111 and 000 are set the way operators do it there
async function setPermission(username, permission) {
  const c = db(); await c.connect();
  await c.query("UPDATE users SET permission=$1 WHERE username=$2", [permission, username]);
  await c.end();
}
async function bindings() {
  const c = new Client({ host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER_TEST || process.env.DB_USER, password: process.env.DB_PASS_TEST || process.env.DB_PASS, database: "mmgis-test" });
  await c.connect();
  const { rows } = await c.query(`SELECT u.username, b.role, b.scope_type, m.name AS mission FROM role_bindings b
    LEFT JOIN users u ON b.subject_type='user' AND u.id::text=b.subject_id LEFT JOIN auth_missions m ON m.uuid=b.mission_uuid
    WHERE b.subject_type='user' ORDER BY 1,2,4`);
  const orphan = await c.query(`SELECT count(*) FROM role_bindings b WHERE b.subject_type='user' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text=b.subject_id)`);
  await c.end();
  const by = {};
  for (const r of rows) (by[r.username || "?"] ||= []).push(`${r.role}@${r.mission || r.scope_type}`);
  console.log(JSON.stringify(by, null, 1)); console.log("orphan user bindings:", orphan.rows[0].count);
  if (process.env.VERIFY) {
    for (const k of Object.keys(by)) by[k].sort();
    const sorted = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
    must(sorted(by) === sorted(EXPECTED), "grants after re-upgrade differ from " + JSON.stringify(EXPECTED));
    must(orphan.rows[0].count === "0", "grants of deleted accounts remain");
    console.log("re-upgrade grants OK");
  }
}
({ seed, rollbackEdits, bindings, tokenNew })[process.argv[2]]().catch((e) => { console.error(e.message); process.exit(1); });
