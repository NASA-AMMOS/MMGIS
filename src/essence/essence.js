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
//import Swap from './Ancillary/Swap'
import QueryURL from './Ancillary/QueryURL'
import calls from '../pre/calls'
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
        !$('#loginModal').hasClass('active') &&
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
    init: function (config, missionsList, swapping, hasDAMTool) {
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

        Map_.init(this.fina)

        //Now that the map is made
        Coordinates.init()
        ContextMenu.init()

        if (!swapping) {
            Description.init(L_.mission, L_.site, Map_, L_)

            ScaleBar.init(ScaleBox)
        } else {
            if (!hasDAMTool) {
                F_.useDegreesAsMeters(false)
                Coordinates.setDamCoordSwap(false)
            } else {
                F_.useDegreesAsMeters(true)
                Coordinates.setDamCoordSwap(true)
            }
            Coordinates.refresh()
            ScaleBar.refresh()
        }

        //Swap.make(this)
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
            var toolsThatUseDegreesAsMeters = ['InSight']
            var hasDAMTool = false
            //Remove swap tool from data.tools
            for (var i = data.tools.length - 1; i > 0; i--) {
                if (
                    toolsThatUseDegreesAsMeters.indexOf(data.tools[i].name) !==
                    -1
                ) {
                    hasDAMTool = true
                }
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

            essence.init(data, L_.missionsList, true, hasDAMTool)
        }
    },
    fina: function () {
        if (essence.hasSwapped) Globe_.reset()

        //FinalizeGlobe
        Globe_.fina(Coordinates)
        //Finalize Layers_
        L_.fina(Viewer_, Map_, Globe_, UserInterface_)
        //Finalize the interface
        UserInterface_.fina(L_, Viewer_, Map_, Globe_)
        //Finalize the Viewer
        Viewer_.fina(Map_)

        stylize()
    },
}

export default essence
