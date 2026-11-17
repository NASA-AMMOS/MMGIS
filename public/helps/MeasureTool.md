## Tool: Measure

_Measure distances and elevation profiles between points on the map._

### Overview

The Measure Tool allows users to click points on the map to measure distances and view elevation profiles along the measured path. It supports both 2D map and 3D globe measurements.

### Interface

- **Undo** — Remove the last measured point.
- **Reset** — Clear all measured points and start over.
- **Dataset** — Select which Digital Elevation Model (DEM) to use for elevation profiles (when multiple DEMs are available).

#### Modes

- **Segment** — Measure individual line segments between clicked points.
- **Continuous** — Measure a continuous path with cumulative distance.
- **Continuous Color** — Continuous mode with color-coded elevation gradient.

#### Profile Chart

An interactive elevation profile chart is displayed below the measurement controls. Hover over the chart to see the corresponding point highlighted on the map.

#### Line of Sight

- **Observer Height** — Height in meters above the surface for the observer.
- **Target Height** — Height above the surface of the target point.

When enabled, the profile chart shows line-of-sight visibility between the observer and the path.

### Configuration

| Variable | Description |
|---|---|
| `defaultMode` | Initial measurement mode (`segment`, `continuous`, `continuous_color`) |
| `layerDems` | Map of layer names to DEM tile URLs for elevation queries |
