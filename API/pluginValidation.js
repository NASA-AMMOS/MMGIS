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

const semver = require("semver");

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
 * The layer-type renderer contract (kept in sync with
 * src/essence/Basics/Layers_/interface/LayerInterface.js). A renderer module's
 * `export default {}` may only declare these operations, each optionally
 * broken into these phases. `make` is required and is the only op that may
 * declare the extra `afterCommit` phase (runs after the make-lock releases).
 *
 * `render` is globe-only: it adds an already-built engine layer config, for
 * core paths and tools that construct engine geometry directly rather than
 * from a layer's config object.
 */
const LAYER_OPS = [
  "make",
  "render",
  "destroy",
  "setOpacity",
  "setVisibility",
  "onToggle",
  "setStyle",
  "timeChange",
];
const OP_PHASES = ["before", "main", "after"];
const MAKE_EXTRA_PHASES = ["afterCommit"];

/**
 * A layer type may also ship the optional NON-renderer surfaces, each with its
 * own small vocabulary. They are validated per-surface: a `render` in a map
 * module or an `expand` in a globe module is an error, not a silent no-op.
 *   config  parse-time ownership of the layer's config object
 *   filter  the filtering strategy for the type
 *   time    what the type's time support means to the time bar
 */
const CONFIG_OPS = ["expand", "normalize", "resolveUrl"];
const FILTER_OPS = ["getAggregations", "filter"];
const TIME_OPS = ["format", "applyTimeParams"];

/**
 * A layer attachment is a single renderable that may straddle both engines (an
 * uncertainty ellipse is a map overlay AND two globe layers), so it declares
 * one `module` rather than one per surface, with its own vocabulary, in which
 * `make` — building itself from its host's data — is what an attachment
 * fundamentally is, and so is required.
 */
const ATTACHMENT_OPS = [
  "make",
  "decorateFeature",
  "globeStyle",
  "makeForFeature",
  "clearForFeature",
  "destroy",
  "setOpacity",
  "setVisibility",
  "onPeerToggle",
  "syncData",
  "setStyle",
  "peerFeaturesFor",
];

/** Operations valid on each surface, and whether `make` is required there. */
const SURFACES = {
  map: { ops: LAYER_OPS.filter((op) => op !== "render"), requiresMake: true },
  globe: { ops: LAYER_OPS, requiresMake: true },
  config: { ops: CONFIG_OPS, requiresMake: false },
  filter: { ops: FILTER_OPS, requiresMake: false },
  time: { ops: TIME_OPS, requiresMake: false },
  attachment: { ops: ATTACHMENT_OPS, requiresMake: true },
  // An attachment that only decorates its host (a bearing turns its host's
  // markers) adds nothing to the map of its own, so it has nothing to `make`.
  attachmentDecoration: { ops: ATTACHMENT_OPS, requiresMake: false },
};

/**
 * The surface a manifest module key belongs to, or null if it isn't one.
 *
 * @param {string} key
 * @param {string} [pluginType='layertype'] - 'layerattachment' keys all resolve
 *   to the single attachment surface.
 */
function surfaceOfModuleKey(key, pluginType = "layertype", manifest = null) {
  if (pluginType === "layerattachment")
    return manifest?.capabilities?.host?.decoratesHost === true
      ? "attachmentDecoration"
      : "attachment";
  // A single-module layer type (`module`) exports the surfaces as keys rather
  // than operations, so there is no one op vocabulary to check it against; its
  // surfaces are validated once resolved.
  if (key === "module") return null;
  if (key === "map") return "map";
  if (key.startsWith("globe.")) return "globe";
  if (SURFACES[key]) return key;
  return null;
}

/**
 * A layer type's / attachment's declared modules, flattened to one dotted key
 * per module so callers (generator, validator, CLI) share one shape:
 *
 *   { "modules": { "map": "./map",
 *                  "globe": { "cesium": "./globe/cesium" } } }
 *     → { "map": "./map", "globe.cesium": "./globe/cesium" }
 *   { "module": "./mytype" } → { "module": "./mytype" }
 *
 * Deliberately not the `paths` of tools/interactions: there a key is the
 * module's *export name* (`"DrawTool"`), here it is the *render surface* the
 * module plugs into, which is a different contract with a different vocabulary.
 *
 * @param {object} manifest
 * @returns {Object<string,string>} dotted surface key → declared path
 */
