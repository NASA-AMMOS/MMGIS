/**
 * Validates tests/capabilities.yml and the capability tags used in test files.
 * Run with: npm run test:ci
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import picomatch from "picomatch";
import { loadCatalog } from "../reporting/capability-report.js";

const ROOT = path.resolve(__dirname, "..", "..");
const CATALOG = path.join(ROOT, "tests", "capabilities.yml");
const LEVELS = ["unit", "api", "flow"];
const RISKS = ["high", "medium", "low"];
const SPEC_GLOBS = ["tests/**/*.spec.js", "plugins/**/tests/*.spec.js"];

const catalog = loadCatalog(CATALOG);
const SKIP_DIRS = new Set([".git", "node_modules", "build", "dist", "playwright-report", "test-results", "Missions"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(rel, out);
    } else out.push(rel);
  }
  return out;
}

const allFiles = walk("");
const isSpec = picomatch(SPEC_GLOBS);
const isScaffold = picomatch("**/plugin-cli/scaffolds/**");
const specFiles = allFiles.filter((f) => isSpec(f) && !isScaffold(f));

function globMatches(pattern) {
  const match = picomatch(pattern, { dot: true });
  return allFiles.some((f) => match(f));
}

test.describe("capability catalog", () => {
  test("defines every test level", () => {
    for (const level of LEVELS) {
      expect(catalog.levels[level], `levels.${level}`).toBeTruthy();
      expect(Array.isArray(catalog.levels[level].tests), `levels.${level}.tests`).toBe(true);
    }
  });

  test("area and capability ids are unique and well formed", () => {
    const areaIds = catalog.areas.map((a) => a.id);
    expect(new Set(areaIds).size).toBe(areaIds.length);
    const ids = [];
    for (const c of catalog.capabilities) {
      expect(c.id, "capability id").toMatch(/^[A-Z]+(-[A-Z0-9]+)+$/);
      expect(areaIds, `${c.id} area`).toContain(c.area);
      expect(c.id.startsWith(`${c.area}-`), `${c.id} should start with its area ${c.area}-`).toBe(true);
      expect(c.title, `${c.id} title`).toBeTruthy();
      expect(RISKS, `${c.id} risk`).toContain(c.risk);
      expect(c.requires.length, `${c.id} requires at least one level`).toBeGreaterThan(0);
      for (const l of c.requires) expect(LEVELS, `${c.id} requires`).toContain(l);
      ids.push(c.id);
      for (const s of c.scenarios) {
        expect(s.id, `${c.id} scenario id`).toMatch(new RegExp(`^${c.id}-\\d{2}$`));
        expect(s.title, `${s.id} title`).toBeTruthy();
        ids.push(s.id);
      }
    }
    expect(ids.length - new Set(ids).size, "duplicate ids").toBe(0);
  });

  test("every source path glob matches at least one file", () => {
    const dead = [];
    for (const c of catalog.capabilities) {
      expect(Array.isArray(c.paths) && c.paths.length > 0, `${c.id} paths`).toBe(true);
      for (const p of c.paths) if (!globMatches(p)) dead.push(`${c.id}: ${p}`);
    }
    expect(dead, "paths globs that match nothing").toEqual([]);
  });

  test("every test glob matches at least one spec file", () => {
    const dead = [];
    for (const c of catalog.capabilities) {
      for (const g of c.tests) {
        const match = picomatch(g, { dot: true });
        if (!specFiles.some((f) => match(f))) dead.push(`${c.id}: ${g}`);
      }
    }
    expect(dead, "tests globs that match no spec file").toEqual([]);
  });

  test("every spec file belongs to at least one capability", () => {
    const unmapped = specFiles.filter((f) => !catalog.capabilities.some((c) => c.matchTests(f)));
    expect(unmapped, "add these files to a capability's tests globs").toEqual([]);
  });

  test("capability tags in test files reference known ids", () => {
    const known = new Set([...catalog.byId.keys(), ...catalog.scenarioToCap.keys(), ...LEVELS]);
    const unknown = [];
    for (const f of specFiles) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/["'`]@([A-Z]+(?:-[A-Z0-9]+)+|unit|api|flow)["'`]/g)) {
        if (!known.has(m[1])) unknown.push(`${f}: @${m[1]}`);
      }
    }
    expect(unknown, "unknown capability/scenario tags").toEqual([]);
  });
});
