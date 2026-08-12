/**
 * Helpers for a plugin's own unit tests: read its manifest, and check that every
 * module path the manifest declares resolves to a file on disk.
 *
 * That check is the one a plugin author most needs — renaming a module file or
 * adding a `modules` key without re-running `activate` is the usual cause of a
 * plugin that validates but never appears.
 */

const fs = require('fs');
const path = require('path');

/** The manifest next to a plugin's `tests/` directory. */
function manifestOf(testDir) {
  return JSON.parse(
    fs.readFileSync(path.resolve(testDir, '..', 'plugin.json'), 'utf8')
  );
}

/**
 * Every module specifier a manifest declares, flattened.
 *
 * Covers all four shapes plugin families use: `module` (attachment),
 * `modules: { key: './x' }` with a nested engine map (layertype), and
 * `paths: { Name: './x' }` (tool, component, interaction).
 *
 * @returns {{ key: string, specifier: string }[]}
 */
function declaredModules(manifest) {
  const out = [];
  const push = (key, specifier) => {
    if (typeof specifier === 'string') out.push({ key, specifier });
    else if (specifier && typeof specifier === 'object')
      for (const [sub, nested] of Object.entries(specifier))
        push(`${key}.${sub}`, nested);
  };
  if (manifest.module) push('module', manifest.module);
  for (const [key, value] of Object.entries(manifest.modules || {}))
    push(`modules.${key}`, value);
  for (const [key, value] of Object.entries(manifest.paths || {}))
    push(`paths.${key}`, value);
  return out;
}

/**
 * The declared modules that don't resolve to a file (`.js` implied, as the
 * bundler does).
 *
 * @returns {{ key: string, specifier: string }[]} empty when all resolve
 */
function unresolvedModules(testDir, manifest) {
  const pluginDir = path.resolve(testDir, '..');
  return declaredModules(manifest).filter(({ specifier }) => {
    const base = path.resolve(pluginDir, specifier);
    return ![base, `${base}.js`, path.join(base, 'index.js')].some((p) =>
      fs.existsSync(p)
    );
  });
}

module.exports = { manifestOf, declaredModules, unresolvedModules };
