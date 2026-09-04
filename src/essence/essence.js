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
import F_ from './Basics/Formulae_/Formulae_'
import L_ from './Basics/Layers_/Layers_'
import Viewer_ from './Basics/Viewer_/Viewer_'
import Map_ from './Basics/Map_/Map_'
import Globe_ from './Basics/Globe_/Globe_'
import * as _UserInterface_ from './Basics/UserInterface_/UserInterface_'
import ToolController_ from './Basics/ToolController_/ToolController_'
import ComponentController_ from './Basics/ComponentController_/ComponentController_'
import CursorInfo from './Basics/UserInterface_/components/CursorInfo/CursorInfo'
import ContextMenu from './Basics/UserInterface_/components/ContextMenu/ContextMenu'
import Coordinates from './Basics/UserInterface_/components/Coordinates/Coordinates'
import Description from './Basics/UserInterface_/components/Description/Description'
import ScaleBar from './Basics/UserInterface_/components/ScaleBar/ScaleBar'
import ScaleBox from './Basics/UserInterface_/components/ScaleBox/ScaleBox'
import Compass from './Basics/UserInterface_/components/Compass/Compass'
import MapLogo from './Basics/UserInterface_/components/MapLogo/MapLogo'
import Attributions from './Basics/UserInterface_/components/Attributions/Attributions'
import QueryURL from './services/QueryURL'
import WebSocketService from './services/WebSocketService'
import TimeControl from './Basics/TimeControl_/TimeControl'
import calls from '../pre/calls'
import { mmgisAPI_, mmgisAPI } from './mmgisAPI/mmgisAPI'
import { makeMissionNotFoundDiv } from './LandingPage/LandingPage'
import { stylize } from '../design-system/Stylize'
//Requiring UserInterface_ initializes itself

const UserInterface_ = await _UserInterface_.default()

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

var essence = {
    configData: null,
    hasSwapped: false,
    // Wait for the React layout to mount and set layoutReady in the store
    waitForLayoutReady: function () {
        return new Promise((resolve) => {
            // Dynamic import to avoid circular deps
            import('./Basics/UserInterface_/store/uiStore').then((mod) => {
                const useUIStore = mod.default
                const state = useUIStore.getState()
                if (state.layoutReady) {
                    resolve()
                    return
                }
                const unsub = useUIStore.subscribe((s) => {
                    if (s.layoutReady) {
                        unsub()
                        resolve()
                    }
                })
            })
        })
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
            // Use DB mission name for deeplinks (config._dbMissionName if available)
            const missionForUrl = config._dbMissionName || config.msv.mission
            url =
                window.location.href.split('?')[0] +
                '?mission=' +
                missionForUrl
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

        // Wait for the React layout to be mounted before
        // initializing imperative map/globe/viewer modules that need container divs.
        if (!swapping) {
            await essence.waitForLayoutReady()
        }

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
            MapLogo.init(L_.configData.look)
            Compass.init()
            Attributions.init()
        } else {
            Coordinates.refresh()
            ScaleBar.refresh()
            MapLogo.refresh()
            Compass.refresh()
            Attributions.refresh()
        }

        //Swap.make(this)

        // Enable MMGIS backend websockets
        WebSocketService.start(
            () => L_.mission || essence.configData.msv.mission
        )
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
                    full: true,
                },
                function (response) {
                    // Extract DB mission name and attach to config
                    const config = response.config || response
                    if (response.mission) {
                        config._dbMissionName = response.mission
                    }
                    essence.makeMission(config)
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

            // Initialize components after UI finalization
            try {
                ComponentController_.initializeComponents()
            } catch (err) {
                console.error('[essence] Error initializing components:', err)
            }
        }
    },
}

window.mmgisglobal.setConfiguration = essence.init

export default essence
