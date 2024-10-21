require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
    // import L from 'leaflet';
    // import matrixUtils from './matrixUtils';
    
    const matrixUtils = {
    matrixMultiply: function (a, b) {
        var a00 = a[0*4+0];
        var a01 = a[0*4+1];
        var a02 = a[0*4+2];
        var a03 = a[0*4+3];
        var a10 = a[1*4+0];
        var a11 = a[1*4+1];
        var a12 = a[1*4+2];
        var a13 = a[1*4+3];
        var a20 = a[2*4+0];
        var a21 = a[2*4+1];
        var a22 = a[2*4+2];
        var a23 = a[2*4+3];
        var a30 = a[3*4+0];
        var a31 = a[3*4+1];
        var a32 = a[3*4+2];
        var a33 = a[3*4+3];
        var b00 = b[0*4+0];
        var b01 = b[0*4+1];
        var b02 = b[0*4+2];
        var b03 = b[0*4+3];
        var b10 = b[1*4+0];
        var b11 = b[1*4+1];
        var b12 = b[1*4+2];
        var b13 = b[1*4+3];
        var b20 = b[2*4+0];
        var b21 = b[2*4+1];
        var b22 = b[2*4+2];
        var b23 = b[2*4+3];
        var b30 = b[3*4+0];
        var b31 = b[3*4+1];
        var b32 = b[3*4+2];
        var b33 = b[3*4+3];
        return [a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30,
            a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31,
            a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32,
            a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33,
            a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30,
            a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31,
            a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32,
            a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33,
            a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30,
            a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31,
            a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32,
            a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33,
            a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30,
            a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31,
            a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32,
            a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33];
        },

        // Returns an identity matrix
        identityMatrix: function () {
            return [
                1,  0,  0,  0,
                0,  1,  0,  0,
                0,  0,  1,  0,
                0,  0,  0,  1
            ];
        },


        // Returns a translation matrix
        // Offset is a 3-element array
        translationMatrix: function (t) {

            return [
                1,    0,    0,  0,
                0,    1,    0,  0,
                0,    0,    1,  0,
                t[0], t[1], t[2],  1
            ];
        },

        // Returns a scale matrix
        // Scale is a 3-element array
        scaleMatrix: function (s) {

            return [
                s[0],    0,    0,  0,
                0, s[1],    0,  0,
                0,    0, s[2],  0,
                0,    0,    0,  1
            ];
        }
	}

    
    var glsl = require('glslify');
    var vertexShader = glsl(["#define GLSLIFY 1\nuniform mat4 u_matrix;\nattribute vec2 a_position;\n\nvoid main() {\n    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);\n    gl_PointSize = 10.0;\n}\n"]);
    var fragmentShader = glsl(["precision mediump float;\n#define GLSLIFY 1\nuniform vec2 u_resolution;\nuniform float u_angle;\nuniform float u_width;\nuniform float u_spacing;\nuniform float u_length;\nuniform float u_interval;\nuniform float u_speed;\nuniform float u_time;\nuniform int u_color;\n\nfloat drawCoord(float coord, float fill, float gap) {\n    float patternLength = fill + gap;\n    float modulo = mod(coord, patternLength);\n\n    return step(modulo, patternLength - gap);\n}\n\nvec3 getColor(int color) {\n    float red = float(color / 256 / 256);\n    float green = float(color / 256 - int(red * 256.0));\n    float blue = float(color - int(red * 256.0 * 256.0) - int(green * 256.0));\n\n    return vec3(red / 255.0, green / 255.0, blue / 255.0);\n}\n\nvoid main() {\n    mat2 rotationMatrix = mat2(\n        cos(u_angle), -sin(u_angle),\n        sin(u_angle), cos(u_angle)\n    );\n\n    vec2 rotatedFragCoord = rotationMatrix * gl_FragCoord.xy;\n\n    float yShift = u_time * u_speed;\n    float drawX = drawCoord(rotatedFragCoord.x, u_width, u_spacing);\n    float drawY = drawCoord(rotatedFragCoord.y + yShift, u_length, u_interval);\n\n    float draw = drawX * drawY;\n\n    if (!bool(draw)) discard;\n\n    vec3 color = getColor(u_color);\n\n    gl_FragColor = vec4(color, 1.0);\n}\n"]);
    
    L.Rain = L.Polygon.extend({
        options: {
            angle: 80,
            width: 1,
            spacing: 10,
            length: 4,
            interval: 10,
            speed: 0.5,
            color: 'Oxa6b3e9',
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        },
    
        onAdd: function (map) {
            var canvas, gl;
    
            this._map = map;
    
            if (!this._canvas) {
                canvas = this._canvas = this._initCanvas(map);
                gl = this._gl = this._initWebGl(canvas);
            }
    
            this._initShaders(gl);
    
            if (gl) {
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LEQUAL);
                gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
            }
    
            if (this.options.pane) {
                this.getPane().appendChild(canvas);
            } else {
                map._panes.overlayPane.appendChild(canvas);
            }
    
            map.on('move', this._reset, this);
            map.on('resize', this._resize, this);
    
            if (map.options.zoomAnimation && L.Browser.any3d) {
                map.on('zoomanim', this._animateZoom, this);
            }
    
            this._reset();
        },
    
        onRemove: function (map) {
            var canvas = this._canvas;
            if (this.options.pane) {
                this.getPane().removeChild(canvas);
            } else {
                map.getPanes().overlayPane.removeChild(canvas);
            }
    
            map.off('moveend', this._reset, this);
    
            if (map.options.zoomAnimation) {
                map.off('zoomanim', this._animateZoom, this);
            }
        },
    
        addTo: function (map) {
            map.addLayer(this);
            return this;
        },
    
        drawScene: function () {
            var buf,
                polygonsCount,
                currentIndex = 0,
                count = 0;
    
            var gl = this._gl;
    
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    
            polygonsCount = this._latlngs.length;
    
            for (var i = 0; i < polygonsCount; i++) {
                var polygonLanLngs = this._latlngs[i];
                count = polygonLanLngs.length;
    
                this._updateMatrix(gl);
                gl.drawArrays(gl.TRIANGLE_FAN, currentIndex, count);
                currentIndex += count;
            }
        },
    
        render: function () {
            var gl = this._gl,
                time = L.Util.requestAnimFrame(this.render.bind(this)),
                timeLocation = gl.getUniformLocation(this.shaderProgram, "u_time");
    
            gl.uniform1f(timeLocation, time);
            this.drawScene();
        },
    
        setLatLngs: function (latlngs) {
            this._latlngs = latlngs;
            // console.log(latlngs);
            this._redraw();
        },
    
        setAngle: function (angle) {
            var gl = this._gl,
                angleLocation = gl.getUniformLocation(this.shaderProgram, "u_angle"),
                rad = angle * Math.PI / 180 - Math.PI / 2.0;
    
            this.options.angle = angle;
            gl.uniform1f(angleLocation, rad);
            this._redraw();
        },
    
        setWidth: function (width) {
            var gl = this._gl,
                widthLocation = gl.getUniformLocation(this.shaderProgram, "u_width");
    
            this.options.width = width;
            gl.uniform1f(widthLocation, width);
            this._redraw();
        },
    
        setSpacing: function (spacing) {
            var gl = this._gl,
                spacingLocation = gl.getUniformLocation(this.shaderProgram, "u_spacing");
    
            this.options.spacing = spacing;
            gl.uniform1f(spacingLocation, spacing);
            this._redraw();
        },
    
        setLength: function (length) {
            var gl = this._gl,
                lengthLocation = gl.getUniformLocation(this.shaderProgram, "u_length");
    
            this.options.length = length;
            gl.uniform1f(lengthLocation, length);
            this._redraw();
        },
    
        setInterval: function (interval) {
            var gl = this._gl,
                intervalLocation = gl.getUniformLocation(this.shaderProgram, "u_interval");
    
            this.options.interval = interval;
            gl.uniform1f(intervalLocation, interval);
            this._redraw();
        },
    
        setSpeed: function (speed) {
            var gl = this._gl,
                speedLocation = gl.getUniformLocation(this.shaderProgram, "u_speed");
    
            this.options.speed = speed;
            gl.uniform1f(speedLocation, speed);
            this._redraw();
        },
    
        setColor: function (color) {
            var gl = this._gl,
                colorLocation = gl.getUniformLocation(this.shaderProgram, "u_color");
            if (color[0] === '#') {
                color = color.replace('#', '0x');
                this.options.color = color;
                gl.uniform1i(colorLocation, color);
                this._redraw();
            }
        },
    
        _initCanvas: function () {
            var canvas = L.DomUtil.create('canvas', 'webgl-canvas leaflet-layer');
    
            var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
            canvas.style[originProp] = '50% 50%';
    
            var size = this._map.getSize();
            canvas.width  = size.x;
            canvas.height = size.y;
            canvas.style.position = 'absolute';
    
            var animated = this._map.options.zoomAnimation && L.Browser.any3d;
            L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
    
            return canvas;
        },
    
        _initShaders: function (gl) {
            var { vertexShader, fragmentShader, angle, width, spacing, length, interval, speed, color } = this.options,
                vShader = this._getShader("vertex", vertexShader),
                fShader = this._getShader("fragment", fragmentShader),
                shaderProgram = this.shaderProgram = gl.createProgram();
    
            // console.log(vShader);
            // console.log(fShader);
    
            gl.attachShader(shaderProgram, vShader);
            gl.attachShader(shaderProgram, fShader);
            gl.linkProgram(shaderProgram);
    
            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                alert("Unable to initialize the shader program.");
            }
    
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
            gl.useProgram(shaderProgram);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    
            var angleLocation    = gl.getUniformLocation(shaderProgram, "u_angle"),
                spacingLocation  = gl.getUniformLocation(shaderProgram, "u_spacing"),
                widthLocation    = gl.getUniformLocation(shaderProgram, "u_width"),
                lengthLocation   = gl.getUniformLocation(shaderProgram, "u_legnth"),
                lengthLocation   = gl.getUniformLocation(shaderProgram, "u_length"),
                intervalLocation = gl.getUniformLocation(shaderProgram, "u_interval"),
                speedLocation    = gl.getUniformLocation(shaderProgram, "u_speed"),
                colorLocation    = gl.getUniformLocation(shaderProgram, "u_color");
    
            // угол дождя
            gl.uniform1f(angleLocation, angle * Math.PI / 180 - Math.PI / 2.0);
            gl.uniform1f(widthLocation, width);
            gl.uniform1f(spacingLocation, spacing);
            gl.uniform1f(lengthLocation, length);
            gl.uniform1f(intervalLocation, interval);
            gl.uniform1f(speedLocation, speed);
    
            if (color[0] === '#') {
                this.options.color = color.replace('#', '0x');
            }
    
            gl.uniform1i(colorLocation, this.options.color);
    
            this.render();
        },
    
        _initWebGl: function (canvas) {
            var gl = null;
    
            try {
                gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            }
            catch(e) {}
    
            if (!gl) {
                console.warn("Unable to initialize WebGL. Your browser may not support it.");
                gl = null;
            }
    
            return gl;
        },
    
        
        _getShader: function (type, source) {
            var gl = this._gl,
                shader = gl.createShader(type == "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
    
            if (!type) return null;
    
            gl.shaderSource(shader, source);
            // var b = gl.getShaderSource(shader);
            gl.compileShader(shader);
            // console.log(gl.getShaderParameter(shader, gl.COMPILE_STATUS));
    
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
                return null;
            }
    
            return shader;
        },
    
        _updateMatrix: function (gl) {
            if (this._map) {
                var matrixLocation = gl.getUniformLocation(this.shaderProgram, "u_matrix"),
                    map = this._map,
                    center = map.getCenter(),
                    zoom = map.getZoom(),
                    crs = map.options.crs,
                    CRSCenter = crs.project(center),
                    { x, y } = CRSCenter,
                    pxSize = crs.transformation.untransform(L.point([1,1]), 1),
                    mapSize = map.getSize(),
                    CRSUnitsPerPx = mapSize.divideBy( crs.scale(zoom) ),
                    half = pxSize.scaleBy(CRSUnitsPerPx),
                    transformMatrix = matrixUtils.identityMatrix(),
                    translationMatrix = matrixUtils.translationMatrix([-x, - y, 0]),
                    scaleMatrix = matrixUtils.scaleMatrix([1/half.x, -1/half.y, 1]);
    
                transformMatrix = matrixUtils.matrixMultiply(transformMatrix, translationMatrix);
                transformMatrix = matrixUtils.matrixMultiply(transformMatrix, scaleMatrix);
    
                gl.uniformMatrix4fv(matrixLocation, false, transformMatrix);
            }
        },
    
        _reset: function () {
            if (this._map == null) {
                return;
            }
            var topLeft = this._map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);
    
            this._redraw();
        },
    
        _resize: function (e) {
            var size = e.newSize;
    
            this._canvas.width  = size.x;
            this._canvas.height = size.y;
    
            this._reset();
        },
    
        _redraw: function () {
            var gl = this._gl,
                positionLocation = gl.getAttribLocation(this.shaderProgram, "a_position"),
                projectLatLng = this._projectLatLng.bind(this),
                bufArray = [].concat.apply([], this._latlngs)
                    .map(function (ll) {return projectLatLng(ll)})
                    .reduce(function (previousValue, currentValue) {
                    return previousValue.concat(currentValue);
                }, []),
                bytesPerVertex = 8,
                buf = gl.createBuffer();
    
            var resolutionLocation = gl.getUniformLocation(this.shaderProgram, "u_resolution");
            gl.uniform2fv(resolutionLocation, [this._canvas.width, this._canvas.height]);
    
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bufArray), gl.STATIC_DRAW);
    
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, bytesPerVertex, 0);
        },
    
        _projectLatLng: function (latLng) {
            var crsPoint = this._map.options.crs.project(latLng);
    
            return [crsPoint.x, crsPoint.y];
        },
    
        _animateZoom: function (e) {
            var scale = this._map.getZoomScale(e.zoom),
                offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
            if (L.DomUtil.setTransform) {
                L.DomUtil.setTransform(this._canvas, offset, scale);
    
            } else {
                this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
            }
        }
    });
    
    L.rain = (latlngs, options) => {
        return new L.Rain(latlngs, options);
    };
    
    },{"glslify":"glslify"}],"glslify":[function(require,module,exports){
    module.exports = function(strings) {
      if (typeof strings === 'string') strings = [strings]
      var exprs = [].slice.call(arguments,1)
      var parts = []
      for (var i = 0; i < strings.length-1; i++) {
        parts.push(strings[i], exprs[i] || '')
      }
      parts.push(strings[i])
      return parts.join('')
    }
    
    },{}]},{},[1]);
    