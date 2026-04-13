/**
 * Sample geodataset rows matching the Reference Mission geodataset structure.
 *
 * These fixtures mirror the format expected by the MMGIS geodataset API
 * and can be used for seeding test databases or validating query responses.
 */

/**
 * Basic geodataset entries (for `reference_mission_basic`).
 * Simple point features with a few properties.
 */
export const BASIC_ENTRIES = [
  {
    id: 1,
    properties: { name: 'Point A', category: 'alpha', value: 10 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
      properties: { name: 'Point A', category: 'alpha', value: 10 },
    },
  },
  {
    id: 2,
    properties: { name: 'Point B', category: 'beta', value: 25 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.41, 37.79] },
      properties: { name: 'Point B', category: 'beta', value: 25 },
    },
  },
  {
    id: 3,
    properties: { name: 'Point C', category: 'gamma', value: 42 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.43, 37.77] },
      properties: { name: 'Point C', category: 'gamma', value: 42 },
    },
  },
];

/**
 * Dynamic-extent geodataset entries (for `reference_mission_dynamic_extent`).
 * Spread across the viewport so extent filtering can be tested.
 */
export const DYNAMIC_EXTENT_ENTRIES = [
  {
    id: 1,
    properties: { name: 'NW Corner', region: 'northwest' },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.50, 37.82] },
      properties: { name: 'NW Corner', region: 'northwest' },
    },
  },
  {
    id: 2,
    properties: { name: 'SE Corner', region: 'southeast' },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.35, 37.75] },
      properties: { name: 'SE Corner', region: 'southeast' },
    },
  },
  {
    id: 3,
    properties: { name: 'Center', region: 'central' },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.42, 37.79] },
      properties: { name: 'Center', region: 'central' },
    },
  },
];

/**
 * No-duplicates geodataset entries (for `reference_mission_no_duplicates`).
 * Multiple records per location sharing a `site_id` group key.
 */
export const NO_DUPLICATES_ENTRIES = [
  {
    id: 1,
    site_id: 'site_alpha',
    properties: { name: 'Alpha Reading 1', reading: 100 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
      properties: { name: 'Alpha Reading 1', site_id: 'site_alpha', reading: 100 },
    },
  },
  {
    id: 2,
    site_id: 'site_alpha',
    properties: { name: 'Alpha Reading 2', reading: 110 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
      properties: { name: 'Alpha Reading 2', site_id: 'site_alpha', reading: 110 },
    },
  },
  {
    id: 3,
    site_id: 'site_beta',
    properties: { name: 'Beta Reading 1', reading: 200 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.45, 37.80] },
      properties: { name: 'Beta Reading 1', site_id: 'site_beta', reading: 200 },
    },
  },
  {
    id: 4,
    site_id: 'site_beta',
    properties: { name: 'Beta Reading 2', reading: 215 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.45, 37.80] },
      properties: { name: 'Beta Reading 2', site_id: 'site_beta', reading: 215 },
    },
  },
];

/**
 * Properties-on-click geodataset entries
 * (for `reference_mission_properties_on_click`).
 * Initial load returns only geometry + feature_code; full properties
 * are fetched on click.
 */
export const PROPERTIES_ON_CLICK_ENTRIES = [
  {
    id: 1,
    feature_code: 'FC001',
    properties: { address: '123 Market St', area: 5000, visitors: 1200 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.419, 37.775] },
      properties: { feature_code: 'FC001' },
    },
  },
  {
    id: 2,
    feature_code: 'FC002',
    properties: { address: '456 Mission St', area: 3200, visitors: 800 },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.415, 37.778] },
      properties: { feature_code: 'FC002' },
    },
  },
];

/**
 * Time-series geodataset entries (for `reference_mission_time_series`).
 * Each entry has `start_time` and `end_time` as Unix timestamps (BIGINT).
 */
export const TIME_SERIES_ENTRIES = [
  {
    id: 1,
    start_time: 1704067200, // 2024-01-01T00:00:00Z
    end_time: 1704153600,   // 2024-01-02T00:00:00Z
    properties: { name: 'Event Jan 1', type: 'observation' },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.42, 37.78] },
      properties: { name: 'Event Jan 1', type: 'observation' },
    },
  },
  {
    id: 2,
    start_time: 1704672000, // 2024-01-08T00:00:00Z
    end_time: 1704758400,   // 2024-01-09T00:00:00Z
    properties: { name: 'Event Jan 8', type: 'measurement' },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.41, 37.79] },
      properties: { name: 'Event Jan 8', type: 'measurement' },
    },
  },
  {
    id: 3,
    start_time: 1706140800, // 2024-01-25T00:00:00Z
    end_time: 1706227200,   // 2024-01-26T00:00:00Z
    properties: { name: 'Event Jan 25', type: 'anomaly' },
    geojson: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.43, 37.77] },
      properties: { name: 'Event Jan 25', type: 'anomaly' },
    },
  },
];
