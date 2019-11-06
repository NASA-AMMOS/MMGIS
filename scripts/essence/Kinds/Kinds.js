define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
], function($, d3, F_, L_) {

    var Kinds = {
        use( kind, Map_, feature, layer ) {
            if( typeof kind !== 'string' ) return;

            switch(kind.toLowerCase()) {
                case 'waypoint':
                    break;
                case 'edl_wedge':
                    Map_.rmNotNull(Map_.tempOverlayWedge)

                    var wedges = F_.getBaseGeoJSON()
                    var arcAngle = 50
                    var wedgeStart = 300 / F_.metersInOneDegree
                    var wedgeEnd = 635 / F_.metersInOneDegree
                
                    let wA = feature.properties.wedge_angl;
                    let lLat = feature.properties.gcLat_deg;
                    let lLon = feature.properties.long_deg;
                    let zLat = feature.properties.wedge_zero;
                    let zLon = feature.properties.wedge_ze_1;
                    let plusPrime = feature.properties.is_plus_we

                    //Plus
                    wedges.features.push( {
                        type: 'Feature',
                        properties: {
                            radius: 6,
                            opacity: 1,
                            fillColor: plusPrime ? 'green' : 'black',
                            fillOpacity: 0,
                            color: plusPrime ? 'lime' : 'black',
                            weight: 2,
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[]]
                        }
                    } )
                    //Minus
                    wedges.features.push( {
                        type: 'Feature',
                        properties: {
                            radius: 6,
                            opacity: 1,
                            fillColor: plusPrime ? 'black' : 'green',
                            fillOpacity: 0,
                            color: plusPrime ? 'black' : 'lime',
                            weight: 2
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[]]
                        }
                    } )
                    //Zero
                    wedges.features.push( {
                        type: 'Feature',
                        properties: {
                            radius: 3,
                            opacity: 1,
                            fillColor: 'yellow',
                            fillOpacity: 1,
                            color: 'black',
                            weight: 2
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [zLon, zLat]
                        }
                    } )
                    //Plus sign
                    let o = 0.00035; //Offset
                    let pC = [wedgeEnd + (o * 3.5), 0] //Plus Center
                    let plusCenter = F_.rotatePoint( {x: pC[0], y: pC[1]}, [0,0],
                        (wA) * (Math.PI/180) )
                    pC = [plusCenter.x, plusCenter.y]
                    wedges.features.push( {
                        type: 'Feature',
                        properties: {
                            radius: 4,
                            opacity: 1,
                            fillColor: 'yellow',
                            fillOpacity: 1,
                            color: 'yellow',
                            weight: 3
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[pC[0], pC[1]],[pC[0] - o, pC[1]], [pC[0], pC[1]], [pC[0], pC[1] + o], [pC[0], pC[1]], [pC[0] + o, pC[1]], [pC[0], pC[1]], [pC[0], pC[1] - o], [pC[0], pC[1]]]
                        }
                    } )
                    //Minus sign
                    let mC = [wedgeEnd + (o * 3.5), 0] //Minus Center
                    let minusCenter = F_.rotatePoint( {x: mC[0], y: mC[1]}, [0,0],
                        (wA + 180) * (Math.PI/180) )
                    mC = [minusCenter.x, minusCenter.y]
                    wedges.features.push( {
                        type: 'Feature',
                        properties: {
                            radius: 4,
                            opacity: 1,
                            fillColor: 'yellow',
                            fillOpacity: 1,
                            color: 'yellow',
                            weight: 3
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [[mC[0], mC[1]], [mC[0] - o, mC[1]], [mC[0], mC[1]], [mC[0] + o, mC[1]], [mC[0], mC[1]]]
                        }
                    } )
                    //Landing point
                    wedges.features.push( {
                        type: 'Feature',
                        properties: {
                            radius: 5,
                            opacity: 1,
                            fillColor: 'red',
                            fillOpacity: 1,
                            color: 'black',
                            weight: 2
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [lLon, lLat]
                        }
                    } )

                    //Add and rotate
                    for( var a = arcAngle / 2; a >= -arcAngle / 2; a -= 0.5 ) {
                        var rp = F_.rotatePoint( {x: wedgeStart, y: 0}, [0,0],
                            (a + wA) * (Math.PI/180) )
                        wedges.features[0].geometry.coordinates[0].push([rp.x, rp.y])
                        wedges.features[1].geometry.coordinates[0].push([-rp.x, -rp.y])
                    }
                    for( var a = -arcAngle / 2; a <= arcAngle / 2; a += 0.5 ) {
                        var rp = F_.rotatePoint( {x: wedgeEnd, y: 0}, [0,0],
                            (a + wA) * (Math.PI/180) )
                        wedges.features[0].geometry.coordinates[0].push([rp.x, rp.y])
                        wedges.features[1].geometry.coordinates[0].push([-rp.x, -rp.y])
                    }
                    wedges.features[0].geometry.coordinates[0].push([wedges.features[0].geometry.coordinates[0][0][0], wedges.features[0].geometry.coordinates[0][0][1] ])
                    wedges.features[1].geometry.coordinates[0].push([wedges.features[1].geometry.coordinates[0][0][0], wedges.features[1].geometry.coordinates[0][0][1] ])
                    wedges.features[1].geometry.coordinates[0] = wedges.features[1].geometry.coordinates[0].reverse()

                    //Translate wedges
                    for( var i = 0; i < wedges.features[0].geometry.coordinates[0].length; i++ ) {
                        wedges.features[0].geometry.coordinates[0][i][0] += zLon
                        wedges.features[0].geometry.coordinates[0][i][1] += zLat
                        wedges.features[1].geometry.coordinates[0][i][0] += zLon
                        wedges.features[1].geometry.coordinates[0][i][1] += zLat
                    }
                    //Translate Plus Sign
                    for( var i = 0; i < wedges.features[3].geometry.coordinates.length; i++ ) {
                        wedges.features[3].geometry.coordinates[i][0] += zLon
                        wedges.features[3].geometry.coordinates[i][1] += zLat
                    }
                    //Translate Minus Sign
                    for( var i = 0; i < wedges.features[4].geometry.coordinates.length; i++ ) {
                        wedges.features[4].geometry.coordinates[i][0] += zLon
                        wedges.features[4].geometry.coordinates[i][1] += zLat
                    }

                    Map_.tempOverlayWedge = L.geoJson(wedges, {
                        style: function(feature) {
                            return {
                                radius: feature.properties.radius,
                                opacity: feature.properties.opacity,
                                fillColor: feature.properties.fillColor,
                                fillOpacity: feature.properties.fillOpacity,
                                color: feature.properties.color,
                                weight: feature.properties.weight,
                                className: 'kindsWedgeLayer',
                            }
                        },
                        pointToLayer: function(feature, latlong) {
                            return L.circleMarker(
                                latlong,{}
                            ).setRadius(4)
                        }
                    })
                    Map_.tempOverlayWedge
                        .addTo(Map_.map)
                        .bringToBack()
                    break;
                default:
                    return
            }
        }
    }

    return Kinds
} )