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
  "required",
  "engines",
  "dependencies",
  "peerDependencies",
  "pluginDependencies",
  "author",
  "license",
  "repository",
  "keywords",
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
    "providesInteractions",
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
  interaction: new Set([
    ...COMMON_FIELDS,
    "paths",
    "interactionId",
    "description",
    "applicableLayerTypes",
    "applicableEvents",
    "phase",
    "order",
    "suppresses",
    "kindAlias",
  ]),
  layertype: new Set([
    ...COMMON_FIELDS,
    "paths",
    "typeId",
    "description",
    "descriptionFull",
    "capabilities",
    "fileTypes",
    "supportedData",
    "metaconfig",
    "settings",
    "defaultIcon",
    "color",
  ]),
  layerattachment: new Set([
    ...COMMON_FIELDS,
    "paths",
    "attachmentId",
    "description",
    "descriptionFull",
    "applicableLayerTypes",
    "capabilities",
    "metaconfig",
    "settings",
    "defaultIcon",
    "color",
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
  if (config.type !== undefined && !["tool", "component", "backend", "interaction", "layertype", "layerattachment"].includes(config.type)) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'type' must be one of: tool, component, backend, interaction, layertype, layerattachment`
    );
  }
  if (config.tier !== undefined && !["core", "community", "private", "official", "experimental", "deprecated"].includes(config.tier)) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'tier' must be one of: core, community, private, official, experimental, deprecated`
    );
  }
  if (config.overridable !== undefined && typeof config.overridable !== "boolean") {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'overridable' must be a boolean`
    );
  }
  if (config.required !== undefined && typeof config.required !== "boolean") {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'required' must be a boolean`
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
  if (config.pluginDependencies !== undefined) {
    if (!Array.isArray(config.pluginDependencies)) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'pluginDependencies' must be an array of plugin IDs (e.g. ["core/backend/Draw"])`
      );
    } else {
      for (const dep of config.pluginDependencies) {
        if (typeof dep !== "string" || dep.length === 0) {
          errors.push(
            `Plugin '${pluginName}' (${pluginType}): each entry in 'pluginDependencies' must be a non-empty string (plugin ID)`
          );
        }
      }
    }
  }

  // For interactions, name, interactionId, and paths are required.
  if (pluginType === "interaction") {
    if (typeof config.name !== "string" || config.name.length === 0) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required 'name' field (must be a non-empty string)`
      );
    }
    if (typeof config.interactionId !== "string" || config.interactionId.length === 0) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required 'interactionId' field (must be a non-empty string)`
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
    if (config.phase !== undefined && !["preamble", "postamble", "main"].includes(config.phase)) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'phase' must be one of: preamble, postamble, main`
      );
    }
    if (config.order !== undefined && typeof config.order !== "number") {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'order' must be a number`
      );
    }
    if (config.suppresses !== undefined) {
      if (!Array.isArray(config.suppresses)) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'suppresses' must be an array of interaction IDs`
        );
      }
    }
    if (config.kindAlias !== undefined) {
      if (!Array.isArray(config.kindAlias)) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'kindAlias' must be an array of legacy kind strings`
        );
      }
    }
  }

  // For layer types, name, typeId, and paths are required. For layer
  // attachments, name, attachmentId, and paths are required. Both share the
  // same renderer-plugin shape (a `paths` object of static-import entries plus
  // an optional `capabilities` block).
  if (pluginType === "layertype" || pluginType === "layerattachment") {
    const idField = pluginType === "layertype" ? "typeId" : "attachmentId";

    if (typeof config.name !== "string" || config.name.length === 0) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required 'name' field (must be a non-empty string)`
      );
    }
    if (typeof config[idField] !== "string" || config[idField].length === 0) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required '${idField}' field (must be a non-empty string)`
      );
    }
    // A layer type may be non-rendering (e.g. 'header'): it owns config/UI
    // metadata but draws nothing, so it is allowed to omit renderer paths.
    // Everything else (layer attachments, and any layertype that declares a
    // `paths` object) must supply at least one string-valued renderer path.
    const nonRenderingLayerType =
      pluginType === "layertype" && config.paths === undefined;
    if (nonRenderingLayerType) {
      // no renderer paths required
    } else if (
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
    if (config.capabilities !== undefined) {
      if (
        typeof config.capabilities !== "object" ||
        Array.isArray(config.capabilities) ||
        config.capabilities === null
      ) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'capabilities' must be an object when present`
        );
      } else if (config.capabilities.renderers !== undefined) {
        const r = config.capabilities.renderers;
        if (typeof r !== "object" || Array.isArray(r) || r === null) {
          errors.push(
            `Plugin '${pluginName}' (${pluginType}): 'capabilities.renderers' must be an object (e.g. { "map": true, "globe": { "engines": ["cesium"] } })`
          );
        } else if (r.globe !== undefined && r.globe !== false && r.globe !== true) {
          if (
            typeof r.globe !== "object" ||
            Array.isArray(r.globe) ||
            (r.globe.engines !== undefined && !Array.isArray(r.globe.engines))
          ) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): 'capabilities.renderers.globe' must be a boolean or an object with an 'engines' array`
            );
          }
        }
      }
    }
    if (config.fileTypes !== undefined && !Array.isArray(config.fileTypes)) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'fileTypes' must be an array of strings`
      );
    }
    // `supportedData` is a descriptive-only catalog of the data inputs a layer
    // type understands (formats, standards, URL schemes, procurement notes). It
    // drives no runtime behavior — it exists so admins/plugin devs have a single
    // place documenting "what data do I need to procure", and so a future
    // Configure reference page can group these entries (by type/category/standard).
    if (config.supportedData !== undefined) {
      if (!Array.isArray(config.supportedData)) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'supportedData' must be an array of data-input descriptor objects`
        );
      } else {
        config.supportedData.forEach((entry, i) => {
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): 'supportedData[${i}]' must be an object`
            );
            return;
          }
          if (typeof entry.label !== "string" || entry.label.length === 0) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): 'supportedData[${i}].label' is required (non-empty string)`
            );
          }
          if (typeof entry.category !== "string" || entry.category.length === 0) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): 'supportedData[${i}].category' is required (non-empty string, e.g. 'raster', 'vector', 'model')`
            );
          }
          const arrayFields = [
            "standards",
            "formats",
            "extensions",
            "urlSchemes",
            "requiresServices",
          ];
          for (const f of arrayFields) {
            if (entry[f] === undefined) continue;
            if (!Array.isArray(entry[f])) {
              errors.push(
                `Plugin '${pluginName}' (${pluginType}): 'supportedData[${i}].${f}' must be an array of strings when present`
              );
            } else if (entry[f].some((v) => typeof v !== "string")) {
              errors.push(
                `Plugin '${pluginName}' (${pluginType}): 'supportedData[${i}].${f}' must contain only strings`
              );
            }
          }
        });
      }
    }
    if (config.metaconfig !== undefined && typeof config.metaconfig !== "string") {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'metaconfig' must be a string path to a metaconfig JSON file`
      );
    }
    if (config.settings !== undefined && typeof config.settings !== "string") {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'settings' must be a string path to a settings JSON file`
      );
    }
    if (
      pluginType === "layerattachment" &&
      config.applicableLayerTypes !== undefined &&
      !Array.isArray(config.applicableLayerTypes)
    ) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'applicableLayerTypes' must be an array of layer type IDs`
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

function findDuplicateInteractionIds(interactions) {
  const ownersById = new Map();

  for (const interaction of interactions) {
    if (
      typeof interaction.interactionId !== "string" ||
      interaction.interactionId.length === 0
    ) {
      continue;
    }
    const owners = ownersById.get(interaction.interactionId) || [];
    owners.push(interaction.name);
    ownersById.set(interaction.interactionId, owners);
  }

  return Array.from(ownersById.entries())
    .filter(([, owners]) => owners.length > 1)
    .map(([interactionId, owners]) => ({ interactionId, owners }));
}

/**
 * Find duplicate IDs across a list of `{ name, id }` entries. Used to enforce
 * one owner per layer-type `typeId` (and per attachment `attachmentId`), since
 * `layerObj.type` resolves to exactly one renderer plugin at runtime.
 */
function findDuplicateIds(entries, idKey) {
  const ownersById = new Map();

  for (const entry of entries) {
    const id = entry[idKey];
    if (typeof id !== "string" || id.length === 0) continue;
    const owners = ownersById.get(id) || [];
    owners.push(entry.name);
    ownersById.set(id, owners);
  }

  return Array.from(ownersById.entries())
    .filter(([, owners]) => owners.length > 1)
    .map(([id, owners]) => ({ id, owners }));
}

module.exports = {
  validatePluginConfig,
  validateDependencies,
  findDuplicateInteractionIds,
  findDuplicateIds,
  KNOWN_FIELDS,
};
