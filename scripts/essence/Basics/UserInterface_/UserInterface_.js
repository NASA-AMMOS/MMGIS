define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'ToolController_',
    'Login',
    'QueryURL',
    'HTML2Canvas',
], function ($, d3, F_, L_, ToolController_, Login, QueryURL, HTML2Canvas) {
    var Viewer_ = null
    var Map_ = null
    var Globe_ = null

    var UserInterface = {
        splitterSize: 0,
        splitterSizeHidden: 17,
        topSize: 40,
        fullSizeViews: false, //Experimental!!!
        pxIsViewer: null,
        pxIsMap: null,
        pxIsGlobe: null,
        pxIsTools: null,
        pxIsToolsInit: null,
        topBar: null,
        topBarRight: null,
        splitscreens: null,
        mainWidth: null,
        mainHeight: null,
        vmgScreen: null,
        viewerScreen: null,
        viewerToolBar: null,
        viewerSplit: null,
        hasViewer: true,
        mapScreen: null,
        mapToolBar: null,
        mapTopBar: null,
        mapSplit: null,
        mapSplitInner: null,
        hasMap: true,
        globeScreen: null,
        globeToolBar: null,
        globeSplit: null,
        globeSplitInner: null,
        hasGlobe: true,
        tScreen: null,
        toolsScreen: null,
        toolsSplit: null,
        toolbar: null,
        helpOn: true,
        init: function () {
            //Other stylings in mmgis.css
            var logoURL =
                mmgisglobal.SERVER === 'node'
                    ? '../resources/logo.png'
                    : 'resources/logo.png'

            //TopBar
            this.topBar = d3
                .select('#main-container')
                .style('height', '100%')
                .append('div')
                .attr('id', 'topBar')
                .style('display', 'flex')
                .style('justify-content', 'space-between')
                .style('position', 'absolute')
                .style('top', '0px')
                .style('width', 'auto')
                .style('height', this.topSize + 'px')
                .style('left', '0px')
                .style('padding', '5px 3px')
                .style('background', 'var(--color-a)')
                .style('font-family', 'sans-serif')
                .style('font-size', '24px')
                .style('z-index', '2005')
            //.style('box-shadow', '0 4px 16px rgba(0,0,0,.25)')

            this.topBarLeft = this.topBar.append('div').style('display', 'flex')
            this.topBarRight = this.topBar
                .append('div')
                .style('display', 'flex')

            if (this.topSize > 0) {
                this.topBarLeft
                    .append('div')
                    .attr('id', 'mmgislogo')
                    .style('padding', '0px 1px')
                    .style('color', 'var(--color-b)')
                    .style('font-size', '18px')
                    .style('cursor', 'pointer')
                    .style('height', '32px')
                    .style('margin-top', '-2px')
                    .style('image-rendering', 'pixelated')
                    .html("<img src='" + logoURL + "' width='32px' />")
                    .on('click', F_.toHostForceLanding)

                var tbt = this.topBarLeft
                    .append('div')
                    .attr('id', 'topBarTitle')
                    .style('cursor', 'pointer')
                    .style('display', 'flex')
                    .style('z-index', '1')
                tbt.append('div')
                    .attr('id', 'topBarTitleName')
                    .style('font-size', '16px')
                    .style('font-weight', 'bold')
                    .style('line-height', '14px')
                    .style('letter-spacing', '3.21429px')
                    .style('font-family', 'lato')
                    .style('padding', '8px 10px 8px 14px')
                    .html(mmgisglobal.name)
                tbt.append('div').attr('id', 'topBarTitleIcon')
            }

            this.rightPanel = d3
                .select('body')
                .append('div')
                .attr('id', 'uiRightPanel')
                .style('position', 'absolute')
                .style('top', '0px')
                .style('right', '0px')
                .style('display', 'none')
                .style('width', '0px')
                .style('height', '100vh')
                .style('background', '#001')

            Login.init()

            this.barBottom = d3
                .select('#main-container')
                .append('div')
                .attr('id', 'barBottom')
                .style('position', 'absolute')
                .style('width', '40px')
                .style('bottom', '0px')
                .style('left', '0px')
                .style('display', 'flex')
                .style('flex-flow', 'column')
                .style('z-index', '1005')

            this.barBottom
                .append('i')
                .attr('id', 'mmgisUseSwap')
                .attr('title', 'Swap')
                .attr(
                    'class',
                    'mdi mdi-checkbox-multiple-blank-outline mdi-18px'
                )
                .style('padding', '5px 10px')
                .style('width', '40px')
                .style('height', '36px')
                .style('line-height', '26px')
                .style('color', 'rgb(0, 182,210)')
                .style('opacity', '0.8')
                .style('cursor', 'pointer')

            this.barBottom
                .append('i')
                .attr('id', 'topBarLink')
                .attr('title', 'Copy Link')
                .attr('class', 'mdi mdi-open-in-new mdi-18px')
                .style('padding', '5px 10px')
                .style('width', '40px')
                .style('height', '36px')
                .style('line-height', '26px')
                //.style( 'color', '#00b5d2' )
                .style('color', 'rgb(0, 210, 0)')
                .style('cursor', 'pointer')
                .on('click', function () {
                    QueryURL.writeCoordinateURL(function () {
                        F_.copyToClipboard(L_.url)
                        $('#copyLinkCopied').css('display', 'inherit')
                        $('#copyLinkCopied').css('width', '64px')
                        $('#copyLinkCopied').animate(
                            {
                                opacity: 1,
                            },
                            150,
                            function () {
                                setTimeout(function () {
                                    $('#copyLinkCopied').animate(
                                        {
                                            opacity: 0,
                                            width: '0px',
                                        },
                                        500,
                                        function () {
                                            $('#copyLinkCopied').css(
                                                'display',
                                                'none'
                                            )
                                        }
                                    )
                                }, 1000)
                            }
                        )
                    })
                })
            this.barBottom
                .append('div')
                .attr('id', 'copyLinkCopied')
                .style('display', 'none')
                .style('position', 'absolute')
                .style('width', '0px')
                .style('left', '40px')
                .style('bottom', '107px')
                .style('height', '36px')
                .style('line-height', '36px')
                .style('padding', '0px 12px 0px 10px')
                .style('font-size', '12px')
                .style('background', '#001')
                //.style( 'border-top', '1px solid #26a8ff' )
                .style('border-right', '1px solid var(--color-b)')
                //.style( 'border-bottom', '1px solid #26a8ff' )
                .style('color', 'white')
                .style('pointer-events', 'none')
                .html('Copied!')

            this.barBottom
                .append('i')
                .attr('id', 'topBarScreenshot')
                .attr('title', 'Screenshot')
                .attr('class', 'mdi mdi-camera mdi-18px')
                .style('padding', '5px 10px')
                .style('width', '40px')
                .style('height', '36px')
                .style('line-height', '26px')
                .style('color', '#d2b800')
                .style('cursor', 'pointer')
                .style('opacity', '0.8')
                .on('click', function () {
                    //We need to manually order leaflet z-indices for this to work
                    let zIndices = []
                    $('#mapScreen #map .leaflet-tile-pane')
                        .children()
                        .each(function (i, elm) {
                            zIndices.push($(elm).css('z-index'))
                            $(elm).css('z-index', i + 1)
                        })
                    $('.leaflet-control-scalefactor').css('display', 'none')
                    $('.leaflet-control-zoom').css('display', 'none')
                    $('#topBarScreenshotLoading').css('display', 'block')
                    HTML2Canvas(document.getElementById('mapScreen')).then(
                        function (canvas) {
                            canvas.id = 'mmgisScreenshot'
                            document.body.appendChild(canvas)
                            F_.downloadCanvas(
                                canvas.id,
                                'camp-screenshot',
                                function () {
                                    canvas.remove()
                                    setTimeout(function () {
                                        $('#topBarScreenshotLoading').css(
                                            'display',
                                            'none'
                                        )
                                    }, 2000)
                                }
                            )
                        }
                    )
                    $('#mapScreen #map .leaflet-tile-pane')
                        .children()
                        .each(function (i, elm) {
                            $(elm).css('z-index', zIndices[i])
                        })
                    $('.leaflet-control-scalefactor').css('display', 'flex')
                    $('.leaflet-control-zoom').css('display', 'block')
                })
            //Screenshot loading
            this.barBottom
                .append('i')
                .attr('id', 'topBarScreenshotLoading')
                .attr('title', 'Taking Screenshot')
                .style('display', 'none')
                .style('border-radius', '50%')
                .style('border', '4px solid #ffe100')
                .style('border-right-color', 'transparent')
                .style('border-left-color', 'transparent')
                .style('position', 'absolute')
                .style('top', '80px')
                .style('left', '9px')
                .style('width', '20px')
                .style('height', '20px')
                .style('line-height', '26px')
                .style('color', '#d2b800')
                .style('cursor', 'pointer')
                .style('animation-name', 'rotate-forever')
                .style('animation-duration', '2s')
                .style('animation-iteration-count', 'infinite')
                .style('animation-timing', 'linear')

            this.barBottom
                .append('i')
                .attr('id', 'topBarFullscreen')
                .attr('title', 'Fullscreen')
                .attr('class', 'mdi mdi-fullscreen mdi-18px')
                .style('padding', '5px 10px')
                .style('width', '40px')
                .style('height', '36px')
                .style('line-height', '26px')
                //.style( 'color', 'rgb(0, 210, 0)' )
                .style('color', '#d2b800')
                .style('cursor', 'pointer')
                .on('click', function () {
                    fullscreen()
                    if (
                        d3.select(this).attr('class') ==
                        'mdi mdi-fullscreen mdi-18px'
                    )
                        d3.select(this)
                            .attr('class', 'mdi mdi-fullscreen-exit mdi-18px')
                            .attr('title', 'Exit Fullscreen')
                    else
                        d3.select(this)
                            .attr('class', 'mdi mdi-fullscreen mdi-18px')
                            .attr('title', 'Fullscreen')
                })

            this.barBottom
                .append('i')
                .attr('id', 'toggleUI')
                .attr('title', 'Hide UI')
                .attr('class', 'mdi mdi-power mdi-18px')
                .style('padding', '5px 10px')
                .style('width', '40px')
                .style('height', '36px')
                .style('line-height', '26px')
                .style('color', '#d2b800')
                .style('display', 'none') //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!======
                .on('click', function () {
                    if (d3.select(this).style('color') == 'rgb(0, 210, 0)') {
                        d3.select('#topBarRight #loginButton').style(
                            'display',
                            'none'
                        )
                        d3.select('#topBarRight #loginUsername').style(
                            'display',
                            'none'
                        )
                        d3.select('#toolbar').style('display', 'none')
                        d3.select('.mouseLngLat').style('display', 'none')
                        //d3.select( '.mainDescription' ).style( 'display', 'none' );
                        d3.select('#viewerToolBar').style('display', 'none')
                        d3.select('#mapToolBar').style('display', 'none')
                        d3.select('#globeToolBar').style('display', 'none')
                        d3.select(this)
                            .style('color', 'white')
                            .attr('title', 'Show UI')
                    } else {
                        d3.select('#topBarRight #loginButton').style(
                            'display',
                            'inherit'
                        )
                        d3.select('#topBarRight #loginUsername').style(
                            'display',
                            'inherit'
                        )
                        d3.select('#toolbar').style('display', 'inherit')
                        d3.select('.mouseLngLat').style('display', 'inherit')
                        //d3.select( '.mainDescription' ).style( 'display', 'inherit' );
                        d3.select('#viewerToolBar').style('display', 'inherit')
                        d3.select('#mapToolBar').style('display', 'inherit')
                        d3.select('#globeToolBar').style('display', 'inherit')
                        d3.select(this)
                            .style('color', 'rgb(0, 210, 0)')
                            .attr('title', 'Hide UI')
                    }
                })

            this.barBottom
                .append('i')
                .attr('id', 'topBarHelp')
                .attr('title', 'Help')
                .attr('class', 'mdi mdi-help mdi-18px')
                .style('padding', '5px 10px')
                .style('width', '40px')
                .style('height', '36px')
                .style('line-height', '26px')
                .style('color', '#d26100')
                .style('cursor', 'pointer')
                .on('click', function () {
                    this.helpOn = !this.helpOn
                    if (this.helpOn) {
                        //d3.select('#viewer_Help').style('display', 'inherit')
                    } else {
                        d3.select('#viewer_Help').style('display', 'none')
                    }
                })

            this.toolPanel = d3
                .select('#main-container')
                .append('div')
                .attr('id', 'toolPanel')
                .style('position', 'absolute')
                .style('width', '0px')
                .style('top', this.topSize + 'px')
                .style('height', 'calc( 100% - ' + this.topSize + 'px )')
                .style('left', this.topSize + 'px')
                .style('background', 'var(--color-a)')
                //.style( 'border-left', '1px solid #26a8ff' )
                //.style('box-shadow', '5px 0px 3px rgba(0,0,0,0.2)')
                .style('transition', 'width 0.2s ease-out')
                .style('overflow', 'hidden')
                .style('z-index', '1400')
            //Main container div
            this.splitscreens = d3
                .select('#main-container')
                .append('div')
                .attr('id', 'splitscreens')
                .style('position', 'absolute')
                .style('top', (this.fullSizeViews ? '0' : this.topSize) + 'px')
                .style('width', 'calc( 100% - ' + 40 + 'px )')
                .style(
                    'height',
                    'calc( 100% - ' +
                        (this.fullSizeViews ? '0' : this.topSize) +
                        'px )'
                )
                .style('left', 40 + 'px')

            this.hide()
            this.mainWidth = $('#splitscreens').width()
            this.mainHeight = $('#splitscreens').height()

            this.pxIsViewer = 0
            this.pxIsMap = 0
            this.pxIsGlobe = 0
            this.pxIsTools = 0
            this.pxIsToolsInit = this.splitterSize / 4

            this.pxIsMap = this.mainWidth - this.pxIsViewer - this.pxIsGlobe
            //the 'top' three panels
            this.vmgScreen = this.splitscreens
                .append('div')
                .attr('id', 'vmgScreen')

            //The viewer screen
            this.viewerScreen = this.vmgScreen
                .append('div')
                .attr('id', 'viewerScreen')
                .style('position', 'absolute')
                .style('width', this.pxIsViewer + 'px')
                .style('height', this.mainHeight + 'px')
                .style('top', '0px')
                //.style('box-shadow', '0px 0px 10px rgba(6,6,6,0.6)')
                .style('overflow', 'hidden')
                .style('left', 0 + 'px')

            this.viewerScreen
                .append('div')
                .attr('id', 'viewer')
                .style('position', 'absolute')
                .style('background-color', '#000000')
                .style('width', '100%')
                .style('height', '100%')
            this.viewerToolBar = this.viewerScreen
                .append('div')
                .attr('id', 'viewerToolBar')
                .style('position', 'absolute')
                .style('top', '0px')
                .style('width', '100%')
                .style('height', '48px')
                .style('pointer-events', 'none')
                .style('z-index', '5')

            //The viewer slider
            this.viewerSplit = this.vmgScreen
                .append('div')
                .attr('class', 'splitterV')
                .attr('id', 'viewerSplit')
                .style('width', this.splitterSize + 'px')
                .style('height', this.mainHeight + 'px')
                .style('left', -this.splitterSize + 'px')
                //.style( 'box-shadow', 'inset 6px 0px 9px -6px #000')
                .style('cursor', 'default')
            /*
      this.viewerSplit.append( 'div' )
            .attr( 'id', 'viewerSplitText' )
            .attr( 'class', 'splitterText' )
            .style( 'font-size', this.splitterSize - 6 + 'px' )
            .style( 'line-height', this.splitterSize + 'px' )
            .html( 'Viewer' );
      */

            //The map screen
            this.mapScreen = this.vmgScreen
                .append('div')
                .attr('id', 'mapScreen')
                .style('position', 'absolute')
                .style('width', this.pxIsMap - this.splitterSize * 2 + 'px')
                .style('height', this.mainHeight + 'px')
                .style('top', '0px')
                //.style('box-shadow', '0px 0px 10px rgba(6,6,6,0.6)')
                .style('left', this.pxIsViewer + this.splitterSize + 'px')
            this.mapScreen
                .append('div')
                .attr('id', 'map')
                .style('position', 'absolute')
                .style('background-color', '#001')
                .style('width', '100%')
                .style('height', '100%')
            //.style( 'height', 'calc( 100% - ' + this.splitterSize + 'px )' );
            this.mapToolBar = this.mapScreen
                .append('div')
                .attr('id', 'mapToolBar')
                .style('position', 'absolute')
                .style('bottom', '0px')
                .style('width', '100%')
                .style('height', '36px')
                .style('pointer-events', 'none')
                .style('overflow', 'hidden')
                .style('z-index', '1003')

            this.mapTopBar = this.mapScreen
                .append('div')
                .attr('id', 'mapTopBar')
                .style('z-index', '400')
                .style('display', 'flex')
                .style('justify-content', 'space-between')
                .style('position', this.fullSizeViews ? 'absolute' : 'fixed')
                .style('top', '0px')
                .style('pointer-events', 'none')
                .style('width', this.fullSizeViews ? '100%' : '100vw')
                .style(
                    'padding',
                    '5px 76px 5px ' +
                        document
                            .getElementById('topBar')
                            .getBoundingClientRect().width +
                        'px'
                )
                .style('height', this.topSize + 'px')
                .style('left', '0px')
                .style('background', 'transparent')
                .style('font-family', 'sans-serif')
                .style('font-size', '24px')
                .style('mix-blend-mode', 'luminosity')

            if (this.topSize > 0) {
                let mapTopBarLeft = this.mapTopBar
                    .append('div')
                    .style('display', 'flex')
                let mapTopBarRight = this.mapTopBar
                    .append('div')
                    .style('display', 'flex')
                mapTopBarLeft
                    .append('div')
                    .attr('class', 'mainInfo')
                    .style('display', 'none')
                    .style('position', 'relative')
                    .style('height', '30px')
                    .style('margin', '0')
                    .style('margin-left', '8px')
                    .style('z-index', '20')
                    .style('opacity', 0)
                    .style('pointer-events', 'auto')
                    .style('transition', 'opacity 0.2s ease-out')

                mapTopBarLeft
                    .append('div')
                    .attr('class', 'mainDescription')
                    .style('display', 'none')
                    .style('position', 'relative')
                    .style('height', '30px')
                    .style('margin', '0')
                    .style('margin-left', '8px')
                    .style('z-index', '20')
                    .style('padding-left', '8px')
                    .style('border', '1px solid var(--color-m1)')
                    .style('background', 'var(--color-a)')
                    .style('opacity', 0)
                    .style('pointer-events', 'auto')
                    .style('transition', 'opacity 0.2s ease-out')

                mapTopBarRight.append('div').attr('class', 'Search')
            }
            //The map slider
            this.mapSplit = this.vmgScreen
                .append('div')
                .attr('class', 'splitterV')
                .attr('id', 'mapSplit')
                .style('width', this.splitterSizeHidden + 'px')
                .style('height', this.mainHeight + 'px')
                .style(
                    'left',
                    this.pxIsViewer - this.splitterSizeHidden / 2 + 'px'
                )

            this.mapSplitInner = this.mapSplit
                .append('div')
                .attr('class', 'splitterVInner')
                .attr('id', 'mapSplitInner')
                .style('width', this.splitterSizeHidden * 2 + 'px')

            this.mapSplitInner
                .append('div')
                .style('background', 'var(--color-a)')
                .style('width', '30px')
                .style('height', '30px')
                .style('position', 'absolute')
                .style('left', '-21px')
                .style('z-index', '-1')
                .style('border-radius', '3px')
            this.mapSplitInner
                .append('i')
                .style('transition', 'all 0.2s ease-in')
                .attr('id', 'mapSplitInnerLeft')
                .attr('class', 'mdi mdi-chevron-double-left mdi-24px')
                .style('margin-right', '14px')
                .on('click touchstart', function () {
                    var pp = UserInterface.getPanelPercents()
                    if (pp.map == 0) {
                        UserInterface.setPanelPercents(0, 0, 100)
                    } else {
                        UserInterface.setPanelPercents(
                            0,
                            pp.map + pp.viewer,
                            pp.globe
                        )
                    }
                })

            this.mapSplitInner
                .append('div')
                .style('background', 'var(--color-a)')
                .style('width', '30px')
                .style('height', '30px')
                .style('position', 'absolute')
                .style('left', '24px')
                .style('border-radius', '3px')
                .style('z-index', '-1')
            this.mapSplitInner
                .append('i')
                .style('transition', 'all 0.2s ease-in')
                .attr('id', 'mapSplitInnerRight')
                .attr('class', 'mdi mdi-chevron-double-right mdi-24px')
                .style('margin-left', '8px')
                .on('click touchstart', function () {
                    var pp = UserInterface.getPanelPercents()
                    if (pp.map == 0) {
                        UserInterface.setPanelPercents(
                            pp.viewer + pp.globe / 2,
                            0,
                            pp.globe - pp.globe / 2
                        )
                    } else {
                        UserInterface.setPanelPercents(
                            pp.viewer + pp.map / 2,
                            pp.map - pp.map / 2,
                            pp.globe
                        )
                    }
                })

            this.mapSplitInner
                .append('div')
                .attr('id', 'mapSplitInnerViewerInfo')
                .html('Viewer')

            //thumb lines
            /*
      this.mapSplit.append( 'div' )
            .style( 'position', 'absolute' )
            .style( 'top', '50%' )
            .style( 'left', this.splitterSize/2.8 + 'px' )
            .style( 'height', '20px' )
            .style( 'border-left', '1px solid #444' );
      this.mapSplit.append( 'div' )
            .style( 'position', 'absolute' )
            .style( 'top', 'calc(50% - 5px)' )
            .style( 'left', this.splitterSize/2 + 'px' )
            .style( 'height', '30px' )
            .style( 'border-left', '1px solid #444' );
      this.mapSplit.append( 'div' )
            .style( 'position', 'absolute' )
            .style( 'top', '50%' )
            .style( 'left', this.splitterSize - this.splitterSize/2.8 + 'px' )
            .style( 'height', '20px' )
            .style( 'border-left', '1px solid #444' );
      */
            /*
      this.mapSplit.append( 'div' )
            .attr( 'id', 'mapSplitText' )
            .attr( 'class', 'splitterText' )
            .style( 'font-size', this.splitterSize - 6 + 'px' )
            .style( 'line-height', this.splitterSize + 'px' )
            .html( 'Map' );
      */

            //The globe screen
            this.globeScreen = this.vmgScreen
                .append('div')
                .attr('id', 'globeScreen')
                .style('position', 'absolute')
                .style('width', this.pxIsGlobe + 'px')
                .style('height', this.mainHeight + 'px')
                .style('top', '0px')
                //.style('box-shadow', '0px 0px 10px rgba(6,6,6,0.6)')
                .style('overflow', 'hidden')
                .style('left', this.pxIsViewer + this.pxIsMap + 'px')
                .style('z-index', '401')
            this.globeScreen
                .append('div')
                .attr('id', 'globe')
                .style('position', 'absolute')
                .style('background-color', '#000')
                .style('width', '100%')
                .style('height', '100%')
            this.globeToolBar = this.globeScreen
                .append('div')
                .attr('id', 'globeToolBar')
                .style('position', 'absolute')
                .style('top', '0px')
                .style('width', '100%')
                .style('padding-right', this.fullSizeViews ? '70px' : '0px')
                .style('height', '40px')
                .style('pointer-events', 'none')
                .style('z-index', '5')

            //The globe slider
            this.globeSplit = this.vmgScreen
                .append('div')
                .attr('class', 'splitterV')
                .attr('id', 'globeSplit')
                .style('width', this.splitterSizeHidden + 'px')
                .style('height', this.mainHeight + 'px')
                .style(
                    'left',
                    this.pxIsViewer +
                        this.pxIsMap -
                        this.splitterSizeHidden / 2 +
                        'px'
                )
            this.globeSplitInner = this.globeSplit
                .append('div')
                .attr('class', 'splitterVInner')
                .attr('id', 'globeSplitInner')
                .style('width', this.splitterSizeHidden * 2 + 'px')
            this.globeSplitInner
                .append('div')
                .style('background', 'var(--color-a)')
                .style('width', '30px')
                .style('height', '30px')
                .style('position', 'absolute')
                .style('left', '-21px')
                .style('border-radius', '3px')
                .style('z-index', '-1')
            this.globeSplitInner
                .append('i')
                .style('transition', 'all 0.2s ease-in')
                .attr('id', 'globeSplitInnerLeft')
                .attr('class', 'mdi mdi-chevron-double-left mdi-24px')
                .style('margin-right', '18px')
                .on('click touchstart', function () {
                    var pp = UserInterface.getPanelPercents()
                    if (pp.map == 0) {
                        UserInterface.setPanelPercents(
                            pp.viewer - pp.viewer / 2,
                            0,
                            pp.globe + pp.viewer / 2
                        )
                    } else {
                        UserInterface.setPanelPercents(
                            pp.viewer,
                            pp.map - pp.map / 2,
                            pp.globe + pp.map / 2
                        )
                    }
                })

            this.globeSplitInner
                .append('div')
                .style('background', 'var(--color-a)')
                .style('width', '30px')
                .style('height', '30px')
                .style('position', 'absolute')
                .style('left', '24px')
                .style('border-radius', '3px')
                .style('z-index', '-1')
            this.globeSplitInner
                .append('i')
                .style('transition', 'all 0.2s ease-in')
                .attr('id', 'globeSplitInnerRight')
                .attr('class', 'mdi mdi-chevron-double-right mdi-24px')
                .style('margin-left', '4px')
                .on('click touchstart', function () {
                    var pp = UserInterface.getPanelPercents()
                    if (pp.map == 0) {
                        UserInterface.setPanelPercents(100, 0, 0)
                    } else {
                        UserInterface.setPanelPercents(
                            pp.viewer,
                            pp.map + pp.globe,
                            0
                        )
                    }
                })

            this.globeSplitInner
                .append('div')
                .attr('id', 'mapSplitInnerGlobeInfo')
                .html('Globe')

            //thumb lines
            /*
            this.globeSplit.append( 'div' )
                    .style( 'position', 'absolute' )
                    .style( 'top', '50%' )
                    .style( 'left', this.splitterSize/2.8 + 'px' )
                    .style( 'height', '20px' )
                    .style( 'border-left', '1px solid #444' );
            this.globeSplit.append( 'div' )
                    .style( 'position', 'absolute' )
                    .style( 'top', 'calc(50% - 5px)' )
                    .style( 'left', this.splitterSize/2 + 'px' )
                    .style( 'height', '30px' )
                    .style( 'border-left', '1px solid #444' );
            this.globeSplit.append( 'div' )
                    .style( 'position', 'absolute' )
                    .style( 'top', '50%' )
                    .style( 'left', this.splitterSize - this.splitterSize/2.8 + 'px' )
                    .style( 'height', '20px' )
                    .style( 'border-left', '1px solid #444' );
            */
            /*
                this.globeSplit.append( 'div' )
                        .attr( 'id', 'globeSplitText' )
                        .attr( 'class', 'splitterText' )
                        .style( 'font-size', this.splitterSize - 6 + 'px' )
                        .style( 'line-height', this.splitterSize + 'px' )
                        .html( 'Globe' );
                */

            //The 'bottom' tools panel
            this.tScreen = this.splitscreens.append('div').attr('id', 'tScreen')

            var bodyRGB = $('body').css('background-color')
            bodyRGB = 'rgb(15,17,17)'
            var bodyHEX = F_.rgb2hex(bodyRGB)
            bodyRGB = F_.rgbToArray(bodyRGB)
            var c = 'rgba(' + bodyRGB[0] + ',' + bodyRGB[1] + ',' + bodyRGB[2]
            var c = 'rgba(0,0,0'
            //The tools screen
            this.toolsScreen = this.tScreen
                .append('div')
                .attr('id', 'toolsWrapper')
                .style('height', this.pxIsTools + 'px')
                .style('width', '0%')
                .style('margin', '0')
                .style('background', c + ', 1)')
                //.style( 'background', 'linear-gradient( 45deg, rgba(0,0,0,0.8), rgba(0,0,0,0.53)' )
                //.style('background', 'var(--color-a)')
                .style('background', 'var(--color-a)')
                .style('border-right', '1px solid #3f3f3f')
                //.style('box-shadow', '2px 5px 4px 0px rgba(0, 0, 0, 0.3)')
                .style('left', '-' + this.splitterSize + 'px')
                .style('bottom', this.topSize + 'px')
                .style('left', 0 + 'px')
                .style('bottom', '0px')
                //.style( 'border', '1px solid #26a8ff' )
                .style('z-index', '1003')

            this.toolsScreen
                .append('div')
                .attr('id', 'tools')
                .style('position', 'absolute')
                .style('top', '0px')
                .style('height', '100%')
                .style('padding-bottom', '0px')
                .style('width', '100%')
            //The tools slider
            this.toolsSplit = this.toolsScreen
                .append('div')
                .attr('class', 'splitterH')
                .attr('id', 'toolsSplit')
                .style('height', this.splitterSize / 2 + 'px')
                .style('left', 0 + 'px')
                .style('bottom', this.pxIsTools - this.splitterSize / 2 + 'px')
                .style('z-index', '3')
            //The toolbar
            this.toolbar = d3
                .select('#main-container')
                .append('div')
                .attr('id', 'toolbar')
                //.style( 'box-shadow', 'inset 0px 0px 9px #0F1111' )
                //.style( 'background-color', bodyHEX )
                //.style( 'box-shadow', 'inset 0px 2px 7px black' )
                //.style( 'box-shadow', '7px 0px 7px rgba(0,0,0,0.2)' )
                .style('width', this.topSize + 'px')
                .style('padding-top', this.topSize + 'px')
                .style('background', 'var(--color-a)')
                .style('top', '0px')
                .style('height', '100%')
                .style('z-index', '1004')

            this.toolbarLogo = this.toolbar
                .append('div')
                .attr('id', 'mmgislogo')
                .style('display', this.topSize == 0 ? 'inherit' : 'none')
                .style('font-family', 'venus')
                .style('padding', '8px 3px')
                .style('color', 'var(--color-b)')
                .style('font-size', '18px')
                .style('cursor', 'pointer')
                .style('height', '40px')
                .style('margin-top', '-8px')
                .style('image-rendering', 'pixelated')
                .html("<img src='" + logoURL + "' width='32px' />")
                .on('click', F_.toHostForceLanding)

            //ViewerSplit is immovable
            //$( '#viewerSplit' ).mousedown( viewerSplitOnMouseDown );
            $('#mapSplit').mousedown(mapSplitOnMouseDown)
            $('#globeSplit').mousedown(globeSplitOnMouseDown)
            $('#toolsSplit').mousedown(toolsSplitOnMouseDown)

            $('#mapSplit').on('touchstart', mapSplitOnMouseDown)
            $('#globeSplit').on('touchstart', globeSplitOnMouseDown)
            $('#toolsSplit').on('touchstart', toolsSplitOnMouseDown)

            window.addEventListener('resize', windowresize, false)

            shouldRotateSplitterText()
        },
        hide: function () {
            d3.select('#main-container').style('opacity', '0')
        },
        show: function () {
            $('#main-container').animate(
                {
                    opacity: 1,
                },
                1000
            )
        },
        openRightPanel: function (width) {
            if (UserInterface.rightPanelOpen != null) return
            var oldWidth = parseInt(
                UserInterface.splitscreens.style('width').replace('px', '')
            )
            $('#loginDiv').css('right', width + 'px')
            $('.mouseLngLat').css('right', width + 'px')
            var newWidth = oldWidth - width
            UserInterface.splitscreens.style('width', newWidth + 'px')
            UserInterface.mainWidth = $('#splitscreens').width()
            var pp = UserInterface.getPanelPercents()
            UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
            $('#uiRightPanel').css({ display: 'inherit', width: width })

            UserInterface.rightPanelOpen = oldWidth
        },
        closeRightPanel: function () {
            if (UserInterface.rightPanelOpen == null) return
            $('#loginDiv').css('right', '0px')
            $('.mouseLngLat').css('right', '0px')
            UserInterface.splitscreens.style(
                'width',
                UserInterface.rightPanelOpen + 'px'
            )
            UserInterface.mainWidth = $('#splitscreens').width()
            var pp = UserInterface.getPanelPercents()
            UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
            $('#uiRightPanel').css({ display: 'none', width: 0 })

            UserInterface.rightPanelOpen = null
        },
        openToolPanel: function (width) {
            UserInterface.toolPanel.selectAll('*').remove()
            UserInterface.toolPanel.style('width', width + 'px')
            //UserInterface.toolPanel.style( 'border-left', '0px solid rgb(38, 168, 255)' );
            /*
            UserInterface.toolbar.style(
                'box-shadow',
                'rgba(0, 0, 0, 0.2) 7px 0px 7px'
            )
            */
            UserInterface.splitscreens.style(
                'width',
                'calc(100% - ' + (width + 40) + 'px)'
            )
            UserInterface.splitscreens.style('left', width + 40 + 'px')
            UserInterface.mainWidth = $('#splitscreens').width()
            UserInterface.mainHeight = $('#splitscreens').height()
            var pp = UserInterface.getPanelPercents()
            UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
        },
        closeToolPanel: function () {
            UserInterface.toolPanel.selectAll('*').remove()
            UserInterface.toolPanel.style('width', '0')
            //UserInterface.toolPanel.style( 'border-left', '1px solid rgb(38, 168, 255)' );
            UserInterface.toolbar.style('box-shadow', 'none')
            UserInterface.splitscreens.style(
                'width',
                'calc(100% - ' + 40 + 'px)'
            )
            UserInterface.splitscreens.style('left', 40 + 'px')
            UserInterface.mainWidth = $('#splitscreens').width()
            UserInterface.mainHeight = $('#splitscreens').height()
            var pp = UserInterface.getPanelPercents()
            UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
        },
        // can also be 'full'
        setToolHeight: function (pxHeight, shouldntAnimate) {
            if (pxHeight == 'full') {
                UserInterface.pxIsTools =
                    this.mainHeight - this.splitterSize - this.topSize
            } else if (pxHeight == 'threefourths') {
                UserInterface.pxIsTools = parseInt(
                    0.75 * (this.mainHeight - this.splitterSize - this.topSize)
                )
            } else if (pxHeight == 'half') {
                UserInterface.pxIsTools = parseInt(
                    0.5 * (this.mainHeight - this.splitterSize - this.topSize)
                )
            } else {
                UserInterface.pxIsTools = pxHeight
            }

            if (UserInterface.pxIsTools < UserInterface.splitterSize / 4) {
                UserInterface.pxIsTools = UserInterface.splitterSize / 4
            }
            if (
                UserInterface.pxIsTools >
                UserInterface.mainHeight - UserInterface.splitterSize
            ) {
                UserInterface.pxIsTools =
                    UserInterface.mainHeight - UserInterface.splitterSize
            }

            var opacity = 1
            if (pxHeight == 0) {
                opacity = 0
                UserInterface.pxIsTools = 0
                //$( '#toolsWrapper' ).css( 'box-shadow', 'none' );
                //$( '#toolsWrapper' ).css( 'border-left', 'none' );
            } else {
                //$( '#toolsWrapper' ).css( 'box-shadow', '0px 0px 3px 0px black' );
                //$( '#toolsWrapper' ).css( 'border-left', '1px solid #26a8ff' );
            }
            var duration = 400
            if (shouldntAnimate) duration = 0

            //The tools screen
            $('#toolsWrapper').animate(
                {
                    height: UserInterface.pxIsTools + 'px',
                    opacity: opacity,
                },
                {
                    duration: duration,
                }
            )
            $('#mapToolBar').animate(
                {
                    bottom: UserInterface.pxIsTools + 'px',
                },
                {
                    duration: duration,
                }
            )
            $('.leaflet-control-scalefactor').animate(
                {
                    bottom: UserInterface.pxIsTools + 25 + 'px',
                },
                {
                    duration: duration,
                }
            )
            $('.mouseLngLat').animate(
                {
                    bottom: UserInterface.pxIsTools + 'px',
                },
                {
                    duration: duration,
                }
            )

            //The tools slider
            $('#toolsSplit').animate(
                {
                    bottom:
                        UserInterface.pxIsTools -
                        UserInterface.splitterSize / 2 +
                        'px',
                },
                {
                    duration: duration,
                }
            )

            //The viewer slider
            $('#viewerSplit').animate(
                {
                    height:
                        UserInterface.mainHeight -
                        UserInterface.pxIsTools -
                        UserInterface.topSize +
                        'px',
                },
                { duration: duration }
            )

            //The map slider
            $('#mapSplit').animate(
                {
                    height:
                        UserInterface.mainHeight -
                        UserInterface.pxIsTools -
                        UserInterface.topSize +
                        'px',
                },
                { duration: duration }
            )

            //The globe slider
            $('#globeSplit').animate(
                {
                    height:
                        UserInterface.mainHeight -
                        UserInterface.pxIsTools -
                        UserInterface.topSize +
                        'px',
                },
                { duration: duration }
            )
        },
        setToolWidth(newWidth, alignment) {
            if (newWidth == 'full') {
                newWidth = Math.max(
                    0,
                    parseInt($('#toolsWrapper').parent().width())
                )
            }
            newWidth += 'px'

            $('#toolsWrapper').css({
                width: newWidth,
            })
        },
        getPanelPercents: function () {
            var vp = (UserInterface.pxIsViewer / UserInterface.mainWidth) * 100
            var gp = (UserInterface.pxIsGlobe / UserInterface.mainWidth) * 100
            var mp = 100 - vp - gp
            return {
                viewer: vp,
                map: mp,
                globe: gp,
            }
        },
        setPanelPercents: function (viewerPercent, mapPercent, globePercent) {
            //normalize input
            viewerPercent = parseFloat(viewerPercent)
            mapPercent = parseFloat(mapPercent)
            globePercent = parseFloat(globePercent)

            if (!UserInterface.hasViewer && viewerPercent != 0) return
            if (!UserInterface.hasGlobe && globePercent != 0) return
            if (viewerPercent + mapPercent + globePercent != 100) return

            UserInterface.pxIsViewer =
                UserInterface.mainWidth * (viewerPercent / 100) -
                UserInterface.splitterSize / 2
            UserInterface.pxIsGlobe =
                UserInterface.mainWidth * (globePercent / 100)
            UserInterface.pxIsMap =
                UserInterface.mainWidth -
                UserInterface.pxIsViewer -
                UserInterface.pxIsGlobe

            //The viewer screen
            UserInterface.viewerScreen.style(
                'width',
                UserInterface.pxIsViewer + 'px'
            )
            //The map screen
            UserInterface.mapScreen
                .style(
                    'width',
                    UserInterface.pxIsMap -
                        UserInterface.splitterSize * 2 +
                        'px'
                )
                .style(
                    'left',
                    UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
                )
            //The map slider
            UserInterface.mapSplit.style(
                'left',
                UserInterface.pxIsViewer -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

            //The globe screen
            UserInterface.globeScreen
                .style('width', UserInterface.pxIsGlobe + 'px')
                .style(
                    'left',
                    UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
                )
            //The globe slider
            UserInterface.globeSplit.style(
                'left',
                UserInterface.pxIsViewer +
                    UserInterface.pxIsMap -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

            resize()
        },
        minimalist(is) {
            if (is) {
                this.topBar.style('display', 'none')
                this.toolbarLogo.style('display', 'inherit')
                this.toolbar.style('top', '0px')
                this.toolbar.style('height', '100%')
                this.toolPanel.style('top', '0px')
                this.toolPanel.style('height', '100%')
                this.splitscreens.style('top', '0px')
                this.splitscreens.style('height', '100%')
            }
        },
        fullHide(is) {
            if (is) {
                UserInterface.topBar.style('display', 'none')
                UserInterface.mapSplit.style('display', 'none')
                UserInterface.globeSplit.style('display', 'none')
                UserInterface.toolbar.style('display', 'none')
                UserInterface.toolsScreen.style('display', 'none')
                d3.select('.mouseLngLat').style('display', 'none')
            } else {
                UserInterface.topBar.style('display', 'flex')
                UserInterface.mapSplit.style('display', 'flex')
                UserInterface.globeSplit.style('display', 'flex')
                UserInterface.toolbar.style('display', 'inherit')
                UserInterface.toolsScreen.style('display', 'inherit')
                d3.select('.mouseLngLat').style('display', 'flex')
            }
        },
        //finalize so we can get the resize function
        fina: function (l_, viewer_, map_, globe_) {
            ToolController_.init(l_.tools)
            ToolController_.fina(this)
            Viewer_ = viewer_
            Map_ = map_
            Globe_ = globe_
            this.hasViewer = l_.hasViewer
            this.hasGlobe = l_.hasGlobe

            $('#topBarTitleName').on('click', L_.home)

            if (l_.FUTURES.panelPercents != null)
                UserInterface.setPanelPercents(
                    l_.FUTURES.panelPercents[0],
                    l_.FUTURES.panelPercents[1],
                    l_.FUTURES.panelPercents[2]
                )

            if (l_.configData.look && l_.configData.look.minimalist == true) {
                UserInterface.minimalist(true)
            }

            clearUnwantedPanels(this.hasViewer, true, this.hasGlobe)
            if (l_.configData.look && l_.configData.look.pagename) {
                $('#topBarTitleName').html(l_.configData.look.pagename)
            }

            //Disable toolbar presets when needed
            if (l_.configData.look && l_.configData.look.swap != null)
                $('#mmgisUseSwap').css({
                    display: l_.configData.look.swap ? 'inherit' : 'none',
                })
            if (l_.missionsList.length < 2) {
                $('#mmgisUseSwap').css({ display: 'none' })
            }

            if (l_.configData.look && l_.configData.look.copylink != null)
                $('#topBarLink').css({
                    display: l_.configData.look.copylink ? 'inherit' : 'none',
                })

            if (l_.configData.look && l_.configData.look.screenshot != null)
                $('#topBarScreenshot').css({
                    display: l_.configData.look.screenshot ? 'inherit' : 'none',
                })

            if (l_.configData.look && l_.configData.look.fullscreen != null)
                $('#topBarFullscreen').css({
                    display: l_.configData.look.fullscreen ? 'inherit' : 'none',
                })

            if (l_.configData.look && l_.configData.look.help != null)
                $('#topBarHelp').css({
                    display: l_.configData.look.help ? 'inherit' : 'none',
                })

            d3.select('#mapTopBar').style(
                'padding',
                '5px ' +
                    (mmgisglobal.AUTH !== 'off' ? 76 : 5) +
                    'px 5px ' +
                    $('#topBar').width() +
                    'px'
            )

            UserInterface.show()
        },
    }

    var threshold = 1
    var dragThreshold = 0
    var mouseIsDown = false

    function mapSplitOnMouseDown(e) {
        $('#main-container').mouseup(mainContainerOnMouseUp)
        $('#main-container').mouseleave(mainContainerOnMouseOut)
        $('#main-container').mousemove(mapSplitOnMouseMove)

        $('#main-container').on('touchend', mainContainerOnMouseUp)
        $('#main-container').on('touchleave', mainContainerOnMouseOut)
        $('#main-container').on('touchmove', mapSplitOnMouseMove)

        dragThreshold = 0
        mouseIsDown = true
        return false
    }
    function globeSplitOnMouseDown(e) {
        $('#main-container').mouseup(mainContainerOnMouseUp)
        $('#main-container').mouseleave(mainContainerOnMouseOut)
        $('#main-container').mousemove(globeSplitOnMouseMove)

        $('#main-container').on('touchend', mainContainerOnMouseUp)
        $('#main-container').on('touchleave', mainContainerOnMouseOut)
        $('#main-container').on('touchmove', globeSplitOnMouseMove)

        dragThreshold = 0
        mouseIsDown = true
        return false
    }
    function toolsSplitOnMouseDown(e) {
        $('#main-container').mouseup(mainContainerOnMouseUp)
        $('#main-container').mouseleave(mainContainerOnMouseOut)
        $('#main-container').mousemove(toolsSplitOnMouseMove)

        $('#main-container').on('touchend', mainContainerOnMouseUp)
        $('#main-container').on('touchleave', mainContainerOnMouseOut)
        $('#main-container').on('touchmove', toolsSplitOnMouseMove)

        dragThreshold = 0
        mouseIsDown = true
        return false
    }
    function mainContainerOnMouseUp(e) {
        dragThreshold = 0
        mouseIsDown = false
        //Clear stuff up
        $('#main-container').off('mouseup', mainContainerOnMouseUp)
        $('#main-container').off('mouseleave', mainContainerOnMouseOut)
        $('#main-container').off('mousemove', mapSplitOnMouseMove)
        $('#main-container').off('mousemove', globeSplitOnMouseMove)
        $('#main-container').off('mousemove', toolsSplitOnMouseMove)

        $('#main-container').off('touchend', mainContainerOnMouseUp)
        $('#main-container').off('touchleave', mainContainerOnMouseOut)
        $('#main-container').off('touchmove', mapSplitOnMouseMove)
        $('#main-container').off('touchmove', globeSplitOnMouseMove)
        $('#main-container').off('touchmove', toolsSplitOnMouseMove)
        return false
    }
    function mainContainerOnMouseOut(e) {
        dragThreshold = 0
        mouseIsDown = false
        //Clear stuff up
        $('#main-container').off('mouseup', mainContainerOnMouseUp)
        $('#main-container').off('mouseleave', mainContainerOnMouseOut)
        $('#main-container').off('mousemove', mapSplitOnMouseMove)
        $('#main-container').off('mousemove', globeSplitOnMouseMove)
        $('#main-container').off('mousemove', toolsSplitOnMouseMove)

        $('#main-container').off('touchend', mainContainerOnMouseUp)
        $('#main-container').off('touchleave', mainContainerOnMouseOut)
        $('#main-container').off('touchmove', mapSplitOnMouseMove)
        $('#main-container').off('touchmove', globeSplitOnMouseMove)
        $('#main-container').off('touchmove', toolsSplitOnMouseMove)
        return false
    }

    //The splitter between viewer and map
    function mapSplitOnMouseMove(e) {
        if (dragThreshold > threshold) {
            //For touches
            if (!e.clientX && e.originalEvent && e.originalEvent.touches)
                e.clientX = e.originalEvent.touches[0].clientX

            e.clientX -= UserInterface.splitterSize

            e.clientX -= 40 //Left toolbar

            e.clientX -= $('#toolPanel').width()

            if (e.clientX >= UserInterface.mainWidth - 5) {
                e.clientX = UserInterface.mainWidth
            } else if (e.clientX <= 5) {
                e.clientX = 0
            }

            UserInterface.pxIsViewer =
                e.clientX - UserInterface.splitterSize / 2
            UserInterface.pxIsMap =
                UserInterface.mainWidth -
                e.clientX +
                UserInterface.splitterSize / 2 -
                UserInterface.pxIsGlobe
            UserInterface.pxIsGlobe =
                UserInterface.mainWidth -
                UserInterface.pxIsViewer -
                UserInterface.pxIsMap

            if (UserInterface.pxIsViewer < 0) {
                UserInterface.pxIsViewer = 0
                UserInterface.pxIsMap =
                    UserInterface.mainWidth - UserInterface.pxIsGlobe
            }
            if (
                UserInterface.pxIsViewer >
                UserInterface.mainWidth - UserInterface.splitterSize * 2
            ) {
                UserInterface.pxIsViewer =
                    UserInterface.mainWidth - UserInterface.splitterSize * 2
            }
            if (UserInterface.pxIsGlobe <= 0) {
                UserInterface.pxIsGlobe = 0
            }
            if (UserInterface.pxIsMap < UserInterface.splitterSize * 2) {
                UserInterface.pxIsMap = UserInterface.splitterSize * 2
                UserInterface.pxIsGlobe =
                    UserInterface.mainWidth -
                    UserInterface.pxIsViewer -
                    UserInterface.pxIsMap
            }
            if (UserInterface.pxIsMap > UserInterface.mainWidth) {
                UserInterface.pxIsMap = UserInterface.mainWidth
            }

            //The viewer screen
            UserInterface.viewerScreen.style(
                'width',
                UserInterface.pxIsViewer + 'px'
            )
            //The map screen
            UserInterface.mapScreen
                .style(
                    'width',
                    UserInterface.pxIsMap -
                        UserInterface.splitterSize * 2 +
                        'px'
                )
                .style(
                    'left',
                    UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
                )
            //The map slider
            UserInterface.mapSplit.style(
                'left',
                UserInterface.pxIsViewer -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

            //The globe screen
            UserInterface.globeScreen
                .style('width', UserInterface.pxIsGlobe + 'px')
                .style(
                    'left',
                    UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
                )
            //The globe slider
            UserInterface.globeSplit.style(
                'left',
                UserInterface.pxIsViewer +
                    UserInterface.pxIsMap -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

            resize()

            return false
        }
        if (mouseIsDown) {
            dragThreshold++
        }
    }

    //The splitter between map and globe
    function globeSplitOnMouseMove(e) {
        if (dragThreshold > threshold) {
            //For touches
            if (!e.clientX && e.originalEvent && e.originalEvent.touches)
                e.clientX = e.originalEvent.touches[0].clientX

            e.clientX -= 40 //Left toolbar

            e.clientX -= $('#toolPanel').width()

            if (UserInterface.hasViewer !== false) {
                e.clientX -= UserInterface.splitterSize
            }

            if (e.clientX >= UserInterface.mainWidth - 5) {
                e.clientX = UserInterface.mainWidth
            } else if (e.clientX <= 5) {
                e.clientX = 0
            }

            UserInterface.pxIsGlobe =
                UserInterface.mainWidth -
                e.clientX -
                UserInterface.splitterSize / 2
            UserInterface.pxIsMap =
                e.clientX -
                UserInterface.pxIsViewer +
                UserInterface.splitterSize / 2
            UserInterface.pxIsViewer =
                UserInterface.mainWidth -
                UserInterface.pxIsGlobe -
                UserInterface.pxIsMap

            if (UserInterface.pxIsGlobe <= 0) {
                UserInterface.pxIsGlobe = 0 //UserInterface.splitterSize;
                UserInterface.pxIsMap =
                    UserInterface.mainWidth - UserInterface.pxIsViewer
            }
            if (UserInterface.pxIsMap < UserInterface.splitterSize * 2) {
                UserInterface.pxIsMap = UserInterface.splitterSize * 2
                UserInterface.pxIsViewer =
                    UserInterface.mainWidth -
                    UserInterface.pxIsGlobe -
                    UserInterface.pxIsMap
            }
            if (
                UserInterface.pxIsGlobe >
                UserInterface.mainWidth - UserInterface.splitterSize * 2
            ) {
                UserInterface.pxIsGlobe =
                    UserInterface.mainWidth - UserInterface.splitterSize * 2
                UserInterface.pxIsViewer = 0
                UserInterface.pxIsMap = UserInterface.splitterSize * 2
            }

            //The viewer screen
            UserInterface.viewerScreen.style(
                'width',
                UserInterface.pxIsViewer + 'px'
            )

            //The map screen
            UserInterface.mapScreen
                .style(
                    'width',
                    UserInterface.pxIsMap -
                        UserInterface.splitterSize * 2 +
                        'px'
                )
                .style(
                    'left',
                    UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
                )
            //The map slider
            UserInterface.mapSplit.style(
                'left',
                UserInterface.pxIsViewer -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

            //The globe screen
            UserInterface.globeScreen
                .style('width', UserInterface.pxIsGlobe + 'px')
                .style(
                    'left',
                    UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
                )
            //The globe slider
            UserInterface.globeSplit.style(
                'left',
                UserInterface.pxIsViewer +
                    UserInterface.pxIsMap -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

            resize()

            return false
        }
        if (mouseIsDown) {
            dragThreshold++
        }
    }

    function toolsSplitOnMouseMove(e) {
        if (dragThreshold > threshold) {
            //For touches
            if (!e.clientY && e.originalEvent && e.originalEvent.touches)
                e.clientY = e.originalEvent.touches[0].clientY

            UserInterface.pxIsTools =
                UserInterface.mainHeight -
                e.clientY +
                UserInterface.splitterSize / 4
            if (UserInterface.pxIsTools < UserInterface.splitterSize / 4) {
                UserInterface.pxIsTools = UserInterface.splitterSize / 4
            }
            if (
                UserInterface.pxIsTools >
                UserInterface.mainHeight -
                    (UserInterface.splitterSize + UserInterface.topSize)
            ) {
                UserInterface.pxIsTools =
                    UserInterface.mainHeight -
                    (UserInterface.splitterSize + UserInterface.topSize)
            }

            //The viewer slider
            UserInterface.viewerSplit.style(
                'height',
                UserInterface.mainHeight -
                    UserInterface.pxIsTools -
                    UserInterface.topSize +
                    'px'
            )

            //The map slider
            UserInterface.mapSplit.style(
                'height',
                UserInterface.mainHeight -
                    UserInterface.pxIsTools -
                    UserInterface.topSize +
                    'px'
            )

            //The globe slider
            UserInterface.globeSplit.style(
                'height',
                UserInterface.mainHeight -
                    UserInterface.pxIsTools -
                    UserInterface.topSize +
                    'px'
            )

            //The tools screen
            UserInterface.toolsScreen.style(
                'height',
                UserInterface.pxIsTools + 'px'
            )
            //The tools slider
            UserInterface.toolsSplit.style(
                'bottom',
                UserInterface.pxIsTools - UserInterface.splitterSize / 2 + 'px'
            )

            resize()
            return false
        }
        if (mouseIsDown) {
            dragThreshold++
        }
    }

    function resize() {
        //resize viewer
        if (Viewer_ != null) Viewer_.invalidateSize()
        //resize map
        if (Map_ != null) Map_.map.invalidateSize()
        //resize globe
        if (Globe_ != null) Globe_.invalidateSize()

        shouldRotateSplitterText()
    }
    function windowresize() {
        //Could've just used percents overall but oh well
        //converts from px to percent, finds new dimensions, then converts back to px
        //Don't let them get smaller than the splitter size
        if (UserInterface.pxIsViewer != UserInterface.splitterSize)
            UserInterface.pxIsViewer =
                (UserInterface.pxIsViewer / UserInterface.mainWidth) *
                $('#splitscreens').width()
        if (UserInterface.pxIsMap != UserInterface.splitterSize)
            UserInterface.pxIsMap =
                (UserInterface.pxIsMap / UserInterface.mainWidth) *
                $('#splitscreens').width()
        if (UserInterface.pxIsGlobe != UserInterface.splitterSize)
            UserInterface.pxIsGlobe =
                (UserInterface.pxIsGlobe / UserInterface.mainWidth) *
                $('#splitscreens').width()

        //Update these
        UserInterface.mainWidth = $('#splitscreens').width()
        UserInterface.mainHeight = $('#splitscreens').height()

        //Resize widest panel so that their sum is the screen width
        var widest = Math.max(
            UserInterface.pxIsViewer,
            UserInterface.pxIsMap,
            UserInterface.pxIsGlobe
        )
        if (UserInterface.pxIsViewer == widest)
            UserInterface.pxIsViewer =
                UserInterface.mainWidth -
                UserInterface.pxIsMap -
                UserInterface.pxIsGlobe
        else if (UserInterface.pxIsMap == widest)
            UserInterface.pxIsMap =
                UserInterface.mainWidth -
                UserInterface.pxIsViewer -
                UserInterface.pxIsGlobe
        else if (UserInterface.pxIsGlobe == widest)
            UserInterface.pxIsGlobe =
                UserInterface.mainWidth -
                UserInterface.pxIsViewer -
                UserInterface.pxIsMap

        //Update their sizes now
        //The viewer screen
        UserInterface.viewerScreen
            .style('width', UserInterface.pxIsViewer + 'px')
            .style('height', UserInterface.mainHeight + 'px')
        //The viewer slider
        UserInterface.viewerSplit.style(
            'height',
            UserInterface.mainHeight + 'px'
        )

        //The map screen
        UserInterface.mapScreen
            .style(
                'width',
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
            )
            .style('height', UserInterface.mainHeight + 'px')
            .style(
                'left',
                UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
            )
        //The map slider
        UserInterface.mapSplit
            .style('height', UserInterface.mainHeight + 'px')
            .style(
                'left',
                UserInterface.pxIsViewer -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

        //The globe screen
        UserInterface.globeScreen
            .style('width', UserInterface.pxIsGlobe + 'px')
            .style('height', UserInterface.mainHeight + 'px')
            .style(
                'left',
                UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
            )
        //The globe slider
        UserInterface.globeSplit
            .style('height', UserInterface.mainHeight + 'px')
            .style(
                'left',
                UserInterface.pxIsViewer +
                    UserInterface.pxIsMap -
                    UserInterface.splitterSizeHidden / 2 +
                    'px'
            )

        //Don't let tools exceed max
        if (
            UserInterface.pxIsTools >
            UserInterface.mainHeight -
                UserInterface.splitterSize -
                UserInterface.topSize
        ) {
            UserInterface.setToolHeight('full', true)
        }

        shouldRotateSplitterText()
    }

    function shouldRotateSplitterText() {
        //How wide must the panel be to move text to top
        var boundary = 100
        if (UserInterface.pxIsViewer >= boundary) {
            if (!$('#viewerSplitText').hasClass('active'))
                $('#viewerSplitText').addClass('active')
        } else {
            if ($('#viewerSplitText').hasClass('active'))
                $('#viewerSplitText').removeClass('active')
        }

        if (UserInterface.pxIsMap >= boundary) {
            if (!$('#mapSplitText').hasClass('active'))
                $('#mapSplitText').addClass('active')
        } else {
            if ($('#mapSplitText').hasClass('active'))
                $('#mapSplitText').removeClass('active')
        }

        if (UserInterface.pxIsGlobe >= boundary) {
            if (!$('#globeSplitText').hasClass('active'))
                $('#globeSplitText').addClass('active')
        } else {
            if ($('#globeSplitText').hasClass('active'))
                $('#globeSplitText').removeClass('active')
        }
    }

    //Currently can't remove map
    function clearUnwantedPanels(hasViewer, hasMap, hasGlobe) {
        if (!hasViewer && !hasGlobe) {
            $('#mapSplit').off('mousedown', mapSplitOnMouseDown)
            $('#mapSplit').off('touchstart', mapSplitOnMouseDown)
            d3.select('#viewerSplit').selectAll('*').remove()
            d3.select('#viewerSplit').style('width', 0)
            $('#mapSplit div:not(#mapSplitText)').remove()
            d3.select('#mapSplit')
                .style('cursor', 'default')
                .style('box-shadow', 'none')
            $('#globeSplit').off('mousedown', globeSplitOnMouseDown)
            $('#globeSplit').off('touchstart', globeSplitOnMouseDown)
            d3.select('#globeSplit').selectAll('*').remove()
            d3.select('#globeSplit')
                .style('width', '0')
                .style('cursor', 'default')
                .style('box-shadow', 'none')
            d3.select('#mapSplit').selectAll('*').remove()
            d3.select('#mapSplit').style('width', '0')
            d3.select('#mapScreen').style('top', '0')
            UserInterface.splitterSize = 0
        } else if (!hasViewer) {
            $('#mapSplit').off('mousedown', mapSplitOnMouseDown)
            $('#mapSplit').off('touchstart', mapSplitOnMouseDown)
            d3.select('#viewerSplit').selectAll('*').remove()
            d3.select('#viewerSplit').style('width', 0)
            $('#mapSplit div:not(#mapSplitText)').remove()
            d3.select('#mapSplit')
                .style('cursor', 'default')
                .style('box-shadow', 'none')
        } else if (!hasGlobe) {
            $('#globeSplit').off('mousedown', globeSplitOnMouseDown)
            $('#globeSplit').off('touchstart', globeSplitOnMouseDown)
            d3.select('#globeSplit').selectAll('*').remove()
            d3.select('#globeSplit')
                .style('width', '0')
                .style('cursor', 'default')
                .style('box-shadow', 'none')
        }
        windowresize()
        Map_.map.invalidateSize()
    }

    function toggleHelp() {}

    function fullscreen() {
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
    }

    UserInterface.init()

    return UserInterface
})
