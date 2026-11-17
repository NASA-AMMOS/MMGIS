// Test fixture that overrides the standard Identifier tool by name.
// Used to exercise the override-warning path in updateTools().

const IdentifierTool = {
    name: 'Identifier',
    overridden: true,
    make: function () {},
    destroy: function () {},
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = IdentifierTool;
}
