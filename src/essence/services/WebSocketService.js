import WebSocket from 'isomorphic-ws'
import Toast from '../../design-system/components/Toast/Toast'
import L_ from '../Basics/Layers_/Layers_'
import * as _UserInterface_ from '../Basics/UserInterface_/UserInterface_'
import calls from '../../pre/calls'

const UserInterface_ = await _UserInterface_.default()

// Server-push websocket: connect/retry and route messages for the current mission
const WebSocketService = {
    ws: null,
    initialRetryInterval: 60000, // 1 minute
    retryInterval: 60000, // Doubles while disconnected
    pingInterval: null,
    getMission: () => L_.mission,
    // Builds the ws(s) path from mmgisglobal
    getPath: function () {
        const port = parseInt(window.mmgisglobal.PORT || '8888', 10)
        const protocol =
            window.location.protocol.indexOf('https') !== -1 ? 'wss' : 'ws'
        const rootPath =
            window.mmgisglobal.WEBSOCKET_ROOT_PATH ||
            window.mmgisglobal.ROOT_PATH ||
            ''
        return window.mmgisglobal.NODE_ENV === 'development'
            ? `${protocol}://${window.location.hostname}:${port}${rootPath}/`
            : `${protocol}://${window.location.host}${rootPath}/`
    },
    isEnabled: function () {
        return (
            window.mmgisglobal.PORT &&
            window.mmgisglobal.ENABLE_MMGIS_WEBSOCKETS === 'true'
        )
    },
    // getMission returns the DB mission name used to filter incoming messages
    start: function (getMission) {
        if (!WebSocketService.isEnabled()) return
        if (typeof getMission === 'function')
            WebSocketService.getMission = getMission

        const path = WebSocketService.getPath()
        WebSocketService.connect(path, true)
        WebSocketService.pingInterval = setInterval(
            WebSocketService.connect,
            WebSocketService.retryInterval,
            path,
            false
        )
    },
    connect: function (path, initial) {
        // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
        const ws = WebSocketService.ws
        if (ws === undefined || ws === null || ws.readyState === 3) {
            WebSocketService.open(path)

            // First attempt: not connected yet, so no retry needed
            if (!initial) {
                clearInterval(WebSocketService.pingInterval)
                WebSocketService.retryInterval =
                    WebSocketService.retryInterval * 2
                WebSocketService.pingInterval = setInterval(
                    WebSocketService.connect,
                    WebSocketService.retryInterval,
                    path,
                    false
                )
            }
        }
    },
    open: function (path) {
        const ws = new WebSocket(path)
        WebSocketService.ws = ws

        ws.onerror = function (e) {
            console.log(`Unable to connect to WebSocket at ${path}`)

            Toast.dismissAll()

            const asMinutes = WebSocketService.retryInterval / 60000 || ''
            Toast.error(
                `Not connected to WebSocket. Retrying in ${
                    asMinutes >= 1 ? parseInt(asMinutes) : asMinutes.toFixed(2)
                } minute${asMinutes > 1 ? 's' : ''}...`,
                10000
            )
        }

        ws.onopen = function () {
            console.log('Websocket connection opened...')

            UserInterface_.removeLayerUpdateButton()

            Toast.dismissAll()

            if (
                WebSocketService.retryInterval >
                WebSocketService.initialRetryInterval
            ) {
                WebSocketService.retryInterval =
                    WebSocketService.initialRetryInterval
                clearInterval(WebSocketService.pingInterval)
                WebSocketService.pingInterval = setInterval(
                    WebSocketService.connect,
                    WebSocketService.retryInterval,
                    path,
                    false
                )
            }
        }

        ws.onmessage = function (data) {
            if (data.data) {
                try {
                    WebSocketService.onMessage(JSON.parse(data.data))
                } catch (e) {
                    console.warn(
                        `Error parsing data from MMGIS websocket: ${e}`
                    )
                }
            }
        }

        ws.onclose = function () {
            console.log('Closed websocket connection...', new Date())
            UserInterface_.updateLayerUpdateButton('DISCONNECTED')
        }
    },
    onMessage: function (parsed) {
        // Ignore messages for other missions (DB mission name)
        const mission = WebSocketService.getMission()
        if (!parsed.body.mission || parsed.body.mission !== mission) return

        let type, layerName
        if ('info' in parsed) {
            ;({ type, layerName } = parsed.info)

            if (
                type === 'addLayer' ||
                type === 'updateLayer' ||
                type === 'removeLayer'
            ) {
                WebSocketService.onConfigLayerChange(
                    mission,
                    type,
                    layerName,
                    parsed.forceClientUpdate
                )
            } else if (type === 'refreshLayer') {
                // Notify-only: re-query the named layer(s) without refetching the config
                L_.requeryLayers(
                    Array.isArray(layerName) ? layerName : [layerName]
                )
            } else if (parsed.body && parsed.body.config) {
                UserInterface_.updateLayerUpdateButton('RELOAD')
            }
        } else if (parsed.body && parsed.body.config) {
            UserInterface_.updateLayerUpdateButton('RELOAD')
        }

        document.dispatchEvent(
            new CustomEvent('websocketChange', {
                detail: {
                    layer: typeof layerName !== 'undefined' ? layerName : null,
                    type: typeof type !== 'undefined' ? type : null,
                    data: parsed,
                },
            })
        )
    },
    // Refetches the full config and queues the changed layer(s)
    onConfigLayerChange: function (
        mission,
        type,
        layerName,
        forceClientUpdate
    ) {
        calls.api(
            'get',
            {
                mission,
                full: true,
            },
            async function (response) {
                // Extract DB mission name and attach to config
                const data = response.config || response
                if (response.mission) {
                    data._dbMissionName = response.mission
                }

                const names = Array.isArray(layerName) ? layerName : [layerName]
                for (const newLayerName of names) {
                    L_.addLayerQueue.push({
                        newLayerName,
                        data,
                        type,
                    })
                }

                if (forceClientUpdate) {
                    // Force update the client side
                    await L_.updateQueueLayers()
                } else {
                    UserInterface_.updateLayerUpdateButton('ADD_LAYER')
                }
            },
            function (e) {
                console.warn(
                    "Warning: Couldn't load: " + mission + ' configuration.'
                )
            }
        )
    },
}

export default WebSocketService
