// Minimal MMGIS Tool implementation used as a test fixture.
//
// Tools must expose at least `make()` and `destroy()` and may optionally
// expose `initialize()`. The fixture intentionally has no DOM/runtime
// side-effects so it can be safely installed and removed during tests.

const TestPluginTool = {
    name: 'TestPlugin',
    initialized: false,
    made: false,
    initialize: function () {
        TestPluginTool.initialized = true;
    },
    make: function () {
        TestPluginTool.made = true;
    },
    destroy: function () {
        TestPluginTool.made = false;
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestPluginTool;
}