function flattenLayerModules(manifest) {
  const out = {};
  if (manifest == null || typeof manifest !== "object") return out;
  if (typeof manifest.module === "string") out.module = manifest.module;
  const modules = manifest.modules;
  if (modules == null || typeof modules !== "object" || Array.isArray(modules))
    return out;
  for (const key in modules) {
    const value = modules[key];
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      for (const sub in value) out[`${key}.${sub}`] = value[sub];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * The classification capabilities core reads, per plugin type.
 *
 * These answer the questions core must ask while iterating or partitioning ALL
 * layers, where calling a per-layer operation would be backwards. Unlike an
 * operation — where a typo like `destory` is caught by the module validator —
 * a mistyped or mistyped-value capability would otherwise be silent: the layer
 * simply never gets ordered, picked, styled or counted, with no error anywhere.
 * So the vocabulary is declared here and checked: unknown keys warn (a newer
 * plugin may know capabilities this MMGIS does not), wrong types and values are
 * errors, and an omission core would read as "no" warns where that is likely a
 * mistake rather than a choice (see CONSEQUENTIAL_OMISSIONS).
 *
 * `values` lists the allowed values where the capability is an enum rather than
 * a boolean. `descriptive: true` marks a capability no core code reads today —
 * it documents the type for admins/plugin authors (like `supportedData`).
 *
 * Kept in sync with LayerTypeRegistry / LayerAttachmentRegistry, which are the
 * only readers.
 */
const CAPABILITY_SCHEMA = {
  layertype: {
    // Validated in detail separately (engines ↔ modules cross-check).
    renderers: { type: "object" },
    defaultInteractions: { type: "object" },
    structural: { type: "boolean" },
    map: {
      type: "group",
      keys: {
        stacking: { type: "enum", values: ["raster", "overlay", false] },
        redrawOnReorder: { type: "boolean" },
        tracksLoad: { type: "boolean" },
        refreshByRemake: { type: "boolean" },
        stacEndpoint: {
          type: "enum",
          values: ["tiles", "terrain", "preview"],
        },
        picking: { type: "boolean" },
        styling: { type: "boolean" },
      },
    },
    time: {
      // `true`/`false` is shorthand for "this type understands time at all";
      // the object form adds what that means to the time bar.
      type: "booleanOrGroup",
      keys: {
        enabled: { type: "boolean" },
        histogram: { type: "boolean" },
      },
    },
    filtering: { type: "boolean", descriptive: true },
    identify: { type: "boolean", descriptive: true },
  },
  layerattachment: {
    renderers: { type: "object" },
    // How an attachment sits on its host: where it is stored, where it comes in
    // the host's build (and so render) order, and whether it needs its siblings
    // built first. Core reads these while assembling a host's attachments.
    host: {
      type: "group",
      keys: {
        order: { type: "number" },
        sublayerKey: { type: "string" },
        buildsAfterSiblings: { type: "boolean" },
        decoratesHost: { type: "boolean" },
      },
    },
    globe: {
      type: "group",
      keys: { suppressesHost: { type: "boolean" } },
    },
  },
};

/**
 * Capabilities whose absence means something core acts on, where the default is
 * more likely an oversight than a decision — warned about (never an error,
 * since each is a legitimate choice for some type).
 */
const CONSEQUENTIAL_OMISSIONS = {
  layertype: [
    {
      path: "map.stacking",
      when: (c) => c.renderers?.map !== undefined && c.renderers.map !== false,
      why: "a type that renders on the map but doesn't declare how it stacks is left out of 2D draw ordering entirely (declare false if that is intended)",
    },
  ],
  layerattachment: [
    {
      path: "host.order",
      when: (c) => c.host?.decoratesHost !== true,
      why: "an attachment without a declared order is built (and so drawn) in whatever order plugins happen to be discovered in",
    },
  ],
};

/** Read a dotted path out of a capabilities object. */
function _capAt(capabilities, path) {
  return path
    .split(".")
    .reduce((o, k) => (o == null ? undefined : o[k]), capabilities);
}

/**
 * Validate the classification capabilities against CAPABILITY_SCHEMA.
 *
 * Errors are returned; unknown keys and consequential omissions are logged as
 * warnings, matching how unknown top-level manifest fields are handled.
 */
function validateLayerCapabilities(capabilities, pluginName, pluginType) {
  const errors = [];
  const schema = CAPABILITY_SCHEMA[pluginType];
  if (
    schema == null ||
    capabilities == null ||
    typeof capabilities !== "object" ||
    Array.isArray(capabilities)
  )
    return errors;

  const where = `Plugin '${pluginName}' (${pluginType})`;
  const warn = (message) =>
    logger("warn", `${where}: ${message}`, "PluginValidation");

  const checkLeaf = (spec, value, path) => {
    if (
      (spec.type === "boolean" ||
        spec.type === "number" ||
        spec.type === "string") &&
      typeof value !== spec.type
    )
      errors.push(`${where}: 'capabilities.${path}' must be a ${spec.type}`);
    if (spec.type === "enum" && !spec.values.includes(value))
      errors.push(
        `${where}: 'capabilities.${path}' must be one of ${spec.values
          .map((v) => JSON.stringify(v))
          .join(", ")}`
      );
  };

  for (const [key, value] of Object.entries(capabilities)) {
    const spec = schema[key];
    if (spec === undefined) {
      warn(
        `unknown capability 'capabilities.${key}' — core reads none of it, so it has no effect (typo?)`
      );
      continue;
    }
    if (spec.descriptive === true) {
      checkLeaf(spec, value, key);
      continue;
    }
    if (spec.type === "group" || spec.type === "booleanOrGroup") {
      if (spec.type === "booleanOrGroup" && typeof value === "boolean")
        continue;
      if (value == null || typeof value !== "object" || Array.isArray(value)) {
        errors.push(
          `${where}: 'capabilities.${key}' must be an object${
            spec.type === "booleanOrGroup" ? " or a boolean" : ""
          } (${Object.keys(spec.keys).join(", ")})`
        );
        continue;
      }
      for (const [subKey, subValue] of Object.entries(value)) {
        const subSpec = spec.keys[subKey];
        if (subSpec === undefined) {
          warn(
            `unknown capability 'capabilities.${key}.${subKey}' — core reads none of it, so it has no effect (typo?)`
          );
          continue;
        }
        checkLeaf(subSpec, subValue, `${key}.${subKey}`);
      }
      continue;
    }
    checkLeaf(spec, value, key);
  }

  for (const omission of CONSEQUENTIAL_OMISSIONS[pluginType] || []) {
    if (_capAt(capabilities, omission.path) !== undefined) continue;
    if (!omission.when(capabilities)) continue;
    warn(`'capabilities.${omission.path}' is not declared — ${omission.why}`);
  }

  return errors;
}

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
    "modules",
    "module",
    "typeId",
    "extends",
    "description",
    "descriptionFull",
    "capabilities",
    "fileTypes",
    "supportedData",
    "config",
    "defaultIcon",
    "color",
  ]),
  layerattachment: new Set([
    ...COMMON_FIELDS,
    "module",
    "attachmentId",
    "configPath",
    "description",
    "descriptionFull",
    "applicableLayerTypes",
    "capabilities",
    "config",
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
  // `version` is either the sentinel "core" — versioned with MMGIS itself, which
  // is what every plugin shipped in this repository is — or the plugin's own
  // semver. Anything else (a bare "2", a date) reads as a version but resolves
  // to nothing, so it is rejected rather than displayed as-is.
  if (config.version !== undefined) {
    if (typeof config.version !== "string") {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'version' must be a string`
      );
    } else if (
      config.version !== "core" &&
      semver.valid(config.version) == null
    ) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'version' must be "core" (versioned with MMGIS) or a semver string`
      );
    }
  }
  if (
    config.type !== undefined &&
    ![
      "tool",
      "component",
      "backend",
      "interaction",
      "layertype",
      "layerattachment",
    ].includes(config.type)
  ) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'type' must be one of: tool, component, backend, interaction, layertype, layerattachment`
    );
  }
  if (
    config.tier !== undefined &&
    ![
      "core",
      "community",
      "private",
      "official",
      "experimental",
      "deprecated",
    ].includes(config.tier)
  ) {
    errors.push(
      `Plugin '${pluginName}' (${pluginType}): 'tier' must be one of: core, community, private, official, experimental, deprecated`
    );
  }
  if (
    config.overridable !== undefined &&
    typeof config.overridable !== "boolean"
  ) {
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
    if (
      typeof config.engines !== "object" ||
      Array.isArray(config.engines) ||
      config.engines === null
    ) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'engines' must be an object (e.g. { "mmgis": ">=5.0.0" })`
      );
    }
  }
  if (config.peerDependencies !== undefined) {
    if (
      typeof config.peerDependencies !== "object" ||
      Array.isArray(config.peerDependencies) ||
      config.peerDependencies === null
    ) {
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
    if (
      typeof config.interactionId !== "string" ||
      config.interactionId.length === 0
    ) {
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
    if (
      config.phase !== undefined &&
      !["preamble", "postamble", "main"].includes(config.phase)
    ) {
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

  // For layer types, name, typeId, and `modules`/`module` are required. For
  // layer attachments, name, attachmentId, and `module` are required. Both
  // declare their renderer modules by render surface (`map`, `globe.<engine>`,
  // `config`, …) rather than by export name as tools/interactions' `paths`
  // does, plus an optional `capabilities` block.
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
    // An attachment's settings live in its host layer's config, and its id is
    // free to differ from the key it is configured under (`image_overlays` is
    // configured as `markerAttachments.image`), so the path is declared. Core
    // resolves it to decide whether a host wants the attachment at all.
    if (pluginType === "layerattachment") {
      if (
        typeof config.configPath !== "string" ||
        config.configPath.trim() === ""
      ) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): missing required 'configPath' field (e.g. 'variables.markerAttachments.image')`
        );
      } else if (!config.configPath.startsWith("variables.")) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'configPath' must point into a layer's 'variables' ('${config.configPath}')`
        );
      }
    } else if (config.configPath !== undefined) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'configPath' is only valid on a layerattachment`
      );
    }
    if (config.extends !== undefined) {
      if (pluginType !== "layertype") {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'extends' is only valid on a layertype`
        );
      } else if (
        typeof config.extends !== "string" ||
        config.extends.trim() === ""
      ) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'extends' must be a non-empty typeId string`
        );
      } else if (config.extends === config.typeId) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'extends' cannot reference itself ('${config.typeId}')`
        );
      }
    }
    if (config.paths !== undefined) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'paths' is the tools/interactions field (export name \u2192 module); declare renderer modules by surface instead (${
          pluginType === "layertype"
            ? `'modules': { "map": "./map", "globe": { "cesium": "./globe/cesium" } }`
            : `'module': "./x"`
        })`
      );
    }
    if (pluginType === "layerattachment" && config.modules !== undefined) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): an attachment is one renderable across both engines \u2014 declare a single 'module' string, not 'modules'`
      );
    }
    if (
      pluginType === "layertype" &&
      config.modules !== undefined &&
      (config.modules === null ||
        typeof config.modules !== "object" ||
        Array.isArray(config.modules))
    ) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'modules' must be an object keyed by render surface ('map', 'config', 'filter', 'time', 'globe': { '<engine>': … })`
      );
    }
    if (config.module !== undefined && typeof config.module !== "string") {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'module' must be a string path to the plugin's module`
      );
    }
    const declaredModules = flattenLayerModules(config);
    // A layer type may be non-rendering (e.g. 'header'): it owns config/UI
    // metadata but draws nothing, so it is allowed to declare no modules.
    // `extends: "<typeId>"` inherits every surface this type doesn't declare
    // from one parent, so an inheriting type may legitimately ship no modules
    // at all (a pure capability override).
    const declaresNoModules =
      config.modules === undefined && config.module === undefined;
    if (pluginType === "layertype" && declaresNoModules) {
      // no renderer modules required
    } else if (declaresNoModules) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): missing required 'module' path`
      );
    } else {
      if (Object.keys(declaredModules).length === 0) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): 'modules' must declare at least one surface`
        );
      }
      for (const key in declaredModules) {
        if (typeof declaredModules[key] !== "string") {
          errors.push(
            `Plugin '${pluginName}' (${pluginType}): module '${key}' must be a string path`
          );
        }
      }
    }
    if (config.capabilities === undefined) {
      // Every capability core reads then answers "no", which for `renderers`
      // means "draws on neither surface" — legal (a header) but rarely meant.
      logger(
        "warn",
        `Plugin '${pluginName}' (${pluginType}): declares no 'capabilities' — core will classify it as rendering on no surface, and out of ordering, picking and the time bar`,
        "PluginValidation"
      );
    }
    if (config.capabilities !== undefined) {
      errors.push(
        ...validateLayerCapabilities(
          config.capabilities,
          pluginName,
          pluginType
        )
      );
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
            `Plugin '${pluginName}' (${pluginType}): 'capabilities.renderers' must be an object (e.g. { "map": { "engines": ["leaflet"] }, "globe": { "engines": ["cesium"] } })`
          );
        } else {
          // Each surface ('map', 'globe') is a boolean (false = unsupported,
          // true = supported with the default engine) or an object declaring
          // the concrete engines it renders through, e.g.
          // { "engines": ["leaflet"] } / { "engines": ["cesium", "lithosphere"] }.
          ["map", "globe"].forEach((surface) => {
            const s = r[surface];
            if (s === undefined || s === false || s === true) return;
            if (
              typeof s !== "object" ||
              Array.isArray(s) ||
              s === null ||
              (s.engines !== undefined && !Array.isArray(s.engines))
            ) {
              errors.push(
                `Plugin '${pluginName}' (${pluginType}): 'capabilities.renderers.${surface}' must be a boolean or an object with an 'engines' array`
              );
            }
          });
        }
      }
      // Declarative default interactions: a map of event name -> array of
      // interaction IDs core merges when a layer of this type doesn't
      // configure its own. Descriptive/behavioral metadata, validated for shape.
      // Guard against a non-object `capabilities` (e.g. null): the shape error is
      // already recorded above, and this is a separate `if` at the same nesting
      // level, so it must re-check before dereferencing to avoid throwing.
      if (
        config.capabilities !== null &&
        typeof config.capabilities === "object" &&
        !Array.isArray(config.capabilities) &&
        config.capabilities.defaultInteractions !== undefined
      ) {
        const di = config.capabilities.defaultInteractions;
        if (typeof di !== "object" || Array.isArray(di) || di === null) {
          errors.push(
            `Plugin '${pluginName}' (${pluginType}): 'capabilities.defaultInteractions' must be an object mapping event name to an array of interaction IDs`
          );
        } else {
          for (const [ev, ids] of Object.entries(di)) {
            if (!Array.isArray(ids) || ids.some((v) => typeof v !== "string")) {
              errors.push(
                `Plugin '${pluginName}' (${pluginType}): 'capabilities.defaultInteractions.${ev}' must be an array of interaction ID strings`
              );
            }
          }
        }
      }
    }
    // Cross-check declared renderer engines against the declared modules so a
    // type can't claim to render on a surface/engine it ships no module for (or
    // ship a renderer module for a surface it doesn't declare). This is the
    // manifest-level half of the contract check; the plugin CLI does the
    // module-export-level half (required `make`, known ops/phases).
    // An attachment declares one module for both engines, so there is nothing
    // per-surface to cross-check.
    // An extending type may render entirely through its parent's modules, so
    // there is nothing of its own to cross-check.
    const renderers =
      pluginType === "layerattachment" || config.extends !== undefined
        ? null
        : config.capabilities && config.capabilities.renderers;
    if (
      renderers &&
      typeof renderers === "object" &&
      !Array.isArray(renderers) &&
      Object.keys(declaredModules).length > 0
    ) {
      const moduleKeys = new Set(Object.keys(declaredModules));
      // map surface → single 'map' key; globe surface → 'globe.<engine>'.
      if (renderers.map && !moduleKeys.has("map")) {
        errors.push(
          `Plugin '${pluginName}' (${pluginType}): declares a 'map' renderer but has no 'modules.map' module`
        );
      }
      const globe = renderers.globe;
      if (globe && typeof globe === "object" && Array.isArray(globe.engines)) {
        globe.engines.forEach((engine) => {
          if (!moduleKeys.has(`globe.${engine}`)) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): declares a 'globe' engine '${engine}' but has no 'modules.globe.${engine}' module`
            );
          }
        });
      }
      // Reverse: every renderer module must have a matching declared engine.
      moduleKeys.forEach((key) => {
        if (key === "map") {
          if (!renderers.map) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): has a 'modules.map' module but does not declare a 'map' renderer`
            );
          }
        } else if (key.startsWith("globe.")) {
          const engine = key.slice("globe.".length);
          const globeOk =
            renderers.globe === true ||
            (renderers.globe &&
              typeof renderers.globe === "object" &&
              (renderers.globe.engines === undefined ||
                renderers.globe.engines.includes(engine)));
          if (!globeOk) {
            errors.push(
              `Plugin '${pluginName}' (${pluginType}): has a 'modules.${key}' module but does not declare globe engine '${engine}'`
            );
          }
        }
      });
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
          if (
            typeof entry !== "object" ||
            entry === null ||
            Array.isArray(entry)
          ) {
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
          if (
            typeof entry.category !== "string" ||
            entry.category.length === 0
          ) {
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
    if (
      config.config !== undefined &&
      (typeof config.config !== "object" ||
        config.config === null ||
        Array.isArray(config.config))
    ) {
      errors.push(
        `Plugin '${pluginName}' (${pluginType}): 'config' must be an inline object describing the Configure-page form`
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

// --- Layer-type renderer module static analysis --------------------------
//
// The plugin CLI validates a renderer module's `export default {}` shape
// without executing it (the modules use webpack `@basics` aliases and ESM, so
// they can't be require()d in Node). These helpers are a small brace/string-
// aware scanner that extracts the top-level operation names and, for ops
// written in the nested `{ before, main, after }` form, their phase names.

function _skipWsAndComments(src, i) {
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
    } else if (ch === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < src.length && src[i] !== "\n") i++;
    } else if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else {
      break;
    }
  }
  return i;
}

function _skipString(src, i) {
  const quote = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === quote) {
      i++;
      break;
    }
    i++;
  }
  return i;
}

