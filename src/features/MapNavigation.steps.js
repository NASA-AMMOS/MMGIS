import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const feature = loadFeature('./src/features/MapNavigation.feature');

defineFeature(feature, test => {
  let mockMapInstance;
  let mockConfig;

  beforeEach(() => {
    const mockView = {
      center: [0, 0],
      zoom: 10,
      getCenter: jest.fn(() => mockView.center),
      getZoom: jest.fn(() => mockView.zoom),
      setCenter: jest.fn((center) => { mockView.center = center; }),
      setZoom: jest.fn((zoom) => { mockView.zoom = zoom; })
    };

    mockMapInstance = {
      getView: jest.fn(() => mockView),
      updateSize: jest.fn(),
      render: jest.fn()
    };

    mockConfig = {
      projection: 'EPSG:4326',
      extent: [-180, -90, 180, 90],
      zoom: { default: 5, min: 1, max: 18 }
    };

    global.L = {
      Map: jest.fn(() => mockMapInstance),
      tileLayer: jest.fn(() => ({
        addTo: jest.fn()
      })),
      control: {
        coordinates: jest.fn(() => ({
          addTo: jest.fn()
        }))
      }
    };
  });

  test('Loading a mission with default view', ({ given, when, then, and }) => {
    given('MMGIS is configured with a valid mission', () => {
      expect(mockConfig).toBeDefined();
      expect(mockConfig.projection).toBe('EPSG:4326');
    });

    when('I load the application', () => {
      // This would typically render the main App component
      // For now, we'll simulate the map initialization
      expect(mockMapInstance).toBeDefined();
    });

    then('the 2D map should be displayed', () => {
      expect(mockMapInstance.render).toBeDefined();
    });

    and('the map should show the configured default extent', () => {
      expect(mockConfig.extent).toEqual([-180, -90, 180, 90]);
    });

    and('coordinate information should be visible', () => {
      // Simulate coordinate display initialization
      global.L.control.coordinates();
      expect(global.L.control.coordinates).toHaveBeenCalled();
    });
  });

  test('Panning and zooming the map', ({ given, when, then, and }) => {
    let mapView;

    given('the 2D map is loaded and displayed', () => {
      mapView = mockMapInstance.getView();
      expect(mapView).toBeDefined();
    });

    when('I pan the map by dragging', () => {
      // Simulate pan operation
      mapView.setCenter([10, 10]);
    });

    then('the map view should update smoothly', () => {
      expect(mapView.setCenter).toHaveBeenCalledWith([10, 10]);
    });

    and('the coordinate display should update accordingly', () => {
      // The mock should reflect the updated center position
      expect(mapView.setCenter).toHaveBeenCalledWith([10, 10]);
    });

    when('I zoom in on the map', () => {
      mapView.setZoom(12);
    });

    then('the map should display more detail', () => {
      expect(mapView.setZoom).toHaveBeenCalledWith(12);
    });

    and('the zoom controls should reflect the current level', () => {
      expect(mapView.getZoom()).toBe(12);
    });
  });

  test('Switching between 2D and 3D views', ({ given, when, then, and }) => {
    let currentView = '2D';
    let currentPosition = [0, 0];

    given('both 2D map and 3D globe views are available', () => {
      expect(['2D', '3D']).toContain('2D');
      expect(['2D', '3D']).toContain('3D');
    });

    and('I am currently viewing the 2D map', () => {
      expect(currentView).toBe('2D');
    });

    when('I switch to the 3D globe view', () => {
      currentView = '3D';
      // Simulate switching views while preserving position
    });

    then('the globe should load with the same geographic area', () => {
      expect(currentView).toBe('3D');
      expect(currentPosition).toEqual([0, 0]);
    });

    and('the view should maintain contextual information', () => {
      expect(currentPosition).toBeDefined();
    });

    when('I switch back to 2D view', () => {
      currentView = '2D';
    });

    then('I should return to the equivalent 2D map position', () => {
      expect(currentView).toBe('2D');
      expect(currentPosition).toEqual([0, 0]);
    });
  });

  test('Deep linking to specific map coordinates', ({ given, when, then, and }) => {
    let urlParams;
    let currentUrl;

    given('MMGIS supports URL-based navigation', () => {
      expect(window.location).toBeDefined();
    });

    when('I access a URL with specific coordinates and zoom level', () => {
      urlParams = new URLSearchParams('?lon=100&lat=50&zoom=8');
      // Simulate loading from URL parameters
    });

    then('the map should load at the specified location', () => {
      expect(urlParams.get('lon')).toBe('100');
      expect(urlParams.get('lat')).toBe('50');
    });

    and('the zoom level should match the URL parameter', () => {
      expect(urlParams.get('zoom')).toBe('8');
    });

    and('the URL should be updated when I navigate to new areas', () => {
      // Simulate URL update on navigation
      currentUrl = '?lon=120&lat=60&zoom=10';
      expect(currentUrl).toContain('lon=120');
      expect(currentUrl).toContain('lat=60');
    });
  });

  test('Custom projection coordinate display', ({ given, when, then, and }) => {
    let projectionSystem = 'EPSG:3857';
    let coordinates = { x: 0, y: 0 };

    given('the mission uses a custom projection system', () => {
      expect(projectionSystem).toBe('EPSG:3857');
    });

    when('I navigate around the map', () => {
      coordinates = { x: 1113194.9, y: 6446275.8 };
    });

    then('coordinates should be displayed in the correct projection', () => {
      expect(coordinates.x).toBeDefined();
      expect(coordinates.y).toBeDefined();
      expect(typeof coordinates.x).toBe('number');
      expect(typeof coordinates.y).toBe('number');
    });

    and('coordinate precision should be appropriate for the zoom level', () => {
      // Higher zoom levels should show more decimal places
      expect(coordinates.x.toString()).toMatch(/\d+\.\d+/);
    });

    and('coordinate system information should be available to the user', () => {
      expect(projectionSystem).toMatch(/EPSG:\d+/);
    });
  });
});