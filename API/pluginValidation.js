/**
 * Plugin plugin.json validation.
 *
 * Used by `updateTools.js` (for tool & component plugins) and by
 * `scripts/resolve-plugin-deps.js` to validate that a parsed
 * plugin.json conforms to the MMGIS plugin schema before it is
 * accepted into the plugin registry.
 *
 * Returns an array of error strings (empty array == valid).
 * Unknown top-level fields are NOT considered errors — they are logged
 * as warnings via the `logger` so that newer plugins remain forward
 * compatible with older MMGIS versions.
 */

const logger = require("./logger");

/**
 * Common fields shared across all plugin types (Phase 2 manifest fields).
 */
const COMMON_FIELDS = [
  "uuid",
  "id",
  "name",
  "display_name",
  "aliases",
  "version",
  "type",
  "tier",
  "overridable",
  "engines",
  "dependencies",
  "peerDependencies",
];

/**
 * Known top-level fields for each plugin type. Anything else triggers a
 * warning (but not an error).
 */
const KNOWN_FIELDS = {
  tool: new Set([
    ...COMMON_FIELDS,
    "paths",
    "defaultIcon",
    "description",
    "descriptionFull",
    "hasVars",
    "toolbarPriority",
    "expandable",
    "separatedTool",
    "config",
    "kinds",
  ]),
  component: new Set([
    ...COMMON_FIELDS,
    "paths",
    "defaultIcon",
    "description",
    "descriptionFull",
    "hasVars",
    "config",
  ]),
  backend: new Set([
    ...COMMON_FIELDS,
    "description",
    "priority",
    "envs",
    "routes",
  ]),
};

/**
 * Validate the `dependencies` field of a plugin config.
 *
 * Schema:
 *   dependencies: {
 *     npm?: { [pkg: string]: string },
 *     python?: { pip?: string[], conda?: string[] }
 *   }
 */
function validateDependencies(dependencies, pluginName) {
  const errors = [];
  if (dependencies === undefined || dependencies === null) return errors;

  if (typeof dependencies !== "object" || Array.isArray(dependencies)) {
    errors.push(
      `Plugin '${pluginName}': 'dependencies' must be an object when present`
    );
    return errors;
  }

  if (dependencies.npm !== undefined) {
    if (
      typeof dependencies.npm !== "object" ||
      Array.isArray(dependencies.npm) ||
      dependencies.npm === null
    ) {
      errors.push(
        `Plugin '${pluginName}': 'dependencies.npm' must be an object mapping package name to version spec`
      );
    } else {
      for (const [pkg, version] of Object.entries(dependencies.npm)) {
        if (typeof pkg !== "string" || pkg.length === 0) {
          errors.push(
            `Plugin '${pluginName}': 'dependencies.npm' contains an empty package name`
          );
        }
        if (typeof version !== "string") {
          errors.push(
            `Plugin '${pluginName}': 'dependencies.npm.${pkg}' must be a string version specifier`
          );
        }
      }
    }
  }

  if (dependencies.python !== undefined) {
    if (
      typeof dependencies.python !== "object" ||
      Array.isArray(dependencies.python) ||
      dependencies.python === null
    ) {
      errors.push(
        `Plugin '${pluginName}': 'dependencies.python' must be an object with optional 'pip' and 'conda' arrays`
      );
    } else {
      for (const key of ["pip", "conda"]) {
        if (dependencies.python[key] === undefined) continue;
        if (!Array.isArray(dependencies.python[key])) {
          errors.push(
            `Plugin '${pluginName}': 'dependencies.python.${key}' must be an array of strings`
          );
          continue;
        }
        for (const entry of dependencies.python[key]) {
          if (typeof entry !== "string" || entry.length === 0) {
            errors.push(
              `Plugin '${pluginName}': 'dependencies.python.${key}' contains a non-string or empty entry`
            );
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a parsed config.json for a tool, component, or backend plugin.
 *
 * @param {object} config  Parsed config object.
 * @param {string} pluginName  Plugin name (used in error messages).
 * @param {"tool"|"component"|"backend"} pluginType  Plugin kind.
 * @returns {string[]}  Empty array if valid; otherwise list of error messages.
 *
 * Side effects: logs `warn`-level messages for unknown top-level fields.
 */
function validatePluginConfig(config, pluginName, pluginType) {
  const errors = [];

  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): plugin.json must be a JSON object`
    );
    return errors;
  }

  const knownFields = KNOWN_FIELDS[pluginType] || KNOWN_FIELDS.tool;

  // Validate common Phase 2 manifest fields (optional but typed).
  if (config.uuid !== undefined && typeof config.uuid !== "string") {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'uuid' must be a string`
    );
  }
  if (config.id !== undefined && typeof config.id !== "string") {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'id' must be a string`
    );
  }
  if (config.version !== undefined && typeof config.version !== "string") {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'version' must be a string`
    );
  }
  if (config.type !== undefined && !["tool", "component", "backend"].includes(config.type)) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'type' must be one of: tool, component, backend`
    );
  }
  if (config.tier !== undefined && !["core", "community", "private"].includes(config.tier)) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'tier' must be one of: core, community, private`
    );
  }
  if (config.overridable !== undefined && typeof config.overridable !== "boolean") {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'overridable' must be a boolean`
    );
  }
  if (config.aliases !== undefined && !Array.isArray(config.aliases)) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'aliases' must be an array of strings`
    );
  }
  if (config.engines !== undefined) {
    if (typeof config.engines !== "object" || Array.isArray(config.engines) || config.engines === null) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'engines' must be an object (e.g. { "mmgis": ">=5.0.0" })`
      );
    }
  }
  if (config.peerDependencies !== undefined) {
    if (typeof config.peerDependencies !== "object" || Array.isArray(config.peerDependencies) || config.peerDependencies === null) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'peerDependencies' must be an object mapping plugin-id to version range`
      );
    }
  }

  // For tools and components, both `name` and `paths` are required.
  if (pluginType === "tool" || pluginType === "component") {
    if (typeof config.name !== "string" || config.name.length === 0) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required 'name' field (must be a non-empty string)`
      );
    }

    if (
      config.paths === undefined ||
      config.paths === null ||
      typeof config.paths !== "object" ||
      Array.isArray(config.paths)
    ) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required 'paths' object`
      );
    } else {
      const pathKeys = Object.keys(config.paths);
      if (pathKeys.length === 0) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'paths' object must contain at least one entry`
        );
      }
      for (const key of pathKeys) {
        if (typeof config.paths[key] !== "string") {
          errors.push(
            `Plugin '${pluginName}' (${pluginType}): 'paths.${key}' must be a string`
          );
        }
      }
    }
  }

  // For backend plugins, name is recommended but not strictly required since
  // backends are keyed by their directory name when discovered. The schema is
  // primarily about validating the `dependencies` field if present.
  if (pluginType === "backend") {
    if (config.name !== undefined && typeof config.name !== "string") {
      errors.push(
        `Plugin '${pluginName}' (backend): 'name' must be a string when present`
      );
    }
  }

  // Validate dependencies block (if present).
  errors.push(...validateDependencies(config.dependencies, pluginName));

  // Warn (do not error) on unknown top-level fields.
  for (const key of Object.keys(config)) {
    if (!knownFields.has(key)) {
      logger(
        "warn",
        `Plugin '${pluginName}' (${pluginType}): unknown top-level field '${key}' in plugin.json — this field will be preserved but may not be recognized by MMGIS`,
        "PluginValidation"
      );
    }
  }

  return errors;
}

module.exports = {
  validatePluginConfig,
  validateDependencies,
  KNOWN_FIELDS,
};
