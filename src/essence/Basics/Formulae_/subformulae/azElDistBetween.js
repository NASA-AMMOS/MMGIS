// Adapted from https://github.com/cosinekitty/geocalc/blob/master/compass.html

function parseAngle(angle, limit) {
    angle = parseFloat(angle)
    if (isNaN(angle) || angle < -limit || angle > limit) return null
    return angle
}

function parseElevation(el) {
    el = parseFloat(el)
    if (isNaN(el)) return null
    return el
}

function parseLocation(latLngEl) {
    const lat = parseAngle(latLngEl.lat, 90.0)
    let location = null
    if (lat != null) {
        const lng = parseAngle(latLngEl.lng, 180.0)
        if (lng != null) {
            const el = parseElevation(latLngEl.el)
            if (el != null) {
                location = { lat: lat, lng: lng, el: el }
            }
        }
    }
    return location
}

function earthRadiusInMeters(latitudeRadians, majorRadius, minorRadius) {
    // latitudeRadians is geodetic, i.e. that reported by GPS.
    // http://en.wikipedia.org/wiki/Earth_radius
    const a = majorRadius // equatorial radius in meters
    const b = minorRadius // polar radius in meters
    const cos = Math.cos(latitudeRadians)
    const sin = Math.sin(latitudeRadians)
    const t1 = a * a * cos
    const t2 = b * b * sin
    const t3 = a * cos
    const t4 = b * sin
    return Math.sqrt((t1 * t1 + t2 * t2) / (t3 * t3 + t4 * t4))
}

function geocentricLatitude(lat, majorRadius, minorRadius) {
    const a = majorRadius // equatorial radius in meters
    const b = minorRadius // polar radius in meters
    const f = (a - b) / a // flattening
    const e2 = 2 * f - Math.pow(f, 2) // eccentricity squared

    // Convert geodetic latitude 'lat' to a geocentric latitude 'clat'.
    // Geodetic latitude is the latitude as given by GPS.
    // Geocentric latitude is the angle measured from center of Earth between a point and the equator.
    // https://en.wikipedia.org/wiki/Latitude#Geocentric_latitude
    const clat = Math.atan((1.0 - e2) * Math.tan(lat))

    return clat
}

function locationToPoint(c, majorRadius, minorRadius) {
    // Convert (lat, lng, el) to (x, y, z).
    const lat = (c.lat * Math.PI) / 180.0
    const lng = (c.lng * Math.PI) / 180.0
    const radius = earthRadiusInMeters(lat, majorRadius, minorRadius)
    const clat = geocentricLatitude(lat, majorRadius, minorRadius)

    const cosLng = Math.cos(lng)
    const sinLng = Math.sin(lng)
    const cosLat = Math.cos(clat)
    const sinLat = Math.sin(clat)
    let x = radius * cosLng * cosLat
    let y = radius * sinLng * cosLat
    let z = radius * sinLat

    // We used geocentric latitude to calculate (x,y,z) on the Earth's ellipsoid.
    // Now we use geodetic latitude to calculate normal vector from the surface, to correct for elevation.
    const cosGlat = Math.cos(lat)
    const sinGlat = Math.sin(lat)

    const nx = cosGlat * cosLng
    const ny = cosGlat * sinLng
    const nz = sinGlat

    x += c.el * nx
    y += c.el * ny
    z += c.el * nz

    return { x: x, y: y, z: z, radius: radius, nx: nx, ny: ny, nz: nz }
}

function distance(ap, bp) {
    const dx = ap.x - bp.x
    const dy = ap.y - bp.y
    const dz = ap.z - bp.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function rotateGlobe(b, a, bradius, aradius, majorRadius, minorRadius) {
    // Get modified coordinates of 'b' by rotating the globe so that 'a' is at lat=0, lng=0.
    const br = { lat: b.lat, lng: b.lng - a.lng, el: b.el }
    const brp = locationToPoint(br, majorRadius, minorRadius)

    // Rotate brp cartesian coordinates around the z-axis by a.lng degrees,
    // then around the y-axis by a.lat degrees.
    // Though we are decreasing by a.lat degrees, as seen above the y-axis,
    // this is a positive (counterclockwise) rotation (if B's longitude is east of A's).
    // However, from this point of view the x-axis is pointing left.
    // So we will look the other way making the x-axis pointing right, the z-axis
    // pointing up, and the rotation treated as negative.

    const alat = geocentricLatitude(
        (-a.lat * Math.PI) / 180.0,
        majorRadius,
        minorRadius
    )
    const acos = Math.cos(alat)
    const asin = Math.sin(alat)

    const bx = brp.x * acos - brp.z * asin
    const by = brp.y
    const bz = brp.x * asin + brp.z * acos

    return { x: bx, y: by, z: bz, radius: bradius }
}

function normalizeVectorDiff(b, a) {
    // Calculate norm(b-a), where norm divides a vector by its length to produce a unit vector.
    var dx = b.x - a.x
    var dy = b.y - a.y
    var dz = b.z - a.z
    var dist2 = dx * dx + dy * dy + dz * dz
    if (dist2 == 0) {
        return null
    }
    var dist = Math.sqrt(dist2)
    return { x: dx / dist, y: dy / dist, z: dz / dist, radius: 1.0 }
}

export default function azElDistBetween(
    latLngEl_A,
    latLngEl_B,
    majorRadius,
    minorRadius
) {
    majorRadius = 3396190
    minorRadius = majorRadius
    const result = { az: 0, el: 0, dist: 0 }
    const a = parseLocation(latLngEl_A)
    if (a != null) {
        const b = parseLocation(latLngEl_B)
        if (b != null) {
            const ap = locationToPoint(a, majorRadius, minorRadius)
            const bp = locationToPoint(b, majorRadius, minorRadius)
            result.dist = distance(ap, bp)

            // Let's use a trick to calculate azimuth:
            // Rotate the globe so that point A looks like latitude 0, longitude 0.
            // We keep the actual radii calculated based on the oblate geoid,
            // but use angles based on subtraction.
            // Point A will be at x=radius, y=0, z=0.
            // Vector difference B-A will have dz = N/S component, dy = E/W component.
            const br = rotateGlobe(
                b,
                a,
                bp.radius,
                ap.radius,
                majorRadius,
                minorRadius
            )
            if (br.z * br.z + br.y * br.y > 1.0e-6) {
                const theta = (Math.atan2(br.z, br.y) * 180.0) / Math.PI
                let azimuth = 90.0 - theta
                if (azimuth < 0.0) {
                    azimuth += 360.0
                }
                if (azimuth > 360.0) {
                    azimuth -= 360.0
                }
                result.az = azimuth
            }

            const bma = normalizeVectorDiff(bp, ap)
            if (bma != null) {
                // Calculate altitude, which is the angle above the horizon of B as seen from A.
                // Almost always, B will actually be below the horizon, so the altitude will be negative.
                // The dot product of bma and norm = cos(zenith_angle), and zenith_angle = (90 deg) - altitude.
                // So altitude = 90 - acos(dotprod).
                const altitude =
                    90.0 -
                    (180.0 / Math.PI) *
                        Math.acos(bma.x * ap.nx + bma.y * ap.ny + bma.z * ap.nz)
                result.el = altitude
            }
        }
    }

    return result
}
