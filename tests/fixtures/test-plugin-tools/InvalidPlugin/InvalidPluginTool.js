// Placeholder tool implementation paired with the InvalidPlugin fixture.
// The plugin's config.json is intentionally invalid; this file exists
// only so that the directory layout mirrors real plugins.

const InvalidPluginTool = {
    make: function () {},
    destroy: function () {},
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InvalidPluginTool;
}
