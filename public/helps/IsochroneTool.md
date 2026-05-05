## Tool: Isochrone

_Terrain traversability analysis for rover path planning._

### Overview

The Isochrone Tool computes traversability maps based on terrain slope data, showing areas reachable within given time or energy constraints. Multiple isochrones can be displayed simultaneously for comparison.

### Interface

- **New** — Add a new isochrone analysis to the map.

#### Isochrone Options

- **Data** — Select the DEM (Digital Elevation Model) for slope computation.
- **Color Ramp** — Choose a color scheme for the traversability visualization.
- **Model** — Select the traversability model to use for computation.
- **Observer** — Set the starting point by clicking on the map.
- **Regenerate** — Recompute the isochrone with current parameters.

### Configuration

| Variable | Description |
|---|---|
| `models` | Available traversability models |
| `defaultDEM` | Default Digital Elevation Model for computation |
