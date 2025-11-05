require("dotenv").config();
const path = require("path");
const fs = require("fs");
const {
  planWithProvider,
  listProviderTools,
  haveAzureEnv,
} = require("../API/Frozon-MMGIS-Plugin-Backend/Agent/provider");

function printDebug(label, r) {
  const dbg = r && r.debug ? r.debug : {};
  const req = dbg.request || {};
  const res = dbg.response || {};
  console.log(`\n[${label}]`);
  console.log(
    `- actions: ${Array.isArray(r.actions) ? r.actions.map((a) => a.tool).join(", ") : "n/a"}`,
  );
  console.log(
    `- request: dep=${req.deployment} ver=${req.apiVersion} tools=${req.toolCount} choice=${req.toolChoice}`,
  );
  if (dbg.reason) console.log(`- reason: ${dbg.reason}`);
  if (dbg.rationale) console.log(`- rationale: ${dbg.rationale}`);
  console.log(
    `- response: status=${res.status} choices=${res.choicesCount ?? "n/a"} toolCalls=${res.toolCallsCount ?? "n/a"}`,
  );
}

function toolOf(r, idx = 0) {
  return Array.isArray(r.actions) && r.actions[idx]
    ? r.actions[idx].tool
    : null;
}

function approx(n, target, tol = 1e-6) {
  return typeof n === "number" && Math.abs(n - target) <= tol;
}

async function runCase(prompt, expect) {
  const r = await planWithProvider(prompt);
  const t = toolOf(r, 0);
  let ok = true;
  if (expect.tool && t !== expect.tool) ok = false;
  if (ok && expect.checkArgs) ok = expect.checkArgs(r.actions[0]?.args || {});
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status}: "${prompt}" → ${t || "none"}`);
  if (!ok) {
    console.log("- expected:", expect.tool);
    console.log("- got:", r.actions);
  }
  printDebug("debug", r);
  return ok;
}

async function runAll() {
  // Snapshot: provider tool export matches registry
  const registryPath = path.join(
    __dirname,
    "..",
    "API",
    "Frozon-MMGIS-Plugin-Backend",
    "Agent",
    "tool-registry.json",
  );
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const providerTools = listProviderTools();
  const namesA = (registry.tools || []).map((t) => t.name).sort();
  const namesB = providerTools.map((t) => t.function.name).sort();
  const sameNames =
    namesA.length === namesB.length && namesA.every((n, i) => n === namesB[i]);
  const shapeOk = providerTools.every(
    (t) => t.type === "function" && t.function && t.function.parameters,
  );
  const snapOk = sameNames && shapeOk;
  console.log(`${snapOk ? "PASS" : "FAIL"}: provider tool export snapshot`);
  if (!snapOk) {
    console.log("- registry:", namesA);
    console.log("- provider:", namesB);
  }

  // Optional: live provider tests if Azure env is configured
  const env = haveAzureEnv();
  if (env.ok) {
    const cases = [
      { prompt: "List layers", expect: { tool: "list_layers" } },
      {
        prompt: "Turn on Sample_Points",
        expect: {
          tool: "toggle_layer",
          checkArgs: (a) => a.name && a.visible === true,
        },
      },
      {
        prompt: "Set Sample_Points opacity to 0.7",
        expect: {
          tool: "set_layer_opacity",
          checkArgs: (a) => a.name && typeof a.opacity === "number",
        },
      },
      {
        prompt: "Zoom to 0, 80 at zoom 6",
        expect: {
          tool: "zoom_to",
          checkArgs: (a) =>
            Array.isArray(a.center) &&
            a.center.length === 2 &&
            typeof a.zoom === "number",
        },
      },
    ];
    let pass = 0;
    for (const c of cases) {
      try {
        const ok = await runCase(c.prompt, c.expect);
        if (ok) pass++;
      } catch (e) {
        console.log("ERROR:", e && e.message);
      }
    }
    console.log(`\nLive Provider Summary: ${pass}/${cases.length} passed`);
  } else {
    console.log("SKIP: Azure env not configured; live provider cases skipped.");
  }
}

(async () => {
  const arg = process.argv.slice(2).join(" ");
  if (!arg || /^--all$/i.test(arg)) {
    await runAll();
  } else {
    const r = await planWithProvider(arg);
    console.log(JSON.stringify(r, null, 2));
  }
})();
