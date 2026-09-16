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
 *   __parent__       vector           layertype `extends` (from `--extends`)
 *
 * An acronym is one word: `FOVWedges` is `fovWedges` / `fov_wedges`, not
 * `fOVWedges` / `f_ovwedges`.
 */

const fs = require("fs");
const path = require("path");

const SCAFFOLDS_ROOT = path.join(__dirname, "..", "scaffolds");

/** A name's words: runs of capitals count as one (`FOVWedges` → FOV, Wedges). */
function wordsOf(name) {
  return (
    name.match(
      /[A-Z]+[0-9]*(?![a-z])(?![0-9]*[a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/g
    ) || [name]
  );
}

/** The substitutions for one plugin name, longest token first. */
function tokensFor(name) {
  const words = wordsOf(name);
  const snake = words.map((w) => w.toLowerCase()).join("_");
  const camel = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w))
    .join("");
  return {
    __SNAKE_NAME__: snake.toUpperCase(),
    __snake_name__: snake,
    __colon_name__: words.map((w) => w.toLowerCase()).join(":"),
    __flatname__: words.join("").toLowerCase(),
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
 * @param {Object} [opts]
 * @param {string} [opts.extendsType] A layer type to inherit from, which picks
 *   the `extends` variant of the scaffold: one module, no renderer.
 * @returns {Object<string, string>} relative path → contents
 */
function scaffold(type, name, opts = {}) {
  const variant =
    type === "layertype" && opts.extendsType ? "layertype-extends" : type;
  const root = path.join(SCAFFOLDS_ROOT, variant);
  if (!fs.existsSync(root))
    throw new Error(`No scaffold for plugin type '${variant}' in ${root}`);

  const tokens = { __parent__: opts.extendsType || "", ...tokensFor(name) };
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
