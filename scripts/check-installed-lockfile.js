#!/usr/bin/env node
/**
 * Fails if any installed package in node_modules is at a different version
 * than package-lock.json pins. Run after `npm ci` (whose postinstall also
 * installs plugin deps) to catch installs that re-resolve the locked tree.
 *
 *   node scripts/check-installed-lockfile.js
 *
 * Packages the lockfile lists but that are not installed (optional or
 * omitted dev deps) are skipped.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));

const drifted = [];
let checked = 0;
for (const [key, entry] of Object.entries(lock.packages || {})) {
  if (!key.startsWith("node_modules/") || entry.link || !entry.version) continue;
  const pkgFile = path.join(ROOT, key, "package.json");
  if (!fs.existsSync(pkgFile)) continue;
  const installed = JSON.parse(fs.readFileSync(pkgFile, "utf8")).version;
  checked++;
  if (installed !== entry.version) drifted.push(`${key}: installed ${installed}, locked ${entry.version}`);
}

if (drifted.length) {
  console.error(`${drifted.length} installed package(s) differ from package-lock.json:`);
  drifted.slice(0, 30).forEach((d) => console.error(`  ${d}`));
  if (drifted.length > 30) console.error(`  ...and ${drifted.length - 30} more`);
  console.error("Reinstall with `npm ci`.");
  process.exit(1);
}
console.log(`All ${checked} installed packages match package-lock.json.`);
