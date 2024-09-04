import * as GeoTIFF from "geotiff/dist-browser/geotiff";
// Ideas from:
// https://github.com/ScanEx/Leaflet.imageTransform/blob/master/src/L.ImageTransform.js
// https://github.com/BenjaminVadant/leaflet-ugeojson

// Depends on:
// https://github.com/constantinius/geotiff.js

// Note this will only work with ESPG:4326 tiffs

try {
  new window.ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1);
} catch (e) {
  var ImageDataPolyfill = function ImageDataPolyfill() {
    var args = [].concat(Array.prototype.slice.call(arguments)),
      data = void 0;

    if (args.length < 2) {
      throw new TypeError(
        'Failed to construct "ImageData": 2 arguments required, but only ' +
          args.length +
          " present."
      );
    }

    if (args.length > 2) {
      data = args.shift();

      if (!(data instanceof Uint8ClampedArray)) {
        throw new TypeError(
          'Failed to construct "ImageData": parameter 1 is not of type "Uint8ClampedArray"'
        );
      }

      if (data.length !== 4 * args[0] * args[1]) {
        throw new Error(
          'Failed to construct "ImageData": The input data byte length is not a multiple of (4 * width * height)'
        );
      }
    }

    var width = args[0],
      height = args[1],
      canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d"),
      imageData = ctx.createImageData(width, height);

    if (data) imageData.data.set(data);
    return imageData;
  };

  window.ImageData = ImageDataPolyfill;
}

