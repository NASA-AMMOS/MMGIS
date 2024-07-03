import $ from 'jquery'
import * as d3 from 'd3'
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
        this.imageViewer = d3
            .select('#viewer')
            .append('div')
            .attr('id', 'imageViewerMap')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'none')
            .style('cursor', 'crosshair')

        this.imagePanorama = d3
            .select('#viewer')
            .append('div')
            .attr('id', 'imagePanoramaWebGL')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'none')

        this.imageModel = d3
            .select('#viewer')
            .append('div')
            .attr('id', 'imageModelWebGL')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'none')

        this.imagePDF = d3
            .select('#viewer')
            .append('div')
            .attr('id', 'imagePDF')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'none')

        this.imagePDF
            .append('div')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%')
            .style('overflow-y', 'auto')
            .style('display', 'flex')
            .style('justify-content', 'center')
            .append('div')
            .attr('id', 'pdfViewerWrapper')
            .style('position', 'absolute')
            .style('overflow-y', 'auto')
            .style('width', '100%')
            .style('top', '35px')
            .style('padding', '60px 0px')
            .style('height', 'calc(100% - 35px)')

        this.imageIntro = d3
            .select('#viewer')
            .append('div')
            .attr('id', 'imageViewerIntro')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%')
        this.imageIntro
            .append('div')
            .style('position', 'absolute')
            .style('top', '50%')
            .style('left', '50%')
            .style('transform', 'translateX(-50%) translateY(-50%)')
            .style('width', '200px')
            .style('text-align', 'center')
            .html('To begin, select any imagery-enabled feature.')

        this.lookupPath =
            'Missions/' + L_.mission + '/' + 'Data/mosaic_parameters.csv'

        buildToolBar()

        this.imageViewerMap = OpenSeadragon({
            id: 'imageViewerMap',
            //prefixUrl: 'scripts/external/OpenSeadragon/images/',
            defaultZoomLevel: 0.5,
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
        this.imagePanorama.style('display', 'none')
        this.imageViewer.style('display', 'none')
        this.imageModel.style('display', 'none')
        this.imagePDF.style('display', 'none')
        this.baseToolbar.style('display', 'none')
        this.imageIntro.style('display', 'block')
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
            this.imageModel.style('display', 'none')
            this.imagePDF.style('display', 'none')
            this.imagePanorama.style('display', 'none')
            this.imageViewer.style('display', 'none')
            this.baseToolbar.style('display', 'none')
            this.imageIntro.style('display', 'block')
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
            this.imageModel.style('display', 'inherit')
            this.imagePDF.style('display', 'none')
            this.imagePanorama.style('display', 'none')
            this.imageViewer.style('display', 'none')
            this.baseToolbar.style('display', 'none')

            this.imageIntro.style('display', 'none')

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
            Viewer_.toolBarLoading.style('opacity', '1')
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
                        Viewer_.toolBarLoading.style('opacity', '0')
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
            this.imagePanorama.style('display', 'inherit')
            this.imageViewer.style('display', 'none')
            this.imageModel.style('display', 'none')
            this.imagePDF.style('display', 'none')
            this.baseToolbar.style('display', 'none')
            this.imageIntro.style('display', 'none')

            if (this.photosphere == null) {
                this.photosphere = Photosphere(
                    document.getElementById('imagePanoramaWebGL'),
                    this.lookupPath,
                    null,
                    Viewer_.Map_
                )
            }
            window.onresize = this.photosphere.resize

            Viewer_.toolBarLoading.style('opacity', '1')
            this.photosphere.changeImage(
                o,
                Viewer_.feature,
                Viewer_.layer,
                function (err) {
                    if (err) {
                        console.log(err)
                        Viewer_.toolBarLoading.html(err)
                    } else {
                        Viewer_.toolBarLoading.style('opacity', '0')
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
            this.imagePDF.style('display', 'inherit')
            this.imagePanorama.style('display', 'none')
            this.imageViewer.style('display', 'none')
            this.imageModel.style('display', 'none')
            this.baseToolbar.style('display', 'none')
            this.imageIntro.style('display', 'none')

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
        } else {
            this.imageViewer.style('display', 'inherit')
            this.imagePanorama.style('display', 'none')
            this.imageModel.style('display', 'none')
            this.imagePDF.style('display', 'none')
            this.baseToolbar.style('display', 'flex')
            this.imageIntro.style('display', 'none')

            if (Viewer_.imageViewerOverlay != null) {
                Viewer_.imageViewerMap.removeLayer(Viewer_.imageViewerOverlay)
            }
            //Save the old image to get rid of it when the new one is loaded
            //var oldImage = this.imageViewerMap.world.getItemAt( 0 );
            Viewer_.toolBarLoading.style('opacity', '1')

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

            Viewer_.toolBarLoading.style('opacity', '0')

            if (setLocAfter) {
                setTimeout(function () {
                    //Because openseadragon's simple image open event is broken
                    var l = L_.FUTURES.viewerLoc
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
    d3.select('#viewerToolBar').html('')

    Viewer_.toolBar = d3
        .select('#viewerToolBar')
        .append('div')
        .append('div')
        .attr('class', 'row childpointerevents')
        .style('display', 'flex')
        .style('justify-content', 'space-between')
        .style('padding', '0px 5px')
    //.style()

    let left = Viewer_.toolBar.append('div')

    Viewer_.baseToolbar = left
        .append('div')
        .attr('class', 'osd-custom-buttons')
        .style('display', 'flex')
    Viewer_.baseToolbar
        .append('div')
        .attr('id', 'osd-zoomin')
        .html("<i class='mdi mdi-plus mdi-18px'></i>")
    Viewer_.baseToolbar
        .append('div')
        .attr('id', 'osd-zoomout')
        .html("<i class='mdi mdi-minus mdi-18px'></i>")
    Viewer_.baseToolbar
        .append('div')
        .attr('id', 'osd-home')
        .html("<i class='mdi mdi-home-variant-outline mdi-18px'></i>")

    // prettier-ignore
    Viewer_.baseToolbar
            .append('div')
            .attr('id', 'osd-settings')
            .style('display', 'flex')
            .style('width', 'auto')
            .style('padding', '0px 6px')
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
                        "<div id='Viewer_SettingsSettingsPanel' style='display: none; position: absolute; top: 27px; background: var(--color-a); width: 42px; margin-left: 6px;'>",
                            '<ul style="position: absolute; left: -12px; list-style-type: none; margin: 0; padding: 8px 8px 5px 8px; border-radius: 3px; width: 220px; background: var(--color-a);">',
                                '<li style="height: 19px; line-height: 19px;">',
                                    '<div style="display: flex; justify-content: space-between;">',
                                        '<div style="font-size: 13px;">Rotation</div>',
                                        '<input class="viewer_rotationslider slider2" style="background: #444444; width: 120px;" type="range" min="0" max="360" step="1" value="0" default="0">',
                                    '</div>',
                                '</li>',
                                '<li style="height: 19px; line-height: 19px;">',
                                    '<div style="display: flex; justify-content: space-between;">',
                                        '<div style="font-size: 13px;">Brightness</div>',
                                        '<input class="viewer_filterslider viewer_filterslider_brightness slider2" style="background: #444444; width: 120px;" type="range" min="0.25" max="2" step="0.05" value="1" default="1">',
                                    '</div>',
                                '</li>',
                                '<li style="height: 19px; line-height: 19px;">',
                                    '<div style="display: flex; justify-content: space-between;">',
                                        '<div style="font-size: 13px;">Contrast</div>',
                                        '<input class="viewer_filterslider viewer_filterslider_contrast slider2" style="background: #444444; width: 120px;" type="range" min="0.25" max="6" step="0.05" value="1" default="1">',
                                    '</div>',
                                '</li>',
                                '<li style="height: 19px; line-height: 19px;">',
                                    '<div style="display: flex; justify-content: space-between;">',
                                        '<div style="font-size: 13px;">Saturation</div>',
                                        '<input class="viewer_filterslider viewer_filterslider_saturate slider2" style="background: #444444; width: 120px;" type="range" min="0" max="2" step="0.05" value="1" default="1">',
                                    '</div>',
                                '</li>',
                            '</ul>',
                        '</div>',
                    '<div>',
                ].join('')
            )

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

    Viewer_.toolBarSelector = Viewer_.toolBar
        .append('div')
        .attr('id', 'viewer_dropdownselector')

    Viewer_.toolBarLoading = d3
        .select('#viewer')
        .append('div')
        .attr('id', 'viewer_loading')
        .html('Loading')

    Viewer_.toolBarhelp = Viewer_.toolBar
        .append('div')
        .attr('id', 'viewer_Help')
        .html('Rotate - Left Click and Drag<br>Zoom - Mouse Wheel')

    //I know, I know; it's not in the toolbar.
    var oc = Viewer_.imagePanorama
        .append('button')
        .attr('id', 'viewerDeviceOrientationButton')

    oc.append('i')
        .style('transition', 'all 0.2s ease-in')
        .attr('class', 'mdi mdi-screen-rotation mdi-24px')
        .style('cursor', 'pointer')
    oc.append('div').style('line-height', '27px')

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
