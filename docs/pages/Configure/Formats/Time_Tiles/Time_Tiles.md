---
layout: page
title: Time Tiles
permalink: /configure/formats/time-tiles
parent: Formats
grand_parent: Configure
---

# Time Tiles

If you're serving from `/Missions`, MMGIS offers a simple in-built method for querying time-based tilesets.

## Tileset Path Structure

A `{t}` parameter is added to the full tileset path. `.../layer/{t}/{z}/{x}/{y}.png` It is based on an ISO 9601 time but with `:` replaced with underscores and without the final `Z`.

Examples:

- /Missions/MSL/Layers/ExampleTimeTiles/2022-09-07T00_00_00/16/57776/31916.png
- /Missions/MSL/Layers/ExampleTimeTiles/2022-10-07T00_00_00/16/57776/31916.png
- /Missions/MSL/Layers/ExampleTimeTiles/2022-11-07T00_00_00/16/57776/31916.png

Additionally `{t}` may be appended with a name. The `time` is accessed by splitting on the new delimiter `Z-` and taking the first element.

Example:

- /Missions/MSL/Layers/ExampleTimeTiles/2022-09-07T00_00_00Z-LosAngeles/16/57776/31916.png
- /Missions/MSL/Layers/ExampleTimeTiles/2022-10-07T00_00_00Z-NewYork/16/57776/31916.png
- /Missions/MSL/Layers/ExampleTimeTiles/2022-11-07T00_00_00Z-London/16/57776/31916.png

## Configuration

For a tile layer, simply:

1. Include the proper `{t}` parameter in its URL (see above).
2. Set `Time Enabled` to `True`.

Note: The positioning of `{t}` does offer some flexibility. Be aware though that MMGIS will scan its full directory for other times to compare too. `../{z}/{x}/{y}/{t}.png` while valid, has not been tested and may be expensive. MMGIS caches active time tile directories for 30 minutes.
