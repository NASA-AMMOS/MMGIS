---
layout: page
title: Layer Statistics
permalink: /tools/layer-statistics
parent: Tools
---

# Layer Statistics

Use the MMGIS Copilot to summarize raster layers with descriptive statistics (mean, standard deviation, quartiles, min, max, and count). The Copilot searches layer names, double-checks the user's intent, and can optionally focus on a specific time window or geographic area.

## Copilot Workflow

- Ask the Copilot to "calculate the statistics for {layer name}". It resolves common typos and partial names.
- Confirm the named geographic region when prompted. The Copilot falls back to the layer's full extent if no region is supplied.
- Optionally provide ISO 8601 timestamps (e.g., `2024-11-04T12:00:00Z`) to restrict the analysis window. The Copilot submits `time_start` and `time_end` parameters to the `calculate_layer_mean` tool on your behalf.
- The Copilot runs the backend adapter (`Agent/tools/calculate_raster_stats.py`) and returns a JSON payload containing the statistics.

## Running the Script Manually

The backend exposes a standalone helper script if you prefer to work outside the chat interface:

```bash
cd API/Frozon-MMGIS-Plugin-Backend
python Agent/tools/calculate_raster_stats.py \
  Missions/frozon/Layers/Freeboard/<your_layer>.tif \
  --pretty \
  --bbox MIN_LON MIN_LAT MAX_LON MAX_LAT
```

- `raster` (optional): Path to the target GeoTIFF. Defaults to the SWOT freeboard layer bundled with the mission configuration.
- `--bbox` (optional): Geographic bounds in WGS84 if you only need a subsection of the raster.
- `--pretty`: Formats the JSON response for readability.

The script requires `numpy` and `rasterio`. Install them into the MMGIS virtual environment before running the command.

## Troubleshooting

- **Layer not found**: Ensure the layer exists in `Missions/frozon_v116_config.json`. The Copilot indexes every layer name and alias from that file when searching for matches.
- **Missing dependencies**: Install `numpy` and `rasterio` in the environment specified by `python-environment.yml` (`pip install -r python-requirements.txt` works inside the MMGIS environment).
- **Bounding box errors**: Provide longitude values first, followed by latitude values, with minimums preceding maximums (e.g., `--bbox -160 70 -150 75`).
