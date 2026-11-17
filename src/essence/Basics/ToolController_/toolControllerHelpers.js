// Pure helpers for ToolController_ — no browser/runtime deps so they can be
// unit tested in isolation.

// A tool is "separated" only when its plugin manifest (toolConfigs) declares
// separatedTool `true` or "custom". Returns that mode, or null. No fallback
// to mission-config values.
export function getSeparatedMode(toolConfigs, name) {
    const mode =
        toolConfigs && toolConfigs[name]
            ? toolConfigs[name].separatedTool
            : undefined
    return mode === true || mode === 'custom' ? mode : null
}

// The tool's module symbol name (its `js`, e.g. "IdentifierTool"), resolved
// from the tools list; falls back to `<name>Tool`.
export function resolveToolJs(tools, name) {
    const tool = (tools || []).find((t) => t.name === name)
    return tool && tool.js ? tool.js : name + 'Tool'
}
