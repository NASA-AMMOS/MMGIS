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

define([
    'jquery',
    'd3',
    'Formulae_',
    'Test_',
    'Layers_',
    'Map_',
    'Viewer_',
    'UserInterface_',
    'ToolController_',
    'CursorInfo',
    'Coordinates',
    'Description',
    'ScaleBar',
    'ScaleBox',
    'Swap',
    'QueryURL',
    'three',
    'Globe_',
], function(
    $,
    d3,
    F_,
    T_,
    L_,
    Map_,
    Viewer_,
    UserInterface_,
    ToolController_,
    CursorInfo,
    Coordinates,
    Description,
    ScaleBar,
    ScaleBox,
    Swap,
    QueryURL,
    THREE,
    Globe_
) {
    //Requiring UserInterface_ initializes itself

    //Say it's development version
    if (mmgisglobal.NODE_ENV === 'development') {
        d3.select('body')
            .append('div')
            .attr('id', 'nodeenv')
            .html('DEVELOPMENT')
    }

    mmgisglobal.lastInteraction = Date.now()
    $('body').on('mousemove', function() {
        mmgisglobal.lastInteraction = Math.floor(Date.now() / 1000)
    })

    mmgisglobal.ctrlDown = false
    mmgisglobal.shiftDown = false
    // Check whether control button and shift is pressed
    //17 is ctrl, 91, 93, and 224 are MAC metakeys
    $(document).keydown(function(e) {
        if (
            e.which == '17' ||
            e.which == '91' ||
            e.which == '93' ||
            e.which == '224'
        )
            mmgisglobal.ctrlDown = true
        if (e.which == '16') mmgisglobal.shiftDown = true
    })
    $(document).keyup(function(e) {
        if (
            e.which == '17' ||
            e.which == '91' ||
            e.which == '93' ||
            e.which == '224'
        )
            mmgisglobal.ctrlDown = false
        if (e.which == '16') mmgisglobal.shiftDown = false
    })

    $(document).keydown(function(e) {
        if (
            ToolController_.activeTool == null &&
            e.shiftKey &&
            e.keyCode === 84
        ) {
            T_.toggle()
        }
    })

    var essence = {
        configData: null,
        hasSwapped: false,
        init: function(config, missionsList, swapping, hasDAMTool) {
            //Save the config data
            this.configData = config

            //Make sure url matches mission
            var urlSplit = window.location.href.split('?')
            var url = urlSplit[0]
            if (urlSplit.length == 1 || swapping) {
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
            d3.select('title').html(mmgisglobal.name + ' - ' + L_.mission)
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
            if (!swapping) {
                Description.init(L_.mission, L_.site, Map_)

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

            Swap.make(this)
        },
        swapMission(to) {
            //console.log( to );
            //Close all tools since they only update when reopened
            ToolController_.closeActiveTool()

            $.getJSON(
                'Missions/' +
                    to +
                    '/' +
                    'config.json' +
                    '?nocache=' +
                    new Date().getTime(),
                function(data) {
                    var toolsThatUseDegreesAsMeters = ['InSight']
                    var hasDAMTool = false
                    //Remove swap tool from data.tools
                    for (var i = data.tools.length - 1; i > 0; i--) {
                        if (
                            toolsThatUseDegreesAsMeters.indexOf(
                                data.tools[i].name
                            ) !== -1
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
            ).error(function() {
                console.log(
                    "Warning: Couldn't load: " +
                        'Missions/' +
                        to +
                        '/' +
                        'config.json'
                )
                makeMissionNotFoundDiv()
            })
        },
        fina: function() {
            if (essence.hasSwapped) Globe_.reset()

            //FinalizeGlobe
            Globe_.fina(Coordinates)
            //Finalize Layers_
            L_.fina(Viewer_, Map_, Globe_, UserInterface_)
            //Finalize the interface
            UserInterface_.fina(L_, Viewer_, Map_, Globe_)

            stylize()
        },
    }

    return essence

    //Move this somewhere else later
    function stylize() {
        if (L_.configData.look) {
            if (
                L_.configData.look.bodycolor &&
                L_.configData.look.bodycolor != ''
            )
                $('body').css({ background: L_.configData.look.bodycolor })
            if (
                L_.configData.look.topbarcolor &&
                L_.configData.look.topbarcolor != ''
            )
                $('#topBar').css({ background: L_.configData.look.topbarcolor })
            if (
                L_.configData.look.toolbarcolor &&
                L_.configData.look.toolbarcolor != ''
            ) {
                $('#toolbar').css({
                    background: L_.configData.look.toolbarcolor,
                })
                var bodyRGB = $('#toolbar').css('backgroundColor')
                var bodyHEX = F_.rgb2hex(bodyRGB)
                bodyRGB = F_.rgbToArray(bodyRGB)
                var c =
                    'rgba(' +
                    bodyRGB[0] +
                    ',' +
                    bodyRGB[1] +
                    ',' +
                    bodyRGB[2] +
                    ')'
                $('#toolsWrapper').css({ background: c })
            }
            if (
                L_.configData.look.mapcolor &&
                L_.configData.look.mapcolor != ''
            )
                $('#map').css({ background: L_.configData.look.mapcolor })
        }
    }
})
