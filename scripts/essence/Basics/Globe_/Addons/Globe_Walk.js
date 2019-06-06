define(['three', 'Formulae_', 'Layers_'], function(THREE, F_, Layers_) {
    var Globe_Walk = {
        G_: null,
        C: null,
        choseLL: false,
        init: function(Globe_, Coordinates) {
            this.G_ = Globe_
            this.C = Coordinates
            $('#Globe_WalkSettingsLatitudeValue').val(
                (Layers_.view[0] + this.C.coordOffset[1]).toFixed(8)
            )
            $('#Globe_WalkSettingsLongitudeValue').val(
                (Layers_.view[1] + this.C.coordOffset[0]).toFixed(8)
            )
        },
        getElement: function() {
            var initialLatLon = Layers_.view
            // prettier-ignore
            var markup = [
                "<div id='Globe_WalkToolbar'>",
                    "<div id='Globe_WalkWalk' title='First Person' class='mmgisButton3' style='border-left: 1px solid #26a8ff; margin-right: 0; padding-right: 0px; border-radius: 0;'>",
                        "<i class='mdi mdi-walk mdi-18px'></i>",
                    "</div>",
                    "<div id='Globe_WalkSettings' class='mmgisButton3' style='margin-left: 0; padding: 0px; border-radius: 0;'>",
                        "<i class='mdi mdi-menu-down mdi-18px'></i>",
                    "</div>",
                    "<div id='Globe_WalkSettingsPanel' style='border-left: 1px solid #26a8ff; display: none; padding: 8px; position: absolute; top: 36px; background: #001; width: 216px; margin-left: 8px;'>",
                        "<ul style='list-style-type: none; padding: 0; margin: 0; font-size: 13px;'>",
                            "<li id='Globe_WalkSettingsFov' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Field of View</div>",
                                "<input id='Globe_WalkSettingsFovValue' type='input' value='" + 60 + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsFocalLength' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Focal Length</div>",
                                "<input id='Globe_WalkSettingsFocalLengthValue' type='input' value='" + 35 + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='height: 19px; font-size: 10px; line-height: 5px;'><div style='height: 8px;'>m</div><div style='height: 8px;'>m</div></div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsAzimuth' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Azimuth</div>",
                                "<input id='Globe_WalkSettingsAzimuthValue' type='input' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsElevation' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Elevation</div>",
                                "<input id='Globe_WalkSettingsElevationValue' type='input' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsHeight' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Height</div>",
                                "<input id='Globe_WalkSettingsHeightValue' type='input' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div>m</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsLatitude' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Latitude</div>",
                                "<input id='Globe_WalkSettingsLatitudeValue' type='input' value='" + initialLatLon[0] + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsLongitude' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Longitude</div>",
                                "<input id='Globe_WalkSettingsLongitudeValue' type='input' value='" + initialLatLon[1] + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsChoseLL' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='width: 100%; height: 19px; background: #000; color: #777; text-align: center; cursor: pointer;'>Choose Lat/Lon from Globe</div>",
                            "</li>",
                        "</ul>",
                        "<div style='padding-top: 6px; display: flex; justify-content: space-between;'>",
                            "<div id='Globe_WalkWalkHere' style='padding: 0px 6px; background: #4071dd; cursor: pointer;'>Walk Here</div>",
                            "<div id='Globe_WalkStand' style='padding: 0px 6px; background: #4071dd; cursor: pointer;'>Stand Here</div>",
                        "</div>",
                    "</div>",
                "</div>"
            ].join('');
            return markup
        },
        attachEvents: function() {
            $('#Globe_WalkWalk').click(function() {
                Globe_Walk.G_.getCameras().swap()
            })
            $('#Globe_WalkSettingsChoseLL').click(function() {
                Globe_Walk.choseLL = !Globe_Walk.choseLL
                $('#Globe_WalkSettingsChoseLL div').css({
                    background: Globe_Walk.choseLL ? '#fff' : 'black',
                    color: Globe_Walk.choseLL ? '#222' : '#777',
                })
            })
            $('#Globe_WalkSettings').click(function() {
                var display = $('#Globe_WalkSettingsPanel').css('display')
                if (display == 'none') {
                    $('#Globe_WalkSettingsPanel').css('display', 'inherit')
                    $('#Globe_WalkSettings').css('padding-left', '174px')
                    Globe_Walk.G_.getContainer().addEventListener(
                        'click',
                        getLL,
                        false
                    )
                } else {
                    $('#Globe_WalkSettingsPanel').css('display', 'none')
                    $('#Globe_WalkSettings').css('padding-left', '0px')
                    Globe_Walk.G_.getContainer().removeEventListener(
                        'click',
                        getLL
                    )
                    $(document).off('keydown', keydownWalkSettings)
                }
            })

            function keydownWalkSettings(e) {
                var w = getWalkValues()
                if (e.which === 84)
                    //t
                    $('#Globe_WalkSettingsFovValue').val(
                        +(w.fieldofview + 0.2).toFixed(4)
                    )
                else if (e.which === 71)
                    //g
                    $('#Globe_WalkSettingsFovValue').val(
                        +(w.fieldofview - 0.2).toFixed(4)
                    )
                else if (e.which === 89)
                    //y
                    $('#Globe_WalkSettingsFocalLengthValue').val(
                        +(w.focallength + 0.2).toFixed(4)
                    )
                else if (e.which === 72)
                    //h
                    $('#Globe_WalkSettingsFocalLengthValue').val(
                        +(w.focallength - 0.2).toFixed(4)
                    )
                else if (e.which === 68)
                    //d
                    $('#Globe_WalkSettingsAzimuthValue').val(
                        +(w.azimuth + 0.2).toFixed(4)
                    )
                else if (e.which === 65)
                    //a
                    $('#Globe_WalkSettingsAzimuthValue').val(
                        +(w.azimuth - 0.2).toFixed(4)
                    )
                else if (e.which === 87)
                    //w
                    $('#Globe_WalkSettingsElevationValue').val(
                        +(w.elevation + 0.2).toFixed(4)
                    )
                else if (e.which === 83)
                    //s
                    $('#Globe_WalkSettingsElevationValue').val(
                        +(w.elevation - 0.2).toFixed(4)
                    )
                else if (e.which === 82)
                    //r
                    $('#Globe_WalkSettingsHeightValue').val(
                        +(w.height + 0.2).toFixed(4)
                    )
                else if (e.which === 70)
                    //f
                    $('#Globe_WalkSettingsHeightValue').val(
                        +(w.height - 0.2).toFixed(4)
                    )

                var wNew = getWalkValues()
                Globe_Walk.G_.getCameras().setFirstPersonHeight(wNew.height)
                Globe_Walk.G_.getCameras().setCameraAzimuthElevation(
                    wNew.azimuth,
                    wNew.elevation,
                    true
                )

                if (wNew.fieldofview !== w.fieldofview) {
                    Globe_Walk.G_.getCameras().setFirstPersonFOV(
                        wNew.fieldofview
                    )
                    $('#Globe_WalkSettingsFocalLengthValue').val(
                        +Globe_Walk.G_.getCameras()
                            .getFirstPersonFocalLength()
                            .toFixed(4)
                    )
                } else if (wNew.focallength !== w.focallength) {
                    Globe_Walk.G_.getCameras().setFirstPersonFocalLength(
                        wNew.focallength
                    )
                    $('#Globe_WalkSettingsFovValue').val(
                        +Globe_Walk.G_.getCameras()
                            .getFirstPersonFOV()
                            .toFixed(4)
                    )
                }
            }

            function getLL() {
                if (Globe_Walk.choseLL) {
                    var lat = Globe_Walk.G_.mouseLngLat.Lat
                    if (lat)
                        lat = (lat + Globe_Walk.C.coordOffset[1]).toFixed(8)
                    $('#Globe_WalkSettingsLatitudeValue').val(lat)

                    var lng = Globe_Walk.G_.mouseLngLat.Lng
                    if (lng)
                        lng = (lng + Globe_Walk.C.coordOffset[0]).toFixed(8)
                    $('#Globe_WalkSettingsLongitudeValue').val(lng)
                }
            }

            $('#Globe_WalkStand').click(function() {
                setCamera(true)
                $(document).on('keydown', keydownWalkSettings)
            })
            $('#Globe_WalkWalkHere').click(function() {
                setCamera(false)
                $(document).off('keydown', keydownWalkSettings)
                $('#Globe_WalkSettingsPanel').css('display', 'none')
            })

            function showMenuWhenLeavingWalking(e) {
                if (
                    document.pointerLockElement === document.body ||
                    document.mozPointerLockElement === document.body
                ) {
                    /* pointer locked */
                } else {
                    $('#Globe_WalkSettingsPanel').css('display', 'inherit')
                    $(document).off('keydown', keydownWalkSettings)
                    if ('onpointerlockchange' in document)
                        document.removeEventListener(
                            'pointerlockchange',
                            showMenuWhenLeavingWalking
                        )
                    else if ('onmozpointerlockchange' in document)
                        document.removeEventListener(
                            'mozpointerlockchange',
                            showMenuWhenLeavingWalking
                        )
                }
            }

            function getWalkValues() {
                return {
                    fieldofview:
                        parseFloat($('#Globe_WalkSettingsFovValue').val()) ||
                        60,
                    focallength:
                        parseFloat(
                            $('#Globe_WalkSettingsFocalLengthValue').val()
                        ) || 35,
                    azimuth:
                        parseFloat(
                            $('#Globe_WalkSettingsAzimuthValue').val()
                        ) || 0,
                    elevation:
                        parseFloat(
                            $('#Globe_WalkSettingsElevationValue').val()
                        ) || 0,
                    height:
                        parseFloat($('#Globe_WalkSettingsHeightValue').val()) ||
                        3,
                    latitude:
                        parseFloat(
                            $('#Globe_WalkSettingsLatitudeValue').val() -
                                Globe_Walk.C.coordOffset[1]
                        ) || 0,
                    longitude:
                        parseFloat(
                            $('#Globe_WalkSettingsLongitudeValue').val() -
                                Globe_Walk.C.coordOffset[0]
                        ) || 0,
                }
            }
            function setCamera(lockControls) {
                var w = getWalkValues()
                Globe_Walk.G_.setCenter([w.latitude, w.longitude])
                Globe_Walk.G_.getCameras().setFirstPersonHeight(w.height)
                Globe_Walk.G_.getCameras().setCameraAzimuthElevation(
                    w.azimuth,
                    w.elevation,
                    true
                )
                Globe_Walk.G_.getCameras().setFirstPersonFocalLength(
                    w.focallength
                )
                Globe_Walk.G_.getCameras().setFirstPersonFOV(w.fieldofview)
                Globe_Walk.G_.getCameras().swap(lockControls)
                if ('onpointerlockchange' in document)
                    document.addEventListener(
                        'pointerlockchange',
                        showMenuWhenLeavingWalking,
                        false
                    )
                else if ('onmozpointerlockchange' in document)
                    document.addEventListener(
                        'mozpointerlockchange',
                        showMenuWhenLeavingWalking,
                        false
                    )
            }
        },
    }

    return Globe_Walk
})
