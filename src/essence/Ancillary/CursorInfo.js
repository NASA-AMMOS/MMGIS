//CursorInfo is a div that follows the mouse around
// with options to hide, show and change its message

/*use like:
  CursorInfo.update( message[string], time[num or null], isError[bool], position[{x: y:}] );
  if time is null, you can use CursorInfo.hide() to hide it.
*/
import $ from 'jquery'
import * as d3 from 'd3'

var CursorInfo = {
    //The div that will follow the mouse around
    cursorInfoDiv: null,
    forcedPos: false,
    _lockTimeout: null,
    _locked: false,
    //Creates that div and adds the mousemove event so it follows the cursor
    init: function () {
        CursorInfo.cursorInfoDiv = d3
            .select('body')
            .append('div')
            .attr('id', 'cursorInfo')
            .style('position', 'absolute')
            .style('left', 0)
            .style('top', 0)
            .style('padding', '5px 9px 4px 9px')
            .style('line-height', '22px')
            .style('border', '1px solid #17586E')
            .style('border-radius', '3px')
            .style('background-color', 'var(--color-a)')
            .style('color', '#DCDCDC')
            .style('font-weight', 'bold')
            .style('font-size', '16px')
            .style('white-space', 'pre-wrap')
            //.style( 'box-shadow', '0px 5px 15px #000' )
            .style('z-index', '60000000')
            .style('pointer-events', 'none')
            .style('display', 'none')

        d3.select('body').on('mousemove', cursorInfoMouseMove)
    },
    //Use jquery to fade in out then set display to none and clear inner html
    hide: function (immediate) {
        if (CursorInfo._locked) {
            return
        }
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
        forceFontColor,
        asHTML,
        withBorder,
        withoutPadding,
        lockMS
    ) {
        if (CursorInfo._locked) {
            return
        }
        if (lockMS != null && lockMS > 0) {
            CursorInfo._locked = true
            clearTimeout(CursorInfo._lockTimeout)
            CursorInfo._lockTimeout = setTimeout(() => {
                CursorInfo._locked = false
            }, lockMS)
        }

        if (position) {
            CursorInfo.forcedPos = true
            CursorInfo.cursorInfoDiv
                .style('left', position.x + 'px')
                .style('top', Math.max(40, position.y) + 'px')
        }
        if (withoutPadding) {
            CursorInfo.cursorInfoDiv.style('padding', 0)
        } else {
            CursorInfo.cursorInfoDiv.style('padding', '5px 9px 4px 9px')
        }

        $('#cursorInfo').stop()
        CursorInfo.cursorInfoDiv.style('display', 'block').style('opacity', 1)
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
                return isError || withBorder
                    ? '1px solid var(--color-a)'
                    : 'none'
            })
            .style('display', 'block')
        if (
            typeof message === 'object' &&
            !Array.isArray(message) &&
            message !== null
        ) {
            let messageFormatted = ''
            const keys = Object.keys(message)
            keys.forEach((k, idx) => {
                if (typeof k === 'string')
                    messageFormatted += `<span style="color: var(--color-a5);">${k.capitalizeFirstLetter()}:</span> ${
                        message[k]
                    }${idx === keys.length - 1 ? '' : '\n'}`
            })
            CursorInfo.cursorInfoDiv.html(messageFormatted)
        } else {
            if (asHTML) CursorInfo.cursorInfoDiv.html(message)
            else CursorInfo.cursorInfoDiv.text(message)
        }

        if (time != null) {
            setTimeout(function () {
                $('#cursorInfo').fadeOut(400, function () {
                    CursorInfo.cursorInfoDiv.style('display', 'none').html('')
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
function cursorInfoMouseMove(e) {
    if (CursorInfo.forcedPos) return

    CursorInfo.cursorInfoDiv
        .style('left', d3.pointer(e)[0] + 18 + 'px')
        .style('top', d3.pointer(e)[1] + 10 + 'px')
}

export default CursorInfo
