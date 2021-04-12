/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 *
 * Based on @tojiro's vr-samples-utils.js
 */
var WEBVR = {
    createButton: function (renderer) {
        function showEnterVR(display, navi) {
            button.className = '_WEBVR_Button'
            button.style.display = ''
            button.style.cursor = 'pointer'
            button.style.width = '45px'
            button.style.height = '35px'
            button.style.backgroundImage =
                'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjAwJyBoZWlnaHQ9JzIwMCcgZmlsbD0iI2ZmZmZmZiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDkwIDkwIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCA5MCA5MCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHBhdGggZD0iTTgxLjY3MSwyMS4zMjNjLTIuMDg1LTIuMDg0LTcyLjUwMy0xLjU1My03NC4wNTQsMGMtMS42NzgsMS42NzgtMS42ODQsNDYuMDMzLDAsNDcuNzEzICBjMC41NTgsMC41NTksMTIuMTUxLDAuODk2LDI2LjAwNywxLjAxMmwzLjA2OC04LjQ4NmMwLDAsMS45ODctOC4wNCw3LjkyLTguMDRjNi4yNTcsMCw4Ljk5LDkuNjc1LDguOTksOS42NzVsMi41NTUsNi44NDggIGMxMy42MzMtMC4xMTYsMjQuOTU3LTAuNDUzLDI1LjUxNC0xLjAwOEM4My4yMjQsNjcuNDgzLDgzLjY3MiwyMy4zMjQsODEuNjcxLDIxLjMyM3ogTTI0LjU3Miw1NC41ODIgIGMtNi4wNjMsMC0xMC45NzgtNC45MTQtMTAuOTc4LTEwLjk3OWMwLTYuMDYzLDQuOTE1LTEwLjk3OCwxMC45NzgtMTAuOTc4czEwLjk3OSw0LjkxNSwxMC45NzksMTAuOTc4ICBDMzUuNTUxLDQ5LjY2OCwzMC42MzUsNTQuNTgyLDI0LjU3Miw1NC41ODJ6IE02NC4zMzQsNTQuNTgyYy02LjA2MywwLTEwLjk3OS00LjkxNC0xMC45NzktMTAuOTc5ICBjMC02LjA2Myw0LjkxNi0xMC45NzgsMTAuOTc5LTEwLjk3OGM2LjA2MiwwLDEwLjk3OCw0LjkxNSwxMC45NzgsMTAuOTc4Qzc1LjMxMiw0OS42NjgsNzAuMzk2LDU0LjU4Miw2NC4zMzQsNTQuNTgyeiIvPjwvc3ZnPg==")'
            button.style.backgroundRepeat = 'no-repeat'
            button.style.backgroundSize = '35px 35px'
            button.style.backgroundPosition = 'right center'

            button.onmouseenter = function () {
                button.style.opacity = '1.0'
            }
            button.onmouseleave = function () {
                button.style.opacity = '0.25'
            }

            button.onclick = function () {
                if (display.isPresenting) {
                    display.exitPresent()
                    renderer.vrTurnedOff(navi)
                } else {
                    display.requestPresent([{ source: renderer.domElement }])
                    renderer.vrTurnedOn(navi)
                }
            }

            if (typeof renderer.vr.setDevice === 'function')
                renderer.vr.setDevice(display)
        }

        function showVRNotFound() {
            button.style.display = ''

            button.style.cursor = 'auto'
            button.style.width = '45px'
            button.style.height = '35px'
            button.style.backgroundImage =
                'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjAwJyBoZWlnaHQ9JzIwMCcgZmlsbD0iI2ZmZmZmZiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDkwIDkwIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCA5MCA5MCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHBhdGggZD0iTTgxLjY3MSwyMS4zMjNjLTIuMDg1LTIuMDg0LTcyLjUwMy0xLjU1My03NC4wNTQsMGMtMS42NzgsMS42NzgtMS42ODQsNDYuMDMzLDAsNDcuNzEzICBjMC41NTgsMC41NTksMTIuMTUxLDAuODk2LDI2LjAwNywxLjAxMmwzLjA2OC04LjQ4NmMwLDAsMS45ODctOC4wNCw3LjkyLTguMDRjNi4yNTcsMCw4Ljk5LDkuNjc1LDguOTksOS42NzVsMi41NTUsNi44NDggIGMxMy42MzMtMC4xMTYsMjQuOTU3LTAuNDUzLDI1LjUxNC0xLjAwOEM4My4yMjQsNjcuNDgzLDgzLjY3MiwyMy4zMjQsODEuNjcxLDIxLjMyM3ogTTI0LjU3Miw1NC41ODIgIGMtNi4wNjMsMC0xMC45NzgtNC45MTQtMTAuOTc4LTEwLjk3OWMwLTYuMDYzLDQuOTE1LTEwLjk3OCwxMC45NzgtMTAuOTc4czEwLjk3OSw0LjkxNSwxMC45NzksMTAuOTc4ICBDMzUuNTUxLDQ5LjY2OCwzMC42MzUsNTQuNTgyLDI0LjU3Miw1NC41ODJ6IE02NC4zMzQsNTQuNTgyYy02LjA2MywwLTEwLjk3OS00LjkxNC0xMC45NzktMTAuOTc5ICBjMC02LjA2Myw0LjkxNi0xMC45NzgsMTAuOTc5LTEwLjk3OGM2LjA2MiwwLDEwLjk3OCw0LjkxNSwxMC45NzgsMTAuOTc4Qzc1LjMxMiw0OS42NjgsNzAuMzk2LDU0LjU4Miw2NC4zMzQsNTQuNTgyeiIvPjwvc3ZnPg==")'
            button.style.backgroundRepeat = 'no-repeat'
            button.style.backgroundSize = '35px 35px'
            button.style.backgroundPosition = 'right center'

            button.onmouseenter = function () {
                button.style.opacity = '1.0'
                button.style.width = '144px'
                button.textContent = 'VR NOT FOUND'
            }
            button.onmouseleave = function () {
                button.style.opacity = '0.25'
                button.style.width = '45px'
                button.textContent = ''
            }

            button.onclick = null

            if (typeof renderer.vr.setDevice === 'function')
                renderer.vr.setDevice(null)
        }

        function stylizeElement(element) {
            element.style.position = 'absolute'
            element.style.right = '5px'
            element.style.bottom = '43px'
            element.style.border = 'none'
            element.style.borderRadius = '4px'
            element.style.background = 'transparent'
            element.style.color = '#fff'
            element.style.font = 'normal 13px sans-serif'
            element.style.textAlign = 'left'
            element.style.opacity = '0.25'
            element.style.outline = 'none'
            element.style.zIndex = '999'
            element.style.whiteSpace = 'nowrap'
            element.style.transition = 'opacity 0.2s ease-out'
        }

        if ('getVRDisplays' in navigator) {
            var button = document.createElement('button')
            button.style.display = 'none'

            stylizeElement(button)

            window.addEventListener(
                'vrdisplayconnect',
                function (event) {
                    showEnterVR(event.display, navigator)
                },
                false
            )

            window.addEventListener(
                'vrdisplaydisconnect',
                function (event) {
                    showVRNotFound()
                },
                false
            )

            window.addEventListener(
                'vrdisplaypresentchange',
                function (event) {
                    button.textContent = '' //event.display.isPresenting ? 'EXIT VR' : 'ENTER VR';
                },
                false
            )

            navigator.getVRDisplays().then(function (displays) {
                if (displays.length > 0) {
                    showEnterVR(displays[0], navigator)
                } else {
                    showVRNotFound()
                }
            })

            return button
        } else {
            var message = document.createElement('a')
            /*
                    message.href = 'https://webvr.info';
                    message.innerHTML = 'WEBVR NOT SUPPORTED';

                    message.style.width = '180px';
                    message.style.textDecoration = 'none';

                    stylizeElement( message );
                    console.warn('WEBVR NOT SUPPORTED')
                */
            return message
        }
    },

    // DEPRECATED

    checkAvailability: function () {
        console.warn('WEBVR.checkAvailability has been deprecated.')
        return new Promise(function () {})
    },

    getMessageContainer: function () {
        console.warn('WEBVR.getMessageContainer has been deprecated.')
        return document.createElement('div')
    },

    getButton: function () {
        console.warn('WEBVR.getButton has been deprecated.')
        return document.createElement('div')
    },

    getVRDisplay: function () {
        console.warn('WEBVR.getVRDisplay has been deprecated.')
    },
}
export default WEBVR
