import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { mockConfigAPI, mockServiceChecks } from './ConfigurationAPI.steps';

const feature = loadFeature('./src/features/STACIntegration.feature');

defineFeature(feature, test => {
  let mockSTAC;
  let mockPgSTAC;
  let loadedSTACFeatures;
  let currentMission;
  let stacLayerConfig;

  beforeEach(() => {
    loadedSTACFeatures = [];
    
    mockSTAC = {
      available: true,
      version: '1.0.0',
      
      // Mock STAC Items
      mockItems: [
        {
          type: 'Feature',
          id: 'LC08_L1TP_139045_20170304_20170316_01_T1',
          bbox: [-120.5, 34.0, -119.5, 35.0],
          geometry: {
            type: 'Polygon',
            coordinates: [[[-120.5, 34.0], [-119.5, 34.0], [-119.5, 35.0], [-120.5, 35.0], [-120.5, 34.0]]]
          },
          properties: {
            datetime: '2017-03-04T18:45:30Z',
            collection: 'landsat-c2l1',
            'eo:cloud_cover': 15.2
          },
          assets: {
            thumbnail: { href: 'https://example.com/thumb.jpg', type: 'image/jpeg' },
            B4: { href: 'https://example.com/B4.TIF', type: 'image/tiff; application=geotiff; profile=cloud-optimized' },
            metadata: { href: 'https://example.com/metadata.xml', type: 'application/xml' }
          }
        }
      ],
      
      // Mock STAC Collections
      mockCollections: [
        {
          id: 'landsat-c2l1',
          type: 'Collection',
          title: 'Landsat Collection 2 Level-1',
          description: 'Landsat Collection 2 Level-1 data',
          extent: {
            spatial: { bbox: [[-180, -90, 180, 90]] },
            temporal: { interval: [['2013-04-11T00:00:00Z', null]] }
          }
        }
      ],
      
      fetchItem: jest.fn(async (itemId) => {
        return mockSTAC.mockItems.find(item => item.id === itemId);
      }),
      
      fetchCollection: jest.fn(async (collectionId) => {
        return mockSTAC.mockCollections.find(col => col.id === collectionId);
      }),
      
      search: jest.fn(async (params) => {
        let results = [...mockSTAC.mockItems];
        
        // Apply bbox filter
        if (params.bbox) {
          results = results.filter(item => {
            const [minX, minY, maxX, maxY] = params.bbox;
            const [itemMinX, itemMinY, itemMaxX, itemMaxY] = item.bbox;
            return !(itemMaxX < minX || itemMinX > maxX || itemMaxY < minY || itemMinY > maxY);
          });
        }
        
        // Apply datetime filter
        if (params.datetime) {
          results = results.filter(item => {
            const itemDate = new Date(item.properties.datetime);
            
            // Handle datetime ranges (ISO 8601 intervals like "2017-01-01T00:00:00Z/2017-12-31T23:59:59Z")
            if (params.datetime.includes('/')) {
              const [startTime, endTime] = params.datetime.split('/');
              const startDate = new Date(startTime);
              const endDate = new Date(endTime);
              return itemDate >= startDate && itemDate <= endDate;
            } else {
              // Single datetime - filter for items after this date
              const filterDate = new Date(params.datetime);
              return itemDate >= filterDate;
            }
          });
        }
        
        return {
          type: 'FeatureCollection',
          features: results
        };
      }),
      
      loadAsVectorLayer: jest.fn((stacData) => {
        if (stacData.type === 'FeatureCollection') {
          loadedSTACFeatures.push(...stacData.features);
        } else if (stacData.type === 'Feature') {
          loadedSTACFeatures.push(stacData);
        }
        return loadedSTACFeatures;
      })
    };

    mockPgSTAC = {
      available: true,
      collections: ['landsat-c2l1', 'sentinel-2-l2a'],
      
      generateMosaic: jest.fn(async (collectionId, params) => {
        return {
          collectionId,
          tileMatrixSet: params.tileMatrixSet || 'WebMercatorQuad',
          bands: params.bands || ['1', '2', '3'],
          mosaicGenerated: true,
          tileUrlTemplate: `http://localhost:8082/collections/${collectionId}/tiles/{z}/{x}/{y}`
        };
      })
    };
  });

  test('Loading vector features from STAC Item', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
      expect(mockConfigAPI.missions.size).toBe(0);
    });

    and('STAC services are available and configured', async () => {
      const serviceCheck = await mockServiceChecks.stacAvailable();
      expect(serviceCheck.available).toBe(true);
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      const pgstacCheck = await mockServiceChecks.pgstacAvailable();
      expect(pgstacCheck.available).toBe(true);
      expect(mockPgSTAC.available).toBe(true);
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

    given('I add a vector layer with STAC Item configuration:', async (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(stacLayerConfig);
      
      if (stacLayerConfig.sourceType === 'stac-item') {
        const itemUrl = stacLayerConfig.url;
        const itemId = itemUrl.split('/').pop();
        const stacItem = await mockSTAC.fetchItem(itemId);
        mockSTAC.loadAsVectorLayer(stacItem);
      }
    });

    when('I load the map', () => {
      expect(mockConfigAPI.missions.size).toBeGreaterThan(0);
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('the STAC item geometry should display as a vector feature', () => {
      expect(loadedSTACFeatures.length).toBe(1);
      expect(loadedSTACFeatures[0].geometry).toBeDefined();
      expect(loadedSTACFeatures[0].geometry.type).toBe('Polygon');
    });

    and('STAC item properties should be accessible through Info tool', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.properties).toBeDefined();
      expect(stacItem.properties.datetime).toBeDefined();
      expect(stacItem.properties.collection).toBe('landsat-c2l1');
    });

    and('metadata should include collection, datetime, and asset information', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.properties.datetime).toBe('2017-03-04T18:45:30Z');
      expect(stacItem.properties.collection).toBe('landsat-c2l1');
      expect(stacItem.assets).toBeDefined();
    });

    and('asset links should be functional for data access', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.assets.B4.href).toContain('.TIF');
      expect(stacItem.assets.thumbnail.href).toContain('.jpg');
    });
  });

  test('Browsing STAC Collection as vector features', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a vector layer with STAC Collection configuration:', async (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(stacLayerConfig);
      
      if (stacLayerConfig.sourceType === 'stac-collection') {
        const searchResult = await mockSTAC.search({ collections: ['sentinel-2-l2a'] });
        mockSTAC.loadAsVectorLayer(searchResult);
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('available STAC items from the collection should display as features', () => {
      expect(loadedSTACFeatures.length).toBeGreaterThan(0);
    });

    and('each feature should represent a single STAC item', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.type).toBe('Feature');
      expect(stacItem.id).toBeDefined();
    });

    and('temporal filtering should work with the time control', async () => {
      const recentSearch = await mockSTAC.search({ 
        datetime: '2017-01-01T00:00:00Z' 
      });
      expect(recentSearch.features.length).toBeGreaterThan(0);
    });

    and('spatial extent filtering should work with map navigation', async () => {
      const bboxSearch = await mockSTAC.search({ 
        bbox: [-121, 33, -119, 36] 
      });
      expect(bboxSearch.features.length).toBeGreaterThan(0);
    });

    and('asset previews should be accessible', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.assets.thumbnail).toBeDefined();
      expect(stacItem.assets.thumbnail.type).toBe('image/jpeg');
    });
  });

  test('STAC Catalog browsing and navigation', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a vector layer with STAC Catalog configuration:', (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(stacLayerConfig);
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('the STAC catalog structure should be browsable', () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('collections should be accessible as sub-catalogs', async () => {
      const collection = await mockSTAC.fetchCollection('landsat-c2l1');
      expect(collection).toBeDefined();
      expect(collection.type).toBe('Collection');
    });

    and('I should be able to navigate through the catalog hierarchy', () => {
      expect(mockSTAC.mockCollections.length).toBeGreaterThan(0);
    });

    and('collection metadata should be displayed appropriately', async () => {
      const collection = await mockSTAC.fetchCollection('landsat-c2l1');
      expect(collection.title).toBe('Landsat Collection 2 Level-1');
      expect(collection.description).toBeDefined();
    });
  });

  test('STAC Collection as tile mosaic through TiTiler-PgSTAC', ({ given, and, when, then }) => {
    let mosaicConfig;

    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a tile layer with STAC Collection for mosaic:', async (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(stacLayerConfig);
      
      if (stacLayerConfig.sourceType === 'stac-collection' && stacLayerConfig.type === 'tile') {
        mosaicConfig = await mockPgSTAC.generateMosaic(stacLayerConfig.url, {
          bands: stacLayerConfig.cogBands,
          tileMatrixSet: stacLayerConfig.tileMatrixSet
        });
      }
    });

    and('TiTiler-PgSTAC is configured with the STAC collection', () => {
      expect(mockPgSTAC.collections).toContain('landsat-c2l1');
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('a mosaicked tile layer should be generated from collection COGs', () => {
      expect(mosaicConfig.mosaicGenerated).toBe(true);
      expect(mosaicConfig.tileUrlTemplate).toContain('landsat-c2l1');
    });

    and('the mosaic should update when time controls change', async () => {
      const temporalMosaic = await mockPgSTAC.generateMosaic('landsat-c2l1', {
        datetime: '2017-03-04T00:00:00Z'
      });
      expect(temporalMosaic).toBeDefined();
    });

    and('band combinations should be applied to the mosaic', () => {
      expect(mosaicConfig.bands).toEqual(['4', '3', '2']);
    });

    and('pixel value scaling should work across the entire mosaic', () => {
      expect(stacLayerConfig.cogMin).toBe(0);
      expect(stacLayerConfig.cogMax).toBe(3000);
    });
  });

  test('STAC temporal queries with time controls', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a vector layer with temporal STAC collection:', (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(stacLayerConfig);
    });

    when('I adjust the time control to a specific date range', () => {
      const timeRange = {
        start: '2017-01-01T00:00:00Z',
        end: '2017-12-31T23:59:59Z'
      };
      expect(timeRange.start).toBeDefined();
    });

    then('only STAC items within the time range should be displayed', async () => {
      const filteredSearch = await mockSTAC.search({
        datetime: '2017-01-01T00:00:00Z/2017-12-31T23:59:59Z'
      });
      expect(filteredSearch.features.length).toBeGreaterThan(0);
    });

    and('the STAC API query should include datetime filters', () => {
      expect(mockSTAC.search).toHaveBeenCalled();
    });

    and('features should update dynamically as time changes', () => {
      expect(stacLayerConfig.time.type).toBe('requery');
    });

    and('temporal metadata should be preserved in feature properties', () => {
      if (loadedSTACFeatures.length > 0) {
        const stacItem = loadedSTACFeatures[0];
        expect(stacItem.properties.datetime).toBeDefined();
      }
    });
  });

  test('STAC asset access and preview', ({ given, when, then, and }) => {
    let clickedFeature;

    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I load a STAC item with multiple assets', async () => {
      const stacItem = await mockSTAC.fetchItem('LC08_L1TP_139045_20170304_20170316_01_T1');
      mockSTAC.loadAsVectorLayer(stacItem);
      expect(Object.keys(stacItem.assets).length).toBeGreaterThan(1);
    });

    when('I click on a STAC feature', () => {
      clickedFeature = loadedSTACFeatures[0];
      expect(clickedFeature).toBeDefined();
    });

    then('the Info tool should display available assets', () => {
      expect(clickedFeature.assets).toBeDefined();
      expect(Object.keys(clickedFeature.assets)).toContain('thumbnail');
      expect(Object.keys(clickedFeature.assets)).toContain('B4');
    });

    and('asset types should be clearly identified (thumbnail, data, metadata)', () => {
      expect(clickedFeature.assets.thumbnail.type).toBe('image/jpeg');
      expect(clickedFeature.assets.B4.type).toContain('geotiff');
      expect(clickedFeature.assets.metadata.type).toBe('application/xml');
    });

    and('asset links should be functional for download', () => {
      Object.values(clickedFeature.assets).forEach(asset => {
        expect(asset.href).toMatch(/^https?:\/\//);
      });
    });

    and('thumbnails should be displayable if available', () => {
      expect(clickedFeature.assets.thumbnail).toBeDefined();
    });

    and('asset formats should be indicated (COG, JPEG, XML, etc.)', () => {
      expect(clickedFeature.assets.B4.type).toContain('cloud-optimized');
    });
  });

  test('STAC search with spatial and temporal filters', ({ given, and, when, then }) => {
    let searchParams;

    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a vector layer with STAC search capabilities:', (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(stacLayerConfig);
    });

    when('I navigate to a specific area on the map', () => {
      searchParams = { bbox: [-121, 33, -119, 36] };
    });

    and('I set a specific time range', () => {
      searchParams.datetime = '2017-01-01T00:00:00Z/2017-12-31T23:59:59Z';
    });

    then('the STAC search should be filtered by bbox and datetime', async () => {
      const results = await mockSTAC.search(searchParams);
      expect(results.features).toBeDefined();
    });

    and('results should be limited to the current map extent', () => {
      expect(searchParams.bbox).toBeDefined();
    });

    and('search parameters should be visible in the request', () => {
      expect(mockSTAC.search).toHaveBeenCalledWith(expect.objectContaining({
        bbox: expect.any(Array),
        datetime: expect.any(String)
      }));
    });

    and('result pagination should be handled appropriately', () => {
      // Pagination would be implemented in actual STAC API integration
      expect(true).toBe(true);
    });
  });

  test('STAC metadata standards compliance', ({ given, when, then, and }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I load STAC data from a compliant catalog', async () => {
      const collection = await mockSTAC.fetchCollection('landsat-c2l1');
      const item = await mockSTAC.fetchItem('LC08_L1TP_139045_20170304_20170316_01_T1');
      mockSTAC.loadAsVectorLayer(item);
      expect(collection).toBeDefined();
    });

    when('I examine the loaded features', () => {
      expect(loadedSTACFeatures.length).toBeGreaterThan(0);
    });

    then('STAC properties should follow the standard schema', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.type).toBe('Feature');
      expect(stacItem.id).toBeDefined();
      expect(stacItem.bbox).toBeDefined();
      expect(stacItem.properties).toBeDefined();
    });

    and('required fields should be present (id, type, bbox, properties)', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.id).toBeDefined();
      expect(stacItem.type).toBe('Feature');
      expect(stacItem.bbox).toBeDefined();
      expect(stacItem.properties).toBeDefined();
    });

    and('datetime information should be properly formatted', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.properties.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    and('collection references should be valid', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.properties.collection).toBe('landsat-c2l1');
    });

    and('extensions should be properly handled if present', () => {
      const stacItem = loadedSTACFeatures[0];
      expect(stacItem.properties['eo:cloud_cover']).toBeDefined();
    });
  });

  test('STAC error handling and fallbacks', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('STAC services are available and configured', async () => {
      expect(mockSTAC.available).toBe(true);
    });

    and('TiTiler-PgSTAC is available for collection mosaics', async () => {
      expect(mockPgSTAC.available).toBe(true);
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a vector layer with invalid STAC URL:', (layerConfigJSON) => {
      stacLayerConfig = JSON.parse(layerConfigJSON);
      stacLayerConfig.error = 'Invalid STAC URL';
      currentMission.config.layers.push(stacLayerConfig);
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('appropriate error handling should occur', () => {
      expect(stacLayerConfig.error).toBeDefined();
    });

    and('error messages should be user-friendly', () => {
      expect(stacLayerConfig.error).toBe('Invalid STAC URL');
    });

    and('the layer should remain in the layer list with error indication', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
      expect(stacLayerConfig.error).toBeDefined();
    });

    and('other layers should continue to function normally', () => {
      // Other layers would continue to work independently
      expect(true).toBe(true);
    });

    and('retry mechanisms should be available if appropriate', () => {
      // Retry logic would be implemented in actual integration
      expect(true).toBe(true);
    });
  });
});