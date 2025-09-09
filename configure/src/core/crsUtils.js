// Utility functions for parsing and handling coordinate reference systems

/**
 * Parse a TileMatrixSet response from TiTiler and extract CRS information
 * for MMGIS projection configuration
 * @param {Object} tileMatrixSet - TileMatrixSet object from TiTiler API
 * @returns {Object|null} Projection configuration object or null if parsing fails
 */
export function parseTileMatrixSetCRS(tileMatrixSet) {
  try {
    const id = tileMatrixSet.id;
    const crs = tileMatrixSet.crs;
    
    // Default mappings for common tilematrixsets that may not have CRS information
    const defaultMappings = {
      'WebMercatorQuad': {
        epsg: 'EPSG:3857',
        proj: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
        bounds: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
        planetRadius: 6378137
      },
      'WGS1984Quad': {
        epsg: 'EPSG:4326',
        proj: '+proj=longlat +datum=WGS84 +no_defs',
        bounds: [-180, -90, 180, 90],
        planetRadius: 6378137
      },
      'WorldCRS84Quad': {
        epsg: 'EPSG:4326',
        proj: '+proj=longlat +datum=WGS84 +no_defs',
        bounds: [-180, -90, 180, 90],
        planetRadius: 6378137
      },
      'WorldMercatorWGS84Quad': {
        epsg: 'EPSG:3395',
        proj: '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
        bounds: [-20037508.34, -20048966.1, 20037508.34, 20048966.1],
        planetRadius: 6378137
      },
      'UPSArcticWGS84Quad': {
        epsg: 'EPSG:5041',
        proj: '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs',
        bounds: [-4194304, -4194304, 4194304, 4194304],
        planetRadius: 6378137
      },
      'UPSAntarcticWGS84Quad': {
        epsg: 'EPSG:5042',
        proj: '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs',
        bounds: [-4194304, -4194304, 4194304, 4194304],
        planetRadius: 6378137
      },
      'EarthSeaIceNorthPolarOgraphic': {
        epsg: 'EPSG:3413',
        proj: '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
        bounds: [-3314693.24, -3314693.24, 3314693.24, 3314693.24],
        planetRadius: 6378137
      }
    };
    
    // Check if we have a default mapping for this tilematrixset
    if (defaultMappings[id]) {
      const defaultConfig = defaultMappings[id];
      const firstMatrix = tileMatrixSet.tileMatrices[0];
      
      return {
        epsg: defaultConfig.epsg,
        proj: defaultConfig.proj,
        bounds: defaultConfig.bounds,
        origin: firstMatrix.pointOfOrigin || [defaultConfig.bounds[0], defaultConfig.bounds[3]],
        reszoomlevel: 0,
        resunitsperpixel: firstMatrix.cellSize,
        planetRadius: defaultConfig.planetRadius
      };
    }
    
    // If no CRS information, try to infer from the ID for planetary bodies
    if (!crs) {
      // Default to Earth values if no CRS
      const earthRadius = 6378137;
      const firstMatrix = tileMatrixSet.tileMatrices[0];
      
      // Basic inference based on common naming patterns
      if (id.toLowerCase().includes('geographic') || id.toLowerCase().includes('longlat')) {
        return {
          epsg: `CUSTOM:${id}`,
          proj: `+proj=longlat +a=${earthRadius} +b=${earthRadius} +units=deg +no_defs`,
          bounds: [-180, -90, 180, 90],
          origin: firstMatrix.pointOfOrigin || [-180, 90],
          reszoomlevel: 0,
          resunitsperpixel: firstMatrix.cellSize,
          planetRadius: earthRadius
        };
      } else if (id.toLowerCase().includes('mercator')) {
        return {
          epsg: `CUSTOM:${id}`,
          proj: `+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${earthRadius} +b=${earthRadius} +units=m +no_defs`,
          bounds: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
          origin: firstMatrix.pointOfOrigin || [-20037508.34, 20037508.34],
          reszoomlevel: 0,
          resunitsperpixel: firstMatrix.cellSize,
          planetRadius: earthRadius
        };
      }
      
      // Default fallback to geographic
      return {
        epsg: `CUSTOM:${id}`,
        proj: `+proj=longlat +a=${earthRadius} +b=${earthRadius} +units=deg +no_defs`,
        bounds: [-180, -90, 180, 90],
        origin: firstMatrix.pointOfOrigin || [-180, 90],
        reszoomlevel: 0,
        resunitsperpixel: firstMatrix.cellSize,
        planetRadius: earthRadius
      };
    }
    
    // Original CRS parsing logic for planetary tilematrixsets
    // Extract planetary radius from CRS definition
    const radiusMatch = crs.match(/ELLIPSOID\[.*?,(\d+(?:\.\d+)?)/);
    const planetRadius = radiusMatch ? parseFloat(radiusMatch[1]) : 6378137; // Default to Earth radius
    
    // Determine projection type and create proj4 string
    let proj4String = '';
    let epsgCode = '';
    
    if (crs.includes('GEOGCRS') || crs.includes('geodetic')) {
      // Geographic projection
      proj4String = `+proj=longlat +a=${planetRadius} +b=${planetRadius} +units=deg +no_defs`;
      epsgCode = `PLANETARY:${id}`;
    } else if (crs.includes('Mercator')) {
      // Mercator projection
      proj4String = `+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${planetRadius} +b=${planetRadius} +units=m +no_defs`;
      epsgCode = `PLANETARY:${id}`;
    } else if (crs.includes('Stereographic') && crs.includes('North')) {
      // North Polar Stereographic
      proj4String = `+proj=stere +lat_0=90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${planetRadius} +b=${planetRadius} +units=m +no_defs`;
      epsgCode = `PLANETARY:${id}`;
    } else if (crs.includes('Stereographic') && crs.includes('South')) {
      // South Polar Stereographic
      proj4String = `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${planetRadius} +b=${planetRadius} +units=m +no_defs`;
      epsgCode = `PLANETARY:${id}`;
    } else if (crs.includes('Equidistant Cylindrical')) {
      // Equidistant Cylindrical
      proj4String = `+proj=eqc +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +a=${planetRadius} +b=${planetRadius} +units=m +no_defs`;
      epsgCode = `PLANETARY:${id}`;
    } else {
      // Fallback for unknown CRS - try to infer from name
      if (id.toLowerCase().includes('geographic')) {
        proj4String = `+proj=longlat +a=${planetRadius} +b=${planetRadius} +units=deg +no_defs`;
        epsgCode = `PLANETARY:${id}`;
      } else {
        // Default to Mercator
        proj4String = `+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=${planetRadius} +b=${planetRadius} +units=m +no_defs`;
        epsgCode = `PLANETARY:${id}`;
      }
    }
    
    // Calculate bounds and resolution from tileMatrices
    const firstMatrix = tileMatrixSet.tileMatrices[0];
    const origin = firstMatrix.pointOfOrigin;
    const cellSize = firstMatrix.cellSize;
    
    // For geographic projections, bounds are typically global
    let bounds = [-180, -90, 180, 90];
    if (!crs.includes('GEOGCRS') && !crs.includes('geodetic') && !id.toLowerCase().includes('geographic')) {
      // For projected systems, calculate metric bounds
      const extent = cellSize * firstMatrix.matrixWidth * firstMatrix.tileWidth;
      bounds = [-extent/2, -extent/2, extent/2, extent/2];
    }
    
    return {
      epsg: epsgCode,
      proj: proj4String,
      bounds: bounds,
      origin: origin,
      reszoomlevel: 0,
      resunitsperpixel: cellSize,
      planetRadius: planetRadius
    };
  } catch (error) {
    console.error('Error parsing TileMatrixSet CRS:', error);
    return null;
  }
} 