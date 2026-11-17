/**
 * Sample CSV content strings for dataset upload tests.
 *
 * Each constant is a raw CSV string that can be written to a temp file or
 * sent directly via the API for testing CSV import functionality.
 */

/**
 * Basic CSV with latitude, longitude, and a few properties.
 */
export const BASIC_CSV = `latitude,longitude,name,value
37.78,-122.42,Point A,10
37.79,-122.41,Point B,25
37.77,-122.43,Point C,42
37.80,-122.40,Point D,18`;

/**
 * CSV with additional columns matching typical mission science data.
 */
export const SCIENCE_CSV = `lat,lon,sol,instrument,measurement,unit,timestamp
37.7800,-122.4200,100,APXS,14.5,wt%,2024-01-01T00:00:00Z
37.7810,-122.4190,101,APXS,12.3,wt%,2024-01-02T00:00:00Z
37.7820,-122.4180,102,ChemCam,8.7,wt%,2024-01-03T00:00:00Z
37.7830,-122.4170,103,APXS,15.1,wt%,2024-01-04T00:00:00Z
37.7840,-122.4160,104,ChemCam,9.2,wt%,2024-01-05T00:00:00Z`;

/**
 * CSV with time-series data for temporal filtering tests.
 */
export const TIME_SERIES_CSV = `latitude,longitude,start_time,end_time,event_type,magnitude
37.78,-122.42,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,observation,3.5
37.79,-122.41,2024-01-05T00:00:00Z,2024-01-06T00:00:00Z,measurement,2.1
37.77,-122.43,2024-01-10T00:00:00Z,2024-01-11T00:00:00Z,anomaly,4.8
37.80,-122.40,2024-01-15T00:00:00Z,2024-01-16T00:00:00Z,observation,1.9
37.81,-122.39,2024-01-20T00:00:00Z,2024-01-21T00:00:00Z,measurement,3.0`;

/**
 * CSV with WKT geometry column instead of lat/lon.
 */
export const WKT_CSV = `wkt,name,category
"POINT(-122.42 37.78)",Station Alpha,primary
"POINT(-122.41 37.79)",Station Beta,secondary
"LINESTRING(-122.42 37.78,-122.41 37.79,-122.40 37.80)",Path 1,route
"POLYGON((-122.42 37.775,-122.41 37.775,-122.41 37.785,-122.42 37.785,-122.42 37.775))",Zone A,boundary`;

/**
 * Empty CSV (header only) for edge-case testing.
 */
export const EMPTY_CSV = `latitude,longitude,name,value`;

/**
 * Malformed CSV for error-handling tests.
 */
export const MALFORMED_CSV = `latitude,longitude,name
37.78,-122.42
37.79,-122.41,Point B,extra_column
not_a_number,also_not,-`;
