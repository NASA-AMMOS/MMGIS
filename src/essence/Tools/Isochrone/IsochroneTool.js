import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Ancillary/CursorInfo'

import IsochroneManager from './IsochroneTool_Manager'
import models from './models'

import './IsochroneTool.css'
const L = window.L

/*
Handles map events, sidebar management, drawing layers and markers.
Individual isochrones, from data gathering to modeling to analysis,
are handled in IsochroneTool_Manager and its imports.
*/

const markup = `<div id="isochroneTool">
    <div id="isochroneToolHeader">
        <span id="isochroneToolTitle">Isochrone</span>
        <span id="iscNew">
            New
            <i class="mdi mdi-plus mdi-18px"></i>
        </span>
    </div>
    <ul id="isochroneOptionsContainer"></ul>
</div>`

//Legacy color mapping function
function hueMap(val) {
    const hueToChannel = (h) => {
        h = (h + 1530) % 1530
        if (h < 255) return h
        if (h < 765) return 255
        if (h < 1020) return 255 - (h % 255)
        return 0
    }
    const hue = Math.floor(val * 1050)
    const r = hueToChannel(hue + 510)
    const g = hueToChannel(hue)
    const b = hueToChannel(hue - 510)
    return [r, g, b]
}

//https://leafletjs.com/reference-1.7.1.html#gridlayer
L.IsochroneLayer = L.GridLayer.extend({
    //Override to make layer accept Bounds in place of LatLngBounds
    //  (cleaner, supports polar projections better)
    _isValidTile(coords) {
        const bounds = this.options.bounds
        return (
            coords.x >= bounds.min.x &&
            coords.y >= bounds.min.y &&
            coords.x < bounds.max.x &&
            coords.y < bounds.max.y
        )
    },
    createTile: function (coords) {
        const tile = L.DomUtil.create('canvas', 'leaflet-tile')

        const size = this.getTileSize()
        tile.width = size.x
        tile.height = size.y

        const ctx = tile.getContext('2d')
        const img = ctx.getImageData(0, 0, size.x, size.y)

        const bounds = this.options.bounds
        const tXOffset = coords.x - bounds.min.x
        const tYOffset = coords.y - bounds.min.y

        const alpha = Math.floor(this.options.opacity * 255)

        let di = 0 //img data index
        for (let y = 0; y < size.y; y++) {
            const yIndex = tYOffset * size.y + y
            for (let x = 0; x < size.x; x++) {
                const xIndex = tXOffset * size.x + x
                const currentData = this.options.data[yIndex][xIndex]
                if (
                    isFinite(currentData) &&
                    currentData <= this.options.maxCost
                ) {
                    const color = IsochroneTool.valueToColor(
                        currentData / this.options.maxCost,
                        this.options.color,
                        this.options.steps
                    )
                    img.data[di] = color[0]
                    img.data[di + 1] = color[1]
                    img.data[di + 2] = color[2]
                    img.data[di + 3] = alpha
                } else {
                    img.data[di] = 0
                    img.data[di + 1] = 0
                    img.data[di + 2] = 0
                    img.data[di + 3] = 0
                }
                di += 4
            }
        }

        ctx.putImageData(img, 0, 0)
        return tile
    },
})

//See IsochroneTool_Algorithm.js
const backlinkToMove = [
    [0, 1],
    [1, 2],
    [1, 1],
    [2, 1],
    [1, 0],
    [2, -1],
    [1, -1],
    [1, -2],
    [0, -1],
    [-1, -2],
    [-1, -1],
    [-2, -1],
    [-1, 0],
    [-2, 1],
    [-1, 1],
    [-1, 2],
]

