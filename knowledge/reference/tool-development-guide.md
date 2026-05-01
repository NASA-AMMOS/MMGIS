# Tool Development Guide

How to create new tools for MMGIS.

## Setup

1. Go to `src/essence/Tools`
2. Create a new directory: `src/essence/Tools/YourTool/`
3. Copy `New Tool Template.js` into the directory
4. Rename to `YourToolTool.js`
5. Add a `config.json` (see below)
6. Restart the server
7. Enable the tool via `/configure` → Tools tab

## config.json Template

```json
{
  "defaultIcon": "mdi-icon-name",
  "description": "Brief description",
  "descriptionFull": {
    "title": "Detailed description",
    "example": {
      "configVar": "example value"
    }
  },
  "hasVars": true,
  "name": "YourTool",
  "toolbarPriority": 3,
  "paths": {
    "YourToolTool": "essence/Tools/YourTool/YourToolTool"
  },
  "expandable": false
}
```

Icons: [Material Design Icons](https://pictogrammers.com/library/mdi/)

## Tool Structure

```javascript
import $ from "jquery";
import F_ from "../../Basics/Formulae_/Formulae_";
import L_ from "../../Basics/Layers_/Layers_";
import Map_ from "../../Basics/Map_/Map_";

const markup = [`<div id='yourTool'>`, `</div>`].join("\n");

const YourTool = {
  height: 0,
  width: 300,
  MMGISInterface: null,

  make: function () {
    this.MMGISInterface = new interfaceWithMMGIS();
  },

  destroy: function () {
    this.MMGISInterface.separateFromMMGIS();
  },

  getUrlString: function () {
    return "";
  },
};

function interfaceWithMMGIS() {
  this.separateFromMMGIS = function () {
    separateFromMMGIS();
  };

  let tools = $("#toolPanel");
  tools.css("background", "var(--color-k)");
  tools.empty();
  tools.html('<div style="height: 100%">' + markup + "</div>");

  function separateFromMMGIS() {
    // Event cleanup
  }
}

export default YourTool;
```

## Lifecycle

1. **`make()`** — Called when user clicks tool icon. Render UI into `#toolPanel`.
2. **`destroy()`** — Called when user switches to another tool. Clean up events and DOM.
3. **`getUrlString()`** — Return URL parameters to persist tool state in deep links.

## Rules

- Tools must be self-contained in their directory
- Must implement `make()` and `destroy()`
- Use `interfaceWithMMGIS()` for MMGIS integration and cleanup
- Tools should work independently of one another
- Only modify `#tools` div, viewer, map, and/or globe
- Use `width` or `height` to set tool panel dimensions
- Run `npm run build` after adding tools (or restart in dev mode)

## Plugin Tools

For private/mission-specific tools, use plugin directories:
- `src/essence/*Private-Tools*/` (e.g., `My-Private-Tools`)
- `src/essence/*Plugin-Tools*/` (e.g., `NASA-Plugin-Tools`)

Plugin directories are automatically gitignored and can override standard tools.

## Backend Extension

If your tool needs backend endpoints:
1. Create a backend in `API/Backend/YourBackend/`
2. Add `setup.js` with `onceInit`, `onceStarted`, `onceSynced` hooks
3. Mount routes in `onceInit()` via `s.app.use()`
4. See `docs/pages/Contributing/Development/Development.md` for the full backend template