// Skip a regex literal whose opening '/' is at src[i]. Handles '\' escapes,
// '[...]' character classes (a '/' inside a class doesn't end the regex), and
// trailing flags.
function _skipRegex(src, i) {
  i++; // past opening '/'
  let inClass = false;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "\n") break; // unterminated — bail
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) {
      i++;
      break;
    }
    i++;
  }
  while (i < src.length && /[a-z]/i.test(src[i])) i++; // flags
  return i;
}

// A '/' starts a regex unless the previous significant token ends an
// expression (word char, closing ) ] }, or a string/regex).
function _regexAllowedAfter(ch) {
  if (ch === undefined) return true;
  return !/[A-Za-z0-9_$)\]}'"`/]/.test(ch);
}

// Skip a value expression until the next top-level ',' or '}' of the enclosing
// object, tracking nested (), [], {}, strings and regex literals.
function _skipValue(src, i) {
  let depth = 0;
  let last;
  while (i < src.length) {
    i = _skipWsAndComments(src, i);
    const ch = src[i];
    if (ch === undefined) break;
    if (depth === 0 && (ch === "," || ch === "}")) break;
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      i++;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      i++;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      i = _skipString(src, i);
    } else if (ch === "/" && _regexAllowedAfter(last)) {
      i = _skipRegex(src, i);
    } else {
      i++;
    }
    last = ch;
  }
  return i;
}

