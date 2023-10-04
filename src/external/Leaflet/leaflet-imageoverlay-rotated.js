L.ImageOverlay.Rotated = L.ImageOverlay.extend({
    initialize: function (image, topleft, topright, bottomleft, options) {
        if (typeof image === 'string') {
            this._url = image
        } else {
            // Assume that the first parameter is an instance of HTMLImage or HTMLCanvas
            this._rawImage = image
        }

        this._topLeft = L.latLng(topleft)
        this._topRight = L.latLng(topright)
        this._bottomLeft = L.latLng(bottomleft)

        L.setOptions(this, options)
    },

    onAdd: function (map) {
        if (!this._image) {
            this._initImage()

            if (this.options.opacity < 1) {
                this._updateOpacity()
            }
        }

        if (this.options.interactive) {
            L.DomUtil.addClass(this._rawImage, 'leaflet-interactive')
            this.addInteractiveTarget(this._rawImage)
        }

        map.on('zoomend resetview', this._reset, this)

        this.getPane().appendChild(this._image)
        this._reset()
    },

    onRemove: function (map) {
        map.off('zoomend resetview', this._reset, this)
        L.ImageOverlay.prototype.onRemove.call(this, map)
    },

    _initImage: function () {
        var img = this._rawImage
        if (this._url) {
            img = L.DomUtil.create('img')
            img.style.display = 'none' // Hide while the first transform (zero or one frames) is being done

            if (this.options.crossOrigin) {
                img.crossOrigin = ''
            }

            img.src = this._url
            this._rawImage = img
        }
        L.DomUtil.addClass(img, 'leaflet-image-layer')

        // this._image is reused by some of the methods of the parent class and
        // must keep the name, even if it is counter-intuitive.
        var div = (this._image = L.DomUtil.create(
            'div',
            'leaflet-image-layer ' +
                (this._zoomAnimated ? 'leaflet-zoom-animated' : '')
        ))

        div.appendChild(img)

        div.onselectstart = L.Util.falseFn
        div.onmousemove = L.Util.falseFn

        img.onload = function () {
            this._reset()
            img.style.display = 'block'
            this.fire('load')
        }.bind(this)

        img.alt = this.options.alt
    },

    _reset: function () {
        var div = this._image

        // Project control points to container-pixel coordinates
        var pxTopLeft = this._map.latLngToLayerPoint(this._topLeft)
        var pxTopRight = this._map.latLngToLayerPoint(this._topRight)
        var pxBottomLeft = this._map.latLngToLayerPoint(this._bottomLeft)

        // Infer coordinate of bottom right
        var pxBottomRight = pxTopRight.subtract(pxTopLeft).add(pxBottomLeft)

        // pxBounds is mostly for positioning the <div> container
        var pxBounds = L.bounds([
            pxTopLeft,
            pxTopRight,
            pxBottomLeft,
            pxBottomRight,
        ])
        var size = pxBounds.getSize()
        var pxTopLeftInDiv = pxTopLeft.subtract(pxBounds.min)

        // Calculate the skew angles, both in X and Y
        var vectorX = pxTopRight.subtract(pxTopLeft)
        var vectorY = pxBottomLeft.subtract(pxTopLeft)
        var skewX = Math.atan2(vectorX.y, vectorX.x)
        var skewY = Math.atan2(vectorY.x, vectorY.y)

        // LatLngBounds used for animations
        this._bounds = L.latLngBounds(
            this._map.layerPointToLatLng(pxBounds.min),
            this._map.layerPointToLatLng(pxBounds.max)
        )

        L.DomUtil.setPosition(div, pxBounds.min)

        div.style.width = size.x + 'px'
        div.style.height = size.y + 'px'

        var imgW = this._rawImage.width
        var imgH = this._rawImage.height
        if (!imgW || !imgH) {
            return // Probably because the image hasn't loaded yet.
        }

        var scaleX = (pxTopLeft.distanceTo(pxTopRight) / imgW) * Math.cos(skewX)
        var scaleY =
            (pxTopLeft.distanceTo(pxBottomLeft) / imgH) * Math.cos(skewY)

        this._rawImage.style.transformOrigin = '0 0'

        this._rawImage.style.transform =
            'translate(' +
            pxTopLeftInDiv.x +
            'px, ' +
            pxTopLeftInDiv.y +
            'px)' +
            'skew(' +
            skewY +
            'rad, ' +
            skewX +
            'rad) ' +
            'scale(' +
            scaleX +
            ', ' +
            scaleY +
            ') '
    },

    reposition: function (topleft, topright, bottomleft) {
        this._topLeft = L.latLng(topleft)
        this._topRight = L.latLng(topright)
        this._bottomLeft = L.latLng(bottomleft)
        this._reset()
    },
})

L.imageOverlay.rotated = function (
    imgSrc,
    topleft,
    topright,
    bottomleft,
    options
) {
    return new L.ImageOverlay.Rotated(
        imgSrc,
        topleft,
        topright,
        bottomleft,
        options
    )
}
