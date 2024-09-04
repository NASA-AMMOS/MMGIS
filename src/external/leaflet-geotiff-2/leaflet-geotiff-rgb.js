// Depends on:
// https://github.com/santilland/plotty

L.LeafletGeotiff.RGB = L.LeafletGeotiffRenderer.extend({
  options: {
    cutoffBrightest: 0
  },

  initialize: function(options) {
    L.setOptions(this, options);
    this.name = "Canvas Renderer";
  },

  render: function(raster, canvas, ctx, args) {
    var rasterImageData = ctx.createImageData(raster.width, raster.height);
    var isGrayscale = raster.data.length < 3;
    // compute max band max value if not set yet
    if (!this.options.bandMaxVal) {
      let maxVal = 0;
      for (let i = 0; i < raster.data.length; i++) {
        // get max value per band
        /*// first return sorted array of unique values that are not NaN
                let srt = raster.data[i].filter(function(v, index, self){return (!isNaN(v) && self.indexOf(v)===index);}).sort();
                */
        //  first return sorted array of values that are not NaN
        let srt = raster.data[i]
          .filter(function(v, index, self) {
            return !isNaN(v);
          })
          .sort();
        let cMax = srt[srt.length - 1];
        if (
          this.options.cutoffBrightest &&
          this.options.cutoffBrightest > 0 &&
          this.options.cutoffBrightest < 1
        ) {
          cMax =
            srt[
              srt.length -
                1 -
                Math.round(srt.length * this.options.cutoffBrightest)
            ];
        }
        if (cMax > maxVal) {
          maxVal = cMax;
        }
        console.log(
          "min value for band" +
            i +
            ": " +
            srt[0] +
            ", max value for band" +
            i +
            ": " +
            srt[srt.length - 1]
        );
        this.options.bandMaxVal = maxVal;
      }
    }
    var scaleMax = this.options.bandMaxVal > 0 ? this.options.bandMaxVal : 255;
    function scale(val) {
      return Math.round((val / scaleMax) * 255);
    }
    for (let i = 0, j = 0; i < rasterImageData.data.length; i += 4, j += 1) {
      rasterImageData.data[i] = scale(raster.data[0][j]); // R value
      rasterImageData.data[i + 1] = scale(raster.data[isGrayscale ? 0 : 1][j]); // G value
      rasterImageData.data[i + 2] = scale(raster.data[isGrayscale ? 0 : 2][j]); // B value
      rasterImageData.data[i + 3] =
        isGrayscale || !raster.data[3] ? 255 : raster.data[3][j]; // A value
    }
    var imageData = this.parent.transform(rasterImageData, args);
    ctx.putImageData(imageData, args.xStart, args.yStart);

    // debug output
    /* var dPlotCanvas = document.getElementById("debugCanvas");
        dPlotCanvas.width = raster.width;
        dPlotCanvas.height = raster.height;
        var dCtx = dPlotCanvas.getContext("2d");
        dCtx.clearRect(0, 0, dPlotCanvas.width, dPlotCanvas.height);
        //this._image.src = plotCanvas.toDataURL();
        dCtx.putImageData(imageData, 0,0);
        console.log("imageDataURL (debug version):", dPlotCanvas.toDataURL()); */
  }
});

L.LeafletGeotiff.rgb = function(options) {
  return new L.LeafletGeotiff.RGB(options);
};
