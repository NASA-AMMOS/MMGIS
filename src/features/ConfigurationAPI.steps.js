import { defineFeature, loadFeature } from 'jest-cucumber';

/**
 * Shared configuration API helper for MMGIS BDD tests
 * This module provides common step definitions for setting up test missions
 * and configurations through the MMGIS API.
 */

// Mock API client for configuration management
const mockConfigAPI = {
  baseUrl: 'http://localhost:8888',
  authToken: null,
  missions: new Map(),

  // Authentication
  authenticate: jest.fn(async () => {
    mockConfigAPI.authToken = 'test-long-term-token-' + Date.now();
    return mockConfigAPI.authToken;
  }),

  // Mission management
  createMission: jest.fn(async (missionName, config = {}) => {
    const missionConfig = {
      mission: missionName,
      config: {
        msv: { mission: missionName, ...config.msv },
        projection: { custom: false, epsg: 'EPSG:4326', ...config.projection },
        look: { coordinates: true, scalebar: true, ...config.look },
        panels: { viewer: true, map: true, globe: true, ...config.panels },
        tools: config.tools || [],
        layers: config.layers || [],
        time: config.time || { enabled: false },
        ...config
      }
    };
    
    mockConfigAPI.missions.set(missionName, missionConfig);
    return missionConfig;
  }),

  getMission: jest.fn(async (missionName) => {
    return mockConfigAPI.missions.get(missionName);
  }),

  updateMission: jest.fn(async (missionName, config) => {
    const existing = mockConfigAPI.missions.get(missionName);
    if (existing) {
      const updated = { ...existing, config: { ...existing.config, ...config } };
      mockConfigAPI.missions.set(missionName, updated);
      return updated;
    }
    return null;
  }),

  // Layer management
  addLayer: jest.fn(async (missionName, layerConfig) => {
    const mission = mockConfigAPI.missions.get(missionName);
    if (mission) {
      const layerId = layerConfig.uuid || 'layer-' + Date.now();
      const layer = { ...layerConfig, uuid: layerId };
      mission.config.layers.push(layer);
      return layer;
    }
    return null;
  }),

  updateLayer: jest.fn(async (missionName, layerId, layerConfig) => {
    const mission = mockConfigAPI.missions.get(missionName);
    if (mission) {
      const layerIndex = mission.config.layers.findIndex(l => l.uuid === layerId);
      if (layerIndex !== -1) {
        mission.config.layers[layerIndex] = { ...mission.config.layers[layerIndex], ...layerConfig };
        return mission.config.layers[layerIndex];
      }
    }
    return null;
  }),

  removeLayer: jest.fn(async (missionName, layerId) => {
    const mission = mockConfigAPI.missions.get(missionName);
    if (mission) {
      const layerIndex = mission.config.layers.findIndex(l => l.uuid === layerId);
      if (layerIndex !== -1) {
        return mission.config.layers.splice(layerIndex, 1)[0];
      }
    }
    return null;
  }),

  // Validation
  validateConfig: jest.fn(async (config) => {
    // Basic validation logic
    const errors = [];
    
    if (!config.msv || !config.msv.mission) {
      errors.push('Mission name is required');
    }
    
    if (config.layers) {
      config.layers.forEach((layer, index) => {
        if (!layer.name || !layer.type) {
          errors.push(`Layer ${index}: name and type are required`);
        }
        
        if (layer.type === 'tile' && !layer.url) {
          errors.push(`Layer ${index}: URL is required for tile layers`);
        }
        
        if (layer.type === 'vector' && !layer.url && !layer.controlled) {
          errors.push(`Layer ${index}: URL is required for vector layers unless controlled`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }),

  // Utility methods
  reset: jest.fn(() => {
    mockConfigAPI.missions.clear();
    mockConfigAPI.authToken = null;
  })
};

// Common step definitions for configuration setup
export const defineConfigurationSteps = (test) => {
  // These will be defined in individual test files
};

// Service availability checks
export const mockServiceChecks = {
  titilerAvailable: jest.fn(async () => {
    // Mock TiTiler service check
    return {
      available: true,
      version: '0.15.0',
      endpoints: ['info', 'tiles', 'statistics']
    };
  }),

  stacAvailable: jest.fn(async () => {
    // Mock STAC service check
    return {
      available: true,
      version: '1.0.0',
      conformsTo: ['STAC API - Core', 'STAC API - Features']
    };
  }),

  pgstacAvailable: jest.fn(async () => {
    // Mock TiTiler-PgSTAC service check
    return {
      available: true,
      version: '0.8.0',
      collections: ['landsat-c2l1', 'sentinel-2-l2a']
    };
  })
};

// Open source dataset references for consistent testing
export const openSourceDatasets = {
  elevation: {
    srtm: 'https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif',
    description: 'SRTM Global 1 arc-second elevation data'
  },
  
  imagery: {
    openstreetmap: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    arcgisImagery: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    description: 'Open imagery base layers'
  },
  
  vector: {
    worldBoundaries: 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
    naturalEarth: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/',
    description: 'Open vector datasets for testing'
  },
  
  stac: {
    microsoftPlanetaryComputer: 'https://planetarycomputer.microsoft.com/api/stac/v1/',
    earthSearch: 'https://earth-search.aws.element84.com/v1/',
    landsatLook: 'https://landsatlook.usgs.gov/stac-server/',
    description: 'Public STAC catalogs for testing'
  },
  
  velocity: {
    noaaGFS: 'https://nomads.ncep.noaa.gov/dods/gfs_0p25/',
    description: 'NOAA GFS weather model data'
  }
};

// Export the mock API for use in test step definitions
export { mockConfigAPI };

// Helper function to create standardized test configurations
export const createTestConfiguration = (missionName, options = {}) => {
  return {
    msv: {
      mission: missionName,
      view: options.view || ["0", "0", "3"],
      radius: options.radius || { major: "6378137", minor: "6356752" }
    },
    projection: {
      custom: false,
      epsg: options.projection || "EPSG:4326",
      globeproj: "webmercator"
    },
    look: {
      coordinates: true,
      scalebar: true,
      topbar: true,
      toolbar: true,
      ...options.look
    },
    panels: {
      viewer: true,
      map: true,
      globe: true,
      ...options.panels
    },
    tools: options.tools || [
      { name: "Layers", icon: "layers", js: "LayersTool" },
      { name: "Info", icon: "information-variant", js: "InfoTool" }
    ],
    time: {
      enabled: options.timeEnabled || false,
      ...options.time
    },
    layers: options.layers || []
  };
};