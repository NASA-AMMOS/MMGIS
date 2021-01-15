import container from './container'
import WebVR from '../../../external/THREE/WebVR'

let r = {
    init: function (container) {
        container = container || {}

        var webglSupport = (function () {
            try {
                var canvas = document.createElement('canvas')
                return !!(
                    window.WebGLRenderingContext &&
                    (canvas.getContext('webgl') ||
                        canvas.getContext('experimental-webgl'))
                )
            } catch (e) {
                return false
            }
        })()
        container.innerHTML = ''
        var renderer

        if (webglSupport) {
            renderer = new THREE.WebGLRenderer({
                logarithmicDepthBuffer: false,
                alpha: true,
            })
            renderer.setClearColor(0x000000, 0)
            renderer.sortObjects = false
            renderer.autoClear = false
            renderer.listenVrTurnedOn = function (listening) {
                renderer.vrTurnedOn = listening
            }
            renderer.listenVrTurnedOff = function (listening) {
                renderer.vrTurnedOff = listening
            }

            var gl = renderer.getContext()
            gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE)

            renderer.xr.enabled = true
            container.appendChild(WebVR.createButton(renderer))

            container.appendChild(renderer.domElement)

            renderer.setPixelRatio(window.devicePixelRatio)
            var updateSize = function () {
                renderer.setSize(container.offsetWidth, container.offsetHeight)
            }
            window.addEventListener('resize', updateSize, false)
            updateSize()

            return renderer
        } else {
            container.innerHTML =
                "<div style='margin-bottom: 5px;'>Seems like <a target='_blank' href='https://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation'>WebGL</a> isn't supported for you.</div><div>Find out how to get it <a target='_blank' href='https://get.webgl.org/'>here</a>.</div>"
            container.style.textAlign = 'center'
            container.style.fontSize = '18px'
            console.warn('WebGL Not Supported')
        }
    },
}
export default r
