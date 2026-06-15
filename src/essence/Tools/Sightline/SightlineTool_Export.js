import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Toast from '../../../design-system/components/Toast/Toast'
import { writeArrayBuffer } from 'geotiff'

import HTML2Canvas from 'html2canvas'
import gifshot from 'gifshot'

import useSightlineStore from './store'

function _geoTiffMeta(data, rows, cols, isFloat) {
    const bounds = data._bounds
    if (!bounds || bounds.length < 4) return null
    const west = bounds[0], south = bounds[1], east = bounds[2], north = bounds[3]
    const pixelScaleX = (east - west) / cols
    const pixelScaleY = (north - south) / rows
    const meta = {
        height: rows,
        width: cols,
        ModelTiepoint: [0, 0, 0, west, north, 0],
        ModelPixelScale: [pixelScaleX, pixelScaleY, 0],
        GeographicTypeGeoKey: 4326,
        GeogCitationGeoKey: 'WGS 84',
        GTModelTypeGeoKey: 2,
        GTRasterTypeGeoKey: 1,
    }
    if (isFloat) {
        meta.BitsPerSample = [32]
        meta.SampleFormat = [3]
    } else {
        meta.BitsPerSample = [8]
        meta.SampleFormat = [1]
    }
    return meta
}

function _downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('download', fileName)
    link.setAttribute('href', url)
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
}

