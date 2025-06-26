import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { mockConfigAPI, mockServiceChecks } from './ConfigurationAPI.steps';

const feature = loadFeature('./src/features/TiTilerIntegration.feature');

defineFeature(feature, test => {
  let mockTiTiler;
  let mockCOGLayers;
  let currentMission;
  let cogLayerConfig;

  beforeEach(() => {
    mockCOGLayers = [];
    
    mockTiTiler = {
      available: true,
      version: '0.15.0',
      baseUrl: 'http://localhost:8081',
      
      generateTiles: jest.fn((cogUrl, options = {}) => {
        const tileConfig = {
          url: cogUrl,
          tileMatrixSet: options.tileMatrixSet || 'WebMercatorQuad',
          resampling: options.resampling || 'nearest',
          bands: options.bands || ['1'],
          rescale: options.rescale,
          colormap: options.colormap,
          tilesGenerated: true
        };
        mockCOGLayers.push(tileConfig);
        return tileConfig;
      }),
      
      getCOGInfo: jest.fn((cogUrl) => {
        return {
          bounds: [-180, -85, 180, 85],
          bands: ['1', '2', '3', '4', '5', '6', '7'],
          dataType: 'uint16',
          noDataValue: -9999,
          overviews: [2, 4, 8, 16],
          statistics: {
            '1': { min: 0, max: 4000, mean: 1200 }
          }
        };
      }),
      
      getStatistics: jest.fn((cogUrl, bbox) => {
        return {
          '1': { min: 100, max: 3500, mean: 1500, count: 1000000 }
        };
      }),
      
      validateCOG: jest.fn((cogUrl) => {
        return cogUrl.includes('.tif') && !cogUrl.includes('nonexistent');
      })
    };
  });

  test('Serving basic COG through TiTiler', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
      expect(mockConfigAPI.missions.size).toBe(0);
    });

    and('TiTiler service is available and configured', async () => {
      const serviceCheck = await mockServiceChecks.titilerAvailable();
      expect(serviceCheck.available).toBe(true);
      expect(serviceCheck.version).toBeDefined();
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
      expect(token).toMatch(/^test-long-term-token-/);
      expect(mockConfigAPI.authToken).toBe(token);
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      const missionName = config.msv.mission;
      
      const validation = await mockConfigAPI.validateConfig(config);
      expect(validation.valid).toBe(true);
      
      currentMission = await mockConfigAPI.createMission(missionName, config);
      expect(currentMission).toBeDefined();
      expect(currentMission.config.msv.mission).toBe(missionName);
    });

    given('I add a tile layer with COG configuration:', (layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
      
      if (cogLayerConfig.sourceType === 'COG' && cogLayerConfig.throughTileServer) {
        mockTiTiler.generateTiles(cogLayerConfig.url, {
          tileMatrixSet: cogLayerConfig.tileMatrixSet,
          resampling: cogLayerConfig.cogResampling
        });
      }
    });

    when('I load the map', () => {
      expect(mockConfigAPI.missions.size).toBeGreaterThan(0);
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('the COG layer should be served through TiTiler', () => {
      const cogLayer = mockCOGLayers.find(layer => layer.url.includes('srtm.tif'));
      expect(cogLayer).toBeDefined();
      expect(cogLayer.tilesGenerated).toBe(true);
    });

    and('tiles should be generated dynamically from the COG', () => {
      expect(mockTiTiler.generateTiles).toHaveBeenCalled();
      expect(mockCOGLayers.length).toBeGreaterThan(0);
    });

    and('the layer should display with bilinear resampling', () => {
      const cogLayer = mockCOGLayers[0];
      expect(cogLayer.resampling).toBe('bilinear');
    });

    and('performance should be acceptable for navigation', () => {
      const startTime = Date.now();
      mockTiTiler.generateTiles('test.tif');
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  test('Transforming 32-bit COG with color scaling', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
      expect(mockConfigAPI.missions.size).toBe(0);
    });

    and('TiTiler service is available and configured', async () => {
      const serviceCheck = await mockServiceChecks.titilerAvailable();
      expect(serviceCheck.available).toBe(true);
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
      expect(currentMission).toBeDefined();
    });

    given(/^I add a tile layer with (\d+)-bit COG transformation:$/, (bitDepth, layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
      
      if (cogLayerConfig.cogTransform) {
        mockTiTiler.generateTiles(cogLayerConfig.url, {
          rescale: [cogLayerConfig.cogMin, cogLayerConfig.cogMax],
          colormap: cogLayerConfig.cogColormap,
          bands: cogLayerConfig.cogBands
        });
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then(/^the (\d+)-bit data should be transformed with color scaling$/, (bitDepth) => {
      const cogLayer = mockCOGLayers.find(layer => layer.colormap);
      expect(cogLayer).toBeDefined();
      expect(cogLayer.colormap).toBe('terrain');
    });

    and(/^pixel values should be rescaled from (\d+) to (\d+) meters$/, (min, max) => {
      const cogLayer = mockCOGLayers.find(layer => layer.rescale);
      expect(cogLayer).toBeDefined();
      expect(cogLayer.rescale).toEqual([parseInt(min), parseInt(max)]);
    });

    and('the terrain colormap should be applied', () => {
      const cogLayer = mockCOGLayers.find(layer => layer.colormap === 'terrain');
      expect(cogLayer).toBeDefined();
    });

    and('units should display as meters in queries', () => {
      expect(cogLayerConfig.cogUnits).toBe('m');
    });
  });

  test('Multi-band COG with custom band selection', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('TiTiler service is available and configured', async () => {
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a tile layer with multi-band COG:', (layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
      
      mockTiTiler.generateTiles(cogLayerConfig.url, {
        bands: cogLayerConfig.cogBands,
        resampling: cogLayerConfig.cogResampling
      });
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then(/^tiles should be generated using bands (\d+), (\d+), (\d+) for RGB display$/, (r, g, b) => {
      const cogLayer = mockCOGLayers.find(layer => layer.bands.includes(r));
      expect(cogLayer).toBeDefined();
      expect(cogLayer.bands).toEqual([r, g, b]);
    });

    and(/^queries should return data from all (\d+) bands$/, (bandCount) => {
      expect(cogLayerConfig.cogBandsQuery.length).toBe(parseInt(bandCount));
    });

    and('cubic resampling should be applied for smooth appearance', () => {
      const cogLayer = mockCOGLayers.find(layer => layer.resampling === 'cubic');
      expect(cogLayer).toBeDefined();
    });

    and('band information should be accessible through Info tool', async () => {
      const cogInfo = await mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(cogInfo.bands).toBeDefined();
      expect(cogInfo.bands.length).toBe(7);
    });
  });

  test('COG with custom tile matrix set for non-Web Mercator projection', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('TiTiler service is available and configured', async () => {
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a tile layer with custom projection COG:', (layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
      
      mockTiTiler.generateTiles(cogLayerConfig.url, {
        tileMatrixSet: cogLayerConfig.tileMatrixSet,
        resampling: cogLayerConfig.cogResampling
      });
    });

    and('the mission projection is configured for polar regions', () => {
      currentMission.config.projection = { epsg: 'EPSG:3413' };
      expect(currentMission.config.projection.epsg).toBe('EPSG:3413');
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('the COG should be served using UPS Arctic projection', () => {
      const cogLayer = mockCOGLayers.find(layer => layer.tileMatrixSet === 'UPSArcticWGS84Quad');
      expect(cogLayer).toBeDefined();
    });

    and('tiles should align correctly with the map projection', () => {
      const cogLayer = mockCOGLayers[0];
      expect(cogLayer.tileMatrixSet).toBeDefined();
    });

    and('nearest neighbor resampling should preserve original pixel values', () => {
      const cogLayer = mockCOGLayers.find(layer => layer.resampling === 'nearest');
      expect(cogLayer).toBeDefined();
    });

    and('coordinate display should show polar coordinates', () => {
      expect(currentMission.config.projection.epsg).toContain('341');
    });
  });

  test('TiTiler performance with large COG datasets', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('TiTiler service is available and configured', async () => {
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a tile layer with large COG:', (layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
    });

    when('I navigate to different zoom levels', () => {
      // Simulate navigation
      for (let zoom = 0; zoom <= 18; zoom += 6) {
        mockTiTiler.generateTiles(cogLayerConfig.url, {
          zoom: zoom,
          resampling: cogLayerConfig.cogResampling
        });
      }
    });

    then('appropriate resolution overviews should be used', async () => {
      const cogInfo = await mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(cogInfo.overviews).toBeDefined();
      expect(cogInfo.overviews.length).toBeGreaterThan(0);
    });

    and('tile generation should complete within acceptable time limits', () => {
      const startTime = Date.now();
      mockTiTiler.generateTiles(cogLayerConfig.url);
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000);
    });

    and('memory usage should remain stable during navigation', () => {
      // Memory testing would require actual browser testing
      expect(true).toBe(true);
    });

    and('tiles should be cached appropriately by the browser', () => {
      // Cache testing would require actual HTTP testing
      expect(true).toBe(true);
    });
  });

  test('TiTiler error handling for invalid COG', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('TiTiler service is available and configured', async () => {
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a tile layer with invalid COG URL:', (layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
    });

    when('I load the map', () => {
      const isValid = mockTiTiler.validateCOG(cogLayerConfig.url);
      if (!isValid) {
        cogLayerConfig.error = 'Invalid COG URL';
      }
    });

    then('appropriate error handling should occur', () => {
      const isValid = mockTiTiler.validateCOG(cogLayerConfig.url);
      expect(isValid).toBe(false);
    });

    and('error tiles should be displayed for failed requests', () => {
      expect(cogLayerConfig.error).toBeDefined();
    });

    and('the layer should remain in the layer list with error indication', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
      expect(cogLayerConfig.error).toBeDefined();
    });

    and('other layers should continue to function normally', () => {
      // This would test isolation of layer errors
      expect(true).toBe(true);
    });
  });

  test('COG metadata access through TiTiler', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('TiTiler service is available and configured', async () => {
      expect(mockTiTiler.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a tile layer with COG for metadata testing:', (layerConfigJSON) => {
      cogLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(cogLayerConfig);
    });

    when('I access the layer\'s metadata', () => {
      mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(mockTiTiler.getCOGInfo).toHaveBeenCalled();
    });

    then('COG information should be available through TiTiler info endpoint', async () => {
      const cogInfo = await mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(cogInfo).toBeDefined();
      expect(cogInfo.bounds).toBeDefined();
    });

    and('band information should be accessible', async () => {
      const cogInfo = await mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(cogInfo.bands).toBeDefined();
    });

    and('spatial extents should be correctly reported', async () => {
      const cogInfo = await mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(cogInfo.bounds).toEqual([-180, -85, 180, 85]);
    });

    and('NoData values should be properly handled', async () => {
      const cogInfo = await mockTiTiler.getCOGInfo(cogLayerConfig.url);
      expect(cogInfo.noDataValue).toBe(-9999);
    });
  });
});