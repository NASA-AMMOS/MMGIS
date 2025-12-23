/**
 * Test coordinate samples with known distances
 * Used for testing geographic calculation functions
 */

export const coordinatePairs = {
  // Very short distance (for precision testing)
  shortDistance: {
    start: { lng: -118.2437, lat: 34.0522 }, // Los Angeles
    end: { lng: -118.2440, lat: 34.0525 },
    expectedDistanceMeters: 37,
    description: 'Short distance in LA area'
  },

  // Medium distance (within same region)
  mediumDistance: {
    start: { lng: 0, lat: 0 },
    end: { lng: 1, lat: 1 },
    expectedDistanceMeters: 157425,
    description: '1 degree diagonal at equator'
  },

  // Long distance (cross-continental)
  longDistance: {
    start: { lng: -118.2437, lat: 34.0522 }, // Los Angeles
    end: { lng: -74.0060, lat: 40.7128 },    // New York
    expectedDistanceMeters: 3936190,
    description: 'LA to NYC'
  },

  // Same point (zero distance)
  samePoint: {
    start: { lng: 0, lat: 0 },
    end: { lng: 0, lat: 0 },
    expectedDistanceMeters: 0,
    description: 'Same point (zero distance)'
  },

  // Mars coordinates (example mission site - Gale Crater)
  marsGaleCrater: {
    start: { lng: 137.4, lat: -4.5 },
    end: { lng: 137.8, lat: -4.7 },
    description: 'Gale Crater area on Mars'
  },
};

export const bearingTestCases = {
  dueEast: {
    start: { lng: 0, lat: 0 },
    end: { lng: 1, lat: 0 },
    expectedBearing: 90,
    description: 'Due east'
  },
  dueWest: {
    start: { lng: 0, lat: 0 },
    end: { lng: -1, lat: 0 },
    expectedBearing: 270,
    description: 'Due west'
  },
  dueNorth: {
    start: { lng: 0, lat: 0 },
    end: { lng: 0, lat: 1 },
    expectedBearing: 0,
    description: 'Due north'
  },
  dueSouth: {
    start: { lng: 0, lat: 0 },
    end: { lng: 0, lat: -1 },
    expectedBearing: 180,
    description: 'Due south'
  },
};
