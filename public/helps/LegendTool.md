## Tool: Legend

_Display map legends for active layers._

### Overview

The Legend Tool shows a consolidated legend panel displaying symbology and color information for all currently visible layers. Legends update automatically when layer visibility changes.

### Interface

The legend panel displays entries for each active layer that has legend information configured. Layers with raster color ramps (COG transforms, velocity layers) automatically generate gradient legends.

Image-based legends are displayed inline when a layer's `legend` property points to an image URL.

### Configuration

| Variable | Description |
|---|---|
| `displayOnStart` | Whether to show the legend panel when the tool is first activated |
| `showHeadersInLegend` | Whether to show layer group headers in the legend |
