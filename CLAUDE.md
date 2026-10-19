# MMGIS - Claude Code Context

This file provides context to Claude Code about the MMGIS project.

**For complete project context, see AGENTS.md.**

## Testing requirements (read before writing code)

Every change must ship with **categorized tests** and a list of **impacted feature areas**:

- Find the impacted capability IDs in `tests/capabilities.yml` (match changed files against `paths`).
- Add/update low-level tests (`unit`/`api`) and, for user-visible behaviour, `flow` tests including corner cases.
- Tag tests with the capability or scenario ID, e.g. `{ tag: ['@UIF-LAYERS-FILTER-02'] }`.
- Fill in "Feature areas impacted" in the PR description.

Details: "Testing & Feature-Area Tracking" in AGENTS.md and `tests/README.md`.

@AGENTS.md