const SightlineTool_Export = {
    _buildExportName(elmId, suffix) {
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        const options = store.getSightlineOptions(elmId)
        const parts = ['sightline']
        if (options?.targets?.[0]?.name) parts.push(options.targets[0].name.replace(/\s+/g, '-'))
        if (el?.observer) parts.push(el.observer.replace(/\s+/g, '-'))
        if (store.rawTime) parts.push(store.rawTime.replace(/[:\s]/g, '').replace(/\.\d{3}Z$/, 'Z'))
        if (suffix) parts.push(suffix)
        return parts.join('_').replace(/[^a-zA-Z0-9_\-\.]/g, '')
    },

    exportPNG(elmId) {
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        const mode = el?.sightlineMode

        if (mode === 'playback') {
            SightlineTool_Export._exportPlaybackGIF(elmId)
            return
        }

        const layerName = 'sightline' + elmId
        const layer = L_.layers.layer[layerName]
        if (!layer || !layer._url) {
            Toast.warning('No sightline map to export. Generate first.', 6000)
            return
        }

        const img = new Image()
        img.onload = function () {
            const SCALE = 4
            const compositeCanvas = document.createElement('canvas')
            compositeCanvas.width = img.width * SCALE
            compositeCanvas.height = img.height * SCALE
            const compositeCtx = compositeCanvas.getContext('2d')
            compositeCtx.imageSmoothingEnabled = false
            compositeCtx.drawImage(img, 0, 0, compositeCanvas.width, compositeCanvas.height)

            const fileName = SightlineTool_Export._buildExportName(elmId, 'map') + '.png'
            compositeCanvas.toBlob(function (blob) {
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.setAttribute('download', fileName)
                link.setAttribute('href', url)
                document.body.appendChild(link)
                link.click()
                link.remove()
                URL.revokeObjectURL(url)
            })
        }
        img.src = layer._url
    },

    async _exportPlaybackGIF(elmId) {
        const store = useSightlineStore.getState()
        const ed = store.sweepElData[elmId]
        const el = store.elements[elmId]

        if (!ed?.grids || ed.grids.length === 0) {
            Toast.warning('No playback frames to export. Run a sweep first.', 6000)
            return
        }

        const data = ed.lastData
        const options = store.getSightlineOptions(elmId)
        if (!data || !options) {
            Toast.warning('Missing sweep data for export.', 6000)
            return
        }
        options.color.a = 255

        const totalFrames = ed.grids.filter((g) => g != null).length
        Toast.info('Generating GIF (' + totalFrames + ' frames)...', 6000)

        const mapEl = document.getElementById('map')
        let basemapCanvas = null
        if (mapEl) {
            const layerName = 'sightline' + elmId
            const sightlineLayer = L_.layers.layer[layerName]
            const slContainer = sightlineLayer?._container || sightlineLayer?.getContainer?.()
            const controlContainer = mapEl.querySelector('.leaflet-control-container')

            if (slContainer) slContainer.style.display = 'none'
            if (controlContainer) controlContainer.style.display = 'none'

            try {
                basemapCanvas = await HTML2Canvas(mapEl, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#1a1a2e',
                    logging: false,
                    width: mapEl.offsetWidth,
                    height: mapEl.offsetHeight,
                })
            } catch (e) {
                console.warn('Could not capture basemap for GIF:', e)
            }

            if (slContainer) slContainer.style.display = ''
            if (controlContainer) controlContainer.style.display = ''
        }

        const mapRect = mapEl.getBoundingClientRect()
        const GIF_MAX_WIDTH = 720
        let fullW = (basemapCanvas && basemapCanvas.width > 0) ? basemapCanvas.width : Math.round(mapRect.width)
        let fullH = (basemapCanvas && basemapCanvas.height > 0) ? basemapCanvas.height : Math.round(mapRect.height)
        if (basemapCanvas && (basemapCanvas.width === 0 || basemapCanvas.height === 0)) {
            basemapCanvas = null
            fullW = Math.round(mapRect.width)
            fullH = Math.round(mapRect.height)
        }
        const scaleFactor = Math.min(1, GIF_MAX_WIDTH / fullW)
        const outW = Math.round(fullW * scaleFactor)
        const outH = Math.round(fullH * scaleFactor)

        const frameImages = []

        const map = Map_.map
        const bounds = data._bounds
        const projBounds = data._projBounds
        let tlLatLng, brLatLng
        if (projBounds && map.options.crs && map.options.crs.unproject) {
            tlLatLng = map.options.crs.unproject(L.point(projBounds[0], projBounds[3]))
            brLatLng = map.options.crs.unproject(L.point(projBounds[2], projBounds[1]))
        } else if (bounds) {
            tlLatLng = L.latLng(bounds[3], bounds[0])
            brLatLng = L.latLng(bounds[1], bounds[2])
        }
        const tlPoint = map.latLngToContainerPoint(tlLatLng)
        const brPoint = map.latLngToContainerPoint(brLatLng)
        const overlayX = tlPoint.x * scaleFactor
        const overlayY = tlPoint.y * scaleFactor
        const overlayW = (brPoint.x - tlPoint.x) * scaleFactor
        const overlayH = (brPoint.y - tlPoint.y) * scaleFactor

        let processedCount = 0
        useSightlineStore.getState().setSweepField('exportProgress', 0)
        for (let f = 0; f < ed.grids.length; f++) {
            const grid = ed.grids[f]
            if (!grid) continue

            const rows = grid.length
            const cols = grid[0] ? grid[0].length : 0
            const frameCanvas = document.createElement('canvas')
            frameCanvas.setAttribute('willReadFrequently', 'true')
            frameCanvas.width = cols
            frameCanvas.height = rows
            const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true })
            const imgData = frameCtx.createImageData(cols, rows)
            const px = imgData.data
            const colorR = options.color ? options.color.r : 0
            const colorG = options.color ? options.color.g : 0
            const colorB = options.color ? options.color.b : 0
            const colorA = options.color ? options.color.a : 255
            const isInvert = options.invert == 0
            for (let y = 0; y < rows; y++) {
                const row = grid[y]
                for (let x = 0; x < cols; x++) {
                    const idx = (y * cols + x) * 4
                    const val = row ? row[x] : null
                    if (val === 1 || val === 2) {
                        if (isInvert) {
                            px[idx] = colorR; px[idx + 1] = colorG; px[idx + 2] = colorB; px[idx + 3] = colorA
                        } else {
                            px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                        }
                    } else if (val === 0) {
                        if (isInvert) {
                            px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                        } else {
                            px[idx] = colorR; px[idx + 1] = colorG; px[idx + 2] = colorB; px[idx + 3] = colorA
                        }
                    } else {
                        px[idx] = 0; px[idx + 1] = 0; px[idx + 2] = 0; px[idx + 3] = 0
                    }
                }
            }
            frameCtx.putImageData(imgData, 0, 0)

            const outCanvas = document.createElement('canvas')
            outCanvas.width = outW
            outCanvas.height = outH
            const outCtx = outCanvas.getContext('2d', { willReadFrequently: true })

            if (basemapCanvas) {
                outCtx.drawImage(basemapCanvas, 0, 0, outW, outH)
            } else {
                outCtx.fillStyle = '#1a1a2e'
                outCtx.fillRect(0, 0, outW, outH)
            }

            outCtx.imageSmoothingEnabled = false
            const opacity = el?.opacity != null ? el.opacity : 0.5
            outCtx.globalAlpha = opacity
            outCtx.drawImage(frameCanvas, overlayX, overlayY, overlayW, overlayH)
            outCtx.globalAlpha = 1.0

            const timeLabel = ed.results?.[f]?.time
                ? ed.results[f].time.replace(/\.\d{3}Z$/, 'Z')
                : 'Frame ' + (f + 1)
            const fontSize = Math.max(11, Math.round(outH * 0.03))
            outCtx.font = 'bold ' + fontSize + 'px sans-serif'
            outCtx.textBaseline = 'top'
            const textMetrics = outCtx.measureText(timeLabel)
            const pad = 4
            outCtx.fillStyle = 'rgba(0,0,0,0.6)'
            outCtx.fillRect(pad, pad, textMetrics.width + pad * 2, fontSize + pad * 2)
            outCtx.fillStyle = '#ffffff'
            outCtx.fillText(timeLabel, pad * 2, pad * 2)

            frameImages.push(outCanvas.toDataURL('image/png'))
            processedCount++

            const pct = Math.round((processedCount / totalFrames) * 90)
            useSightlineStore.getState().setSweepField('exportProgress', pct)
            if (processedCount % 3 === 0) {
                await new Promise((r) => setTimeout(r, 0))
            }
        }

        if (frameImages.length === 0) {
            Toast.warning('No valid frames to export.', 6000)
            return
        }

        useSightlineStore.getState().setSweepField('exportProgress', 90)

        const interval = (store.sweepPlaySpeed || 300) / 1000
        gifshot.createGIF(
            {
                images: frameImages,
                gifWidth: outW,
                gifHeight: outH,
                interval: interval,
                numFrames: frameImages.length,
                frameDuration: interval,
                sampleInterval: 10,
                numWorkers: 2,
                progressCallback: function (pct) {
                    const uiPct = 90 + Math.round(pct * 10)
                    useSightlineStore.getState().setSweepField('exportProgress', uiPct)
                },
            },
            function (obj) {
                if (!obj.error) {
                    const byteCharacters = atob(obj.image.split(',')[1])
                    const byteNumbers = new Array(byteCharacters.length)
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i)
                    }
                    const byteArray = new Uint8Array(byteNumbers)
                    const blob = new Blob([byteArray], { type: 'image/gif' })
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    const fileName = SightlineTool_Export._buildExportName(elmId, 'playback') + '.gif'
                    link.setAttribute('download', fileName)
                    link.setAttribute('href', url)
                    document.body.appendChild(link)
                    link.click()
                    link.remove()
                    setTimeout(() => URL.revokeObjectURL(url), 10000)
                    Toast.success('GIF exported successfully!', 3000)
                    useSightlineStore.getState().setSweepField('exportProgress', 100)
                    setTimeout(() => useSightlineStore.getState().setSweepField('exportProgress', null), 500)
                } else {
                    console.error('GIF export failed:', obj.errorMsg)
                    Toast.error('GIF export failed. Try with fewer frames.', 6000)
                    useSightlineStore.getState().setSweepField('exportProgress', null)
                }
            }
        )
    },

    exportGeoTIFF(elmId) {
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        const ed = store.sweepElData[elmId]
        const mode = el?.sightlineMode

        if (mode === 'static') {
            const grid = el?.lastResultGrid
            const data = el?.lastData || store.lastData
            if (!grid || grid.length === 0 || !data) {
                Toast.warning('No results to export. Generate first.', 6000)
                return
            }
            const rows = grid.length
            const cols = grid[0]?.length || 0
            const meta = _geoTiffMeta(data, rows, cols, false)
            if (!meta) { Toast.error('Missing bounds for GeoTIFF export.', 6000); return }
            const flat = new Uint8Array(rows * cols)
            for (let r = 0; r < rows; r++) {
                const row = grid[r]
                const base = r * cols
                for (let c = 0; c < cols; c++) flat[base + c] = row?.[c] ?? 9
            }
            const arrayBuffer = writeArrayBuffer([flat], meta)
            _downloadBlob(new Blob([arrayBuffer], { type: 'image/tiff' }),
                SightlineTool_Export._buildExportName(elmId, 'sightmap') + '.tif')
            Toast.success('GeoTIFF exported.', 3000)
            return
        }

        if (mode === 'playback') {
            const grids = ed?.grids
            const data = ed?.lastData || el?.lastData || store.lastData
            if (!grids || grids.length === 0 || !data) {
                Toast.warning('No results to export. Run a sweep first.', 6000)
                return
            }
            const rows = grids[0]?.length || 0
            const cols = grids[0]?.[0]?.length || 0
            const meta = _geoTiffMeta(data, rows, cols, false)
            if (!meta) { Toast.error('Missing bounds for GeoTIFF export.', 6000); return }
            meta.BitsPerSample = grids.map(() => 8)
            meta.SampleFormat = grids.map(() => 1)
            const bands = []
            for (let f = 0; f < grids.length; f++) {
                const grid = grids[f]
                const flat = new Uint8Array(rows * cols)
                if (grid) {
                    for (let r = 0; r < rows; r++) {
                        const row = grid[r]
                        const base = r * cols
                        for (let c = 0; c < cols; c++) flat[base + c] = row?.[c] ?? 9
                    }
                } else {
                    flat.fill(9)
                }
                bands.push(flat)
            }
            const arrayBuffer = writeArrayBuffer(bands, meta)
            _downloadBlob(new Blob([arrayBuffer], { type: 'image/tiff' }),
                SightlineTool_Export._buildExportName(elmId, 'playback') + '.tif')
            Toast.success('GeoTIFF exported (' + grids.length + ' bands).', 3000)
            return
        }

        // Composite mode
        const heatmap = ed?.heatmap
        const data = ed?.lastData || el?.lastData || store.lastData
        if (!heatmap || heatmap.length === 0 || !data) {
            Toast.warning('No results to export. Run a sweep first.', 6000)
            return
        }
        const rows = heatmap.length
        const cols = heatmap[0]?.length || 0
        const meta = _geoTiffMeta(data, rows, cols, true)
        if (!meta) { Toast.error('Missing bounds for GeoTIFF export.', 6000); return }
        const flat = new Float32Array(rows * cols)
        for (let r = 0; r < rows; r++) {
            const row = heatmap[r]
            const base = r * cols
            for (let c = 0; c < cols; c++) {
                const v = row?.[c]
                flat[base + c] = (v != null && Number.isFinite(v)) ? v : -1
            }
        }
        const arrayBuffer = writeArrayBuffer([flat], meta)
        _downloadBlob(new Blob([arrayBuffer], { type: 'image/tiff' }),
            SightlineTool_Export._buildExportName(elmId, 'composite') + '.tif')
        Toast.success('GeoTIFF exported.', 3000)
    },

    exportGrid(elmId) {
        const store = useSightlineStore.getState()
        const el = store.elements[elmId]
        const mode = el?.sightlineMode

        let grid, isHeatmap, data
        if (mode === 'static') {
            grid = el?.lastResultGrid
            isHeatmap = false
            data = el?.lastData || store.lastData
        } else {
            grid = store.sweepElData[elmId]?.heatmap
            isHeatmap = true
            data = store.sweepElData[elmId]?.lastData || el?.lastData || store.lastData
            if (!grid) {
                grid = el?.lastResultGrid
                isHeatmap = false
            }
        }
        if (!grid || grid.length === 0) {
            Toast.warning('No sightline grid to export. Generate first.', 6000)
            return
        }

        const lines = []
        lines.push('# Sightline Grid Export')
        lines.push('# Rows: ' + grid.length + ', Cols: ' + (grid[0]?.length || 0))
        if (isHeatmap) {
            lines.push('# Values: fractional visibility (0.0 = always shadowed, 1.0 = always visible)')
        } else {
            lines.push('# Values: 0=shadowed, 1=visible(sun), 2=visible(earth), 8=no-DEM, 9=out-of-bounds')
        }
        const options = store.getSightlineOptions(elmId)
        if (options?.targets?.[0]?.name) lines.push('# Source: ' + options.targets[0].name)
        if (el?.observer) lines.push('# Observer: ' + el.observer)
        if (mode === 'static') {
            if (store.sweepStart) lines.push('# Time: ' + store.sweepStart)
        } else {
            if (store.sweepStart && store.sweepEnd) {
                lines.push('# Sweep: ' + store.sweepStart + ' to ' + store.sweepEnd)
            }
        }

        const crs = window.mmgisglobal?.customCRS
        if (data?.bottomLeftLatLng && data?.cellSize && crs) {
            const cols = grid[0]?.length || 0
            const rows = grid.length
            const blLat = data.bottomLeftLatLng.lat
            const blLng = data.bottomLeftLatLng.lng
            const trLat = blLat + rows * data.cellSize
            const trLng = blLng + cols * data.cellSize
            lines.push('# Bounding Box (degrees): SW(' + blLat.toFixed(8) + ', ' + blLng.toFixed(8) + ') NE(' + trLat.toFixed(8) + ', ' + trLng.toFixed(8) + ')')
            const swProj = crs.project({ lng: blLng, lat: blLat })
            const neProj = crs.project({ lng: trLng, lat: trLat })
            lines.push('# Bounding Box (projected meters): SW(' + swProj.x.toFixed(4) + ', ' + swProj.y.toFixed(4) + ') NE(' + neProj.x.toFixed(4) + ', ' + neProj.y.toFixed(4) + ')')
            lines.push('# Cell Size (projected meters): x=' + ((neProj.x - swProj.x) / cols).toFixed(4) + ' y=' + ((neProj.y - swProj.y) / rows).toFixed(4))
        }
        const projString = crs?.projString || ''
        const proj = L_.configData?.projection
        if (proj) {
            const projDesc = proj.custom ? (proj.proj || 'custom') : 'EPSG:3857'
            lines.push('# Projection: ' + projDesc)
        } else {
            lines.push('# Projection: EPSG:3857')
        }
        if (projString) lines.push('# Proj4: ' + projString)
        lines.push('')

        for (let y = 0; y < grid.length; y++) {
            const row = grid[y]
            if (!row) {
                lines.push('')
                continue
            }
            const vals = []
            for (let x = 0; x < row.length; x++) {
                const v = row[x]
                if (v == null) vals.push('-')
                else if (isHeatmap) vals.push(v.toFixed(3))
                else vals.push(String(v))
            }
            lines.push(vals.join(' '))
        }

        const text = lines.join('\n')
        const fileName = SightlineTool_Export._buildExportName(elmId, 'grid') + '.txt'
        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('download', fileName)
        link.setAttribute('href', url)
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    },
}

export default SightlineTool_Export
