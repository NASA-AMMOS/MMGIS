#!/usr/bin/env node
/**
 * Converts legacy account permissions (users.permission, missions_managing,
 * missions_viewing) into role bindings.
 *
 *   npm run auth:migrate -- --dry-run   Report what would happen. Writes nothing.
 *   npm run auth:migrate                Apply (the server also does this on first start).
 *
 * The dry run may be run before upgrading, against the old .env: a legacy AUTH
 * value is translated to its SITE_ACCESS / AUTH_PROVIDERS replacement.
 * Passwords and usernames are never written.
 */
require("dotenv").config();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
if (args.has("--force")) {
  console.error("--force has been removed: the import runs once per database so it never re-grants removed access.");
  process.exit(1);
}
const json = args.has("--json");

const siteAccess = require("../API/permissions/siteAccess");
const providers = require("../API/permissions/providers");

const notes = [];
if (process.env.AUTH != null && process.env.AUTH !== "") {
  const legacyKey = Object.keys(siteAccess.LEGACY_AUTH_REPLACEMENTS).find(
    (k) => k === String(process.env.AUTH).toLowerCase()
  );
  const legacy = legacyKey && siteAccess.LEGACY_AUTH_REPLACEMENTS[legacyKey];
  if (!legacy) {
    console.error("Unknown legacy AUTH value. Set SITE_ACCESS and AUTH_PROVIDERS instead.");
    process.exit(1);
  }
  if (!dryRun) {
    console.error(siteAccess.validate().join("\n"));
    process.exit(1);
  }
  notes.push(
    `Legacy AUTH=${legacyKey} found. Before upgrading, replace it with SITE_ACCESS=${legacy.SITE_ACCESS} and AUTH_PROVIDERS=${legacy.AUTH_PROVIDERS}.`
  );
  delete process.env.AUTH;
  process.env.SITE_ACCESS = process.env.SITE_ACCESS || legacy.SITE_ACCESS;
  process.env.AUTH_PROVIDERS = process.env.AUTH_PROVIDERS || legacy.AUTH_PROVIDERS;
}
const errors = siteAccess.validate();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function main() {
  const { sequelize } = require("../API/connection");
  const legacyImport = require("../API/permissions/legacyImport");
  const { User } = require("../plugins/core/backend/Users/models/user");
  const permissionModels = require("../API/permissions/models");

  const imported = await legacyImport.alreadyImported();
  // Read-only check that every stored password is a bcrypt hash; they are never rewritten
  const users = await User.findAll({ attributes: ["id", "username", "password"], raw: true });
  const badHashes = users.filter((u) => !BCRYPT.test(u.password || "")).map((u) => u.username);

  let result;
  if (dryRun) result = await legacyImport.plan({ dryRun: true });
  else {
    await permissionModels.AuthMission.sync();
    await permissionModels.AuthGroup.sync();
    await permissionModels.AuthGroupMember.sync();
    await permissionModels.RoleBinding.sync();
    await permissionModels.AuthMeta.sync();
    await permissionModels.up();
    result = await legacyImport.run();
    if (result.skipped) result = { ...(await legacyImport.plan()), skipped: true };
  }

  const byUser = {};
  for (const b of result.bindings) {
    const key = b.subject_type === "user"
      ? (users.find((u) => String(u.id) === b.subject_id) || {}).username || `user ${b.subject_id}`
      : `${b.subject_type}:${b.subject_id}`;
    (byUser[key] = byUser[key] || []).push(
      `${b.role}@${b.scope_type}${b.mission_uuid ? ":" + b.mission_uuid : ""}`
    );
  }
  const report = {
    mode: dryRun ? "dry-run (no changes written)" : result.skipped ? "already imported (no changes)" : "applied",
    // Only known values are echoed, never raw ENV contents
    siteAccess: siteAccess.SITE_ACCESS_VALUES[siteAccess.SITE_ACCESS_VALUES.indexOf(siteAccess.getSiteAccess())] || null,
    providers: providers.availableProviders().filter((p) => siteAccess.getProviders().includes(p)),
    alreadyImported: imported,
    users: users.length,
    bindings: result.bindings.length,
    unknownMissions: result.unknownMissions,
    nonBcryptPasswords: badHashes,
    notes,
    plan: byUser,
  };
  // One line of JSON; JSON.stringify already escapes control characters
  if (json) console.log(JSON.stringify(report).replace(/[\r\n]/g, ""));
  else {
    console.log(`\nMMGIS auth migration — ${report.mode}`);
    console.log(`SITE_ACCESS=${report.siteAccess} AUTH_PROVIDERS=${JSON.stringify(report.providers)}`);
    notes.forEach((n) => console.log(`NOTE: ${n}`));
    if (imported && dryRun) console.log("NOTE: this database was already imported; the server will not import again.");
    console.log(
      `${report.users} user(s), ${report.bindings} role binding(s)${Object.keys(byUser).length ? ":" : "."}`
    );
    for (const [who, list] of Object.entries(byUser)) console.log(`  ${who}: ${list.join(", ")}`);
    if (report.unknownMissions.length)
      console.log(`WARNING: legacy mission names with no mission (skipped): ${report.unknownMissions.join(", ")}`);
    if (badHashes.length)
      console.log(`WARNING: these accounts have a password that is not a bcrypt hash and cannot log in: ${badHashes.join(", ")}`);
    else console.log("All stored passwords are bcrypt hashes. They are not modified.");
  }
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
