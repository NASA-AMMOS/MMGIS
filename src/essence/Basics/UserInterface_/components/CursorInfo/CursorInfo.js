//CursorInfo is a div that follows the mouse around
// with options to hide, show and change its message

/*use like:
  CursorInfo.update( message[string], time[num or null], isError[bool], position[{x: y:}] );
  if time is null, you can use CursorInfo.hide() to hide it.
*/
import $ from 'jquery'
import { pointer } from 'd3-selection'
import { safeHTML } from '../../../../services/Sanitize'

var CursorInfo = {
    //The div that will follow the mouse around
    cursorInfoDiv: null,
    forcedPos: false,
    _lockTimeout: null,
    _locked: false,
    //Creates that div and adds the mousemove event so it follows the cursor
    init: function () {
        CursorInfo.cursorInfoDiv = $('<div>')
            .attr('id', 'cursorInfo')
            .css({
                'position': 'absolute',
                'left': 0,
                'top': 0,
                'padding': '5px 9px 4px 9px',
                'line-height': '22px',
                'border': '1px solid #17586E',
                'border-radius': '3px',
                'background-color': 'var(--color-a)',
                'color': '#DCDCDC',
                'font-weight': 'bold',
                'font-size': '16px',
                'white-space': 'pre-wrap',
                //'box-shadow': '0px 5px 15px #000',
                'z-index': '60000000',
                'pointer-events': 'none',
                'display': 'none'
            })
        $('body').append(CursorInfo.cursorInfoDiv)

        $('body').on('mousemove', cursorInfoMouseMove)
    },
    //Use jquery to fade in out then set display to none and clear inner html
    hide: function (immediate) {
        if (CursorInfo._locked) {
            return
        }
        if (immediate) {
            CursorInfo.cursorInfoDiv.css('display', 'none').html('')
        } else {
            $('#cursorInfo').fadeOut(300, function () {
                CursorInfo.cursorInfoDiv.css('display', 'none').html('')
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
                .css('left', position.x + 'px')
                .css('top', Math.max(40, position.y) + 'px')
        }
        if (withoutPadding) {
            CursorInfo.cursorInfoDiv.css('padding', 0)
        } else {
            CursorInfo.cursorInfoDiv.css('padding', '5px 9px 4px 9px')
        }

        $('#cursorInfo').stop()
        CursorInfo.cursorInfoDiv.css('display', 'block').css('opacity', 1)
        CursorInfo.cursorInfoDiv
            .css('background-color', function () {
                if (forceColor != null) return forceColor
                return isError ? '#cd0437' : 'var(--color-a)'
            })
            .css('color', function () {
                if (forceFontColor != null) return forceFontColor
                return '#DCDCDC'
            })
            .css('border', function () {
                return isError || withBorder
                    ? '1px solid var(--color-a)'
                    : 'none'
            })
            .css('display', 'block')
        if (
            typeof message === 'object' &&
            !Array.isArray(message) &&
            message !== null
        ) {
            let messageFormatted = ''
            const keys = Object.keys(message)
            keys.forEach((k, idx) => {
                if (typeof k === 'string')
                    messageFormatted += `<span style="color: var(--color-a5);">${safeHTML(k.capitalizeFirstLetter())}:</span> ${
                        safeHTML(String(message[k]))
                    }${idx === keys.length - 1 ? '' : '\n'}`
            })
            CursorInfo.cursorInfoDiv.html(messageFormatted)
        } else {
            if (asHTML) CursorInfo.cursorInfoDiv.html(safeHTML(message))
            else CursorInfo.cursorInfoDiv.text(message)
        }

        if (time != null) {
            setTimeout(function () {
                $('#cursorInfo').fadeOut(400, function () {
                    CursorInfo.cursorInfoDiv.css('display', 'none').html('')
                    CursorInfo.forcedPos = false
                })
            }, time)
        }
    },
    //Remove everything CursorInfo created
    remove: function () {
        $('body').off('mousemove', cursorInfoMouseMove)
        $('#cursorInfo').remove()
    },
}

//Just match our absolutely positioned div to the bottom left of our cursor
function cursorInfoMouseMove(e) {
    if (CursorInfo.forcedPos) return

    CursorInfo.cursorInfoDiv
        .css('left', pointer(e)[0] + 18 + 'px')
        .css('top', pointer(e)[1] + 10 + 'px')
}

export default CursorInfo
