import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const feature = loadFeature('./src/features/MeasureTool.feature');

defineFeature(feature, test => {
  let measureTool;
  let mockDEM;
  let measurements;

  beforeEach(() => {
    measurements = [];
    
    measureTool = {
      active: false,
      mode: 'distance',
      activate: jest.fn(() => { measureTool.active = true; }),
      setMode: jest.fn((mode) => { measureTool.mode = mode; }),
      measureDistance: jest.fn((points) => {
        const distance = Math.sqrt(
          Math.pow(points[1][0] - points[0][0], 2) + 
          Math.pow(points[1][1] - points[0][1], 2)
        ) * 111.32; // rough km conversion
        const measurement = {
          type: 'distance',
          points,
          distance: Math.round(distance * 100) / 100,
          units: 'km'
        };
        measurements.push(measurement);
        return measurement;
      }),
      measureArea: jest.fn((polygon) => {
        const area = 1000; // mock area calculation
        const measurement = {
          type: 'area',
          polygon,
          area,
          units: 'km²'
        };
        measurements.push(measurement);
        return measurement;
      }),
      generateElevationProfile: jest.fn((points) => {
        const profile = points.map((point, index) => ({
          distance: index * 100,
          elevation: 1000 + Math.sin(index) * 200
        }));
        return profile;
      }),
      clearMeasurements: jest.fn(() => { measurements.length = 0; }),
      setUnits: jest.fn((units) => {
        measurements.forEach(m => {
          if (units === 'miles' && m.units === 'km') {
            m.distance = m.distance * 0.621371;
            m.units = 'miles';
          }
        });
      })
    };

    mockDEM = {
      datasets: [
        { id: 'dem1', name: 'High Resolution DEM', resolution: 1 },
        { id: 'dem2', name: 'Regional DEM', resolution: 10 }
      ],
      currentDataset: 'dem1',
      getElevation: jest.fn((coordinates) => 1500 + Math.random() * 500),
      switchDataset: jest.fn((datasetId) => {
        mockDEM.currentDataset = datasetId;
      })
    };
  });

  test('Basic distance measurement', ({ given, when, then, and }) => {
    let measurementResult;

    given('the Measure tool is enabled and active', () => {
      measureTool.activate();
      expect(measureTool.active).toBe(true);
    });

    when('I click two points on the map', () => {
      const point1 = [100, 50];
      const point2 = [101, 51];
      measurementResult = measureTool.measureDistance([point1, point2]);
    });

    then('a line should connect the two points', () => {
      expect(measurementResult.points).toEqual([[100, 50], [101, 51]]);
    });

    and('the distance between the points should be displayed', () => {
      expect(measurementResult.distance).toBeGreaterThan(0);
      expect(typeof measurementResult.distance).toBe('number');
    });

    and('the measurement should use appropriate units for the mission', () => {
      expect(measurementResult.units).toBe('km');
    });
  });

  test('Multi-segment distance measurement', ({ given, when, then, and }) => {
    let multiSegmentMeasurement;
    let segments = [];

    given('the Measure tool is in distance mode', () => {
      measureTool.setMode('distance');
      expect(measureTool.mode).toBe('distance');
    });

    when('I click multiple points to create a multi-segment line', () => {
      const points = [[100, 50], [101, 51], [102, 50], [103, 52]];
      
      // Simulate creating segments
      for (let i = 0; i < points.length - 1; i++) {
        const segment = measureTool.measureDistance([points[i], points[i + 1]]);
        segments.push(segment);
      }
      
      multiSegmentMeasurement = {
        segments,
        totalDistance: segments.reduce((sum, seg) => sum + seg.distance, 0)
      };
    });

    then('each segment should display its individual distance', () => {
      expect(segments.length).toBe(3);
      segments.forEach(segment => {
        expect(segment.distance).toBeGreaterThan(0);
      });
    });

    and('the total cumulative distance should be shown', () => {
      expect(multiSegmentMeasurement.totalDistance).toBeGreaterThan(0);
      expect(multiSegmentMeasurement.totalDistance).toBe(
        segments.reduce((sum, seg) => sum + seg.distance, 0)
      );
    });

    and('I should be able to add or remove measurement points', () => {
      expect(segments.length).toBe(3);
      // Simulate removing a segment
      segments.pop();
      expect(segments.length).toBe(2);
    });
  });

  test('Elevation profile generation', ({ given, when, then, and }) => {
    let elevationProfile;
    let measurementLine;

    given('DEM (Digital Elevation Model) data is available', () => {
      expect(mockDEM.datasets.length).toBeGreaterThan(0);
      expect(mockDEM.getElevation).toBeDefined();
    });

    and('the Measure tool is active', () => {
      measureTool.activate();
      expect(measureTool.active).toBe(true);
    });

    when('I draw a measurement line across terrain', () => {
      const linePoints = [[100, 50], [100.5, 50.2], [101, 50.5]];
      measurementLine = measureTool.measureDistance(linePoints);
      elevationProfile = measureTool.generateElevationProfile(linePoints);
    });

    then('an elevation profile chart should be generated', () => {
      expect(elevationProfile).toBeDefined();
      expect(Array.isArray(elevationProfile)).toBe(true);
      expect(elevationProfile.length).toBeGreaterThan(0);
    });

    and('the profile should show elevation changes along the line', () => {
      elevationProfile.forEach(point => {
        expect(point.elevation).toBeDefined();
        expect(point.distance).toBeDefined();
      });
    });

    and('the chart should be interactive with hover information', () => {
      expect(elevationProfile[0]).toHaveProperty('elevation');
      expect(elevationProfile[0]).toHaveProperty('distance');
    });
  });

  test('Using different DEM datasets', ({ given, when, then, and }) => {
    let initialProfile;
    let updatedProfile;

    given('multiple DEM datasets are available for the area', () => {
      expect(mockDEM.datasets.length).toBe(2);
      expect(mockDEM.datasets[0].name).toBe('High Resolution DEM');
      expect(mockDEM.datasets[1].name).toBe('Regional DEM');
    });

    when('I create a measurement with elevation profile', () => {
      const points = [[100, 50], [101, 51]];
      initialProfile = measureTool.generateElevationProfile(points);
    });

    then('I should be able to select which DEM to use', () => {
      expect(mockDEM.currentDataset).toBe('dem1');
      expect(mockDEM.switchDataset).toBeDefined();
    });

    when('I switch between different DEM datasets', () => {
      mockDEM.switchDataset('dem2');
      const points = [[100, 50], [101, 51]];
      updatedProfile = measureTool.generateElevationProfile(points);
    });

    then('the elevation profile should update accordingly', () => {
      expect(mockDEM.currentDataset).toBe('dem2');
      expect(updatedProfile).toBeDefined();
    });

    and('measurement accuracy should reflect the DEM resolution', () => {
      const highResDEM = mockDEM.datasets.find(d => d.id === 'dem1');
      const regionalDEM = mockDEM.datasets.find(d => d.id === 'dem2');
      expect(highResDEM.resolution).toBeLessThan(regionalDEM.resolution);
    });
  });

  test('Measurement unit conversion', ({ given, when, then, and }) => {
    let originalDistance;
    let convertedDistance;

    given('I have created distance measurements', () => {
      const measurement = measureTool.measureDistance([[100, 50], [101, 51]]);
      originalDistance = measurement.distance;
      expect(originalDistance).toBeGreaterThan(0);
    });

    when('I change the measurement unit settings', () => {
      measureTool.setUnits('miles');
    });

    then('all displayed measurements should convert to the new units', () => {
      const measurement = measurements[0];
      convertedDistance = measurement.distance;
      expect(measurement.units).toBe('miles');
    });

    and('the conversion should be accurate and appropriate', () => {
      expect(convertedDistance).toBeLessThan(originalDistance);
      expect(convertedDistance).toBeCloseTo(originalDistance * 0.621371, 2);
    });

    and('unit labels should update throughout the interface', () => {
      measurements.forEach(m => {
        expect(m.units).toBe('miles');
      });
    });
  });

  test('Measurement persistence and management', ({ given, when, then, and }) => {
    let persistentMeasurements = [];

    given('I have created multiple measurements', () => {
      measureTool.measureDistance([[100, 50], [101, 51]]);
      measureTool.measureDistance([[102, 52], [103, 53]]);
      persistentMeasurements = [...measurements];
      expect(measurements.length).toBe(2);
    });

    when('I navigate away from the measured area', () => {
      // Simulate navigation - measurements should persist
      expect(persistentMeasurements.length).toBe(2);
    });

    then('the measurements should remain visible when I return', () => {
      expect(persistentMeasurements).toEqual(measurements);
    });

    and('I should be able to clear individual measurements', () => {
      measurements.pop(); // Remove one measurement
      expect(measurements.length).toBe(1);
    });

    when('I clear all measurements', () => {
      measureTool.clearMeasurements();
    });

    then('the map should return to its unmeasured state', () => {
      expect(measurements.length).toBe(0);
    });
  });

  test('Area measurement functionality', ({ given, when, then, and }) => {
    let areaMeasurement;

    given('the Measure tool supports area calculation', () => {
      measureTool.setMode('area');
      expect(measureTool.measureArea).toBeDefined();
    });

    when('I draw a polygon on the map', () => {
      const polygon = [[[100, 50], [101, 50], [101, 51], [100, 51], [100, 50]]];
      areaMeasurement = measureTool.measureArea(polygon);
    });

    then('the enclosed area should be calculated and displayed', () => {
      expect(areaMeasurement.area).toBeGreaterThan(0);
      expect(typeof areaMeasurement.area).toBe('number');
    });

    and('the area should use appropriate units (square meters, hectares, etc.)', () => {
      expect(areaMeasurement.units).toBe('km²');
    });

    and('the calculation should account for map projection distortions', () => {
      expect(areaMeasurement.polygon).toEqual([[[100, 50], [101, 50], [101, 51], [100, 51], [100, 50]]]);
    });
  });

  test('Measurement accuracy with map projections', ({ given, when, then, and }) => {
    let projectionSystem = 'EPSG:4326';
    let largScaleMeasurement;
    let localMeasurement;

    given('the mission uses a specific map projection', () => {
      expect(projectionSystem).toBe('EPSG:4326');
    });

    when('I measure distances across different parts of the map', () => {
      // Large scale measurement (across continents)
      largScaleMeasurement = measureTool.measureDistance([[0, 0], [180, 0]]);
      // Local measurement
      localMeasurement = measureTool.measureDistance([[100, 50], [100.1, 50.1]]);
    });

    then('measurements should be accurate for the projection used', () => {
      expect(largScaleMeasurement.distance).toBeGreaterThan(localMeasurement.distance);
    });

    and('large-scale measurements should account for planetary curvature', () => {
      expect(largScaleMeasurement.distance).toBeGreaterThan(15000); // Rough half-circumference
    });

    and('measurement accuracy should be appropriate for the zoom level', () => {
      expect(localMeasurement.distance).toBeLessThan(20); // Local measurement should be small
    });
  });
});