const _METHOD_MODIFIERS = new Set(["async", "get", "set", "static"]);

// Parse an object literal whose opening brace is at src[start]. Returns
// { keys: [{ name, valueKind: 'object'|'other', body }], endIndex }.
function _parseObjectLiteral(src, start) {
  const keys = [];
  let i = start + 1; // past '{'
  while (i < src.length) {
    i = _skipWsAndComments(src, i);
    if (src[i] === "}") {
      i++;
      break;
    }
    if (src[i] === ",") {
      i++;
      continue;
    }
    if (src[i] === "." && src[i + 1] === "." && src[i + 2] === ".") {
      i = _skipValue(src, i); // spread — skip
      continue;
    }
    // Consume leading generator '*' / async/get/set/static modifiers so that
    // e.g. `async main(...)` reads the key as `main`, not `async`.
    while (true) {
      i = _skipWsAndComments(src, i);
      if (src[i] === "*") {
        i++;
        continue;
      }
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const k = _skipWsAndComments(src, j);
      if (
        _METHOD_MODIFIERS.has(word) &&
        src[k] !== ":" &&
        src[k] !== "(" &&
        src[k] !== "," &&
        src[k] !== "}"
      ) {
        i = j;
        continue;
      }
      break;
    }
    // Read the key (identifier or quoted string).
    let name;
    if (src[i] === "'" || src[i] === '"' || src[i] === "`") {
      const end = _skipString(src, i);
      name = src.slice(i + 1, end - 1);
      i = end;
    } else {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      name = src.slice(i, j);
      i = j;
    }
    if (!name) {
      i++;
      continue;
    }
    i = _skipWsAndComments(src, i);
    let valueKind = "other";
    let body = null;
    if (src[i] === "(") {
      valueKind = "function"; // method shorthand
      i = _skipValue(src, i);
    } else if (src[i] === ":") {
      i++;
      i = _skipWsAndComments(src, i);
      if (src[i] === "{") {
        valueKind = "object";
        const parsed = _parseObjectLiteral(src, i);
        body = parsed.keys;
        i = parsed.endIndex;
      } else {
        i = _skipValue(src, i);
      }
    } else {
      i = _skipValue(src, i); // shorthand property { make }
    }
    keys.push({ name, valueKind, body });
  }
  return { keys, endIndex: i };
}

