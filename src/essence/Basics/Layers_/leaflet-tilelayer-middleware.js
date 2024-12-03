/* Several leaflet tile layer plugins combined and tweaked enough to warrant
 * pulling it out from /external (in case someone thinks it can be easily updated)
 */
/*
  Leaflet.TileLayer.WMS
*/
/*
  Leaflet.TileLayer.ColorFilter
  (c) 2018, Claudio T. Kawakani
  A simple and lightweight Leaflet plugin to apply CSS filters on map tiles.
  https://github.com/xtk93x/Leaflet.TileLayer.ColorFilter
*/

import F_ from '../../Basics/Formulae_/Formulae_'

var colorFilterExtension = {
    intialize: function (url, options) {
        L.TileLayer.prototype.initialize.call(this, url, options)
    },
    getTileUrl: function (coords) {
        let url = L.TileLayer.prototype.getTileUrl.call(this, coords)

        if (this.options.splitColonType === 'stac-collection') {
            let datetime

            if (this.options.endtime != null) {
                if (this.options.starttime != null) {
                    datetime = `${this.options.starttime}/${this.options.endtime}`
                } else {
                    datetime = `../${this.options.endtime}`
                }
            }
            if (datetime != null)
                url += `${
                    url.indexOf('?') === -1 ? '?' : '&'
                }datetime=${datetime}&exitwhenfull=false&skipcovered=false`
            else
                url += `${
                    url.indexOf('?') === -1 ? '?' : '&'
                }exitwhenfull=false&skipcovered=false`
        }

        url = url
            .replace(/{time}/g, this.options.time)
            .replace(/{starttime}/g, this.options.starttime)
            .replace(/{endtime}/g, this.options.endtime)

        if (
            this.options.customTimes?.times &&
            this.options.customTimes?.times.length > 0
        ) {
            for (let i = 0; i < this.options.customTimes.times.length; i++) {
                url = url.replace(
                    new RegExp(`{customtime.${i}}`, 'g'),
                    this.options.customTimes.times[i]
                )
            }
        }

        if (this.options.time && this.options.tileFormat === 'tms') {
            let paramDelimiter = '?'
            let urlParams = false
            if (url.indexOf('?') !== -1) {
                urlParams = new URLSearchParams(url.split('?')[1])
                paramDelimiter = '&'
            }

            if (urlParams == false || !urlParams.has('starttime')) {
                url += `${paramDelimiter}starttime=${this.options.starttime}`
                paramDelimiter = '&'
            }
            if (urlParams == false || !urlParams.has('time')) {
                url += `${paramDelimiter}time=${this.options.endtime}`
                paramDelimiter = '&'
            }
            if (urlParams == false || !urlParams.has('composite')) {
                if (this.options.compositeTile === true)
                    url += `${paramDelimiter}composite=true`
            }
        }
        return url
    },
    colorFilter: function () {
        let VALIDFILTERS = [
            'blur:px',
            'brightness: ',
            'bright:brightness: ',
            'bri:brightness: ',
            'contrast: ',
            'con:contrast: ',
            'grayscale:%',
            'gray:grayscale:%',
            'hue-rotate:deg',
            'hue:hue-rotate:deg',
            'hue-rotation:hue-rotate:deg',
            'invert:%',
            'inv:invert:%',
            'opacity:%',
            'op:opacity:%',
            'saturate: ',
            'saturation:saturate: ',
            'sat:saturate: ',
            'sepia:%',
            'sep:sepia:%',
        ]

        let colorFilterOptions = this.options.filter ? this.options.filter : []
        let filterSettings = colorFilterOptions
            .map((opt) => {
                let filter = opt.toLowerCase().split(':')
                if (filter.length === 2) {
                    let match = VALIDFILTERS.find((vf) => {
                        return vf.split(':')[0] === filter[0]
                    })
                    if (match) {
                        match = match.split(':')
                        filter[1] += /^\d+$/.test(filter[1])
                            ? match[match.length - 1]
                            : ''
                        return `${match[match.length - 2]}(${filter[1]})`
                    }
                }
                return ''
            })
            .join(' ')
        return filterSettings
    },
    colorBlend: function () {
        let colorFilterOptions = this.options.filter ? this.options.filter : []
        for (let i = 0; i < colorFilterOptions.length; i++) {
            let filter = colorFilterOptions[i].toLowerCase().split(':')
            if (filter[0] == 'mix-blend-mode') return filter[1]
        }
        return 'unset'
    },
    _initContainer: function () {
        let tile = L.TileLayer.prototype._initContainer.call(this)
        this._container.style.filter = this.colorFilter()
        this._container.style['mix-blend-mode'] = this.colorBlend()
    },
    updateFilter: function (newFilter) {
        this.options.filter = newFilter
        if (this._container) {
            this._container.style.filter = this.colorFilter()
            this._container.style['mix-blend-mode'] = this.colorBlend()
        }
    },
    // Reduces tile flicker. This and refresh() from https://github.com/Leaflet/Leaflet/issues/6659#issuecomment-813328622
    _refreshTileUrl: function (tile, url) {
        //use a image in background, so that only replace the actual tile, once image is loaded in cache!
        let img = new Image()
        img.onload = function (e) {
            L.Util.requestAnimFrame(function () {
                tile.el.src = url
                tile.el.style.opacity = 1
            })
        }
        img.onerror = function (e) {
            tile.el.src = F_.getBase64Transparent256Tile()
            tile.el.style.opacity = 0
        }
        img.src = url
    },
    refresh: function (newUrl) {
        if (newUrl) this._url = newUrl
        if (this._map == null) return
        for (let key in this._tiles) {
            const tile = this._tiles[key]
            if (tile.current && tile.active) {
                const oldsrc = tile.el.src
                const newsrc = this.getTileUrl(tile.coords)

                if (oldsrc != newsrc) {
                    //L.DomEvent.off(tile, 'load', this._tileOnLoad); ... this doesnt work!
                    this._refreshTileUrl(tile, newsrc)
                }
            }
        }
    },
}

