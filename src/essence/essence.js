/*
  Copyright 2019 NASA/JPL-Caltech

  Tariq Soliman
  Fred Calef III

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import $ from 'jquery'
import WebSocket from 'isomorphic-ws'
import M from 'materialize-css'
import F_ from './Basics/Formulae_/Formulae_'
import T_ from './Basics/Test_/Test_'
import L_ from './Basics/Layers_/Layers_'
import Viewer_ from './Basics/Viewer_/Viewer_'
import Map_ from './Basics/Map_/Map_'
import Globe_ from './Basics/Globe_/Globe_'
import UserInterface_ from './Basics/UserInterface_/UserInterface_'
import ToolController_ from './Basics/ToolController_/ToolController_'
import CursorInfo from './Ancillary/CursorInfo'
import ContextMenu from './Ancillary/ContextMenu'
import Coordinates from './Ancillary/Coordinates'
import Description from './Ancillary/Description'
import ScaleBar from './Ancillary/ScaleBar'
import ScaleBox from './Ancillary/ScaleBox'
import Compass from './Ancillary/Compass'
//import Swap from './Ancillary/Swap'
import QueryURL from './Ancillary/QueryURL'
import TimeControl from './Ancillary/TimeControl'
import calls from '../pre/calls'
import { mmgisAPI_, mmgisAPI } from './mmgisAPI/mmgisAPI'
import { makeMissionNotFoundDiv } from './LandingPage/LandingPage'
import { stylize } from './Ancillary/Stylize'
//Requiring UserInterface_ initializes itself

if (typeof window.mmgisglobal.groups === 'string') {
    window.mmgisglobal.groups = window.mmgisglobal.groups.replace(
        /&quot;/g,
        '"'
    )
    try {
        window.mmgisglobal.groups = JSON.parse(window.mmgisglobal.groups)
    } catch (err) {
        console.warn('User groups failed to parse.')
    }
}
if (typeof window.mmgisglobal.HOSTS === 'string') {
    try {
        window.mmgisglobal.HOSTS = JSON.parse(
            window.mmgisglobal.HOSTS.replace(/&quot;/gi, '"')
        )
    } catch (err) {
        window.mmgisglobal.HOSTS = {}
    }
} else {
    window.mmgisglobal.HOSTS = {}
}

if (typeof window.mmgisglobal.PORT === 'string') {
    window.mmgisglobal.PORT = parseInt(window.mmgisglobal.PORT || '8888', 10)
}

window.mmgisglobal.lastInteraction = Date.now()
$('body').on('mousemove', function () {
    window.mmgisglobal.lastInteraction = Math.floor(Date.now() / 1000)
})

window.mmgisglobal.ctrlDown = false
window.mmgisglobal.shiftDown = false
let tabFocusAdded = false
// Check whether control button and shift is pressed
//17 is ctrl, 91, 93, and 224 are MAC metakeys
$(document).keydown(function (e) {
    if (
        e.which == '17' ||
        e.which == '91' ||
        e.which == '93' ||
        e.which == '224'
    )
        window.mmgisglobal.ctrlDown = true
    if (e.which == '16') window.mmgisglobal.shiftDown = true
})
$(document).keyup(function (e) {
    if (
        e.which == '17' ||
        e.which == '91' ||
        e.which == '93' ||
        e.which == '224'
    )
        window.mmgisglobal.ctrlDown = false
    if (e.which == '16') window.mmgisglobal.shiftDown = false

    // On tab, add tab styles
    if (e.which == '9' && !tabFocusAdded) {
        document.styleSheets[0].insertRule(
            '.toolButton:focus,#barBottom > i:focus,#topBarTitleName:focus,.mainInfo > div:focus,#mainDescription:focus,#SearchType:focus,#auto_search:focus,#loginoutButton:focus,#mapSplitInnerLeft:focus,#mapSplitInnerRight:focus,#globeSplitInnerLeft:focus,#globeSplitInnerRight:focus {box-shadow: inset 0px 0px 0px 2px var(--color-mmgis) !important;}',
            1
        )
        tabFocusAdded = true
    }
})

$(document.body).keydown(function (e) {
    if (
        ToolController_.activeTool == null &&
        !$('#loginModal').length &&
        UserInterface_.getPanelPercents().globe == 0 &&
        e.shiftKey &&
        e.keyCode === 84
    ) {
        T_.toggle()
    }
})

var essence = {
    configData: null,
    hasSwapped: false,
    ws: null,
    initialWebSocketRetryInterval: 60000, // 1 minute
    webSocketRetryInterval: 60000, // Start with this time and double if disconnected
    webSocketPingInterval: null,
    connectWebSocket: function (path, initial) {
        // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
        if (
            essence.ws === undefined ||
            essence.ws === null ||
            (essence.ws && essence.ws.readyState === 3)
        ) {
            essence.initWebSocket(path)

            // If we're trying to start the WebSocket for the first time, we know we're not connected already
            // so  we don't need to retry to connect yet
            if (!initial) {
                clearInterval(essence.webSocketPingInterval)
                essence.webSocketRetryInterval =
                    essence.webSocketRetryInterval * 2
                essence.webSocketPingInterval = setInterval(
                    essence.connectWebSocket,
                    essence.webSocketRetryInterval,
                    path,
                    false
                ) // 10 seconds
            }
        }
    },
    initWebSocket: function (path) {
        essence.ws = new WebSocket(path)

        essence.ws.onerror = function (e) {
            console.log(`Unable to connect to WebSocket at ${path}`)

            M.Toast.dismissAll()

            const asMinutes = essence.webSocketRetryInterval / 60000 || ''
            M.toast({
                html: `Not connected to WebSocket. Retrying in ${
                    asMinutes >= 1 ? parseInt(asMinutes) : asMinutes.toFixed(2)
                } minute${asMinutes > 1 ? 's' : ''}...`,
                displayLength: 10000,
                classes: 'mmgisToast failure',
            })
        }

        essence.ws.onopen = function () {
            console.log('Websocket connection opened...')

            UserInterface_.removeLayerUpdateButton()

            M.Toast.dismissAll()

            if (
                essence.webSocketRetryInterval >
                essence.initialWebSocketRetryInterval
            ) {
                /*
                M.toast({
                    html: 'Successfully connected to WebSocket',
                    displayLength: 1600,
                    classes: 'mmgisToast',
                })
                */

                essence.webSocketRetryInterval =
                    essence.initialWebSocketRetryInterval
                clearInterval(essence.webSocketPingInterval)
                essence.webSocketPingInterval = setInterval(
                    essence.connectWebSocket,
                    essence.webSocketRetryInterval,
                    path,
                    false
                ) // 1 minute
            }
        }

        essence.ws.onmessage = function (data) {
            if (data.data) {
                try {
                    const parsed = JSON.parse(data.data)
                    const mission = essence.configData.msv.mission

                    if (
                        !parsed.body.mission ||
                        parsed.body.mission !== mission
                    ) {
                        return
                    }

                    if ('info' in parsed) {
                        const { type, layerName } = parsed.info

                        if (
                            type === 'addLayer' ||
                            type === 'updateLayer' ||
                            type === 'removeLayer'
                        ) {
                            calls.api(
                                'get',
                                {
                                    mission,
                                },
                                async function (data) {
                                    if (Array.isArray(layerName)) {
                                        // If we're adding an array of new layers, add each layer to the queue individually
                                        for (let layer in layerName) {
                                            L_.addLayerQueue.push({
                                                newLayerName: layerName[layer],
                                                data,
                                                type,
                                            })
                                        }
                                    } else {
                                        // Otherwise only a single new layer was added
                                        L_.addLayerQueue.push({
                                            newLayerName: layerName,
                                            data,
                                            type,
                                        })
                                    }

                                    if (parsed.forceClientUpdate) {
                                        // Force update the client side
                                        await L_.updateQueueLayers()
                                    } else {
                                        UserInterface_.updateLayerUpdateButton(
                                            'ADD_LAYER'
                                        )
                                    }
                                },
                                function (e) {
                                    console.warn(
                                        "Warning: Couldn't load: " +
                                            mission +
                                            ' configuration.'
                                    )
                                }
                            )
                        } else {
                            if (parsed.body && parsed.body.config) {
                                UserInterface_.updateLayerUpdateButton('RELOAD')
                            }
                        }
                    } else {
                        if (parsed.body && parsed.body.config) {
                            UserInterface_.updateLayerUpdateButton('RELOAD')
                        }
                    }

                    // Dispatch `websocketChange` event
                    let _event = new CustomEvent('websocketChange', {
                        detail: {
                            layer:
                                typeof layerName !== 'undefined'
                                    ? layerName
                                    : null,
                            type: typeof type !== 'undefined' ? type : null,
                            data: parsed,
                        },
                    })
                    document.dispatchEvent(_event)
                } catch (e) {
                    console.warn(
                        `Error parsing data from MMGIS websocket: ${e}`
                    )
                }
            }
        }

        essence.ws.onclose = function () {
            console.log('Closed websocket connection...', new Date())
            UserInterface_.updateLayerUpdateButton('DISCONNECTED')
        }
    },
    init: async function (config, missionsList, swapping) {
        //Save the config data
        essence.configData = config

        //Make sure url matches mission
        var urlSplit = window.location.href.split('?')
        var url = urlSplit[0]

        if (
            urlSplit.length == 1 ||
            swapping ||
            (urlSplit[1] && urlSplit[1].split('=')[0] === 'forcelanding') ||
            (urlSplit[1] && urlSplit[1].split('=')[0] === '_preview')
        ) {
            //then no parameters or old ones
            url =
                window.location.href.split('?')[0] +
                '?mission=' +
                config.msv.mission
            window.history.replaceState('', '', url)
            L_.url = window.location.href
        }

        if (swapping) {
            essence.hasSwapped = true
            L_.clear()
            //UserInterface_.refresh();
        }

        //Try querying the urlSite
        var urlOnLayers = null
        if (!swapping) urlOnLayers = QueryURL.queryURL()

        //Parse all the configData
        await L_.init(essence.configData, missionsList, urlOnLayers)

        if (swapping) {
            ToolController_.clear()
            Viewer_.clearImage()
            //ToolController_.init( L_.tools );
        }
        //Update mission title
        document.title =
            (window.mmgisglobal.name || 'MMGIS') + ' - ' + L_.mission
        //Set radii
        F_.setRadius('major', L_.radius.major)
        F_.setRadius('minor', L_.radius.minor)
        //Initialize CursorInfo
        if (!swapping) CursorInfo.init()

        //Make the globe
        if (!swapping) Globe_.init()

        //Make the viewer
        if (!swapping) Viewer_.init()

        //Make the map
        if (swapping) Map_.clear()

        //Make the time control
        TimeControl.init()

        Map_.init(essence.fina)

        //Now that the map is made
        Coordinates.init()
        ContextMenu.init()

        if (!swapping) {
            Description.init(L_.mission, L_.site, Map_, L_)
            ScaleBar.init(ScaleBox)
            Compass.init()
        } else {
            Coordinates.refresh()
            ScaleBar.refresh()
            Compass.refresh()
        }

        //Swap.make(this)

        // Enable MMGIS backend websockets
        if (
            window.mmgisglobal.PORT &&
            window.mmgisglobal.ENABLE_MMGIS_WEBSOCKETS === 'true'
        ) {
            const port = parseInt(window.mmgisglobal.PORT || '8888', 10)
            const protocol =
                window.location.protocol.indexOf('https') !== -1 ? 'wss' : 'ws'
            const path =
                window.mmgisglobal.NODE_ENV === 'development'
                    ? `${protocol}://localhost:${port}${
                          window.mmgisglobal.WEBSOCKET_ROOT_PATH ||
                          window.mmgisglobal.ROOT_PATH ||
                          ''
                      }/`
                    : `${protocol}://${window.location.host}${
                          window.mmgisglobal.WEBSOCKET_ROOT_PATH ||
                          window.mmgisglobal.ROOT_PATH ||
                          ''
                      }/`

            essence.connectWebSocket(path, true)
            essence.webSocketPingInterval = setInterval(
                essence.connectWebSocket,
                essence.webSocketRetryInterval,
                path,
                false
            ) // 10 seconds
        }
    },
    swapMission(to) {
        //console.log( to );
        //Close all tools since they only update when reopened
        ToolController_.closeActiveTool()

        if (window.mmgisglobal.SERVER == 'node') {
            calls.api(
                'get',
                {
                    mission: to,
                },
                function (data) {
                    essence.makeMission(data)
                },
                function (e) {
                    console.log(
                        "Warning: Couldn't load: " + to + ' configuration.'
                    )
                    makeMissionNotFoundDiv()
                }
            )
        } else {
            $.getJSON(
                'Missions/' +
                    to +
                    '/' +
                    'config.json' +
                    '?nocache=' +
                    new Date().getTime(),
                async function (data) {
                    await essence.makeMission(data)
                }
            ).fail(function () {
                console.log(
                    "Warning: Couldn't load: " +
                        'Missions/' +
                        to +
                        '/' +
                        'config.json'
                )
                makeMissionNotFoundDiv()
            })
        }
    },
    makeMission: async function (data) {
        //Remove swap tool from data.tools
        for (var i = data.tools.length - 1; i > 0; i--) {
            if (data.tools[i].name === 'Swap') {
                data.tools.splice(i, 1)
            }
        }
        //Add swap to data.tools
        if (essence.configData) {
            for (var i in essence.configData.tools) {
                if (essence.configData.tools[i].name === 'Swap') {
                    data.tools.push(essence.configData.tools[i])
                    break
                }
            }

            if (
                JSON.stringify(essence.configData.panels) !==
                JSON.stringify(data.panels)
            ) {
                data.panels = ['viewer', 'map', 'globe']
            }
        }

        await essence.init(data, L_.missionsList, true)
    },
    fina: function () {
        if (!essence.finalized) {
            // Only finalize once
            essence.finalized = true

            if (essence.hasSwapped) Globe_.reset()

            //FinalizeGlobe
            Globe_.fina(Coordinates)
            //Finalize Layers_
            L_.fina(
                Viewer_,
                Map_,
                Globe_,
                UserInterface_,
                Coordinates,
                TimeControl
            )
            //Finalize the interface
            UserInterface_.fina(L_, Viewer_, Map_, Globe_)
            //Finalize the Viewer
            Viewer_.fina(Map_)
            //Finalize the TimeControl
            TimeControl.fina()
            // Finalize the mmgisAPI
            mmgisAPI_.fina(Map_)

            stylize()
        }
    },
}

window.mmgisglobal.setConfiguration = essence.init

export default essence
