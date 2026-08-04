/**
 * Scaffold templates for `create`.
 *
 * A scaffold is a real directory of real files under `plugin-cli/scaffolds/<type>/`
 * — valid JSON and JS as they sit — so they are readable, diffable, and checked by
 * the same validator every other plugin goes through. `create` copies the tree,
 * substituting the plugin's name into both file paths and contents.
 *
 * Tokens, for `create layertype MyGriddedThing`:
 *
 *   __Name__         MyGriddedThing   as typed; directory name, export names
 *   __name__         myGriddedThing   file names, css classes
 *   __flatname__     mygriddedthing   layertype `typeId`
 *   __snake_name__   my_gridded_thing layerattachment `attachmentId`
 *   __SNAKE_NAME__   MY_GRIDDED_THING environment variable names
 *   __colon_name__   my:gridded:thing interaction `interactionId`
 */

const fs = require("fs");
const path = require("path");

const SCAFFOLDS_ROOT = path.join(__dirname, "..", "scaffolds");

/** The substitutions for one plugin name, longest token first. */
function tokensFor(name) {
  const camel = name[0].toLowerCase() + name.slice(1);
  const snake = camel.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return {
    __SNAKE_NAME__: snake.toUpperCase(),
    __snake_name__: snake,
    __colon_name__: camel.replace(/([A-Z])/g, (m) => `:${m.toLowerCase()}`),
    __flatname__: camel.toLowerCase(),
    __name__: camel,
    __Name__: name,
  };
}

function substitute(text, tokens) {
  return Object.entries(tokens).reduce(
    (acc, [token, value]) => acc.split(token).join(value),
    text
  );
}

/** Every file in a directory tree, as paths relative to it. */
function walk(root, rel = "") {
  return fs
    .readdirSync(path.join(root, rel), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(root, path.join(rel, entry.name))
        : [path.join(rel, entry.name)]
    );
}

/** True if a scaffold exists for this plugin type. */
function has(type) {
  return fs.existsSync(path.join(SCAFFOLDS_ROOT, type));
}

/**
 * The files a new plugin of this type starts with.
 *
 * @param {string} type  Plugin type, singular (`tool`, `layerattachment`, …).
 * @param {string} name  The plugin name as the author typed it.
 * @returns {Object<string, string>} relative path → contents
 */
function scaffold(type, name) {
  const root = path.join(SCAFFOLDS_ROOT, type);
  if (!fs.existsSync(root))
    throw new Error(`No scaffold for plugin type '${type}' in ${root}`);

  const tokens = tokensFor(name);
  const files = {};
  for (const rel of walk(root)) {
    files[substitute(rel, tokens)] = substitute(
      fs.readFileSync(path.join(root, rel), "utf8"),
      tokens
    );
  }
  return files;
}

module.exports = { scaffold, has, tokensFor, SCAFFOLDS_ROOT };
