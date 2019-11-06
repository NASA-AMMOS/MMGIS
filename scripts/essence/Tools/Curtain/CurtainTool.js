define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'Globe_',
    'Map_',
    'Viewer_',
    'UserInterface_',
    'fabricA',
], function($, d3, F_, L_, Globe_, Map_, Viewer_, UserInterface_, fabric) {
    // prettier-ignore
    var markup = [
    "<div>",
      "<div style='text-align: center;'>",
        "Click a RIMFAX traversal and pick through its radargrams below.",
      "</div>",
      "<div id='CurtainToolList'>",
      "</div>",
    "</div>",
    "<div id='CurtainToolLoadingBar'></div>"
  ].join('\n');

    var w

    var topCircle, connectRect, cursorCircle, cursorText, canvas

    var CurtainTool = {
        height: 48,
        width: 434,
        vars: {},
        MMGISInterface: null,
        boundFunctions: {},
        curtainMapLayer: null,
        radargramWidth: 0,
        radargramHeight: 0,
        fabricScale: 1000,
        mapFocusLayer: null,
        init: function() {
            this.vars = L_.getToolVars('curtain')
        },
        make: function() {
            this.MMGISInterface = new interfaceWithMMGIS()
        },
        destroy: function() {
            this.MMGISInterface.separateFromMMGIS()
            stopWorker()
        },
    }

    //
    function interfaceWithMMGIS() {
        this.separateFromMMGIS = function() {
            separateFromMMGIS()
        }

        //MMGIS should always have a div with id 'tools'
        var tools = d3.select('#tools')
        //Clear it
        tools.selectAll('*').remove()
        //Add a semantic container
        tools = tools
            .append('div')
            .attr('class', 'center aligned ui padded grid')
            .style('height', '100%')
            .style('padding', '5px')
            .style('position', 'relative')
        //Add the markup to tools or do it manually
        tools.html(markup)

        $('#CurtainToolLoadingBar').css({
            position: 'absolute',
            left: '0px',
            bottom: '-2px',
            width: '0%',
            height: '3px',
            padding: '0',
            background: 'linear-gradient( to left, #00FFFFff 8px, #00FFFFaa )',
            transition: 'width 0.4s ease-out, opacity 1s 0.5s ease-out',
        })

        //Add event functions and whatnot
        CurtainTool.boundFunctions.activatePelmet = {}
        function activatePelmet(dataUrl, e) {
            if (Map_.map.hasLayer(e.layer)) {
                CurtainTool.curtainMapLayer = e.layer
                var panePercents = UserInterface_.getPanelPercents()
                UserInterface_.setPanelPercents(
                    50,
                    panePercents.map / 2,
                    panePercents.globe / 2
                )
                Map_.map.panTo(e.latlng, false)
                $('#CurtainToolList').empty()
                if (dataUrl === 'image') {
                    //find first feature.properties.images that's a radargram
                    var p = e.layer.feature.properties
                    if (p.hasOwnProperty('images')) {
                        var i
                        for (i = 0; i < p.images.length; i++) {
                            if (p.images[i].type.toLowerCase() == 'radargram')
                                d3.select('#CurtainToolList')
                                    .append('div')
                                    .text(p.images[i].name)
                                    .on(
                                        'click',
                                        (function(index) {
                                            return function() {
                                                $(
                                                    '#CurtainToolList div'
                                                ).removeClass('active')
                                                d3.select(this).attr(
                                                    'class',
                                                    'active'
                                                )
                                                makeCurtainFromImage(
                                                    p.images[index].url,
                                                    p.images[index].length,
                                                    p.images[index].depth
                                                )
                                            }
                                        })(i)
                                    )
                        }

                        $('#CurtainToolList div:first-child').click()
                    }
                } else {
                    startWorker()
                    w.postMessage(
                        '../../../../' +
                            L_.missionPath +
                            'Layers/GPR_1/Data/binaries/RIMFAX_DeepMode_Engelskbukta.bin'
                    )
                }
                //makeCurtain( dataUrl, e.layer.feature.geometry );
            }
        }
        for (l in CurtainTool.vars.data) {
            if (L_.layersGroup[l]) {
                //Slightly ugly workaround for turning on and off parameterized events
                CurtainTool.boundFunctions.activatePelmet[
                    l
                ] = activatePelmet.bind(null, CurtainTool.vars.data[l])
                L_.layersGroup[l].on(
                    'click',
                    CurtainTool.boundFunctions.activatePelmet[l]
                )
            }
        }

        //Share everything. Don't take things that aren't yours.
        // Put things back where you found them.
        function separateFromMMGIS() {
            for (l in CurtainTool.vars.data) {
                if (L_.layersGroup[l]) {
                    L_.layersGroup[l].off(
                        'click',
                        CurtainTool.boundFunctions.activatePelmet[l]
                    )
                }
            }
        }
    }

    //Other functions
    function makeCurtainFromImage(url, length, depth) {
        detachFocusFromViewer()
        var radargram = new Image()
        radargram.src = L_.missionPath + url
        radargram.onload = function() {
            CurtainTool.curtainWidth = radargram.width
            CurtainTool.curtainHeight = radargram.height

            canvasUrl = L_.missionPath + url //canvas.toDataURL();

            //Annoying throws a warning. removeItem doesn't work
            Viewer_.imageViewerMap.world.removeAll()
            //Viewer_.imageViewerMap.removeLayer( Viewer_.imageViewerOverlay );

            Viewer_.changeImages([
                {
                    url: canvasUrl,
                    name: 'Radargram',
                    isPanoramic: false,
                    masterImg: canvasUrl,
                },
            ])
            Globe_.radargram(
                CurtainTool.curtainMapLayer.options.layerName,
                CurtainTool.curtainMapLayer.feature.geometry,
                canvasUrl,
                length,
                depth
            )
            attachFocusToViewer(length, depth)
        }
    }
    //(url, 'image')
    //(data, 'data')
    function makeCurtain(data) {
        detachFocusFromViewer()

        CurtainTool.curtainWidth = 1614
        CurtainTool.curtainHeight = 6504 / 8
        var dataX = CurtainTool.curtainWidth
        var dataY = CurtainTool.curtainHeight * 8
        var canvas = document.createElement('canvas')
        canvas.id = 'curtain'
        canvas.width = dataX
        canvas.height = dataY / 8
        var ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        for (var x = 0; x < dataX; x++) {
            for (var y = 0; y < dataY; y += 8) {
                var c = F_.getColorFromRangeByPercent(
                    [[0, 0, 0], [255, 255, 255]],
                    (data[x * dataY + y] + 20000) / 40000
                )
                incPixel(imgData, x, y / 8, c[0], c[1], c[2])
            }
        }
        ctx.putImageData(imgData, 0, 0)

        canvasUrl = canvas.toDataURL()
        Viewer_.changeImages([
            {
                url: canvasUrl,
                name: 'Radargram',
                isPanoramic: false,
                masterImg: canvasUrl,
            },
        ])
        Globe_.radargram(
            CurtainTool.curtainMapLayer.options.layerName,
            CurtainTool.curtainMapLayer.feature.geometry,
            canvasUrl
        )
        attachFocusToViewer()
    }
    function incPixel(imageData, x, y, r, g, b) {
        index = (x + y * imageData.width) * 4
        imageData.data[index + 0] = r
        imageData.data[index + 1] = g
        imageData.data[index + 2] = b
        imageData.data[index + 3] = 255
    }

    function attachFocusToViewer(length, depth) {
        detachFocusFromViewer()

        var overlay = Viewer_.imageViewerMap.fabricjsOverlay({
            scale: CurtainTool.fabricScale,
        })
        canvas = overlay.fabricCanvas()
        canvas.selection = false
        canvas.hoverCursor = 'default'
        var topCircleRadius = 12,
            cursorCircleRadius = 8
        var divider = 1
        if (CurtainTool.curtainWidth > 10000) divider = 2

        topCircleRadius /= divider
        cursorCircleRadius /= divider

        canvas.on('mouse:move', function(o) {
            //Viewer
            if (topCircle) canvas.remove(topCircle)
            if (connectRect) canvas.remove(connectRect)
            if (cursorCircle) canvas.remove(cursorCircle)
            if (cursorText) canvas.remove(cursorText)

            var pointer = canvas.getPointer(o.e)

            pointer.x = Math.max(0, pointer.x)
            pointer.x = Math.min(CurtainTool.fabricScale, pointer.x)
            pointer.y = Math.max(0, pointer.y)
            var maxY =
                CurtainTool.fabricScale *
                (CurtainTool.curtainHeight / CurtainTool.curtainWidth)
            pointer.y = Math.min(maxY, pointer.y)
            origX = pointer.x
            origY = pointer.y

            connectRect = new fabric.Rect({
                left: pointer.x,
                top: topCircleRadius,
                fill: '#eee',
                width: 1,
                height: Math.max(
                    pointer.y - topCircleRadius - cursorCircleRadius,
                    0
                ),
                evented: false,
                originX: 'center',
                originY: 'top',
            })
            connectRect.lockMovementX = true
            connectRect.lockMovementY = true
            canvas.add(connectRect)

            topCircle = new fabric.Circle({
                left: pointer.x,
                top: 0,
                radius: topCircleRadius,
                strokeWidth: 2,
                fill: '#7100b7',
                opacity: 0.9,
                stroke: '#eee',
                evented: false,
                originX: 'center',
                originY: 'center',
            })
            topCircle.lockMovementX = true
            topCircle.lockMovementY = true
            canvas.add(topCircle)

            cursorCircle = new fabric.Circle({
                left: pointer.x,
                top: pointer.y,
                radius: cursorCircleRadius,
                strokeWidth: 2 / divider,
                fill: 'transparent',
                stroke: '#eee',
                evented: false,
                originX: 'center',
                originY: 'center',
            })
            cursorCircle.lockMovementX = true
            cursorCircle.lockMovementY = true
            canvas.add(cursorCircle)

            if (length != null && depth != null) {
                cursorText = new fabric.Text(
                    ((pointer.y / maxY) * depth).toFixed(2) + 'm',
                    {
                        selectable: false,
                        top: pointer.y - cursorCircleRadius - 1,
                        left: pointer.x + cursorCircleRadius + 1,
                        fill: 'white',
                        fontFamily: 'Roboto',
                        fontSize: 12,
                    }
                    /*
          left: pointer.x,
          top: pointer.y,
          radius: cursorCircleRadius,
          strokeWidth: 2 / divider,
          fill: 'transparent',
          stroke: '#eee',
          evented: false,
          originX: 'center', originY: 'center'
        }
        */
                )
                cursorText.lockMovementX = true
                cursorText.lockMovementY = true
                canvas.add(cursorText)
            }

            var ll = pxToLngLat([pointer.x, pointer.y])
            if (ll) {
                //Map
                var llM = [ll.y, ll.x]
                Map_.rmNotNull(CurtainTool.mapFocusLayer)
                CurtainTool.mapFocusLayer = new L.circleMarker(llM, {
                    fillColor: '#7100b7',
                    fillOpacity: 0.9,
                    color: '#eee',
                    weight: 2,
                })
                    .setRadius(8)
                    .addTo(Map_.map)

                //Globe
                Globe_.setLink(
                    { lat: ll.y, lng: ll.x },
                    {
                        radius: 64,
                        fillColor: { r: 113, g: 0, b: 183, a: 0.9 },
                        strokeWeight: 12,
                        strokeColor: '#eee',
                    },
                    '_curtaintarget'
                )
            }
        })
    }
    function detachFocusFromViewer() {
        if (topCircle) canvas.remove(topCircle)
        if (connectRect) canvas.remove(connectRect)
        if (cursorCircle) canvas.remove(cursorCircle)
        if (cursorText) canvas.remove(cursorText)
    }

    function startWorker() {
        stopWorker()
        if (typeof Worker !== 'undefined') {
            if (typeof w == 'undefined') {
                w = new Worker(
                    './scripts/essence/Tools/Curtain/CurtainParser.worker.js'
                )
            }
            w.onmessage = function(event) {
                event = event.data
                if (event.status == 'done') {
                    $('#CurtainToolLoadingBar').css({
                        opacity: '0',
                    })
                    makeCurtain(event.data, 'data')
                } else if (event.status == 'progress') {
                    $('#CurtainToolLoadingBar').css({
                        opacity: '1',
                        width: event.progress * 100 + '%',
                    })
                }
            }
        } else {
            console.warn('Sorry, your browser does not support Web Workers.')
        }
    }

    function stopWorker() {
        if (w) {
            w.terminate()
            w = undefined
        }
    }

    //Helpers
    function pxToLngLat(xy) {
        //Built initially only for MultiLineString
        if (CurtainTool.curtainMapLayer) {
            //Get feature coordinates
            var g = CurtainTool.curtainMapLayer.feature.geometry.coordinates[0]
            if (
                CurtainTool.curtainMapLayer.feature.geometry.type ==
                'LineString'
            )
                g = CurtainTool.curtainMapLayer.feature.geometry.coordinates
            //Get length data
            var lengthArray = [0]
            var totalLength = 0
            var i0 = 1
            var i1 = 0
            if (true) {
                i0 = 0
                i1 = 1
            }
            for (var i = 1; i < g.length; i++) {
                var l = F_.lngLatDistBetween(
                    g[i - 1][i0],
                    g[i - 1][i1],
                    g[i][i0],
                    g[i][i1]
                )
                totalLength += l
                lengthArray.push(totalLength)
            }

            //Find xy's place
            var place = (xy[0] / CurtainTool.fabricScale) * totalLength
            for (var i = 1; i < lengthArray.length; i++) {
                if (place <= lengthArray[i]) {
                    var p =
                        (place - lengthArray[i - 1]) /
                        (lengthArray[i] - lengthArray[i - 1])
                    return F_.interpolatePointsPerun(
                        { x: g[i - 1][0], y: g[i - 1][1], z: g[i - 1][2] },
                        { x: g[i][0], y: g[i][1], z: g[i][2] },
                        p
                    )
                }
            }
        }
    }

    CurtainTool.init()

    return CurtainTool
})
