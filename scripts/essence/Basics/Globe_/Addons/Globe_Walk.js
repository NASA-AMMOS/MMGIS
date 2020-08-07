define(['three', 'Formulae_', 'Layers_', 'd3'], function (
    THREE,
    F_,
    Layers_,
    d3
) {
    var Globe_Walk = {
        G_: null,
        C: null,
        choseLL: false,
        init: function (Globe_, Coordinates) {
            this.G_ = Globe_
            this.C = Coordinates
            $('#Globe_WalkSettingsLatitudeValue').val(
                (Layers_.view[0] + this.C.coordOffset[1]).toFixed(8)
            )
            $('#Globe_WalkSettingsLongitudeValue').val(
                (Layers_.view[1] + this.C.coordOffset[0]).toFixed(8)
            )

            d3.select('#globe')
                .append('div')
                .attr('id', 'Globe_WalkFOVOverlay')
                .style('position', 'absolute')
                .style('top', 0)
                .style('left', 0)
                .style('width', '100%')
                .style('height', '100%')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .html(
                    [
                        "<div id='Globe_Walk_NW' style='position: absolute; background: rgba(0,0,0,0.4);'></div>",
                        "<div id='Globe_Walk_N' style='position: absolute; background: rgba(0,0,0,0.4); border-bottom: 1px solid var(--color-b);'></div>",
                        "<div id='Globe_Walk_NE' style='position: absolute; background: rgba(0,0,0,0.4);'></div>",
                        "<div id='Globe_Walk_E' style='position: absolute; background: rgba(0,0,0,0.4); border-left: 1px solid var(--color-b);'></div>",
                        "<div id='Globe_Walk_SE' style='position: absolute; background: rgba(0,0,0,0.4);'></div>",
                        "<div id='Globe_Walk_S' style='position: absolute; background: rgba(0,0,0,0.4); border-top: 1px solid var(--color-b);'></div>",
                        "<div id='Globe_Walk_SW' style='position: absolute; background: rgba(0,0,0,0.4);'></div>",
                        "<div id='Globe_Walk_W' style='position: absolute; background: rgba(0,0,0,0.4); border-right: 1px solid var(--color-b);'></div>",
                    ].join('\n')
                )
        },
        toggleFOVOverlay: function (on) {
            const fovOverlay = $('#Globe_WalkFOVOverlay')

            if (on === false || (on == null && fovOverlay.hasClass('on')))
                fovOverlay.removeClass('on')
            else fovOverlay.addClass('on')

            fovOverlay.animate(
                {
                    opacity: fovOverlay.hasClass('on') ? 1 : 0,
                },
                200
            )
        },
        updateFOVOverlayBounds: function (
            elFOV,
            elFOVCenter,
            azFOV,
            azFOVCenter
        ) {
            elFOV = $('#Globe_WalkSettingsVerticalFovValue').val()

            const screenFOV = Globe_Walk.G_.getCameras().getFirstPersonFOV()
            const screenAspect = Globe_Walk.G_.getCameras().getFirstPersonAspect()
            const rect = $('#globe')[0].getBoundingClientRect()

            // Percents from top or left where inner fov bounds will be
            const elFovPx = rect.height * (elFOV / screenFOV)
            let top = ((rect.height / 2 - elFovPx / 2) / rect.height) * 100
            let bottom = ((rect.height / 2 + elFovPx / 2) / rect.height) * 100
            const azFovPx = (rect.height / screenFOV) * azFOV
            let left = ((rect.width / 2 - azFovPx / 2) / rect.width) * 100
            let right = ((rect.width / 2 + azFovPx / 2) / rect.width) * 100

            $('#Globe_Walk_NW').css({
                top: 0 + '%',
                height: top + '%',
                left: 0 + '%',
                width: left + '%',
            })
            $('#Globe_Walk_N').css({
                top: 0 + '%',
                height: top + '%',
                left: left + '%',
                width: right - left + '%',
            })
            $('#Globe_Walk_NE').css({
                top: 0 + '%',
                height: top + '%',
                left: right + '%',
                width: 100 - right + '%',
            })
            $('#Globe_Walk_E').css({
                top: top + '%',
                height: bottom - top + '%',
                left: right + '%',
                width: 100 - right + '%',
            })
            $('#Globe_Walk_SE').css({
                top: bottom + '%',
                height: 100 - bottom + '%',
                left: right + '%',
                width: 100 - right + '%',
            })
            $('#Globe_Walk_S').css({
                top: bottom + '%',
                height: 100 - bottom + '%',
                left: left + '%',
                width: right - left + '%',
            })
            $('#Globe_Walk_SW').css({
                top: bottom + '%',
                height: 100 - bottom + '%',
                left: 0 + '%',
                width: left + '%',
            })
            $('#Globe_Walk_W').css({
                top: top + '%',
                height: bottom - top + '%',
                left: 0 + '%',
                width: left + '%',
            })
        },
        getElement: function () {
            var initialLatLon = Layers_.view
            // prettier-ignore
            var markup = [
                "<div id='Globe_WalkToolbar'>",
                    "<div id='Globe_WalkWalk' title='First Person' class='mmgisButton3' style='margin-right: 0; padding-right: 0px; border-radius: 0;'>",
                        "<i class='mdi mdi-walk mdi-18px'></i>",
                    "</div>",
                    "<div id='Globe_WalkSettings' class='mmgisButton3' style='margin-left: 0; margin-right: 0px; padding: 0px; border-radius: 0;'>",
                        "<i class='mdi mdi-menu-down mdi-18px'></i>",
                    "</div>",
                    "<div id='Globe_WalkSettingsPanel' style='display: none; padding: 8px; position: absolute; top: 32px; background: var(--color-a); width: 215px; margin-left: 6px;'>",
                        "<ul style='list-style-type: none; padding: 0; margin: 0; font-size: 13px;'>",
                            "<li id='Globe_WalkSettingsFov' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Field of View</div>",
                                "<input id='Globe_WalkSettingsFovValue' type='number' value='" + 60 + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                                "<input id='Globe_WalkSettingsFovValueRaw' type='number' value='" + 60 + "' style='display: none;'>",
                            "</li>",
                            "<li id='Globe_WalkSettingsVerticalFov' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Vertical FOV</div>",
                                "<input id='Globe_WalkSettingsVerticalFovValue' type='number' value='" + 60 + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsFocalLength' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Focal Length</div>",
                                "<input id='Globe_WalkSettingsFocalLengthValue' type='number' value='" + 35 + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='height: 19px; font-size: 10px; line-height: 5px;'><div style='height: 8px;'>m</div><div style='height: 8px;'>m</div></div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsAzimuth' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Azimuth</div>",
                                "<input id='Globe_WalkSettingsAzimuthValue' type='number' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsElevation' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Elevation</div>",
                                "<input id='Globe_WalkSettingsElevationValue' type='number' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsHeight' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Height</div>",
                                "<input id='Globe_WalkSettingsHeightValue' type='number' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div>m</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsLatitude' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Latitude</div>",
                                "<input id='Globe_WalkSettingsLatitudeValue' type='number' value='" + initialLatLon[0] + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsLongitude' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='float: left; padding-right: 5px;'>Longitude</div>",
                                "<input id='Globe_WalkSettingsLongitudeValue' type='number' value='" + initialLatLon[1] + "' style='width: 100%; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; width: 90px; margin: 0px 2px 0px auto;'>",
                                "<div style='font-size: 20px; padding-right: 4px;'>&deg;</div>",
                            "</li>",
                            "<li id='Globe_WalkSettingsChoseLL' style='display: flex; justify-content: space-between; margin-bottom: 3px;'>",
                                "<div style='width: 100%; height: 19px; background: #000; color: #777; text-align: center; cursor: pointer;'>Choose Lat/Lon from Globe</div>",
                            "</li>",
                        "</ul>",
                        "<div id='Globe_WalkWalkStandButtons' style='padding-top: 6px; display: flex; justify-content: space-between;'>",
                            "<div id='Globe_WalkWalkHere' style='padding: 0px 6px; background: var(--color-a); cursor: pointer;'>Walk Here</div>",
                            "<div id='Globe_WalkStand' style='padding: 0px 6px; background: var(--color-a); cursor: pointer;'>Stand Here</div>",
                        "</div>",
                    "</div>",
                "</div>"
            ].join('');
            return markup
        },
        attachEvents: function () {
            $('#Globe_WalkWalk').click(function () {
                setCamera(false)
                $(document).off('keydown', keydownWalkSettings)

                // prettier-ignore
                let helpMarkup = [
                    "<div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>W</div><div>Forward</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>A</div><div>Left</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>S</div><div>Back</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>D</div><div>Right</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>SHIFT+</div><div>Fast</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>ESC</div><div>Quit</div></div>",
                    "</div>",
                ].join('\n')
                d3.select('#globeScreen')
                    .append('div')
                    .attr('id', 'Globe_WalkWalkHereHelp')
                    .style('position', 'absolute')
                    .style('bottom', '32px')
                    .style('right', '10px')
                    .style('background', 'var(--color-a)')
                    .style('font-size', '13px')
                    .html(helpMarkup)
            })
            $('#Globe_WalkSettingsChoseLL').click(function () {
                Globe_Walk.choseLL = !Globe_Walk.choseLL
                $('#Globe_WalkSettingsChoseLL div').css({
                    background: Globe_Walk.choseLL ? '#fff' : 'black',
                    color: Globe_Walk.choseLL ? '#222' : '#777',
                })
            })
            $('#Globe_WalkSettings').click(function () {
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
                        +(w.fieldofview + (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 71)
                    //g
                    $('#Globe_WalkSettingsFovValue').val(
                        +(w.fieldofview - (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 89)
                    //y
                    $('#Globe_WalkSettingsVerticalFovValue').val(
                        +(w.vfieldofview + (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 72)
                    //h
                    $('#Globe_WalkSettingsVerticalFovValue').val(
                        +(w.vfieldofview - (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 68)
                    //d
                    $('#Globe_WalkSettingsAzimuthValue').val(
                        +(w.azimuth + (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 65)
                    //a
                    $('#Globe_WalkSettingsAzimuthValue').val(
                        +(w.azimuth - (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 87)
                    //w
                    $('#Globe_WalkSettingsElevationValue').val(
                        +(w.elevation + (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 83)
                    //s
                    $('#Globe_WalkSettingsElevationValue').val(
                        +(w.elevation - (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 82)
                    //r
                    $('#Globe_WalkSettingsHeightValue').val(
                        +(w.height + (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )
                else if (e.which === 70)
                    //f
                    $('#Globe_WalkSettingsHeightValue').val(
                        +(w.height - (e.shiftKey ? 1 : 0.2)).toFixed(4)
                    )

                var wNew = getWalkValues()
                Globe_Walk.G_.getCameras().setFirstPersonHeight(wNew.height)
                Globe_Walk.G_.getCameras().setCameraAzimuthElevation(
                    wNew.azimuth,
                    wNew.elevation,
                    true
                )

                if (wNew.vfieldofview !== w.vfieldofview) {
                    Globe_Walk.G_.getCameras().setFirstPersonFOV(
                        Math.max(wNew.vfieldofview, 60)
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

                Globe_Walk.updateFOVOverlayBounds(
                    wNew.vfieldofview,
                    wNew.elevation,
                    wNew.fieldofview,
                    wNew.azimuth
                )
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

            $('#Globe_WalkStand').click(function () {
                setCamera(true) //, true)
                Globe_Walk.toggleFOVOverlay(true)
                let w = getWalkValues()
                Globe_Walk.updateFOVOverlayBounds(
                    w.vfieldofview,
                    w.elevation,
                    w.fieldofview,
                    w.azimuth
                )
                $(document).on('keydown', keydownWalkSettings)
                $('#Globe_WalkStand').removeClass('highlightAnim1')

                // prettier-ignore
                let helpMarkup = [
                    "<div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>W</div><div>Up</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>A</div><div>Left</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>S</div><div>Down</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>D</div><div>Right</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>R</div><div>Higher</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>F</div><div>Lower</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>T</div><div>FOV +</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>G</div><div>FOV -</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>Y</div><div>vFOV +</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>H</div><div>vFOV -</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>SHIFT+</div><div>Fast</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>ESC</div><div>Quit</div></div>",
                    "</div>",
                ].join('\n')
                d3.select('#globeScreen')
                    .append('div')
                    .attr('id', 'Globe_WalkStandHelp')
                    .style('position', 'absolute')
                    .style('bottom', '32px')
                    .style('right', '10px')
                    .style('background', 'var(--color-a)')
                    .style('font-size', '13px')
                    .html(helpMarkup)

                d3.select('#Globe_WalkSettingsChoseLL').style('display', 'none')
                d3.select('#Globe_WalkWalkStandButtons').style(
                    'display',
                    'none'
                )

                //keydownWalkSettings({ which: null })
            })
            $('#Globe_WalkWalkHere').click(function () {
                setCamera(false)
                $(document).off('keydown', keydownWalkSettings)
                $('#Globe_WalkSettingsPanel').css('display', 'none')

                // prettier-ignore
                let helpMarkup = [
                    "<div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>W</div><div>Forward</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>A</div><div>Left</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>S</div><div>Back</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>D</div><div>Right</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; border-bottom: 1px solid var(--color-e); color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>SHIFT+</div><div>Fast</div></div>",
                        "<div style='display: flex; justify-content: space-between; padding: 2px 6px; white-space: nowrap; text-align: center; color: var(--color-c); line-height: 16px;'><div style='color: white; text-align: center; margin-right: 5px;'>ESC</div><div>Quit</div></div>",
                    "</div>",
                ].join('\n')
                d3.select('#globeScreen')
                    .append('div')
                    .attr('id', 'Globe_WalkWalkHereHelp')
                    .style('position', 'absolute')
                    .style('bottom', '32px')
                    .style('right', '10px')
                    .style('background', 'var(--color-a)')
                    .style('font-size', '13px')
                    .html(helpMarkup)
            })

            function showMenuWhenLeavingWalking(e) {
                if (
                    document.pointerLockElement === document.body ||
                    document.mozPointerLockElement === document.body
                ) {
                    /* pointer locked */
                } else {
                    $('#Globe_WalkStandHelp').remove()
                    $('#Globe_WalkWalkHereHelp').remove()
                    $('#Globe_WalkSettingsPanel').css('display', 'inherit')
                    d3.select('#Globe_WalkSettingsChoseLL').style(
                        'display',
                        'flex'
                    )
                    d3.select('#Globe_WalkWalkStandButtons').style(
                        'display',
                        'flex'
                    )

                    Globe_Walk.toggleFOVOverlay(false)
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
                    fieldofviewRaw:
                        parseFloat($('#Globe_WalkSettingsFovValueRaw').val()) ||
                        60,
                    vfieldofview:
                        parseFloat(
                            $('#Globe_WalkSettingsVerticalFovValue').val()
                        ) || 60,
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
                        ) ||
                        Globe_Walk.G_.getCenter().lat ||
                        0,
                    longitude:
                        parseFloat(
                            $('#Globe_WalkSettingsLongitudeValue').val() -
                                Globe_Walk.C.coordOffset[0]
                        ) ||
                        Globe_Walk.G_.getCenter().lon ||
                        0,
                }
            }
            function setCamera(lockControls, skipLock) {
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
                Globe_Walk.G_.getCameras().setFirstPersonFOV(
                    Math.max(w.vfieldofview, 60)
                )

                Globe_Walk.G_.getCameras().swap(lockControls, skipLock)
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
