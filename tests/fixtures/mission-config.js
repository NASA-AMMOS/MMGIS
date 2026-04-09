/**
 * Minimal valid mission configuration based on the Reference Mission.
 *
 * Extracted from `blueprints/Missions/Reference-Mission/config.reference-mission.json`.
 * Use this as a template for tests that need to create or validate mission configs.
 */

/**
 * Core mission/site/view settings.
 */
export const MISSION_MSV = {
  mission: 'Reference-Mission',
  missionFolderName: 'Reference-Mission',
  site: 'Demo',
  masterdb: false,
  view: [37.8, -122.4, 12],
  radius: { major: '6378137', minor: '6356752' },
  mapscale: '12',
};

/**
 * Default projection settings (Web Mercator).
 */
export const MISSION_PROJECTION = {
  custom: false,
  epsg: 'EPSG:3857',
  proj: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
  globeproj: 'webmercator',
  xmlpath: '',
  bounds: ['', '', '', ''],
  origin: ['', ''],
  reszoomlevel: '',
  resunitsperpixel: '',
};

/**
 * Look & feel settings.
 */
export const MISSION_LOOK = {
  pagename: 'MMGIS Reference Mission',
  missionname: 'Reference Mission',
  missionsubtitle: 'Reference Mission Demo',
  minimalist: false,
  topbar: true,
  toolbar: true,
  scalebar: true,
  noscalebar: false,
  coordinates: true,
  zoomcontrol: false,
  graticule: true,
  miscellaneous: true,
  timestamp: false,
  radiusdivs: false,
  bodycolor: '',
  topbarcolor: '',
  toolbarcolor: '',
  mapcolor: '',
  swap: true,
  copylink: true,
  screenshot: true,
  fullscreen: true,
  help: true,
  logourl: '',
  helpurl: 'https://nasa-ammos.github.io/MMGIS/',
};

/**
 * Time control settings.
 */
export const MISSION_TIME = {
  enabled: true,
  visible: true,
  initiallyOpen: true,
  startInPointMode: false,
  format: '%Y-%m-%dT%H:%M:%SZ',
  initialstart: '2024-01-01T00:00:00Z',
  initialend: '2024-01-20T00:00:00Z',
  loop: false,
  loopDelay: 0,
  step: 86400,
  relativeto: null,
};

/**
 * Panel visibility settings.
 */
export const MISSION_PANELS = {
  viewer: true,
  map: true,
  globe: true,
};

/**
 * Tools configured in the Reference Mission.
 */
export const MISSION_TOOLS = [
  'Identifier',
  'Layers',
  'Legend',
  'Info',
  'Sites',
  'Draw',
  'Measure',
  'Viewshed',
  'Isochrone',
  'Shade',
  'Chemistry',
  'Curtain',
  'Animation',
];

/**
 * Sites configured in the Reference Mission.
 */
export const MISSION_SITES = [
  { name: 'San Francisco', code: 'SF', lat: 37.8, lng: -122.4, zoom: 12 },
  { name: 'Golden Gate Bridge', code: 'GGB', lat: 37.8199, lng: -122.4783, zoom: 15 },
  { name: 'Downtown San Francisco', code: 'DTSF', lat: 37.7749, lng: -122.4194, zoom: 13 },
  { name: 'San Francisco Bay Overview', code: 'SFBAY', lat: 37.8, lng: -122.4, zoom: 11 },
  { name: 'Alcatraz Island', code: 'ALCA', lat: 37.827, lng: -122.423, zoom: 16 },
];

/**
 * Draw tool intents.
 */
export const DRAW_INTENTS = [
  'ROI',
  'Campaign',
  'Traverse',
  'Waypoint',
  'Annotation',
  'All Features',
];

/**
 * Draw tool templates.
 */
export const DRAW_TEMPLATES = [
  { name: 'Priority Level', field: 'priority', type: 'dropdown', required: true, items: ['High', 'Medium', 'Low'], default: 'Medium' },
  { name: 'Confidence Score', field: 'confidence', type: 'slider', min: 0, max: 100, step: 5, default: 50 },
  { name: 'Notes', field: 'notes', type: 'textarea', maxLength: 500, required: false, default: '' },
  { name: 'Reviewed', field: 'reviewed', type: 'checkbox', default: false },
  { name: 'Observation Date', field: 'obs_date', type: 'date', format: 'YYYY-MM-DD HH:mm:ss', default: 'now' },
];

/**
 * Geodataset names used by the Reference Mission.
 */
export const GEODATASET_NAMES = [
  'reference_mission_basic',
  'reference_mission_dynamic_extent',
  'reference_mission_no_duplicates',
  'reference_mission_properties_on_click',
  'reference_mission_time_series',
];

/**
 * Minimal complete mission config object suitable for API-based mission
 * creation in tests. Combines the individual sections above.
 */
export const MINIMAL_MISSION_CONFIG = {
  msv: MISSION_MSV,
  projection: MISSION_PROJECTION,
  look: MISSION_LOOK,
  time: MISSION_TIME,
  panels: MISSION_PANELS,
  panelSettings: {
    demFallbackPath: '',
    demFallbackFormat: null,
    demFallbackType: null,
  },
  variables: {},
  components: [],
  layers: [],
  tools: [
    { name: 'Layers', icon: 'layers', js: 'LayersTool', variables: { expanded: true } },
  ],
};
