# Coding Conventions

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files (modules) | PascalCase | `User.js`, `Map_.js` |
| Directories | camelCase | `essence/`, `Ancillary/` |
| Variables | camelCase | `userName`, `geodatasetId` |
| Constants | UPPER_SNAKE_CASE | `DB_HOST`, `API_URL` |
| CSS Classes | kebab-case | `.tool-panel`, `.map-container` |

## Code Style

- **Prettier**: VSCode Prettier extension defaults
- **Indentation**: 4 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Optional but consistent within file
- **Line length**: 80 characters preferred
- **Async**: Use async/await over callbacks and raw promises

## Singleton Naming Pattern

Core modules use a trailing underscore suffix to indicate global singletons:

| Singleton | Purpose |
|-----------|---------|
| `L_` (Layers_) | Global layer state controller |
| `Map_` | Map rendering engine |
| `Globe_` | 3D globe rendering |
| `F_` (Formulae_) | Utility functions |
| `ToolController_` | Tool lifecycle manager |
| `Viewer_` | Viewer panel controller |

## Git Workflow

### Branches

- `master` — Main production branch
- `development` — Active development branch
- `feature/NNN-feature-name` — Feature branches (from spec-kit)
- `hotfix/description` — Emergency fixes

### Commits

- Start with feature number if applicable: `[001] Add OAuth2 authentication`
- Use imperative mood: "Add feature" not "Added feature"

### PRs

- Reference spec in description: `Implements specs/001-auth/spec.md`
- Include checklist from spec-kit
- Link to related issues

## Tool Plugin Conventions

- Each tool is a self-contained module in `src/essence/Tools/ToolName/`
- Must implement `make()` and `destroy()` lifecycle methods
- Use `interfaceWithMMGIS()` for event handling and cleanup
- Register tool in configuration UI via `config.json`
- Tools should work independently of one another
- Tools should only modify `#tools` div, viewer, map, or globe

## Frontend Component Placement

- **Generic components** → `src/design-system/components/`
- **MMGIS-specific UI** → `src/essence/Basics/UserInterface_/`
- **Tool UI** → within each tool's directory

## Constitution Quality Standards

- **ESLint**: Must pass with no errors
- **Test Coverage**: 80% minimum
- **Security**: Input validation, no SQL injection, XSS prevention
- **Code Review**: All PRs require approval
- **Documentation-first**: Spec.md before implementation
