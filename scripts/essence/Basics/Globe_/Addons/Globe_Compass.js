define(['d3', 'three', 'Formulae_'], function(d3, THREE, F_) {
    var Globe_Compass = {
        getElement: function() {
            // prettier-ignore
            return [ "<div id='Globe_Compass' style='width: 50px; height: 50px; position: relative;'>",
                "<div style='position: absolute; left: 20px; bottom: 48px; font-family: venus; font-size: 9px; font-weight: bold;'>N</div>",
                "<svg width='50' height='50'>",
                    "<circle cx='25' cy='25' r='25' stroke='white' stroke-width='0' fill='rgba(0,0,0,0.35)' />",
                    "<path id='Globe_CompassArc' fill='#26a8ff' stroke='#26a8ff' stroke-width='0'></path>",
                    "<line x1='25' y1='0' x2='25' y2='25' style='stroke:rgb(255,255,255);stroke-width:2' />",
                    "<line x1='50' y1='25' x2='45' y2='25' style='stroke:rgb(255,255,255);stroke-width:2' />",
                    "<line x1='25' y1='50' x2='25' y2='45' style='stroke:rgb(255,255,255);stroke-width:2' />",
                    "<line x1='0' y1='25' x2='5' y2='25' style='stroke:rgb(255,255,255);stroke-width:2' />",
                "</svg>",
                "<div id='Globe_CompassAzimuth' style='position: absolute; left: 0px; bottom: 0px; width: 100%; height: 100%; opacity: 0; font-size: 12px; transition: opacity 0.2s ease-out; font-weight: bold; padding: 15px 0px; text-align: center; background: radial-gradient(rgb(31, 31, 31), rgba(0, 0, 0, 0) 88%);'></div>",
            "</div>" ].join( '' );
        },
        attachEvents: function() {
            $('#Globe_CompassAzimuth').on('mouseenter', function() {
                $(this).css('opacity', '1')
            })
            $('#Globe_CompassAzimuth').on('mouseleave', function() {
                $(this).css('opacity', '0')
            })
        },
        setDirection: function(isFirst, camera, angle, fov) {
            var arc
            if (camera != undefined) {
                if (isFirst) {
                    angle =
                        -(
                            (camera.controls.getObject().rotation.y %
                                (Math.PI * 2)) +
                            Math.PI
                        ) *
                        (180 / Math.PI)
                } else {
                    var x = camera.camera.position.x
                    var z = camera.camera.position.z
                    angle = Math.atan2(x, z) * (180 / Math.PI)
                }
                fov = camera.camera.fov
            }
            var start = angle - fov / 2
            var end = angle + fov / 2
            arc = describeArc(25, 25, 25, start, end)

            d3.select('#Globe_CompassArc').attr('d', arc)

            if (angle < 0) angle += 360
            d3.select('#Globe_CompassAzimuth').html(parseInt(angle) + '&deg;')
        },
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        var angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0

        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians),
        }
    }

    function describeArc(x, y, radius, startAngle, endAngle) {
        var start = polarToCartesian(x, y, radius, endAngle)
        var end = polarToCartesian(x, y, radius, startAngle)

        var largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

        var d = [
            'M',
            start.x,
            start.y,
            'A',
            radius,
            radius,
            0,
            largeArcFlag,
            0,
            end.x,
            end.y,
            'L',
            x,
            y,
        ].join(' ')

        return d
    }

    return Globe_Compass
})
