/**
 * Sample GeoJSON features for Draw tool tests.
 *
 * All features are located in the San Francisco area to align with the
 * Reference Mission's default view (37.8, -122.4).
 *
 * Note: GeoJSON coordinates are [longitude, latitude].
 */

/**
 * A single point feature in San Francisco.
 */
export const SAMPLE_POINT = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-122.42, 37.78],
  },
  properties: {
    name: 'SF Test Point',
    description: 'Sample point for draw tests',
  },
};

/**
 * A line feature running through San Francisco.
 */
export const SAMPLE_LINE = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-122.42, 37.78],
      [-122.41, 37.79],
      [-122.40, 37.80],
    ],
  },
  properties: {
    name: 'SF Test Line',
    description: 'Sample line through San Francisco',
  },
};

/**
 * A polygon feature around downtown San Francisco.
 */
export const SAMPLE_POLYGON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-122.42, 37.775],
        [-122.41, 37.775],
        [-122.41, 37.785],
        [-122.42, 37.785],
        [-122.42, 37.775],
      ],
    ],
  },
  properties: {
    name: 'Downtown SF Polygon',
    description: 'Sample polygon around downtown San Francisco',
  },
};

/**
 * A FeatureCollection containing all three sample features.
 */
export const SAMPLE_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [SAMPLE_POINT, SAMPLE_LINE, SAMPLE_POLYGON],
};

/**
 * A point feature with Draw-tool template properties.
 */
export const SAMPLE_DRAW_FEATURE = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-122.4194, 37.7749],
  },
  properties: {
    name: 'Draw Template Point',
    intent: 'ROI',
    priority: 'High',
    confidence: 75,
    notes: 'Automated test feature',
    reviewed: false,
    obs_date: '2024-01-15 12:00:00',
  },
};
