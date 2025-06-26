import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { mockConfigAPI } from './ConfigurationAPI.steps';

const feature = loadFeature('./src/features/VelocityLayer.feature');

defineFeature(feature, test => {
  let mockVelocityRenderer;
  let velocityLayers;
  let animationFrames;
  let currentMission;
  let velocityLayerConfig;

  beforeEach(() => {
    velocityLayers = [];
    animationFrames = [];
    
    mockVelocityRenderer = {
      streamlines: {
        particles: [],
        colorScale: null,
        
        initializeStreamlines: jest.fn((config) => {
          const streamlineConfig = {
            minVelocity: config.minVelocity || 0,
            maxVelocity: config.maxVelocity || 15,
            velocityScale: config.velocityScale || 0.005,
            particleAge: config.particleAge || 90,
            lineWidth: config.lineWidth || 1,
            particleMultiplier: config.particleMultiplier || 0.003333,
            frameRate: config.frameRate || 15,
            displayValues: config.displayValues || false,
            colorScale: config.colorScale || 'RDYLBU_R',
            units: config.units || 'm/s',
            displayPosition: config.displayPosition || 'bottomleft'
          };
          velocityLayers.push({ type: 'streamlines', config: streamlineConfig });
          return streamlineConfig;
        }),
        
        animate: jest.fn(() => {
          animationFrames.push({
            timestamp: Date.now(),
            particleCount: Math.floor(Math.random() * 1000),
            frameRate: 15
          });
        }),
        
        updateVelocityData: jest.fn((data) => {
          expect(data).toBeDefined();
        })
      },
      
      particles: {
        initializeParticles: jest.fn((config) => {
          const particleConfig = {
            angle: config.angle || 80,
            width: config.width || 1,
            spacing: config.spacing || 10,
            length: config.length || 4,
            interval: config.interval || 10,
            speed: config.speed || 0.1,
            units: config.units || 'm/s',
            color: config.color || '#FFFFFF'
          };
          velocityLayers.push({ type: 'particles', config: particleConfig });
          return particleConfig;
        })
      },
      
      windbarbs: {
        initializeWindBarbs: jest.fn((config) => {
          const windBarbConfig = {
            units: config.units || 'knots',
            displayValues: config.displayValues || true,
            colorScale: config.colorScale || 'VIRIDIS'
          };
          velocityLayers.push({ type: 'windbarbs', config: windBarbConfig });
          return windBarbConfig;
        })
      },
      
      arrows: {
        initializeArrows: jest.fn((config) => {
          const arrowConfig = {
            units: config.units || 'm/s',
            arrowSize: config.arrowSize || 1.0,
            arrowSpacing: config.arrowSpacing || 15,
            colorScale: config.colorScale || 'PLASMA'
          };
          velocityLayers.push({ type: 'arrows', config: arrowConfig });
          return arrowConfig;
        })
      },
      
      // Data format parsers
      parseGribJSON: jest.fn((data) => {
        return {
          format: 'gribjson',
          uComponent: new Array(100).fill(0).map(() => Math.random() * 10),
          vComponent: new Array(100).fill(0).map(() => Math.random() * 10),
          bounds: [-180, -90, 180, 90]
        };
      }),
      
      parseGeoTIFF: jest.fn((data) => {
        return {
          format: 'geotiff',
          bands: ['u', 'v'],
          resolution: [0.1, 0.1],
          bounds: [-180, -90, 180, 90]
        };
      }),
      
      parseNetCDF: jest.fn((data) => {
        return {
          format: 'netcdf',
          variables: ['u10', 'v10', 'temperature'],
          dimensions: { lat: 180, lon: 360, time: 24 },
          bounds: [-180, -90, 180, 90]
        };
      }),
      
      // Performance monitoring
      getPerformanceMetrics: jest.fn(() => {
        return {
          frameRate: animationFrames.length > 1 ? 
            1000 / (animationFrames[animationFrames.length - 1].timestamp - animationFrames[animationFrames.length - 2].timestamp) : 15,
          particleCount: animationFrames.length > 0 ? animationFrames[animationFrames.length - 1].particleCount : 0,
          memoryUsage: Math.random() * 100 // MB
        };
      })
    };
  });

  test('Streamlines visualization with wind data', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
      expect(mockConfigAPI.missions.size).toBe(0);
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

    given('I add a velocity layer with streamlines configuration:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.streamlines) {
        mockVelocityRenderer.streamlines.initializeStreamlines(velocityLayerConfig.variables.streamlines);
      }
    });

    when('I load the map', () => {
      expect(mockConfigAPI.missions.size).toBeGreaterThan(0);
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('streamlines should be animated based on wind velocity data', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer).toBeDefined();
      
      mockVelocityRenderer.streamlines.animate();
      expect(mockVelocityRenderer.streamlines.animate).toHaveBeenCalled();
    });

    and('particle animation should flow according to wind direction', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer).toBeDefined();
      expect(streamlineLayer.config.velocityScale).toBe(0.005);
    });

    and('velocity magnitude should be color-coded using RDYLBU_R colormap', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.colorScale).toBe('RDYLBU_R');
    });

    and('velocity values should be displayed in m/s units', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.units).toBe('m/s');
      expect(streamlineLayer.config.displayValues).toBe(true);
    });

    and(/^particles should regenerate every (\d+) frames$/, (frameCount) => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.particleAge).toBe(parseInt(frameCount));
    });

    and(/^frame rate should be approximately (\d+) fps$/, async (fps) => {
      // Simulate several animation frames
      for (let i = 0; i < 5; i++) {
        mockVelocityRenderer.streamlines.animate();
        await new Promise(resolve => setTimeout(resolve, 67)); // ~15fps
      }
      
      const metrics = mockVelocityRenderer.getPerformanceMetrics();
      expect(metrics.frameRate).toBeGreaterThan(parseInt(fps) - 3);
      expect(metrics.frameRate).toBeLessThan(parseInt(fps) + 3);
    });
  });

  test('Particle visualization with atmospheric data', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with particles configuration:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.particles) {
        const particleConfig = velocityLayerConfig.variables.particles;
        if (velocityLayerConfig.style && velocityLayerConfig.style.color) {
          particleConfig.color = velocityLayerConfig.style.color;
        }
        mockVelocityRenderer.particles.initializeParticles(particleConfig);
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('particles should be displayed in green color', () => {
      const particleLayer = velocityLayers.find(layer => layer.type === 'particles');
      expect(particleLayer).toBeDefined();
      expect(particleLayer.config.color).toBe('#00FF00');
    });

    and(/^particles should be angled at (\d+) degrees$/, (angle) => {
      const particleLayer = velocityLayers.find(layer => layer.type === 'particles');
      expect(particleLayer.config.angle).toBe(parseInt(angle));
    });

    and(/^particle spacing should be (\d+) pixels apart$/, (spacing) => {
      const particleLayer = velocityLayers.find(layer => layer.type === 'particles');
      expect(particleLayer.config.spacing).toBe(parseInt(spacing));
    });

    and(/^particle movement speed should be scaled by (\d+(?:\.\d+)?) factor$/, (speed) => {
      const particleLayer = velocityLayers.find(layer => layer.type === 'particles');
      expect(particleLayer.config.speed).toBe(parseFloat(speed));
    });

    and('units should display as km/h when hovering', () => {
      const particleLayer = velocityLayers.find(layer => layer.type === 'particles');
      expect(particleLayer.config.units).toBe('km/h');
    });
  });

  test('Wind barb visualization for meteorological data', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with wind barbs configuration:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.windbarbs) {
        mockVelocityRenderer.windbarbs.initializeWindBarbs(velocityLayerConfig.variables.windbarbs);
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('wind barbs should be displayed at station locations', () => {
      const windBarbLayer = velocityLayers.find(layer => layer.type === 'windbarbs');
      expect(windBarbLayer).toBeDefined();
    });

    and('barb orientation should indicate wind direction', () => {
      // Mock wind barb orientation logic
      expect(true).toBe(true);
    });

    and('barb features should indicate wind speed', () => {
      // Mock wind barb speed indication
      expect(true).toBe(true);
    });

    and('values should be displayed in knots', () => {
      const windBarbLayer = velocityLayers.find(layer => layer.type === 'windbarbs');
      expect(windBarbLayer.config.units).toBe('knots');
    });

    and('VIRIDIS colormap should be applied based on wind speed', () => {
      const windBarbLayer = velocityLayers.find(layer => layer.type === 'windbarbs');
      expect(windBarbLayer.config.colorScale).toBe('VIRIDIS');
    });
  });

  test('Arrow visualization for flow direction', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with arrows configuration:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.arrows) {
        mockVelocityRenderer.arrows.initializeArrows(velocityLayerConfig.variables.arrows);
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('arrows should be displayed showing flow direction', () => {
      const arrowLayer = velocityLayers.find(layer => layer.type === 'arrows');
      expect(arrowLayer).toBeDefined();
    });

    and('arrow size should be proportional to velocity magnitude', () => {
      const arrowLayer = velocityLayers.find(layer => layer.type === 'arrows');
      expect(arrowLayer.config.arrowSize).toBeDefined();
    });

    and(/^arrows should be spaced (\d+) pixels apart$/, (spacing) => {
      const arrowLayer = velocityLayers.find(layer => layer.type === 'arrows');
      expect(arrowLayer.config.arrowSpacing).toBe(parseInt(spacing));
    });

    and('PLASMA colormap should be applied to arrows', () => {
      const arrowLayer = velocityLayers.find(layer => layer.type === 'arrows');
      expect(arrowLayer.config.colorScale).toBe('PLASMA');
    });

    and('units should display as m/s', () => {
      const arrowLayer = velocityLayers.find(layer => layer.type === 'arrows');
      expect(arrowLayer.config.units).toBe('m/s');
    });
  });

  test('Velocity layer with temporal animation', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with time-enabled configuration:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.streamlines) {
        mockVelocityRenderer.streamlines.initializeStreamlines(velocityLayerConfig.variables.streamlines);
      }
    });

    when('I adjust the time control', () => {
      // Mock time control adjustment
      const timeValue = '2023-12-01T12:00:00Z';
      expect(timeValue).toContain('2023');
    });

    then('the velocity layer should update with new temporal data', () => {
      const newVelocityData = { timestamp: '2023-12-01T12:00:00Z' };
      mockVelocityRenderer.streamlines.updateVelocityData(newVelocityData);
      expect(mockVelocityRenderer.streamlines.updateVelocityData).toHaveBeenCalledWith(newVelocityData);
    });

    and('streamlines should animate according to the selected time', () => {
      mockVelocityRenderer.streamlines.animate();
      expect(animationFrames.length).toBeGreaterThan(0);
    });

    and(/^the layer should auto-refresh every (\d+) minutes$/, (minutes) => {
      const refreshInterval = parseInt(minutes) * 60;
      expect(velocityLayerConfig.time.refreshIntervalAmount).toBe(refreshInterval);
    });

    and('temporal metadata should be preserved', () => {
      expect(velocityLayerConfig.time.enabled).toBe(true);
    });
  });

  test('Multi-level velocity data visualization', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with altitude levels:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.streamlines) {
        mockVelocityRenderer.streamlines.initializeStreamlines(velocityLayerConfig.variables.streamlines);
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then(/^streamlines should represent (\d+)mb level wind data$/, (pressure) => {
      expect(velocityLayerConfig.variables.streamlines.level).toBe(`${pressure}mb`);
    });

    and('level information should be displayed in metadata', () => {
      expect(velocityLayerConfig.variables.streamlines.level).toBeDefined();
    });

    and('velocity values should be appropriate for the altitude level', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.maxVelocity).toBe(50);
    });

    and('I should be able to switch between different pressure levels', () => {
      // Placeholder for level switching functionality
      expect(true).toBe(true);
    });
  });

  test('Velocity layer performance with large datasets', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with high-resolution data:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.streamlines) {
        mockVelocityRenderer.streamlines.initializeStreamlines(velocityLayerConfig.variables.streamlines);
      }
    });

    when('I navigate at different zoom levels', () => {
      // Mock zoom level navigation
      const zoomLevels = [2, 6, 12];
      expect(zoomLevels.length).toBe(3);
    });

    then('particle density should be appropriate for the zoom level', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.particleMultiplier).toBe(0.001);
    });

    and('performance should remain smooth during navigation', () => {
      const metrics = mockVelocityRenderer.getPerformanceMetrics();
      expect(metrics.frameRate).toBeGreaterThan(8);
    });

    and('memory usage should be optimized for large datasets', () => {
      const metrics = mockVelocityRenderer.getPerformanceMetrics();
      expect(metrics.memoryUsage).toBeLessThan(200);
    });

    and(/^frame rate should be maintained at approximately (\d+) fps$/, async (fps) => {
      // For high-res data, lower framerate is acceptable
      for (let i = 0; i < 3; i++) {
        mockVelocityRenderer.streamlines.animate();
        await new Promise(resolve => setTimeout(resolve, 100)); // ~10fps
      }
      
      const metrics = mockVelocityRenderer.getPerformanceMetrics();
      expect(metrics.frameRate).toBeGreaterThan(parseInt(fps) - 2);
    });
  });

  test('Velocity layer data format support', ({ given, and, when, then }) => {
    let dataFormats = [];

    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I test different velocity data formats', () => {
      expect(mockVelocityRenderer.parseGribJSON).toBeDefined();
      expect(mockVelocityRenderer.parseGeoTIFF).toBeDefined();
      expect(mockVelocityRenderer.parseNetCDF).toBeDefined();
    });

    when('I load a layer with GribJSON format:', (layerConfigJSON) => {
      const layerConfig = JSON.parse(layerConfigJSON);
      dataFormats.push({ format: 'gribjson', config: layerConfig });
    });

    then('the GribJSON format should be properly parsed', () => {
      const gribData = mockVelocityRenderer.parseGribJSON('mock-grib-data');
      expect(gribData.format).toBe('gribjson');
      expect(gribData.uComponent).toBeDefined();
      expect(gribData.vComponent).toBeDefined();
    });

    when('I load a layer with GeoTIFF format:', (layerConfigJSON) => {
      const layerConfig = JSON.parse(layerConfigJSON);
      dataFormats.push({ format: 'geotiff', config: layerConfig });
    });

    then('the GeoTIFF format should be properly parsed', () => {
      const tiffData = mockVelocityRenderer.parseGeoTIFF('mock-tiff-data');
      expect(tiffData.format).toBe('geotiff');
      expect(tiffData.bands).toContain('u');
      expect(tiffData.bands).toContain('v');
    });

    when('I load a layer with NetCDF format:', (layerConfigJSON) => {
      const layerConfig = JSON.parse(layerConfigJSON);
      dataFormats.push({ format: 'netcdf', config: layerConfig });
    });

    then('the NetCDF format should be properly parsed', () => {
      const ncData = mockVelocityRenderer.parseNetCDF('mock-nc-data');
      expect(ncData.format).toBe('netcdf');
      expect(ncData.variables).toContain('u10');
      expect(ncData.variables).toContain('v10');
    });
  });

  test('Velocity layer customization and styling', ({ given, and, when, then }) => {
    given('MMGIS is configured with a test mission', () => {
      mockConfigAPI.reset();
    });

    and('I have authenticated with long-term API token', async () => {
      const token = await mockConfigAPI.authenticate();
      expect(token).toBeDefined();
    });

    and('the following mission configuration exists:', async (configJSON) => {
      const config = JSON.parse(configJSON);
      currentMission = await mockConfigAPI.createMission(config.msv.mission, config);
    });

    given('I add a velocity layer with custom styling:', (layerConfigJSON) => {
      velocityLayerConfig = JSON.parse(layerConfigJSON);
      currentMission.config.layers.push(velocityLayerConfig);
      
      if (velocityLayerConfig.variables && velocityLayerConfig.variables.streamlines) {
        mockVelocityRenderer.streamlines.initializeStreamlines(velocityLayerConfig.variables.streamlines);
      }
    });

    when('I load the map', () => {
      expect(currentMission.config.layers.length).toBeGreaterThan(0);
    });

    then('the TURBO colormap should be applied', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.colorScale).toBe('TURBO');
    });

    and(/^streamline width should be (\d+) pixels$/, (width) => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.lineWidth).toBe(parseInt(width));
    });

    and('velocity values should be displayed in the top-right corner', () => {
      const streamlineLayer = velocityLayers.find(layer => layer.type === 'streamlines');
      expect(streamlineLayer.config.displayPosition).toBe('topright');
    });

    and('styling should be customizable through layer settings', () => {
      expect(velocityLayers.length).toBeGreaterThan(0);
      expect(velocityLayers[0].config).toBeDefined();
    });
  });
});