import { fromArrayBuffer, Pool } from 'geotiff'

// Shared pool for parallel GeoTIFF tile decompression (one pool per page lifetime)
const _geotiffPool = new Pool()

/*
 * @class GridLayer.GL
 * @inherits GridLayer
 *
 * This `GridLayer` runs some WebGL code on each grid cell, and puts an image
 * with the result back in place.
 *
 * The contents of each cell can be purely synthetic (based only on the cell
 * coordinates), or be based on some remote tiles (used as textures in the WebGL
 * shaders).
 *
 * The fragment shader is assumed to receive two `vec2` attributes, with the CRS
 * coordinates and the texture coordinates: `aCRSCoords` and `aTextureCoords`.
 * If textures are used, they are accesed through the uniforms `uTexture0` through `uTexture7`
 * There will always be four vertices forming two triangles (a quad).
 *
 */
'use strict'
;(function (factory) {
    // attach your plugin to the global 'L' variable
    if (typeof window !== 'undefined' && window.L) {
        factory(window.L)
    }
})(function (L) {
    L.TileLayer.GL = L.GridLayer.extend({
        options: {
            // @option tileUrls: Array
            // Array of tile URL templates (as in `L.TileLayer`), between zero and 8 elements. Each URL template will be converted into a plain `L.TileLayer` and pushed in the `tileLayers` option.
            tileUrls: [],

            // @option tileUrlsAsDataUrls: Boolean
            // Boolean that if true treats tileUrls as an array of image objects with data urls. { <z>: { <x>: { <y>: dataURL }, <x>: {} } }
            tileUrlsAsDataUrls: false,

            // @option tileLayers: Array
            // Array of instances of `L.TileLayer` (or its subclasses, like `L.TileLayer.WMS`), between zero and 8 elements.
            tileLayers: [],

            // @option fragmentShader: String
            // A string representing the GLSL fragment shader to be run.
            // This must NOT include defining the variants, nor the texture uniforms,
            // nor user-defined uniforms.
            fragmentShader:
                'void main(void) {gl_FragColor = vec4(0.2,0.2,0.2,1.0);}',

            // @option uniforms: Object
            // A map of names and initial values for the user-defined uniforms.
            // Values must be `Number` or an `Array` of up to four `Number`s.
            // e.g. `{ uTarget: 2.0, uOffset: [0.0, 5.0] }`.
            uniforms: {},

            subdomains: ['a', 'b', 'c', 'd'],
        },

        // On instantiating the layer, it will initialize all the GL context
        //   and upload the shaders to the GPU, along with the vertex buffer
        //   (the vertices will stay the same for all tiles).
        initialize: function (options) {
            options = L.setOptions(this, options)

            this._renderer = L.DomUtil.create('canvas')
            this._renderer.width = this._renderer.height = options.tileSize
            this._glError = false

            var gl = (this._gl =
                this._renderer.getContext('webgl', {
                    premultipliedAlpha: false,
                }) ||
                this._renderer.getContext('experimental-webgl', {
                    premultipliedAlpha: false,
                }))
            gl.viewportWidth = options.tileSize
            gl.viewportHeight = options.tileSize

            // Create `TileLayer`s from the tileUrls option.
            this._tileLayers = Array.from(options.tileLayers)
            for (var i = 0; i < options.tileUrls.length && i < 8; i++) {
                if (options.tileUrlsAsDataUrls) {
                    this._tileLayers.push(
                        L.tileLayer('{z},{x},{y}', options.options || {})
                    )
                    this._tileLayers[this._tileLayers.length - 1].dataUrls =
                        options.tileUrls[i]
                } else {
                    this._tileLayers.push(
                        L.tileLayer(options.tileUrls[i], options.options || {})
                    )
                }
            }

            this._loadGLProgram()

            // Init textures
            this._textures = []
            for (i = 0; i < this._tileLayers.length && i < 8; i++) {
                this._textures[i] = gl.createTexture()
                gl.uniform1i(
                    gl.getUniformLocation(this._glProgram, 'uTexture' + i),
                    i
                )
            }
        },

        // @method getGlError(): String|undefined
        // If there was any error compiling/linking the shaders, returns a string
        // with information about that error. If there was no error, returns `undefined`.
        getGlError: function () {
            return this._glError
        },

        _loadGLProgram: function () {
            var gl = this._gl

            // Force using this vertex shader.
            // Just copy all attributes to predefined variants and set the vertex positions
            var vertexShaderCode =
                'attribute vec2 aVertexCoords;  ' +
                'attribute vec2 aTextureCoords;  ' +
                'attribute vec2 aCRSCoords;  ' +
                'attribute vec2 aLatLngCoords;  ' +
                'varying vec2 vTextureCoords;  ' +
                'varying vec2 vCRSCoords;  ' +
                'varying vec2 vLatLngCoords;  ' +
                'void main(void) {  ' +
                '	gl_Position = vec4(aVertexCoords , 1.0, 1.0);  ' +
                '	vTextureCoords = aTextureCoords;  ' +
                '	vCRSCoords = aCRSCoords;  ' +
                '	vLatLngCoords = aLatLngCoords;  ' +
                '}'

            // Force using this bit for the fragment shader. All fragment shaders
            // will use the same predefined variants, and
            var fragmentShaderHeader =
                'precision highp float;\n' +
                'uniform float uNow;\n' +
                'varying vec2 vTextureCoords;\n' +
                'varying vec2 vCRSCoords;\n' +
                'varying vec2 vLatLngCoords;\n'

            for (var i = 0; i < this._tileLayers.length && i < 8; i++) {
                fragmentShaderHeader += 'uniform sampler2D uTexture' + i + ';\n'
            }

            fragmentShaderHeader += this._getUniformSizes()

            var program = (this._glProgram = gl.createProgram())
            var vertexShader = gl.createShader(gl.VERTEX_SHADER)
            var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
            gl.shaderSource(vertexShader, vertexShaderCode)
            gl.shaderSource(
                fragmentShader,
                fragmentShaderHeader + this.options.fragmentShader
            )
            gl.compileShader(vertexShader)
            gl.compileShader(fragmentShader)

            // @event shaderError
            // Fired when there was an error creating the shaders.
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                this._glError = gl.getShaderInfoLog(vertexShader)
                console.error(this._glError)
                return null
            }
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                this._glError = gl.getShaderInfoLog(fragmentShader)
                console.error(this._glError)
                return null
            }

            gl.attachShader(program, vertexShader)
            gl.attachShader(program, fragmentShader)
            gl.linkProgram(program)
            gl.useProgram(program)

            // There will be two vec2 vertex attributes per vertex - aCRSCoords and
            // aTextureCoords
            this._aVertexPosition = gl.getAttribLocation(
                program,
                'aVertexCoords'
            )
            this._aTexPosition = gl.getAttribLocation(program, 'aTextureCoords')
            this._aCRSPosition = gl.getAttribLocation(program, 'aCRSCoords')
            this._aLatLngPosition = gl.getAttribLocation(
                program,
                'aLatLngCoords'
            )

            this._initUniforms(program)

            // If the shader is time-dependent (i.e. animated), or has custom uniforms,
            // init the texture cache
            if (this._isReRenderable) {
                this._fetchedTextures = {}
                this._2dContexts = {}
            }

            // 		console.log('Tex position: ', this._aTexPosition);
            // 		console.log('CRS position: ', this._aCRSPosition);
            // 		console.log("uNow position: ", this._uNowPosition);

            // Create three data buffer with 8 elements each - the (easting,northing)
            // CRS coords, the (s,t) texture coords and the viewport coords for each
            // of the 4 vertices
            // Data for the texel and viewport coords is totally static, and
            // needs to be declared only once.
            this._CRSBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this._CRSBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(8), gl.STATIC_DRAW)
            if (this._aCRSPosition !== -1) {
                gl.enableVertexAttribArray(this._aCRSPosition)
                gl.vertexAttribPointer(
                    this._aCRSPosition,
                    2,
                    gl.FLOAT,
                    false,
                    8,
                    0
                )
            }

            this._LatLngBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this._LatLngBuffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(8), gl.STATIC_DRAW)
            if (this._aLatLngPosition !== -1) {
                gl.enableVertexAttribArray(this._aLatLngPosition)
                gl.vertexAttribPointer(
                    this._aLatLngPosition,
                    2,
                    gl.FLOAT,
                    false,
                    8,
                    0
                )
            }

            this._TexCoordsBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this._TexCoordsBuffer)

            // prettier-ignore
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			1.0, 0.0,
			0.0, 0.0,
			1.0, 1.0,
			0.0, 1.0,
		]), gl.STATIC_DRAW);
            if (this._aTexPosition !== -1) {
                gl.enableVertexAttribArray(this._aTexPosition)
                gl.vertexAttribPointer(
                    this._aTexPosition,
                    2,
                    gl.FLOAT,
                    false,
                    8,
                    0
                )
            }

            this._VertexCoordsBuffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this._VertexCoordsBuffer)

            // prettier-ignore
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			 1,  1,
			-1,  1,
			 1, -1,
			-1, -1
		]), gl.STATIC_DRAW);
            if (this._aVertexPosition !== -1) {
                gl.enableVertexAttribArray(this._aVertexPosition)
                gl.vertexAttribPointer(
                    this._aVertexPosition,
                    2,
                    gl.FLOAT,
                    false,
                    8,
                    0
                )
            }
        },

        // Looks at the size of the default values given for the uniforms.
        // Returns a string valud for defining the uniforms in the shader header.
        _getUniformSizes() {
            var defs = ''
            this._uniformSizes = {}
            for (var uniformName in this.options.uniforms) {
                var defaultValue = this.options.uniforms[uniformName]
                if (typeof defaultValue === 'number') {
                    this._uniformSizes[uniformName] = 0
                    defs += 'uniform float ' + uniformName + ';\n'
                } else if (defaultValue.constructor === Float32Array) {
                    if (defaultValue.length > 4) {
                        throw new Error(
                            'Max size for uniform value is 4 elements'
                        )
                    }
                    this._uniformSizes[uniformName] = defaultValue.length
                    if (defaultValue.length === 1) {
                        defs += 'uniform float ' + uniformName + ';\n'
                    } else {
                        defs +=
                            'uniform vec' +
                            defaultValue.length +
                            ' ' +
                            uniformName +
                            ';\n'
                    }
                } else {
                    throw new Error(
                        'Default value for uniforms must be either number or array of numbers'
                    )
                }
            }
            return defs
        },

        // Inits the uNow uniform, and the user-provided uniforms, given the current GL program.
        // Sets the _isReRenderable property if there are any set uniforms.
        _initUniforms(program) {
            var gl = this._gl
            this._uNowPosition = gl.getUniformLocation(program, 'uNow')
            this._isReRenderable = false

            if (this._uNowPosition) {
                gl.uniform1f(this._uNowPosition, performance.now())
                this._isReRenderable = true
            }

            this._uniformLocations = {}
            for (var uniformName in this.options.uniforms) {
                this._uniformLocations[uniformName] = gl.getUniformLocation(
                    program,
                    uniformName
                )
                this.setUniform(uniformName, this.options.uniforms[uniformName])
                this._isReRenderable = true
            }
        },

        // This is called once per tile - uses the layer's GL context to
        //   render a tile, passing the complex space coordinates to the
        //   GPU, and asking to render the vertexes (as triangles) again.
        // Every pixel will be opaque, so there is no need to clear the scene.
        _render: function (coords) {
            var gl = this._gl
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
            gl.clearColor(0, 0, 0, 0)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

            var tileBounds = this._tileCoordsToBounds(coords)
            var west = tileBounds.getWest(),
                east = tileBounds.getEast(),
                north = tileBounds.getNorth(),
                south = tileBounds.getSouth()

            // Create data array for LatLng buffer
            // prettier-ignore
            var latLngData = [
			// Vertex 0
			east, north,

			// Vertex 1
			west, north,

			// Vertex 2
			east, south,

			// Vertex 3
			west, south,
		];

            // ...upload them to the GPU...
            gl.bindBuffer(gl.ARRAY_BUFFER, this._LatLngBuffer)
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array(latLngData),
                gl.STATIC_DRAW
            )

            // ...also create data array for CRS buffer...
            // Kinda inefficient, but doesn't look performance-critical
            var crs = this._map.options.crs,
                min = crs.project(L.latLng(south, west)),
                max = crs.project(L.latLng(north, east))

            // prettier-ignore
            var crsData = [
			// Vertex 0
			max.x, max.y,

			// Vertex 1
			min.x, max.y,

			// Vertex 2
			max.x, min.y,

			// Vertex 3
			min.x, min.y,
		];
            // ...and also upload that to the GPU...
            gl.bindBuffer(gl.ARRAY_BUFFER, this._CRSBuffer)
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array(crsData),
                gl.STATIC_DRAW
            )

            // ... and then the magic happens.
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        },

        _bindTexture: function (index, imageData) {
            // Helper function. Binds a ImageData (HTMLImageElement, HTMLCanvasElement or
            // ImageBitmap) to a texture, given its index (0 to 7).
            // The image data is assumed to be in RGBA format.
            var gl = this._gl

            gl.activeTexture(gl.TEXTURE0 + index)
            gl.bindTexture(gl.TEXTURE_2D, this._textures[index])
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                imageData
            )
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MIN_FILTER,
                gl.LINEAR_MIPMAP_NEAREST
            )
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.generateMipmap(gl.TEXTURE_2D)
        },

        // Gets called by L.GridLayer before createTile(), just before coord wrapping happens.
        // Needed to store the context of each <canvas> tile when the tile coords is wrapping.
        _addTile(coords, container) {
            // This is quite an ugly hack, but WTF.
            this._unwrappedKey = this._tileCoordsToKey(coords)
            L.GridLayer.prototype._addTile.call(this, coords, container)
        },

        createTile: function (coords, done) {
            var tile = L.DomUtil.create('canvas', 'leaflet-tile')
            tile.width = tile.height = this.options.tileSize
            tile.onselectstart = tile.onmousemove = L.Util.falseFn

            var ctx = tile.getContext('2d')
            ctx.imageSmoothingEnabled = false

            var unwrappedKey = this._unwrappedKey
            var texFetches = []
            for (var i = 0; i < this._tileLayers.length && i < 8; i++) {
                // 				this.options.tileUrls[i]
                texFetches.push(this._getNthTile(i, coords))
            }

            Promise.all(texFetches).then(
                function (textureImages) {
                    if (!this._map) {
                        return
                    }

                    // If the shader is time-dependent (i.e. animated),
                    // save the textures for later access
                    if (this._isReRenderable) {
                        var key = this._tileCoordsToKey(coords)
                        this._fetchedTextures[key] = textureImages
                        this._2dContexts[unwrappedKey] = ctx
                    }

                    var gl = this._gl
                    for (var i = 0; i < this._tileLayers.length && i < 8; i++) {
                        this._bindTexture(
                            i,
                            textureImages[i].tile
                                ? textureImages[i].tile
                                : textureImages[i]
                        )
                    }

                    this._render(coords)

                    ctx.drawImage(this._renderer, 0, 0)
                    done()
                }.bind(this),
                function (err) {
                    L.TileLayer.prototype._tileOnError.call(
                        this,
                        done,
                        tile,
                        err
                    )
                }.bind(this)
            )

            return tile
        },

        _removeTile: function (key) {
            if (this._isReRenderable) {
                delete this._fetchedTextures[key]
                delete this._2dContexts[key]
            }
            L.TileLayer.prototype._removeTile.call(this, key)
        },

        onAdd: function () {
            // If the shader is time-dependent (i.e. animated), start an animation loop.
            if (this._uNowPosition) {
                L.Util.cancelAnimFrame(this._animFrame)
                this._animFrame = L.Util.requestAnimFrame(this._onFrame, this)
            }
            L.TileLayer.prototype.onAdd.call(this)
        },

        onRemove: function (map) {
            // Stop the animation loop, if any.
            L.Util.cancelAnimFrame(this._animFrame)
            L.TileLayer.prototype.onRemove.call(this, map)
        },

        _onFrame: function () {
            if (this._uNowPosition && this._map) {
                this.reRender()
                this._animFrame = L.Util.requestAnimFrame(
                    this._onFrame,
                    this,
                    false
                )
            }
        },
        clear: function () {
            var gl = this._gl
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
        },
        // Runs the shader (again) on all tiles
        reRender: function () {
            if (!this._isReRenderable) {
                return
            }
            var gl = this._gl
            gl.uniform1f(this._uNowPosition, performance.now())

            for (var key in this._tiles) {
                var tile = this._tiles[key]
                var coords = this._keyToTileCoords(key)
                var wrappedKey = this._tileCoordsToKey(this._wrapCoords(coords))

                if (
                    !tile.current ||
                    !tile.loaded ||
                    !this._fetchedTextures[wrappedKey]
                ) {
                    continue
                }

                for (var i = 0; i < this._tileLayers.length && i < 8; i++) {
                    this._bindTexture(
                        i,
                        this._fetchedTextures[wrappedKey][i].tile
                            ? this._fetchedTextures[wrappedKey][i].tile
                            : this._fetchedTextures[wrappedKey][i]
                    )
                }

                this._render(coords)

                this._2dContexts[key].clearRect(
                    0,
                    0,
                    tile.el.width,
                    tile.el.height
                )
                this._2dContexts[key].drawImage(this._renderer, 0, 0)
            }
        },

        // Sets the value(s) for a uniform.
        setUniform(name, value) {
            switch (this._uniformSizes[name]) {
                case 0:
                    this._gl.uniform1f(this._uniformLocations[name], value)
                    break
                case 1:
                    this._gl.uniform1fv(this._uniformLocations[name], value)
                    break
                case 2:
                    this._gl.uniform2fv(this._uniformLocations[name], value)
                    break
                case 3:
                    this._gl.uniform3fv(this._uniformLocations[name], value)
                    break
                case 4:
                    this._gl.uniform4fv(this._uniformLocations[name], value)
                    break
            }
        },

        // Gets the tile for the Nth `TileLayer` in `this._tileLayers`,
        // for the given tile coords, returns a promise to the tile.
        _getNthTile: function (n, coords) {
            var layer = this._tileLayers[n]
            // Monkey-patch a few things, both for TileLayer and TileLayer.WMS
            layer._tileZoom = this._tileZoom
            layer._map = this._map
            layer._crs = this._map.options.crs
            layer._globalTileRange = this._globalTileRange
            return new Promise(
                function (resolve, reject) {
                    var tile = document.createElement('img')
                    tile.crossOrigin = ''
                    if (this.options.tileUrlsAsDataUrls) {
                        if (
                            layer.dataUrls[coords.z] &&
                            layer.dataUrls[coords.z][coords.x] &&
                            layer.dataUrls[coords.z][coords.x][coords.y]
                        ) {
                            tile.src =
                                layer.dataUrls[coords.z][coords.x][coords.y]
                            tile.onload = () => {
                                resolve(tile)
                            }
                        } else {
                            reject(tile)
                        }
                    } else if (
                        layer.getTileUrl(coords).split('?')[0].toLowerCase().endsWith('.npy')
                    ) {
                        // NumPy binary branch: decode float32 tiles from TiTiler .npy endpoint.
                        // NPY is raw float32 + a tiny text header — no TIFF parsing overhead,
                        // no compression, nearly zero-copy Float32Array read.
                        const npyUrl = layer.getTileUrl(coords)
                        fetch(npyUrl)
                            .then((r) => {
                                if (!r.ok) return reject(null)
                                return r.arrayBuffer()
                            })
                            .then((buf) => {
                                if (!buf) return
                                // Parse NPY format (v1.0 and v2.0):
                                //   bytes 0-5:  magic \x93NUMPY
                                //   byte  6:    major version (1 or 2)
                                //   bytes 8-9:  header_len uint16 LE  (v1.0)
                                //   bytes 8-11: header_len uint32 LE  (v2.0)
                                //   then header_len bytes of ASCII dict, then raw float32 LE data
                                const meta = new DataView(buf)
                                const major = meta.getUint8(6)
                                const headerLen = major >= 2
                                    ? meta.getUint32(8, true)
                                    : meta.getUint16(8, true)
                                const dataOffset = (major >= 2 ? 12 : 10) + headerLen
                                const header = new TextDecoder().decode(
                                    new Uint8Array(buf, major >= 2 ? 12 : 10, headerLen)
                                )
                                // Extract shape — e.g. (256, 256) or (1, 256, 256)
                                const shapeMatch = header.match(/'shape':\s*\(([^)]+)\)/)
                                if (!shapeMatch) throw new Error('NPY tile missing shape header')
                                const shapeParts = shapeMatch[1]
                                    .split(',')
                                    .map((s) => parseInt(s.trim()))
                                    .filter((n) => !isNaN(n))
                                const h = shapeParts[shapeParts.length - 2] || shapeParts[0]
                                const w = shapeParts[shapeParts.length - 1]
                                // Float32 data is always little-endian on the server (x86/NumPy default)
                                const allFloats = new Float32Array(buf, dataOffset)
                                // Always use the first h*w floats (first band / band index 0)
                                const floatData = allFloats.subarray(0, h * w)
                                const imgData = new Uint8Array(w * h * 4)
                                // Reuse a single 4-byte shared buffer for byte-swapping.
                                // Float32Array is LE on x86; we need big-endian RGBA for rgbaToFloat(…,false):
                                //   R = byte[3] (MSB), G = byte[2], B = byte[1], A = byte[0] (LSB)
                                const floatBuf = new ArrayBuffer(4)
                                const floatView = new Float32Array(floatBuf)
                                const byteView = new Uint8Array(floatBuf)
                                for (let i = 0; i < floatData.length; i++) {
                                    const f = floatData[i]
                                    const o = i * 4
                                    if (f === 0) {
                                        imgData[o] = 128; imgData[o + 1] = 0
                                        imgData[o + 2] = 0; imgData[o + 3] = 0
                                    } else {
                                        floatView[0] = f
                                        imgData[o] = byteView[3]; imgData[o + 1] = byteView[2]
                                        imgData[o + 2] = byteView[1]; imgData[o + 3] = byteView[0]
                                    }
                                }
                                createImageBitmap(
                                    new ImageData(new Uint8ClampedArray(imgData.buffer), w, h),
                                    { premultiplyAlpha: 'none' }
                                ).then((bitmap) => {
                                    resolve({ tile: bitmap, pixelPerfect: { imgData } })
                                })
                            })
                            .catch(() => reject(null))
                    } else if (
                        layer.getTileUrl(coords).toLowerCase().includes('algorithm=terrarium') ||
                        layer.getTileUrl(coords).toLowerCase().includes('algorithm=terrainrgb')
                    ) {
                        // Terrain-encoded PNG branch: Mapzen Terrarium or Mapbox TerrainRGB.
                        // TiTiler returns an RGBA PNG where elevation is encoded in R/G/B.
                        // Terrarium:   elevation = R*256 + G + B/256 - 32768
                        // TerrainRGB:  elevation = -10000 + (R*65536 + G*256 + B) * 0.1
                        // TiTiler sets alpha=0 for masked/no-data pixels; check raw[o+3].
                        // PNG tiles are much smaller than .npy (~10-50 KB vs ~256 KB).
                        // We decode to float32 then re-encode as big-endian IEEE 754 RGBA so the
                        // colorize shader and min/max tracking work unchanged.
                        const terrainUrl = layer.getTileUrl(coords)
                        const isTerrainRGB = terrainUrl.toLowerCase().includes('algorithm=terrainrgb')
                        fetch(terrainUrl)
                            .then((r) => { if (!r.ok) return reject(null); return r.blob() })
                            .then((blob) => blob ? createImageBitmap(blob) : null)
                            .then((bitmap) => {
                                if (!bitmap) return
                                const w = bitmap.width, h = bitmap.height
                                const oc = new OffscreenCanvas(w, h)
                                const ctx = oc.getContext('2d')
                                ctx.drawImage(bitmap, 0, 0)
                                const raw = ctx.getImageData(0, 0, w, h).data
                                const imgData = new Uint8Array(w * h * 4)
                                const floatBuf = new ArrayBuffer(4)
                                const floatView = new Float32Array(floatBuf)
                                const byteView = new Uint8Array(floatBuf)
                                // Format-specific no-data sentinel value (matches auto-injected noDataValues)
                                const noDataElev = isTerrainRGB ? -10000.0 : -32768.0
                                for (let i = 0; i < w * h; i++) {
                                    const o = i * 4
                                    const r = raw[o], g = raw[o + 1], b = raw[o + 2]
                                    const elev = isTerrainRGB
                                        ? -10000.0 + (r * 65536.0 + g * 256.0 + b) * 0.1
                                        : r * 256.0 + g + b / 256.0 - 32768.0
                                    if (elev === 0) {
                                        // Zero-sentinel: alpha=0 makes it transparent in WebGL
                                        imgData[o] = 128; imgData[o + 1] = 0
                                        imgData[o + 2] = 0; imgData[o + 3] = 0
                                    } else if (raw[o + 3] === 0) {
                                        // alpha=0: TiTiler masked pixel — encode format's no-data value
                                        // so noDataValues filtering works in both JS and GLSL
                                        floatView[0] = noDataElev
                                        imgData[o] = byteView[3]; imgData[o + 1] = byteView[2]
                                        imgData[o + 2] = byteView[1]; imgData[o + 3] = byteView[0]
                                    } else {
                                        floatView[0] = elev
                                        imgData[o] = byteView[3]; imgData[o + 1] = byteView[2]
                                        imgData[o + 2] = byteView[1]; imgData[o + 3] = byteView[0]
                                    }
                                }
                                return createImageBitmap(
                                    new ImageData(new Uint8ClampedArray(imgData.buffer), w, h),
                                    { premultiplyAlpha: 'none' }
                                ).then((outBitmap) => {
                                    resolve({ tile: outBitmap, pixelPerfect: { imgData } })
                                })
                            })
                            .catch(() => reject(null))
                    } else if (
                        layer.getTileUrl(coords).split('?')[0].toLowerCase().match(/\.tiff?$/)
                    ) {
                        // GeoTIFF branch: decode float32 tiles (e.g. from TiTiler),
                        // encode as big-endian IEEE 754 RGBA so the colorize shader works unchanged.
                        const tifUrl = layer.getTileUrl(coords)
                        fetch(tifUrl)
                            .then((r) => {
                                if (!r.ok) return reject(null)
                                return r.arrayBuffer()
                            })
                            .then(async (buf) => {
                                if (!buf) return
                                const tiff = await fromArrayBuffer(buf)
                                const image = await tiff.getImage()
                                const rasters = await image.readRasters({
                                    pool: _geotiffPool,
                                })
                                const floatData = rasters[0]
                                const w = image.getWidth()
                                const h = image.getHeight()
                                const imgData = new Uint8Array(w * h * 4)
                                // Reuse a single 4-byte buffer to avoid DataView allocation per pixel.
                                // Float32Array is always little-endian on x86; we need big-endian
                                // RGBA for the rgbaToFloat(…, false) GLSL decoder:
                                //   R = byte[3] (MSB), G = byte[2], B = byte[1], A = byte[0] (LSB)
                                const floatBuf = new ArrayBuffer(4)
                                const floatView = new Float32Array(floatBuf)
                                const byteView = new Uint8Array(floatBuf)
                                for (let i = 0; i < floatData.length; i++) {
                                    const f = floatData[i]
                                    const o = i * 4
                                    if (f === 0) {
                                        // zero sentinel: 0x80000000 → RGBA (128,0,0,0)
                                        imgData[o] = 128
                                        imgData[o + 1] = 0
                                        imgData[o + 2] = 0
                                        imgData[o + 3] = 0
                                    } else {
                                        floatView[0] = f
                                        imgData[o] = byteView[3]
                                        imgData[o + 1] = byteView[2]
                                        imgData[o + 2] = byteView[1]
                                        imgData[o + 3] = byteView[0]
                                    }
                                }
                                // Use createImageBitmap with premultiplyAlpha:'none' so
                                // WebGL receives the raw RGBA bytes without premult corruption.
                                // A canvas 2D context internally stores premultiplied alpha,
                                // which would corrupt our float-encoded bytes (e.g. 50.0m has
                                // A=0x00 → all RGB zeroed; 51.4m has A=0x66 → RGB scaled down).
                                createImageBitmap(
                                    new ImageData(
                                        new Uint8ClampedArray(imgData.buffer),
                                        w,
                                        h
                                    ),
                                    { premultiplyAlpha: 'none' }
                                ).then((bitmap) => {
                                    resolve({
                                        tile: bitmap,
                                        pixelPerfect: { imgData },
                                    })
                                })
                            })
                            .catch(() => reject(null))
                    } else if (this.options.pixelPerfect) {
                        PNG.load(
                            layer.getTileUrl(coords),
                            function (img) {
                                const imgData = img.decode()
                                if (imgData == null) {
                                    reject(tile)
                                    return
                                }
                                tile.src = layer.getTileUrl(coords)
                                L.DomEvent.on(
                                    tile,
                                    'load',
                                    resolve.bind(this, {
                                        tile,
                                        pixelPerfect: {
                                            img: img,
                                            imgData: imgData,
                                        },
                                    })
                                )
                                L.DomEvent.on(
                                    tile,
                                    'error',
                                    reject.bind(this, {
                                        tile,
                                        pixelPerfect: {
                                            img: img,
                                            imgData: imgData,
                                        },
                                    })
                                )
                            },
                            true
                        )
                    } else {
                        tile.src = layer.getTileUrl(coords)
                        L.DomEvent.on(tile, 'load', resolve.bind(this, tile))
                        L.DomEvent.on(tile, 'error', reject.bind(this, tile))
                    }
                }.bind(this)
            )
        },

        // CSS Color Filters
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

            let colorFilterOptions = this.options.filter
                ? this.options.filter
                : []
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
            let colorFilterOptions = this.options.filter
                ? this.options.filter
                : []
            for (let i = 0; i < colorFilterOptions.length; i++) {
                let filter = colorFilterOptions[i].toLowerCase().split(':')
                if (filter[0] == 'mix-blend-mode') return filter[1]
            }
            return 'unset'
        },
        updateFilter: function (newFilter) {
            this.options.filter = newFilter
            if (this._container) {
                this._container.style.filter = this.colorFilter()
                this._container.style['mix-blend-mode'] = this.colorBlend()
            }
        },
    })

    L.tileLayer.gl = function (opts) {
        return new L.TileLayer.GL(opts)
    }
})
