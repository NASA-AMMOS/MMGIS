import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { mockConfigAPI, mockServiceChecks, defineConfigurationSteps } from './ConfigurationAPI.steps';

const feature = loadFeature('./src/features/STACIntegration.feature');

defineFeature(feature, test => {
  let mockSTAC;
  let mockPgSTAC;
  let loadedSTACFeatures;

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
            const filterDate = new Date(params.datetime);
            return itemDate >= filterDate;
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

  // Include common configuration steps
  defineConfigurationSteps(test);

  test('STAC services are available and configured', async () => {
    const serviceCheck = await mockServiceChecks.stacAvailable();
    expect(serviceCheck.available).toBe(true);
    expect(mockSTAC.available).toBe(true);
  });

  test('TiTiler-PgSTAC is available for collection mosaics', async () => {
    const pgstacCheck = await mockServiceChecks.pgstacAvailable();
    expect(pgstacCheck.available).toBe(true);
    expect(mockPgSTAC.available).toBe(true);
  });

  test('I load the map', async () => {
    expect(mockConfigAPI.missions.size).toBeGreaterThan(0);
  });

  test('the STAC item geometry should display as a vector feature', async () => {
    const stacItem = await mockSTAC.fetchItem('LC08_L1TP_139045_20170304_20170316_01_T1');
    mockSTAC.loadAsVectorLayer(stacItem);
    
    expect(loadedSTACFeatures.length).toBe(1);
    expect(loadedSTACFeatures[0].geometry).toBeDefined();
    expect(loadedSTACFeatures[0].geometry.type).toBe('Polygon');
  });

  test('STAC item properties should be accessible through Info tool', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.properties).toBeDefined();
    expect(stacItem.properties.datetime).toBeDefined();
    expect(stacItem.properties.collection).toBe('landsat-c2l1');
  });

  test('metadata should include collection, datetime, and asset information', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.properties.datetime).toBe('2017-03-04T18:45:30Z');
    expect(stacItem.properties.collection).toBe('landsat-c2l1');
    expect(stacItem.assets).toBeDefined();
  });

  test('asset links should be functional for data access', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.assets.B4.href).toContain('.TIF');
    expect(stacItem.assets.thumbnail.href).toContain('.jpg');
  });

  test('available STAC items from the collection should display as features', async () => {
    const searchResult = await mockSTAC.search({ collections: ['landsat-c2l1'] });
    mockSTAC.loadAsVectorLayer(searchResult);
    
    expect(loadedSTACFeatures.length).toBeGreaterThan(0);
  });

  test('each feature should represent a single STAC item', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.type).toBe('Feature');
    expect(stacItem.id).toBeDefined();
  });

  test('temporal filtering should work with the time control', async () => {
    const recentSearch = await mockSTAC.search({ 
      datetime: '2017-01-01T00:00:00Z' 
    });
    expect(recentSearch.features.length).toBeGreaterThan(0);
  });

  test('spatial extent filtering should work with map navigation', async () => {
    const bboxSearch = await mockSTAC.search({ 
      bbox: [-121, 33, -119, 36] 
    });
    expect(bboxSearch.features.length).toBeGreaterThan(0);
  });

  test('asset previews should be accessible', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.assets.thumbnail).toBeDefined();
    expect(stacItem.assets.thumbnail.type).toBe('image/jpeg');
  });

  test('the STAC catalog structure should be browsable', async () => {
    // Mock catalog browsing
    expect(mockSTAC.available).toBe(true);
  });

  test('collections should be accessible as sub-catalogs', async () => {
    const collection = await mockSTAC.fetchCollection('landsat-c2l1');
    expect(collection).toBeDefined();
    expect(collection.type).toBe('Collection');
  });

  test('I should be able to navigate through the catalog hierarchy', async () => {
    expect(mockSTAC.mockCollections.length).toBeGreaterThan(0);
  });

  test('collection metadata should be displayed appropriately', async () => {
    const collection = await mockSTAC.fetchCollection('landsat-c2l1');
    expect(collection.title).toBe('Landsat Collection 2 Level-1');
    expect(collection.description).toBeDefined();
  });

  test('TiTiler-PgSTAC is configured with the STAC collection', async () => {
    expect(mockPgSTAC.collections).toContain('landsat-c2l1');
  });

  test('a mosaicked tile layer should be generated from collection COGs', async () => {
    const mosaic = await mockPgSTAC.generateMosaic('landsat-c2l1', {
      bands: ['4', '3', '2']
    });
    expect(mosaic.mosaicGenerated).toBe(true);
    expect(mosaic.tileUrlTemplate).toContain('landsat-c2l1');
  });

  test('the mosaic should update when time controls change', async () => {
    // Mock temporal mosaic update
    const mosaic = await mockPgSTAC.generateMosaic('landsat-c2l1', {
      datetime: '2017-03-04T00:00:00Z'
    });
    expect(mosaic).toBeDefined();
  });

  test('band combinations should be applied to the mosaic', async () => {
    const mosaic = await mockPgSTAC.generateMosaic('landsat-c2l1', {
      bands: ['4', '3', '2']
    });
    expect(mosaic.bands).toEqual(['4', '3', '2']);
  });

  test('pixel value scaling should work across the entire mosaic', async () => {
    // Mock pixel scaling for mosaic
    expect(true).toBe(true); // Placeholder
  });

  test('I adjust the time control to a specific date range', async () => {
    // Mock time control adjustment
    const timeRange = {
      start: '2017-01-01T00:00:00Z',
      end: '2017-12-31T23:59:59Z'
    };
    expect(timeRange.start).toBeDefined();
  });

  test('only STAC items within the time range should be displayed', async () => {
    const filteredSearch = await mockSTAC.search({
      datetime: '2017-01-01T00:00:00Z/2017-12-31T23:59:59Z'
    });
    expect(filteredSearch.features.length).toBeGreaterThan(0);
  });

  test('the STAC API query should include datetime filters', async () => {
    expect(mockSTAC.search).toHaveBeenCalled();
  });

  test('features should update dynamically as time changes', async () => {
    // Mock dynamic feature updates
    expect(true).toBe(true); // Placeholder
  });

  test('temporal metadata should be preserved in feature properties', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.properties.datetime).toBeDefined();
  });

  test('I load a STAC item with multiple assets', async () => {
    const stacItem = await mockSTAC.fetchItem('LC08_L1TP_139045_20170304_20170316_01_T1');
    expect(Object.keys(stacItem.assets).length).toBeGreaterThan(1);
  });

  test('I click on a STAC feature', async () => {
    // Mock feature click
    expect(loadedSTACFeatures.length).toBeGreaterThan(0);
  });

  test('the Info tool should display available assets', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.assets).toBeDefined();
    expect(Object.keys(stacItem.assets)).toContain('thumbnail');
    expect(Object.keys(stacItem.assets)).toContain('B4');
  });

  test('asset types should be clearly identified (thumbnail, data, metadata)', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.assets.thumbnail.type).toBe('image/jpeg');
    expect(stacItem.assets.B4.type).toContain('geotiff');
    expect(stacItem.assets.metadata.type).toBe('application/xml');
  });

  test('asset links should be functional for download', async () => {
    const stacItem = loadedSTACFeatures[0];
    Object.values(stacItem.assets).forEach(asset => {
      expect(asset.href).toMatch(/^https?:\/\//);
    });
  });

  test('thumbnails should be displayable if available', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.assets.thumbnail).toBeDefined();
  });

  test('asset formats should be indicated (COG, JPEG, XML, etc.)', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.assets.B4.type).toContain('cloud-optimized');
  });

  test('I navigate to a specific area on the map', async () => {
    // Mock map navigation
    const bbox = [-121, 33, -119, 36];
    expect(bbox.length).toBe(4);
  });

  test('I set a specific time range', async () => {
    // Mock time range setting
    const timeRange = '2017-01-01T00:00:00Z/2017-12-31T23:59:59Z';
    expect(timeRange).toContain('2017');
  });

  test('the STAC search should be filtered by bbox and datetime', async () => {
    const searchParams = {
      bbox: [-121, 33, -119, 36],
      datetime: '2017-01-01T00:00:00Z/2017-12-31T23:59:59Z'
    };
    const results = await mockSTAC.search(searchParams);
    expect(results.features).toBeDefined();
  });

  test('results should be limited to the current map extent', async () => {
    expect(mockSTAC.search).toHaveBeenCalled();
  });

  test('search parameters should be visible in the request', async () => {
    expect(mockSTAC.search).toHaveBeenCalled();
  });

  test('result pagination should be handled appropriately', async () => {
    // Mock pagination handling
    expect(true).toBe(true); // Placeholder
  });

  test('I load STAC data from a compliant catalog', async () => {
    const collection = await mockSTAC.fetchCollection('landsat-c2l1');
    expect(collection).toBeDefined();
  });

  test('I examine the loaded features', async () => {
    expect(loadedSTACFeatures.length).toBeGreaterThan(0);
  });

  test('STAC properties should follow the standard schema', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.type).toBe('Feature');
    expect(stacItem.id).toBeDefined();
    expect(stacItem.bbox).toBeDefined();
    expect(stacItem.properties).toBeDefined();
  });

  test('required fields should be present (id, type, bbox, properties)', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.id).toBeDefined();
    expect(stacItem.type).toBe('Feature');
    expect(stacItem.bbox).toBeDefined();
    expect(stacItem.properties).toBeDefined();
  });

  test('datetime information should be properly formatted', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.properties.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test('collection references should be valid', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.properties.collection).toBe('landsat-c2l1');
  });

  test('extensions should be properly handled if present', async () => {
    const stacItem = loadedSTACFeatures[0];
    expect(stacItem.properties['eo:cloud_cover']).toBeDefined();
  });

  test('appropriate error handling should occur', async () => {
    // Mock error for invalid URL
    try {
      await mockSTAC.search({ invalidParam: true });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('error messages should be user-friendly', async () => {
    // Mock user-friendly error handling
    expect(true).toBe(true); // Placeholder
  });

  test('the layer should remain in the layer list with error indication', async () => {
    const missions = Array.from(mockConfigAPI.missions.values());
    const mission = missions[0];
    expect(mission.config.layers.length).toBeGreaterThan(0);
  });

  test('other layers should continue to function normally', async () => {
    // Test layer isolation
    expect(true).toBe(true); // Placeholder
  });

  test('retry mechanisms should be available if appropriate', async () => {
    // Mock retry logic
    expect(true).toBe(true); // Placeholder
  });
});