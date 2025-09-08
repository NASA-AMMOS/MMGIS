---
layout: page
title: Planetcantile Integration
permalink: /configure/projections/planetcantile
parent: Configure
nav_order: 10
---

# Planetcantile Integration

MMGIS now supports automatic projection setup using planetcantile TileMatrixSets for planetary mapping. This feature allows you to easily configure your map to work with Mars, Venus, Moon, and other celestial body coordinate systems.

## What is Planetcantile?

Planetcantile provides TileMatrixSets (TMS) for planetary bodies throughout the solar system, enabling tiled map visualization and analysis for the Moon, Mars, and many other celestial bodies using standard web mapping techniques.

## Supported Planetary Bodies

The integration includes TileMatrixSets for:

- **Planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **Dwarf Planets**: Ceres, Pluto  
- **Moons**: Earth's Moon and various moons of Mars, Jupiter, Saturn, Uranus, and Neptune
- **Asteroids**: Including Vesta, Eros, Ida, and others
- **Comets**: Including Halley, Wild2, Churyumov-Gerasimenko, and others

Each body has multiple projection types available:
- Geographic (lat/lon)
- Equidistant Cylindrical  
- World Mercator
- Web Mercator
- North/South Polar Stereographic

## How to Use Planetcantile Integration

### Prerequisites

1. Enable TiTiler and TiTiler-PgSTAC services in your `.env`:
   ```
   WITH_TITILER=true
   WITH_TITILER_PGSTAC=true
   ```

2. Ensure planetcantile is installed:
   ```bash
   python -m pip install planetcantile
   ```

### Setting Up a Planetary Projection

1. **Open the Configure Page**: Navigate to your mission's configure page
2. **Go to Coordinates Tab**: Click on the "Coordinates" tab  
3. **Select a TileMatrixSet**: In the "Planetary Projection Setup" section, choose a planetary tilematrixset from the dropdown (e.g., `MarsGeographicSphere`, `VenusWebMercatorSphere`)
4. **Load Settings**: Click the "Load from TileMatrixSet" button
5. **Enable Custom Projection**: The system will automatically:
   - Enable the custom projection
   - Populate the EPSG code, proj4 string, bounds, origin, and resolution
   - Set the correct planetary radius
6. **Save Configuration**: Save your mission configuration

### Using Planetary Tiles

Once the projection is configured, you can use planetary data:

#### COG Layers
1. Create a new Tile Layer
2. Set the URL to your planetary COG file
3. Check "Use TiTiler" 
4. Select the same TileMatrixSet used for the map projection
5. The tiles will be served in the correct planetary coordinate system

#### STAC Collections
1. Create a STAC Collection with planetary COGs
2. Create a Tile Layer with URL: `stac-collection:{collection_name}`
3. Select the planetary TileMatrixSet
4. The mosaicked tiles will render correctly in the planetary projection

## Example Workflow

Here's a complete example for setting up a Mars mission:

1. **Configure Map Projection**:
   - Select `MarsGeographicSphere` from the TileMatrixSet dropdown
   - Click "Load from TileMatrixSet"
   - Verify the settings are populated correctly

2. **Add Mars Base Layer**:
   - Create a Tile Layer
   - URL: `path/to/mars_basemap.tif` 
   - Enable "Use TiTiler"
   - TileMatrixSet: `MarsGeographicSphere`

3. **Add Science Data**:
   - Create additional layers using the same TileMatrixSet
   - All data will align correctly in Mars coordinate space

## Technical Details

### Automatic CRS Parsing

The system automatically parses the TileMatrixSet's CRS definition to extract:
- Planetary radius from the ellipsoid definition
- Projection type (Geographic, Mercator, Stereographic, etc.)
- Coordinate system parameters
- Proper bounds and resolution calculations

### Supported Projection Types

The CRS parser handles these common planetary projections:
- **Geographic**: Uses `+proj=longlat` with planetary radius
- **Mercator**: Uses `+proj=merc` with planetary radius  
- **Polar Stereographic**: Uses `+proj=stere` with appropriate latitude of origin
- **Equidistant Cylindrical**: Uses `+proj=eqc` with planetary radius

### Resolution Calculation

The system calculates zoom level resolutions based on:
- Base resolution from the TileMatrixSet
- Reference zoom level
- Standard doubling/halving pattern for web mapping

## Troubleshooting

### Common Issues

**TileMatrixSets not showing**: Ensure TiTiler service is running and accessible
**Projection not loading**: Check browser console for API errors
**Tiles not aligning**: Verify the same TileMatrixSet is used for both map projection and tile layers
**Performance issues**: Consider using "Coalesced" variants for better polar region handling

### Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Verify your TiTiler service is configured correctly
3. Ensure planetcantile is properly installed with the correct tilematrixsets

## Related Documentation

- [TileMatrixSets](/configure/layers/tile/#tile-matrix-sets)
- [Custom Projections](/configure/coordinates/)
- [TiTiler Integration](/setup/adjacent-servers/#titiler)
- [Planetcantile Project](https://github.com/AndrewAnnex/planetcantile) 