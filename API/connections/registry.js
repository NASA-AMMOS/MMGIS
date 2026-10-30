// Finds and checks the installed connection plugins
const path = require("path");
const logger = require("../logger");
const { discoverPlugins } = require("../pluginDiscovery");
const pluginFaults = require("../pluginFaults");
const { scrubbed, envSecrets } = require("./common");

const DEFAULT_PLUGINS_ROOT = path.join(__dirname, "..", "..", "plugins");

let registry = null;

function loadConnections(pluginsRoot = DEFAULT_PLUGINS_ROOT) {
  const found = new Map();
  const discovered = discoverPlugins(pluginsRoot, "connections", "plugin.json", {
    loggerCategory: "Connections",
  });
  for (const p of discovered) {
    const m = p.manifest || {};
    const ref = `${p.container}/connections/${p.name}`;
    const refuse = (why) =>
      logger("error", `Connection '${ref}' was not loaded: ${why}`, "Connections");
    const id = typeof m.connection === "string" ? m.connection.toLowerCase() : "";
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) {
      refuse('its plugin.json needs a "connection" id: lowercase letters, digits, "-" or "_", starting with a letter, at most 64 characters.');
      continue;
    }
    if (found.has(id)) {
      refuse(`connection '${id}' is already provided by ${found.get(id).ref}.`);
      continue;
    }
    const bad = [
      m.display_name !== undefined && typeof m.display_name !== "string" && "'display_name' must be a string",
      m.description !== undefined && typeof m.description !== "string" && "'description' must be a string",
      m.pkce !== undefined && typeof m.pkce !== "boolean" && "'pkce' must be true or false",
      m.guests !== undefined && typeof m.guests !== "boolean" && "'guests' must be true or false",
      m.env !== undefined && !(Array.isArray(m.env) && m.env.every((e) => typeof e === "string" && e !== "")) &&
        "'env' must be a list of environment variable names",
    ].filter(Boolean);
    if (bad.length) {
      refuse(bad.join("; ") + ".");
      continue;
    }
    let impl;
    try {
      const lifecyclePath = path.join(p.pluginPath, "plugin.js");
      delete require.cache[require.resolve(lifecyclePath)];
      impl = require(lifecyclePath) || {};
    } catch (err) {
      refuse(`its plugin.js threw ${err && err.message ? err.message : err}`);
      continue;
    }
    if (typeof impl.authorizeUrl !== "function" || typeof impl.exchange !== "function") {
      refuse("its plugin.js must export authorizeUrl() and exchange().");
      continue;
    }
    found.set(id, {
      id,
      ref,
      name: p.name,
      dir: p.pluginPath,
      label: (m.display_name || p.name).slice(0, 100),
      description: typeof m.description === "string" ? m.description.slice(0, 1000) : "",
      guests: m.guests === true,
      pkce: m.pkce !== false,
      env: Array.isArray(m.env) ? m.env.filter((e) => typeof e === "string") : [],
      manifest: m,
      impl,
    });
  }
  registry = found;
  pluginFaults.register("connection", Array.from(found.values()).filter((c) => !c.ref.startsWith("core/")).map((c) => c.dir));
  return Array.from(found.keys());
}

function connectionMap() {
  if (registry == null) loadConnections();
  return registry;
}
const allConnections = () => Array.from(connectionMap().values());
const getConnection = (id) =>
  typeof id === "string" ? connectionMap().get(id.toLowerCase()) || null : null;

function hook(c, name, env) {
  if (typeof c.impl[name] !== "function") return [];
  const clean = (s) => String(scrubbed(String(s), envSecrets(c, env || process.env)));
  try {
    const out = c.impl[name](env);
    if (out && typeof out.then === "function") {
      out.catch(() => {});
      return [`${name}(env) must return its list directly, not a Promise.`];
    }
    if (Array.isArray(out)) return out.map(clean);
    if (typeof out === "string" && out !== "") return [clean(out)];
    return [];
  } catch (err) {
    return [clean(`${name}(env) threw ${err && err.message ? err.message : err}`)];
  }
}

// What a site admin still has to do before users can connect
function setupStatus(c, env = process.env) {
  const missingEnv = c.env.filter((n) => env[n] == null || env[n] === "");
  const problems = hook(c, "validate", env);
  return { configured: missingEnv.length === 0 && problems.length === 0, missingEnv, problems };
}

function startupWarnings(env = process.env) {
  const out = [];
  allConnections().forEach((c) => {
    const s = setupStatus(c, env);
    // Unconfigured connections are only listed as "not set up"; real problems are logged
    if (s.missingEnv.length < c.env.length || c.env.length === 0)
      s.missingEnv.forEach((n) => out.push(`Connection '${c.id}': ${n} is not set, so users can't connect it.`));
    s.problems.forEach((p) => out.push(`Connection '${c.id}': ${p}`));
    hook(c, "warnings", env).forEach((w) => out.push(`Connection '${c.id}': ${w}`));
  });
  const base = env.CONNECTIONS_CALLBACK_BASE_URL;
  if (base && connectionMap().size) {
    let u = null;
    try {
      u = new URL(base);
    } catch (err) {}
    const root = (env.ROOT_PATH || "").replace(/\/+$/, "");
    if (!u || !/^https?:$/.test(u.protocol))
      out.push("CONNECTIONS_CALLBACK_BASE_URL must be a full http(s) URL, such as https://mmgis.example.com, or connection callbacks won't reach MMGIS.");
    else if (root && u.pathname.replace(/\/+$/, "") !== root)
      out.push(`CONNECTIONS_CALLBACK_BASE_URL should end with ROOT_PATH (${root}), or connection callbacks won't reach MMGIS.`);
  }
  return out;
}

module.exports = { loadConnections, connectionMap, allConnections, getConnection, setupStatus, startupWarnings };