var wmsExtension = {
    // @section
    // @aka TileLayer.WMS options
    // If any custom options not documented here are used, they will be sent to the
    // WMS server as extra parameters in each request URL. This can be useful for
    // [non-standard vendor WMS parameters](http://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
    defaultWmsParams: {
        SERVICE: 'WMS',
        REQUEST: 'GetMap',

        // @option layers: String = ''
        // **(required)** Comma-separated list of WMS layers to show.
        //LAYERS: '',

        // @option styles: String = ''
        // Comma-separated list of WMS styles.
        //STYLES: '',

        // @option format: String = 'image/jpeg'
        // WMS image format (use `'image/png'` for layers with transparency).
        FORMAT: 'image/png',

        // @option transparent: Boolean = false
        // If `true`, the WMS service will return images with transparency.
        TRANSPARENT: true,

        // @option version: String = '1.1.1'
        // Version of the WMS service to use
        VERSION: '1.1.1',
        //SRS: 'helloworld',
    },

    extensionOptions: {
        // @option crs: CRS = null
        // Coordinate Reference System to use for the WMS requests, defaults to
        // map CRS. Don't change this if you're not sure what it means.
        crs: null,

        // @option uppercase: Boolean = false
        // If `true`, WMS request parameter keys will be uppercase.
        uppercase: true,
    },

    initialize: function (url, options, wmsOptions) {
        this._url = url

        var wmsParams = L.extend({}, this.defaultWmsParams)

        // all keys that are not TileLayer options go to WMS params
        for (var i in wmsOptions) {
            if (!(i in this.extensionOptions)) {
                wmsParams[i] = wmsOptions[i]
            }
        }
        options = L.setOptions(this, options)

        wmsParams.WIDTH = wmsParams.HEIGHT =
            options.tileSize *
            (options.detectRetina && L.Browser.retina ? 2 : 1)

        this.wmsParams = wmsParams
    },

    onAdd: function (map) {
        this._crs = this.extensionOptions.crs || map.options.crs
        this._wmsVersion =
            parseFloat(this.wmsParams.VERSION) ||
            parseFloat(this.wmsParams.version)

        var projectionKey = this._wmsVersion >= 1.3 ? 'CRS' : 'SRS'
        this.wmsParams[projectionKey] = this._crs.code

        L.TileLayer.prototype.onAdd.call(this, map)
    },
    getTileUrl: function (coords) {
        var tileBounds = this._tileCoordsToNwSe(coords),
            crs = this._crs,
            bounds = this.toBounds(
                crs.project(tileBounds[0]),
                crs.project(tileBounds[1])
            ),
            min = bounds.min,
            max = bounds.max,
            bbox = (
                this._wmsVersion >= 1.3 && this._crs === L.CRS.EPSG4326
                    ? [min.y, min.x, max.y, max.x]
                    : [min.x, min.y, max.x, max.y]
            ).join(','),
            url = L.TileLayer.prototype.getTileUrl.call(this, coords)

        const wmsParamsUpdate = {}
        for (var key in this.wmsParams) {
            // If the WMS parameter contains {time}, {starttime}, and/or {endtime},
            // fill in the correct time values
            if (typeof this.wmsParams[key] === 'string') {
                wmsParamsUpdate[key] = this.wmsParams[key]
                    .replace('{time}', this.options.time)
                    .replace('{starttime}', this.options.starttime)
                    .replace('{endtime}', this.options.endtime)

                if (
                    this.options.customTimes?.times &&
                    this.options.customTimes.times.length > 0
                ) {
                    for (
                        let i = 0;
                        i < this.options.customTimes.times.length;
                        i++
                    ) {
                        wmsParamsUpdate[key] = wmsParamsUpdate[key].replace(
                            new RegExp(`{customtime.${i}}`, 'g'),
                            this.options.customTimes.times[i]
                        )
                    }
                }
            } else {
                wmsParamsUpdate[key] = this.wmsParams[key]
            }
        }

        return (
            url +
            L.Util.getParamString(
                wmsParamsUpdate,
                url,
                this.extensionOptions.uppercase
            ) +
            (this.extensionOptions.uppercase ? '&BBOX=' : '&bbox=') +
            bbox
        )
    },

    // @method setParams(params: Object, noRedraw?: Boolean): this
    // Merges an object with the new parameters and re-requests tiles on the current screen (unless `noRedraw` was set to true).
    setParams: function (params, noRedraw) {
        L.extend(this.wmsParams, params)

        if (!noRedraw) {
            this.redraw()
        }

        return this
    },
    toBounds(a, b) {
        if (!a || a instanceof L.Bounds) {
            return a
        }
        return new L.Bounds(a, b)
    },
}

