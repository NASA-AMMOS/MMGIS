import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_'
import Login from '../../Ancillary/Login/Login'

import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

import './UserInterface_.css'

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
    toolPanel: null,
    toolPanelDrag: null,
    helpOn: true,
    layerUpdatedControl: null,
    init: function () {
        //Other stylings in mmgis.css

        // prettier-ignore
        var logoURL = 'public/images/logos/logo.png'

        // prettier-ignore
        const topBarMarkup = [
            "<div id='topBar'>",
                "<div id='topBarLeft' class='hideScrollbar'>",
                    "<div id='topBarMain'>",
                        "<div id='topBarTitle'>",
                            `<div id='topBarTitleName' tabindex='200'>`,
                                window.mmgisglobal.name,
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div id='topBarSecondary'>",
                        "<div class='mainDescription' title='Go to active item'>",
                        "</div>",
                        "<div class='mainInfo' title='Go to featured item'>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='topBarRight'>",
                    "<div class='Search'>",
                    "</div>",
                "</div>",
            "</div>"
        ].join('\n')
        //TopBar
        $('#main-container').append(topBarMarkup)

        $('#topBarLeft').on('wheel', function (e) {
            e.preventDefault()
            this.scrollLeft += e.originalEvent.deltaY
        })

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
            .style('background', '#000')

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

        BottomBar.init('barBottom', this)

        this.toolPanel = d3
            .select('#main-container')
            .append('div')
            .attr('id', 'toolPanel')
            .style('position', 'absolute')
            .style('width', '0px')
            .style('top', this.topSize + 'px')
            .style('height', 'calc( 100% - ' + this.topSize + 'px )')
            .style('left', this.topSize + 'px')
            .style('background', 'var(--color-k)')
            //.style( 'border-left', '1px solid #26a8ff' )
            //.style('box-shadow', '5px 0px 3px rgba(0,0,0,0.2)')
            .style('transition', 'width 0.2s ease-out')
            .style('overflow', 'hidden')
            .style('z-index', '1400')
        // Drag
        this.toolPanelDrag = d3
            .select('#main-container')
            .append('div')
            .attr('id', 'toolPanelDrag')
            .style('position', 'absolute')
            .style('width', '24px')
            .style('height', `28px`)
            .style('padding', '10px 2px')
            .style('margin', '0px 3px')
            .style('text-align', 'center')
            .style('top', '1px')
            .style('color', 'var(--color-a3)')
            .style('overflow', 'hidden')
            .style('cursor', 'col-resize')
            .style('display', 'none')
            .style('z-index', '1400')
            .style('border-right', '1px solid transparent')
        this.toolPanelDrag
            .append('div')
            .html("<i class='mdi mdi-drag-vertical mdi-18px'></i>")
        UserInterface.handleToolDragDragging = function (e) {
            UserInterface.toolDrags.left =
                UserInterface.toolDrags.offset0.left +
                (e.pageX - UserInterface.toolDrags.pageX0)

            $('body').css('user-select', 'none')

            UserInterface.toolPanelDrag
                .style('left', UserInterface.toolDrags.left + 'px')
                .style('height', '100%')
                .style('border-right', '2px solid var(--color-a1)')
        }

        UserInterface.handleToolDragMouseup = function () {
            $('body')
                .off('mousemove', UserInterface.handleToolDragDragging)
                .off('mouseup', UserInterface.handleToolDragMouseup)
            if (UserInterface.toolDrags?.left != null)
                UserInterface.resizeToolPanel(
                    UserInterface.toolDrags.left - UserInterface.topSize + 24
                )
            $('body').css('user-select', 'auto')
            UserInterface.toolPanelDrag
                .style('color', 'var(--color-a3)')
                .style('height', '28px')
                .style('border-right', '1px solid transparent')
        }
        UserInterface.handleToolDragMousedown = function (e) {
            UserInterface.toolDrags = {}
            UserInterface.toolDrags.pageX0 = e.pageX
            UserInterface.toolDrags.elem = this
            UserInterface.toolDrags.offset0 = $(this).offset()
            UserInterface.toolPanelDrag.style('color', 'var(--color-mmgis)')
            $('body')
                .on('mouseup', UserInterface.handleToolDragMouseup)
                .on('mousemove', UserInterface.handleToolDragDragging)
        }
        $('#toolPanelDrag').on('mousedown', this.handleToolDragMousedown)

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
        this.vmgScreen = this.splitscreens.append('div').attr('id', 'vmgScreen')

        //The viewer screen
        this.viewerScreen = this.vmgScreen
            .append('div')
            .attr('id', 'viewerScreen')
            .style('position', 'absolute')
            .style('width', this.pxIsViewer + 'px')
            .style('height', this.mainHeight + 'px')
            .style('top', '0px')
            .style('overflow', 'hidden')
            .style('left', 0 + 'px')

        this.viewerScreen
            .append('div')
            .attr('id', 'viewer')
            .style('position', 'absolute')
            .style('background-color', 'var(--color-a-5)')
            .style('width', '100%')
            .style('height', '100%')
        this.viewerToolBar = this.viewerScreen
            .append('div')
            .attr('id', 'viewerToolBar')
            .style('position', 'absolute')
            .style('top', `40px`)
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
            .style('cursor', 'default')

        //The map screen
        this.mapScreen = this.vmgScreen
            .append('div')
            .attr('id', 'mapScreen')
            .style('position', 'absolute')
            .style('width', this.pxIsMap - this.splitterSize * 2 + 'px')
            .style('height', this.mainHeight + 'px')
            .style('top', '0px')
            .style('left', this.pxIsViewer + this.splitterSize + 'px')
        this.mapScreen
            .append('div')
            .attr('id', 'map')
            .style('position', 'absolute')
            .style('background-color', 'var(--color-a-5)')
            .style('width', '100%')
            .style('height', '100%')
        //.style( 'height', 'calc( 100% - ' + this.splitterSize + 'px )' );
        this.mapToolBar = this.mapScreen
            .append('div')
            .attr('id', 'mapToolBar')
            .style('position', 'absolute')
            .style('bottom', '0px')
            .style('width', '100%')
            .style('height', '40px')
            .style('pointer-events', 'none')
            .style('overflow', 'hidden')
            .style('z-index', '1003')
            .style('transition', 'bottom 0.2s ease-out')

        this.mapTopBar = this.mapScreen
            .append('div')
            .attr('id', 'mapTopBar')
            .style('z-index', '400')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('position', 'absolute')
            .style('top', '0px')
            .style('pointer-events', 'none')
            .style('width', '100%')
            .style('height', this.topSize + 'px')
            .style('left', '0px')
            .style('background', 'transparent')
            .style('font-family', 'sans-serif')
            .style('font-size', '24px')
            .style('padding', '5px')

        //The map slider
        this.mapSplit = this.vmgScreen
            .append('div')
            .attr('class', 'splitterV')
            .attr('id', 'mapSplit')
            .style('width', this.splitterSizeHidden + 'px')
            .style('height', this.mainHeight + 'px')
            .style('left', this.pxIsViewer - this.splitterSizeHidden / 2 + 'px')

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
            .style('left', '-19px')
            .style('z-index', '-1')
        this.mapSplitInner
            .append('i')
            .style('transition', 'all 0.2s ease-in')
            .attr('id', 'mapSplitInnerLeft')
            .attr('tabindex', 500)
            .attr('class', 'mdi mdi-chevron-double-left mdi-24px')
            .style('position', 'absolute')
            .style('left', '-28px')
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
            .style('left', '23px')
            .style('z-index', '-1')
        this.mapSplitInner
            .append('i')
            .style('transition', 'all 0.2s ease-in')
            .attr('id', 'mapSplitInnerRight')
            .attr('tabindex', 501)
            .attr('class', 'mdi mdi-chevron-double-right mdi-24px')
            .style('position', 'absolute')
            .style('right', '-29px')
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

        //The globe screen
        this.globeScreen = this.vmgScreen
            .append('div')
            .attr('id', 'globeScreen')
            .style('position', 'absolute')
            .style('width', this.pxIsGlobe + 'px')
            .style('height', this.mainHeight + 'px')
            .style('top', '0px')
            .style('overflow', 'hidden')
            .style('left', this.pxIsViewer + this.pxIsMap + 'px')
            .style('z-index', '401')
        this.globeScreen
            .append('div')
            .attr('id', 'globe')
            .style('position', 'absolute')
            .style('background-color', 'var(--color-a1)')
            .style('width', '100%')
            .style('height', '100%')

        this.globeToolBar = this.globeScreen
            .append('div')
            .attr('id', 'globeToolBar')
            .style('position', 'absolute')
            .style('top', `40px`)
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
            .style('left', '-18px')
            .style('z-index', '-1')
        this.globeSplitInner
            .append('i')
            .style('transition', 'all 0.2s ease-in')
            .attr('id', 'globeSplitInnerLeft')
            .attr('tabindex', 502)
            .attr('class', 'mdi mdi-chevron-double-left mdi-24px')
            .style('position', 'absolute')
            .style('left', '-27px')
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
            .style('left', '22px')
            .style('z-index', '-1')
        this.globeSplitInner
            .append('i')
            .style('transition', 'all 0.2s ease-in')
            .attr('id', 'globeSplitInnerRight')
            .attr('tabindex', 503)
            .attr('class', 'mdi mdi-chevron-double-right mdi-24px')
            .style('position', 'absolute')
            .style('right', '-28px')
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
            .style('padding-top', '40px')
            .style('background', 'var(--color-a)')
            .style('border-right', '1px solid var(--color-a-5)')
            .style('top', '0px')
            .style('height', '100%')
            .style('z-index', '1004')

        this.toolbarLogo = d3
            .select('#main-container')
            .append('div')
            .attr('id', 'mmgislogo')
            .style('display', this.topSize == 0 ? 'inherit' : 'none')
            .style('padding', '9px 6px')
            .style('cursor', 'pointer')
            .style('width', '40px')
            .style('height', '40px')
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('z-index', '2005')
            .style('image-rendering', 'pixelated')
            .html(
                `<svg width="27" height="27" viewBox="0 0 231 137" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.222266 9.21339C-0.277832 14.7126 0.222266 133.713 0.222266 133.713H26.2223V45.7134C26.2223 45.7134 100.722 127.712 106.222 132.713C109.171 135.395 112.12 136.782 115.222 136.645C118.325 136.782 121.274 135.395 124.222 132.713C129.722 127.712 204.222 45.7134 204.222 45.7134V133.713H230.222C230.222 133.713 230.722 14.7126 230.222 9.21339C229.722 3.71413 218.222 -3.28766 210.222 1.71339C202.222 6.71444 115.222 104.713 115.222 104.713C115.222 104.713 28.2224 6.71444 20.2223 1.71339C12.2222 -3.28766 0.722363 3.71413 0.222266 9.21339Z" fill="#08AEEA"></path>
</svg>`
            )
            .on('click', F_.toHostForceLanding)

        this.dataLoadingSpinner = d3
            .select('#main-container')
            .append('div')
            .attr('id', 'dataLoadingSpinner')
            .style('opacity', 0)
            .style('transition', 'opacity 0.3s ease-in-out')
            .style('pointer-events', 'none')
            .style('width', '40px')
            .style('height', '40px')
            .style('background', 'var(--color-a)')
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('z-index', '2005')
            .append('div')
            .attr('class', 'mmgis-spinner2')
            .style('position', 'absolute')
            .style('top', '4px')
            .style('left', '4px')

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
    resize: function () {
        windowresize()
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

        $('#CoordinatesDiv').css('right', width + 'px')
        $('#main-container').css('width', `calc(100% - ${width}px)`)

        UserInterface.mainWidth = $('#splitscreens').width()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
        $('#uiRightPanel').css({ display: 'inherit', width: width })

        UserInterface.rightPanelOpen = true
    },
    closeRightPanel: function () {
        if (UserInterface.rightPanelOpen == null) return

        $('#CoordinatesDiv').css('right', '0px')
        $('#main-container').css('width', `100%`)

        UserInterface.mainWidth = $('#splitscreens').width()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
        $('#uiRightPanel').css({ display: 'none', width: 0 })

        UserInterface.rightPanelOpen = null
    },
    openToolPanel: function (width) {
        UserInterface.toolPanel.selectAll('*').remove()
        UserInterface.toolPanel.style('width', width + 'px')
        UserInterface.toolPanelDrag.style('left', width + 10 + 'px')
        UserInterface.splitscreens.style(
            'width',
            'calc(100% - ' + (width + 40) + 'px)'
        )
        $('#topBar').css({
            'padding-left': '0px',
            'margin-left': `${width + 40}px`,
            width: `calc(100% - ${width + 40}px)`,
        })
        UserInterface.splitscreens.style('left', width + 40 + 'px')
        UserInterface.mainWidth = $('#splitscreens').width()
        UserInterface.mainHeight = $('#splitscreens').height()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
    },
    resizeToolPanel: function (width) {
        width = Math.max(
            Math.min(width, window.innerWidth / 2),
            ToolController_.getTool(ToolController_.activeToolName)?.width ||
                300
        )
        UserInterface.toolPanel.style('width', width + 'px')
        UserInterface.toolPanelDrag.style('left', width + 10 + 'px')
        UserInterface.splitscreens.style(
            'width',
            'calc(100% - ' + (width + 40) + 'px)'
        )
        $('#topBar').css({
            'padding-left': '0px',
            'margin-left': `${width + 40}px`,
            width: `calc(100% - ${width + 40}px)`,
        })
        UserInterface.splitscreens.style('left', width + 40 + 'px')
        UserInterface.mainWidth = $('#splitscreens').width()
        UserInterface.mainHeight = $('#splitscreens').height()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
    },
    closeToolPanel: function () {
        UserInterface.toolPanel.selectAll('*').remove()
        UserInterface.toolPanel.style('width', '0')
        $('#topBar').css({
            'padding-left': '40px',
            'margin-left': '0px',
            width: '100%',
        })
        //UserInterface.toolPanel.style( 'border-left', '1px solid rgb(38, 168, 255)' );
        UserInterface.toolbar.style('box-shadow', 'none')
        UserInterface.splitscreens.style('width', 'calc(100% - ' + 40 + 'px)')
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
        let timeUIActive = false
        if ($('#timeUI').length) {
            timeUIActive = $('#timeUI').hasClass('active')
        }

        $('#mapToolBar').css({
            bottom: UserInterface.pxIsTools + (timeUIActive ? 40 : 0) + 'px',
        })
        $('.leaflet-control-scalefactor').css({
            bottom: UserInterface.pxIsTools + 28 + 'px',
        })
        $('#mmgis-map-compass').css({
            bottom: UserInterface.pxIsTools + 38 + 'px',
        })
        $('#CoordinatesDiv').css({
            bottom: UserInterface.pxIsTools + (timeUIActive ? 40 : 0) + 'px',
        })
        $('#timeUI').css({
            bottom: UserInterface.pxIsTools + (timeUIActive ? 0 : -40) + 'px',
        })

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
        const toolbarWidth = $('#toolbar').width()
        let newTopWidth = toolbarWidth

        if (newWidth == 'full') {
            newWidth = `calc(100vw - ${$('#toolbar').width()}px)`
        } else {
            newTopWidth = newTopWidth + newWidth
            newWidth += 'px'
        }

        $('#toolsWrapper').css({
            width: newWidth,
        })

        $('#topBar').css({
            'margin-left': newTopWidth + 'px',
            width: `calc(100% - ${newTopWidth}px)`,
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
        UserInterface.pxIsGlobe = UserInterface.mainWidth * (globePercent / 100)
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
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
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
            this.toolbarLogo.style('display', 'inherit')
            this.toolbar.style('top', '0px')
            this.toolbar.style('height', '100%')
            this.toolbar.style('padding-top', '40px')
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
        this.Map_ = map_
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

        UserInterface.minimalist(true)

        clearUnwantedPanels(this.hasViewer, true, this.hasGlobe)
        if (l_.configData.look) {
            if (
                l_.configData.look.pagename == null ||
                l_.configData.look.pagename == ''
            )
                $('#topBarTitleName').css({ display: 'none' })
            else $('#topBarTitleName').html(l_.configData.look.pagename)
        }

        //Disable toolbar presets when needed
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

        if (l_.configData.look && l_.configData.look.settings != null)
            $('#bottomBarSettings').css({
                display: l_.configData.look.settings ? 'inherit' : 'none',
            })

        if (
            l_.configData.look &&
            l_.configData.look.info != null &&
            l_.configData.look.infourl != ''
        ) {
            $('#topBarInfo').css({
                display: l_.configData.look.info ? 'inherit' : 'none',
            })
        } else {
            $('#topBarInfo').css({
                display: 'none',
            })
        }

        if (
            l_.configData.look &&
            l_.configData.look.help != null &&
            l_.configData.look.helpurl != ''
        ) {
            $('#topBarHelp').css({
                display: l_.configData.look.help ? 'inherit' : 'none',
            })
        } else {
            $('#topBarHelp').css({
                display: 'none',
            })
        }

        if (l_.configData.look && l_.configData.look.topbar === false)
            BottomBar.changeUIVisibility('topbar', false)
        if (l_.configData.look && l_.configData.look.toolbar === false)
            BottomBar.changeUIVisibility('toolbars', false)
        if (l_.configData.look && l_.configData.look.scalebar === false)
            BottomBar.changeUIVisibility('scalebar', false)
        if (l_.configData.look && l_.configData.look.coordinates === false)
            BottomBar.changeUIVisibility('coordinates', false)
        if (l_.configData.look && l_.configData.look.miscellaneous === false)
            BottomBar.changeUIVisibility('miscellaneous', false)

        BottomBar.fina()
        UserInterface.show()
    },
    updateLayerUpdateButton: function (type) {
        if (UserInterface.layerUpdatedControl) {
            UserInterface.removeLayerUpdateButton()
        }

        if (Map_) {
            UserInterface.layerUpdatedControl = new LayerUpdatedControl({
                position: 'topright',
                type,
            })
            UserInterface.layerUpdatedControl.addTo(Map_.map)
        }
    },
    removeLayerUpdateButton: function () {
        if (UserInterface.layerUpdatedControl && Map_) {
            UserInterface.layerUpdatedControl.remove(Map_.map)
            UserInterface.layerUpdatedControl = null
        }
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

        UserInterface.pxIsViewer = e.clientX - UserInterface.splitterSize / 2
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
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
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
            UserInterface.mainWidth - e.clientX - UserInterface.splitterSize / 2
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
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
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
    if (Globe_ != null) Globe_.litho.invalidateSize()

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
    const widest = Math.max(
        UserInterface.pxIsViewer,
        UserInterface.pxIsMap,
        UserInterface.pxIsGlobe
    )
    if (UserInterface.pxIsMap == widest)
        UserInterface.pxIsMap =
            UserInterface.mainWidth -
            UserInterface.pxIsViewer -
            UserInterface.pxIsGlobe
    else if (UserInterface.pxIsViewer == widest)
        UserInterface.pxIsViewer =
            UserInterface.mainWidth -
            UserInterface.pxIsMap -
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
    UserInterface.viewerSplit.style('height', UserInterface.mainHeight + 'px')

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
        .style('left', UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px')
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

$(document).ready(function () {
    UserInterface.init()
})

export default UserInterface