/**
 * Validate a layer-type / layer-attachment renderer module's `export default`
 * object against the operation contract. Static (does not execute the module).
 *
 * @param {string} source - The module file's text.
 * @param {string} label  - A human label for messages (e.g. 'tile (map)').
 * @param {string} [surface='map'] - Which surface this module implements; the
 *   valid operations and whether `make` is required depend on it.
 * @returns {string[]} error strings (empty == valid)
 */
function validateLayerTypeModuleShape(source, label, surface = "map") {
  const errors = [];
  const { ops: validOps, requiresMake } = SURFACES[surface] || SURFACES.map;
  const marker = /export\s+default\s*\{/.exec(source);
  if (!marker) {
    errors.push(`${label}: no 'export default { … }' renderer object found`);
    return errors;
  }
  const braceIndex = marker.index + marker[0].length - 1;
  const { keys } = _parseObjectLiteral(source, braceIndex);
  const opNames = keys.map((k) => k.name);
  if (requiresMake && !opNames.includes("make")) {
    errors.push(`${label}: missing required 'make' operation`);
  }
  for (const op of keys) {
    if (!validOps.includes(op.name)) {
      errors.push(
        `${label}: unknown operation '${op.name}' (expected one of: ${validOps.join(", ")})`
      );
      continue;
    }
    if (op.valueKind === "object" && Array.isArray(op.body)) {
      const allowed =
        op.name === "make" ? [...OP_PHASES, ...MAKE_EXTRA_PHASES] : OP_PHASES;
      for (const phase of op.body) {
        if (!allowed.includes(phase.name)) {
          errors.push(
            `${label}: unknown phase '${phase.name}' in '${op.name}' (expected: ${allowed.join(", ")})`
          );
        }
      }
    }
  }
  return errors;
}

/**
 * Cross-plugin check for `extends`: the parent must exist, and inheritance is
 * one level only — a chain of layer types is a refactoring hazard for no
 * demonstrated need, and one level already solves the fork-the-parent problem
 * `extends` exists for.
 *
 * @param {Object} manifestsById - { [typeId]: manifest }
 * @returns {string[]} error strings (empty == valid)
 */
function validateLayerTypeInheritance(manifestsById) {
  const errors = [];
  for (const typeId in manifestsById) {
    const parentId = manifestsById[typeId].extends;
    if (parentId === undefined) continue;

    const parent = manifestsById[parentId];
    if (parent === undefined) {
      errors.push(
        `Layer type '${typeId}': extends '${parentId}', which no plugin provides`
      );
    } else if (parent.extends !== undefined) {
      errors.push(
        `Layer type '${typeId}': extends '${parentId}', which itself extends '${parent.extends}' — inheritance is one level only`
      );
    }
  }
  return errors;
}

module.exports = {
  validatePluginConfig,
  validateDependencies,
  findDuplicateInteractionIds,
  findDuplicateIds,
  validateLayerTypeModuleShape,
  surfaceOfModuleKey,
  flattenLayerModules,
  validateLayerTypeInheritance,
  validateLayerCapabilities,
  CAPABILITY_SCHEMA,
  LAYER_OPS,
  ATTACHMENT_OPS,
  CONFIG_OPS,
  FILTER_OPS,
  TIME_OPS,
  SURFACES,
  OP_PHASES,
  MAKE_EXTRA_PHASES,
  KNOWN_FIELDS,
};
