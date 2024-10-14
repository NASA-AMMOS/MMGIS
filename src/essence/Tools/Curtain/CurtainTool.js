import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import TC_ from '../../Basics/ToolController_/ToolController_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import CursorInfo from '../../Ancillary/CursorInfo'
import calls from '../../../pre/calls'

import ReactDOM from 'react-dom'
import React, { useState, useEffect, useRef } from 'react'

import './CurtainTool.css'

// Expose setStates externally
const state = {
    setActiveFeature: function () {},
    setActiveImages: function () {},
    setActiveImageId: function () {},
    setMouseCoords: function () {},
    setMouseCoordsVis: function () {},
    setKeepOnCheckbox: function () {},
    setActiveImageLoading: function () {},
}
const Curtain = () => {
    const [activeFeature, setActiveFeature] = useState([])
    const [activeImages, setActiveImages] = useState([])
    const [activeImageLoading, setActiveImageLoading] = useState(false)
    const [activeImageId, setActiveImageId] = useState(null)
    const [mouseCoords, setMouseCoords] = useState({})
    const [mouseCoordsVis, setMouseCoordsVis] = useState(false)
    const [verticalExag, setVerticalExag] = useState(1)
    const [verticalOffset, setVerticalOffset] = useState(100)
    const [keepOnCheckbox, setKeepOnCheckbox] = useState(false)

    useEffect(() => {
        // code to run on component mount
        state.setActiveFeature = setActiveFeature
        state.setActiveImages = setActiveImages
        state.setActiveImageId = setActiveImageId
        state.setMouseCoords = setMouseCoords
        state.setMouseCoordsVis = setMouseCoordsVis
        state.setKeepOnCheckbox = setKeepOnCheckbox
        state.setActiveImageLoading = setActiveImageLoading
    }, [])

    const activeImage = activeImages[activeImageId]

    return (
        <div className='CurtainTool'>
            <div id='curtainLeft'>
                <div id='curtainTop'>
                    <div id='curtainTitle'>Curtain</div>
                    <div id='curtainIcons'>
                        <div
                            id='curtainClear'
                            title='Clear Active Curtains'
                            onClick={() => {
                                CurtainTool.reset()
                            }}
                        >
                            <i className='mdi mdi-close mdi-18px'></i>
                        </div>
                        <div id='curtainKeepOn' title='Keep On in 3D'>
                            <div className='mmgis-checkbox'>
                                <input
                                    type='checkbox'
                                    checked={keepOnCheckbox}
                                    onChange={() => {
                                        CurtainTool.toggleKeepImageOn(
                                            !keepOnCheckbox
                                        )
                                    }}
                                    id='checkbox_curtainKeepOn'
                                />
                                <label htmlFor='checkbox_curtainKeepOn'></label>
                            </div>
                        </div>
                    </div>
                </div>
                {activeImage && (
                    <>
                        <div id='curtainUrl' title={activeImage.url}>
                            {F_.fileNameFromPath(activeImage.url)}
                        </div>

                        <div id='curtainStats'>
                            <div>
                                <div>Sol</div>
                                <div>{activeFeature?.properties?.sol}</div>
                            </div>
                            <div>
                                <div>RMC</div>
                                <div>{`${activeFeature?.properties?.fromRMC} → ${activeFeature?.properties?.toRMC}`}</div>
                            </div>
                            <div>
                                <div>Length</div>
                                <div>{`${activeImage.length}m`}</div>
                            </div>
                            <div>
                                <div>Depth</div>
                                <div>{`${activeImage.depth}m`}</div>
                            </div>
                            <div>
                                <div>Top Elevation</div>
                                <div>{`${activeImage.topElev}m`}</div>
                            </div>
                        </div>
                        <div id='curtainBottom'>
                            <div id='curtainMode'>
                                <div>Mode</div>
                                <select
                                    className='dropdown'
                                    defaultValue={activeImageId}
                                    onChange={(e) => {
                                        CurtainTool.changeImage(
                                            activeImages,
                                            e.target.value
                                        )
                                    }}
                                >
                                    {activeImages.map((img, idx) => (
                                        <option key={idx} value={idx}>
                                            {img.mode || idx}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div id='curtain3dExag'>
                                <div title='3D Vertical Exaggeration'>
                                    3D Vertical Exaggeration
                                </div>
                                <div className='flexbetween'>
                                    <div className='curtainSliderLabel'>
                                        ({verticalExag}x)
                                    </div>
                                    <input
                                        className='slider2 lighter'
                                        type='range'
                                        min='1'
                                        max='4'
                                        step='0.1'
                                        value={verticalExag}
                                        onChange={(e) => {
                                            CurtainTool.set3DVerticalOptions(
                                                e.target.value,
                                                verticalOffset
                                            )

                                            setVerticalExag(e.target.value)
                                        }}
                                    />
                                </div>
                            </div>
                            <div id='curtain3dOffset'>
                                <div title='3D Vertical Offset'>
                                    3D Vertical Offset
                                </div>
                                <div className='flexbetween'>
                                    <div className='curtainSliderLabel'>
                                        ({verticalOffset}%)
                                    </div>
                                    <input
                                        className='slider2 lighter'
                                        type='range'
                                        min='0'
                                        max='100'
                                        step='1'
                                        value={verticalOffset}
                                        onChange={(e) => {
                                            CurtainTool.set3DVerticalOptions(
                                                verticalExag,
                                                e.target.value
                                            )
                                            setVerticalOffset(e.target.value)
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div id='curtainMiddle'>
                <div id='curtainViewer' onMouseLeave={() => {}}></div>
                <div
                    id='curtainTooltip'
                    style={{
                        top:
                            (mouseCoords.alignment || 'bottom') === 'top'
                                ? '0'
                                : 'calc(100% - 26px)',
                        opacity: mouseCoordsVis ? '1' : '0',
                    }}
                >
                    {mouseCoords.text || ''}
                </div>
                <div
                    id='curtainMessage'
                    className={
                        activeImage == null
                            ? 'curtainMessageShown'
                            : 'curtainMessageHidden'
                    }
                >
                    <div>Select a valid line segment on the map to begin.</div>
                </div>
                <div
                    id='curtainLoading'
                    className={
                        activeImageLoading
                            ? 'curtainLoadingShown'
                            : 'curtainLoadingHidden'
                    }
                >
                    <div className='mmgisLoading'></div>
                </div>
            </div>
            <div id='curtainToolBar'>
                <div
                    id='curtainExpand'
                    title='Expand/Shrink'
                    onClick={() => {
                        if (CurtainTool.height === TC_.prevHeight)
                            TC_.setToolHeight(CurtainTool.height * 2.5)
                        else TC_.setToolHeight(CurtainTool.height)
                    }}
                >
                    <i className='mdi mdi-arrow-expand-vertical mdi-18px'></i>
                </div>
                <div id='curtainReset' title='Reset View'>
                    <i className='mdi mdi-restore mdi-18px'></i>
                </div>
                <div id='curtainZoomIn' title='Zoom In'>
                    <i className='mdi mdi-plus mdi-18px'></i>
                </div>
                <div id='curtainZoomOut' title='Zoom Out'>
                    <i className='mdi mdi-minus mdi-18px'></i>
                </div>
            </div>
        </div>
    )
}

let CurtainTool = {
    height: 196,
    width: 'full',
    vars: {},
    data: [],
    osd: null,
    activeImage: null,
    lastImageId: 0,
    currentMapLayer: null,
    focus: {
        canvas: null,
        scale: 2000,
        topCircle: null,
        cursorCircle: null,
        mapLayer: null,
    },
    options: {
        verticalExag: 1,
        verticalOffset: 100,
    },
    drawn3DCurtainIds: [],
    keptOnImages: {},
    init: function () {},
    make: function () {
        //Get tool variables
        this.vars = L_.getToolVars('curtain')

        ReactDOM.render(<Curtain />, document.getElementById('tools'))

        this.osd = OpenSeadragon({
            id: 'curtainViewer',
            //prefixUrl: 'scripts/external/OpenSeadragon/images/',
            defaultZoomLevel: 0.95,
            //showNavigationControl: false,
            showFullPageControl: false,
            zoomInButton: 'curtainZoomIn',
            zoomOutButton: 'curtainZoomOut',
            homeButton: 'curtainReset',
            showNavigator: false,
            constrainDuringPan: true,
            visibilityRatio: 1,
            animationTime: 0.5,
            minZoomLevel: 0.5,
            maxZoomLevel: 12,
            ajaxWithCredentials: true,
            //zoomPerClick: 1, //disables click to zoom for tools...
            imageSmoothingEnabled: false,
        })
    },
    destroy: function () {
        ReactDOM.unmountComponentAtNode(document.getElementById('tools'))
        CurtainTool.currentMapLayer = null
        L_.setActiveFeature()
    },
    reset() {
        // Reset viewer
        this.changeImage()

        state.setActiveImages([])
        state.setActiveImageId(null)

        // Clear all Globe curtains
        CurtainTool.drawn3DCurtainIds.forEach((id) => {
            if (Globe_.litho.hasLayer(id)) Globe_.litho.removeLayer(id)
        })
    },
    getCurrentImageDimensions: function () {
        return (
            CurtainTool.osd?.world?._items?.[0]?.source?.dimensions || {
                x: 0,
                y: 0,
            }
        )
    },
    changeImage: function (images, imageId, layerChanged) {
        // Clear existing
        const numImgs = CurtainTool.osd.world._items.length
        for (let i = 0; i < numImgs; i++) {
            const oldImg = CurtainTool.osd.world.getItemAt(i)
            if (oldImg) {
                CurtainTool.osd.world.removeItem(oldImg)
            }
        }

        // Change to no image
        if (images == null) {
            CurtainTool.removeKeptOffImages()
            CurtainTool.removeLastSameLayerImage()
            return
        }

        const img = images[imageId]
        CurtainTool.activeImage = img
        CurtainTool.activeImage._id = `CurtainTool_${CurtainTool.currentMapLayer?._leaflet_id}.${imageId}`
        const isKeptOn = CurtainTool.isKeptOn()
        CurtainTool.keptOnImages[CurtainTool.activeImage._id] = isKeptOn
        CurtainTool.lastImageId = imageId
        state.setActiveImages(images)
        state.setActiveImageId(CurtainTool.lastImageId)

        // Remove previous Globe curtain if any
        CurtainTool.removeKeptOffImages()
        CurtainTool.removeLastSameLayerImage()

        // Update keep on checkbox
        if (layerChanged) {
            state.setKeepOnCheckbox(isKeptOn)
        }

        // Add new
        if (img && img.url) {
            let url = img.url
            if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url

            state.setActiveImageLoading(true)

            this.osd.addSimpleImage({
                url: url,
                success: function () {
                    CurtainTool.attachFocus()
                    state.setActiveImageLoading(false)
                },
                error: function () {
                    CurtainTool.detachFocus(true)
                    state.setActiveImageLoading(false)
                },
            })

            // Add to globe
            CurtainTool.addCurtainToGlobe(img, url, CurtainTool.currentMapLayer)
        }

        CurtainTool.attachFocus()
    },
    notify: function (type, payload) {
        switch (type) {
            case 'setActiveFeature':
                this.onActiveFeatureChange(payload)
                break
            default:
                break
        }
    },
    onActiveFeatureChange(payload) {
        if (payload == null) {
            this.changeImage()
            return
        }
        // Look for radargram images
        CurtainTool.radargrams = []
        const oldFeatureId = CurtainTool.currentMapLayer?._leaflet_id
        CurtainTool.currentMapLayer = null
        const images = payload.feature?.properties?.images
        if (images && images.length > 0) {
            images.forEach((img) => {
                if (img.type && img.type.toLowerCase() === 'radargram') {
                    CurtainTool.radargrams.push(img)
                }
            })
        }

        let imageId = CurtainTool.lastImageId
        if (imageId > CurtainTool.radargrams.length) {
            imageId = 0
        }

        if (CurtainTool.radargrams.length === 0) this.changeImage()
        else {
            CurtainTool.currentMapLayer = payload.layer
            state.setActiveFeature(CurtainTool.currentMapLayer.feature)
            const layerChanged =
                oldFeatureId !== CurtainTool.currentMapLayer?._leaflet_id
            this.changeImage(CurtainTool.radargrams, imageId, layerChanged)
        }
    },
    toggleKeepImageOn: function (on) {
        const id = CurtainTool.activeImage?._id
        if (id == null) return

        const partialId = id.split('.')[0]

        // Always Disable Siblings
        for (let imgId in CurtainTool.keptOnImages) {
            const imgPartialId = imgId.split('.')[0]
            if (imgPartialId === partialId)
                if (CurtainTool.keptOnImages[imgId] === true) {
                    // false means we'll remove it later
                    CurtainTool.keptOnImages[imgId] = false
                }
        }

        CurtainTool.keptOnImages[id] = on

        state.setKeepOnCheckbox(on)
    },
    isKeptOn: function () {
        const id = CurtainTool.activeImage?._id
        if (id == null) return false

        const partialId = id.split('.')[0]

        for (let imgId in CurtainTool.keptOnImages) {
            const imgPartialId = imgId.split('.')[0]
            if (
                partialId === imgPartialId &&
                CurtainTool.keptOnImages[imgId] === true
            )
                return true
        }

        return false
    },
    removeLastSameLayerImage: function () {
        const currentId = CurtainTool.activeImage?._id
        if (currentId == null) return

        const partialId = currentId.split('.')[0]

        for (let imgId in CurtainTool.keptOnImages) {
            const imgPartialId = imgId.split('.')[0]
            if (partialId === imgPartialId && currentId !== imgId) {
                Globe_.litho.removeLayer(imgId)
                CurtainTool.drawn3DCurtainIds =
                    CurtainTool.drawn3DCurtainIds.filter((e) => e !== imgId)
                if (CurtainTool.keptOnImages[imgId] != null) {
                    delete CurtainTool.keptOnImages[imgId]
                }
            }
        }
    },
    removeKeptOffImages: function () {
        const currentId = CurtainTool.activeImage?._id
        if (currentId == null) return

        const partialId = currentId.split('.')[0]

        for (let imgId in CurtainTool.keptOnImages) {
            const imgPartialId = imgId.split('.')[0]
            if (
                partialId !== imgPartialId &&
                CurtainTool.keptOnImages[imgId] === false
            ) {
                Globe_.litho.removeLayer(imgId)
                CurtainTool.drawn3DCurtainIds =
                    CurtainTool.drawn3DCurtainIds.filter((e) => e !== imgId)
                delete CurtainTool.keptOnImages[imgId]
            }
        }
    },
    attachFocus: function () {
        CurtainTool.detachFocus(true)
        if (CurtainTool.activeImage == null) return
        const overlay = CurtainTool.osd.fabricjsOverlay({
            scale: CurtainTool.focus.scale,
        })
        CurtainTool.focus.canvas = overlay.fabricCanvas()
        CurtainTool.focus.canvas.selection = false
        CurtainTool.focus.canvas.hoverCursor = 'default'

        $('#curtainViewer').off('mouseout')
        $('#curtainViewer').on('mouseout', function () {
            // Clear focus
            CurtainTool.detachFocus(true)
            CurtainTool.enableMove = false
        })
        $('#curtainViewer').off('mouseenter')
        $('#curtainViewer').on('mouseenter', function () {
            CurtainTool.enableMove = true
        })

        CurtainTool.focus.canvas.on('mouse:move', CurtainTool.mouseMove)
    },
    detachFocus: function (clearCoordsToo) {
        if (CurtainTool.focus.topCircle)
            CurtainTool.focus.canvas.remove(CurtainTool.focus.topCircle)
        if (CurtainTool.focus.cursorCircle)
            CurtainTool.focus.canvas.remove(CurtainTool.focus.cursorCircle)
        Map_.rmNotNull(CurtainTool.focus.mapLayer)

        if (clearCoordsToo)
            // Clear coords
            state.setMouseCoordsVis(false)

        CurtainTool.detachFocusFromGlobe()
    },
    pxToLngLat: function (xy) {
        //Built initially only for MultiLineString
        if (CurtainTool.currentMapLayer) {
            //Get feature coordinates
            let g = CurtainTool.currentMapLayer.feature.geometry.coordinates[0]
            if (
                CurtainTool.currentMapLayer.feature.geometry.type ==
                'LineString'
            )
                g = CurtainTool.currentMapLayer.feature.geometry.coordinates
            //Get length data
            const lengthArray = [0]
            let totalLength = 0
            let i0 = 1
            let i1 = 0
            if (true) {
                i0 = 0
                i1 = 1
            }
            for (let i = 1; i < g.length; i++) {
                let l = F_.lngLatDistBetween(
                    g[i - 1][i0],
                    g[i - 1][i1],
                    g[i][i0],
                    g[i][i1]
                )
                totalLength += l
                lengthArray.push(totalLength)
            }

            //Find xy's place
            const place = (xy[0] / CurtainTool.focus.scale) * totalLength
            for (let i = 1; i < lengthArray.length; i++) {
                if (place <= lengthArray[i]) {
                    const p =
                        (place - lengthArray[i - 1]) /
                        (lengthArray[i] - lengthArray[i - 1])
                    return F_.interpolatePointsPerun(
                        { x: g[i - 1][0], y: g[i - 1][1], z: g[i - 1][2] },
                        { x: g[i][0], y: g[i][1], z: g[i][2] },
                        p
                    )
                }
            }
        }
    },
    mouseMove: function (o) {
        if (!CurtainTool.enableMove) return
        CurtainTool.detachFocus()

        const currentZoom = CurtainTool.osd.viewport.getZoom()
        let circleRadius = 8
        let divider = currentZoom || 1

        circleRadius /= divider

        let hasCursorCircle = false
        const dim = CurtainTool.getCurrentImageDimensions()
        const maxY = CurtainTool.focus.scale * (dim.y / dim.x)

        let pointer
        // if it's an openseadragon event
        if (o.e) {
            pointer = CurtainTool.focus.canvas.getPointer(o.e)
            pointer.x = Math.max(0, pointer.x)
            pointer.x = Math.min(CurtainTool.focus.scale, pointer.x)
            pointer.y = Math.max(0, pointer.y)
            pointer.y = Math.min(maxY, pointer.y)
        } else if (o.uv) {
            pointer = {
                x: o.uv.x * CurtainTool.focus.scale,
                y: (1 - o.uv.y) * maxY,
            }
            // Because this is a cursor link from 3D, we'll show a separate cursor
            hasCursorCircle = true
        }

        CurtainTool.focus.topCircle = new fabric.Circle({
            left: pointer.x,
            top: 0,
            radius: circleRadius,
            strokeWidth: 3 / divider,
            fill: 'yellow',
            opacity: 1,
            stroke: 'black',
            evented: false,
            originX: 'center',
            originY: 'center',
        })
        CurtainTool.focus.topCircle.lockMovementX = true
        CurtainTool.focus.topCircle.lockMovementY = true
        CurtainTool.focus.canvas.add(CurtainTool.focus.topCircle)

        if (hasCursorCircle) {
            CurtainTool.focus.cursorCircle = new fabric.Circle({
                left: pointer.x,
                top: pointer.y,
                radius: circleRadius,
                strokeWidth: 2 / divider,
                fill: 'transparent',
                stroke: 'black',
                evented: false,
                originX: 'center',
                originY: 'center',
            })
            CurtainTool.focus.cursorCircle.lockMovementX = true
            CurtainTool.focus.cursorCircle.lockMovementY = true
            CurtainTool.focus.canvas.add(CurtainTool.focus.cursorCircle)
        }

        // Update coords
        const distance = (
            (pointer.x / CurtainTool.focus.scale) *
            CurtainTool.activeImage.length
        ).toFixed(2)
        const depth = (
            (pointer.y / maxY) *
            CurtainTool.activeImage.depth
        ).toFixed(2)
        state.setMouseCoords({
            alignment:
                pointer.x / CurtainTool.focus.scale > 0.8 &&
                pointer.y / maxY > 0.5
                    ? 'top'
                    : 'bottom',
            text: `Distance: ${distance}m, Depth: ${depth}m, Elevation: ${(
                CurtainTool.activeImage.topElev - depth
            ).toFixed(2)}m`,
        })
        state.setMouseCoordsVis(true)

        // Update markers on map and globe
        const ll = CurtainTool.pxToLngLat([pointer.x, pointer.y])

        if (ll) {
            //Map
            const llM = [ll.y, ll.x]
            Map_.rmNotNull(CurtainTool.focus.mapLayer)
            CurtainTool.focus.mapLayer = new L.circleMarker(llM, {
                fillColor: 'yellow',
                fillOpacity: 1,
                color: 'black',
                weight: 2,
            })
                .setRadius(6)
                .addTo(Map_.map)

            // If mousing over in openseadragon
            if (o.e)
                CurtainTool.attachFocusToGlobe(
                    ll.y,
                    ll.x,
                    CurtainTool.activeImage.topElev,
                    depth
                )
        }
    },
    set3DVerticalOptions: function (verticalExag, verticalOffset) {
        CurtainTool.options.verticalExag = verticalExag
        CurtainTool.options.verticalOffset = verticalOffset
        CurtainTool.drawn3DCurtainIds.forEach((id) => {
            Globe_.litho.setLayerSpecificOptions(id, {
                verticalExaggeration: CurtainTool.options.verticalExag,
                verticalOffset:
                    (CurtainTool.options.verticalOffset / 100) *
                    CurtainTool.activeImage.depth *
                    (CurtainTool.options.verticalExag || 1),
            })
        })
    },
    addCurtainToGlobe: function (img, url, layer) {
        // First, format the feature so that topElev is consistent
        // Skip if bad geom
        if (
            layer?.feature?.geometry?.type !== 'LineString' ||
            layer?.feature?.geometry?.coordinates == null
        )
            return
        const coordinates = []
        layer.feature.geometry.coordinates.forEach((coord) => {
            const c = coord
            c[2] = img.topElev || c[2] || 0
            coordinates.push(c)
        })

        if (Globe_.litho.hasLayer(CurtainTool.activeImage._id)) return
        CurtainTool.drawn3DCurtainIds.push(CurtainTool.activeImage._id)

        Globe_.litho.addLayer(
            'curtain',
            {
                name: CurtainTool.activeImage._id,
                on: true,
                opacity: 1,
                withCredentials: CurtainTool.vars.withCredentials,
                imagePath: url,
                // depth of image in meters
                depth: img.depth,
                // length of image in meters
                length: img.length,
                // GeoJSON feature geometry that corresponds to the top of the curtain/image
                lineGeometry: {
                    type: 'LineString',
                    coordinates: coordinates,
                },
                options: {
                    verticalExaggeration: CurtainTool.options.verticalExag,
                    verticalOffset:
                        (CurtainTool.options.verticalOffset / 100) *
                        CurtainTool.activeImage.depth *
                        (CurtainTool.options.verticalExag || 1),
                },
                onMouseMove: function (
                    e,
                    layer,
                    mesh,
                    intersection,
                    intersectedLngLat,
                    intersectionXYZ
                ) {
                    if (layer.name === CurtainTool.activeImage._id) {
                        CurtainTool.enableMove = true
                        CurtainTool.mouseMove({
                            uv: intersection.uv,
                        })
                    } else {
                        CurtainTool.detachFocus()
                    }
                },
            },
            () => {}
        )
    },
    attachFocusToGlobe: function (lat, lng, elev, depth) {
        let z =
            elev +
            (CurtainTool.options.verticalOffset / 100) *
                CurtainTool.activeImage.depth *
                (CurtainTool.options.verticalExag || 1)
        z -= depth * CurtainTool.options.verticalExag

        CurtainTool.detachFocusFromGlobe()
        Globe_.litho.addLayer(
            'vector',
            {
                name: '_curtainPointTop',
                id: '_curtainPointTop',
                on: true,
                opacity: 1,
                order: 2,
                minZoom: 0,
                maxZoom: 30,
                style: {
                    default: {
                        fillColor: 'yellow',
                        color: '#000000',
                        weight: 2,
                        radius: 8,
                        elevOffset: 0,
                    },
                },
                geojson: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [[lng, lat, elev]],
                            },
                        },
                    ],
                },
            },
            1
        )
        Globe_.litho.addLayer(
            'vector',
            {
                name: '_curtainPointCursor',
                id: '_curtainPointCursor',
                on: true,
                opacity: 1,
                order: 2,
                minZoom: 0,
                maxZoom: 30,
                style: {
                    default: {
                        fillColor: 'rgba(0,0,0,0.3)',
                        color: '#000000',
                        weight: 2,
                        radius: 8,
                        elevOffset: 0,
                    },
                },
                geojson: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [[lng, lat, z]],
                            },
                        },
                    ],
                },
            },
            1
        )
    },
    detachFocusFromGlobe: function () {
        Globe_.litho.removeLayer('_curtainPointTop')

        Globe_.litho.removeLayer('_curtainPointCursor')
    },
}

CurtainTool.init()

export default CurtainTool
