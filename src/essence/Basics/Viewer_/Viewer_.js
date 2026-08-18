import $ from 'jquery'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'

import * as THREE from '../../../external/THREE/three118'

import Photosphere from './Photosphere'
import ModelViewer from './ModelViewer'
import PDFViewer from './PDFViewer'

import Dropy from '../../../external/Dropy/dropy'

import './Viewer_.css'

let L = window.L

var Viewer_ = {
    wasInitialized: false,
    viewer: $('#viewer'),
    images: [],
    feature: null,
    layer: null,
    imageDiv: null,
    url: null,
    ext: null,
    img: null,
    masterImg: null,
    w: null,
    h: null,
    northEast: null,
    southWest: null,
    bounds: null,
    zoomDiff: 3,
    imageViewer: null,
    imageViewerOverlay: null,
    imageViewerMap: null,
    imagePanorama: null,
    imageModel: null,
    imagePDF: null,
    imageVideo: null,
    imageGif: null,
    imageIntro: null,
    photosphere: null,
    modelviewer: null,
    pdfviewer: null,
    baseToolbar: null,
    lookupPath: null,
    toolBar: null,
    toolBarSelector: null,
    lastImageId: null,
    Map_: null,
    init: function () {
        this.viewer = $('#viewer')
        this.imageViewer = $('<div>')
            .attr('id', 'imageViewerMap')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'display': 'none',
                'cursor': 'crosshair'
            })
        $('#viewer').append(this.imageViewer)

        this.imagePanorama = $('<div>')
            .attr('id', 'imagePanoramaWebGL')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'display': 'none'
            })
        $('#viewer').append(this.imagePanorama)

        this.imageModel = $('<div>')
            .attr('id', 'imageModelWebGL')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'display': 'none'
            })
        $('#viewer').append(this.imageModel)

        this.imagePDF = $('<div>')
            .attr('id', 'imagePDF')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'display': 'none'
            })
        $('#viewer').append(this.imagePDF)

        const pdfInnerDiv = $('<div>')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'overflow-y': 'auto',
                'display': 'flex',
                'justify-content': 'center'
            })
        this.imagePDF.append(pdfInnerDiv)

        const pdfViewerWrapper = $('<div>')
            .attr('id', 'pdfViewerWrapper')
            .css({
                'position': 'absolute',
                'overflow-y': 'auto',
                'width': '100%',
                'top': '35px',
                'padding': '60px 0px',
                'height': 'calc(100% - 35px)'
            })
        pdfInnerDiv.append(pdfViewerWrapper)

        this.imageVideo = $('<div>')
            .attr('id', 'imageVideo')
            .css({
                'position': 'absolute',
                'width': '100%',
                'top': '40px',
                'height': 'calc(100% - 80px)',
                'display': 'none',
                'background': 'black'
            })
        $('#viewer').append(this.imageVideo)

        const videoPlayer = $('<video>')
            .attr({
                'id': 'videoPlayer',
                'controls': true
            })
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'object-fit': 'contain'
            })
        this.imageVideo.append(videoPlayer)

        this.imageGif = $('<div>')
            .attr('id', 'imageGif')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%',
                'display': 'none',
                'align-items': 'center',
                'justify-content': 'center',
                'background': 'var(--color-a)'
            })
        $('#viewer').append(this.imageGif)

        const gifImage = $('<img>')
            .attr('id', 'gifImage')
            .css({
                'max-width': '100%',
                'max-height': '100%',
                'object-fit': 'contain'
            })
        this.imageGif.append(gifImage)

        this.imageIntro = $('<div>')
            .attr('id', 'imageViewerIntro')
            .css({
                'position': 'absolute',
                'width': '100%',
                'height': '100%'
            })
        $('#viewer').append(this.imageIntro)

        const introMessage = $('<div>')
            .css({
                'position': 'absolute',
                'top': '50%',
                'left': '50%',
                'transform': 'translateX(-50%) translateY(-50%)',
                'width': '200px',
                'text-align': 'center'
            })
            .html('To begin, select any imagery-enabled feature.')
        this.imageIntro.append(introMessage)

        this.lookupPath = L_.missionPath + 'Data/mosaic_parameters.csv'

        buildToolBar()

        this.imageViewerMap = OpenSeadragon({
            id: 'imageViewerMap',
            //prefixUrl: 'scripts/external/OpenSeadragon/images/',
            //showNavigationControl: false,
            showFullPageControl: false,
            zoomInButton: 'osd-zoomin',
            zoomOutButton: 'osd-zoomout',
            homeButton: 'osd-home',
            showNavigator: true,
            navigatorPosition: 'ABSOLUTE',
            navigatorTop: 'calc( 100% - 135px )',
            navigatorLeft: '12px',
            navigatorHeight: '128px',
            navigatorWidth: '128px',
            minZoomLevel: 0.5,
            maxZoomLevel: 12,
            ajaxWithCredentials: true,
            //zoomPerClick: 1, //disables click to zoom for tools...
            imageSmoothingEnabled: false,
        })

        this.wasInitialized = true
    },
    fina: function (map_) {
        Viewer_.Map_ = map_
    },
    clearImage: function () {
        this.imagePanorama.css('display', 'none')
        this.imageViewer.css('display', 'none')
        this.imageModel.css('display', 'none')
        this.imagePDF.css('display', 'none')
        this.imageVideo.css('display', 'none')
        this.imageGif.css('display', 'none')
        this.baseToolbar.css('display', 'none')
        this.imageIntro.css('display', 'block')
    },
    //This sets the main image url that the shown image derives from
    //This image can be any size as it won't ever be displayed
    setMasterImage: function (m) {
        this.masterImg = m
    },
    //images is [ { 'url': '', 'name': '', 'isPanoramic': false },{...}, ... ]
    //Shows the first image too
    changeImages: function (feature, layer) {
        let images = L_.propertiesToImages(
            feature.properties,
            layer.options.metadata ? layer.options.metadata.base_url || '' : ''
        )

        // Don't refresh if the same exact point is clicked,
        // that's just annoying. So skip over it.
        if (
            Viewer_.feature &&
            JSON.stringify(Viewer_.feature) === JSON.stringify(feature) &&
            Viewer_.layer &&
            Viewer_.layer?.options?.layerName === layer?.options?.layerName
        ) {
            return
        }

        images = images || []
        Viewer_.images = images
        Viewer_.feature = feature
        Viewer_.layer = layer

        var imageI = 0
        var setLocAfter = false
        if (L_.FUTURES.viewerImg !== null) {
            imageI = L_.FUTURES.viewerImg
            setLocAfter = true
            L_.FUTURES.viewerImg = null
        }

        updateDropdown(images, imageI)

        Viewer_.changeImage(imageI, setLocAfter)
    },
    //exts is optional. It's an array of extensions to to the url
    //ext can also be false to skip changing the dropdown
    //o is object with options url:"", isPanoramic:bool
    //and optional options exts:[],ext:int/false, masterImg:""
    changeImage: function (imageId, setLocAfter) {
        if (!this.wasInitialized) return

        if (Viewer_.Map_)
            Viewer_.Map_.rmNotNull(Viewer_.Map_.tempPhotosphereWedge)

        let o = Viewer_.images[imageId]

        Viewer_.lastImageId = imageId
        if (o == null) {
            this.imageModel.css('display', 'none')
            this.imagePDF.css('display', 'none')
            this.imagePanorama.css('display', 'none')
            this.imageViewer.css('display', 'none')
            this.imageVideo.css('display', 'none')
            this.imageGif.css('display', 'none')
            this.baseToolbar.css('display', 'none')
            this.imageIntro.css('display', 'block')
            return
        }

        //Make sure dropdown matches image

        let url = o.url

        Viewer_.toolBarLoading.html('Loading')
        this.url = url

        const extLow = F_.getExtension(url).toLowerCase()

        if (o.hasOwnProperty('master') && o.master != null) {
            this.masterImg = o.master
            //Check if it's absolute or relative
            //../../../../ is from get_profile to mmgis dir
            if (!F_.isUrlAbsolute(this.masterImg))
                this.masterImg =
                    '../../../../' + L_.missionPath + this.masterImg
        } else this.masterImg = null

        if (o.isModel) {
            this.imageModel.css('display', 'inherit')
            this.imagePDF.css('display', 'none')
            this.imagePanorama.css('display', 'none')
            this.imageViewer.css('display', 'none')
            this.imageVideo.css('display', 'none')
            this.imageGif.css('display', 'none')
            this.baseToolbar.css('display', 'none')

            this.imageIntro.css('display', 'none')

            if (this.modelviewer == null) {
                this.modelviewer = ModelViewer(
                    document.getElementById('imageModelWebGL'),
                    this.lookupPath
                )
            }

            let textureURL = o.texture
            if (!F_.isUrlAbsolute(textureURL))
                textureURL = '../../../../' + L_.missionPath + textureURL

            window.onresize = this.modelviewer.resize
            Viewer_.toolBarLoading.css('opacity', '1')
            this.modelviewer.changeModel(
                url,
                textureURL,
                function (err) {
                    if (err) {
                        console.log(err)
                        Viewer_.toolBarLoading.html(err)
                    } else {
                        Viewer_.toolBarLoading.html('Loading')
                        Viewer_.modelviewer.resize()
                    }
                },
                function (progress) {
                    Viewer_.toolBarLoading.html('Loading ' + progress + '%')
                    if (progress == 100) {
                        Viewer_.toolBarLoading.css('opacity', '0')
                        if (setLocAfter) {
                            var l = L_.FUTURES.viewerLoc
                            Viewer_.modelviewer.setTarget(
                                l[0],
                                l[1],
                                l[2],
                                l[3],
                                l[4],
                                l[5]
                            )
                            L_.FUTURES.viewerLoc = null
                        }
                    }
                }
            )
        } else if (o.isPanoramic) {
            this.imagePanorama.css('display', 'inherit')
            this.imageViewer.css('display', 'none')
            this.imageModel.css('display', 'none')
            this.imagePDF.css('display', 'none')
            this.imageVideo.css('display', 'none')
            this.imageGif.css('display', 'none')
            this.baseToolbar.css('display', 'none')
            this.imageIntro.css('display', 'none')

            if (this.photosphere == null) {
                this.photosphere = Photosphere(
                    document.getElementById('imagePanoramaWebGL'),
                    this.lookupPath,
                    null,
                    Viewer_.Map_
                )
            }
            window.onresize = this.photosphere.resize

            Viewer_.toolBarLoading.css('opacity', '1')
            this.photosphere.changeImage(
                o,
                Viewer_.feature,
                Viewer_.layer,
                function (err) {
                    if (err) {
                        console.log(err)
                        Viewer_.toolBarLoading.html(err)
                    } else {
                        Viewer_.toolBarLoading.css('opacity', '0')
                        if (setLocAfter) {
                            var l = L_.FUTURES.viewerLoc
                            Viewer_.photosphere.setTarget(
                                l[0],
                                l[1],
                                l[2],
                                l[3]
                            )
                            L_.FUTURES.viewerLoc = null
                        }
                        Viewer_.photosphere.resize()
                    }
                }
            )
        } else if (/*o.type === 'document' && */ extLow === 'pdf') {
            this.imagePDF.css('display', 'inherit')
            this.imagePanorama.css('display', 'none')
            this.imageViewer.css('display', 'none')
            this.imageModel.css('display', 'none')
            this.imageVideo.css('display', 'none')
            this.imageGif.css('display', 'none')
            this.baseToolbar.css('display', 'none')
            this.imageIntro.css('display', 'none')

            if (this.pdfviewer == null) {
                this.pdfviewer = PDFViewer()
            }

            this.pdfviewer.changePDF(url, 'pdfViewerContainer', function (err) {
                if (err) {
                    console.log(err)
                } else {
                    console.log('here')
                }
            })
        } else if (o.isVideo || extLow === 'webm' || extLow === 'mp4') {
            this.imageVideo.css('display', 'inherit')
            this.imagePDF.css('display', 'none')
            this.imagePanorama.css('display', 'none')
            this.imageViewer.css('display', 'none')
            this.imageModel.css('display', 'none')
            this.imageGif.css('display', 'none')
            this.baseToolbar.css('display', 'none')
            this.imageIntro.css('display', 'none')

            // Get the video element
            const videoElement = document.getElementById('videoPlayer')

            // Set the video source
            videoElement.src = url

            // Handle loading events
            Viewer_.toolBarLoading.css('opacity', '1')

            videoElement.onloadeddata = function () {
                Viewer_.toolBarLoading.css('opacity', '0')
            }

            videoElement.onerror = function () {
                Viewer_.toolBarLoading.html('Error loading video')
                setTimeout(() => {
                    Viewer_.toolBarLoading.css('opacity', '0')
                }, 2000)
            }
        } else if (o.isGif || extLow === 'gif') {
            this.imageGif.css('display', 'flex')
            this.imageVideo.css('display', 'none')
            this.imagePDF.css('display', 'none')
            this.imagePanorama.css('display', 'none')
            this.imageViewer.css('display', 'none')
            this.imageModel.css('display', 'none')
            this.baseToolbar.css('display', 'flex')
            this.imageIntro.css('display', 'none')

            // Get the img element
            const imgElement = document.getElementById('gifImage')

            // Set the image source
            imgElement.src = url

            // Handle loading events
            Viewer_.toolBarLoading.css('opacity', '1')

            imgElement.onload = function () {
                Viewer_.toolBarLoading.css('opacity', '0')
            }

            imgElement.onerror = function () {
                Viewer_.toolBarLoading.html('Error loading GIF')
                setTimeout(() => {
                    Viewer_.toolBarLoading.css('opacity', '0')
                }, 2000)
            }
        } else {
            this.imageViewer.css('display', 'inherit')
            this.imagePanorama.css('display', 'none')
            this.imageModel.css('display', 'none')
            this.imagePDF.css('display', 'none')
            this.imageVideo.css('display', 'none')
            this.imageGif.css('display', 'none')
            this.baseToolbar.css('display', 'flex')
            this.imageIntro.css('display', 'none')

            if (Viewer_.imageViewerOverlay != null) {
                Viewer_.imageViewerMap.removeLayer(Viewer_.imageViewerOverlay)
            }
            //Save the old image to get rid of it when the new one is loaded
            //var oldImage = this.imageViewerMap.world.getItemAt( 0 );
            Viewer_.toolBarLoading.css('opacity', '1')

            if (o.isDZI || F_.getExtension(url).toLowerCase() === 'xml') {
                finishLoad()
                this.imageViewerMap.open(url)
            } else {
                finishLoad()
                this.imageViewerMap.addSimpleImage({ url: url })
            }
        }
        function finishLoad() {
            var numImgs = Viewer_.imageViewerMap.world._items.length
            for (var i = 0; i < numImgs; i++) {
                var oldImg = Viewer_.imageViewerMap.world.getItemAt(i)
                if (oldImg) {
                    Viewer_.imageViewerMap.world.removeItem(oldImg)
                }
            }

            Viewer_.toolBarLoading.css('opacity', '0')

            if (setLocAfter) {
                setTimeout(function () {
                    //Because openseadragon's simple image open event is broken
                    const l = L_.FUTURES.viewerLoc
                    if (l)
                        Viewer_.imageViewerMap.viewport.fitBounds(
                            new OpenSeadragon.Rect(l[0], l[1], l[2], l[3])
                        )
                    L_.FUTURES.viewerLoc = null
                }, 2000)
            }
        }
    },
    calculateBounds: function () {
        this.southWest = this.imageViewerMap.unproject(
            [0, this.h],
            this.imageViewerMap.getMaxZoom() - this.zoomDiff
        )
        this.northEast = this.imageViewerMap.unproject(
            [this.w, 0],
            this.imageViewerMap.getMaxZoom() - this.zoomDiff
        )
        this.bounds = new L.LatLngBounds(this.southWest, this.northEast)
    },
    highlight: function (layer) {
        if (this.photosphere != null) {
            this.photosphere.highlight(layer)
        }
    },
    invalidateSize: function () {
        if (this.modelviewer != null) {
            this.modelviewer.resize()
        }
        if (this.photosphere != null) {
            this.photosphere.resize()
        }
        if (this.imageViewerOverlay != null) {
            this.imageViewerMap.invalidateSize()
            this.calculateBounds()
            this.imageViewerMap.setMaxBounds(this.bounds)
        }
        if (this.imageViewer != null) {
            // Wait a bit for the viewer panel to be visible before updating the image viewer
            setTimeout(function () {
                Viewer_.imageViewerMap.viewport.fitBounds(
                    Viewer_.imageViewerMap.viewport.getHomeBounds(),
                    true
                )
            }, 10)
        }
    },
    getLastImageId() {
        return Viewer_.lastImageId == null ? false : Viewer_.lastImageId
    },
    getLocation() {
        var o = Viewer_.images[Viewer_.lastImageId]
        if (o == null) return false

        if (o.isModel) {
            var cam = Viewer_.modelviewer.camera
            var con = Viewer_.modelviewer.controls

            var pos = cam.position
            var tar = con.target
            return (
                pos.x +
                ',' +
                pos.y +
                ',' +
                pos.z +
                ',' +
                tar.x +
                ',' +
                tar.y +
                ',' +
                tar.z
            )
        } else if (o.isPanoramic) {
            var tar = Viewer_.photosphere.getTarget()
            return (
                tar[0].toFixed(5) +
                ',' +
                tar[1].toFixed(5) +
                ',' +
                tar[2].toFixed(5) +
                ',' +
                tar[3]
            )
        } else {
            var b = Viewer_.imageViewerMap.viewport.getBounds()
            return b.x + ',' + b.y + ',' + b.width + ',' + b.height
        }
    },
}

