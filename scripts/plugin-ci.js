/**
 * Runs the tests of plugins that need an outside service or settings (a
 * directory, a proxy) in CI. Such a plugin sets in its plugin.json:
 *
 *   "ci": { "script": "tests/ci.sh", "variants": ["ldaps", "starttls"] }
 *
 * `script` (relative to the plugin) is run once per variant (or once, with no
 * argument, when there are none) as `<script> <variant>`. It starts what the
 * tests need and appends the ENVs they run with, one KEY=VALUE per line, to the
 * file named by $MMGIS_CI_ENV. The plugin's tests/ (other than @unit tests,
 * which run with every plugin's) then run with those ENVs.
 *
 *   node scripts/plugin-ci.js list                 JSON matrix of every plugin's runs
 *   node scripts/plugin-ci.js run <plugin dir> [variant] [-- playwright args]
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PLUGINS = path.join(ROOT, "plugins");

function fail(msg) {
  console.error(`[plugin-ci] ${msg}`);
  process.exit(1);
}

const dirs = (p) =>
  fs.existsSync(p)
    ? fs
        .readdirSync(p, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !/^[._]/.test(d.name))
        .map((d) => path.join(p, d.name))
    : [];

// The "ci" entry of the plugin at dir, checked, or null when it has none
function ciOf(dir) {
  const file = path.join(dir, "plugin.json");
  if (!fs.existsSync(file)) return null;
  let ci;
  try {
    ci = JSON.parse(fs.readFileSync(file, "utf8")).ci;
  } catch (err) {
    fail(`${path.relative(ROOT, file)} isn't valid JSON: ${err.message}`);
  }
  if (ci == null) return null;
  const where = `${path.relative(ROOT, file)} "ci"`;
  if (typeof ci !== "object" || Array.isArray(ci) || typeof ci.script !== "string")
    fail(`${where} must be { "script": "<path in the plugin>", "variants"?: ["..."] }`);
  const script = path.resolve(dir, ci.script);
  if (path.relative(dir, script).startsWith("..")) fail(`${where}.script must be inside the plugin`);
  if (!fs.existsSync(script)) fail(`${where}.script ${ci.script} doesn't exist`);
  const variants = ci.variants == null ? [""] : ci.variants;
  if (!Array.isArray(variants) || variants.length === 0 || !variants.every((v) => typeof v === "string" && /^[\w.-]*$/.test(v)))
    fail(`${where}.variants must be a non-empty list of names (letters, digits, "_", "-", ".")`);
  return { script, variants };
}

function list() {
  const runs = [];
  for (const container of dirs(PLUGINS))
    for (const type of dirs(container))
      for (const dir of dirs(type)) {
        const ci = ciOf(dir);
        if (!ci) continue;
        const rel = path.relative(ROOT, dir).split(path.sep).join("/");
        for (const variant of ci.variants)
          runs.push({ name: [path.basename(dir), variant].filter(Boolean).join(" "), slug: [rel.replace(/\W+/g, "-"), variant].filter(Boolean).join("-"), dir: rel, variant });
      }
  return runs;
}

function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) fail(`${line} in the ENVs from the plugin's ci script isn't KEY=VALUE`);
    env[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return env;
}

function run(relDir, variant = "", extra = []) {
  const dir = path.resolve(ROOT, relDir || "");
  if (!relDir || path.relative(PLUGINS, dir).startsWith("..")) fail("run needs a plugin folder under plugins/");
  const ci = ciOf(dir);
  if (!ci) fail(`${relDir}/plugin.json has no "ci" entry`);
  if (!ci.variants.includes(variant)) fail(`${relDir} has no ci variant '${variant}' (it has: ${ci.variants.map((v) => v || "(none)").join(", ")})`);
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mmgis-plugin-ci-")), "env");
  fs.writeFileSync(envFile, "");
  const setup = spawnSync(ci.script, variant ? [variant] : [], { cwd: ROOT, stdio: "inherit", env: { ...process.env, MMGIS_CI_ENV: envFile } });
  if (setup.status !== 0) fail(`${path.relative(ROOT, ci.script)} ${variant} failed${setup.error ? `: ${setup.error.message}` : ""}`);
  const env = readEnv(envFile);
  console.log(`[plugin-ci] ${relDir}${variant ? ` (${variant})` : ""} with ${Object.keys(env).join(", ") || "no extra ENVs"}`);
  const tests = spawnSync("npx", ["--no-install", "playwright", "test", path.join(relDir, "tests"), "--grep-invert", "@unit", ...extra], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  process.exit(tests.status == null ? 1 : tests.status);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "list") console.log(JSON.stringify(list()));
else if (cmd === "run") {
  const dash = args.indexOf("--");
  const pos = dash === -1 ? args : args.slice(0, dash);
  run(pos[0], pos[1] || "", dash === -1 ? [] : args.slice(dash + 1));
} else fail("usage: node scripts/plugin-ci.js list | run <plugin dir> [variant] [-- playwright args]");