L.TileLayer.ColorFilter = L.TileLayer.extend(colorFilterExtension)

// We can't extend an already extended so we'll merge by hand
L.TileLayer.WMSColorFilter = L.TileLayer.extend(
    Object.assign(colorFilterExtension, wmsExtension)
)

L.tileLayer.colorFilter = function (url, options) {
    if (options.tileFormat && options.tileFormat == 'wms') {
        const urlSplit = url.split('?')
        const urlBaseString = urlSplit[0]
        const urlParamString = urlSplit[1]
        const wmsOptions = {}
        const urlParams = new URLSearchParams(urlParamString)
        const entries = urlParams.entries()

        for (const entry of entries) {
            wmsOptions[entry[0].toUpperCase()] = entry[1]
        }
        if (wmsOptions.TILESIZE != null) {
            wmsOptions.tileSize = parseInt(wmsOptions.TILESIZE)
            delete wmsOptions.TILESIZE
        }

        if (wmsOptions.LAYERS == null)
            console.warn(
                `WARNING: WMS layer has no "layers" parameter in the url - ${url}`
            )

        return new L.TileLayer.WMSColorFilter(
            urlBaseString,
            options,
            wmsOptions
        )
    }

    url = url.replace(/{t}/g, '_time_')
    const tileLayer = new L.TileLayer.ColorFilter(url, options)

    return tileLayer
}
