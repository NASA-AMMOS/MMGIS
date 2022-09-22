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
    window.mmgisglobal.PORT = parseInt(window.mmgisglobal.PORT || "8888", 10);
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
            '.toolButton:focus,#barBottom > i:focus,#topBarTitleName:focus,.mainInfo > div:focus,#mainDescription:focus,#SearchType:focus,#auto_search:focus,#loginoutButton:focus,#mapSplitInnerLeft:focus,#mapSplitInnerRight:focus,#globeSplitInnerLeft:focus,#globeSplitInnerRight:focus {border: 2px solid var(--color-mmgis) !important;}',
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
    init: function (config, missionsList, swapping) {
        //Save the config data
        this.configData = config

        //Make sure url matches mission
        var urlSplit = window.location.href.split('?')
        var url = urlSplit[0]

        if (
            urlSplit.length == 1 ||
            swapping ||
            (urlSplit[1] && urlSplit[1].split('=')[0] == 'forcelanding')
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
            this.hasSwapped = true
            L_.clear()
            //UserInterface_.refresh();
        }

        //Try querying the urlSite
        var urlOnLayers = null
        if (!swapping) urlOnLayers = QueryURL.queryURL()

        //Parse all the configData
        L_.init(this.configData, missionsList, urlOnLayers)

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

        Map_.init(this.fina)

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

        // Enable MMGIS backend webhook
        if (window.mmgisglobal.PORT && window.mmgisglobal.ENABLE_MMGIS_WEBHOOKS) {
            const port = parseInt(process.env.PORT || "8888", 10);
            const path = `ws://localhost:${port}/`
            const ws = new WebSocket(path);
            ws.onopen = function () {
                console.log("Started websocket connection in essence...")
            }

            ws.onmessage = function (data) {
                console.log('Websocket in essence recieved data...', data)
                if (data.data) {
                    try {
                        const parsed = JSON.parse(data.data)
                        console.log("Received data", parsed)

                        const type = parsed.type;
                        const layerName = parsed.body.layer.name;

                        console.log("type", type)
                        console.log("layerName", layerName)
                        if (type === 'addLayer') {
                            console.log("type === addLayer")
                            console.log("ToolController_.activeToolName", ToolController_.activeToolName)
                            if (ToolController_.activeToolName === 'LayersTool') {
                                //L_.parseConfig(parsed)

                                console.log("essence.configData", essence.configData)

                                const mission = essence.configData.msv.mission;
                                calls.api(
                                    'get',
                                    {
                                        mission,
                                    },
                                    async function (data) {
                                        //makeMission(data)
                                        console.log("----- call api mission data -----", data)

                                        // Save so we can make sure we reproduce the same layer settings after parsing the config
                                        //const expanded = { ...L_.expanded }
                                        const toggledArray = { ...L_.toggledArray } 

                                        // Save the original layer ordering
                                        const origLayersOrdered = [ ...L_.layersOrdered ]

                                        // Reset for now
                                        //L_.expanded = {}
                                        L_.toggledArray = {}

                                        // Reset as these are appended to by parseConfig
                                        L_.indentArray = []
                                        L_.layersOrdered = []
                                        L_.layersOrderedFixed = []
                                        L_.layersData = []
                                        L_.layersLoaded = []

                                        L_.parseConfig(data)

                                        console.log("new L_.toggledArray", JSON.stringify(L_.toggledArray, null, 4))

                                        // Set back
                                        //L_.expanded = { ...L_.expanded, ...expanded }
                                        L_.toggledArray = { ...L_.toggledArray, ...toggledArray }

                                        console.log("layerName", layerName)
                                        console.log("fixed L_.toggledArray", JSON.stringify(L_.toggledArray, null, 4))
                                        //L_.layersOrdered = newLayersOrdered
                                        //L_.layersOrdered.push(layerName)

                                        console.log("L_.layersOrdered", JSON.stringify(L_.layersOrdered))
                                        console.log("L_.layersLoaded", JSON.stringify(L_.layersLoaded))

                                        const newLayersOrdered = [ ...L_.layersOrdered ]
                                        console.log("orig newLayersOrdered", JSON.stringify(newLayersOrdered, null, 4))
                                        const index = L_.layersOrdered.findIndex(name => name === layerName)
                                        newLayersOrdered.splice(index, 1)

                                        console.log("updated newLayersOrdered", JSON.stringify(newLayersOrdered, null, 4))


                                        console.log("F_.isEqual(origLayersOrdered, newLayersOrdered, obj2, true)",
                                            F_.isEqual(origLayersOrdered, newLayersOrdered, true))
                                        // If the layers have been reordered from the default layer order
                                        if (!F_.isEqual(origLayersOrdered, newLayersOrdered, true)) {
                                            console.log("attempting to stick the new layer in the correct location")
                                            const parentLayer = L_.layersParent[layerName]
                                            if (parentLayer) {
                                                console.log("L_.layersNamed[parentLayer]", L_.layersNamed[parentLayer])



                                            }
                                        }


                                        //L_.layersParent[]


                                        //await L_.toggleLayer(L_.layersDataByName[layerName])
                                        //await L_.toggleLayer(L_.layersDataByName[layerName])

                                        //Make the layer
                                        await Map_.makeLayer(L_.layersDataByName[layerName])


                                        L_.addVisible(Map_, [layerName])
/*
                                        if (L_.toggledArray[layerName]) {
                                            await L_.toggleLayer(L_.layersDataByName[layerName])
                                            await L_.toggleLayer(L_.layersDataByName[layerName])
                                        }
*/

                                        //L_.reorderLayers(L_.layersOrderedFixed)

                                        if (L_.Map_) L_.Map_.orderedBringToFront(true)

/*
                                        for (let layerName in L_.toggledArray) {
                                            console.log(layerName, L_.toggledArray[layerName])

                                            if (L_.toggledArray[layerName])
                                                await L_.toggleLayer(L_.layersDataByName[layerName])
                                        }

                                        const copyToggledArray = { ...L_.toggledArray }

                                        L_.layers = null
                                        L_.layersNamed = {}
                                        L_.layersGroup = {}
                                        L_.layersOrdered = []
                                        L_.layersOrderedFixed = []
                                        L_.layersIndex = {}
                                        L_.layersLoaded = []
                                        L_.layersStyles = {}
                                        L_.layersLegends = {}
                                        L_.layersLegendsData = {}
                                        L_.expandArray = {}
                                        L_.layersData = []
                                        L_.layersDataByName = {}
                                        L_.indentArray = []
                                        L_.toggledArray = {}
                                        L_.expanded = {}

                                        console.log("copyToggledArray", copyToggledArray)

                                        L_.parseConfig(data)

                                        //Make our layers
                                        await Map_.makeLayers(L_.layersData)

                                        //Just in case we have no layers
                                        Map_.allLayersLoaded()
*/


                                        console.log("L_.layersGroup", Object.keys(L_.layersGroup))
                                        ToolController_.activeTool.destroy();
                                        ToolController_.activeTool.make();

                                    },
                                    function (e) {
                                        console.log(
                                            "Warning: Couldn't load: " + mission + ' configuration.'
                                        )
                                        //console.log(
                                        //    "Warning: Couldn't load: " + to + ' configuration.'
                                        //)
                                        //makeMissionNotFoundDiv()
                                    }
                                )
                            }
                        }
/*
                        //Make our layers
                        Map_.makeLayers(L_.layersData)

                        //Just in case we have no layers
                        Map_.allLayersLoaded()
*/

                    } catch (e) {
                        console.warn(`Error parsing data from MMGIS websocket: ${e}`)
                    }
                }
            }

            ws.onclose = function () {
                console.log("Closed websocket connection in essence...")
            }
        }
    },
    swapMission(to) {
        console.log("----- essence swapMission -----")
        console.log("to", to)
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
                    makeMission(data)
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
                function (data) {
                    makeMission(data)
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

        function makeMission(data) {
            //Remove swap tool from data.tools
            for (var i = data.tools.length - 1; i > 0; i--) {
                if (data.tools[i].name === 'Swap') {
                    data.tools.splice(i, 1)
                }
            }
            //Add swap to data.tools
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

            essence.init(data, L_.missionsList, true)
        }
    },
    fina: function () {
        if (!essence.finalized) {
            // Only finalize once
            essence.finalized = true

            if (essence.hasSwapped) Globe_.reset()

            //FinalizeGlobe
            Globe_.fina(Coordinates)
            //Finalize Layers_
            L_.fina(Viewer_, Map_, Globe_, UserInterface_, Coordinates)
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

export default essence
