define([
    'd3',
    'Formulae_',
    'Layers_',
    'openSeadragon',
    'three',
    'fabricOverlay',
    'semantic',
], function(d3, F_, L_, openSeadragon, THREE, fabricOverlay) {
    var Viewer_ = {
        wasInitialized: false,
        viewer: $('#viewer'),
        images: [],
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
        photosphere: null,
        modelviewer: null,
        lookupPath: null,
        toolBar: null,
        toolBarSelector: null,
        lastImageId: null,
        init: function() {
            this.viewer = $('#viewer')
            this.imageViewer = d3
                .select('#viewer')
                .append('div')
                .attr('id', 'imageViewerMap')
                .style('position', 'absolute')
                .style('width', '100%')
                .style('height', '100%')
                .style('display', 'none')

            this.imageViewerMap = OpenSeadragon({
                id: 'imageViewerMap',
                prefixUrl: 'scripts/external/OpenSeadragon/images/',
                defaultZoomLevel: 0.5,
                showNavigationControl: false,
                minZoomLevel: 0.5,
                maxZoomLevel: 12,
                zoomPerClick: 1, //disables click to zoom for tools...
            })

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

            this.lookupPath =
                'Missions/' + L_.mission + '/' + 'Data/mosaic_parameters.csv'

            buildToolBar()

            this.wasInitialized = true
        },
        clearImage: function() {
            this.imagePanorama.style('display', 'none')
            this.imageViewer.style('display', 'none')
            this.imageModel.style('display', 'none')
        },
        //This sets the main image url that the shown image derives from
        //This image can be any size as it won't ever be displayed
        setMasterImage: function(m) {
            this.masterImg = m
        },
        //images is [ { 'url': '', 'name': '', 'isPanoramic': false },{...}, ... ]
        //Shows the first image too
        changeImages: function(images) {
            if (images && images.length > 0) {
                Viewer_.images = images

                var imageI = 0
                var setLocAfter = false
                if (L_.FUTURES.viewerImg !== null) {
                    imageI = L_.FUTURES.viewerImg
                    setLocAfter = true
                    L_.FUTURES.viewerImg = null
                }

                updateDropdown(images, imageI)

                Viewer_.changeImage(imageI, setLocAfter)
            }
        },
        //exts is optional. It's an array of extensions to to the url
        //ext can also be false to skip changing the dropdown
        //o is object with options url:"", isPanoramic:bool
        //and optional options exts:[],ext:int/false, masterImg:""
        changeImage: function(imageId, setLocAfter) {
            if (!this.wasInitialized) return
            var o = Viewer_.images[imageId]
            Viewer_.lastImageId = imageId
            if (o == null) return

            //Make sure dropdown matches image

            var url = o.url

            Viewer_.toolBarLoading.html('Loading')
            this.url = url
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
                this.imagePanorama.style('display', 'none')
                this.imageViewer.style('display', 'none')

                if (this.modelviewer == null) {
                    this.modelviewer = THREE.ModelViewer(
                        document.getElementById('imageModelWebGL'),
                        this.lookupPath
                    )
                }
                window.onresize = this.modelviewer.resize
                Viewer_.toolBarLoading.style('display', 'inherit')
                this.modelviewer.changeModel(
                    url,
                    Viewer_.images,
                    function(err) {
                        if (err) {
                            console.log(err)
                            Viewer_.toolBarLoading.html(err)
                        } else {
                            Viewer_.toolBarLoading.html('Loading')
                            Viewer_.modelviewer.resize()
                        }
                    },
                    function(progress) {
                        Viewer_.toolBarLoading.html('Loading ' + progress + '%')
                        if (progress == 100) {
                            Viewer_.toolBarLoading.style('display', 'none')
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

                if (this.photosphere == null) {
                    this.photosphere = THREE.Photosphere(
                        document.getElementById('imagePanoramaWebGL'),
                        this.lookupPath
                    )
                }
                window.onresize = this.photosphere.resize
                Viewer_.toolBarLoading.style('display', 'inherit')
                this.photosphere.changeImage(url, function(err) {
                    if (err) {
                        console.log(err)
                        Viewer_.toolBarLoading.html(err)
                    } else {
                        Viewer_.toolBarLoading.style('display', 'none')
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
                })
            } else {
                this.imageViewer.style('display', 'inherit')
                this.imagePanorama.style('display', 'none')
                this.imageModel.style('display', 'none')

                if (Viewer_.imageViewerOverlay != null) {
                    Viewer_.imageViewerMap.removeLayer(
                        Viewer_.imageViewerOverlay
                    )
                }
                //Save the old image to get rid of it when the new one is loaded
                //var oldImage = this.imageViewerMap.world.getItemAt( 0 );
                Viewer_.toolBarLoading.style('display', 'inherit')

                if (F_.getExtension(url).toLowerCase() === 'xml') {
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
                Viewer_.toolBarLoading.style('display', 'none')

                if (setLocAfter) {
                    setTimeout(function() {
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
        calculateBounds: function() {
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
        highlight: function(layer) {
            if (this.photosphere != null) {
                this.photosphere.highlight(layer)
            }
        },
        invalidateSize: function() {
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
            /*
      image         posX,posY,w,h
      photosphere   az,el
      model         posX,posY,posZ,tarX,tarY,tarZ
      */
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
            .style('padding', '9px')
        Viewer_.toolBarSelector = Viewer_.toolBar
            .append('select')
            .attr('id', 'viewer_dropdownselector')
            .attr('class', 'ui compact dropdown short alittlelonger')

        $('#viewer_dropdownselector').dropdown({
            onChange: function(val) {
                Viewer_.changeImage(val)
            },
        })

        $('#viewer_dropdownselector')
            .parent()
            .css({ display: 'none', 'padding-right': '24px' })

        Viewer_.toolBarName = Viewer_.toolBar
            .append('div')
            .style('height', '30px')
            .style('padding', '5px 6px 6px 6px')
            .style('background-color', 'rgba(0,0,0,0.6)')
            .style('border', '1px solid #999')
            .style('border-radius', '1px')
            .style('display', 'none')
        Viewer_.toolBarLoading = Viewer_.toolBar
            .append('div')
            .attr('id', 'viewer_loading')
            .style('display', 'none')
            .style('height', '30px')
            .style('font-family', 'venus')
            .style('letter-spacing', '2px')
            .style('color', '#bbb')
            .style('padding', '5px 6px 6px 6px')
            .html('Loading')

        Viewer_.toolBarhelp = Viewer_.toolBar
            .append('div')
            .attr('id', 'viewer_Help')
            .style('font-family', 'roboto')
            .style('letter-spacing', '2px')
            .style('font-size', '14px')
            .style('color', '#bbb')
            .style('text-align', 'right')
            .style('display', 'none')
            .html('Rotate - Left Click and Drag<br>Zoom - Mouse Wheel')

        //I know, I know; it's not in the toolbar.
        var oc = Viewer_.imagePanorama
            .append('button')
            .attr('id', 'viewerDeviceOrientationButton')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('position', 'absolute')
            .style('left', '5px')
            .style('bottom', '43px')
            .style('border', 'none')
            .style('border-radius', '4px')
            .style('background', 'transparent')
            .style('color', '#fff')
            .style('font', 'normal 13px sans-serif')
            .style('textAlign', 'left')
            .style('opacity', '0.25')
            .style('outline', 'none')
            .style('z-index', '999')
            .style('white-space', 'nowrap')
            .style('transition', 'opacity 0.2s ease-out')

        oc.append('i')
            .style('transition', 'all 0.2s ease-in')
            .attr('class', 'mdi mdi-screen-rotation mdi-24px')
            .style('cursor', 'pointer')
        oc.append('div').style('line-height', '27px')

        var ocButton = document.getElementById('viewerDeviceOrientationButton')
        ocButton.onmouseleave = function() {
            ocButton.style.opacity = '0.25'
            ocButton.style.width = '45px'
            ocButton.getElementsByTagName('div')[0].textContent = ''
        }
        ocButton.onmouseenter = function() {
            ocButton.style.opacity = '1'
            ocButton.style.width = '136px'
            ocButton.getElementsByTagName('div')[0].textContent = 'TILT CONTROL'
            setTimeout(function() {
                ocButton.onmouseleave()
            }, 3000)
        }
        ocButton.onclick = function() {
            if (Viewer_.photosphere) {
                Viewer_.photosphere.toggleControls()
            }
            setTimeout(function() {
                ocButton.onmouseleave()
            }, 3000)
        }
    }

    function updateDropdown(images, imgI) {
        var dropdownRefresh = false
        if (images && images.length > 0) {
            Viewer_.toolBarSelector.selectAll('*').remove()

            for (var i = 0; i < images.length; i++) {
                Viewer_.toolBarSelector
                    .append('option')
                    .attr('value', i)
                    .html(images[i].name)
            }

            Viewer_.toolBarName.style('display', 'none')
            $('#viewer_dropdownselector')
                .parent()
                .css({ display: 'inherit' })
            $('#viewer_dropdownselector').dropdown('refresh')
            dropdownRefresh = true
            setTimeout(function() {
                $('#viewer_dropdownselector').dropdown(
                    'set selected',
                    images[imgI || 0].name
                )
            }, 1)
        }
    }

    return Viewer_
})