const IsochroneTool = {
    height: 0,
    width: 250,
    MMGISInterface: null,
    vars: null,

    dataSources: {},
    enabledModels: [],
    containerEl: null,

    managers: [],
    activeManager: null,
    managerCounter: 0,

    hovered: false,
    lastHoverCall: 0,
    hoverPolyline: null,

    //https://developers.arcgis.com/javascript/latest/visualization/symbols-color-ramps/esri-color-ramps/
    colorRamps: [
        [
            //Red 5
            [254, 229, 217],
            [252, 187, 161],
            [252, 106, 74],
            [222, 45, 38],
            [165, 15, 21],
        ],
        [
            //Orange 4
            [255, 255, 178],
            [254, 204, 92],
            [253, 141, 60],
            [240, 59, 32],
            [189, 0, 38],
        ],
        [
            //Green 1
            [237, 248, 233],
            [186, 228, 179],
            [116, 196, 118],
            [49, 163, 84],
            [0, 109, 44],
        ],
        [
            //Blue 4
            [240, 249, 232],
            [186, 228, 188],
            [123, 204, 196],
            [67, 162, 202],
            [8, 104, 172],
        ],
        [
            //Purple 4
            [237, 248, 251],
            [179, 205, 227],
            [140, 150, 198],
            [136, 86, 167],
            [129, 15, 124],
        ],
    ],

    initialize: function () {
        this.vars = L_.getToolVars('isochrone')
        const globalIS = this.vars.interpolateSeams !== false

        //add info for scaling low-res tiles
        for (const dataType in this.vars.data) {
            const lcDataType = dataType.toLowerCase()
            this.dataSources[lcDataType] = []
            for (const src of this.vars.data[dataType]) {
                const { name, tileurl, minZoom, maxNativeZoom, resolution } =
                    src

                const sourceIS = src.interpolateSeams
                const interpolateSeams =
                    sourceIS === undefined ? globalIS : sourceIS

                let zoomOffset = null
                switch (resolution) {
                    case 256:
                        zoomOffset = 0
                        break
                    case 128:
                        zoomOffset = 1
                        break
                    case 64:
                        zoomOffset = 2
                        break
                    case 32:
                        zoomOffset = 3
                        break
                    case undefined:
                        console.warn(
                            `IsochroneTool: ${dataType} source "${name}" has no defined resolution!`
                        )
                        break
                    default:
                        console.warn(
                            `IsochroneTool: ${dataType} source "${name}" has nonstandard resolution: ${resolution}!`
                        )
                }

                const minResolution = Math.max(minZoom - zoomOffset, 0)
                const maxResolution = maxNativeZoom - zoomOffset

                if (zoomOffset !== null) {
                    //Data source interface
                    this.dataSources[lcDataType].push({
                        name, //string
                        tileurl, //string
                        minZoom, //number
                        maxNativeZoom, //number
                        resolution, //number
                        minResolution, //number
                        maxResolution, //number
                        zoomOffset, //number
                        interpolateSeams, //boolean
                    })
                }
            }
        }

        if (this.vars.models) {
            const lcModelNames = this.vars.models.map((m) => m.toLowerCase())
            const modelIndex = (m) =>
                lcModelNames.indexOf(m.nameString.toLowerCase())
            this.enabledModels = models.filter((m) => modelIndex(m) > -1)
            this.enabledModels.sort((a, b) => modelIndex(a) - modelIndex(b))
        } else {
            this.enabledModels = models.filter((m) => m.enabledByDefault)
        }
    },

    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()

        $('#iscNew').on('click', () => this.addIsochrone())
        this.containerEl = $('#isochroneOptionsContainer')
        this.addIsochrone()
    },

    destroy: function () {
        for (const { marker, layerName } of this.managers) {
            Map_.rmNotNull(marker)
            Map_.rmNotNull(L_.layers.layer[layerName])
        }

        if (this.hoverPolyline !== null) {
            this.hoverPolyline.remove(Map_.map)
        }

        this.managers = []
        this.activeManager = null
        this.managerCounter = 0
        this.MMGISInterface.separateFromMMGIS()
    },

    /**
     * Applies a color ramp to a value, using one of the ramps from `IsochroneTool.colorRamps`
     * @param {number} val Value to convert, between 0 and 1
     * @param {number} rampIndex Index of color ramp to use
     * @param {number} steps Optional number of discrete color steps to apply to the ramp
     * @returns {number[]} Array `[r, g, b]` of color channels
     */
    valueToColor: function (val, rampIndex, steps = 0) {
        val = Math.min(val, 1)
        if (steps) {
            val = Math.floor(val * steps) / steps
        }

        const ramp = this.colorRamps[rampIndex]
        const color = val * (ramp.length - 1)
        const i = Math.min(Math.floor(color), ramp.length - 2)
        const off = color % 1
        const getChan = (chan) =>
            Math.floor(ramp[i][chan] * (1 - off) + ramp[i + 1][chan] * off)
        return [getChan(0), getChan(1), getChan(2)]
    },

    /** Create canvases for use in color ramp dropdown */
    makeGradientEls: function () {
        const C_WIDTH = 120,
            C_HEIGHT = 25
        const numRamps = this.colorRamps.length
        let colorEls = []
        for (let i = 0; i < numRamps; i++) {
            let canvas = document.createElement('canvas')
            canvas.width = C_WIDTH
            canvas.height = C_HEIGHT
            let ctx = canvas.getContext('2d')
            let image = ctx.getImageData(0, 0, C_WIDTH, C_HEIGHT)
            let data = image.data
            for (let x = 0; x < C_WIDTH; x++) {
                const color = this.valueToColor(x / C_WIDTH, i)
                for (let y = 0; y < C_HEIGHT; y++) {
                    const di = y * C_WIDTH * 4 + x * 4
                    data[di] = color[0]
                    data[di + 1] = color[1]
                    data[di + 2] = color[2]
                    data[di + 3] = 255
                }
            }
            ctx.putImageData(image, 0, 0)
            colorEls.push(canvas)
        }
        return colorEls
    },

    managerOnChange: function (manager) {
        this.makeMarker(manager)
        manager.marker.dragging.enable()
        this.makeDataLayer(manager)
    },
    managerOnFocus: function (manager) {
        if (this.activeManager === manager) return
        if (this.activeManager !== null) {
            this.activeManager.unfocus()
        }
        this.activeManager = manager
        this.activeManager.focus()
    },
    managerOnDelete: function (manager) {
        manager.optionEls.root.remove()
        Map_.rmNotNull(L_.layers.layer[manager.layerName])
        Map_.rmNotNull(manager.marker)

        const managerIndex = this.managers.indexOf(manager)
        this.managers.splice(managerIndex, 1)
        if (this.activeManager === manager) {
            if (this.managers.length === 0) {
                this.activeManager = null
            } else {
                const newIndex = Math.min(
                    managerIndex,
                    this.managers.length - 1
                )
                this.activeManager = this.managers[newIndex]
                this.activeManager.focus()
            }
        }
    },

    addIsochrone: function () {
        const newManager = new IsochroneManager(
            this.managerCounter + 1,
            this.dataSources,
            this.enabledModels,
            { color: this.managerCounter % this.colorRamps.length }
        )
        this.managerCounter++

        newManager.onChange = () => this.managerOnChange(newManager)
        newManager.onFocus = () => this.managerOnFocus(newManager)
        newManager.onDelete = () => this.managerOnDelete(newManager)

        this.managers.push(newManager)

        const optionsEl = newManager.makeElement(this.makeGradientEls())
        this.containerEl.append(optionsEl)
        this.managerOnFocus(newManager)

        return newManager
    },

    /** Create an isochrone data layer for a given isochrone manager */
    makeDataLayer: function (manager) {
        const { layerName, cost, tileBounds, options } = manager

        Map_.rmNotNull(L_.layers.layer[layerName])

        if (!manager.options.visible) return

        L_.layers.layer[layerName] = new L.IsochroneLayer({
            className: 'nofade', //Borrowed from viewshed... but is it actually doing anything?
            minZoom: Math.min(options.resolution, Map_.map.getMinZoom()),
            maxZoom: Map_.map.getMaxZoom(),
            minNativeZoom: options.resolution,
            maxNativeZoom: options.resolution,
            bounds: tileBounds,
            tileSize: 256,
            opacity: options.opacity,
            color: options.color,
            maxCost: options.maxCost,
            steps: options.steps,
            data: cost,
        })

        L_.layers.layer[layerName].setZIndex(1000)
        Map_.map.addLayer(L_.layers.layer[layerName])
    },

    /** Create a start point marker for a given isochrone manager */
    makeMarker: function (manager) {
        //ViewshedTool.js, function viewshed
        const { start, options } = manager
        let canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        let ctx = canvas.getContext('2d')

        const radius = 7
        const strokeWeight = 2
        const ramp = IsochroneTool.colorRamps[options.color]
        const c = ramp[ramp.length - 1]

        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 255)`

        ctx.strokeStyle = 'rgba(255, 255, 255, 255)'
        ctx.beginPath()
        ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, 2 * Math.PI)

        ctx.fill()
        ctx.lineWidth = strokeWeight
        ctx.stroke()
        ctx.strokeStyle = 'rgba(0, 0, 0, 255)'
        ctx.beginPath()
        ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            radius - strokeWeight,
            0,
            2 * Math.PI
        )

        ctx.fill()
        ctx.lineWidth = strokeWeight
        ctx.stroke()

        let isochroneIcon = L.icon({
            iconUrl: canvas.toDataURL(),
            iconSize: [canvas.width, canvas.height],
            iconAnchor: [canvas.width / 2, canvas.height / 2],
            popupAnchor: [-3, -76],
            shadowSize: [68, 95],
            shadowAnchor: [22, 94],
        })

        Map_.rmNotNull(manager.marker)
        manager.marker = new L.marker([start.lat, start.lng], {
            icon: isochroneIcon,
        })

        manager.marker.on('click', (e) => this.managerOnFocus(manager))
        manager.marker.on('dragend', (e) => {
            manager.marker.dragging.disable()
            manager.start = e.target._latlng
            manager.setBounds()
            this.managerOnFocus(manager)
        })

        manager.marker.addTo(Map_.map)
    },

    //Click event handler
    handleClick: function (e) {
        if (e && e.latlng && this.activeManager.currentStage < 4) {
            this.activeManager.start = e.latlng
            this.makeMarker(this.activeManager)
            this.activeManager.setBounds()
        }
    },

    //Mouse move event handler
    handleMouseMove: function (e) {
        const MAX_STEPS = 5000
        const manager = this.activeManager

        if (
            !e ||
            !manager ||
            !manager.backlink ||
            manager.currentStage > 0 ||
            !manager.options.visible
        ) {
            return
        }

        const now = Date.now()
        if (this.lastHoverCall + 65 > now) return
        this.lastHoverCall = now

        Map_.rmNotNull(this.hoverPolyline)

        const toLinePoint = (x, y) => {
            const point = manager.tileBounds.min
                .multiplyBy(256)
                .add([x + 0.5, y + 0.5])
            const latlng = Map_.map.unproject(point, manager.options.resolution)
            return [latlng.lat, latlng.lng]
        }

        let hoveredPx,
            width,
            height,
            startVal = 0
        if (e.latlng) {
            hoveredPx = Map_.map
                .project(e.latlng, manager.options.resolution)
                .subtract(manager.tileBounds.min.multiplyBy(256))
                .floor()
            width = manager.backlink[0].length
            height = manager.backlink.length
            if (
                hoveredPx.x >= 0 &&
                hoveredPx.y >= 0 &&
                hoveredPx.x < width &&
                hoveredPx.y < height
            ) {
                startVal = manager.backlink[hoveredPx.y][hoveredPx.x]
            }
        }

        if (startVal !== 0) {
            this.hovered = true
            const hoveredCost = manager.cost[hoveredPx.y][hoveredPx.x]
            const tooltipMsg = manager.modelProto.costToString(hoveredCost)
            CursorInfo.update(tooltipMsg, null, false)

            let cx = hoveredPx.x
            let cy = hoveredPx.y
            let step = startVal
            let line = [toLinePoint(cx, cy)]
            let lastStep = 0
            let count = 0
            while (step !== 0 && count < MAX_STEPS) {
                let move = backlinkToMove[step - 1]
                cx += move[1]
                cy += move[0]
                if (step === lastStep) {
                    //Extend line
                    line[line.length - 1] = toLinePoint(cx, cy)
                } else {
                    //Begin new line
                    line.push(toLinePoint(cx, cy))
                }
                lastStep = step
                step = manager.backlink[cy][cx]
                count++
            }
            this.hoverPolyline = L.polyline(line, { interactive: false })
            this.hoverPolyline.addTo(Map_.map)
        } else if (this.hovered) {
            this.hovered = false
            CursorInfo.hide()
        }
    },

    //Mouse out event container
    handleMouseOut: function (e) {
        if (this.hovered) {
            this.hovered = false
            Map_.rmNotNull(this.hoverPolyline)
            CursorInfo.hide()
        }
    },
}

function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    const tools = $('#toolPanel')
    tools.empty()
    const toolContainer = $('<div></div>')
        .attr('class', 'center aligned ui padded grid')
        .css({ height: '100%' })
    tools.append(toolContainer)
    toolContainer.html(markup)

    const clickEventContainer = (e) => IsochroneTool.handleClick(e)
    Map_.map.on('click', clickEventContainer)

    const moveEventContainer = (e) => IsochroneTool.handleMouseMove(e)
    Map_.map.on('mousemove', moveEventContainer)

    const outEventContainer = (e) => IsochroneTool.handleMouseOut(e)
    Map_.map.on('mouseout', outEventContainer)

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {
        Map_.map.off('click', clickEventContainer)
        Map_.map.off('mousemove', moveEventContainer)
        Map_.map.off('mouseout', outEventContainer)
    }
}

export default IsochroneTool
