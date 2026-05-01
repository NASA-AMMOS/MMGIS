# Data Formats and Styling

## Enhanced GeoJSON

MMGIS extends standard GeoJSON with additional properties for styling and behavior:

- Feature-level styling via `properties` (stroke color, fill, weight, opacity, radius)
- Arrow styling for directional lines
- Image overlays on features
- Popup and tooltip customization

See `docs/pages/Configure/Formats/Enhanced_GeoJSON/Enhanced_GeoJSON.md` for the full specification.

## Layer URLs

Layer URLs support special placeholders and sources:

| Format | Example |
|--------|---------|
| Relative path | `Layers/data.geojson` (relative to mission dir) |
| Absolute path | `/Missions/Test/data.geojson` |
| Geodataset | `geodatasets:my_dataset` |
| STAC Collection | `stac-collection:https://host/titilerpgstac/collections/NAME` |
| Time placeholders | `path/{starttime}/{endtime}/data.geojson` |
| Tile placeholders | `path/{z}/{x}/{y}.png` |

See `docs/pages/Configure/Formats/Layer_URLs/Layer_URLs.md` for details.

## Vector Styling

Vector features can be styled through:

1. **Layer-level defaults**: Set in Configure page (stroke color, fill color, weight, opacity)
2. **Property-driven styling**: Use `prop:property_name` to derive color from feature properties
3. **Feature-level overrides**: Set in GeoJSON feature properties
4. **Legend-based styling**: Define in `legend.csv` files

Color formats supported: named colors, hex (`#FFF`, `#A58101`), rgb (`rgb(255,89,45)`), hsl (`hsl(130,26%,34%)`).

See `docs/pages/Configure/Formats/Vector_Styling/Vector_Styling.md` for the complete guide.

## Time Tiles

Time-enabled tile layers that change based on temporal controls. Uses `{time}` placeholder in URLs.

Composited time tiles aggregate multiple time steps into a single view.

See `docs/pages/Configure/Formats/Time_Tiles/Time_Tiles.md` for details.

## Remote Virtual Layers

Layers that proxy through a remote server, allowing external services to provide dynamic layer data.

See `docs/pages/Configure/Formats/Remote_Virtual_Layer/Remote_Virtual_Layer.md` for details.

## Kinds Configuration

Kinds define special click/interaction behaviors for vector layers. They control what happens when a user clicks on a feature.

See `docs/pages/Configure/Kinds/Kinds.md` for the full list of available kinds.
