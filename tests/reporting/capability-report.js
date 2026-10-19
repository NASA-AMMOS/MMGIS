#!/usr/bin/env node
"use strict";

/**
 * Capability coverage report.
 *
 * Joins tests/capabilities.yml with one or more Playwright JSON result files
 * and writes capability-report.{json,md,html} to the output directory.
 *
 *   node tests/reporting/capability-report.js \
 *     --results capability-results \
 *     --out capability-report
 *
 * --results accepts files or directories (every *.json inside is read). The
 * file name (without .json) is used as the run label, e.g. "unit", "api-off".
 * With no results the report still lists every capability as "no results".
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const picomatch = require("picomatch");

const ROOT = path.resolve(__dirname, "..", "..");
const LEVELS = ["unit", "api", "flow"];
const TAG_ID = /^[A-Z]+(-[A-Z0-9]+)+$/;

function parseArgs(argv) {
  const args = { results: [], out: "capability-report", catalog: path.join(ROOT, "tests", "capabilities.yml"), title: "MMGIS capability coverage" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--results") args.results.push(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--catalog") args.catalog = argv[++i];
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function loadCatalog(file) {
  const doc = YAML.parse(fs.readFileSync(file, "utf8"));
  const levelMatchers = LEVELS.map((level) => ({
    level,
    match: picomatch((doc.levels[level] && doc.levels[level].tests) || [], { dot: true }),
  }));
  const capabilities = (doc.capabilities || []).map((c) => ({
    ...c,
    requires: c.requires || [],
    scenarios: c.scenarios || [],
    tests: c.tests || [],
    matchTests: picomatch(c.tests && c.tests.length ? c.tests : ["\0never"], { dot: true }),
  }));
  const byId = new Map(capabilities.map((c) => [c.id, c]));
  const scenarioToCap = new Map();
  for (const c of capabilities) for (const s of c.scenarios) scenarioToCap.set(s.id, c.id);
  return { doc, areas: doc.areas || [], levels: doc.levels, levelMatchers, capabilities, byId, scenarioToCap };
}

function listJsonFiles(inputs) {
  const files = [];
  for (const input of inputs) {
    if (!input || !fs.existsSync(input)) continue;
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      for (const f of fs.readdirSync(input).sort()) {
        if (f.endsWith(".json")) files.push(path.join(input, f));
      }
    } else files.push(input);
  }
  return files;
}

function readPlaywrightJson(file) {
  let text = fs.readFileSync(file, "utf8");
  if (!text.trimStart().startsWith("{")) {
    const idx = text.indexOf('{\n  "config"');
    if (idx === -1) throw new Error(`${file} is not a Playwright JSON report`);
    text = text.slice(idx);
  }
  return JSON.parse(text);
}

function normalizeFile(file, rootDir) {
  let p = file.replace(/\\/g, "/");
  if (rootDir && !p.startsWith("tests/") && !p.startsWith("plugins/")) {
    p = path.relative(ROOT, path.resolve(rootDir, file)).replace(/\\/g, "/");
  }
  const m = p.match(/(?:^|\/)((?:tests|plugins)\/.*)$/);
  return m ? m[1] : p;
}

function outcomeOf(test) {
  const last = test.results && test.results.length ? test.results[test.results.length - 1] : null;
  if (test.status === "skipped" || (last && last.status === "skipped")) return "skipped";
  if (test.status === "flaky") return "flaky";
  if (test.status === "unexpected") return "failed";
  return "passed";
}

function skipReasonOf(test) {
  const annotations = [...(test.annotations || [])];
  for (const r of test.results || []) annotations.push(...(r.annotations || []));
  const a = annotations.find((x) => x.type === "skip" || x.type === "fixme");
  return a ? (a.description || a.type).trim() : "";
}

function walkSuites(suites, titlePath, visit) {
  for (const suite of suites || []) {
    const tp = suite.title && !suite.title.endsWith(".spec.js") ? [...titlePath, suite.title] : titlePath;
    for (const spec of suite.specs || []) visit(spec, tp);
    walkSuites(suite.suites, tp, visit);
  }
}

function tagsOf(spec, titlePath) {
  const tags = new Set((spec.tags || []).map((t) => t.replace(/^@/, "")));
  for (const t of [...titlePath, spec.title].join(" ").match(/@[A-Za-z0-9-]+/g) || []) tags.add(t.slice(1));
  return [...tags];
}

function classify(catalog, file, tags) {
  const levelTag = tags.find((t) => LEVELS.includes(t));
  const level = levelTag || (catalog.levelMatchers.find((m) => m.match(file)) || { level: "flow" }).level;
  const capIds = new Set();
  const scenarioIds = new Set();
  const unknownTags = [];
  for (const t of tags) {
    if (LEVELS.includes(t) || !TAG_ID.test(t)) continue;
    if (catalog.byId.has(t)) capIds.add(t);
    else if (catalog.scenarioToCap.has(t)) {
      scenarioIds.add(t);
      capIds.add(catalog.scenarioToCap.get(t));
    } else unknownTags.push(t);
  }
  if (capIds.size === 0) {
    for (const c of catalog.capabilities) if (c.matchTests(file)) capIds.add(c.id);
  }
  return { level, capIds: [...capIds], scenarioIds: [...scenarioIds], unknownTags };
}

function emptyCounts() {
  return { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 };
}

function add(counts, outcome) {
  counts.total++;
  counts[outcome]++;
}

function buildReport(catalog, resultFiles, meta) {
  const runs = [];
  const records = [];
  for (const file of resultFiles) {
    const json = readPlaywrightJson(file);
    const label = path.basename(file, ".json");
    const rootDir = json.config && json.config.rootDir;
    const run = { label, file: path.basename(file), counts: emptyCounts(), durationMs: (json.stats && json.stats.duration) || 0 };
    walkSuites(json.suites, [], (spec, titlePath) => {
      const fileRel = normalizeFile(spec.file, rootDir);
      const tags = tagsOf(spec, titlePath);
      const cls = classify(catalog, fileRel, tags);
      for (const test of spec.tests || []) {
        const outcome = outcomeOf(test);
        add(run.counts, outcome);
        records.push({
          run: label,
          project: test.projectName,
          file: fileRel,
          line: spec.line,
          title: [...titlePath, spec.title].join(" › "),
          outcome,
          skipReason: outcome === "skipped" ? skipReasonOf(test) : "",
          ...cls,
        });
      }
    });
    runs.push(run);
  }

  const levelsRun = new Set(records.map((r) => r.level));
  const caps = catalog.capabilities.map((c) => {
    const levels = Object.fromEntries(LEVELS.map((l) => [l, emptyCounts()]));
    const scenarios = c.scenarios.map((s) => ({ ...s, counts: emptyCounts(), tests: [] }));
    const failures = [];
    const files = new Set();
    for (const r of records) {
      if (!r.capIds.includes(c.id)) continue;
      add(levels[r.level], r.outcome);
      files.add(r.file);
      if (r.outcome === "failed") failures.push({ run: r.run, file: r.file, line: r.line, title: r.title });
      for (const s of scenarios) {
        if (r.scenarioIds.includes(s.id)) {
          add(s.counts, r.outcome);
          s.tests.push({ run: r.run, file: r.file, title: r.title, outcome: r.outcome });
        }
      }
    }
    for (const s of scenarios) s.status = scenarioStatus(s.counts);
    const total = LEVELS.reduce((n, l) => n + levels[l].total, 0);
    const notRunLevels = c.requires.filter((l) => !levelsRun.has(l));
    const missingLevels = c.requires.filter((l) => levelsRun.has(l) && levels[l].total === 0);
    const unverifiedLevels = c.requires.filter((l) => levels[l].total > 0 && levels[l].passed + levels[l].flaky === 0 && levels[l].failed === 0);
    let status;
    if (records.length === 0) status = "no-results";
    else if (failures.length) status = "failing";
    else if (missingLevels.length) status = "gap";
    else if (unverifiedLevels.length) status = "skipped";
    else if (notRunLevels.length) status = "partial";
    else status = "covered";
    return {
      id: c.id,
      area: c.area,
      title: c.title,
      risk: c.risk || "medium",
      requires: c.requires,
      status,
      total,
      levels,
      missingLevels,
      notRunLevels,
      unverifiedLevels,
      failures,
      testFiles: [...files].sort(),
      scenarios: scenarios.map(({ id, title, source, status: st, counts, tests }) => ({ id, title, source: source || "", status: st, counts, tests })),
    };
  });

  const areas = catalog.areas.map((a) => {
    const list = caps.filter((c) => c.area === a.id);
    const byStatus = {};
    for (const c of list) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const scen = list.flatMap((c) => c.scenarios);
    return {
      id: a.id,
      title: a.title,
      description: a.description || "",
      capabilities: list.length,
      byStatus,
      tests: list.reduce((n, c) => n + c.total, 0),
      scenarios: scen.length,
      scenariosLinked: scen.filter((s) => s.status !== "not-linked").length,
    };
  });

  const unmapped = records.filter((r) => r.capIds.length === 0);
  const unknownTags = {};
  for (const r of records) for (const t of r.unknownTags) (unknownTags[t] = unknownTags[t] || new Set()).add(r.file);

  const skipReasons = {};
  for (const r of records) {
    if (r.outcome !== "skipped") continue;
    const key = r.skipReason || "(no reason given)";
    skipReasons[key] = (skipReasons[key] || 0) + 1;
  }

  const totals = emptyCounts();
  const totalsByLevel = Object.fromEntries(LEVELS.map((l) => [l, emptyCounts()]));
  for (const r of records) {
    add(totals, r.outcome);
    add(totalsByLevel[r.level], r.outcome);
  }

  const allScenarios = caps.flatMap((c) => c.scenarios);
  return {
    schema: 1,
    meta,
    runs,
    totals,
    totalsByLevel,
    levelsRun: LEVELS.filter((l) => levelsRun.has(l)),
    capabilitySummary: countBy(caps, "status"),
    scenarioSummary: { total: allScenarios.length, ...countBy(allScenarios, "status") },
    areas,
    capabilities: caps,
    unmapped: unmapped.map((r) => ({ run: r.run, file: r.file, title: r.title, outcome: r.outcome })),
    unknownTags: Object.fromEntries(Object.entries(unknownTags).map(([k, v]) => [k, [...v].sort()])),
    skipReasons: Object.entries(skipReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
  };
}

function scenarioStatus(counts) {
  if (counts.total === 0) return "not-linked";
  if (counts.failed) return "failing";
  if (counts.passed + counts.flaky) return "covered";
  return "skipped";
}

function countBy(list, key) {
  const out = {};
  for (const x of list) out[x[key]] = (out[x[key]] || 0) + 1;
  return out;
}

function collectMeta(title) {
  const env = process.env;
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  const repo = env.GITHUB_REPOSITORY || "";
  return {
    title,
    generatedAt: new Date().toISOString(),
    repository: repo,
    ref: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || "",
    sha: env.GITHUB_SHA || "",
    event: env.GITHUB_EVENT_NAME || "local",
    runUrl: repo && env.GITHUB_RUN_ID ? `${server}/${repo}/actions/runs/${env.GITHUB_RUN_ID}` : "",
  };
}

// ---------------------------------------------------------------- Markdown

const STATUS_LABEL = {
  covered: "Covered",
  failing: "Failing",
  gap: "Gap",
  skipped: "Skipped only",
  partial: "Partial run",
  "no-results": "No results",
  "not-linked": "Not linked",
};
const STATUS_ICON = { covered: "🟢", failing: "🔴", gap: "🟠", skipped: "⚪", partial: "🔵", "no-results": "⚫", "not-linked": "·" };

function fmtCounts(c) {
  if (!c.total) return "–";
  const parts = [`${c.passed + c.flaky}✓`];
  if (c.failed) parts.push(`${c.failed}✗`);
  if (c.skipped) parts.push(`${c.skipped}⏭`);
  return parts.join(" ");
}

function toMarkdown(report) {
  const m = report.meta;
  const lines = [];
  lines.push(`## ${m.title}`, "");
  const where = [m.ref && `\`${m.ref}\``, m.sha && `\`${m.sha.slice(0, 8)}\``, m.runUrl && `[run](${m.runUrl})`].filter(Boolean).join(" · ");
  if (where) lines.push(where, "");
  lines.push(
    "Legend: 🟢 covered · 🔴 failing · 🟠 gap (a required level has no tests) · ⚪ only skipped results · 🔵 partial (a required level was not run in this report). Counts are ✓ passed, ✗ failed, ⏭ skipped.",
    ""
  );
  const notRun = LEVELS.filter((l) => !report.levelsRun.includes(l));
  if (notRun.length) lines.push(`> Levels not run in this report: ${notRun.join(", ")}. Capabilities that require them are marked partial, not gap.`, "");
  const t = report.totals;
  lines.push(`**Tests:** ${t.total} (${t.passed} passed, ${t.flaky} flaky, ${t.failed} failed, ${t.skipped} skipped) across ${report.runs.length} run(s): ${report.runs.map((r) => `\`${r.label}\``).join(", ") || "none"}`);
  const cs = report.capabilitySummary;
  lines.push(`**Capabilities:** ${report.capabilities.length} — ${Object.keys(STATUS_LABEL).filter((k) => cs[k]).map((k) => `${cs[k]} ${STATUS_LABEL[k].toLowerCase()}`).join(", ")}`);
  const ss = report.scenarioSummary;
  lines.push(`**Scenarios:** ${ss.total} — ${ss.covered || 0} covered, ${ss.failing || 0} failing, ${ss.skipped || 0} skipped, ${ss["not-linked"] || 0} not yet linked to a test`, "");

  lines.push("### By feature area", "", "| Area | Capabilities | 🟢 | 🔴 | 🟠 | ⚪ | 🔵 | Tests | Scenarios linked |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const a of report.areas) {
    const b = a.byStatus;
    lines.push(`| **${a.id}** ${a.title} | ${a.capabilities} | ${b.covered || 0} | ${b.failing || 0} | ${b.gap || 0} | ${b.skipped || 0} | ${b.partial || 0} | ${a.tests} | ${a.scenariosLinked}/${a.scenarios} |`);
  }
  lines.push("", "### Capability matrix", "", "| | Capability | Risk | Requires | Unit | API | Flow | Scenarios |", "|---|---|---|---|---|---|---|---|");
  for (const c of report.capabilities) {
    const req = c.requires.map((l) => (c.missingLevels.includes(l) ? `~~${l}~~` : c.notRunLevels.includes(l) ? `${l}?` : l)).join(", ");
    const linked = c.scenarios.filter((s) => s.status !== "not-linked").length;
    lines.push(`| ${STATUS_ICON[c.status]} | \`${c.id}\` ${c.title} | ${c.risk} | ${req} | ${fmtCounts(c.levels.unit)} | ${fmtCounts(c.levels.api)} | ${fmtCounts(c.levels.flow)} | ${c.scenarios.length ? `${linked}/${c.scenarios.length}` : "–"} |`);
  }
  const failing = report.capabilities.filter((c) => c.failures.length);
  if (failing.length) {
    lines.push("", "### Failures", "");
    for (const c of failing) for (const f of c.failures.slice(0, 20)) lines.push(`- \`${c.id}\` [${f.run}] ${f.file}:${f.line} — ${f.title}`);
  }
  if (report.unmapped.length) {
    const files = [...new Set(report.unmapped.map((u) => u.file))].sort();
    lines.push("", `### Unmapped tests (${report.unmapped.length} tests in ${files.length} files)`, "", "Add these files to a capability's `tests` globs in `tests/capabilities.yml`, or tag the tests.", "");
    for (const f of files) lines.push(`- ${f}`);
  }
  const unknown = Object.keys(report.unknownTags);
  if (unknown.length) {
    lines.push("", "### Unknown capability tags", "");
    for (const t of unknown) lines.push(`- \`@${t}\` in ${report.unknownTags[t].join(", ")}`);
  }
  if (report.skipReasons.length) {
    lines.push("", "<details><summary>Top skip reasons</summary>", "", "| Count | Reason |", "|---:|---|");
    for (const s of report.skipReasons.slice(0, 25)) lines.push(`| ${s.count} | ${s.reason.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`);
    lines.push("", "</details>");
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------- HTML

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function cell(c, required, run) {
  if (!c.total && required && !run) return `<td class="lvl na">not run</td>`;
  if (!c.total) return `<td class="lvl ${required ? "miss" : "na"}">${required ? "missing" : "–"}</td>`;
  const cls = c.failed ? "fail" : c.passed + c.flaky ? "pass" : "skip";
  const parts = [`<b>${c.passed + c.flaky}</b> passed`];
  if (c.failed) parts.push(`<b>${c.failed}</b> failed`);
  if (c.skipped) parts.push(`${c.skipped} skipped`);
  return `<td class="lvl ${cls}">${parts.join("<br>")}</td>`;
}

function badge(status) {
  return `<span class="badge s-${status}">${esc(STATUS_LABEL[status] || status)}</span>`;
}

function toHtml(report) {
  const m = report.meta;
  const t = report.totals;
  const cs = report.capabilitySummary;
  const ss = report.scenarioSummary;
  const kpi = (label, value, cls = "") => `<div class="kpi ${cls}"><div class="v">${value}</div><div class="l">${esc(label)}</div></div>`;

  const areaRows = report.areas
    .map((a) => {
      const b = a.byStatus;
      const seg = ["covered", "failing", "gap", "skipped", "partial", "no-results"]
        .filter((k) => b[k])
        .map((k) => `<span class="seg s-${k}" style="flex:${b[k]}" title="${b[k]} ${esc(STATUS_LABEL[k])}"></span>`)
        .join("");
      return `<tr><td><b>${esc(a.id)}</b></td><td>${esc(a.title)}<div class="muted">${esc(a.description)}</div></td><td class="num">${a.capabilities}</td><td><div class="bar">${seg}</div></td><td class="num">${a.tests}</td><td class="num">${a.scenariosLinked}/${a.scenarios}</td></tr>`;
    })
    .join("");

  const capSections = report.areas
    .map((a) => {
      const rows = report.capabilities
        .filter((c) => c.area === a.id)
        .map((c) => {
          const linked = c.scenarios.filter((s) => s.status !== "not-linked").length;
          const details = [];
          if (c.scenarios.length) {
            details.push(`<h4>Scenarios</h4><ul class="scen">${c.scenarios.map((s) => `<li>${badge(s.status)} <code>${esc(s.id)}</code> ${esc(s.title)}${s.source ? ` <span class="muted">(${esc(s.source)})</span>` : ""}${s.tests.length ? `<div class="muted">${s.tests.map((x) => `${esc(x.outcome)}: ${esc(x.title)}`).join("<br>")}</div>` : ""}</li>`).join("")}</ul>`);
          }
          if (c.failures.length) details.push(`<h4>Failures</h4><ul>${c.failures.map((f) => `<li>[${esc(f.run)}] <code>${esc(f.file)}:${f.line}</code> ${esc(f.title)}</li>`).join("")}</ul>`);
          if (c.testFiles.length) details.push(`<h4>Test files</h4><ul class="files">${c.testFiles.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>`);
          return `<tr class="cap" data-status="${c.status}"><td>${badge(c.status)}</td><td><code>${esc(c.id)}</code><div>${esc(c.title)}</div>${details.length ? `<details><summary>Details</summary>${details.join("")}</details>` : ""}</td><td>${esc(c.risk)}</td><td>${c.requires.map(esc).join(", ")}</td>${LEVELS.map((l) => cell(c.levels[l], c.requires.includes(l), report.levelsRun.includes(l))).join("")}<td class="num">${c.scenarios.length ? `${linked}/${c.scenarios.length}` : "–"}</td></tr>`;
        })
        .join("");
      return `<h3 id="area-${esc(a.id)}">${esc(a.id)} · ${esc(a.title)}</h3><table class="matrix"><thead><tr><th>Status</th><th>Capability</th><th>Risk</th><th>Requires</th><th>Unit</th><th>API</th><th>Flow</th><th>Scenarios</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  const unmappedFiles = [...new Set(report.unmapped.map((u) => u.file))].sort();
  const extra = [];
  if (unmappedFiles.length) extra.push(`<h2>Unmapped tests</h2><p>${report.unmapped.length} tests in ${unmappedFiles.length} files are not attributed to any capability.</p><ul class="files">${unmappedFiles.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>`);
  const unknown = Object.keys(report.unknownTags);
  if (unknown.length) extra.push(`<h2>Unknown capability tags</h2><ul>${unknown.map((k) => `<li><code>@${esc(k)}</code> in ${report.unknownTags[k].map(esc).join(", ")}</li>`).join("")}</ul>`);
  if (report.skipReasons.length) extra.push(`<h2>Skip reasons</h2><table><thead><tr><th class="num">Count</th><th>Reason</th></tr></thead><tbody>${report.skipReasons.slice(0, 40).map((s) => `<tr><td class="num">${s.count}</td><td>${esc(s.reason)}</td></tr>`).join("")}</tbody></table>`);

  const runRows = report.runs.map((r) => `<tr><td><code>${esc(r.label)}</code></td><td class="num">${r.counts.total}</td><td class="num">${r.counts.passed}</td><td class="num">${r.counts.flaky}</td><td class="num">${r.counts.failed}</td><td class="num">${r.counts.skipped}</td><td class="num">${(r.durationMs / 60000).toFixed(1)} min</td></tr>`).join("");
  const lvlRows = LEVELS.map((l) => { const c = report.totalsByLevel[l]; return `<tr><td>${esc(l)}</td><td class="num">${c.total}</td><td class="num">${c.passed}</td><td class="num">${c.flaky}</td><td class="num">${c.failed}</td><td class="num">${c.skipped}</td></tr>`; }).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.title)}</title>
<style>
:root{--bg:#fff;--fg:#1d2330;--muted:#5f6b7a;--line:#d9dee5;--card:#f6f8fa;--ok:#1a7f37;--bad:#cf222e;--gap:#bc4c00;--skip:#8c959f;--nr:#57606a}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9da7b3;--line:#30363d;--card:#161b22;--ok:#3fb950;--bad:#f85149;--gap:#db6d28;--skip:#6e7681;--nr:#8b949e}}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--fg)}
main{max-width:1200px;margin:0 auto;padding:24px}h1{margin:0 0 4px;font-size:24px}h2{margin-top:32px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{margin-top:24px}h4{margin:8px 0 4px}
.muted{color:var(--muted);font-size:12px}code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}.kpi{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.kpi .v{font-size:24px;font-weight:600}.kpi .l{color:var(--muted);font-size:12px}
.kpi.ok .v{color:var(--ok)}.kpi.bad .v{color:var(--bad)}.kpi.gap .v{color:var(--gap)}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600}.num{text-align:right;white-space:nowrap}
.bar{display:flex;height:12px;border-radius:6px;overflow:hidden;min-width:120px;background:var(--card)}.seg{display:block}
.badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap}
.s-covered{background:var(--ok)}.s-failing{background:var(--bad)}.s-gap{background:var(--gap)}.s-skipped{background:var(--skip)}.s-partial{background:#0969da}.s-no-results{background:var(--nr)}.s-not-linked{background:transparent;color:var(--muted);border:1px solid var(--line)}
td.lvl{font-size:12px;white-space:nowrap}td.pass{color:var(--ok)}td.fail{color:var(--bad)}td.skip{color:var(--skip)}td.miss{color:var(--gap);font-weight:600}td.na{color:var(--muted)}
details summary{cursor:pointer;color:var(--muted);font-size:12px}ul{margin:4px 0;padding-left:20px}ul.scen li{margin:3px 0}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.filters label{font-size:12px;display:flex;gap:4px;align-items:center}
.legend{font-size:12px;color:var(--muted)}
@media print{details{display:none}.filters{display:none}}
</style></head><body><main>
<h1>${esc(m.title)}</h1>
<div class="muted">${[m.repository, m.ref, m.sha && m.sha.slice(0, 8), m.event, `generated ${m.generatedAt}`].filter(Boolean).map(esc).join(" · ")}${m.runUrl ? ` · <a href="${esc(m.runUrl)}">workflow run</a>` : ""}</div>
<div class="kpis">
${kpi("Tests run", t.total)}${kpi("Passed", t.passed + t.flaky, "ok")}${kpi("Failed", t.failed, t.failed ? "bad" : "")}${kpi("Skipped", t.skipped)}
${kpi("Capabilities covered", `${cs.covered || 0}/${report.capabilities.length}`, "ok")}${kpi("Capabilities failing", cs.failing || 0, cs.failing ? "bad" : "")}${kpi("Capability gaps", cs.gap || 0, cs.gap ? "gap" : "")}${kpi("Scenarios linked", `${ss.total - (ss["not-linked"] || 0)}/${ss.total}`)}
</div>
<p class="legend">${["covered", "failing", "gap", "skipped", "partial", "no-results"].map((k) => `${badge(k)} `).join("")}— <b>Gap</b>: a level the capability requires (unit / api / flow) has no tests. <b>Skipped only</b>: tests exist but none ran to completion. <b>Partial run</b>: a required level was not part of this run. A scenario is <b>linked</b> once a test carries its <code>@ID</code> tag.</p>
<h2>Feature areas</h2>
<table><thead><tr><th>Area</th><th>Title</th><th class="num">Capabilities</th><th>Status</th><th class="num">Tests</th><th class="num">Scenarios linked</th></tr></thead><tbody>${areaRows}</tbody></table>
<h2>Capability matrix</h2>
<div class="filters">${["covered", "failing", "gap", "skipped", "partial", "no-results"].map((k) => `<label><input type="checkbox" data-filter="${k}" checked> ${esc(STATUS_LABEL[k])}</label>`).join("")}</div>
${capSections}
<h2>Runs</h2>
<table><thead><tr><th>Run</th><th class="num">Total</th><th class="num">Passed</th><th class="num">Flaky</th><th class="num">Failed</th><th class="num">Skipped</th><th class="num">Duration</th></tr></thead><tbody>${runRows}</tbody></table>
<table><thead><tr><th>Level</th><th class="num">Total</th><th class="num">Passed</th><th class="num">Flaky</th><th class="num">Failed</th><th class="num">Skipped</th></tr></thead><tbody>${lvlRows}</tbody></table>
${extra.join("\n")}
</main>
<script>
document.querySelectorAll("[data-filter]").forEach(function (box) {
  box.addEventListener("change", function () {
    var on = {};
    document.querySelectorAll("[data-filter]").forEach(function (b) { on[b.dataset.filter] = b.checked; });
    document.querySelectorAll("tr.cap").forEach(function (row) { row.style.display = on[row.dataset.status] === false ? "none" : ""; });
  });
});
</script>
</body></html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: capability-report.js --results <file|dir> [--results ...] [--out dir] [--catalog file] [--title text]");
    return;
  }
  const catalog = loadCatalog(args.catalog);
  const files = listJsonFiles(args.results);
  const report = buildReport(catalog, files, collectMeta(args.title));
  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(path.join(args.out, "capability-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(args.out, "capability-report.md"), toMarkdown(report));
  fs.writeFileSync(path.join(args.out, "index.html"), toHtml(report));
  const cs = report.capabilitySummary;
  console.log(`capability report: ${files.length} result file(s), ${report.totals.total} tests, ${report.capabilities.length} capabilities (${cs.covered || 0} covered, ${cs.failing || 0} failing, ${cs.gap || 0} gap, ${cs.skipped || 0} skipped-only, ${cs.partial || 0} partial), ${report.unmapped.length} unmapped tests -> ${args.out}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { loadCatalog, buildReport, classify, toMarkdown, toHtml, readPlaywrightJson };
