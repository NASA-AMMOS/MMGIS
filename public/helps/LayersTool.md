## Tool: Layers

_Lists out and controls MMGIS' core data layers._

### Overview

A hierarchical list of available layers.

- Layers above (closer to the top) render on top of layers below them.
- Vector layers _always_ render on top of raster layers (regardless of position).
- Layers can be reordered by dragging their left-side color handles.
- Layers can be toggled by clicking the chceckboxes to the left of their names.
- Hovering over a layer exposes buttons to download the layer, change its settings and view more information.
- In addition to the various filters at the top of the tool, enter a "#" in the 'Search Layers' box to filter on layer tags (if any).

### Layer Types

- _Vector_
  - Points, line, polygons and various other markers drawn on top of the map and often interactable.
  - _color:_ Blue, _category:_ Vector
- _Vector Tile_
  - An alternative format that uses tiling to stream massive vector layers in. May have some reduced interactively and stylings.
  - _color:_ Light Blue, _category:_ Vector
- _Raster_
  - Core map imagery layers.
  - _color:_ Brown, _category:_ Raster
- _Query_
  - A vector layer whose source data is queried through an endpoint. These layers require you to submit a filter in their settings before viewing their data and are often very rich.
  - _color:_ Green, _category:_ Vector
- _Data_
  - A special raster data layer that that can be post-processed on the fly. For instance, you can dynamically color a tiled elevation data layer.
  - _color:_ Red, _category:_ Raster
- Model
  - These are 3D models that appear only in the Globe view.
  - _color:_ Yellow, _category:_ Other
