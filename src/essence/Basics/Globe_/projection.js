import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'

var projection = {
    radiusOfPlanetMajor: 3396190, //(m)
    radiusOfPlanetMinor: 3396190, //semi-minor axis
    projection: 'webmercator',
    validProjections: [
        'webmercator',
        'equidistantcylindrical',
        'lambertazimuthalequalarea',
        'stereographic(N)',
        'stereographic(S)',
    ],
    tmr: null, //tilemapresource
    tmrBoundsMod: [0, 0, 0, 0],
    tmrOriginMod: [0, 0],
    centerLat: 90 * (Math.PI / 180),
    centerLon: 0 * (Math.PI / 180),
    sphereBoundsX: [-Math.PI, Math.PI],
    sphereBoundsY: [-Math.PI / 2, Math.PI / 2],
    stereNOffset: [1.37, 1.195],
    setRadius: function (which, radius) {
        if (which.toLowerCase() == 'major')
            this.radiusOfPlanetMajor = parseFloat(radius)
        else if (which.toLowerCase() == 'minor')
            this.radiusOfPlanetMinor = parseFloat(radius)
    },
    setTilemapResource: function (tmr) {
        this.stereNOffset = [0, (6371000 / this.radiusOfPlanetMajor) * 2]

        this.tmr = tmr
        if (
            this.tmr &&
            this.tmr.globeproj &&
            this.validProjections.indexOf(this.tmr.globeproj) > -1
        ) {
            this.projection = this.tmr.globeproj
            this.tmrBoundsMod[0] = this.tmr.bounds[0]
            this.tmrBoundsMod[1] = this.tmr.bounds[1]
            this.tmrBoundsMod[2] = this.tmr.bounds[2]
            this.tmrBoundsMod[3] = this.tmr.bounds[3]
            this.tmrOriginMod[0] = this.tmr.origin[0]
            this.tmrOriginMod[1] = this.tmr.origin[1]
            this.tmr.projSplit = this.tmr.proj.split(' ')
            //find params
            // default to 0
            this.tmr.lon_0 = 0
            this.tmr.lat_0 = 0
            this.tmr.lat_ts = 0
            for (var i = 0; i < this.tmr.projSplit.length; i++) {
                if (this.tmr.projSplit[i].indexOf('+lon_0') > -1)
                    this.tmr.lon_0 =
                        parseFloat(this.tmr.projSplit[i].split('=')[1]) *
                        (Math.PI / 180)
                if (this.tmr.projSplit[i].indexOf('+lat_0') > -1)
                    this.tmr.lat_0 =
                        parseFloat(this.tmr.projSplit[i].split('=')[1]) *
                        (Math.PI / 180)
                if (this.tmr.projSplit[i].indexOf('+lat_ts') > -1)
                    this.tmr.lat_ts =
                        parseFloat(this.tmr.projSplit[i].split('=')[1]) *
                        (Math.PI / 180)
            }
        }
        //this.projection = 'stereographic(N)'
        //this.projection = 'equidistantcylindrical';
        //this.projection = 'webmercator';

        if (
            this.projection === 'lambertazimuthalequalarea' ||
            this.projection == 'stereographic(N)'
        ) {
            this.sphereBoundsX = this.sphereBoundsY
            //var v = 1.29;//6317000 / this.radiusOfPlanetMajor;
            //this.tmrBoundsMod[2] *= (this.tmr.bounds[2] - this.tmr.bounds[0]) / (256 * this.tmr.res[0]);
            //this.tmrBoundsMod[3] *= (this.tmr.bounds[3] - this.tmr.bounds[1]) / (256 * this.tmr.res[0]);
            //this.tmrBoundsMod[0] *= v;
            //this.tmrBoundsMod[1] *= v;
            //this.tmrBoundsMod[2] *= v;
            //this.tmrBoundsMod[3] *= v;
            //this.tmrOriginMod[0] *= v;
            //this.tmrOriginMod[1] *= v;
        }

        var lont = -180
        var latt = 0
        var zoom = 0
        /*
            var x = this.long2tile( [lont, latt], zoom );
            var y = this.lat2tile( [lont, latt], zoom );
            console.log( lont, latt );
            console.log( x, y );
            console.log( this.tile2long( x, zoom ), this.tile2lat( y, zoom ) );
            console.log( this.sphereXToTileXYZ( -180 * (Math.PI/180), zoom ) )
            */
        /*
            console.log( '---------' );
            
            var tx = 0;
            var ty = 20;
            var z = 5;
            
            console.log( tx );
            var long = this.tile2long( tx, ty, z );
            console.log( long );
            console.log( this.long2tile( [long, 0], z ) );

            console.log( ty );
            var lat = this.tile2lat( ty, z );
            console.log( lat );
            console.log( this.lat2tile( [0, lat], z ) );
            */
        /*
            console.log( this.tile2lat( 0, 1 ) )
            console.log( this.tile2lat( 0.31, 1 ) )
            console.log( this.tile2lat( 0.62, 1 ) )
            */

        //console.log( this.invertY( 0, 3 ) );
        /*
            var lont = 0;
            var latt = 90;
            var zt = 3;
            
            var yt = 3;
            var xt = 4;
            for( var i = 0; i < 5; i++ ) {
                console.log( '---' );
                console.log( zt + '_' + xt + '_' + i, this.tile2lat( i, zt, { x: xt } ) );
                console.log( zt + '_' + xt + '_' + i, this.tile2long( xt, zt, { y: i } ) );
            }
            */
        /*
            var tt = 2;

            var yt = this.lat2tile( [lont, latt], zt );
            var xt = this.long2tile( [lont, latt], zt );
            zt = 2; xt = 1.864; yt = 1.864;
            var lat = this.tile2lat( yt, zt, { x: xt } );
            var lon = this.tile2long( xt, zt, { y: yt } );

            console.log( xt, yt, lat, lon );

            zt = 2; xt = tt + 0.99; yt = tt;
            var lat = this.tile2lat( yt, zt, { x: xt } );
            var lon = this.tile2long( xt, zt, { y: yt } );

            console.log( xt, yt, lat, lon );

            zt = 2; xt = tt; yt = tt + 0.99;
            var lat = this.tile2lat( yt, zt, { x: xt } );
            var lon = this.tile2long( xt, zt, { y: yt } );

            console.log( xt, yt, lat, lon );

            zt = 2; xt = tt + 0.99; yt = tt + 0.99;
            var lat = this.tile2lat( yt, zt, { x: xt } );
            var lon = this.tile2long( xt, zt, { y: yt } );

            console.log( xt, yt, lat, lon );
            */
        /*
            for( var i = 0; i < 5; i++ ) {
                console.log( '--------' );
                console.log( i, this.tileYToSphereY( i, 2 ) );
            }
            */

        /*
            var zt = 2;
            var xt = 0;
            var yt = 1.5;
            console.log( xt, yt, zt );
            var lattt = this.tile2lat( yt, zt, { x: xt } );
            var lontt = this.tile2long( xt, zt, { y: yt } );
            console.log( lattt, lontt );
            var ytt = this.lat2tile( [lontt, lattt], zt );
            var xtt = this.long2tile( [lontt, lattt], zt );
            console.log( xtt, ytt );
            */
        //
        /*
            var yt = 0.93
            var zt = 0;
            var xt = 0.465;
            console.log( xt, yt, zt );
            var lattt = this.tile2lat( yt, zt, { x: xt } );
            var lontt = this.tile2long( xt, zt, { y: yt } );
            console.log( lattt, lontt );
            var ytt = this.lat2tile( [lontt, lattt], zt );
            var xtt = this.long2tile( [lontt, lattt], zt );
            console.log( xtt, ytt );
            */
        //var tysy = this.tileYToSphereY( yt, zt );
        //console.log( tysy );
        //console.log( this.tile2long( xt, zt, { lat: lattt } ) );
        //console.log( this.lonLatToVector3( 100, 90, 1 ) );
    },
    e: 0,
    ep: 0, // eprime
    flatteningFactor: 0, //perfect sphere
    radiusScale: 1, //1 unit is radiusScale meters
    invertY: function (y, z) {
        switch (this.projection) {
            case 'placeholder':
                return Math.floor(this.lat2tile([0, 90], z) + 1) - 1 - y
            default:
                return Math.pow(2, z) - 1 - y
        }
    },
    /*
        tile2long: function( x, z ) {
        let easting = ( x * ( 256 * this.tmr.res[z] ) ) + this.tmr.origin[0];
        //lon = lon_0 + easting/(R*cos(lat_ts))
        let long = this.tmr.lon_0 + ( easting / ( this.radiusOfPlanetMajor * Math.cos( this.tmr.lat_ts ) ) );
        return long * (180/Math.PI);
        },
        long2tile: function( lonlat, z ) {
        lonlat[0] = lonlat[0] * (Math.PI/180);
        //x = R(lon - lon_0)cos(lat_ts)
        let lonDif = (lonlat[0] - this.tmr.lon_0);
        while( lonDif > 180 ) lonDif -= 360;
        while( lonDif < -180 ) lonDif += 360;
        let easting = this.radiusOfPlanetMajor * lonDif * Math.cos( this.tmr.lat_ts );
        return ( easting - this.tmr.origin[0] ) / ( 256 * this.tmr.res[z] );//as tile x
        },
        tile2lat: function( y, z ) {
        let northing = ( y * ( 256 * this.tmr.res[z] ) ) + this.tmr.origin[1];
        //lat = y/R
        let lat = northing / this.radiusOfPlanetMajor * (180/Math.PI);
        return lat;
        },
        lat2tile: function( lonlat, z ) {
        lonlat[1] = lonlat[1] * (Math.PI/180);
        //y = R*lat
        let northing = this.radiusOfPlanetMajor * lonlat[1];
        return ( northing - this.tmr.origin[1] ) / ( 256 * this.tmr.res[z] );//as tile y
        },
        */
    tileXYZ2LatLng: function (x, y, z, flatXYZ) {
        if (
            window.mmgisglobal.customCRS == null ||
            this.projection == 'webmercator'
        ) {
            let lng = (x / Math.pow(2, z)) * 360 - 180
            let n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
            let lat =
                (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
            return { lat: lat, lng: lng }
        } else {
            //In these projections the origin is bottom left instead of top left
            //So flip the decimal value
            let dec = y % 1
            if (dec != 0) y = Math.floor(y) + (1 - dec)
            else if (flatXYZ) {
                if (y == flatXYZ.y) y = flatXYZ.y + 1
                else y = flatXYZ.y
            }

            let proj = window.mmgisglobal.customCRS.projection._proj

            let easting = 256 * x * this.tmr.res[z] + this.tmrOriginMod[0]
            let northing = 256 * y * this.tmr.res[z] + this.tmrOriginMod[1]

            let p = proj.inverse([easting, northing])

            return {
                lat: p[1],
                lng: p[0],
            }
        }
    },
    latLngZ2TileXYZ: function (lat, lng, z, dontFloor) {
        if (
            window.mmgisglobal.customCRS == null ||
            this.projection == 'webmercator'
        ) {
            let x = ((lng + 180) / 360) * Math.pow(2, z)
            let y =
                ((1 -
                    Math.log(
                        Math.tan(lat * (Math.PI / 180)) +
                            1 / Math.cos(lat * (Math.PI / 180))
                    ) /
                        Math.PI) /
                    2) *
                Math.pow(2, z)
            if (dontFloor == null) {
                x = Math.floor(x)
                y = Math.floor(y)
            }

            return { x: x, y: y, z: z }
        } else {
            let proj = window.mmgisglobal.customCRS.projection._proj

            let p = proj.forward([lng, lat])
            let easting = p[0]
            let northing = p[1]

            let x = (easting - this.tmrOriginMod[0]) / (256 * this.tmr.res[z])
            let y = (northing - this.tmrOriginMod[1]) / (256 * this.tmr.res[z])

            //In these projections the origin is bottom left instead of top left
            //So flip the decimal value back
            y = Math.floor(y) + (1 - (y % 1))

            return { x: x, y: y, z: z }
        }
    },
    tile2long: function (x, z, parms) {
        parms = parms || {}
        switch (parms.projection || this.projection) {
            case 'webmercator':
                return (x / Math.pow(2, z)) * 360 - 180
            case 'stereographic(N)':
                var sx = this.tileXToSphereX(x, z)
                var sy = -this.tileYToSphereY(parms.y, z)
                return (
                    (this.centerLon + Math.atan2(sx, -sy)) * (180 / Math.PI) +
                    this.stereNOffset[0]
                )
            case 'equidistantcylindrical':
                return (
                    (this.tmr.lon_0 * (Math.PI / 180) +
                        (this.tileXToLong(x, z) * (Math.PI / 180)) /
                            Math.cos(this.tmr.lat_ts)) *
                    (180 / Math.PI)
                )
            case 'lambertazimuthalequalarea':
                var sx = this.tileXToSphereX(x, z)
                var sy = this.tileYToSphereY(parms.y, z)
                var long
                if (this.centerLat == 90)
                    long = this.centerLon + Math.atan2(sx, -sy)
                else if (this.centerLat == -90)
                    long = this.centerLon + Math.atan2(sx, sy)
                else {
                    var p = Math.sqrt(Math.pow(sx, 2) + Math.pow(sy, 2))
                    var c = 2 * Math.asin(p / 2)
                    long =
                        this.centerLon +
                        Math.atan2(
                            sx * Math.sin(c),
                            p * Math.cos(this.centerLat) * Math.cos(c) -
                                parms.y * Math.sin(this.centerLat) * Math.sin(c)
                        )
                }
                return long
            default:
                console.warn('Unknown projection: ' + projection)
        }
    },
    tile2lat: function (y, z, parms) {
        parms = parms || {}
        switch (parms.projection || this.projection) {
            case 'webmercator':
                var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
                return (
                    (180 / Math.PI) *
                    Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
                )
            case 'stereographic(N)':
                var sx = this.tileXToSphereX(parms.x, z)
                var sy = this.tileYToSphereY(y, z)
                //console.log( sx, sy );
                var p = Math.sqrt(Math.pow(sx, 2) + Math.pow(sy, 2))
                var c = 2 * Math.atan2(p, 2)
                return Math.asin(Math.cos(c)) * (180 / Math.PI)
            case 'equidistantcylindrical':
                return this.tileYToLat(y, z) // - this.tmr.lat_ts;// - 13.5; //+ 29; //Figure this 29 out
            case 'lambertazimuthalequalarea':
                var sx = this.tileXToSphereX(parms.x, z)
                var sy = this.tileYToSphereY(y, z)
                var p = Math.sqrt(Math.pow(sx, 2) + Math.pow(sy, 2))
                var c = 2 * Math.asin(p / 2)
                //CONVERT RADIANS TO DEGREES!?
                return Math.asin(
                    Math.cos(c) * Math.sin(this.centerLat) +
                        (y * Math.sin(c) * Math.cos(this.centerLat)) / p
                )
            default:
                console.warn('Unknown projection: ' + projection)
        }
    },
    long2tile: function (lonlat, zoom, projection) {
        lonlat[0] = lonlat[0] * (Math.PI / 180)
        lonlat[1] = lonlat[1] * (Math.PI / 180)
        switch (projection || this.projection) {
            case 'webmercator': //lonlat is just lon
                return Math.floor(
                    ((lonlat[0] * (180 / Math.PI) + 180) / 360) *
                        Math.pow(2, zoom)
                )
            case 'stereographic(N)':
                var x =
                    2 *
                    1 *
                    1 *
                    Math.tan(Math.PI / 4 - lonlat[1] / 2) *
                    Math.sin(lonlat[0] - this.centerLon)
                return this.sphereXToTileXYZ(x, zoom)
            case 'equidistantcylindrical':
                return this.sphereXToTileXYZ(
                    (lonlat[0] - this.tmr.lon_0) * Math.cos(this.tmr.lat_ts),
                    zoom
                )
            case 'lambertazimuthalequalarea':
                var k = Math.sqrt(
                    2 /
                        (1 +
                            Math.sin(this.centerLat) * Math.sin(lonlat[1]) +
                            Math.cos(this.centerLat) *
                                Math.cos(lonlat[1]) *
                                Math.cos(lonlat[0] - this.centerLon))
                )
                return this.sphereXToTileXYZ(
                    k *
                        Math.cos(lonlat[1]) *
                        Math.sin(lonlat[0] - this.centerLon),
                    zoom
                )
            default:
                console.warn('Unknown projection: ' + projection)
        }
    },
    lat2tile: function (lonlat, zoom, projection) {
        lonlat[0] = lonlat[0] * (Math.PI / 180)
        lonlat[1] = lonlat[1] * (Math.PI / 180)
        switch (projection || this.projection) {
            case 'webmercator':
                return Math.floor(
                    ((1 -
                        Math.log(
                            Math.tan(lonlat[1]) + 1 / Math.cos(lonlat[1])
                        ) /
                            Math.PI) /
                        2) *
                        Math.pow(2, zoom)
                )
            case 'stereographic(N)':
                lonlat[0] =
                    (lonlat[0] * (180 / Math.PI) - this.stereNOffset[0]) *
                    (Math.PI / 180)
                var y =
                    2 *
                    1 *
                    1 *
                    Math.tan(Math.PI / 4 - lonlat[1] / 2) *
                    Math.cos(lonlat[0] - this.centerLon)
                return this.sphereYToTileXYZ(y, zoom)
            case 'equidistantcylindrical':
                return this.sphereYToTileXYZ(lonlat[1], zoom) // + this.tmr.lat_ts;
            case 'lambertazimuthalequalarea':
                var k = Math.sqrt(
                    2 /
                        (1 +
                            Math.sin(this.centerLat) * Math.sin(lonlat[1]) +
                            Math.cos(this.centerLat) *
                                Math.cos(lonlat[1]) *
                                Math.cos(lonlat[0] - this.centerLon))
                )
                //console.log( k );
                //console.log( k * ( ( Math.cos( this.centerLat ) * Math.sin( lonlat[1] ) ) - ( Math.sin( this.centerLat ) * Math.cos( lonlat[1] ) * Math.cos( lonlat[0] - this.centerLon ) ) ) );
                return this.sphereYToTileXYZ(
                    k *
                        (Math.cos(this.centerLat) * Math.sin(lonlat[1]) -
                            Math.sin(this.centerLat) *
                                Math.cos(lonlat[1]) *
                                Math.cos(lonlat[0] - this.centerLon)),
                    zoom
                )
            default:
                console.warn('Unknown projection: ' + projection)
        }
    },
    tileXToLong: function (x, z) {
        //easting = (tilesize(256) x tilecolumn x Zoomlevel(unit/pixel)) + (numXpixels x Zoomlevel(unit/pixel)) + minX
        let easting = 256 * x * this.tmr.res[z] + this.tmrBoundsMod[0]
        return easting
    },
    tileYToLat: function (y, z) {
        //northing = (tilesize(256) x tilerow x Zoomlevel(unit/pixel)) + (numYpixels x Zoomlevel(unit/pixel)) + minY
        let northing = 256 * y * this.tmr.res[z] + this.tmrOriginMod[1]
        return northing
    },
    tileXToSphereX: function (x, z) {
        var v = [1, 1]
        //v[0] = (256 * this.tmr.res[0]) / (this.tmr.bounds[2] - this.tmr.bounds[0]);
        //v[1] = (this.tmr.bounds[2] - this.tmr.bounds[0]) / (256 * this.tmr.res[0]);
        //console.log( 'x', this.tmr.bounds[0], this.tmr.bounds[2], this.sphereBoundsX, ( x * ( 256 * this.tmr.res[z] ) ) + this.tmr.origin[0] );
        //console.log( x, this.tmr.res[z], this.tmr.origin[0] );
        //tilesets bounds to bounds
        var x2 = x * 1 // ( ( this.tmr.bounds[2] - this.tmr.bounds[0] ) / ( 256 * this.tmr.res[z] * Math.pow( 2, z ) ) );
        //return linearScale( [this.tmr.bounds[0], this.tmr.bounds[2]], this.sphereBoundsX,
        //  ( x2 * ( this.tmr.bounds[2] - this.tmr.bounds[0] ) ) + this.tmr.origin[0] );
        return linearScale(
            [this.tmrBoundsMod[0], this.tmrBoundsMod[2]],
            this.sphereBoundsX,
            x * (256 * this.tmr.res[z]) + this.tmrOriginMod[0]
        )
    },
    tileYToSphereY: function (y, z) {
        var v = [1, 1]
        //v[0] = (256 * this.tmr.res[0]) / (this.tmr.bounds[3] - this.tmr.bounds[1]);
        //v[1] = (this.tmr.bounds[3] - this.tmr.bounds[1]) / (256 * this.tmr.res[0]);
        //y = parseInt( y ) + ( 1 - ( y % 1 ) );
        //console.log( this.tmrBoundsMod[1], this.tmrBoundsMod[3], this.sphereBoundsY[0], this.sphereBoundsY[1], 256 * this.tmr.res[z], this.tmrOriginMod[1] );
        var y2 = y * 1 //( ( this.tmr.bounds[3] - this.tmr.bounds[1] ) / ( 256 * this.tmr.res[z] * Math.pow( 2, z ) ) );
        //return linearScale( [this.tmr.bounds[1], this.tmr.bounds[3]], this.sphereBoundsY,
        //  ( y2 * ( this.tmr.bounds[3] - this.tmr.bounds[1] ) ) + this.tmr.origin[1] );
        return linearScale(
            [this.tmrBoundsMod[1], this.tmrBoundsMod[3]],
            this.sphereBoundsY,
            y2 * (256 * this.tmr.res[z] * v[1]) + this.tmrOriginMod[1] * v[0]
        )
    },
    sphereXToTileXYZ: function (x, z) {
        //console.log( 'x', x );
        //var x2 = x * ( ( this.tmr.bounds[2] - this.tmr.bounds[0] ) / ( 256 * this.tmr.res[z] * Math.pow( 2, z ) ) );
        return (
            (linearScale(
                this.sphereBoundsX,
                [this.tmrBoundsMod[0], this.tmrBoundsMod[2]],
                x
            ) -
                this.tmrOriginMod[0]) /
            (256 * this.tmr.res[z])
        )
    },
    sphereYToTileXYZ: function (y, z) {
        //May need to invert y
        //var y2 = y * ( ( this.tmr.bounds[3] - this.tmr.bounds[1] ) / ( 256 * this.tmr.res[z] * Math.pow( 2, z ) ) );
        var ty =
            (linearScale(
                this.sphereBoundsY,
                [this.tmrBoundsMod[1], this.tmrBoundsMod[3]],
                y
            ) -
                this.tmrOriginMod[1]) /
            (256 * this.tmr.res[z])
        return ty //parseInt( ty ) + ( 1- ( ty % 1 ) );
    },
    lonLatDistBetween: function (lon1, lat1, lon2, lat2) {
        //Haversine
        var R = this.radiusOfPlanetMajor //radius of Mars(m)
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
    lonLatToVector3: function (lon, lat, height) {
        var phi = lat * (Math.PI / 180)
        var theta = (lon - 180) * (Math.PI / 180)

        var x =
            ((this.radiusOfPlanetMajor + height) / this.radiusScale) *
            Math.cos(phi) *
            Math.sin(theta)
        var y =
            (-(this.radiusOfPlanetMajor + height) / this.radiusScale) *
            Math.sin(phi)
        var z =
            (-(this.radiusOfPlanetMajor + height) / this.radiusScale) *
            Math.cos(phi) *
            Math.cos(theta)

        return { x: x, y: y, z: z }
    },
    vector3ToLonLatOLD: function (xyz) {
        //the 90, 180, 270, 360 subtractions/additions/mods are just to match my coordinate system
        var phi = Math.atan2(xyz.z, xyz.x) * (180 / Math.PI) - 90
        if (phi < -180) phi += 360
        var theta =
            Math.acos(xyz.y / (this.radiusOfPlanetMajor / this.radiusScale)) *
                (180 / Math.PI) -
            90
        return { lon: phi, lat: theta }
    },
    vector3ToLonLat: function (xyz) {
        var y = xyz.y
        var z = xyz.z
        xyz.y = -z
        xyz.z = -y
        var rs = this.radiusOfPlanetMajor / this.radiusScale
        var rs2 = this.radiusOfPlanetMinor / this.radiusScale
        var r = Math.sqrt(Math.pow(xyz.x, 2) + Math.pow(xyz.y, 2))
        var E2 = Math.pow(rs, 2) - Math.pow(rs2, 2)
        var F = 54 * Math.pow(rs, 2) * Math.pow(xyz.z, 2)
        var G =
            Math.pow(r, 2) +
            (1 - Math.pow(this.e, 2)) * Math.pow(xyz.z, 2) -
            Math.pow(this.e, 2) * E2
        var C = (Math.pow(this.e, 4) * F * Math.pow(r, 2)) / Math.pow(G, 3)
        var S = Math.cbrt(1 + C + Math.sqrt(Math.pow(C, 2) + 2 * C))
        var P = F / (3 * Math.pow(S + 1 / S + 1, 2) * Math.pow(G, 2))
        var Q = Math.sqrt(1 + 2 * Math.pow(this.e, 4) * P)
        var r0 =
            -(P * Math.pow(this.e, 2) * r) / (1 + Q) +
            Math.sqrt(
                0.5 * Math.pow(rs, 2) * (1 + 1 / Q) -
                    (P * (1 - Math.pow(this.e, 2)) * Math.pow(xyz.z, 2)) /
                        (Q * (1 + Q)) -
                    0.5 * P * Math.pow(r, 2)
            )
        var U = Math.sqrt(r - Math.pow(this.e, 2) * r0 + Math.pow(xyz.z, 2))
        var V = Math.sqrt(
            Math.pow(r - Math.pow(this.e, 2) * r0, 2) +
                (1 - Math.pow(this.e, 2)) * Math.pow(xyz.z, 2)
        )
        var Z0 = (Math.pow(rs2, 2) * xyz.z) / (rs * V)
        var h = U * (1 - Math.pow(rs2, 2) / (rs * V))
        var phi =
            Math.atan((xyz.z + Math.pow(this.ep, 2) * Z0) / r) * (180 / Math.PI)
        var lambda = -(Math.atan2(xyz.y, xyz.x) * (180 / Math.PI)) - 90
        if (lambda < -180) lambda += 360
        return { lon: lambda, lat: phi, height: h }
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
}

/*
 * domain - [start, end]
 * range - [newStart, newEnd]
 * value - some value to map from the domain to the range
 * example - ([0, 10], [0, 20], 10) returns 20
 * example - ([0, 10], [0, 20], 5) returns 10
 * example - ([0, 10], [10, 20], 0) returns 10
 * example - ([0, 1], [0, 100], -1) returns -100
 * example - ([0, 1], [90, 100], -1) returns 80
 * example - ([1, 0], [90, 100], -1) returns 110
 */
function linearScale(domain, range, value) {
    return (
        ((range[1] - range[0]) * (value - domain[0])) /
            (domain[1] - domain[0]) +
        range[0]
    )
}

export default projection
