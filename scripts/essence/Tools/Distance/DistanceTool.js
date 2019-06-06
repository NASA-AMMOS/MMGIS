function DistanceTool() {
    this.remove = function() {
        MMWebGISInterface.separateFromMMWebGIS()
    }

    var toolLayer = []
    var toolLayerCurrent = []

    var distToolLayer
    var distanceData = []
    var distLineToMouse,
        distMousePoint = null

    var MMWebGISInterface = new interfaceWithMMWebGIS()

    function distOnClick(e) {
        var xy = { x: e.latlng.lat, y: e.latlng.lng }

        distanceData.push(xy)
        makeDistToolLayer()
    }

    function distOnMove(e) {
        if (distanceData.length > 0) {
            if (distLineToMouse != null) {
                map.removeLayer(distLineToMouse)
                distLineToMouse = null
            }
            if (distMousePoint != null) {
                map.removeLayer(distMousePoint)
                distMousePoint = null
            }

            var i1 = distanceData.length - 1
            var endDC = distanceData[i1]
            //console.log(distanceData[i1].x + " " + distanceData[i1].y + " " + e.latlng.lat + " " + e.latlng.lng);
            var distAzimuth =
                Math.round(
                    ((Math.atan2(
                        e.latlng.lng - distanceData[0].y,
                        e.latlng.lat - distanceData[0].x
                    ) *
                        180) /
                        Math.PI) *
                        10
                ) / 10
            if (distAzimuth < 0) distAzimuth = 360 + distAzimuth //Map to 0 to 360 degrees
            var roundedDist =
                Math.round(
                    latLongDistBetween(
                        distanceData[i1].y,
                        distanceData[i1].x,
                        e.latlng.lng,
                        e.latlng.lat
                    ) * 10
                ) / 10
            //using actual latlng as meters:
            //var roundedDist = Math.round(Math.sqrt(Math.pow(distanceData[i1].x - e.latlng.lat, 2) + Math.pow(distanceData[i1].y - e.latlng.lng, 2)) * 10)/10;
            var roundedTotalDist =
                Math.round(
                    (totalDistToIndex(distanceData.length) + roundedDist) * 10
                ) / 10
            distLineToMouse = new L.Polyline(
                [new L.LatLng(endDC['x'], endDC['y']), e.latlng],
                {
                    className: 'noPointerEvents',
                    color: 'red',
                    dashArray: '3, 15',
                }
            ).addTo(map)
            distMousePoint = new L.circleMarker(e.latlng, {
                className: 'noPointerEvents',
                color: 'red',
            }).setRadius(3)
            distMousePoint.bindLabel(
                '' +
                    roundedTotalDist +
                    'm\n (+' +
                    roundedDist +
                    'm) ' +
                    distAzimuth +
                    '&deg;',
                {
                    noHide: true,
                    className: 'distLabel',
                    className: 'noPointerEvents',
                    offset: [15, -15],
                }
            )
            distMousePoint.addTo(map)
        }
    }

    function makeDistToolLayer() {
        rmNotNull(distToolLayer)

        var pointsAndPathArr = []
        var polylinePoints = []
        var temp
        for (var i = 0; i < distanceData.length; i++) {
            temp = new L.circleMarker([
                distanceData[i].x,
                distanceData[i].y,
            ]).setRadius(3)
            if (i > 0) {
                var roundedDist =
                    Math.round(
                        latLongDistBetween(
                            distanceData[i].y,
                            distanceData[i].x,
                            distanceData[i - 1].y,
                            distanceData[i - 1].x
                        ) * 10
                    ) / 10
                var roundedTotalDist =
                    Math.round(totalDistToIndex(i + 1) * 10) / 10
                var distAzimuth =
                    Math.round(
                        ((Math.atan2(
                            distanceData[i].y - distanceData[0].y,
                            distanceData[i].x - distanceData[0].x
                        ) *
                            180) /
                            Math.PI) *
                            10
                    ) / 10
                if (distAzimuth < 0) distAzimuth = 360 + distAzimuth //Map to 0 to 360 degrees
                if (
                    d3.select('#distToolRadioLabel .active').html() ==
                        'Labels On' ||
                    i == distanceData.length - 1
                )
                    temp.bindLabel(
                        '' + roundedTotalDist + 'm ' + distAzimuth + '&deg;',
                        {
                            noHide: true,
                            className: 'distLabel',
                            offset: [10, -15],
                        }
                    )
            }
            pointsAndPathArr.push(temp)
            polylinePoints.push(
                new L.LatLng(distanceData[i].x, distanceData[i].y)
            )
        }
        pointsAndPathArr.push(new L.Polyline(polylinePoints, { color: 'red' }))
        distToolLayer = L.featureGroup(pointsAndPathArr).addTo(map)
    }
    function undoDistanceTool() {
        distanceData.pop()
        makeDistToolLayer()
    }
    function newDistanceTool() {
        distanceData = []
        map.removeLayer(distLineToMouse)
        map.removeLayer(distMousePoint)
        map.removeLayer(distToolLayer)
    }

    function totalDistToIndex(l) {
        var totalDistance = 0
        for (var i = 1; i < l; i++) {
            //Sum up segement distance
            totalDistance += latLongDistBetween(
                distanceData[i].y,
                distanceData[i].x,
                distanceData[i - 1].y,
                distanceData[i - 1].x
            )
            //using actual latlng as meters:
            //totalDistance += Math.sqrt(Math.pow(distanceData[i].x - distanceData[i-1].x, 2) + Math.pow(distanceData[i].y - distanceData[i-1].y, 2));
        }
        return totalDistance
    }

    function interfaceWithMMWebGIS() {
        this.separateFromMMWebGIS = function() {
            separateFromMMWebGIS()
        }
        //initializations
        map.on('click', distOnClick).on('mousemove', distOnMove)

        d3.select('#distToolBNew').on('click', newDistanceTool)
        d3.select('#distToolBUndo').on('click', undoDistanceTool)
        d3.select('#distToolRadioLabel').on('click', makeDistToolLayer)

        d3.select('#map').style('cursor', 'default')

        //removals
        function separateFromMMWebGIS() {
            map.off('click', distOnClick).off('mousemove', distOnMove)

            d3.select('#distToolBNew').on('click', null)
            d3.select('#distToolBUndo').on('click', null)
            d3.select('#distToolRadioLabel').on('click', null)
            d3.select('#map').style('cursor', 'grab')

            rmNotNull(distLineToMouse)
            rmNotNull(distMousePoint)
            rmNotNull(distToolLayer)
        }
    }
}
