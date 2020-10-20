//CursorInfo is a div that follows the mouse around
// with options to hide, show and change its message

/*use like:
  CursorInfo.update( message[string], time[num or null], isError[bool], position[{x: y:}] );
  if time is null, you can use CursorInfo.hide() to hide it.
*/

define(['jquery', 'd3'], function ($, d3) {
    var CursorInfo = {
        //The div that will follow the mouse around
        cursorInfoDiv: null,
        forcedPos: false,
        //Creates that div and adds the mousemove event so it follows the cursor
        init: function () {
            CursorInfo.cursorInfoDiv = d3
                .select('body')
                .append('div')
                .attr('id', 'cursorInfo')
                .style('position', 'absolute')
                .style('left', 0)
                .style('top', 0)
                .style('padding', '6px 9px 6px 9px')
                .style('border', '1px solid #17586E')
                .style('border-radius', '3px')
                .style('background-color', 'var(--color-a)')
                .style('color', '#DCDCDC')
                .style('font-weight', 'bold')
                .style('font-size', '16px')
                //.style( 'box-shadow', '0px 5px 15px #000' )
                .style('z-index', '9001')
                .style('pointer-events', 'none')
                .style('display', 'none')

            d3.select('body').on('mousemove', cursorInfoMouseMove)
        },
        //Use jquery to fade in out then set display to none and clear inner html
        hide: function (immediate) {
            if (immediate) {
                CursorInfo.cursorInfoDiv.style('display', 'none').html('')
            } else {
                $('#cursorInfo').fadeOut(300, function () {
                    CursorInfo.cursorInfoDiv.style('display', 'none').html('')
                })
            }
        },
        //Shows the div with message for time and isError just changes the color
        //Optional: position { x: , y: }
        update: function (
            message,
            time,
            isError,
            position,
            forceColor,
            forceFontColor
        ) {
            if (position) {
                CursorInfo.forcedPos = true
                CursorInfo.cursorInfoDiv
                    .style('left', position.x + 'px')
                    .style('top', position.y + 'px')
            }
            $('#cursorInfo').stop()
            CursorInfo.cursorInfoDiv
                .style('display', 'block')
                .style('opacity', 1)
            CursorInfo.cursorInfoDiv
                .style('background-color', function () {
                    if (forceColor != null) return forceColor
                    return isError ? '#cd0437' : 'var(--color-a)'
                })
                .style('color', function () {
                    if (forceFontColor != null) return forceFontColor
                    return '#DCDCDC'
                })
                .style('border', function () {
                    return isError ? '1px solid var(--color-a)' : 'none'
                })
                .style('display', 'block')
                .html(message)

            if (time != null) {
                setTimeout(function () {
                    $('#cursorInfo').fadeOut(400, function () {
                        CursorInfo.cursorInfoDiv
                            .style('display', 'none')
                            .html('')
                        CursorInfo.forcedPos = false
                    })
                }, time)
            }
        },
        //Remove everything CursorInfo created
        remove: function () {
            d3.select('body').off('mousemove', cursorInfoMouseMove)
            d3.select('#cursorInfo').remove()
        },
    }

    //Just match our absolutely positioned div to the bottom left of our cursor
    function cursorInfoMouseMove() {
        if (CursorInfo.forcedPos) return

        CursorInfo.cursorInfoDiv
            .style('left', d3.mouse(this)[0] + 18 + 'px')
            .style('top', d3.mouse(this)[1] + 10 + 'px')
    }

    return CursorInfo
})
