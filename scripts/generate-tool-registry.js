#!/usr/bin/env node
/*
 KISS deterministic generator for the Agent Tool Registry.
 - Single source of truth for tool contracts (schemas + execution descriptors)
 - Emits API/Backend/Agent/tool-registry.json
 - No I/O beyond writing the artifact; no dynamic environment dependencies
*/

const fs = require("fs");
const path = require("path");

function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value)
      .sort()
      .forEach((k) => {
        out[k] = deepSortKeys(value[k]);
      });
    return out;
  }
  return value;
}

function readToolsDirectory(dirPath) {
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
  const tools = [];
  for (const file of files) {
    const full = path.join(dirPath, file);
    try {
      const spec = JSON.parse(fs.readFileSync(full, "utf8"));
      tools.push(spec);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Skipping invalid tool spec:", file, e && e.message);
    }
  }
  return tools.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function buildRegistry() {
  const version = "1.0.0";
  const toolsDir = path.join(
    __dirname,
    "..",
    "API",
    "Backend",
    "Agent",
    "tools",
  );
  const tools = readToolsDirectory(toolsDir);

  return {
    kind: "mmgis-tool-registry",
    version,
    uiProfiles: {
      // Optional UI hints for the dispatcher; purely declarative
      // type -> behavior mapping (client-only concern)
      layers_line: { kind: "render_layers_line" },
      opacity: { kind: "set_opacity" },
      toggle: { kind: "toggle_visibility" },
      zoom_view: { kind: "zoom_view" },
      mmgis_overview: { kind: "render_text_with_citation" },
      layer_summary: { kind: "render_layer_summary" },
      web_search_suggest: { kind: "render_links_summary" },
    },
    generatedAt: new Date().toISOString(),
    tools,
  };
}

function main() {
  const artifactPath = path.join(
    __dirname,
    "..",
    "API",
    "Backend",
    "Agent",
    "tool-registry.json",
  );

  const registry = buildRegistry();
  const sorted = deepSortKeys(registry);
  const json = JSON.stringify(sorted, null, 2) + "\n";
  fs.writeFileSync(artifactPath, json, "utf8");
  // eslint-disable-next-line no-console
  console.log("Wrote", path.relative(process.cwd(), artifactPath));
}

if (require.main === module) main();

module.exports = { buildRegistry };
