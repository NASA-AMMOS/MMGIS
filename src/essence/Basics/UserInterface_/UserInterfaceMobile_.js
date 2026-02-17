import $ from 'jquery'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_'
import Login from '../../Ancillary/Login/Login'

import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

import './UserInterfaceMobile_.css'

var Viewer_ = null
var Map_ = null
var Globe_ = null

var mobileTools = ['Layers', 'Legend', 'Info']

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
    isMobile: false,
    init: function () {
        //Other stylings in mmgis.css

        // prettier-ignore
        var logoURL = 'public/images/logos/logo.png'

        // prettier-ignore
        const topBarMarkup = [
            "<div id='topBar' style='background: var(--color-a);' >",
                "<div id='topBarLeft' class='hideScrollbar'>",
                    "<div id='topBarMain'>",
                        "<div id='topBarTitle'>",
                            //`<div id='topBarTitleName' tabindex='200'>`,
                            //    window.mmgisglobal.name, FIXME Figure out what to do with this
                            //"</div>",
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

        const topBarMenu = $('<div>')
            .attr('id', 'topBarMenu')
            .on('click', function () {
                $('#barBottom').css(
                    'display',
                    $('#barBottom').css('display') === 'none'
                        ? 'flex'
                        : 'none'
                )
                // FIXME The hamburger button should close the barBottom items when somewhere else on the map is clicked
            })
        topBarMenu.append($('<i>')
            .attr('class', 'mdi mdi-menu mdi-24px'))
        $('#topBar').append(topBarMenu)
            .css('height', this.topSize + 'px')

        $('#topBarLeft').on('wheel', function (e) {
            e.preventDefault()
            this.scrollLeft += e.originalEvent.deltaY
        })

        this.rightPanel = $('<div>')
            .attr('id', 'uiRightPanel')
            .css({
                'position': 'absolute',
                'top': '0px',
                'right': '0px',
                'display': 'none',
                'width': '0px',
                'height': '100vh',
                'background': '#000'
            })
        $('body').append(this.rightPanel)

        Login.init()

        this.barBottom = $('<div>')
            .attr('id', 'barBottom')
            .css({
                'position': 'absolute',
                'width': '40px',
                'bottom': '0px',
                'left': '0px',
                'display': 'none',
                'flex-flow': 'column',
                'z-index': '1005'
            })
        $('#topBarMenu').append(this.barBottom)

        BottomBar.init('barBottom', this)

        this.toolPanel = $('<div>')
            .attr('id', 'toolPanel')
            .css({
                'position': 'absolute',
                'width': '0px',
                'top': this.topSize + 'px',
                'height': 'calc( 100% - ' + this.topSize + 'px )',
                'left': this.topSize + 'px',
                'background': 'var(--color-k)',
                //'border-left': '1px solid #26a8ff',
                //'box-shadow': '5px 0px 3px rgba(0,0,0,0.2)',
                'transition': 'width 0.2s ease-out',
                'overflow': 'hidden',
                'z-index': '1400'
            })
        $('#main-container').append(this.toolPanel)
        // Drag
        this.toolPanelDrag = $('<div>')
            .attr('id', 'toolPanelDrag')
            .css({
                'position': 'absolute',
                'width': '24px',
                'height': `28px`,
                'padding': '10px 2px',
                'margin': '0px 3px',
                'text-align': 'center',
                'top': '1px',
                'color': 'var(--color-a3)',
                'overflow': 'hidden',
                'cursor': 'col-resize',
                'display': 'none',
                'z-index': '1400',
                'border-right': '1px solid transparent'
            })
        $('#main-container').append(this.toolPanelDrag)
        this.toolPanelDrag
            .append($('<div>').html("<i class='mdi mdi-drag-vertical mdi-18px'></i>"))
        UserInterface.handleToolDragDragging = function (e) {
            UserInterface.toolDrags.left =
                UserInterface.toolDrags.offset0.left +
                (e.pageX - UserInterface.toolDrags.pageX0)

            $('body').css('user-select', 'none')

            UserInterface.toolPanelDrag
                .css('left', UserInterface.toolDrags.left + 'px')
                .css('height', '100%')
                .css('border-right', '2px solid var(--color-a1)')
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
                .css('color', 'var(--color-a3)')
                .css('height', '28px')
                .css('border-right', '1px solid transparent')
        }
        UserInterface.handleToolDragMousedown = function (e) {
            UserInterface.toolDrags = {}
            UserInterface.toolDrags.pageX0 = e.pageX
            UserInterface.toolDrags.elem = this
            UserInterface.toolDrags.offset0 = $(this).offset()
            UserInterface.toolPanelDrag.css('color', 'var(--color-mmgis)')
            $('body')
                .on('mouseup', UserInterface.handleToolDragMouseup)
                .on('mousemove', UserInterface.handleToolDragDragging)
        }
        $('#toolPanelDrag').on('mousedown', this.handleToolDragMousedown)

        //Main container div
        this.splitscreens = $('<div>')
            .attr('id', 'splitscreens')
            .css({
                'position': 'absolute',
                'top': (this.fullSizeViews ? '0' : this.topSize) + 'px',
                //'width': 'calc( 100% - ' + 40 + 'px )',
                'width': '100%',
                'height': 'calc( 100% - ' +
                    (this.fullSizeViews ? '0' : this.topSize) +
                    'px )',
                'left': 0 + 'px'
            })
        $('#main-container').append(this.splitscreens)

        this.hide()
        this.mainWidth = $('#splitscreens').width()
        this.mainHeight = $('#splitscreens').height()

        this.pxIsViewer = 0
        this.pxIsMap = 0
        this.pxIsGlobe = 0
        this.pxIsTools = 0
        this.pxIsToolsInit = this.splitterSize / 4

        this.pxIsMap = this.mainWidth - this.pxIsViewer - this.pxIsGlobe
        this.pxIsMapHeight = this.mainHeight

        //the 'top' three panels
        this.vmgScreen = $('<div>').attr('id', 'vmgScreen')
        this.splitscreens.append(this.vmgScreen)

        //The viewer screen
        this.viewerScreen = $('<div>')
            .attr('id', 'viewerScreen')
            .css({
                'position': 'absolute',
                'width': this.pxIsViewer + 'px',
                'height': this.mainHeight + 'px',
                'top': '0px',
                'overflow': 'hidden',
                'left': 0 + 'px'
            })
        this.vmgScreen.append(this.viewerScreen)

        const viewerDiv = $('<div>')
            .attr('id', 'viewer')
            .css({
                'position': 'absolute',
                'background-color': 'var(--color-a-5)',
                'width': '100%',
                'height': '100%'
            })
        this.viewerScreen.append(viewerDiv)

        this.viewerToolBar = $('<div>')
            .attr('id', 'viewerToolBar')
            .css({
                'position': 'absolute',
                'top': `40px`,
                'width': '100%',
                'height': '48px',
                'pointer-events': 'none',
                'z-index': '5'
            })
        this.viewerScreen.append(this.viewerToolBar)

        //The viewer slider
        this.viewerSplit = $('<div>')
            .attr('class', 'splitterV')
            .attr('id', 'viewerSplit')
        this.vmgScreen.append(this.viewerSplit)
        /*
            .css('width', this.splitterSize + 'px')
            .css('height', this.mainHeight + 'px')
            .css('left', -this.splitterSize + 'px')
            .css('cursor', 'default')
            */

        //The map screen
        this.mapScreen = $('<div>')
            .attr('id', 'mapScreen')
            .css({
                'position': 'absolute',
                'width': this.pxIsMap - this.splitterSize * 2 + 'px',
                'height': this.mainHeight + 'px',
                'top': '0px',
                'left': this.pxIsViewer + this.splitterSize + 'px'
            })
        this.vmgScreen.append(this.mapScreen)

        const mapDiv = $('<div>')
            .attr('id', 'map')
            .css({
                'position': 'absolute',
                'background-color': 'var(--color-a-5)',
                'width': '100%',
                'height': '100%'
            })
        this.mapScreen.append(mapDiv)
        //.css( 'height', 'calc( 100% - ' + this.splitterSize + 'px )' );

        this.mapToolBar = $('<div>')
            .attr('id', 'mapToolBar')
            .css({
                'position': 'absolute',
                'bottom': '0px',
                'width': '100%',
                'height': '40px',
                'pointer-events': 'none',
                'overflow': 'hidden',
                'z-index': '1003',
                'transition': 'bottom 0.2s ease-out'
            })
        this.mapScreen.append(this.mapToolBar)

        this.mapTopBar = $('<div>')
            .attr('id', 'mapTopBar')
            .css({
                'z-index': '400',
                'display': 'flex',
                'justify-content': 'space-between',
                'position': 'absolute',
                'top': '0px',
                'pointer-events': 'none',
                'width': '100%',
                'height': this.topSize + 'px',
                'left': '0px',
                'background': 'transparent',
                'font-family': 'sans-serif',
                'font-size': '24px',
                'padding': '5px'
            })
        this.mapScreen.append(this.mapTopBar)

        //The map slider
        this.mapSplit = $('<div>')
            .attr('class', 'splitterV')
            .attr('id', 'mapSplit')
        this.vmgScreen.append(this.mapSplit)
        /*
            .css('width', this.splitterSizeHidden + 'px')
            .css('height', this.mainHeight + 'px')
            .css('left', this.pxIsViewer - this.splitterSizeHidden / 2 + 'px')
            */

        this.mapSplitInner = $('<div>')
            .attr('class', 'splitterVInner')
            .attr('id', 'mapSplitInner')
        this.mapSplit.append(this.mapSplitInner)
        //.css('width', this.splitterSizeHidden * 2 + 'px')

        /*
        const mapSplitInnerLeftDiv = $('<div>')
            .css({
                'background': 'var(--color-a)',
                'width': '30px',
                'height': '30px',
                'position': 'absolute',
                'left': '-19px',
                'z-index': '-1'
            })
        this.mapSplitInner.append(mapSplitInnerLeftDiv)

        const mapSplitInnerLeftIcon = $('<i>')
            .css({
                'transition': 'all 0.2s ease-in',
                'position': 'absolute',
                'left': '-28px'
            })
            .attr('id', 'mapSplitInnerLeft')
            .attr('tabindex', 500)
            .attr('class', 'mdi mdi-chevron-double-left mdi-24px')
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
        this.mapSplitInner.append(mapSplitInnerLeftIcon)
        */
        /*
        const mapSplitInnerRightDiv = $('<div>')
            .css({
                'background': 'var(--color-a)',
                'width': '30px',
                'height': '30px',
                'position': 'absolute',
                'left': '23px',
                'z-index': '-1'
            })
        this.mapSplitInner.append(mapSplitInnerRightDiv)

        const mapSplitInnerRightIcon = $('<i>')
            .css({
                'transition': 'all 0.2s ease-in',
                'position': 'absolute',
                'right': '-29px'
            })
            .attr('id', 'mapSplitInnerRight')
            .attr('tabindex', 501)
            .attr('class', 'mdi mdi-chevron-double-right mdi-24px')
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
        this.mapSplitInner.append(mapSplitInnerRightIcon)
        */

        const mapSplitInnerViewerInfo = $('<div>')
            .attr('id', 'mapSplitInnerViewerInfo')
            .html('Viewer')
        this.mapSplitInner.append(mapSplitInnerViewerInfo)

        //The globe screen
        this.globeScreen = $('<div>')
            .attr('id', 'globeScreen')
            .css({
                'position': 'absolute',
                'width': this.pxIsGlobe + 'px',
                'height': this.mainHeight + 'px',
                'top': '0px',
                'overflow': 'hidden',
                'left': this.pxIsViewer + this.pxIsMap + 'px',
                'z-index': '401'
            })
        this.vmgScreen.append(this.globeScreen)

        const globeDiv = $('<div>')
            .attr('id', 'globe')
            .css({
                'position': 'absolute',
                'background-color': 'var(--color-a1)',
                'width': '100%',
                'height': '100%'
            })
        this.globeScreen.append(globeDiv)

        this.globeToolBar = $('<div>')
            .attr('id', 'globeToolBar')
            .css({
                'position': 'absolute',
                'top': `40px`,
                'width': '100%',
                'padding-right': this.fullSizeViews ? '70px' : '0px',
                'height': '40px',
                'pointer-events': 'none',
                'z-index': '5'
            })
        this.globeScreen.append(this.globeToolBar)

        //The globe slider
        this.globeSplit = $('<div>')
            .attr('class', 'splitterV')
            .attr('id', 'globeSplit')
        this.vmgScreen.append(this.globeSplit)
        /*
            .css('width', this.splitterSizeHidden + 'px')
            .css('height', this.mainHeight + 'px')
            .css(
                'left',
                this.pxIsViewer +
                    this.pxIsMap -
                    this.splitterSizeHidden / 2 +
                    'px'
            )
        */
        /*
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
        */

        /*
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
        */
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
        this.tScreen = $('<div>').attr('id', 'tScreen')
        this.splitscreens.append(this.tScreen)

        var bodyRGB = $('body').css('background-color')
        bodyRGB = 'rgb(15,17,17)'
        var bodyHEX = F_.rgb2hex(bodyRGB)
        bodyRGB = F_.rgbToArray(bodyRGB)
        var c = 'rgba(' + bodyRGB[0] + ',' + bodyRGB[1] + ',' + bodyRGB[2]
        var c = 'rgba(0,0,0'

        //The tools screen
        this.toolsScreen = $('<div>')
            .attr('id', 'toolsWrapper')
            .css({
                'height': this.pxIsTools + 'px',
                'width': '0%',
                'margin': '0',
                'background': c + ', 1)',
                //'background': 'linear-gradient( 45deg, rgba(0,0,0,0.8), rgba(0,0,0,0.53)',
                //'background': 'var(--color-a)',
                'background': 'var(--color-a)',
                //'box-shadow': '2px 5px 4px 0px rgba(0, 0, 0, 0.3)',
                'left': '-' + this.splitterSize + 'px',
                'bottom': this.topSize + 'px',
                'left': 0 + 'px',
                'bottom': '0px',
                //'border': '1px solid #26a8ff',
                'z-index': '1003'
            })
        this.tScreen.append(this.toolsScreen)

        const toolsDiv = $('<div>')
            .attr('id', 'tools')
            .css({
                'position': 'absolute',
                'top': '0px',
                'height': '100%',
                'padding-bottom': '0px',
                'width': '100%'
            })
        this.toolsScreen.append(toolsDiv)
        //The tools slider
        this.toolsSplit = $('<div>')
            .attr('class', 'splitterH')
            .attr('id', 'toolsSplit')
            .css({
                'height': this.splitterSize / 2 + 'px',
                'left': 0 + 'px',
                'bottom': this.pxIsTools - this.splitterSize / 2 + 'px',
                'z-index': '3'
            })
        this.toolsScreen.append(this.toolsSplit)

        //The toolbar
        this.toolbar = $('<div>')
            .attr('id', 'toolbar')
            .css({
                'box-shadow': '0px -3px 3px 0px rgba(0, 0, 0, 0.3)',
                'height': this.topSize + 'px',
                'padding-top': '0px', // 40px
                'background': 'var(--color-a)',
                'border-bottom': '2px solid black',
                'bottom': '0px',
                'width': '100%',
                'z-index': '1004'
            })
        $('#main-container').append(this.toolbar)

        this.toolbarLogo = $('<div>')
            .attr('id', 'mmgislogo')
            .css({
                'display': this.topSize == 0 ? 'inherit' : 'none',
                'padding': '9px 6px',
                'cursor': 'pointer',
                'width': '40px',
                'height': '40px',
                'position': 'absolute',
                'top': '0px',
                'left': '0px',
                'z-index': '2005',
                'image-rendering': 'pixelated'
            })
            .html(
                `<svg width="27" height="27" viewBox="0 0 231 137" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.222266 9.21339C-0.277832 14.7126 0.222266 133.713 0.222266 133.713H26.2223V45.7134C26.2223 45.7134 100.722 127.712 106.222 132.713C109.171 135.395 112.12 136.782 115.222 136.645C118.325 136.782 121.274 135.395 124.222 132.713C129.722 127.712 204.222 45.7134 204.222 45.7134V133.713H230.222C230.222 133.713 230.722 14.7126 230.222 9.21339C229.722 3.71413 218.222 -3.28766 210.222 1.71339C202.222 6.71444 115.222 104.713 115.222 104.713C115.222 104.713 28.2224 6.71444 20.2223 1.71339C12.2222 -3.28766 0.722363 3.71413 0.222266 9.21339Z" fill="#08AEEA"></path>
</svg>`
            )
            .on('click', function () {
                const currentDisplay = $('#landingMissionsWrapper').css('display')
                $('#landingMissionsWrapper').css(
                    'display',
                    currentDisplay === 'none' ? 'block' : 'none'
                )
            })
        $('#main-container').append(this.toolbarLogo)

        this.dataLoadingSpinner = $('<div>')
            .attr('id', 'dataLoadingSpinner')
            .css({
                'opacity': 0,
                'transition': 'opacity 0.3s ease-in-out',
                'pointer-events': 'none',
                'width': '40px',
                'height': '40px',
                'background': 'var(--color-a)',
                'position': 'absolute',
                'top': '0px',
                'left': '0px',
                'z-index': '2005'
            })
        $('#main-container').append(this.dataLoadingSpinner)
        this.dataLoadingSpinner
            .append($('<div>')
                .attr('class', 'mmgis-spinner2')
                .css({
                    'position': 'absolute',
                    'top': '6px',
                    'left': '6px'
                })
            )

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

        // Due to the order in which things are are initialized, just remove
        // the coordinates div and then redraw it as a "tool"
        $('#CoordinatesDiv').remove()
    },
    resize: function () {
        windowresize()
    },
    hide: function () {
        $('#main-container').css('opacity', '0')
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
        UserInterface.toolPanel.empty()
        UserInterface.toolPanel.css('width', width + 'px')
        UserInterface.toolPanelDrag.css('left', width + 10 + 'px')
        /*
        UserInterface.splitscreens.css(
            'width',
            'calc(100% - ' + (width + 40) + 'px)'
        )
        */

        $('#topBar').css({
            'padding-left': '0px',
            'margin-left': `${width + 40}px`,
            width: `calc(100% - ${width + 40}px)`,
        })
        UserInterface.splitscreens.css('left', width + 40 + 'px')
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
        UserInterface.toolPanel.css('width', width + 'px')
        UserInterface.toolPanelDrag.css('left', width + 10 + 'px')
        /*
        UserInterface.splitscreens.css(
            'width',
            'calc(100% - ' + (width + 40) + 'px)'
        )
        */
        $('#topBar').css({
            'padding-left': '0px',
            'margin-left': `${width + 40}px`,
            width: `calc(100% - ${width + 40}px)`,
        })
        UserInterface.splitscreens.css('left', width + 40 + 'px')
        UserInterface.mainWidth = $('#splitscreens').width()
        UserInterface.mainHeight = $('#splitscreens').height()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
    },
    closeToolPanel: function () {
        UserInterface.toolPanel.empty()
        UserInterface.toolPanel.css('width', '0')
        $('#topBar').css({
            'padding-left': '40px',
            'margin-left': '0px',
            width: '100%',
        })
        //UserInterface.toolPanel.css( 'border-left', '1px solid rgb(38, 168, 255)' );
        UserInterface.toolbar.css('box-shadow', 'none')
        //UserInterface.splitscreens.css('width', 'calc(100% - ' + 40 + 'px)')
        //UserInterface.splitscreens.css('left', 40 + 'px')
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
        // Scalebar and compass are now at top, don't adjust their position
        $('#CoordinatesDiv').css({
            bottom: UserInterface.pxIsTools + 'px',
        })
        $('#timeUI').css({
            bottom: UserInterface.pxIsTools + 'px',
        })
        $('#toolbar').css({
            bottom: UserInterface.pxIsTools + 'px',
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

        // Set height of the map
        UserInterface.mapScreen.css(
            'height',
            UserInterface.mainHeight - pxHeight + 'px'
        )

        UserInterface.mapSplit.css(
            'height',
            UserInterface.mainHeight - pxHeight + 'px'
        )

        resize()
    },
    setToolWidth(newWidth, alignment) {
        const toolbarWidth = $('#toolbar').width()
        let newTopWidth = toolbarWidth

        if (newWidth == 'full') {
            //newWidth = `calc(100vw - ${$('#toolbar').width()}px)`
            // FIXME Figure out how the above was calculated
            newWidth = '100%'
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
        UserInterface.viewerScreen.css(
            'width',
            UserInterface.pxIsViewer + 'px'
        )
        //The map screen
        UserInterface.mapScreen
            .css(
                'width',
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
            )
            .css(
                'left',
                UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
            )
        //The map slider
        UserInterface.mapSplit.css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        //The globe screen
        UserInterface.globeScreen
            .css('width', UserInterface.pxIsGlobe + 'px')
            .css(
                'left',
                UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
            )
        //The globe slider
        UserInterface.globeSplit.css(
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
            this.toolbarLogo.css('display', 'inherit')
            this.toolbar.css('bottom', '0px')
            this.toolbar.css('height', this.topSize + 'px')
            this.toolbar.css('padding-top', '0px') // 40px
            this.toolPanel.css('top', '0px')
            this.toolPanel.css('height', '100%')
            this.splitscreens.css('top', '0px')
            this.splitscreens.css('height', '100%')
        }
    },
    fullHide(is) {
        if (is) {
            UserInterface.topBar.css('display', 'none')
            UserInterface.mapSplit.css('display', 'none')
            UserInterface.globeSplit.css('display', 'none')
            UserInterface.toolbar.css('display', 'none')
            UserInterface.toolsScreen.css('display', 'none')
            $('.mouseLngLat').css('display', 'none')
        } else {
            UserInterface.topBar.css('display', 'flex')
            UserInterface.mapSplit.css('display', 'flex')
            UserInterface.globeSplit.css('display', 'flex')
            UserInterface.toolbar.css('display', 'inherit')
            UserInterface.toolsScreen.css('display', 'inherit')
            $('.mouseLngLat').css('display', 'flex')
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

        // Apply configured default panel widths (if present)
        if (l_.configData.panels && l_.configData.panels.defaultWidths) {
            const dw = l_.configData.panels.defaultWidths
            const viewer = dw.viewer != null ? dw.viewer : 0
            const map = dw.map != null ? dw.map : 100
            const globe = dw.globe != null ? dw.globe : 0

            // Validate sum equals 100 before applying
            if (viewer + map + globe === 100) {
                UserInterface.setPanelPercents(viewer, map, globe)
            } else {
                console.warn(
                    `Panel default widths (${viewer}%, ${map}%, ${globe}%) do not sum to 100. ` +
                    `Using system defaults.`
                )
            }
        }

        // Deeplinks override config defaults
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

        // Position mapToolBar at top under topbar (contains scalebar)
        $('#mapToolBar').css({
            top: 48 + 'px',
            bottom: 'auto',
        })
        // Position compass at bottom
        $('#mmgis-map-compass').css({
            bottom: 60 + 'px',
        })

        // Remove the cursor info
        $('#cursorInfo').remove()

        // Remove toolbar elements that aren't mobile features
        ToolController_.tools
            .map((i) => i.name)
            .forEach((tool) => {
                if (!mobileTools.includes(tool)) {
                    $('#toolButton' + tool).remove()
                }
            })

        // Add the elements for mission switching
        let missionsDiv = $('<div>')
            .attr('id', 'landingMissionsWrapper')
            .css({
                'top': '40px',
                'left': '40px',
                'background': 'var(--color-a)',
                'opacity': '0.8',
                'position': 'absolute',
                'display': 'none',
                'z-index': '1005'
            })
        $('#main-container').append(missionsDiv)

        var missionsUl = $('<ul>')
            .css({
                'margin': '0',
                'padding': '10px',
                'max-height': '50vh',
                'max-width': '50vw',
                'overflow-y': 'auto',
                'padding-right': '20px'
            })
        missionsDiv.append(missionsUl)

        let missions = L_.missionsList
        for (let m in missions) {
            const missionLi = $('<li>')
                .attr('class', 'landingPageMission')
                .html(missions[m])
                .on('click', function () {
                    var missionName = $(this).html()
                    $('#main-container').animate(
                        {
                            opacity: 0,
                        },
                        1000,
                        function () {
                            const url = `${
                                mmgisglobal.NODE_ENV === 'development'
                                    ? 'http://localhost:8889'
                                    : `${window.location.origin}${(
                                          window.location.pathname || ''
                                      ).replace(/\/$/g, '')}`
                            }/?mission=${missionName}`

                            window.location.replace(url)
                        }
                    )
                })
            missionsUl.append(missionLi)
        }

        // Throw the TimeUI div away and create it on demand later
        $('#timeUI').remove()

        // Zoom in if needed
        if ('mapZoomMobileInit' in window.L_.configData.msv) {
            const zoom = L_.configData.msv.mapZoomMobileInit || L_.Map_.map.getZoom()
            Map_.map.setZoom(zoom)
        }

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
        UserInterface.viewerScreen.css(
            'width',
            UserInterface.pxIsViewer + 'px'
        )
        //The map screen
        UserInterface.mapScreen
            .css(
                'width',
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
            )
            .css(
                'left',
                UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
            )
        //The map slider
        UserInterface.mapSplit.css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        //The globe screen
        UserInterface.globeScreen
            .css('width', UserInterface.pxIsGlobe + 'px')
            .css(
                'left',
                UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
            )
        //The globe slider
        UserInterface.globeSplit.css(
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
        UserInterface.viewerScreen.css(
            'width',
            UserInterface.pxIsViewer + 'px'
        )

        //The map screen
        UserInterface.mapScreen
            .css(
                'width',
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
            )
            .css(
                'left',
                UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
            )
        //The map slider
        UserInterface.mapSplit.css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        //The globe screen
        UserInterface.globeScreen
            .css('width', UserInterface.pxIsGlobe + 'px')
            .css(
                'left',
                UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px'
            )
        //The globe slider
        UserInterface.globeSplit.css(
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
        UserInterface.viewerSplit.css(
            'height',
            UserInterface.mainHeight -
                UserInterface.pxIsTools -
                UserInterface.topSize +
                'px'
        )

        //The map slider
        UserInterface.mapSplit.css(
            'height',
            UserInterface.mainHeight -
                UserInterface.pxIsTools -
                UserInterface.topSize +
                'px'
        )

        //The globe slider
        UserInterface.globeSplit.css(
            'height',
            UserInterface.mainHeight -
                UserInterface.pxIsTools -
                UserInterface.topSize +
                'px'
        )

        //The tools screen
        UserInterface.toolsScreen.css(
            'height',
            UserInterface.pxIsTools + 'px'
        )
        //The tools slider
        UserInterface.toolsSplit.css(
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
        .css('width', UserInterface.pxIsViewer + 'px')
        .css('height', UserInterface.mainHeight + 'px')
    //The viewer slider
    UserInterface.viewerSplit.css('height', UserInterface.mainHeight + 'px')

    //The map screen
    UserInterface.mapScreen
        .css(
            'width',
            UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px'
        )
        .css('height', UserInterface.mainHeight + 'px')
        .css(
            'left',
            UserInterface.pxIsViewer + UserInterface.splitterSize + 'px'
        )
    //The map slider
    UserInterface.mapSplit
        .css('height', UserInterface.mainHeight + 'px')
        .css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

    //The globe screen
    UserInterface.globeScreen
        .css('width', UserInterface.pxIsGlobe + 'px')
        .css('height', UserInterface.mainHeight + 'px')
        .css('left', UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px')
    //The globe slider
    UserInterface.globeSplit
        .css('height', UserInterface.mainHeight + 'px')
        .css(
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
        $('#viewerSplit').empty()
        $('#viewerSplit').css('width', 0)
        $('#mapSplit div:not(#mapSplitText)').remove()
        $('#mapSplit')
            .css('cursor', 'default')
            .css('box-shadow', 'none')
        $('#globeSplit').off('mousedown', globeSplitOnMouseDown)
        $('#globeSplit').off('touchstart', globeSplitOnMouseDown)
        $('#globeSplit').empty()
        $('#globeSplit')
            .css('width', '0')
            .css('cursor', 'default')
            .css('box-shadow', 'none')
        $('#mapSplit').empty()
        $('#mapSplit').css('width', '0')
        $('#mapScreen').css('top', '0')
        UserInterface.splitterSize = 0
    } else if (!hasViewer) {
        $('#mapSplit').off('mousedown', mapSplitOnMouseDown)
        $('#mapSplit').off('touchstart', mapSplitOnMouseDown)
        $('#viewerSplit').empty()
        $('#viewerSplit').css('width', 0)
        $('#mapSplit div:not(#mapSplitText)').remove()
        $('#mapSplit')
            .css('cursor', 'default')
            .css('box-shadow', 'none')
    } else if (!hasGlobe) {
        $('#globeSplit').off('mousedown', globeSplitOnMouseDown)
        $('#globeSplit').off('touchstart', globeSplitOnMouseDown)
        $('#globeSplit').empty()
        $('#globeSplit')
            .css('width', '0')
            .css('cursor', 'default')
            .css('box-shadow', 'none')
    }
    windowresize()
    Map_.map.invalidateSize()
}

$(document).ready(function () {
    UserInterface.init()
})

export default UserInterface