L.LeafletGeotiff = L.ImageOverlay.extend({
  options: {
    arrayBuffer: null,
    arrowSize: 20,
    band: 0,
    image: 0,
    renderer: null,
    rBand: 0,
    gBand: 1,
    bBand: 2,
    alphaBand: 0, // band to use for (generating) alpha channel
    transpValue: 0, // original band value to interpret as transparent
    pane: "overlayPane",
    onError: null,
    sourceFunction: null,
    noDataValue: undefined,
    noDataKey: undefined,
    useWorker: false
  },

  initialize(url, options) {
    if (typeof GeoTIFF === "undefined") {
      throw new Error("GeoTIFF not defined");
    }

    this._url = url;
    this.raster = {};
    this.sourceFunction = GeoTIFF.fromUrl;
    this._blockSize = 65536;

    this.x_min = null;
    this.x_max = null;
    this.y_min = null;
    this.y_max = null;

    this.min = null;
    this.max = null;

    L.Util.setOptions(this, options);

    if (this.options.bounds) {
      this._rasterBounds = L.latLngBounds(options.bounds);
    }
    if (this.options.renderer) {
      this.options.renderer.setParent(this);
    }
    if (this.options.sourceFunction) {
      this.sourceFunction = this.options.sourceFunction;
    }
    if (this.options.blockSize) {
      this._blockSize = this.options.blockSize;
    }

    this._getData();
  },

  setURL(newURL) {
    this._url = newURL;
    this._getData();
  },

  onAdd(map) {
    this._map = map;
    if (!this._image) {
      this._initImage();
    }
    this._image.style.opacity = this.options.opacity || 1;
    
    map._panes[this.options.pane].appendChild(this._image);

    map.on("moveend", this._reset, this);

    if(this.options.clearBeforeMove) {
      map.on("movestart", this._moveStart, this);
    }


    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on("zoomanim", this._animateZoom, this);
    }

    this._reset();
  },

  onRemove(map) {
    map.getPanes()[this.options.pane].removeChild(this._image);

    map.off("moveend", this._reset, this);

    if(this.options.clearBeforeMove) {
      map.off("movestart", this._moveStart, this);
    }


    if (map.options.zoomAnimation) {
      map.off("zoomanim", this._animateZoom, this);
    }
  },

  async _getData() {
    let tiff;
    if (this.sourceFunction !== GeoTIFF.fromArrayBuffer) {
      tiff = await this.sourceFunction(this._url, {
        blockSize: this._blockSize,
      }).catch((e) => {
        if (this.options.onError) {
          this.options.onError(e);
        } else {
          console.error(`Failed to load from url or blob ${this._url}`, e);
          return false;
        }
      });
    } else {
      tiff = await GeoTIFF.fromArrayBuffer(this.options.arrayBuffer, {
        blockSize: this._blockSize,
      }).catch((e) => {
        if (this.options.onError) {
          this.options.onError(e);
        } else {
          console.error(`Failed to load from array buffer ${this._url}`, e);
          return false;
        }
      });
    }

    this._processTIFF(tiff);
    return true;
  },

  async _processTIFF(tiff) {
    this.tiff = tiff;
    await this.setBand(this.options.band).catch((e) => {
      console.error("this.setBand threw error", e);
    });
    if (!this.options.bounds) {
      const image = await this.tiff.getImage(this.options.image).catch((e) => {
        console.error("this.tiff.getImage threw error", e);
      });
      const meta = await image.getFileDirectory();
      //console.log("meta", meta);

      try {
        const bounds = image.getBoundingBox();
        this.x_min = bounds[0];
        this.x_max = bounds[2];
        this.y_min = bounds[1];
        this.y_max = bounds[3];
      } catch (e) {
        console.debug(
          "No bounds supplied, and unable to parse bounding box from metadata."
        );
        if (this.options.onError) this.options.onError(e);
      }

      if (this.options.noDataKey) {
        this.options.noDataValue = this.getDescendantProp(
          image,
          this.options.noDataKey
        );
      }

      this._rasterBounds = L.latLngBounds([
        [this.y_min, this.x_min],
        [this.y_max, this.x_max],
      ]);
      this._reset();

      if(window.Worker && this.options.useWorker) {
        const worker_src = "onmessage = function(e){let data = e.data.data; let noDataValue = e.data.noDataValue; let min = data.filter(val=> val !== noDataValue).reduce((a,b)=>Math.min(a,b)); let max = data.filter(val => val !== noDataValue).reduce((a,b)=>Math.max(a,b)); postMessage({min:min, max:max});}";
        const blob = new Blob([worker_src], {type:'application/javascript'});
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = e => {
          this.min = e.data.min;
          this.max = e.data.max;
          
          console.log("worker terminated", e);
          worker.terminate();
        }
  
        worker.postMessage({data: this.raster.data[0], noDataValue: this.options.noDataValue});
      } else {
        this.min = this.raster.data[0]
          .reduce((a, b) => b === this.options.noDataValue ? a : Math.min(a, b));
        this.max = this.raster.data[0]
          .reduce((a, b) => b == this.options.noDataValue ? a : Math.max(a, b));
      }
    }
  },

  async setBand(band) {
    this.options.band = band;

    const image = await this.tiff.getImage(this.options.image).catch((e) => {
      console.error("this.tiff.getImage threw error", e);
    });
    const data = await image
      .readRasters({ samples: this.options.samples })
      .catch((e) => {
        console.error("image.readRasters threw error", e);
      });
    const r = data[this.options.rBand];
    const g = data[this.options.gBand];
    const b = data[this.options.bBand];
    // map transparency value to alpha channel if transpValue is specified
    const a = this.options.transpValue
      ? data[this.options.alphaBand].map((v) => {
          return v == this.options.transpValue ? 0 : 255;
        })
      : data[this.options.alphaBand];

    this.raster.data = [r, g, b, a].filter(function (v) {
      return v;
    });
    this.raster.width = image.getWidth();
    this.raster.height = image.getHeight();
    //console.log("image", image, "data", data, "raster", this.raster.data);
    this._reset();
    return true;
  },
  getRasterArray() {
    return this.raster.data;
  },
  getRasterCols() {
    return this.raster.width;
  },
  getRasterRows() {
    return this.raster.height;
  },
  getBounds() {
    return this._rasterBounds;
  },
  getMinMax() {
    return { min: this.min, max: this.max };
  },
  getValueAtLatLng(lat, lng) {
    try {
      var x = Math.floor(
        (this.raster.width * (lng - this._rasterBounds._southWest.lng)) /
          (this._rasterBounds._northEast.lng -
            this._rasterBounds._southWest.lng)
      );
      var y =
        this.raster.height -
        Math.ceil(
          (this.raster.height * (lat - this._rasterBounds._southWest.lat)) /
            (this._rasterBounds._northEast.lat -
              this._rasterBounds._southWest.lat)
        );

      // invalid indices
      if (x < 0 || x > this.raster.width || y < 0 || y > this.raster.height)
        return null;

      const i = y * this.raster.width + x;
      const value = this.raster.data[0][i];

      if (this.options.noDataValue === undefined) return value;
      const noData = parseInt(this.options.noDataValue);
      if (value !== noData) return value;
      return null;
    } catch (err) {
      return undefined;
    }
  },
  _animateZoom(e) {
    if (L.version >= "1.0") {
      var scale = this._map.getZoomScale(e.zoom),
        offset = this._map._latLngBoundsToNewLayerBounds(
          this._map.getBounds(),
          e.zoom,
          e.center
        ).min;
      L.DomUtil.setTransform(this._image, offset, scale);
    } else {
      var scale = this._map.getZoomScale(e.zoom),
        nw = this._map.getBounds().getNorthWest(),
        se = this._map.getBounds().getSouthEast(),
        topLeft = this._map._latLngToNewLayerPoint(nw, e.zoom, e.center),
        size = this._map
          ._latLngToNewLayerPoint(se, e.zoom, e.center)
          ._subtract(topLeft);
      this._image.style[L.DomUtil.TRANSFORM] =
        L.DomUtil.getTranslateString(topLeft) + " scale(" + scale + ") ";
    }
  },
  _moveStart() {
    this._image.style.display = 'none';
  },
  _reset() {
    if (this.hasOwnProperty("_map") && this._map) {
      if (this._rasterBounds) {
        var topLeft = this._map.latLngToLayerPoint(
            this._map.getBounds().getNorthWest()
          ),
          size = this._map
            .latLngToLayerPoint(this._map.getBounds().getSouthEast())
            ._subtract(topLeft);

        L.DomUtil.setPosition(this._image, topLeft);
        this._image.style.width = size.x + "px";
        this._image.style.height = size.y + "px";

        this._drawImage();
        this._image.style.display = 'block';
      }
    }
  },
  setClip(clipLatLngs) {
    this.options.clip = clipLatLngs;
    this._reset();
  },

  _getPixelByLatLng(latLng) {
    var topLeft = this._map.latLngToLayerPoint(
      this._map.getBounds().getNorthWest()
    );
    var mercPoint = this._map.latLngToLayerPoint(latLng);
    return L.point(mercPoint.x - topLeft.x, mercPoint.y - topLeft.y);
  },

  _clipMaskToPixelPoints(i) {
    if (this.options.clip) {
      var topLeft = this._map.latLngToLayerPoint(
        this._map.getBounds().getNorthWest()
      );
      var pixelClipPoints = [];
      const clip = this.options.clip[i];
      for (var p = 0; p < clip.length; p++) {
        var mercPoint = this._map.latLngToLayerPoint(clip[p]),
          pixel = L.point(mercPoint.x - topLeft.x, mercPoint.y - topLeft.y);
        pixelClipPoints.push(pixel);
      }
      this._pixelClipPoints = pixelClipPoints;
    } else {
      this._pixelClipPoints = undefined;
    }
  },

  _drawImage() {
    if (this.raster.hasOwnProperty("data")) {
      var args = {};
      var topLeft = this._map.latLngToLayerPoint(
        this._map.getBounds().getNorthWest()
      );
      var size = this._map
        .latLngToLayerPoint(this._map.getBounds().getSouthEast())
        ._subtract(topLeft);

      args.rasterPixelBounds = L.bounds(
        this._map.latLngToContainerPoint(this._rasterBounds.getNorthWest()),
        this._map.latLngToContainerPoint(this._rasterBounds.getSouthEast())
      );


      // sometimes rasterPixelBounds will have fractional values
      // that causes transform() to draw a mostly empty image. Convert
      // fractional values to integers to fix this.
      args.rasterPixelBounds.max.x = parseInt(args.rasterPixelBounds.max.x);
      args.rasterPixelBounds.min.x = parseInt(args.rasterPixelBounds.min.x);
      args.rasterPixelBounds.max.y = parseInt(args.rasterPixelBounds.max.y);
      args.rasterPixelBounds.min.y = parseInt(args.rasterPixelBounds.min.y);

      args.xStart =
        args.rasterPixelBounds.min.x > 0 ? args.rasterPixelBounds.min.x : 0;
      args.xFinish =
        args.rasterPixelBounds.max.x < size.x
          ? args.rasterPixelBounds.max.x
          : size.x;
      args.yStart =
        args.rasterPixelBounds.min.y > 0 ? args.rasterPixelBounds.min.y : 0;
      args.yFinish =
        args.rasterPixelBounds.max.y < size.y
          ? args.rasterPixelBounds.max.y
          : size.y;
      args.plotWidth = args.xFinish - args.xStart;
      args.plotHeight = args.yFinish - args.yStart;

      if (args.plotWidth <= 0 || args.plotHeight <= 0) {
        var plotCanvas = document.createElement("canvas");
        plotCanvas.width = size.x;
        plotCanvas.height = size.y;
        var ctx = plotCanvas.getContext("2d");
        ctx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
        this._image.src = plotCanvas.toDataURL();
        return;
      }

      args.xOrigin = this._map.getPixelBounds().min.x + args.xStart;
      args.yOrigin = this._map.getPixelBounds().min.y + args.yStart;
      args.lngSpan =
        (this._rasterBounds._northEast.lng -
          this._rasterBounds._southWest.lng) /
        this.raster.width;
      args.latSpan =
        (this._rasterBounds._northEast.lat -
          this._rasterBounds._southWest.lat) /
        this.raster.height;

      //Draw image data to canvas and pass to image element
      var plotCanvas = document.createElement("canvas");
      plotCanvas.width = size.x;
      plotCanvas.height = size.y;
      var ctx = plotCanvas.getContext("2d");
      ctx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);

      this.options.renderer.render(this.raster, plotCanvas, ctx, args);
      // mask caused problems and seems to be not needed for our implementation
      //var mask = this.createMask(size, args);
      //ctx.globalCompositeOperation = 'destination-out';
      //ctx.drawImage(mask, 0, 0);

      this._image.src = String(plotCanvas.toDataURL());
    }
  },

  createSubmask(size, args, clip) {
    var canvas = document.createElement("canvas");
    canvas.width = size.x;
    canvas.height = size.y;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < clip.length; i++) {
      var ring = clip[i];
      if (i > 0) {
        //inner ring
        ctx.globalCompositeOperation = "destination-out";
      }
      ctx.beginPath();
      for (var j = 0; j < ring.length; j++) {
        var pix = this._getPixelByLatLng(ring[j]);
        ctx.lineTo(pix.x, pix.y);
      }
      ctx.fill();
    }
    return canvas;
  },

  createMask(size, args) {
    var canvas = document.createElement("canvas");
    canvas.width = size.x;
    canvas.height = size.y;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(args.xStart, args.yStart, args.plotWidth, args.plotHeight);
    //Draw clipping polygon
    const clip = this.options.clip;
    if (clip) {
      ctx.globalCompositeOperation = "destination-out";
      for (var idx = 0; idx < clip.length; idx++) {
        var submask = this.createSubmask(size, args, clip[idx]);
        ctx.drawImage(submask, 0, 0);
      }
    }
    return canvas;
  },

  transform(rasterImageData, args) {
    //Create image data and Uint32 views of data to speed up copying
    var imageData = new ImageData(args.plotWidth, args.plotHeight);
    var outData = imageData.data;
    var outPixelsU32 = new Uint32Array(outData.buffer);
    var inData = rasterImageData.data;
    var inPixelsU32 = new Uint32Array(inData.buffer);

    var zoom = this._map.getZoom();
    var scale = this._map.options.crs.scale(zoom);
    var d = 57.29577951308232; //L.LatLng.RAD_TO_DEG;

    var transformationA = this._map.options.crs.transformation._a;
    var transformationB = this._map.options.crs.transformation._b;
    var transformationC = this._map.options.crs.transformation._c;
    var transformationD = this._map.options.crs.transformation._d;
    if (L.version >= "1.0") {
      transformationA = transformationA * this._map.options.crs.projection.R;
      transformationC = transformationC * this._map.options.crs.projection.R;
    }

    for (var y = 0; y < args.plotHeight; y++) {
      var yUntransformed =
        ((args.yOrigin + y) / scale - transformationD) / transformationC;
      var currentLat =
        (2 * Math.atan(Math.exp(yUntransformed)) - Math.PI / 2) * d;
      var rasterY =
        this.raster.height -
        Math.ceil(
          (currentLat - this._rasterBounds._southWest.lat) / args.latSpan
        );

      for (var x = 0; x < args.plotWidth; x++) {
        //Location to draw to
        var index = y * args.plotWidth + x;

        //Calculate lat-lng of (x,y)
        //This code is based on leaflet code, unpacked to run as fast as possible
        //Used to deal with TIF being EPSG:4326 (lat,lon) and map being EPSG:3857 (m E,m N)
        var xUntransformed =
          ((args.xOrigin + x) / scale - transformationB) / transformationA;
        var currentLng = xUntransformed * d;
        var rasterX = Math.floor(
          (currentLng - this._rasterBounds._southWest.lng) / args.lngSpan
        );

        var rasterIndex = rasterY * this.raster.width + rasterX;

        //Copy pixel value
        outPixelsU32[index] = inPixelsU32[rasterIndex];
      }
    }
    return imageData;
  },

  /**
   * Supports retreival of nested properties via
   * dot notation, e.g. foo.bar.baz
   */
  getDescendantProp(obj, desc) {
    const arr = desc.split(".");
    while (arr.length && (obj = obj[arr.shift()]));
    return obj;
  },
});

L.LeafletGeotiffRenderer = L.Class.extend({
  initialize(options) {
    L.setOptions(this, options);
  },

  setParent(parent) {
    this.parent = parent;
  },

  render(raster, canvas, ctx, args) {
    throw new Error("Abstract class");
  },
});

L.leafletGeotiff = function (url, options) {
  return new L.LeafletGeotiff(url, options);
};
