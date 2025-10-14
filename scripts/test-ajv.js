require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

function loadRegistry() {
  const p = path.join(
    __dirname,
    "..",
    "API",
    "Backend",
    "Agent",
    "tool-registry.json",
  );
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function pass(name) {
  console.log(`PASS: ${name}`);
}
function fail(name, err) {
  console.log(`FAIL: ${name}`);
  if (err) console.log("-", err);
}

(async () => {
  const registry = loadRegistry();
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    useDefaults: true,
    coerceTypes: true,
  });
  const tools = (registry.tools || []).reduce(
    (m, t) => ((m[t.name] = t), m),
    {},
  );

  // list_layers
  try {
    const v = ajv.compile(tools.list_layers.parameters);
    const ok1 = v({});
    const ok2 = v({ x: 1 }) === false;
    if (ok1 && ok2) pass("Ajv list_layers valid/invalid");
    else fail("Ajv list_layers valid/invalid", v.errors);
  } catch (e) {
    fail("Ajv list_layers compile", e && e.message);
  }

  // toggle_layer
  try {
    const v = ajv.compile(tools.toggle_layer.parameters);
    const ok1 = v({ name: "A", visible: true });
    const ok2 = v({ name: "A" }) === false;
    const ok3 = v({ name: "A", visible: true, extra: 1 }) === false;
    if (ok1 && ok2 && ok3)
      pass("Ajv toggle_layer required/additionalProperties");
    else fail("Ajv toggle_layer", v.errors);
  } catch (e) {
    fail("Ajv toggle_layer compile", e && e.message);
  }

  // set_layer_opacity
  try {
    const v = ajv.compile(tools.set_layer_opacity.parameters);
    const ok1 = v({ name: "A", opacity: 0.5 });
    const ok2 = v({ name: "A", opacity: 2 }) === false;
    const ok3 = v({ name: "A", opacity: 0.5, x: 1 }) === false;
    if (ok1 && ok2 && ok3)
      pass("Ajv set_layer_opacity range/additionalProperties");
    else fail("Ajv set_layer_opacity", v.errors);
  } catch (e) {
    fail("Ajv set_layer_opacity compile", e && e.message);
  }

  // zoom_to (oneOf)
  try {
    const v = ajv.compile(tools.zoom_to.parameters);
    const ok1 = v({ center: [0, 80], zoom: 6 });
    const ok2 = v({ bbox: [0, 0, 1, 1] });
    const ok3 = v({ center: [0, 80] }) === false;
    const ok4 = v({ center: [0, 80, 1], zoom: 6 }) === false;
    if (ok1 && ok2 && ok3 && ok4) pass("Ajv zoom_to oneOf and bounds");
    else fail("Ajv zoom_to", v.errors);
  } catch (e) {
    fail("Ajv zoom_to compile", e && e.message);
  }
})();