function buildToolBar() {
    $('#viewerToolBar').html('')

    const toolBarContainer = $('<div>')
        .attr('class', 'childpointerevents')
        .css({
            'display': 'flex',
            'flex-direction': 'column',
            'align-items': 'flex-end',
            'padding': '5px'
        })
    $('#viewerToolBar').append(toolBarContainer)
    Viewer_.toolBar = toolBarContainer

    Viewer_.baseToolbar = $('<div>')
        .attr('class', 'osd-custom-buttons')
        .css({
            'display': 'flex',
            'flex-direction': 'column',
            'align-items': 'flex-end'
        })
    Viewer_.toolBar.append(Viewer_.baseToolbar)

    // prettier-ignore
    Viewer_.baseToolbar.append($('<div>')
        .attr('id', 'osd-settings')
        .css({
            'display': 'flex',
            'width': 'auto',
            'padding': '0px 6px'
        })
        .html(
            [
                '<div>',
                    "<div id='Viewer_Settings' class='mmgisButton3' title='Link' style='height: unset; line-height: 24px; margin: unset; padding-left: unset; padding-right: unset; border-radius: unset;'>",
                        "<i class='mdi mdi-tune mdi-18px'></i>",
                    '</div>',
                    "<div id='Viewer_SettingsSettings' class='mmgisButton3' style='height: unset; line-height: 24px; margin: unset; padding-left: unset; padding-right: unset; border-radius: unset;'>",
                        "<i class='mdi mdi-menu-down mdi-18px'></i>",
                    '</div>',
                    "<div id='Viewer_SettingsReset' class='mmgisButton3' style='display: none; height: unset; line-height: 24px; margin: unset; padding-left: unset; padding-right: unset; border-radius: unset;'>",
                        "<i class='mdi mdi-refresh mdi-18px'></i>",
                    '</div>',
                    "<div id='Viewer_SettingsSettingsPanel' style='display: none; position: absolute; top: 100%; right: 0; background: var(--color-a); width: 42px;'>",
                        '<ul style="position: absolute; left: 0; list-style-type: none; margin: 0; padding: 8px 8px 5px 8px; border-radius: 3px; width: 220px; background: var(--color-a);">',
                            '<li style="height: 19px; line-height: 19px;">',
                                '<div style="display: flex; justify-content: space-between;">',
                                    '<div style="font-size: 13px;">Rotation</div>',
                                    '<input class="viewer_rotationslider slider2" style="background: var(--color-a3); width: 120px;" type="range" min="0" max="360" step="1" value="0" default="0">',
                                '</div>',
                            '</li>',
                            '<li style="height: 19px; line-height: 19px;">',
                                '<div style="display: flex; justify-content: space-between;">',
                                    '<div style="font-size: 13px;">Brightness</div>',
                                    '<input class="viewer_filterslider viewer_filterslider_brightness slider2" style="background: var(--color-a3); width: 120px;" type="range" min="0.25" max="2" step="0.05" value="1" default="1">',
                                '</div>',
                            '</li>',
                            '<li style="height: 19px; line-height: 19px;">',
                                '<div style="display: flex; justify-content: space-between;">',
                                    '<div style="font-size: 13px;">Contrast</div>',
                                    '<input class="viewer_filterslider viewer_filterslider_contrast slider2" style="background: var(--color-a3); width: 120px;" type="range" min="0.25" max="6" step="0.05" value="1" default="1">',
                                '</div>',
                            '</li>',
                            '<li style="height: 19px; line-height: 19px;">',
                                '<div style="display: flex; justify-content: space-between;">',
                                    '<div style="font-size: 13px;">Saturation</div>',
                                    '<input class="viewer_filterslider viewer_filterslider_saturate slider2" style="background: var(--color-a3); width: 120px;" type="range" min="0" max="2" step="0.05" value="1" default="1">',
                                '</div>',
                            '</li>',
                        '</ul>',
                    '</div>',
                '<div>',
            ].join('')
        ))


    Viewer_.baseToolbar.append($('<div>')
        .attr('id', 'osd-zoomin')
        .html("<i class='mdi mdi-plus mdi-18px'></i>"))
    Viewer_.baseToolbar.append($('<div>')
        .attr('id', 'osd-zoomout')
        .html("<i class='mdi mdi-minus mdi-18px'></i>"))
    Viewer_.baseToolbar.append($('<div>')
        .attr('id', 'osd-home')
        .html("<i class='mdi mdi-home-variant-outline mdi-18px'></i>"))
    $('#Viewer_SettingsSettings, #Viewer_Settings').click(function () {
        var display = $('#Viewer_SettingsSettingsPanel').css('display')
        if (display == 'none') {
            $('#Viewer_SettingsSettingsPanel').css('display', 'inherit')
            $('#Viewer_SettingsReset').css('display', 'inline')
        } else {
            $('#Viewer_SettingsSettingsPanel').css('display', 'none')
            $('#Viewer_SettingsReset').css('display', 'none')
        }
    })

    $('.viewer_rotationslider').on('input', function () {
        Viewer_.imageViewerMap.viewport.setRotation($(this).val())
    })
    $('#Viewer_SettingsReset').on('click', function () {
        $('.viewer_rotationslider').val(0)
        Viewer_.imageViewerMap.viewport.setRotation(0)

        $('.viewer_filterslider_brightness').val(1)
        $('.viewer_filterslider_contrast').val(1)
        $('.viewer_filterslider_saturate').val(1)
        $('#viewer .openseadragon-canvas').css({
            filter: 'brightness(1) contrast(1) saturate(1)',
        })
    })
    $('.viewer_filterslider').on('input', function () {
        let brightness = $(this).hasClass('viewer_filterslider_brightness')
            ? $(this).val()
            : $('.viewer_filterslider_brightness').val()
        let contrast = $(this).hasClass('viewer_filterslider_contrast')
            ? $(this).val()
            : $('.viewer_filterslider_contrast').val()
        let saturation = $(this).hasClass('viewer_filterslider_saturation')
            ? $(this).val()
            : $('.viewer_filterslider_saturate').val()

        $('#viewer .openseadragon-canvas').css({
            filter:
                'brightness(' +
                brightness +
                ') contrast(' +
                contrast +
                ') saturate(' +
                saturation +
                ')',
        })
    })

    Viewer_.toolBarSelector = $('<div>')
        .attr('id', 'viewer_dropdownselector')
    Viewer_.toolBar.prepend(Viewer_.toolBarSelector)

    Viewer_.toolBarLoading = $('<div>')
        .attr('id', 'viewer_loading')
        .html('Loading')
    $('#viewer').append(Viewer_.toolBarLoading)

    Viewer_.toolBarhelp = $('<div>')
        .attr('id', 'viewer_Help')
        .html('Rotate - Left Click and Drag<br>Zoom - Mouse Wheel')
    Viewer_.toolBar.append(Viewer_.toolBarhelp)

    //I know, I know; it's not in the toolbar.
    const oc = $('<button>')
        .attr('id', 'viewerDeviceOrientationButton')
    Viewer_.imagePanorama.append(oc)

    oc.append($('<i>')
        .css('transition', 'all 0.2s ease-in')
        .attr('class', 'mdi mdi-screen-rotation mdi-24px')
        .css('cursor', 'pointer'))
    oc.append($('<div>').css('line-height', '27px'))

    var ocButton = document.getElementById('viewerDeviceOrientationButton')
    ocButton.onmouseleave = function () {
        ocButton.style.opacity = '0.4'
        ocButton.style.width = '45px'
        ocButton.getElementsByTagName('div')[0].textContent = ''
    }
    ocButton.onmouseenter = function () {
        ocButton.style.opacity = '1'
        ocButton.style.width = '136px'
        ocButton.getElementsByTagName('div')[0].textContent = 'TILT CONTROL'
        setTimeout(function () {
            ocButton.onmouseleave()
        }, 3000)
    }
    ocButton.onclick = function () {
        if (Viewer_.photosphere) {
            Viewer_.photosphere.toggleControls()
        }
        setTimeout(function () {
            ocButton.onmouseleave()
        }, 3000)
    }
}

function updateDropdown(images, imgI) {
    var dropdownRefresh = false
    images = images || []

    const noImageryName = 'No Imagery'

    if (images.length == 0) {
        images = [{ name: noImageryName }]
        imgI = 0
    }

    $('#viewer_dropdownselector').html(
        Dropy.construct(
            images.map((elm) => elm.name),
            images[imgI].name,
            imgI
        )
    )
    Dropy.init($('#viewer_dropdownselector'), function (idx) {
        Viewer_.changeImage(idx)
    })

    dropdownRefresh = true
}

export default Viewer_
