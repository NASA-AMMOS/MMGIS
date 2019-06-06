define(['jquery', 'd3', 'Layers_', 'ToolController_', 'Map_'], function(
    $,
    d3,
    L_,
    TC_,
    Map_
) {
    // prettier-ignore
    var markup = [
    "<div id='Test_' style='position: absolute; top: 0px; right: 0px; width: 50%; height: 100%; font-family: monospace; padding: 0px 0px 0px 8px; background: rgba(0, 19, 31, 0.8); box-shadow: -5px 0px 10px rgba(0,0,0,0.3); border-left: 1px solid rgba(255,255,255,0.4);'>",
      //"<div id='Test_Start' class='mmgisButton3'>Start</div>",
      "<ul id='Test_Messages' class='mmgisScrollbar' style='list-style-type: none; margin: 0px; padding: 0px; padding-bottom: 18px; height: calc( 100% - 35px ); overflow-y: auto;'></ul>",
      "<div id='Test_Results' style='display: inline-flex; padding-top: 5px; width: 100%; border-top: 1px solid rgba(255,255,255,0.4);'>",
        "<div style='display: inline-flex; font-weight: bold; color: black; background: lime; border-radius: 3px; padding: 2px 4px; margin-right: 5px;'>Pass: <div id='Test_Pass'></div></div>",
        "<div style='display: inline-flex; font-weight: bold; color: white; background: red; border-radius: 3px; padding: 2px 4px; margin-right: 5px;'>Fail: <div id='Test_Fail'></div></div>",
        "<div style='display: inline-flex; font-weight: bold; color: black; background: white; border-radius: 3px; padding: 2px 4px; margin-right: 5px;'>Total: <div id='Test_Total'></div></div>",
      "</div>",
    "</div>"
  ].join('\n');

    Test_ = {
        testsInitialized: false,
        isOpen: false,
        testModuleNames: [],
        testModules: [],
        results: {
            pass: 0,
            fail: 0,
            finished: 0,
            total: 0,
        },
        init: function(thenStart) {
            this.testModuleNames = Object.assign([], TC_.toolModuleNames)
            for (var i = 0; i < this.testModuleNames.length; i++) {
                this.testModuleNames[i] += '_test'
            }
            //$( '#Test_Start' ).on( 'click', this.start );
            this.testModuleNames = ['CampTool_test']
            require(this.testModuleNames, function() {
                Test_.testModules = arguments
                Test_.testsInitialized = true
                if (thenStart === true) Test_.start()
            })
        },
        toggle: function() {
            if (this.isOpen) {
                this.close()
            } else {
                this.open()
            }
        },
        open: function() {
            this.isOpen = true
            $('body').append(markup)
            this.start()
        },
        start: function() {
            if (this.testsInitialized) {
                $('#Test_Messages > li').remove()
                this.results = {
                    pass: 0,
                    fail: 0,
                    finished: 0,
                    total: 0,
                }

                for (var i = 0; i < this.testModules.length; i++) {
                    this.testModules[i].run(Test_.addMessage)
                }
            } else {
                Test_.init(true)
            }
        },
        addMessage(name, message, pass, isHeader) {
            var color1 = pass ? 'lime' : 'red'
            var color2 = pass ? 'black' : 'white'

            if (isHeader) {
                limarkup = [
                    "<li style='color: white; margin: 14px 0px 4px 0px; font-size: 15px;'>",
                    "<span style='font-weight: bold; color: " +
                        color2 +
                        '; background: ' +
                        color1 +
                        "; border-radius: 3px; padding: 2px 4px; margin-right: 5px;'>" +
                        name +
                        '</span>' +
                        message,
                    '</li>',
                ].join('\n')

                $('#Test_Messages').append(limarkup)
            } else {
                var icon = pass
                    ? "<i class='mdi mdi-check-outline mdi-18px'></i>"
                    : "<i class='mdi mdi-close-outline mdi-18px'></i>"

                var limarkup = [
                    "<li style='color: " + color1 + "; margin: 2px 0px;'>",
                    icon,
                    message,
                    '</li>',
                ].join('\n')
                $('#Test_Messages').append(limarkup)

                Test_.results.finished++
                if (pass) Test_.results.pass++
                else Test_.results.fail++
                $('#Test_Pass').text(Test_.results.pass)
                $('#Test_Fail').text(Test_.results.fail)
                $('#Test_Fail')
                    .parent()
                    .css({
                        background:
                            'rgba(255,0,0,' +
                            (Test_.results.fail > 0 ? 1 : 0) +
                            ')',
                    })
                $('#Test_Total').text(
                    Test_.results.finished + '/' + Test_.results.total
                )

                $('#Test_Messages').animate(
                    { scrollTop: $('#Test_Messages').prop('scrollHeight') },
                    100
                )
            }
        },
        close: function() {
            this.isOpen = false
            $('#Test_').remove()
        },
        //From: https://stackoverflow.com/questions/3277369/how-to-simulate-a-click-by-using-x-y-coordinates-in-javascript
        fireEvent: function(event, x, y) {
            x = x || 0
            y = y || 0
            var ev = document.createEvent('MouseEvent')
            var el = document.elementFromPoint(x, y)
            ev.initMouseEvent(
                event,
                true /* bubble */,
                true /* cancelable */,
                window,
                null,
                x,
                y,
                0,
                0 /* coordinates */,
                false,
                false,
                false,
                false /* modifier keys */,
                0 /*left*/,
                null
            )
            el.dispatchEvent(ev)
        },
        mapEvent: function(event, lat, lng, offsetFromCenter) {
            lat = lat || 0
            lng = lng || 0
            if (offsetFromCenter) {
                var center = Map_.map.getCenter()
                lat = center.lat + lat
                lng = center.lng + lng
            }
            var latlngPoint = new L.LatLng(lat, lng)
            Map_.map.fireEvent(event, {
                latlng: latlngPoint,
                layerPoint: Map_.map.latLngToLayerPoint(latlngPoint),
                containerPoint: Map_.map.latLngToContainerPoint(latlngPoint),
            })
        },
    }

    return Test_
})
