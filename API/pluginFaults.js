// Which uncaught errors MMGIS can keep running after. Plugins from outside core run in this
// process; a throw from a plugin's own timer or callback, or a network error nobody listened
// for, shouldn't stop MMGIS for everyone. Errors from MMGIS's own code (including core plugins)
// still end the process, since its state can't be trusted afterwards.
const path = require("path");

const STRAY_NET_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNABORTED",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

// Plugin family ("connection", "auth", "backend") -> the folders of its loaded plugins
const families = new Map();

// Replaces the folders of one plugin family (each loader calls this after loading)
function register(family, dirs) {
  families.set(family, (dirs || []).filter((d) => typeof d === "string" && d !== "").map((d) => path.resolve(d) + path.sep));
}

// The plugin an error was raised from, as { family, dir }, or null
function pluginOf(err) {
  const stack = String((err && err.stack) || "");
  if (!stack) return null;
  for (const [family, dirs] of families)
    for (const dir of dirs) if (stack.includes(dir)) return { family, dir: dir.slice(0, -1) };
  return null;
}

function isPluginFault(err) {
  if (!err) return false;
  if (STRAY_NET_CODES.has(err.code)) return true;
  return pluginOf(err) != null;
}

module.exports = { register, pluginOf, isPluginFault, STRAY_NET_CODES };
