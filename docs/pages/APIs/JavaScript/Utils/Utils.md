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

### `bracketReplace(str, obj, replace)`

### `cleanString(str)`

### `fileNameFromPath(path)`

### `getSafeName(name)`

### `isStringNumeric(str)`

### `isUrlAbsolute(url)`

### `isValidUrl(str)`

### `monthNumberToName(monthNumber)`

### `numberToWords(n)`

### `populateUrl(url, xyz, invertY)`

### `prettifyName(name)`

### `sanitize(str)`

### `timestampToDate(timestamp)`

## Geo-Spatial

### `areaOfTriangle(aX, aY, bX, bY, cX, cY)`

Returns the area of the triangle.

### `bearingBetweenTwoLatLngs(lat1, lng1, lat2, lng2)`

### `bearingFromGreatArcDistance(distance)`

### `boundingBoxToFeature(nE, sW)`

Turns a bounding box specified by {lat, lng} corners into a geojson feature.

#### Function parameters

- `nE` - _{lat, lng}_ pair for the northeast bounding box corner
- `sW` - _{lat, lng}_ pair for the southwest bounding box corner

### `calcPolygonArea(vertices)`

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

### `destinationFromBearing(lat, lng, bearing, distance, round_off)`

Given a source point, a bearing and a distance, finds the destination point.

### `distanceFormula(x1, y1, x2, y2)`

Standard distance formula between two points.

### `doBoundingBoxesIntersect(a, b)`

Returns a boolean whether two bounding boxes of the form `[minX, minY, maxX, maxY]` intersect.

### `getEarthToPlanetRatio()`

### `getExtension(string)`

### `getFeatureArea(feature, displayFriendly)`

### `getFeatureLatLngs(feature)`

### `getFeatureLength(feature, displayFriendly)`

### `getPtSomeDistBetween2OtherPts(x0, y0, x1, y1, d)`

### `inclinationBetweenTwoLatLngs(lat1, lng1, elev1, lat2, lng2, elev2)`

### `interpolatePointsPerun(p1, p2, p)`

### `lat2tileUnfloored(lat, zoom)`

### `latlonzoomToTileCoords(lat, lon, zoom)`

### `lineOfSight1D(heightArray, observerHeight, targetHeight)`

### `linearScale(domain, range, value)`

### `lngLatDistBetween(lon1, lat1, lon2, lat2)`

### `lnglatsToDemtileElevs(lnglats, demtilesets, callback)`

### `lon2tileUnfloored(lon, zoom)`

### `lonLatToVector3nr(lon, lat, height)`

### `marsEarthSurfaceAreaRatio()`

### `metersToDegrees(meters)`

### `pointsInPoint(point, layers)`

### `rotatePoint(pt, center, angle)`

### `rotatePoint3D(pt, angle, center)`

### `setRadius(which, radius)`

### `subdivideLine(line, meters)`

### `tileContains(xyz, z, useLast)`

### `tileIsContained(xyzContainer, xyzContained, useLast)`

### `tilesWithin(xyz, z)`

### `toEllipse(lnglat, axes, crs, options)`

### `toEllipsisString(str, length)`

## GeoJSON

### `geoJSONFeatureMetersToDegrees(feature)`

### `GeoJSONStringify(geojson)`

### `geojsonAddSpatialProperties(geojson)`

### `getBaseGeoJSON(featuresArray)`

### `getLatLngs(layer)`

### `invertGeoJSONLatLngs(feature)`

### `sortGeoJSONFeatures(geojson)`

## Color

### `colorCodeToColor(code)`

### `getColorFromRangeByPercent(colors, percent, asRGBString)`

### `getColorScale(i, s, l)`

### `hexToRGB(hex)`

### `hexToRGBA(hex, a)`

### `intToRGB(i)`

### `isColor(strColor)`

### `makeColorGrid(x, y)`

### `parseColor(color)`

### `rgb2hex(rgb)`

### `RGBAto32RGBAto32(rgba)`

### `rgbObjToStr(rgb, hasAlpha)`

### `rgbToArray(rgb)`

### `stringToColor(str)`

### `stringToColor2(stringInput)`

### `validTextColour(stringToTest)`

## Misc

### `asByteString(byte)`

### `cloneCanvas(oldCanvas)`

### `decodeFloat(binary)`

### `doubleToTwoFloats(double)`

### `dynamicSort(property)`

### `enumerate(obj)`

### `f32round(x)`

### `getBase64Transparent256Tile()`

### `getBrowser()`

### `getCookieValue(a)`

### `getImageData(image)`

### `getPixel(imagedata, x, y)`

### `getTextShadowString(color, opacity, weight)`

### `getTimeStartsBetweenTimestamps(startTime, endTime, unit)`

### `isInZoomRange(minZoom, maxZoom, zoom)`

### `isNoDataElev(data)`

### `mod(n, m)`

### `range(a, b)`

### `round(number, decimals = 0)`

### `scaleImageInHalf(image, width, height)`

### `toHost()`

### `toHostForceLanding()`

## Download

### `copyToClipboard(text)`

### `csvToJSON(csv)`

### `download(filepath)`

### `downloadArrayAsCSV(headers, array, exportName)`

### `downloadCanvas(canvasId, name, callback)`

### `downloadObject(exportObj, exportName, exportExt)`
