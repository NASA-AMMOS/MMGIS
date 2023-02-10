---
layout: page
title: Utils
permalink: /apis/javascript/utils
parent: JavaScript API
grand_parent: APIs
---

# JavaScript API Utils

The `src/essence/mmgisAPI/mmgisAPI.js` file exposes functions that can be called using the global `window.mmgisAPI` object.

#### _Contents_

- [Object Manipulation](#object-manipulation)
- [String Manipulation](#string-manipulation)
- [Geo-Spatial](#geo-spatial)
- [GeoJSON](#geojson)
- [Color](#color)
- [Download](#download)
- [Misc](#misc)

---

## Object Manipulation

### `arrayAverage(array, key)`

Returns the average value of an array of numbers.  
If array is an array of objects, the optional key can be set to say which key to average.

### `arrayUnique(array)`

Returns an array without duplicates.

### `chunkArray(arr, size)`

Breaks an array in multiple arrays of some size. A 2D array is returned.

### `clone(obj)`

Deep clones an object.

### `diff(arr1, arr2)`

Returns an array of only the matching elements between two arrays.

### `getIn(obj, keyArray, notSetValue)`

Traverses an object with an array of keys. Pre-object chaining.

#### Example

```javascript
mmgisAPI.utils.getIn({ a: { b: { c: 1 } } }, "a.b.c"); // => 1
mmgisAPI.utils.getIn({ a: { b: { c: 1 } } }, "a.b.c.d", null); // => null
mmgisAPI.utils.getIn({ a: { b: { c: 1 } } }, ["a", "b", "c"]); // => 1
```

### `getKeyByValue(obj, value)`

Given an flat object, returns the first key with the specified value.

### `getMinMaxOfArray(arrayOfNumbers)`

Returns the minimum and maximum values of an array of numbers.

### `getValueByKeyCaseInsensitive(key, obj)`

Returns the value of a flat object's while matching keys case-insensitively.

### `identicalElements(arr)`

Returns true if all elements of the array are the same (empty is false).

### `isEmpty(obj)`

Returns true if the object is empty.

### `isEqual(obj1, obj2, isSimple)`

Compares two objects to see if they're equal. Setting isSimple will simply compare both object's `JSON.stringify` value.

### `noNullLength(arr)`

Returns the length of an array minus all its `null` values.

### `objectArrayIndexOfKeyWithValue(objectArray, key, value)`

Returns the index of an array of objects with a matching key-value pair (-1 if not found).

### `pad(num, size)`

Pads a number or string with leading zeros such that the returned string is of length `size`.

### `removeDuplicatesInArray(arr)`

Returns the array without duplicates.

### `removeDuplicatesInArrayOfObjects(arr)`

Returns the array of objects without duplicates. Object matching happens with `JSON.stringify`.

### `stitchArrays(keyArray, valueArray)`

Combines an array of keys and a separate corresponding array of values together into an object.

### `uniqueArray(arr)`

Returns the array without duplicates.

## String Manipulation

### `bracketReplace(str, obj)`

Shortcut method for quickly populating bracketed `{}` parameters in a string.

#### Example

```javascript
mmgisAPI.utils.bracketReplace("{a} {b}", { a: "hello", b: "world" }); // => 'hello world'
```

### `cleanString(str)`

Removes common non-alphanumeric symbols from a string.

### `fileNameFromPath(path)`

Returns the filename (minus extension) from a filepath.

#### Example

```javascript
mmgisAPI.utils.fileNameFromPath("/path/to/an/image/that/says/hello/world.png"); // => world
mmgisAPI.utils.fileNameFromPath("/path/to/an/image/that/says/hello/world"); // => world
mmgisAPI.utils.fileNameFromPath("world"); // => world
```

### `getExtension(string)`

Gets the extension of a string (without periods).

#### Example

```javascript
mmgisAPI.utils.getExtension("file.json"); // => 'json'
```

### `isStringNumeric(str)`

Returns true if `str` is a string and can be parsed to a float.

#### Example

```javascript
mmgisAPI.utils.isStringNumeric("5.4"); // => true
mmgisAPI.utils.isStringNumeric("v5.4"); // => false
mmgisAPI.utils.isStringNumeric("5.4v"); // => false
mmgisAPI.utils.isStringNumeric(5.4); // => false
```

### `isUrlAbsolute(url)`

Checks whether a given URL is absolute.

#### Example

```javascript
mmgisAPI.utils.isUrlAbsolute("file.json"); // => false
mmgisAPI.utils.isUrlAbsolute("http://file.json"); // => true
mmgisAPI.utils.isUrlAbsolute("file://file.json"); // => true
mmgisAPI.utils.isUrlAbsolute("s3-us-west-2.amazonaws.com/file.json"); // => false
mmgisAPI.utils.isUrlAbsolute("../file.json"); // => false
```

### `isValidUrl(str)`

Checks whether a given URL is valid. Uses anchor element `<a>` to perform test.

### `monthNumberToName(monthNumber)`

Given a month `[0, 11]`, returns its three character string ('Jan', 'Feb', ...)

### `numberToWords(n)`

Given a number `[0, 16]`, return its name in lowercase.

### `prettifyName(name)`

Returns the name with underscores as spaces and all word capitalized.

### `sanitize(str)`

Removes the following symbols from the string: `<, >, {, }, ;`.

### `timestampToDate(timestamp)`

Given a timestamp, returns the UTC date in the following format: `MMM dd, YYYY HH:MM:SS`

### `toEllipsisString(str, length)`

Given a string, does not let it exceed `length` and truncates and adds "..." if it does.

## Geo-Spatial

### `areaOfTriangle(aX, aY, bX, bY, cX, cY)`

Returns the 2D area of the triangle defined by the three points.

### `bearingBetweenTwoLatLngs(lat1, lng1, lat2, lng2)`

Finds the bearing/angle from the first latlng to the second. 0 is north and travels clock-wise.

#### Example

```javascript
mmgisAPI.utils.bearingBetweenTwoLatLngs(0, 0, 1, 0); // => 0
mmgisAPI.utils.bearingBetweenTwoLatLngs(0, 0, 0, 1); // => 90
```

### `boundingBoxToFeature(nE, sW)`

Turns a bounding box specified by {lat, lng} corners into a geojson feature.

#### Function parameters

- `nE` - _{lat, lng}_ pair for the northeast bounding box corner
- `sW` - _{lat, lng}_ pair for the southwest bounding box corner

### `circleFeatureFromTwoLngLats(lnglatCenter, lnglatRadius, steps, crs)`

Creates a GeoJSON circle feature based on a center point and a point on the edge.

#### Function parameters

- `lnglatCenter` - _{lng, lat}_ - the lat,lng point of the circle's center.
- `lnglatRadius` - _{lng, lat}_ - a lat,lng point on the circle's edge.
- `steps` - _number_ - number of vertices that make up the circumference.
- `crs?` - _CRS Object_ - if a crs is passed, the circle will be map-projection-based and not screen-based.

If crs is passed, circle will be map-projection-based and not screen based.

### `closestPoint(p, pts)`

Given a point p and series of points, finds the point that's closest to p. Returns a point with points.

#### Function parameters

- `p` - _{x, y}_ - source point
- `pts` - _[[[x,y], [x,y]], [[x, y]]]_ - MultiLineString

### `closestToSegment(p, v, w)`

Given a point p and two line endpoints, finds the closest position on the line of p.

#### Function parameters

- `p` - _{x, y}_
- `v` - _{x, y}_
- `w` - _{x, y}_

### `closestToSegments(p, lines)`

Like `closestToSegment()` but accepts multiple lines.
`lines` is of form: `[[[x1, y1], [x2, y2]], [[x1, y1],[x2, y2]], ... ]`

### `coordinateDepthTraversal(array, onEachLeaf)`

Iterates depth-first through a coordinates array. `onEachLeaf` provides a callback for each coordinate.

### `degreesToMeters(degrees)`

Using the currently configured major planetary radius, converts degrees to equatorial meters.

### `destinationFromBearing(lat, lng, bearing, distance, round_off)`

Given a source point, a bearing and a distance, finds the destination point.

### `distanceFormula(x1, y1, x2, y2)`

Standard distance formula between two points.

### `doBoundingBoxesIntersect(a, b)`

Returns a boolean whether two bounding boxes of the form `[minX, minY, maxX, maxY]` intersect.

### `getEarthToPlanetRatio()`

Returns `6371000 / majorRadius`. Sometimes useful when making Earth-centric code generic.

### `getFeatureArea(feature, displayFriendly)`

Given a GeoJSON feature, computes its area in meters. If `displayFriendly` is true, returns the area to a fixed decimal place and with units.

### `getFeatureLength(feature, displayFriendly)`

Given a 'LineString', 'MultiLineString' or 'Polygon' feature, computes it's length/perimeter in meters. If `displayFriendly` is true, returns the area to a fixed decimal place and with units.

### `getPtSomeDistBetween2OtherPts(x0, y0, x1, y1, d)`

Given two points, finds a point `d` distance from the first towards the seconds.

#### Example

```javascript
mmgisAPI.utils.getPtSomeDistBetween2OtherPts(0, 0, 0, 1, 0.2); // => {x: 0, y: 0.2}
```

### `inclinationBetweenTwoLatLngs(lat1, lng1, elev1, lat2, lng2, elev2)`

Computes the inclination/elevation angle between two latlngelv points. This function does not account for planetary curvature.

### `interpolatePointsPerun(p1, p2, p)`

Given two `{x: , y: }` points, return the point `p` percent from `p1` to `p2`. `p` is from 0 to 1.

#### Example

```javascript
mmgisAPI.utils.interpolatePointsPerun({ x: 0, y: 0 }, { x: 0, y: 1 }, 0.6); // => {x: 0, y: 0.6, z: 0}
```

### `lat2tileUnfloored(lat, zoom)`

Returns the mercator tile Y coordinate at that latitude and at the zoom.

### `lineOfSight1D(heightArray, observerHeight, targetHeight)`

Performs a line of sight viewshed in one dimension.

#### Function parameters

- `heightArray` - Array of elevation values, length should be >2, observer at index 0
- `observerHeight` - How many units tall is the observer. - number - default 0
- `targetHeight` - How high off the surface are we checking viewability. Leave at 0 for seeing the surface. - number - default 0

### `linearScale(domain, range, value)`

Given `domain` and `range` min-max arrays, maps `value` from the `domain` space into the `range` space.

#### Example

```javascript
mmgisAPI.utils.linearScale([-1, 1], [0, 100], 0); // => 50
```

### `lngLatDistBetween(lon1, lat1, lon2, lat2)`

Given two lnglats, returns the distance in meters between them. Uses the haversine formula.

### `lon2tileUnfloored(lon, zoom)`

Returns the mercator tile X coordinate at that longitude and at the zoom.

### `lonLatToVector3nr(lon, lat, height)`

Converts a longitude, latitude and height into 3D vector space. `nr` in the function name indicates `no radius` -- `height` is the distance from the center without the planetary radius added to it.

### `marsEarthSurfaceAreaRatio()`

Returns the ratio of Mars' to Earth's surface areas. Sometimes useful when making Earth-centric code generic.

### `metersToDegrees(meters)`

Using the currently configured major planetary radius, converts equatorial meters to degrees.

### `pointsInPoint(point, layer)`

Given a point `[lng, lat]` and a leaflet `layer`, returns all Point features in that layer with the same lng, lat value. Useful for finding overlapping points.

### `rotatePoint(pt, center, angle)`

2D rotate a point about another point a certain angle. `pt` is `{x: ,y: }`, `center` is `[x,y]` and `angle` is in radians.

### `rotatePoint3D(pt, angle, center)`

3D rotates a point about another point a certain angle. Rotates X then Z then Y.

#### Function parameters

- `pt` - Point to rotate - `{x: , y: , z: }`
- `center` - Point to rotate around - `{x: , y: , z: }` - default `{x: 0, y: 0, z: 0}`
- `angle` - Angles to rotate in radians - `{x: , y: , z: }`

### `setRadius(which, radius)`

Sets the major or minor radius in MMGIS. Use this only if you know what you're doing.

#### Function parameters

- `which` - 'major' or `minor`
- `radius` - Radius in meters

### `subdivideLine(line, meters)`

Subdivides a LineString's coordinates such that they are no more than `meters` meters apart.

### `tileContains(xyz, z, useLast)`

Given an xyz and z, gets all tiles on zoom level z that are contained in xyz. Return arrays of `[x,y,z]`s contained

#### Function parameters

- `xyz` - the tile to get the contents of - `[x,y,z]`
- `z` - the zoom level of tiles to get - number
- `useLast` - use lastTileContains. lastTileContains stores the last three calls and results to speed up performance - boolean - default false

### `tileIsContained(xyzContainer, xyzContained, useLast)`

Returns true if tile `xyzContainer` contains the tile `xyzContained`

#### Function parameters

- `xyzContainer` - `[x,y,z]`
- `xyzContained` - `[x,y,z]`
- `useLast` - use lastTileContains. lastTileContains stores the last three calls and results to speed up performance - boolean - default false

### `tilesWithin(xyz, z)`

Gets all tiles with tile xyz `{x: , y: , z:}` at zoom z.

### `toEllipse(lnglat, axes, crs, options)`

Returns an ellipse with major and minor axes and rotation about a point. Adapted from turf.js' ellipse function.

#### Function parameters

- `lnglat` - `{lng: lat:}`
- `axes` - `{x: y:}`
- `crs` - Perhaps `window.mmgisglobal.customCRS` - `{crs_object}`
- `options` - `{units: 'meters', steps: 32, angle: 0}`

## GeoJSON

### `geoJSONFeatureMetersToDegrees(feature)`

Given a GeoJSON feature defined with meter coordinates, converts them to latitude and longitude and returns the feature.

### `GeoJSONStringify(geojson)`

Turns `geojson` into a pretty print string.

### `geojsonAddSpatialProperties(geojson)`

For LineStrings and MultiLineStrings adds `properties.length2D` metadata. For Polygons adds `properties.perimeter2D` and `properties.area2D` metadata.

### `getBaseGeoJSON(featuresArray)`

Returns a generic geojson template:

```javascript
{
    type: 'FeatureCollection',
    crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features: featuresArray -- [],
}
```

### `invertGeoJSONLatLngs(feature)`

Given a feature with incorrect longitude, latitude coordinate order, swaps them.

### `sortGeoJSONFeatures(geojson)`

Sorts a GeoJSON's features such that when rendering, points draw on top of lines and lines draw on top of polygons. Ensures features are clickable.

## Color

### `getColorFromRangeByPercent(colors, percent, asRGBString)`

Gets a color along a gradient

#### Function parameters

- `colors` - Evenly spaced rgb: `[ [r,g,b], [r,g,b], [r,g,b] ]`
- `percent` - Is 0 to 1
- `asRGBSting` - If true, returns `rgb(r,g,b)` instead of `[r,g,b]`

### `hexToRGB(hex)`

Converts a hex color to rgb `{r: , g: , b: }`

### `hexToRGBA(hex, a)`

Converts a hex color and alpha to rgba `{r: , g: , b: , a: }`

### `intToRGB(i)`

Turns an integer into a hex color. `0 = #000000` and `16777215 = #FFFFFF`. (16777215 == 16^6 - 1)

### `isColor(strColor)`

Checks whether a given string is a valid css color.

### `makeColorGrid(x, y)`

Makes a grid of gradient colors x rows by y columns.

### `rgb2hex(rgb)`

Converts an `rgb()` or `rgba()` string to a hex color.

### `RGBAto32(rgba)`

Turns an rgba `{r: , g: , b: , a: }` into a float32 value by `[8 red bits][8 green bits][8 blue bits][8 alpha bits]`.

### `rgbObjToStr(rgb, hasAlpha)`

Converts an rgb or rgba object `{r: , g: , b: , a: }` into an rgb or rgba string `rgba()`.

### `rgbToArray(rgb)`

Turns an rgb or rgba string `rgba()` into an array `[r,g,b,a]`.

### `stringToColor(str)`

Given a valid color string, return a hex color.

#### Example

```javascript
mmgisAPI.utils.stringToColor("red"); // => '#91b801'
```

### `validTextColour(stringToTest)`

Returns `true` if `stringToTest` is a valid css color string.

## Download

### `copyToClipboard(text)`

Copies input to user's clipboard.

### `csvToJSON(csv)`

Converts CSV into an array of objects.

### `downloadArrayAsCSV(headers, array, exportName)`

Downloads a header and a 2D array as a CSV.

#### Function parameters

- `headers` - `['x','y','z']`
- `array` - `[[0,1,2],[3,4,5],...]`
- `exportName` - Name of file to be exported. Without `.csv` extension.

### `downloadCanvas(canvasId, name, callback)`

Given the HTML Id of a canvas element, downloads it.

### `downloadObject(exportObj, exportName, exportExt)`

Exports a JSON object. `.geojson` and `.json` `exportExt`s will attempt to pretty-print the object while keeping individual features contained to a single line.

## Misc

### `dynamicSort(property)`

Alphabetically sort an array of objects by some specific key `property`.

### `getBase64Transparent256Tile()`

Returns a 256 x 256 pixel blank png in base64.

### `getBrowser()`

Gets the user's current browser.

### `getTextShadowString(color, opacity, weight)`

Mocks a text border for use with the text-shadow css property. Weight can be no more than `2`.

### `getTimeStartsBetweenTimestamps(startTime, endTime, unit)`

Returns an array of timestamps between startTime and endTime timestamps that fall along the unit.

#### Example

```javascript
mmgisAPI.utils.getTimeStartsBetweenTimestamps(0, 10000000, "day");
/* =>
[
    { "ts": 0, "label": 1 },
    { "ts": 86400000, "label": 2 }
]
*/
```

### `isInZoomRange(minZoom, maxZoom, zoom)`

A simple function to check whether we're inside a zoom range.

### `mod(n, m)`

A mod that works with negatives. A true modulo and not just a remainder.

### `range(a, b)`

Returns an array of ints from a to b inclusively.

### `toHost()`

Returns MMGIS to the root page.

### `toHostForceLanding()`

Returns MMGIS to the root page and forces it to stay. In cases of a single mission, MMGIS would otherwise directly navigate to it.
