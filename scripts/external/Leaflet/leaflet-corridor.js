/*
 * https://github.com/adoroszlai/leaflet-distance-markers
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014- Doroszlai Attila, 2016- Phil Whitehurst
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

L.Corridor = L.Polyline.extend({
  initialize: function (latlngs, options) {
    var self = this;

    L.Polyline.prototype.initialize.call(this, latlngs, options);

    this.corridor = options.corridor;
    this.updateCallback = (function (e) {
      self._updateWeight(this);
    });
  },

  onAdd: function(map) {
    L.Polyline.prototype.onAdd.call(this, map);
    map.on('zoomend', this.updateCallback);
    this._updateWeight(map);
  },

  onRemove: function(map) {
    map.off('zoomend', this.updateCallback);
    L.Polyline.prototype.onRemove.call(this, map);
  },

  _updateWeight: function(map) {
    this.setStyle({ 'weight': this._getWeight(map, this.corridor) });
  },

  _getWeight: function (map, corridor) {
    return corridor * 2 / this._getMetersPerPixel(map);
  },

  _getMetersPerPixel: function(map) {
    var centerLatLng = map.getCenter(); // get map center
    var pointC = map.latLngToContainerPoint(centerLatLng); // convert to containerpoint (pixels)
    var pointX = L.point(pointC.x + 10, pointC.y); // add 10 pixels to x

    // convert containerpoints to latlng's
    var latLngX = map.containerPointToLatLng(pointX);
    return centerLatLng.distanceTo(latLngX) / 10; // calculate distance between c and x (latitude)
  }
});

L.corridor = function (latlngs, options) {
  return new L.Corridor(latlngs, options || { corridor: 100 });
}
