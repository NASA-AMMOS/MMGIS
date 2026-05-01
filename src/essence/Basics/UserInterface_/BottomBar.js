import $ from 'jquery'
import hotkeys from 'hotkeys-js'
import showdown from 'showdown'
import DOMPurify from 'dompurify'

import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'

import Attributions from './components/Attributions/Attributions'
import QueryURL from '../../services/QueryURL'
import Modal from './components/Modal/Modal'
import HTML2Canvas from 'html2canvas'
import useUIStore from './store/uiStore'

showdown.setFlavor('github')

let BottomBar = {
    mdConverter: new showdown.Converter(),
    UI_: null,
    settings: {},

    // Set the UI reference (called by bridge fina or React component)
    setUI: function (UI) {
        this.UI_ = UI
    },

    // Copy the current URL to clipboard (extracted from init's click handler)
    copyLink: function (callback) {
        QueryURL.writeCoordinateURL(true, function () {
            F_.copyToClipboard(L_.url)
            if (callback) callback()
        })
    },

    // About modal
    showAboutModal: function () {
        const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;')
        const version = esc(window.mmgisglobal?.version || L_.configData?.version || '')
        const mission = esc(L_.configData?.msv?.mission || '')
        const helpUrl = esc(L_.configData?.look?.helpurl || '')
        const infoUrl = esc(L_.configData?.look?.infourl || '')
        const aboutContent = L_.configData?.look?.aboutModalContent || L_.configData?.look?.infoModalContent || ''
        const logoUrl = esc(L_.configData?.look?.logourl || '')

        const attributions = Attributions.visibleAttributions || []
        const attributionItems = attributions.map((attr) => {
            if (attr.link && attr.link.length > 0) {
                return `<a href='${esc(attr.link)}' target='_blank' rel='noopener noreferrer'>${esc(attr.text)}</a>`
            }
            return `<span>${esc(attr.text)}</span>`
        })

        const githubSvg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`

        const mmgisLogoURL = 'public/images/logos/mmgis.png'

        // prettier-ignore
        const modalContent = [
            `<div id='mainInfoModal'>`,
                `<div id='mainInfoModalTitle'>`,
                    `<div id='mainInfoModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                `</div>`,
                `<div id='mainInfoModalContent'>`,
                    `<div class='mainInfoModalHero'>`,
                        `<img class='mainInfoModalLogo' src='${mmgisLogoURL}' alt='MMGIS' />`,
                        `<div class='mainInfoModalSubtitle'>Multi-Mission Geographic Information System</div>`,
                        logoUrl ? `<img class='mainInfoModalMissionLogo' src='${logoUrl}' alt='Mission Logo' />` : '',
                    `</div>`,
                    aboutContent ? `<div class='mainInfoModalCustom'>${DOMPurify.sanitize(BottomBar.mdConverter.makeHtml(aboutContent))}</div>` : '',
                    `<div class='mainInfoModalMeta'>`,
                        mission ? `<div class='mainInfoModalMetaItem'><span class='mainInfoModalMetaLabel'>Mission</span><span class='mainInfoModalMetaValue'>${mission}</span></div>` : '',
                        version ? `<div class='mainInfoModalMetaItem'><span class='mainInfoModalMetaLabel'>Version</span><span class='mainInfoModalMetaValue'>${version}</span></div>` : '',
                    `</div>`,
                    `<div class='mainInfoModalLinks'>`,
                        `<a class='mainInfoModalLink' href='https://github.com/NASA-AMMOS/MMGIS' target='_blank' rel='noopener noreferrer'>${githubSvg}<span>GitHub</span></a>`,
                        helpUrl && L_.configData?.look?.help !== false ? `<a class='mainInfoModalLink' href='${helpUrl}' target='_blank' rel='noopener noreferrer'><i class='mdi mdi-help-circle-outline'></i><span>Help</span></a>` : '',
                        infoUrl && L_.configData?.look?.info !== false ? `<a class='mainInfoModalLink' href='${infoUrl}' target='_blank' rel='noopener noreferrer'><i class='mdi mdi-information-outline'></i><span>Info</span></a>` : '',
                    `</div>`,
                    attributionItems.length > 0 ? `<div class='mainInfoModalAttributions'><div class='mainInfoModalAttrLabel'>Map Layer Attributions</div><div class='mainInfoModalAttrList'>${attributionItems.join(' · ')}</div></div>` : '',
                    `<div class='mainInfoModalFooter'>`,
                        `<a href='https://ammos.nasa.gov/' target='_blank' rel='noopener noreferrer'>NASA-AMMOS</a>`,
                    `</div>`,
                `</div>`,
            `</div>`
        ].join('\n')

        Modal.set(
            modalContent,
            function () {
                $('#mainInfoModalClose').on('click', function () {
                    Modal.remove()
                })
            },
            function () {}
        )
    },

    // Take a screenshot of the map (extracted from init's click handler)
    takeScreenshot: function (callback) {
        // We need to manually order leaflet z-indices for this to work
        let zIndices = []
        $('#mapScreen #map .leaflet-tile-pane')
            .children()
            .each(function (i, elm) {
                zIndices.push($(elm).css('z-index'))
                $(elm).css('z-index', i + 1)
            })
        $('.leaflet-control-scalefactor').css('display', 'none')
        $('#mmgis-map-compass').css('display', 'none')
        $('.leaflet-control-zoom').css('display', 'none')
        $('#scaleBar').css('margin-top', '0px')
        const savedMapToolBarBottom =
            $('#mapToolBar').css('bottom') || '0px'
        $('#mapToolBar').css('bottom', '0px')
        // Hide TimeUI for screenshot (synchronous DOM hide)
        const wasTimeUIActive = $('#timeUI').hasClass('active')
        if (wasTimeUIActive) {
            $('#timeUI').css('display', 'none')
        }

        const documentElm = document.getElementById('mapScreen')
        HTML2Canvas(documentElm, {
            allowTaint: true,
            useCORS: true,
            logging: false,
            scrollX: -window.scrollX,
            scrollY: -window.scrollY,
            windowWidth: documentElm.offsetWidth,
            windowHeight: documentElm.offsetHeight,
            onclone: function (e) {
                // Fix svg layer shift
                const originalSVG = document.body.querySelectorAll(
                    'svg.leaflet-zoom-animated'
                )
                const copySVG = e.body.querySelectorAll(
                    'svg.leaflet-zoom-animated'
                )
                copySVG.forEach((copyEle, i) => {
                    const attribute = originalSVG
                        .item(i)
                        .getAttribute('style')
                    const parentElement = copyEle.parentElement
                    parentElement.removeChild(copyEle)
                    const temp = document.createElement('div')
                    temp.appendChild(copyEle)
                    parentElement.appendChild(temp)
                    temp.setAttribute('style', attribute)
                    copyEle.removeAttribute('style')
                })

                // Fix tile layer z-indices
                const originalZ = document.body.querySelectorAll(
                    '.leaflet-tile-pane > div.leaflet-layer'
                )
                const copyZ = e.body.querySelectorAll(
                    '.leaflet-tile-pane > div.leaflet-layer'
                )
                copyZ.forEach((copyEle, i) => {
                    const attribute = originalZ
                        .item(i)
                        .getAttribute('style')
                    copyEle.setAttribute('style', attribute)
                })
            },
        }).then(function (canvas) {
            canvas.id = 'mmgisScreenshot'
            document.body.appendChild(canvas)

            const mission = L_.configData?.msv?.mission
            const time = L_.TimeControl_?.currentTime
            const mapCenter = L_.Map_.map.getCenter()
            const lng = mapCenter.lng.toFixed(4)
            const lat = mapCenter.lat.toFixed(4)

            F_.downloadCanvas(
                canvas.id,
                'mmgis-' + mission + '_' +
                    (time ? time.replaceAll(':', '-') + '_' : '') +
                    lat + '_' + lng,
                function () {
                    canvas.remove()
                    restoreUI()
                    if (callback) callback()
                }
            )
        }).catch(function (err) {
            console.warn('HTML2Canvas screenshot failed:', err)
            restoreUI()
            if (callback) callback()
        })

        // Shared restore function — called on both success and failure so
        // map controls are never left permanently hidden.
        function restoreUI() {
            $('#mapScreen #map .leaflet-tile-pane')
                .children()
                .each(function (i, elm) {
                    $(elm).css('z-index', zIndices[i])
                })
            $('.leaflet-control-scalefactor').css('display', 'flex')
            $('#mmgis-map-compass').css('display', 'block')
            $('.leaflet-control-zoom').css('display', 'block')
            $('#scaleBar').css('margin-top', '5px')
            $('#mapToolBar').css('bottom', savedMapToolBarBottom)
            if (wasTimeUIActive) {
                $('#timeUI').css('display', '')
            }
        }
    },
    toggleHotkeys: function (on) {
        if (on) {
            // Layer toggles
            let layerToggles = []
            Object.keys(L_.layers.data).forEach((layerId, i) => {
                const l = L_.layers.data[layerId]
                if (
                    l.variables?.shortcutSuffix != null &&
                    l.variables.shortcutSuffix.length == 1 &&
                    l.variables.shortcutSuffix.toLowerCase() !=
                        l.variables.shortcutSuffix.toUpperCase()
                )
                    layerToggles.push(
                        [
                            `<li>`,
                            `<div>${l.display_name}</div>`,
                            `<div>ALT + ${l.variables.shortcutSuffix.toUpperCase()}</div>`,
                            `</li>`,
                        ].join('\n')
                    )
            })

            // prettier-ignore
            const modalContent = [
                `<div id='mainHotkeysModal'>`,
                    `<div id='mainHotkeysModalTitle'>`,
                        `<div><i class='mdi mdi-keyboard mdi-18px'></i><div>Hotkeys</div></div>`,
                        `<div id='mainHotkeysModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                    `</div>`,
                    `<div id='mainHotkeysModalContent'>`,
                        layerToggles.length > 0 ? [
                            `<div class='mainHotkeysModalSection'>`,
                                `<div class='mainHotkeysModalSectionTitle'>Layers</div>`,
                                `<ul class='mainHotkeysModalSectionOptions'>`,
                                    `<li class='mainHotkeysModalSectionSubtitle'>Toggle</li>`,
                                    layerToggles.join('\n'),
                                `</ul>`,
                            `</div>`
                        ].join('\n') : '',
                        `<div class='mainHotkeysModalSection'>`,
                            `<div class='mainHotkeysModalSectionTitle'>Draw</div>`,
                            `<ul class='mainHotkeysModalSectionOptions'>`,
                                `<li class='mainHotkeysModalSectionSubtitle'>Toggle</li>`,
                                `<li>`,
                                    `<div>Last File</div>`,
                                    `<div>ALT + 1</div>`,
                                `</li>`,
                                `<li class='mainHotkeysModalSectionSubtitle'>Shapes Tab</li>`,
                                `<li>`,
                                    `<div>Next Feature</div>`,
                                    `<div>Arrow-Right</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Previous Feature</div>`,
                                    `<div>Arrow-Left</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Add to Group</div>`,
                                    `<div>CTRL + Click</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Group Range Select</div>`,
                                    `<div>SHIFT + Click</div>`,
                                `</li>`,
                            `</ul>`,
                        `</div>`,
                        `<div class='mainHotkeysModalSection'>`,
                            `<div class='mainHotkeysModalSectionTitle'>Info</div>`,
                            `<ul class='mainHotkeysModalSectionOptions'>`,
                                `<li class='mainHotkeysModalSectionSubtitle'>Navigate</li>`,
                                `<li>`,
                                    `<div>Next (Ordered) Feature (Top-Bar)</div>`,
                                    `<div>Arrow-Right</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Previous (Ordered) Feature (Top-Bar)</div>`,
                                    `<div>Arrow-Left</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Next (Overlapping) Feature</div>`,
                                    `<div>SHIFT + Arrow-Right</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Previous (Overlapping) Feature</div>`,
                                    `<div>SHIFT + Arrow-Left</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Next (Associated) Feature</div>`,
                                    `<div>CTRL/CMD + Arrow-Right</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Previous (Associated) Feature</div>`,
                                    `<div>CTRL/CMD + Arrow-Left</div>`,
                                `</li>`,
                            `</ul>`,
                        `</div>`,
                        `<div class='mainHotkeysModalSection'>`,
                            `<div class='mainHotkeysModalSectionTitle'>Map</div>`,
                            `<ul class='mainHotkeysModalSectionOptions'>`,
                                `<li>`,
                                    `<div>Zoom out</div>`,
                                    `<div>-</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Zoom In</div>`,
                                    `<div>+</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Zoom to Area</div>`,
                                    `<div>SHIFT + Click-and-Drag</div>`,
                                `</li>`,
                            `</ul>`,
                        `</div>`,
                        `<div class='mainHotkeysModalSection'>`,
                            `<div class='mainHotkeysModalSectionTitle'>3D Globe</div>`,
                            `<ul class='mainHotkeysModalSectionOptions'>`,
                                `<li>`,
                                    `<div>Pan Up</div>`,
                                    `<div>Arrow-Up</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Pan Right</div>`,
                                    `<div>Arrow-Right</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Pan Down</div>`,
                                    `<div>Arrow-Down</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div>Pan Left</div>`,
                                    `<div>Arrow-Left</div>`,
                                `</li>`,
                            `</ul>`,
                        `</div>`,
                    `</div>`,
                `</div>`
            ].join('\n')

            Modal.set(
                modalContent,
                function () {
                    $('#mainHotkeysModalClose').on('click', function () {
                        Modal.remove()
                    })
                },
                function () {}
            )
        } else {
        }
    },
    attachHotkeys: function () {
        Object.keys(L_.layers.data).forEach((layerId, i) => {
            const l = L_.layers.data[layerId]
            if (
                l.variables?.shortcutSuffix != null &&
                l.variables.shortcutSuffix.length == 1 &&
                l.variables.shortcutSuffix.toLowerCase() !=
                    l.variables.shortcutSuffix.toUpperCase()
            ) {
                hotkeys(
                    `alt+${l.variables.shortcutSuffix
                        .toLowerCase()
                        .split('+')}`,
                    { keyUp: true, keyDown: false },
                    (e, handler) => {
                        if (e.repeat) return
                        window.mmgisAPI.toggleLayer(l.name)
                    }
                )
            }
        })
    },
    toggleSettings: function (on) {
        if (on) {
            BottomBar.settings.visibility = BottomBar.settings.visibility || {
                topbar: L_.configData.look.topbar != false,
                toolbars: L_.configData.look.toolbar != false,
                scalebar: L_.configData.look.scalebar != false,
                coordinates: L_.configData.look.coorindates != false,
                graticule: this.UI_ && this.UI_.Map_ ? this.UI_.Map_.graticule != null : false,
                miscellaneous: L_.configData.look.miscellaneous != false,
            }
            // prettier-ignore
            const modalContent = [
                `<div id='mainSettingsModal'>`,
                    `<div id='mainSettingsModalTitle'>`,
                        `<div><i class='mdi mdi-cog mdi-18px'></i><div>Settings</div></div>`,
                        `<div id='mainSettingsModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                    `</div>`,
                    `<div id='mainSettingsModalContent'>`,
                        `<div class='mainSettingsModalSection' id='mainSettingsModalSectionUIVisibility'>`,
                            `<div class='mainSettingsModalSectionTitle'>User Interface Visibility</div>`,
                            `<ul class='mainSettingsModalSectionOptions'>`,
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${BottomBar.settings.visibility.topbar ? 'checked ' : ''}id="checkbox_msmsUIV1" value='topbar'/><label for="checkbox_msmsUIV1"></label></div>`,
                                    `<div>Top Bar</div>`,
                                `</li>`,
                                /* For now because then we need a way to open the settings modal again */
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${BottomBar.settings.visibility.toolbars ? 'checked ' : ''}id="checkbox_msmsUIV2" value='toolbars'/><label for="checkbox_msmsUIV2"></label></div>`,
                                    `<div>Toolbars</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${BottomBar.settings.visibility.scalebar ? 'checked ' : ''}id="checkbox_msmsUIV3" value='scalebar'/><label for="checkbox_msmsUIV3"></label></div>`,
                                    `<div>Scale Bar</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${BottomBar.settings.visibility.coordinates ? 'checked ' : ''}id="checkbox_msmsUIV4" value='coordinates'/><label for="checkbox_msmsUIV4"></label></div>`,
                                    `<div>Coordinates</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${BottomBar.settings.visibility.graticule ? 'checked ' : ''}id="checkbox_msmsUIV5" value='graticule'/><label for="checkbox_msmsUIV5"></label></div>`,
                                    `<div>Graticule</div>`,
                                `</li>`,
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${BottomBar.settings.visibility.miscellaneous ? 'checked ' : ''}id="checkbox_msmsUIV6" value='miscellaneous'/><label for="checkbox_msmsUIV6"></label></div>`,
                                    `<div>Miscellaneous</div>`,
                                `</li>`,
                                (L_.configData.time && L_.configData.time.enabled === true && !L_.UserInterface_?.isMobile ? [
                                `<li>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${$('#timeUI').hasClass('active') ? 'checked ' : ''}id="checkbox_msmsUIV7" value='timeui'/><label for="checkbox_msmsUIV7"></label></div>`,
                                    `<div>Time UI</div>`,
                                `</li>`,
                                ].join('') : ''),
                            `</ul>`,
                        `</div>`,
                        (L_.Globe_ && L_.hasGlobe ? 
                            [`<div class='mainSettingsModalSection' id='mainSettingsModalSection3DGlobe'>`,
                                `<div class='mainSettingsModalSectionTitle'>3D Globe</div>`,
                                `<ul class='mainSettingsModalSectionOptions'>`,
                                    `<li class='flexbetween'>`,
                                        `<div>Radius of Tiles<i title='Number of tiles to query out from the center in the Globe view.\nThe higher the number, the more data queried in the distance (which may hurt performance).\n' class="infoIcon mdi mdi-information mdi-12px"></i></div>`,
                                        `<div class='flexbetween'>`,
                                            `<div id='globeRadiusOfTilesValue' style='padding: 0px 6px;'>${L_.Globe_.litho.options.radiusOfTiles}</div>`,
                                            `<input id='globeSetRadiusOfTiles' class="slider2" type="range" min="4" max="11" step="1" value="${L_.Globe_.litho.options.radiusOfTiles}"/>`,
                                        `</div>`,
                                    `</li>`,
                                `</ul>`,
                            `</div>`].join('') : ''),
                    `</div>`,
                `</div>`
            ].join('\n')

            Modal.set(
                modalContent,
                function () {
                    $('#mainSettingsModalClose').on('click', function () {
                        Modal.remove()
                    })
                    // UI Visibility
                    $(
                        `#mainSettingsModalSectionUIVisibility .mmgis-checkbox > input`
                    ).on('click', function () {
                        const checked = $(this).prop('checked')
                        const value = $(this).attr('value')

                        BottomBar.settings.visibility[value] = checked

                        BottomBar.changeUIVisibility(value, checked)
                    })

                    // 3d Globe
                    // Radius of Tiles
                    $(
                        '#mainSettingsModalSection3DGlobe #globeSetRadiusOfTiles'
                    ).on('input', function () {
                        if (L_.Globe_ && L_.hasGlobe) {
                            L_.Globe_.litho.options.radiusOfTiles = parseInt(
                                $(this).val()
                            )
                            $(
                                '#mainSettingsModalSection3DGlobe #globeRadiusOfTilesValue'
                            ).text(L_.Globe_.litho.options.radiusOfTiles)
                        }
                    })
                },
                function () {}
            )
        } else {
        }
    },
    changeUIVisibility: function (value, checked) {
        if (!checked) {
            // now off
            switch (value) {
                case 'topbar':
                    $('#topBar').css('display', 'none')
                    break
                case 'toolbars':
                    $('#mmgislogo').css('display', 'none')
                    $('#barBottom').css('display', 'none')
                    $('#toolbar').css({
                        display: 'none',
                        width: '0px',
                    })
                    $('#viewerToolBar').css('display', 'none')
                    $('#_lithosphere_controls').css('display', 'none')
                    // Update Zustand store so React SplitScreens removes 40px offset
                    useUIStore.getState().setToolbarVisible(false)
                    window.dispatchEvent(new Event('resize'))
                    break
                case 'scalebar':
                    $('#scaleBarBounds').css('display', 'none')
                    break
                case 'coordinates':
                    $('#CoordinatesDiv').css('display', 'none')
                    break
                case 'graticule':
                    BottomBar.UI_.Map_.toggleGraticule(false)
                    break
                case 'miscellaneous':
                    $('.leaflet-control-container').css('display', 'none')
                    $('.splitterVInner').css('display', 'none')
                    break
                case 'timeui':
                    import('./components/Coordinates/Coordinates').then(m => m.default.toggleTimeUI(false))
                    break
                default:
                    break
            }
        } else {
            // now on
            switch (value) {
                case 'topbar':
                    $('#topBar').css('display', 'flex')
                    break
                case 'toolbars':
                    $('#mmgislogo').css('display', 'inherit')
                    $('#barBottom').css('display', 'flex')
                    $('#toolbar').css({
                        display: 'inherit',
                        width: '40px',
                    })
                    $('#viewerToolBar').css('display', 'inherit')
                    $('#_lithosphere_controls').css('display', 'inherit')
                    // Update Zustand store so React SplitScreens restores 40px offset
                    useUIStore.getState().setToolbarVisible(true)
                    window.dispatchEvent(new Event('resize'))
                    break
                case 'scalebar':
                    $('#scaleBarBounds').css('display', 'inherit')
                    break
                case 'coordinates':
                    $('#CoordinatesDiv').css('display', 'flex')
                    break
                case 'graticule':
                    BottomBar.UI_.Map_.toggleGraticule(true)
                    break
                case 'miscellaneous':
                    $('.leaflet-control-container').css('display', 'block')
                    $('.splitterVInner').css('display', 'inline-flex')
                    break
                case 'timeui':
                    import('./components/Coordinates/Coordinates').then(m => m.default.toggleTimeUI(true))
                    break
                default:
                    break
            }
        }
    },
    fullscreen: function () {
        var isInFullScreen =
            (document.fullscreenElement &&
                document.fullscreenElement !== null) ||
            (document.webkitFullscreenElement &&
                document.webkitFullscreenElement !== null) ||
            (document.mozFullScreenElement &&
                document.mozFullScreenElement !== null) ||
            (document.msFullscreenElement &&
                document.msFullscreenElement !== null)

        var docElm = document.documentElement
        if (!isInFullScreen) {
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen()
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen()
            } else if (docElm.webkitRequestFullScreen) {
                docElm.webkitRequestFullScreen()
            } else if (docElm.msRequestFullscreen) {
                docElm.msRequestFullscreen()
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen()
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen()
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen()
            }
        }
    },
    fina: function () {
        BottomBar.attachHotkeys()
    },
}

export default BottomBar
