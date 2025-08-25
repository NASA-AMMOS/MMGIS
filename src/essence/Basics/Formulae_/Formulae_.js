//Holds a bunch of reusable mathy formulas and variables
import { bbox, simplify } from '@turf/turf'
import { saveAs } from 'file-saver'
import $ from 'jquery'
import calls from '../../../pre/calls'

import azElDistBetween from './subformulae/azElDistBetween'

var temp = new Float32Array(1)

// eslint-disable-next-line no-extend-native
Object.defineProperty(Object.prototype, 'getFirst', {
    value: function () {
        return this[Object.keys(this)[0]]
    },
    writable: true,
    configurable: true,
    enumerable: false,
})

// often referred to as F_
var Formulae_ = {
    radiusOfPlanetMajor: 3396190, //(m) Defaults to Mars
    radiusOfPlanetMinor: 3396190,
    radiusOfEarth: 6371000,
    metersInOneDegree: null,
    getBaseGeoJSON: function (featuresArray) {
        return {
            type: 'FeatureCollection',
            crs: {
                type: 'name',
                properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
            },
            features: featuresArray || [],
        }
    },
    getExtension: function (string) {
        const ex = /(?:\.([^.]+))?$/.exec(string)[1]
        return ex || ''
    },
    fileNameFromPath: function (path) {
        return path.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '')
    },
    pad: function (num, size) {
        let s = '000000000000000000000000000000' + num
        return s.substr(s.length - size)
    },
    setRadius: function (which, radius) {
        if (which.toLowerCase() == 'major')
            this.radiusOfPlanetMajor = parseFloat(radius)
        else if (which.toLowerCase() == 'minor')
            this.radiusOfPlanetMinor = parseFloat(radius)
    },
    getEarthToPlanetRatio: function () {
        return this.radiusOfEarth / this.radiusOfPlanetMajor
    },
    linearScale: function (domain, range, value) {
        return (
            ((range[1] - range[0]) * (value - domain[0])) /
                (domain[1] - domain[0]) +
            range[0]
        )
    },
    isStringNumeric: function (str) {
        if (typeof str != 'string') return false
        return !isNaN(str) && !isNaN(parseFloat(str))
    },
    getBase64Transparent256Tile: function () {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABFUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB2ClDBAAAAABJRU5ErkJggg=='
    },
    monthNumberToName: function (monthNumber) {
        switch (monthNumber) {
            case 0:
                return 'Jan'
            case 1:
                return 'Feb'
            case 2:
                return 'Mar'
            case 3:
                return 'Apr'
            case 4:
                return 'May'
            case 5:
                return 'Jun'
            case 6:
                return 'Jul'
            case 7:
                return 'Aug'
            case 8:
                return 'Sep'
            case 9:
                return 'Oct'
            case 10:
                return 'Nov'
            case 11:
                return 'Dec'
            default:
                return ''
        }
    },
    addTimeZoneOffset(timestamp) {
        const date = new Date(timestamp)
        const addedOffset = new Date(
            date.getTime() + date.getTimezoneOffset() * 60000
        )
        return addedOffset
    },
    removeTimeZoneOffset(timestamp) {
        const date = new Date(timestamp)
        const removedOffset = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        )
        return removedOffset
    },
    // Returns an array of timestamps between startTime and endTime timestamps that fall along the unit
    getTimeStartsBetweenTimestamps: function (startTime, endTime, unit) {
        const timeStarts = []

        const startDate = new Date(startTime)
        const endDate = new Date(endTime)
        startDate.setUTCMilliseconds(0)
        endDate.setUTCMilliseconds(0)

        let currentDate
        switch (unit) {
            case 'decade':
                currentDate = new Date(
                    Date.UTC(Math.floor(startDate.getFullYear() / 10) * 10)
                )
                while (currentDate < endDate) {
                    currentDate.setUTCFullYear(
                        Math.floor(currentDate.getUTCFullYear() / 10) * 10 + 10
                    )
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label:
                            Math.floor(currentDate.getUTCFullYear() / 10) * 10 +
                            's',
                    })
                }

                break
            case 'year':
                currentDate = new Date(Date.UTC(startDate.getFullYear()))
                while (currentDate < endDate) {
                    currentDate.setUTCFullYear(currentDate.getUTCFullYear() + 1)
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label: currentDate.getUTCFullYear(),
                    })
                }

                break
            case 'month':
                currentDate = new Date(
                    Date.UTC(startDate.getFullYear(), startDate.getMonth())
                )
                while (currentDate < endDate) {
                    currentDate.setUTCMonth(currentDate.getUTCMonth() + 1)
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label: Formulae_.monthNumberToName(
                            currentDate.getUTCMonth()
                        ).toUpperCase(),
                    })
                }
                break
            case 'day':
                currentDate = new Date(
                    Date.UTC(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate()
                    )
                )
                while (currentDate < endDate) {
                    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label: currentDate.getUTCDate(),
                    })
                }
                break
            case 'hour':
                currentDate = new Date(
                    Date.UTC(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate(),
                        startDate.getHours()
                    )
                )
                while (currentDate < endDate) {
                    currentDate.setUTCHours(currentDate.getUTCHours() + 1)
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label: currentDate.getUTCHours(),
                    })
                }
                break
            case 'minute':
                currentDate = new Date(
                    Date.UTC(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate(),
                        startDate.getHours(),
                        startDate.getMinutes()
                    )
                )
                while (currentDate < endDate) {
                    currentDate.setUTCMinutes(currentDate.getUTCMinutes() + 1)
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label: currentDate.getUTCMinutes(),
                    })
                }
                break
            case 'second':
                currentDate = new Date(
                    Date.UTC(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate(),
                        startDate.getHours(),
                        startDate.getMinutes(),
                        startDate.getSeconds()
                    )
                )
                while (currentDate < endDate) {
                    currentDate.setUTCSeconds(currentDate.getUTCSeconds() + 1)
                    timeStarts.push({
                        ts: Date.parse(currentDate),
                        label: currentDate.getUTCSeconds(),
                    })
                }
                break
            default:
                break
        }

        return timeStarts
    },
    //Uses haversine to calculate distances over arcs
    lngLatDistBetween: function (lon1, lat1, lon2, lat2) {
        var R = this.radiusOfPlanetMajor
        var φ1 = lat1 * (Math.PI / 180)
        var φ2 = lat2 * (Math.PI / 180)
        var Δφ = (lat2 - lat1) * (Math.PI / 180)
        var Δλ = (lon2 - lon1) * (Math.PI / 180)

        var a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return R * c
    },
    metersToDegrees: function (meters) {
        return (meters / this.radiusOfPlanetMajor) * (180 / Math.PI)
    },
    degreesToMeters: function (degrees) {
        return degrees * (Math.PI / 180) * this.radiusOfPlanetMajor
    },
    simplifyGeometry: function (geometry, tolerance) {
        return simplify(geometry, { tolerance: tolerance })
    },
    //2D
    distanceFormula: function (x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    },
    //2D
    areaOfTriangle: function (aX, aY, bX, bY, cX, cY) {
        return Math.abs((aX * (bY - cY) + bX * (cY - aY) + cX * (aY - bY)) / 2)
    },
    //from point p, finds the closest point in a series of lines
    //p is point {x: X, y: y}
    //pts is an array of points [[[x, y],[x, y]]...]
    //return index of closest point in pts to p as [i,j]
    //var testPts = [[[0, 5], [1, 2], [4, 4]], [[8, 17], [7, 14]]];
    //var clP = closestPoint({x: 0, y: 2}, testPts);
    //console.log(testPts[clP[0]][clP[1]]);
    closestPoint: function (p, pts) {
        var closestI = 0
        var closestJ = 0
        var closestIDist = Infinity
        var d
        for (var i = 0; i < pts.length; i++) {
            for (var j = 0; j < pts[i].length; j++) {
                d = this.distanceFormula(p.x, p.y, pts[i][j][0], pts[i][j][1])
                if (d < closestIDist) {
                    closestI = i
                    closestJ = j
                    closestIDist = d
                }
            }
        }
        return [closestI, closestJ]
    },
    //a mod that works with negatives. a true modulo and not remainder
    mod: function (n, m, dontFloor) {
        const remain = n % m
        if (dontFloor) return remain >= 0 ? remain : remain + m
        return Math.floor(remain >= 0 ? remain : remain + m)
    },
    //2D rotate a point about another point a certain angle
    //pt is {x: ,y: }  center is [x,y]  angle in radians
    rotatePoint: function (pt, center, angle) {
        var cosAngle = Math.cos(angle)
        var sinAngle = Math.sin(angle)
        var dx = pt.x - center[0]
        var dy = pt.y - center[1]
        var newPt = {}
        newPt['x'] = center[0] + dx * cosAngle - dy * sinAngle
        newPt['y'] = center[1] + dx * sinAngle + dy * cosAngle

        return newPt
    },
    //Rotates X then Z then Y ?
    //all are of form {x: , y: , z: }
    //angle is in radians
    //if center undefined, then 0 0 0
    rotatePoint3D: function (pt, angle, center) {
        if (center == undefined) center = { x: 0, y: 0, z: 0 }
        //Offset
        var dx = pt.x - center.x
        var dy = pt.y - center.y
        var dz = pt.z - center.z

        var sx = Math.sin(angle.x)
        var cx = Math.cos(angle.x)
        var sy = Math.sin(angle.y)
        var cy = Math.cos(angle.y)
        var sz = Math.sin(angle.z)
        var cz = Math.cos(angle.z)

        var x = center.x + dx * (cy * cz) + dy * (-cy * sz) + dz * sy
        var y =
            center.y +
            dx * (cx * sz + sx * sy * cz) +
            dy * (cx * cz - sx * sy * sz) +
            dz * (-sx * cy)
        var z =
            center.z +
            dx * (sx * sz - cx * sy * cz) +
            dy * (sx * cz + cx * sy * sz) +
            dz * (cx * cy)

        return { x: x, y: y, z: z }
    },
    // From: https://github.com/nuclearsecrecy/Leaflet.greatCircle/blob/master/Leaflet.greatCircle.js#L160
    // returns destination lat/lon from a start point lat/lon of a giving bearing (degrees) and distance (km).
    destinationFromBearing: function (
        lat,
        lng,
        bearing,
        distance,
        round_off = undefined
    ) {
        var R = Formulae_.radiusOfPlanetMajor * 0.001 // km
        var d = distance
        var deg2rad = Math.PI / 180
        var rad2deg = 180 / Math.PI
        var lat1 = deg2rad * lat
        var lng1 = deg2rad * lng
        var brng = deg2rad * bearing
        //kind of a sad attempt at optimization of these costly trig functions
        var sinLat1 = Math.sin(lat1)
        var cosLat1 = Math.cos(lat1)
        var cosdR = Math.cos(d / R)
        var sindR = Math.sin(d / R)
        var lat2 = Math.asin(sinLat1 * cosdR + cosLat1 * sindR * Math.cos(brng))
        var lng2 =
            lng1 +
            Math.atan2(
                Math.sin(brng) * sindR * cosLat1,
                cosdR - sinLat1 * Math.sin(lat2)
            )

        if (typeof round_off != 'undefined') {
            return [
                Formulae_._round(rad2deg * lat2, round_off),
                Formulae_._round(rad2deg * lng2, round_off),
            ]
        } else {
            return [rad2deg * lat2, rad2deg * lng2]
        }
    },
    bearingBetweenTwoLatLngs: function (lat1, lng1, lat2, lng2) {
        lat1 *= Math.PI / 180
        lng1 *= Math.PI / 180
        lat2 *= Math.PI / 180
        lng2 *= Math.PI / 180

        var y = Math.sin(lng2 - lng1) * Math.cos(lat2)
        var x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)

        return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
    },
    inclinationBetweenTwoLatLngs: function (
        lat1,
        lng1,
        elev1,
        lat2,
        lng2,
        elev2
    ) {
        //distance between
        var x = this.lngLatDistBetween(lng1, lat1, lng2, lat2)
        //y difference in Elevation
        var y = elev2 - elev1
        var incline = Math.atan(y / x) * (180 / Math.PI)
        return incline
    },
    azElRangeToLngLatEl: function (az, el, range) {},
    //closest point on line from point
    //all of form {x: X, y: Y}
    //p point, v and w line endpoints
    //returns:
    // [closest point on line to point, closest distance from point to line]
    // as [{x: X, y: Y}, float]
    closestToSegment: function (p, v, w) {
        function dist2(v, w) {
            return Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2)
        }
        var l2 = dist2(v, w)
        if (l2 == 0) return [p, Math.sqrt(dist2(p, v))]
        var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
        t = Math.max(0, Math.min(1, t))
        var ptLine = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }
        return [ptLine, Math.sqrt(dist2(p, ptLine))]
    },
    //lines of form [[[x1, y1], [x2, y2]], [[x1, y1],[x2, y2]], ... ]
    //returns only point {x: X, y: Y}
    closestToSegments: function (p, lines) {
        var shortestDist = Infinity
        var nearestPoint = { x: 0, y: 0 }
        var v
        var w
        var cts
        for (var pg = 0; pg < lines.length; pg++) {
            for (var i = 0; i < lines[pg].length; i++) {
                v = { x: lines[pg][i][0][0], y: lines[pg][i][0][1] }
                w = { x: lines[pg][i][1][0], y: lines[pg][i][1][1] }
                cts = this.closestToSegment(p, v, w)
                if (cts[1] < shortestDist) {
                    shortestDist = cts[1]
                    nearestPoint = cts[0]
                }
            }
        }
        return nearestPoint
    },
    // If crs is passed, circle will be map-projection-based and not screen based
    circleFeatureFromTwoLngLats: function (
        lnglatCenter,
        lnglatRadius,
        steps,
        crs
    ) {
        const coordinates = []
        let radialLngLat = lnglatRadius
        let centerLngLat = lnglatCenter

        if (crs) {
            radialLngLat = crs.project(radialLngLat)
            radialLngLat = { lng: radialLngLat.x, lat: radialLngLat.y }
            centerLngLat = crs.project(centerLngLat)
            centerLngLat = { lng: centerLngLat.x, lat: centerLngLat.y }
        }

        const radialPt = { x: radialLngLat.lng, y: radialLngLat.lat }
        const centerPt = [centerLngLat.lng, centerLngLat.lat]

        for (let i = 0; i < steps; i++) {
            let pt = Formulae_.rotatePoint(
                radialPt,
                centerPt,
                i * (360 / steps) * (Math.PI / 180)
            )
            if (crs) {
                pt = crs.unproject(pt)
                pt = { x: pt.lng, y: pt.lat }
            }
            coordinates.push([pt.x, pt.y])
        }
        coordinates.push(coordinates[0])

        return {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates],
            },
        }
    },
    parseColor: function (color) {
        if (Formulae_.isColor(color) || color == null) return color
        return Formulae_.stringToColor(color)
    },
    isColor: function (strColor) {
        let s = new Option().style
        s.color = strColor
        const is = s.color !== ''
        s = undefined
        return is
    },
    // See https://stackoverflow.com/a/16348977
    stringToColor: function (str) {
        var hash = 0
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        var colour = '#'
        for (var i = 0; i < 3; i++) {
            var value = (hash >> (i * 8)) & 0xff
            colour += ('00' + value.toString(16)).substr(-2)
        }
        return colour
    },
    /**
     *
     * @param {String} - stringInput - 'xyz'
     * @returns {String} - color in hex color code - '#ae6204'
     */
    stringToColor2: function (stringInput) {
        const h = [...stringInput].reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc)
        }, 0)
        const s = 93,
            l = 40 / 100
        const a = (s * Math.min(l, 1 - l)) / 100
        const f = (n) => {
            const k = (n + h / 30) % 12
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
            return Math.round(255 * color)
                .toString(16)
                .padStart(2, '0') // convert to Hex and prefix "0" if needed
        }
        return `#${f(0)}${f(8)}${f(4)}`
    },
    intToRGB: function (i) {
        var c = (i & 0x00ffffff).toString(16).toUpperCase()

        return '#000000'.substring(0, 7 - c.length) + c
    },
    rgbObjToStr: function (rgb, hasAlpha) {
        if (hasAlpha && rgb.a != null)
            // prettier-ignore
            return 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + rgb.a + ')'
        return 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'
    },
    rgb2hex: function (rgb) {
        if (rgb.search('rgb') == -1) {
            return rgb
        } else {
            rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/)
            function hex(x) {
                return ('0' + parseInt(x).toString(16)).slice(-2)
            }
            return '#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3])
        }
    },
    //From: http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb Tim Down
    hexToRGB: function (hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b
        })

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : null
    },
    hexToRGBA: function (hex, a) {
        const rgb = Formulae_.hexToRGB(hex)
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
    },
    rgbToArray: function (rgb) {
        return rgb.match(/\d+/g)
    },
    //From: http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#ECMAScript_.28JavaScript.2FActionScript.2C_etc..29
    lon2tileUnfloored: function (lon, zoom) {
        return ((lon + 180) / 360) * Math.pow(2, zoom)
    },
    lat2tileUnfloored: function (lat, zoom) {
        return (
            ((1 -
                Math.log(
                    Math.tan((lat * Math.PI) / 180) +
                        1 / Math.cos((lat * Math.PI) / 180)
                ) /
                    Math.PI) /
                2) *
            Math.pow(2, zoom)
        )
    },
    //no radius
    lonLatToVector3nr: function (lon, lat, height) {
        var phi = lat * (Math.PI / 180)
        var theta = (lon - 180) * (Math.PI / 180)

        var x = height * Math.cos(phi) * Math.sin(theta)
        var y = -height * Math.sin(phi)
        var z = -height * Math.cos(phi) * Math.cos(theta)

        return { x: x, y: y, z: z }
    },
    getSafeName: function (name) {
        return ('UUID' + (name || '').replace(/\s/g, '')).toLowerCase()
    },
    /**
     * Traverses an object with an array of keys
     * @param {*} obj
     * @param {*} keyArray
     */
    getIn: function (obj, keyArray, notSetValue) {
        // eslint-disable-next-line no-eq-null, eqeqeq
        if (obj == null) return notSetValue != null ? notSetValue : null
        // eslint-disable-next-line no-eq-null, eqeqeq
        if (keyArray == null) return notSetValue != null ? notSetValue : null
        if (typeof keyArray === 'string') keyArray = keyArray.split('.')
        let object = Object.assign({}, obj)
        for (let i = 0; i < keyArray.length; i++)
            // eslint-disable-next-line no-prototype-builtins,no-eq-null, eqeqeq
            if (object != null && object.hasOwnProperty(keyArray[i]))
                object = object[keyArray[i]]
            // eslint-disable-next-line no-eq-null, eqeqeq
            else return notSetValue != null ? notSetValue : null

        return object
    },
    getKeyByValue: function (obj, value) {
        return Object.keys(obj).filter(function (key) {
            return obj[key] === value
        })[0]
    },
    getValueByKeyCaseInsensitive: function (key, obj) {
        key = (key + '').toLowerCase()
        for (var p in obj) {
            if (obj.hasOwnProperty(p) && key == (p + '').toLowerCase()) {
                return obj[p]
            }
        }
    },
    removeDuplicatesInArrayOfObjects(arr) {
        let stringedArr = arr
        stringedArr.forEach((el, i) => {
            stringedArr[i] = JSON.stringify(el)
        })
        let uniqueArr = []
        for (let i = stringedArr.length - 1; i >= 0; i--) {
            if (uniqueArr.indexOf(stringedArr[i]) == -1)
                uniqueArr.push(stringedArr[i])
        }
        uniqueArr.forEach((el, i) => {
            uniqueArr[i] = JSON.parse(el)
        })
        return uniqueArr
    },
    removeDuplicatesInArray(arr) {
        arr = arr.filter((c, index) => {
            return arr.indexOf(c) === index
        })

        return arr
    },
    //Get index of array of objects with key value pair (-1 if not found)
    objectArrayIndexOfKeyWithValue(objectArray, key, value) {
        var index = -1
        for (let i in objectArray) {
            if (objectArray[i]) {
                if (
                    objectArray[i].hasOwnProperty(key) &&
                    objectArray[i][key] === value
                ) {
                    index = i
                    break
                }
            }
        }
        return index
    },
    // Simple function to check whether we're inside a zoom range
    isInZoomRange(minZoom, maxZoom, zoom) {
        if (minZoom != null || maxZoom != null) {
            minZoom = minZoom || 0
            maxZoom = maxZoom || Infinity
            if (zoom >= minZoom && zoom <= maxZoom) return true
            else return false
        }
        return true
    },
    //Returns the line with points no greater than meters apart
    subdivideLine(line, meters) {
        let subdividedLine = []
        for (var i = 0; i < line.length; i++) {
            subdividedLine.push([line[i][0], line[i][1]])
            if (i != line.length - 1) {
                var length = Formulae_.lngLatDistBetween(
                    line[i][0],
                    line[i][1],
                    line[i + 1][0],
                    line[i + 1][1]
                )
                var spacing = meters / length
                for (var s = spacing; s < 1; s += spacing) {
                    var newPt = Formulae_.interpolatePointsPerun(
                        { x: line[i][0], y: line[i][1] },
                        { x: line[i + 1][0], y: line[i + 1][1] },
                        s
                    )
                    subdividedLine.push([newPt.x, newPt.y])
                }
            }
        }
        return subdividedLine
    },
    //Return a clone of the object to avoid pass by reference issues
    clone: function (obj) {
        var copy
        // Handle the 3 simple types, and null or undefined
        if (null == obj || 'object' != typeof obj) return obj

        // Handle Date
        if (obj instanceof Date) {
            copy = new Date()
            copy.setTime(obj.getTime())
            return copy
        }

        // Handle Array
        if (obj instanceof Array) {
            copy = []
            for (var i = 0, len = obj.length; i < len; i++) {
                copy[i] = this.clone(obj[i])
            }
            return copy
        }

        // Handle Object
        if (obj instanceof Object) {
            copy = {}
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) copy[attr] = this.clone(obj[attr])
            }
            return copy
        }
        throw new Error("Unable to copy obj! Its type isn't supported.")
    },
    //Returns an array of ints from a to b inclusively
    range: function (a, b) {
        a = b - a + 1
        var c = []
        while (a--) c[a] = b--
        return c
    },
    //simple and only works from 0 to 16
    numberToWords: function (n) {
        switch (n) {
            case 0:
                return 'zero'
            case 1:
                return 'one'
            case 2:
                return 'two'
            case 3:
                return 'three'
            case 4:
                return 'four'
            case 5:
                return 'five'
            case 6:
                return 'six'
            case 7:
                return 'seven'
            case 8:
                return 'eight'
            case 9:
                return 'nine'
            case 10:
                return 'ten'
            case 11:
                return 'eleven'
            case 12:
                return 'twelve'
            case 13:
                return 'thirteen'
            case 14:
                return 'fourteen'
            case 15:
                return 'fifteen'
            case 16:
                return 'sixteen'
        }
        return 'zero'
    },
    isUrlAbsolute: function (url) {
        const r = new RegExp('^(?:[a-z]+:)?//', 'i')
        return r.test(url)
    },
    csvToJSON: function (csv) {
        if (csv == null) return {}
        
        // Ensure csv is a string
        if (typeof csv !== 'string') {
            return {}
        }

        var lines = csv.split('\n')
        lines = lines.filter(i => i.length > 0)

        var result = []

        if (lines == null || lines[0] == null) return {}

        var headers = lines[0].split(',')
        for (var i = 1; i < lines.length; i++) {
            var obj = {}
            var currentline = lines[i].split(',')
            for (var j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j]
            }
            result.push(obj)
        }
        return JSON.parse(JSON.stringify(result).replace(/\\r/g, ''))
    },
    latlonzoomToTileCoords: function (lat, lon, zoom) {
        var xtile = parseInt(Math.floor(((lon + 180) / 360) * (1 << zoom)))
        var ytile = parseInt(
            Math.floor(
                ((1 -
                    Math.log(
                        Math.tan(lat * (Math.PI / 180)) +
                            1 / Math.cos(lat * (Math.PI / 180))
                    ) /
                        Math.PI) /
                    2) *
                    (1 << zoom)
            )
        )
        return {
            x: xtile,
            y: ytile,
            z: zoom,
        }
    },
    noNullLength: function (arr) {
        let len = 0
        for (let i = 0; i < arr.length; i++) if (arr[i] != null) len++
        return len
    },
    isEmpty: function (obj) {
        if (obj === undefined) return true
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) return false
        }
        return JSON.stringify(obj) === JSON.stringify({})
    },
    //Returns true if all elements of the array are the same (empty is false)
    identicalElements(arr) {
        if (arr.length === 0) return false
        var elm = arr[0]
        for (var i = 0; i < arr.length; i++) {
            if (elm !== arr[i]) return false
        }
        return true
    },
    cleanString(str) {
        return str.replace(/[`~!@#$%^&*|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '')
    },
    colorCodes: ['K', 'W', 'C', 'L', 'Y', 'O', 'M', 'R', 'B', 'DO'],
    colorCodeToColor(code) {
        code = code || 'n/a'
        switch (code.toLowerCase()) {
            case 'k':
                return '#000000'
            case 'w':
                return '#ffffff'
            case 'c':
                return '#00ffff'
            case 'l':
                return '#00ff00'
            case 'y':
                return '#ffff00'
            case 'o':
                return '#ffa500'
            case 'm':
                return '#ff00ff'
            case 'r':
                return '#ff0000'
            case 'b':
                return '#654321'
            case 'do':
                return '#ffffff'
            default:
                return '#ffffff'
        }
    },
    getIn4Layers: function (obj, keyArray, notSetValue, assumeLayerHierarchy) {
        if (obj == null) return notSetValue != null ? notSetValue : null
        if (keyArray == null) return notSetValue != null ? notSetValue : null
        if (typeof keyArray === 'string') keyArray = keyArray.split('.')
        let object = Object.assign({}, obj)
        console.log(object, keyArray)
        for (let i = 0; i < keyArray.length; i++) {
            if (object && object.hasOwnProperty(keyArray[i]))
                object = object[keyArray[i]]
            else if (
                assumeLayerHierarchy &&
                object &&
                Formulae_.objectArrayIndexOfKeyWithValue(
                    object,
                    'name',
                    keyArray[i]
                ) >= 0
            )
                object =
                    object[
                        Formulae_.objectArrayIndexOfKeyWithValue(
                            object,
                            'name',
                            keyArray[i]
                        )
                    ]
            else return notSetValue != null ? notSetValue : null
        }
        return object
    },
    objectArrayIndexOfKeyWithValue: function (objectArray, key, value) {
        var index = -1
        for (let i in objectArray) {
            if (objectArray[i]) {
                if (
                    objectArray[i].hasOwnProperty(key) &&
                    objectArray[i][key] === value
                ) {
                    index = i
                    break
                }
            }
        }
        return index
    },
    setIn4Layers: function (
        obj,
        keyArray,
        value,
        splice,
        assumeLayerHierarchy
    ) {
        if (keyArray == null || keyArray === []) return false
        if (typeof keyArray === 'string') keyArray = keyArray.split('.')
        let object = obj
        for (let i = 0; i < keyArray.length - 1; i++) {
            if (object.hasOwnProperty(keyArray[i])) object = object[keyArray[i]]
            else if (
                assumeLayerHierarchy &&
                Formulae_.objectArrayIndexOfKeyWithValue(
                    object,
                    'name',
                    keyArray[i]
                ) >= 0
            )
                object =
                    object[
                        Formulae_.objectArrayIndexOfKeyWithValue(
                            object,
                            'name',
                            keyArray[i]
                        )
                    ]
            else return false
        }
        const finalKey = keyArray[keyArray.length - 1]

        if (splice && !isNaN(finalKey) && typeof object.splice === 'function')
            object.splice(parseInt(finalKey), 0, value)
        else object[keyArray[keyArray.length - 1]] = value
        return true
    },
    traverseLayers: function (layers, onLayer) {
        depthTraversal(layers, 0, [])
        function depthTraversal(node, depth, path) {
            for (var i = 0; i < node.length; i++) {
                const ret = onLayer(node[i], path, i)

                if (ret === 'remove') {
                    node.splice(i, 1)
                    i--
                }
                //Add other feature information while we're at it
                else if (
                    node[i] &&
                    node[i].sublayers != null &&
                    node[i].sublayers.length > 0
                ) {
                    depthTraversal(
                        node[i].sublayers,
                        depth + 1,
                        `${path.length > 0 ? path + '.' : ''}${node[i].name}`
                    )
                }
            }
        }
    },
    invertGeoJSONLatLngs(feature) {
        let geojson = this.clone(feature)
        var coords = geojson.geometry.coordinates

        if (coords.constructor === Array && coords[0].constructor !== Array) {
            var newCoords = Object.assign([], coords)
            coords[0] = newCoords[1]
            coords[1] = newCoords[0]
        } else {
            for (var i = 0; i < coords.length; i++) {
                if (coords[i][0].constructor === Array) {
                    for (var j = 0; j < coords[i].length; j++) {
                        if (coords[i][j][0].constructor === Array) {
                            for (var k = 0; k < coords[i][j].length; k++) {
                                if (coords[i][j][k][0].constructor === Array) {
                                    for (
                                        var l = 0;
                                        l < coords[i][j][k].length;
                                        l++
                                    ) {
                                        if (
                                            coords[i][j][k][0].constructor ===
                                            Array
                                        ) {
                                            for (
                                                var m = 0;
                                                m < coords[i][j][k][l].length;
                                                m++
                                            ) {
                                                if (
                                                    coords[i][j][k][l][0]
                                                        .constructor === Array
                                                ) {
                                                    console.log(
                                                        'Lazy depth traversal failed'
                                                    )
                                                } else {
                                                    var newCoords =
                                                        Object.assign(
                                                            [],
                                                            coords[i][j][k][l][
                                                                m
                                                            ]
                                                        )
                                                    var swap = newCoords[0]
                                                    newCoords[0] = newCoords[1]
                                                    newCoords[1] = swap
                                                    coords[i][j][k][l][m] =
                                                        newCoords
                                                }
                                            }
                                        } else {
                                            var newCoords = Object.assign(
                                                [],
                                                coords[i][j][k][l]
                                            )
                                            var swap = newCoords[0]
                                            newCoords[0] = newCoords[1]
                                            newCoords[1] = swap
                                            coords[i][j][k][l] = newCoords
                                        }
                                    }
                                } else {
                                    var newCoords = Object.assign(
                                        [],
                                        coords[i][j][k]
                                    )
                                    var swap = newCoords[0]
                                    newCoords[0] = newCoords[1]
                                    newCoords[1] = swap
                                    coords[i][j][k] = newCoords
                                }
                            }
                        } else {
                            var newCoords = Object.assign([], coords[i][j])
                            var swap = newCoords[0]
                            newCoords[0] = newCoords[1]
                            newCoords[1] = swap
                            coords[i][j] = newCoords
                        }
                    }
                } else {
                    var newCoords = Object.assign([], coords[i])
                    var swap = newCoords[0]
                    newCoords[0] = newCoords[1]
                    newCoords[1] = swap
                    coords[i] = newCoords
                }
            }
        }

        geojson.geometry.coordinates = coords
        return geojson
    },
    //By geometry type: polygon -> multilinestring -> point
    sortGeoJSONFeatures(geojson) {
        var featuresKey
        if (geojson.hasOwnProperty('features')) featuresKey = 'features'
        else if (geojson.hasOwnProperty('Features')) featuresKey = 'Features'
        else return

        var oldFeatures = geojson[featuresKey]
        var newFeatures = []

        var sortOrder = [
            'multipolygon',
            'polygon',
            'multilinestring',
            'linestring',
            'multipoint',
            'point',
        ]

        for (var i = 0; i < sortOrder.length; i++) {
            for (var j = 0; j < oldFeatures.length; j++) {
                if (
                    oldFeatures[j].geometry.type
                        .toLowerCase()
                        .includes(sortOrder[i])
                ) {
                    newFeatures.push(oldFeatures[j])
                }
            }
        }
        geojson.features = newFeatures
        delete geojson.Features
        //no return as pass by reference
    },
    geoJSONFeatureMetersToDegrees(feature) {
        switch (feature.geometry.type.toLowerCase()) {
            case 'point':
                feature.geometry.coordinates[0] =
                    (feature.geometry.coordinates[0] * (180 / Math.PI)) /
                    this.radiusOfPlanetMajor
                feature.geometry.coordinates[1] =
                    (feature.geometry.coordinates[1] * (180 / Math.PI)) /
                    this.radiusOfPlanetMajor
                break
            case 'linestring':
                for (var i = 0; i < feature.geometry.coordinates.length; i++) {
                    feature.geometry.coordinates[i][0] =
                        (feature.geometry.coordinates[i][0] * (180 / Math.PI)) /
                        this.radiusOfPlanetMajor
                    feature.geometry.coordinates[i][1] =
                        (feature.geometry.coordinates[i][1] * (180 / Math.PI)) /
                        this.radiusOfPlanetMajor
                }
                break
            case 'polygon':
            case 'multilinestring':
                for (var i = 0; i < feature.geometry.coordinates.length; i++) {
                    for (
                        var j = 0;
                        j < feature.geometry.coordinates[i].length;
                        j++
                    ) {
                        feature.geometry.coordinates[i][j][0] =
                            (feature.geometry.coordinates[i][j][0] *
                                (180 / Math.PI)) /
                            this.radiusOfPlanetMajor
                        feature.geometry.coordinates[i][j][1] =
                            (feature.geometry.coordinates[i][j][1] *
                                (180 / Math.PI)) /
                            this.radiusOfPlanetMajor
                    }
                }
                break
            case 'multipolygon':
                for (var i = 0; i < feature.geometry.coordinates.length; i++) {
                    for (
                        var j = 0;
                        j < feature.geometry.coordinates[i].length;
                        j++
                    ) {
                        for (
                            var k = 0;
                            k < feature.geometry.coordinates[i][j].length;
                            k++
                        ) {
                            feature.geometry.coordinates[i][j][k][0] =
                                (feature.geometry.coordinates[i][j][k][0] *
                                    (180 / Math.PI)) /
                                this.radiusOfPlanetMajor
                            feature.geometry.coordinates[i][j][k][1] =
                                (feature.geometry.coordinates[i][j][k][1] *
                                    (180 / Math.PI)) /
                                this.radiusOfPlanetMajor
                        }
                    }
                }
                break
            default:
        }
        return feature
    },
    lnglatsToDemtileElevs(lnglats, demtilesets, callback) {
        $.ajax({
            type: calls.lnglatsToDemtileElevs.type,
            url: calls.lnglatsToDemtileElevs.url,
            data: {
                lnglats: JSON.stringify(lnglats),
                demtilesets: JSON.stringify(demtilesets),
            },
            success: function (data) {
                if (typeof callback == 'function') callback(JSON.parse(data))
            },
        })
    },
    marsEarthSurfaceAreaRatio() {
        return (
            (4 * Math.PI * Math.pow(this.radiusOfPlanetMajor, 2)) /
            (4 * Math.PI * Math.pow(6378137, 2))
        )
    },
    //Current only supports a single feature: {type:"feature", ...}
    getFeatureLength(feature, displayFriendly) {
        let g = feature.geometry.coordinates
        let length2D = 0

        switch (feature.geometry.type.toLowerCase()) {
            case 'linestring':
                for (let i = 1; i < g.length; i++) {
                    length2D += this.lngLatDistBetween(
                        g[i - 1][0],
                        g[i - 1][1],
                        g[i][0],
                        g[i][1]
                    )
                }
                break
            case 'polygon':
            case 'multilinestring':
                g = g[0]
                for (let i = 1; i < g.length; i++) {
                    length2D += this.lngLatDistBetween(
                        g[i - 1][0],
                        g[i - 1][1],
                        g[i][0],
                        g[i][1]
                    )
                }
                break
            default:
        }

        if (displayFriendly) {
            if (length2D > 1000) length2D = `${(length2D / 1000).toFixed(3)} km`
            else length2D = `${length2D.toFixed(2)} m`
        }
        return length2D
    },
    geojsonAddSpatialProperties(geojson) {
        switch (geojson.geometry.type.toLowerCase()) {
            case 'linestring':
            case 'multilinestring':
                geojson.properties.length2D = this.getFeatureLength(geojson)
                break
            case 'polygon':
                geojson.properties.perimeter2D = this.getFeatureLength(geojson)
                geojson.properties.area2D = this.getFeatureArea(geojson)
                break
            default:
        }
        return geojson
    },
    /**
     * Function to sort alphabetically an array of objects by some specific key.
     *
     * @param {String} property Key of the object to sort.
     */
    dynamicSort(property) {
        var sortOrder = 1

        if (property[0] === '-') {
            sortOrder = -1
            property = property.substr(1)
        }

        return function (a, b) {
            if (sortOrder == -1) {
                return b[property].localeCompare(a[property])
            } else {
                return a[property].localeCompare(b[property])
            }
        }
    },
    //colors are evenly spaced rgb: [ [r,g,b], [r,g,b], [r,g,b] ]
    //percent is 0 to 1
    getColorFromRangeByPercent(colors, percent, asRGBString) {
        if (percent > 1 || percent < 0 || colors.length < 2) return colors[0]
        else if (percent == 1) {
            var c = colors[colors.length - 1]
            if (asRGBString)
                return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
            return c
        }

        //Find the two colors the percent will fall into
        var startIndex = parseInt((colors.length - 1) * percent)
        if (startIndex > colors.length - 1) startIndex = 0
        var color1 = colors[startIndex]
        var color2 = colors[startIndex + 1]
        var min = startIndex / (colors.length - 1)
        var max = (startIndex + 1) / (colors.length - 1)
        var ratio = (percent - min) / (max - min)

        var r = Math.ceil(color2[0] * ratio + color1[0] * (1 - ratio))
        var g = Math.ceil(color2[1] * ratio + color1[1] * (1 - ratio))
        var b = Math.ceil(color2[2] * ratio + color1[2] * (1 - ratio))

        if (asRGBString) return 'rgb(' + r + ',' + g + ',' + b + ')'
        return [r, g, b]
    },
    interpolatePointsPerun(p1, p2, p) {
        return {
            x: p1.x + p * (p2.x - p1.x),
            y: p1.y + p * (p2.y - p1.y),
            z: p1.z && p2.z ? p1.z + p * (p2.z - p1.z) : 0,
        }
    },
    //https://github.com/mapbox/geojson-area/blob/master/index.js
    getFeatureArea(feature, displayFriendly) {
        const g = feature.geometry
        return geometry(g)

        function geometry(_) {
            var area = 0,
                i
            switch (_.type) {
                case 'Polygon':
                    area = polygonArea(_.coordinates)
                    break
                case 'MultiPolygon':
                    for (i = 0; i < _.coordinates.length; i++) {
                        area += polygonArea(_.coordinates[i])
                    }
                    break
                case 'Point':
                case 'MultiPoint':
                case 'LineString':
                case 'MultiLineString':
                    break
                case 'GeometryCollection':
                    for (i = 0; i < _.geometries.length; i++) {
                        area += geometry(_.geometries[i])
                    }
                    break
                default:
            }
            if (displayFriendly) {
                if (area > 1000000) area = `${(area / 1000000).toFixed(3)} km²`
                else area = `${area.toFixed(2)} m²`
            }
            return area
        }
        function polygonArea(coords) {
            var area = 0
            if (coords && coords.length > 0) {
                area += Math.abs(ringArea(coords[0]))
                for (var i = 1; i < coords.length; i++) {
                    area -= Math.abs(ringArea(coords[i]))
                }
            }
            return area
        }
        function ringArea(coords) {
            coords = Object.assign([], coords)
            for (var c = 0; c < coords.length; c++) {
                coords[c] = [coords[c][0], coords[c][1]]
            }

            var p1,
                p2,
                p3,
                lowerIndex,
                middleIndex,
                upperIndex,
                i,
                area = 0,
                coordsLength = coords.length
            if (coordsLength > 2) {
                for (i = 0; i < coordsLength; i++) {
                    if (i === coordsLength - 2) {
                        // i = N-2
                        lowerIndex = coordsLength - 2
                        middleIndex = coordsLength - 1
                        upperIndex = 0
                    } else if (i === coordsLength - 1) {
                        // i = N-1
                        lowerIndex = coordsLength - 1
                        middleIndex = 0
                        upperIndex = 1
                    } else {
                        // i = 0 to N-3
                        lowerIndex = i
                        middleIndex = i + 1
                        upperIndex = i + 2
                    }
                    p1 = coords[lowerIndex]
                    p2 = coords[middleIndex]
                    p3 = coords[upperIndex]
                    area += (rad(p3[0]) - rad(p1[0])) * Math.sin(rad(p2[1]))
                }
                area = (area * Math.pow(Formulae_.radiusOfPlanetMajor, 2)) / 2
            }

            return area
        }

        function rad(_) {
            return (_ * Math.PI) / 180
        }
    },
    //if array is an array of objects,
    // the optional key can be set to say which key to average
    arrayAverage(array, key) {
        var total = 0
        for (var i = 0; i < array.length; i++) {
            if (key != null) total += array[i][key]
            else total += array[i]
        }
        return total / array.length
    },
    toEllipsisString(str, length) {
        return str.length > length ? str.substr(0, length - 3) + '...' : str
    },
    GeoJSONStringify(geojson) {
        var featuresKey
        if (geojson.hasOwnProperty('features')) featuresKey = 'features'
        else if (geojson.hasOwnProperty('Features')) featuresKey = 'Features'
        else return

        var savedFeatures = Object.assign([], geojson[featuresKey])
        delete geojson[featuresKey]
        var string = JSON.stringify(geojson)
        var featuresString = ''
        for (var i = 0; i < savedFeatures.length; i++) {
            if (i != 0) {
                featuresString += '\n,'
                savedFeatures[i].properties['boundingbox'] = bbox(
                    savedFeatures[i]
                )
            }
            featuresString += JSON.stringify(savedFeatures[i])
        }
        string = string.substring(0, string.length - 1)
        string += ',"features":[' + featuresString
        string += ']}'
        return string
    },
    // https://github.com/mapbox/simplestyle-spec
    geoJSONForceSimpleStyleSpec(
        geojson,
        stringifyPropertyObjects,
        defaultStyle,
        useKeyAsName
    ) {
        const defStyle = defaultStyle
            ? JSON.parse(JSON.stringify(defaultStyle))
            : {}

        const g = JSON.parse(JSON.stringify(geojson))
        g.features.forEach((f) => {
            let pstyle = f.properties.style || {}

            if (useKeyAsName && f.properties[useKeyAsName] != null) {
                if (typeof f.properties[useKeyAsName] === 'number')
                    f.properties[useKeyAsName] = `${f.properties[useKeyAsName]}`
            }

            if (f.geometry.type.toLowerCase() === 'point') {
                if (pstyle.fillColor != null)
                    f.properties['marker-color'] = pstyle.fillColor
                else if (defStyle.fillColor != null)
                    f.properties['marker-color'] = defStyle.fillColor
            }
            // style.color -> stroke
            if (pstyle.color != null) f.properties['stroke'] = pstyle.color
            else if (defStyle.color != null)
                f.properties['stroke'] = defStyle.color
            // style.opacity -> stroke-opacity
            if (pstyle.opacity != null)
                f.properties['stroke-opacity'] = pstyle.opacity
            if (defStyle.opacity != null)
                f.properties['stroke-opacity'] = defStyle.opacity
            // style.weight -> stroke-width
            if (pstyle.weight != null)
                f.properties['stroke-width'] = pstyle.weight
            if (defStyle.weight != null)
                f.properties['stroke-width'] = defStyle.weight
            // style.fillColor -> fill
            if (pstyle.fillColor != null)
                f.properties['fill'] = pstyle.fillColor
            if (defStyle.fillColor != null)
                f.properties['fill'] = defStyle.fillColor
            // style.fillOpacity -> fill-opacity
            if (pstyle.fillOpacity != null)
                f.properties['fill-opacity'] = pstyle.fillOpacity
            if (defStyle.fillOpacity != null)
                f.properties['fill-opacity'] = defStyle.fillOpacity

            if (stringifyPropertyObjects)
                Object.keys(f.properties).forEach((p) => {
                    const val = f.properties[p]
                    if (
                        typeof val === 'object' &&
                        !Array.isArray(val) &&
                        val !== null
                    ) {
                        let str = JSON.stringify(val).replaceAll(`"`, '')
                        f.properties[p] = str.substring(1, str.length - 1)
                    }
                })
        })
        return g
    },
    parseIntoGeoJSON(data) {
        let d
        // []
        if (Array.isArray(data) && data.length === 0) {
            d = { type: 'FeatureCollection', features: [] }
        }
        // [<FeatureCollection>]
        else if (
            Array.isArray(data) &&
            data[0] &&
            data[0].type === 'FeatureCollection'
        ) {
            const nextData = { type: 'FeatureCollection', features: [] }
            data.forEach((fc) => {
                if (fc.type === 'FeatureCollection')
                    nextData.features = nextData.features.concat(fc.features)
            })
            d = nextData
        }

        return d == null ? data : d
    },
    // Gets all tiles with tile xyz at zoom z
    tilesWithin(xyz, z) {
        let tiles = []

        const dif = z - xyz.z

        const difDim = Math.pow(2, dif)

        if (dif == 0) {
            tiles.push(xyz)
        } else if (dif > 0) {
            let topLeft = { x: xyz.x * difDim, y: xyz.y * difDim, z: z }
            for (let j = 0; j < difDim; j++) {
                for (let i = 0; i < difDim; i++) {
                    tiles.push({
                        x: topLeft.x + i,
                        y: topLeft.y + j,
                        z: z,
                    })
                }
            }
        }

        return tiles
    },
    /**
     * Given an xyz and z, gets all tiles on zoom level z that are contained in xyz
     * @param {[x,y,z]} xyz - the tile to get the contents of
     * @param {number} z - the zoom level of tiles to get
     * @param {boolean} useLast - use lastTileContains
     * return arrays of [x,y,z]s contained
     */
    //For use with tileContains. Stores last three calls and results to speed up performance
    lastTileContains: [],
    tileContains(xyz, z, useLast) {
        if (useLast) {
            for (var i = 0; i < this.lastTileContains.length; i++) {
                var lastxyz = this.lastTileContains[i].call.xyz
                if (
                    lastxyz[0] == xyz[0] &&
                    lastxyz[1] == xyz[1] &&
                    lastxyz[2] == xyz[2] &&
                    this.lastTileContains[i].call.z == z
                ) {
                    return this.lastTileContains[i].result
                }
            }
        }
        var contained = []
        const zoomRatio = Math.pow(2, z) / Math.pow(2, xyz[2])
        const max = [(xyz[0] + 1) * zoomRatio - 1, (xyz[1] + 1) * zoomRatio - 1]
        const min = [max[0] - zoomRatio + 1, max[1] - zoomRatio + 1]
        for (var x = min[0]; x <= max[0]; x++) {
            for (var y = min[1]; y <= max[1]; y++) {
                contained.push([x, y, z])
            }
        }
        this.lastTileContains.unshift({
            call: { xyz: xyz, z: z },
            result: contained,
        })
        if (this.lastTileContains.length > 3) this.lastTileContains.pop()
        return contained
    },
    /**
     * Returns true if tile xyzContainer contains the tile xyzContained
     * @param {[x,y,z]} xyzContainer
     * @param {[x,y,z]} xyzContained
     * return bool
     */
    tileIsContained(xyzContainer, xyzContained, useLast) {
        var contains = this.tileContains(xyzContainer, xyzContained[2], useLast)
        for (var i = 0; i < contains.length; i++) {
            if (
                contains[i][0] == xyzContained[0] &&
                contains[i][1] == xyzContained[1]
            )
                return true
        }
        return false
    },
    arrayUnique(array) {
        var a = array.concat()
        for (var i = 0; i < a.length; ++i) {
            for (var j = i + 1; j < a.length; ++j) {
                if (a[i] === a[j]) a.splice(j--, 1)
            }
        }

        return a
    },
    // From https://javascript.plainenglish.io/4-ways-to-compare-objects-in-javascript-97fe9b2a949c
    isEqual(obj1, obj2, isSimple) {
        if (isSimple) {
            return JSON.stringify(obj1) === JSON.stringify(obj2)
        } else {
            let props1 = Object.getOwnPropertyNames(obj1)
            let props2 = Object.getOwnPropertyNames(obj2)
            if (props1.length != props2.length) {
                return false
            }
            for (let i = 0; i < props1.length; i++) {
                let prop = props1[i]
                let bothAreObjects =
                    typeof obj1[prop] === 'object' &&
                    typeof obj2[prop] === 'object'
                if (
                    (!bothAreObjects && obj1[prop] !== obj2[prop]) ||
                    (bothAreObjects &&
                        !Formulae_.isEqual(obj1[prop], obj2[prop]))
                ) {
                    return false
                }
            }
            return true
        }
    },
    scaleImageInHalf(image, width, height) {
        var newWidth = Math.floor(width / 2)
        var newHeight = Math.floor(height / 2)
        var halfWidth = Math.floor(newWidth / 1)
        var halfHeight = Math.floor(newHeight / 1)

        var cvTopLeft = document.createElement('canvas')
        var cvTopRight = document.createElement('canvas')
        var cvBottomLeft = document.createElement('canvas')
        var cvBottomRight = document.createElement('canvas')

        cvTopLeft.width = newWidth
        cvTopLeft.height = newHeight
        cvTopRight.width = newWidth
        cvTopRight.height = newHeight
        cvBottomLeft.width = newWidth
        cvBottomLeft.height = newHeight
        cvBottomRight.width = newWidth
        cvBottomRight.height = newHeight

        var ctxTopLeft = cvTopLeft.getContext('2d')
        var ctxTopRight = cvTopRight.getContext('2d')
        var ctxBottomLeft = cvBottomLeft.getContext('2d')
        var ctxBottomRight = cvBottomRight.getContext('2d')

        ctxTopLeft.drawImage(image, 0, 0)
        ctxTopRight.drawImage(image, -newWidth, 0)
        ctxBottomLeft.drawImage(image, 0, -newHeight)
        ctxBottomRight.drawImage(image, -newWidth, -newHeight)

        /*
            cvTopLeft.width = halfWidth;
            cvTopLeft.height = halfHeight;
            cvTopRight.width = halfWidth;
            cvTopRight.height = halfHeight;
            cvBottomLeft.width = halfWidth;
            cvBottomLeft.height = halfHeight;
            cvBottomRight.width = halfWidth;
            cvBottomRight.height = halfHeight;
            */

        var cv = document.createElement('canvas')
        cv.id = 'cv'
        cv.width = width
        cv.height = height
        var ctx = cv.getContext('2d')

        ctx.drawImage(cvTopLeft, 0, 0)
        ctx.drawImage(cvTopRight, newWidth, 0)
        ctx.drawImage(cvBottomLeft, 0, newHeight)
        ctx.drawImage(cvBottomRight, newWidth, newHeight)

        var cv1 = document.body.appendChild(cvTopLeft)
        var cv2 = document.body.appendChild(cvTopRight)
        var cv3 = document.body.appendChild(cvBottomLeft)
        var cv4 = document.body.appendChild(cvBottomRight)

        var cvd = document.body.appendChild(cv)
        return cv.toDataURL()
    },
    downloadObject(exportObj, exportName, exportExt, downloadType) {
        var strung
        if (typeof exportObj === 'string') {
            strung = exportObj
        } else {
            if (
                exportExt &&
                (exportExt === '.json' || exportExt === '.geojson')
            ) {
                //pretty print geojson
                let features = []
                for (var i = 0; i < exportObj.features.length; i++)
                    features.push(JSON.stringify(exportObj.features[i]))
                features = '[\n' + features.join(',\n') + '\n]'
                exportObj.features = '__FEATURES_PLACEHOLDER__'
                strung = JSON.stringify(exportObj, null, 2)
                strung = strung.replace('"__FEATURES_PLACEHOLDER__"', features)
            } else strung = JSON.stringify(exportObj)
        }
        var fileName = exportName + (exportExt || '.json')

        try {
            // Create a blob of the data
            var fileToSave = new Blob([strung], {
                type: `application/${downloadType || 'json'}`,
                name: fileName,
            })
            // Save the file //from FileSaver
            saveAs(fileToSave, fileName)
        } catch (err) {
            //https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser#answer-30800715
            var dataStr =
                `data:text/${downloadType || 'json'};charset=utf-8,` +
                encodeURIComponent(strung)
            var downloadAnchorNode = document.createElement('a')
            downloadAnchorNode.setAttribute('href', dataStr)
            downloadAnchorNode.setAttribute('download', fileName)
            document.body.appendChild(downloadAnchorNode) // required for firefox
            downloadAnchorNode.click()
            downloadAnchorNode.remove()
        }
    },
    //headers: ['x','y','z']
    //array: [[0,1,2],[3,4,5],...]
    downloadArrayAsCSV(headers, array, exportName) {
        var csv = ''
        csv = headers.join(',') + '\n'
        for (var i = 0; i < array.length; i++) {
            csv += array[i].join(',') + '\n'
        }
        var dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
        var downloadAnchorNode = document.createElement('a')
        downloadAnchorNode.setAttribute('href', dataStr)
        downloadAnchorNode.setAttribute('download', exportName + '.csv')
        document.body.appendChild(downloadAnchorNode) // required for firefox
        downloadAnchorNode.click()
        downloadAnchorNode.remove()
    },
    downloadCanvas(canvasId, name, callback) {
        var link = document.createElement('a')
        name = name ? name + '.png' : 'mmgis.png'
        link.setAttribute('download', name)
        document.getElementById(canvasId).toBlob(function (blob) {
            var objUrl = URL.createObjectURL(blob)
            link.setAttribute('href', objUrl)
            document.body.appendChild(link)
            link.click()
            link.remove()
            if (typeof callback === 'function') callback()
        })
    },
    getMinMaxOfArray(arrayOfNumbers) {
        return {
            min: Math.min(...arrayOfNumbers),
            max: Math.max(...arrayOfNumbers),
        }
    },
    uniqueArray(arr) {
        var uniqueArray = []
        for (var i in arr) {
            if (uniqueArray.indexOf(arr[i]) === -1) uniqueArray.push(arr[i])
        }
        return uniqueArray
    },
    sanitize(str) {
        if (str == null) return ''
        return str.replace(/[<>;{}]/g, '')
    },
    doBoundingBoxesIntersect(a, b) {
        return a[1] <= b[3] && a[3] >= b[1] && a[0] <= b[2] && a[2] >= b[0]
    },
    boundingBoxToFeature(nE, sW) {
        return {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [nE.lng, nE.lat],
                        [sW.lng, nE.lat],
                        [sW.lng, sW.lat],
                        [nE.lng, sW.lat],
                        [nE.lng, nE.lat],
                    ],
                ],
            },
        }
    },
    // searchRadiusInDegrees = [lng, lng, lat, lat] bbox
    pointsInPoint(point, layers, searchRadiusInDegrees) {
        let points = []

        if (Array.isArray(layers)) {
            layers.forEach((l) => {
                points = points.concat(
                    Formulae_.pointsInPoint(point, l, searchRadiusInDegrees)
                )
            })
        } else {
            let l
            if (layers.feature && layers.feature.geometry?.type === 'Point') {
                l = [layers]
            } else l = layers._layers

            if (l == null) return points
            for (let i in l) {
                if (l[i].feature == null) continue
                if (searchRadiusInDegrees != null) {
                    if (
                        l[i].feature.geometry.coordinates[0] >
                            Math.min(
                                searchRadiusInDegrees[0],
                                searchRadiusInDegrees[1]
                            ) &&
                        l[i].feature.geometry.coordinates[0] <
                            Math.max(
                                searchRadiusInDegrees[0],
                                searchRadiusInDegrees[1]
                            ) &&
                        l[i].feature.geometry.coordinates[1] >
                            Math.min(
                                searchRadiusInDegrees[2],
                                searchRadiusInDegrees[3]
                            ) &&
                        l[i].feature.geometry.coordinates[1] <
                            Math.max(
                                searchRadiusInDegrees[2],
                                searchRadiusInDegrees[3]
                            )
                    ) {
                        points.push(l[i])
                    }
                } else if (
                    l[i].feature.geometry.coordinates[0] == point[0] &&
                    l[i].feature.geometry.coordinates[1] == point[1]
                )
                    points.push(l[i])
            }
        }

        return points
    },
    validTextColour(stringToTest) {
        //Alter the following conditions according to your need.
        if (stringToTest === '') {
            return false
        }
        if (stringToTest === 'inherit') {
            return false
        }
        if (stringToTest === 'transparent') {
            return false
        }

        var image = document.createElement('img')
        image.style.color = 'rgb(0, 0, 0)'
        image.style.color = stringToTest
        if (image.style.color !== 'rgb(0, 0, 0)') {
            return true
        }
        image.style.color = 'rgb(255, 255, 255)'
        image.style.color = stringToTest
        return image.style.color !== 'rgb(255, 255, 255)'
    },
    //From https://codepen.io/chanthy/pen/WxQoVG
    canvasDrawArrow(ctx, fromx, fromy, tox, toy, arrowWidth, color) {
        //variables to be used when creating the arrow
        let headlen = 10
        let angle = Math.atan2(toy - fromy, tox - fromx)

        ctx.save()
        ctx.strokeStyle = color

        //starting path of the arrow from the start square to the end square
        //and drawing the stroke
        ctx.beginPath()
        ctx.moveTo(fromx, fromy)
        ctx.lineTo(tox, toy)
        ctx.lineWidth = arrowWidth
        ctx.stroke()

        //starting a new path from the head of the arrow to one of the sides of
        //the point
        ctx.beginPath()
        ctx.moveTo(tox, toy)
        ctx.lineTo(
            tox - headlen * Math.cos(angle - Math.PI / 7),
            toy - headlen * Math.sin(angle - Math.PI / 7)
        )

        //path from the side point of the arrow, to the other side point
        ctx.lineTo(
            tox - headlen * Math.cos(angle + Math.PI / 7),
            toy - headlen * Math.sin(angle + Math.PI / 7)
        )

        //path from the side point back to the tip of the arrow, and then
        //again to the opposite side point
        ctx.lineTo(tox, toy)
        ctx.lineTo(
            tox - headlen * Math.cos(angle - Math.PI / 7),
            toy - headlen * Math.sin(angle - Math.PI / 7)
        )

        //draws the paths created above
        ctx.stroke()
        ctx.restore()
    },
    timestampToDate(timestamp, small) {
        var a = new Date(timestamp * 1000)
        var months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ]
        var year = a.getUTCFullYear()
        var month = a.getUTCMonth() + 1
        var monthName = months[month - 1]
        var date = a.getUTCDate()
        var hour =
            a.getUTCHours() < 10 ? '0' + a.getUTCHours() : a.getUTCHours()
        var min =
            a.getUTCMinutes() < 10 ? '0' + a.getUTCMinutes() : a.getUTCMinutes()
        var sec =
            a.getUTCSeconds() < 10 ? '0' + a.getUTCSeconds() : a.getUTCSeconds()

        if (small) {
            return (
                month +
                '/' +
                date +
                '/' +
                (year + '').slice(-2) +
                ' ' +
                hour +
                ':' +
                min
            )
        }
        return (
            monthName +
            ' ' +
            date +
            ', ' +
            year +
            ' ' +
            hour +
            ':' +
            min +
            ':' +
            sec
        )
    },
    isValidUrl(str) {
        const a = document.createElement('a')
        a.href = str
        return a.host && a.host !== window.location.host
    },
    /**
     * Returns an array of only the matching elements between two arrays
     * @param {[]} arr1
     * @param {[]} arr2
     */
    diff(arr1, arr2) {
        if (arr1 == null || arr2 == null) return []
        return arr1.filter((e) => arr2.indexOf(e) !== -1)
    },
    /**
     * Copies input to user's clipboard
     * @param {string} text - text to copy to clipboard
     * @credit https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
     */
    copyToClipboard(text) {
        const el = document.createElement('textarea') // Create a <textarea> element
        el.value = text // Set its value to the string that you want copied
        el.setAttribute('readonly', '') // Make it readonly to be tamper-proof
        el.style.position = 'absolute'
        el.style.left = '-9999px' // Move outside the screen to make it invisible
        document.body.appendChild(el) // Append the <textarea> element to the HTML document
        const selected =
            document.getSelection().rangeCount > 0 // Check if there is any content selected previously
                ? document.getSelection().getRangeAt(0) // Store selection if found
                : false // Mark as false to know no selection existed before
        el.select() // Select the <textarea> content
        document.execCommand('copy') // Copy - only works as a result of a user action (e.g. click events)
        document.body.removeChild(el) // Remove the <textarea> element
        if (selected) {
            // If a selection existed before copying
            document.getSelection().removeAllRanges() // Unselect everything on the HTML document
            document.getSelection().addRange(selected) // Restore the original selection
        }
    },
    speedToMetersPerSeconds(speed, fromUnit) {
        switch (fromUnit) {
            case 'm/s':
            case 'mps':
                return speed / 1
            case 'km/h':
            case 'kph':
                return speed / 3.6
            case 'mi/h':
            case 'mph':
                return speed / 2.2369362921
            case 'kt':
            case 'kn':
                return speed / 1.9438444924
            case 'ft/s':
                return speed / 3.280839895
            default:
                console.warn(`Unknown speed conversion unit: ${fromUnit}`)
                return speed
        }
    },
    metersPerSecondsToSpeed(speed, toUnit) {
        switch (toUnit) {
            case 'm/s':
            case 'mps':
                return speed * 1
            case 'km/h':
            case 'kph':
                return speed * 3.6
            case 'mi/h':
            case 'mph':
                return speed * 2.2369362921
            case 'kt':
            case 'kn':
                return speed * 1.9438444924
            case 'ft/s':
                return speed * 3.280839895
            default:
                console.warn(`Unknown speed conversion unit: ${toUnit}`)
                return speed
        }
    },
    toHost() {
        window.location = window.location.href.split('?')[0]
    },
    toHostForceLanding() {
        window.location =
            window.location.href.split('?')[0] + '?forcelanding=true'
    },
    prettifyName(name) {
        if (name === '_') return name
        try {
            let prettyName = name.replace(/_/g, ' ')
            return prettyName.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            })
        } catch (e) {
            return name
        }
    },
    getLatLngs(layer) {
        let latlngs = []
        if (!layer.hasOwnProperty('_latlngs')) {
            if (
                layer.feature?.geometry.type === 'Point' &&
                layer.feature?.geometry?.coordinates?.length === 2
            ) {
                return {
                    lat: layer.feature?.geometry?.coordinates[1],
                    lng: layer.feature?.geometry?.coordinates[0],
                }
            }
            return latlngs
        }
        //return layer._latlngs
        for (let i = 0; i < layer._latlngs.length; i++) {
            if (layer._latlngs[i].lat != null) {
                let ll = {
                    lat: layer._latlngs[i].lat,
                    lng: layer._latlngs[i].lng,
                }
                if (layer._latlngs[i].alt != null)
                    ll.alt = layer._latlngs[i].alt
                latlngs.push(ll)
            } else {
                latlngs.push([])
                for (let j = 0; j < layer._latlngs[i].length; j++) {
                    if (layer._latlngs[i][j].lat == null)
                        return Formulae_.getFeatureLatLngs(layer.feature) || []
                    let ll = {
                        lat: layer._latlngs[i][j].lat,
                        lng: layer._latlngs[i][j].lng,
                    }
                    if (layer._latlngs[i][j].alt != null)
                        ll.alt = layer._latlngs[i][j].alt
                    latlngs[i].push(ll)
                }
            }
        }
        return latlngs
    },
    getFeatureLatLngs(feature) {
        let c = feature.geometry.coordinates
        let latlngs = []
        for (let i = 0; i < c.length; i++) {
            latlngs.push([])
            for (let j = 0; j < c[i][0].length; j++) {
                let ll = {
                    lat: c[i][0][j][1],
                    lng: c[i][0][j][0],
                }
                if (c[i][0][j][2] != null) ll.alt = c[i][0][j][2]
                latlngs[i].push(ll)
            }
        }
        return latlngs
    },
    getPtSomeDistBetween2OtherPts(x0, y0, x1, y1, d) {
        return { x: (1 - d) * x0 + d * x1, y: (1 - d) * y0 + d * y1 }
    },
    RGBAto32(rgba) {
        return Formulae_.decodeFloat(
            Formulae_.asByteString(rgba.r.toString(2)) +
                Formulae_.asByteString(rgba.g.toString(2)) +
                Formulae_.asByteString(rgba.b.toString(2)) +
                Formulae_.asByteString(rgba.a.toString(2))
        )
    },
    asByteString(byte) {
        let byteString = byte
        while (byteString.length < 8) {
            byteString = '0' + byteString
        }
        return byteString
    },
    decodeFloat(binary) {
        if (binary.length < 32)
            binary = ('00000000000000000000000000000000' + binary).substr(
                binary.length
            )
        var sign = binary.charAt(0) == '1' ? -1 : 1
        var exponent = parseInt(binary.substr(1, 8), 2) - 127
        var significandBase = binary.substr(9)
        var significandBin = '1' + significandBase
        var i = 0
        var val = 1
        var significand = 0

        if (exponent == -127) {
            if (significandBase.indexOf('1') == -1) return 0
            else {
                exponent = -126
                significandBin = '0' + significandBase
            }
        }

        while (i < significandBin.length) {
            significand += val * parseInt(significandBin.charAt(i))
            val = val / 2
            i++
        }

        return sign * significand * Math.pow(2, exponent)
    },
    getTextShadowString(color, opacity, weight) {
        if (weight === 0) return 'unset'
        var str =
            '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000, 0px 1px 0 #000, 0px -1px 0 #000, -1px 0px 0 #000, 1px 0px 0 #000'
        if (weight >= 2)
            str +=
                ', 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0px 2px 0 #000, 0px -2px 0 #000, -2px 0px 0 #000, 2px 0px 0 #000, 1px 2px 0 #000, -1px 2px 0 #000, 1px -2px 0 #000, -1px -2px 0 #000, 2px 1px 0 #000, -2px 1px 0 #000, 2px -1px 0 #000, -2px -1px 0 #000'
        if (color) {
            try {
                if (color[0] === '#') {
                    color = Formulae_.hexToRGB(color)
                    color =
                        'rgb(' + color.r + ',' + color.g + ',' + color.b + ')'
                }
                color = Formulae_.rgbToArray(color)
                color =
                    'rgba(' +
                    color[0] +
                    ',' +
                    color[1] +
                    ',' +
                    color[2] +
                    ',' +
                    (opacity != null ? opacity : 1) +
                    ')'
                str = str.replace(/#000/g, color)
            } catch (e) {}
        }
        return str
    },
    makeColorGrid(x, y) {
        var colorgrid = []
        //Black and white first
        colorgrid.push('<div style="display: flex; width: 100%;">')
        for (var j = 1; j < x; j++) {
            colorgrid.push(
                '<div class="colorgridsquare" style="background: hsl(' +
                    0 +
                    ',' +
                    0 +
                    '%,' +
                    (j - 1) * (100 / (x - 2)) +
                    '%);' +
                    'width: ' +
                    100 / (x - 1) +
                    '%; height: 16px; margin: 1px;"></div>'
            )
        }
        colorgrid.push('</div>')
        for (var i = 0; i < y; i++) {
            colorgrid.push('<div style="display: flex; width: 100%;">')
            for (var j = 1; j < x; j++) {
                colorgrid.push(
                    '<div class="colorgridsquare" style="background: hsl(' +
                        i * (360 / y) +
                        ',' +
                        (j + 2) * (157.15 / x) +
                        '%,' +
                        (j + 1) * (100 / (x + 1)) +
                        '%);' +
                        'width: ' +
                        100 / (x - 1) +
                        '%; height: 16px; margin: 1px;"></div>'
                )
            }
            colorgrid.push('</div>')
        }
        return colorgrid.join('\n')
    },
    getColorScale(i, s, l) {
        i = parseInt(i)
        s = s || '60%'
        l = l || '25%'
        // prettier-ignore
        const colorScaleA = [15,40,65,90,115,140,165,190,215,240,265,290,315,340]
        //prettier-ignore
        return 'hsl(' + colorScaleA[i % colorScaleA.length] + ', ' + s + ', ' + l + ')'
    },
    cloneCanvas(oldCanvas) {
        //create a new canvas
        var newCanvas = document.createElement('canvas')
        var context = newCanvas.getContext('2d')

        //set dimensions
        newCanvas.width = oldCanvas.width
        newCanvas.height = oldCanvas.height

        //apply the old canvas to the new one
        context.drawImage(oldCanvas, 0, 0)

        //return the new canvas
        return newCanvas
    },
    // leaf arrays must be of strings or numbers
    // mainly used for geojson coordinate traversal
    coordinateDepthTraversal(array, onEachLeaf, _path) {
        _path = _path || '0'
        for (var i = 0; i < array.length; i++) {
            if (typeof array[i] !== 'string' && array[i].length != null) {
                Formulae_.coordinateDepthTraversal(
                    array[i],
                    onEachLeaf,
                    `${_path}.${i}`
                )
            } else if (
                typeof array[i] === 'string' ||
                typeof array[i] === 'number'
            ) {
                const next = onEachLeaf(array, _path)
                if (next)
                    for (let n = 0; n < array.length; n++) {
                        if (next[n] != null) array[n] = next[n]
                    }
                return
            }
        }
    },
    // Stitches two arrays together into an object
    stitchArrays(keyArray, valueArray) {
        keyArray = keyArray || []
        valueArray = valueArray || []

        const stitched = {}
        keyArray.forEach((k, idx) => {
            if (k != null)
                stitched[k] = valueArray[idx] != null ? valueArray[idx] : null
        })
        return stitched
    },
    bracketReplace(str, obj, replace) {
        if (str === null) return ''
        let matches = str.match(/\{.*?\}/gi)

        if (matches)
            matches.forEach((v) => {
                const replaceProp = v.replace(/[\{\}]/g, '')
                let replaceWith =
                    Formulae_.getIn(obj, replaceProp.split('.'), '') + ''

                // Modify the prop value directly too
                if (
                    replace &&
                    replace[replaceProp] &&
                    replace[replaceProp].length > 0
                ) {
                    replace[replaceProp].forEach((rp) => {
                        replaceWith = replaceWith.replace(
                            new RegExp(rp[0], 'g'),
                            rp[1]
                        )
                    })
                }

                str = str.replace(new RegExp(v, 'g'), replaceWith)
            })
        return str
    },
    /** Returns an ellipse with major and minor axes and rotation about a point
       // Adapted from turf.js' ellipse function
     * @param lnglat {lng: lat:}
     * @param axes {x: y:}
     * @param crs {object}
     * @param options {units: 'meters', steps: 32, angle: 0}
     */
    toEllipse(lnglat, axes, crs, options) {
        if (crs == null) return null

        let xAxis = axes.x || 0
        let yAxis = axes.y || 0

        if (xAxis === 0 || yAxis === 0) return null
        // Optional params
        options = options || {}
        let steps = options.steps || 32
        let units = options.units || 'meters'
        let angle = (options.angle || 0) * -1
        const angleRad = angle * (Math.PI / 180)

        if (units === 'kilometers') {
            xAxis *= 1000
            yAxis *= 1000
        }

        const centerEN = crs.project(lnglat)
        const centerCoordsEN = [centerEN.x, centerEN.y]

        const coordinates = []
        for (let i = 0; i < steps; i += 1) {
            let stepAngle = (i * -360) / steps
            let x =
                (xAxis * yAxis) /
                Math.sqrt(
                    Math.pow(yAxis, 2) +
                        Math.pow(xAxis, 2) *
                            Math.pow(Math.tan((stepAngle * Math.PI) / 180), 2)
                )
            let y =
                (xAxis * yAxis) /
                Math.sqrt(
                    Math.pow(xAxis, 2) +
                        Math.pow(yAxis, 2) /
                            Math.pow(Math.tan((stepAngle * Math.PI) / 180), 2)
                )

            if (stepAngle < -90 && stepAngle >= -270) x = -x
            if (stepAngle < -180 && stepAngle >= -360) y = -y

            const rot = Formulae_.rotatePoint(
                {
                    x: x,
                    y: y,
                },
                [0, 0],
                angleRad
            )
            x = rot.x
            y = rot.y

            let lnglatCoord = crs.unproject({
                x: x + centerCoordsEN[0],
                y: y + centerCoordsEN[1],
            })
            coordinates.push([lnglatCoord.lng, lnglatCoord.lat])
        }
        coordinates.push(coordinates[0])

        return {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [coordinates] },
        }
    },
    /**
     * Line of Sight Viewshed in one dimension
     * @param heightArray - array of elevation values, length should be >2, observer at index 0
     * @param observerHeight
     * @param targetHeight
     */
    lineOfSight1D(heightArray, observerHeight, targetHeight) {
        if (heightArray.length <= 2)
            return new Array(heightArray.length).fill(1)

        const refArray = new Array(heightArray.length).fill(0)
        const resultArray = new Array(heightArray.length).fill(0)

        refArray[0] = heightArray[0]
        refArray[1] = heightArray[1]
        resultArray[0] = 1
        resultArray[1] = 1

        let observerElev = heightArray[0]
        observerHeight = observerHeight || 0
        targetHeight = targetHeight || 0

        for (let i = 2; i < heightArray.length; i++) {
            refArray[i] = Formulae_.calcHeightLine(
                i,
                refArray[i - 1],
                observerHeight + observerElev
            )

            // Set visibility if our value is less than the data's
            const dataH = heightArray[i] + targetHeight
            if (refArray[i] <= dataH) {
                //if (this.isInElevationFOV(d, i, o.y, observerHeight, dataH))
                resultArray[i] = 1
            } else resultArray[i] = 0

            // Check if NoData
            if (Formulae_.isNoDataElev(heightArray[i])) resultArray[i] = 9

            // Set ref position to the greater: plane height or actual elevation
            refArray[i] = Math.max(refArray[i], heightArray[i])
        }

        return resultArray
    },
    // For lineOfSight1D
    // i - x coordinate from observer, follows image coordinate system
    // Za - refGrid height value, the "behind" point value
    // Zo - observer's height, constant per viewshed
    calcHeightLine: function (i, Za, Zo) {
        i = Math.abs(i)
        if (i == 1) return Za
        else return (Za - Zo) / (i - 1) + Za
    },
    // For lineOfSight1D
    isNoDataElev(data) {
        if (data == 1010101 || data > 35000 || data < -35000) return true
        return false
    },
    azElDistBetween(latLngEl_A, latLngEl_B) {
        //Formulae_.azElBetween2(latLngEl_A, latLngEl_B)

        const b = azElDistBetween(
            latLngEl_A,
            latLngEl_B,
            Formulae_.radiusOfPlanetMajor,
            Formulae_.radiusOfPlanetMinor
        )
        return b
    },
    azElBetween2(latLngEl_A, latLngEl_B) {
        const crs = window.mmgisglobal.customCRS
        const a = crs.project(latLngEl_A)
        const b = crs.project(latLngEl_B)

        const dist = Math.sqrt(
            Math.pow(b.x - a.x, 2) +
                Math.pow(b.y - a.y, 2) +
                Math.pow(latLngEl_B.el - latLngEl_A.el, 2)
        )

        const el =
            Math.asin((latLngEl_B.el - latLngEl_A.el) / dist) * (180 / Math.PI)

        let az = Math.atan2(b.x - a.x, b.y - a.y) * (180 / Math.PI)
        if (az < 0) az += 360
        console.log({
            az: az,
            el: el,
            dist: dist,
        })
    },
    // Breaks an array in multiple arrays of some size
    chunkArray(arr, size) {
        return arr.length > size
            ? [
                  arr.slice(0, size),
                  ...Formulae_.chunkArray(arr.slice(size), size),
              ]
            : [arr]
    },
    /**
     * From https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
     */
    humanFileSize(bytes, si) {
        if (bytes == null) return null
        var thresh = si ? 1000 : 1024
        if (Math.abs(bytes) < thresh) {
            return bytes + ' B'
        }
        var units = si
            ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
        var u = -1
        do {
            bytes /= thresh
            ++u
        } while (Math.abs(bytes) >= thresh && u < units.length - 1)
        return bytes.toFixed(1) + ' ' + units[u]
    },
    getBrowser() {
        //Check if browser is IE
        if (navigator.userAgent.search('MSIE') >= 0) {
            return 'ie'
        }
        //Check if browser is Chrome
        else if (navigator.userAgent.search('Chrome') >= 0) {
            return 'chrome'
        }
        //Check if browser is Firefox
        else if (navigator.userAgent.search('Firefox') >= 0) {
            return 'firefox'
        }
        //Check if browser is Safari
        else if (
            navigator.userAgent.search('Safari') >= 0 &&
            navigator.userAgent.search('Chrome') < 0
        ) {
            return 'safari'
        }
        //Check if browser is Opera
        else if (navigator.userAgent.search('Opera') >= 0) {
            return 'opera'
        }
    },
    isMobile: {
        getUserAgent: function () {
            return navigator.userAgent
        },
        Android: function () {
            return (
                /Android/i.test(Formulae_.isMobile.getUserAgent()) &&
                !Formulae_.isMobile.Windows()
            )
        },
        BlackBerry: function () {
            return /BlackBerry|BB10|PlayBook/i.test(
                Formulae_.isMobile.getUserAgent()
            )
        },
        iPhone: function () {
            return (
                /iPhone/i.test(Formulae_.isMobile.getUserAgent()) &&
                !Formulae_.isMobile.iPad() &&
                !Formulae_.isMobile.Windows()
            )
        },
        iPod: function () {
            return /iPod/i.test(Formulae_.isMobile.getUserAgent())
        },
        iPad: function () {
            return /iPad/i.test(Formulae_.isMobile.getUserAgent())
        },
        iOS: function () {
            return (
                Formulae_.isMobile.iPad() ||
                Formulae_.isMobile.iPod() ||
                Formulae_.isMobile.iPhone()
            )
        },
        Opera: function () {
            return /Opera Mini/i.test(Formulae_.isMobile.getUserAgent())
        },
        Windows: function () {
            return /Windows Phone|IEMobile|WPDesktop/i.test(
                Formulae_.isMobile.getUserAgent()
            )
        },
        KindleFire: function () {
            return /Kindle Fire|Silk|KFAPWA|KFSOWI|KFJWA|KFJWI|KFAPWI|KFAPWI|KFOT|KFTT|KFTHWI|KFTHWA|KFASWI|KFTBWI|KFMEWI|KFFOWI|KFSAWA|KFSAWI|KFARWI/i.test(
                Formulae_.isMobile.getUserAgent()
            )
        },
        any: function () {
            return (
                Formulae_.isMobile.Android() ||
                Formulae_.isMobile.BlackBerry() ||
                Formulae_.isMobile.iOS() ||
                Formulae_.isMobile.Opera() ||
                Formulae_.isMobile.Windows()
            )
        },
    },
}

//Prototypes
String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1)
}
//console.log( Formulae_.lngLatDistBetween( 137, -4, 138, -3 ) );

Formulae_.metersInOneDegree = Formulae_.degreesToMeters(1)

export default Formulae_
