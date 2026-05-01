# Contributing

## Quick Start

1. Check [open issues](https://github.com/NASA-AMMOS/MMGIS/issues) or create your own
2. Fork the `development` branch
3. Make a feature branch
4. Make your changes
5. Include issue number as `#{issue_number}` in commits and PR title
6. Submit a PR

## Plugin System

MMGIS supports plugins without modifying core code. All plugin directories are automatically gitignored.

### Tool Plugins

Create directories in `/src/essence/` matching `*Private-Tools*` or `*Plugin-Tools*`:

```
/src/essence/My-Private-Tools/
  └── CustomTool/
      ├── config.json
      ├── CustomToolTool.js
      └── CustomToolTool.css
```

Run `npm run build` after adding tool plugins.

### Backend Plugins

Create directories in `/API/` matching `*Private-Backend*` or `*Plugin-Backend*`:

```
/API/My-Private-Backend/
  └── CustomBackend/
      ├── setup.js
      ├── models/
      └── routes/
```

Only `npm start` is required — backends are loaded dynamically.

### Component Plugins

Create directories in `/src/essence/` matching `*Private-Components*` or `*Plugin-Components*`:

```
/src/essence/MMGIS-Private-Components/
  └── ExampleComponent/
      ├── config.json
      └── ExampleComponent.js
```

Components have a single `init(vars)` method called after UI finalization. Run `npm run build` after changes.

## Development Guidelines

- All features should be mission-agnostic and reusable
- Tools must implement `make()` and `destroy()` lifecycle methods
- Tools should work independently of one another
- Tools should only modify `#tools` div, viewer, map, or globe
- Backends follow the `setup.js` pattern with `onceInit`, `onceStarted`, `onceSynced` hooks

## Spec-Kit Workflow

For significant features, use the documentation-first workflow:

```
/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement → /speckit.checklist
```

See [AI-DEVELOPMENT.md](AI-DEVELOPMENT.md) for the complete workflow guide.
