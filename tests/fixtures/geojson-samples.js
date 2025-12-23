/**
 * Test GeoJSON samples for testing GeoJSON utility functions
 */

export const validGeoJSON = {
  point: {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    },
    properties: {
      name: 'Test Point'
    }
  },

  lineString: {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2]
      ]
    },
    properties: {
      name: 'Test LineString'
    }
  },

  polygon: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0]
      ]]
    },
    properties: {
      name: 'Test Polygon'
    }
  },

  multiPoint: {
    type: 'Feature',
    geometry: {
      type: 'MultiPoint',
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2]
      ]
    },
    properties: {
      name: 'Test MultiPoint'
    }
  },

  multiLineString: {
    type: 'Feature',
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [[0, 0], [1, 1]],
        [[2, 2], [3, 3]]
      ]
    },
    properties: {
      name: 'Test MultiLineString'
    }
  },

  multiPolygon: {
    type: 'Feature',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]
      ]
    },
    properties: {
      name: 'Test MultiPolygon'
    }
  },

  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {}
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: {}
      }
    ]
  }
};

export const invalidGeoJSON = {
  missingType: {
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {}
  },

  missingGeometry: {
    type: 'Feature',
    properties: {}
  },

  invalidCoordinates: {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: 'invalid' },
    properties: {}
  }
};

export const colorTestCases = {
  hex: '#ff0000',
  hexShort: '#f00',
  rgb: 'rgb(255, 0, 0)',
  rgba: 'rgba(255, 0, 0, 1)',
  named: 'red',
  invalid: 'not-a-color'
};
