# Configuration

## Development

1. Run MMGIS as you normally would from the `/` directory: `npm start`
2. On each change while developing the `configure` page, build it with `npm run build` from this `/configure` directory

Notes:

- The Preview Changes features iframes MMGIS and would have to be run in a development browser with security disabled to work.
- This `configure` page can be developed with hot-reloading but this would require disabling user/admin permissions and, because it is easy to forget to reenable those permissions, this building method is preferred.

## MetaConfig JSONs

The configure page's forms have configuration objects too. They live in two places:

- `/configure/src/metaconfigs/*.json`
- `/src/essence/Tools/{TOOL}/config.json` in a `config` object.

See the above for working examples.

`/configure/src/Maker.js` reads these meta-configurations.

The structure of these meta-configuration is as follows:

- `field`: The name of the field in the configuration to write to. Supports dot.notation.strings. Layer specific meta-configs are written into and relative to the current working layer. Tool specific meta-configs are written into and relative to the tool's configuration object. Tab specific meta-configs are written into the top-level of the configuration object (full configuration field paths are required). In the case of 'fields' specified inside an `objectarray` component, 'field' is relative to the component's field.
- `width`: A value of 12 fills the full width of the container. For example, if four fields are wanted side-by-side, their respective widths would be 3, 3, 3, and 3.
- The `rows[i].component[j]` structure is required. Rows whose components overflow the width of 12 wrap into the next row -- otherwise another specified 'row' forces a new row.

```json
{
  "rows": [
    {
      "name": "Row 1",
      "subname": "",
      "components": [
        {
          "field": "projection.epsg",
          "name": "EPSG Code",
          "description": "An EPSG (or similar) code representing the spatial reference system.",
          "type": "text",
          "width": 12
        }
      ]
    },
    {
      "name": "Projection",
      "description": "Tilesets in non-Web Mercator projections are supported. The Projections Tab enables the configuration of a new projection for the given mission. All tilesets should be in agreement with the projection. Small issues with the settings here can have huge impacts on how the tilesets are rendered in MMGIS.",
      "subname": "",
      "components": [
        {
          "field": "projection.custom",
          "name": "Enabled",
          "description": "Enable to use the projection defined below instead of the default Web-Mercator.",
          "type": "switch",
          "width": 3,
          "defaultChecked": false
        },

        {
          "field": "projection.epsg",
          "name": "EPSG Code",
          "description": "An EPSG (or similar) code representing the spatial reference system.",
          "type": "text",
          "width": 2
        },

        {
          "field": "projection.bounds.0",
          "name": "Bounds Min X",
          "description": "Minimum easting value of the projection's spatial extent as stated by the base global tilemapresource.xml.",
          "type": "number",
          "width": 3
        },

        {
          "field": "coordinates.coordmain",
          "name": "Main Coordinate Type",
          "description": "",
          "type": "dropdown",
          "width": 2,
          "options": ["ll", "en", "cproj", "sproj", "rxy", "site"]
        },

        {
          "field": "look.primarycolor",
          "name": "Primary Color",
          "description": "Colors various buttons, components, panels, feature hover text.",
          "type": "colorpicker",
          "width": 3
        },

        {
          "field": "description",
          "name": "Description",
          "description": "",
          "type": "markdown",
          "width": 12
        },

        {
          "type": "map",
          "width": 4,
          "height": "321px"
        },

        {
          "field": "variables.shader.ramps.6",
          "name": "Color Ramp 6",
          "description": "Like: #3900b3,#714dbf,#9e6b90,#cf9270,#ebb698,transparent",
          "type": "textarray",
          "width": 12
        },
        {
          "field": "variables.query.must",
          "name": "ElasticSearch DSL 'must' Array",
          "description": "",
          "type": "json",
          "width": 12
        },

        {
          "field": "style.opacity",
          "name": "Opacity",
          "description": "Stroke Opacity",
          "type": "slider",
          "min": 0,
          "max": 1,
          "step": 0.01,
          "width": 2
        },

        {
          "field": "coordinates.variables.rightClickMenuActions",
          "name": "Context Menu Actions",
          "description": "An array of objects. Specified 'fields' within are now relative to the objectarray's 'field'.",
          "type": "objectarray",
          "width": 12,
          "object": [
            {
              "field": "name",
              "name": "Name",
              "description": "The text for this menu entry when users right-click.",
              "type": "text",
              "width": 2
            },
            {
              "field": "goto",
              "name": "Goto",
              "description": "Whether to, upon clicking the action in the context menu, pan and zoom to fit the respective feature to the screen.",
              "type": "checkbox",
              "width": 2,
              "defaultChecked": false
            }
          ]
        }
      ]
    }
  ]
}
```
