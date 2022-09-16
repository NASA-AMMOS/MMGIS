import $ from 'jquery'
import * as d3 from 'd3'

import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'

import './LayerUpdatedControl.css'

const BUTTON_TYPES = {
    RELOAD: {
        html: '<i class="mdi mdi-reload-alert mdi-18p"></i>',
        title: 'Reload the entire MMGIS page',
    },
    ADD_LAYER: {
        html: '<i class="mdi mdi-triangle mdi-18p"></i>',
        title: 'Add new layer',
    },
}

// Borrowed from https://github.com/Leaflet/Leaflet/blob/main/src/control/Control.Zoom.js
var LayerUpdatedControl = L.Control.extend({
    options: {
        position: 'topright',
        //buttonText: '<i class="mdi mdi-triangle mdi-18p"></i>',
        //buttonTitle: 'Some text here',
        type: 'ADD_LAYER',
    },
    onAdd: function (map) {
        console.log("----- LayerUpdatedControl onRemove -----")
        var className = 'leaflet-control-update-layer'
        var container = L.DomUtil.create('div', className + ' leaflet-bar')
        var options = this.options

        this._updateLayerButton = this._createButton(BUTTON_TYPES[options.type].html, BUTTON_TYPES[options.type].title,
                "leaflet-control-update-layer-icon", container, this._zoomIn)

        if (options.remaining && options.remaining > 0) {
            var number = L.DomUtil.create('span', 'update-layer-icon-text', this._updateLayerButton)
            number.text = 1
        }

        L.DomEvent.on(this._updateLayerButton, 'click', this._click)
        L.DomEvent.disableClickPropagation(this._updateLayerButton)

        return container
    },

    onRemove: function (map) {
        console.log("----- LayerUpdatedControl onRemove -----")
        L.DomEvent.off(this._updateLayerButton, 'click', this._click)

        L.DomUtil.remove(this._updateLayerButton)
        this._updateLayerButton.setAttribute('aria-disabled', 'false')
    },

    disable: function () {
        this._disabled = true;
        this._updateDisabled();
        return this;
    },

    enable: function () {
        this._disabled = false;
        this._updateDisabled();
        return this;
    },

    _zoomIn: function (e) {
        if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
            this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
        }
    },

    _createButton: function (html, title, className, container, fn) {
        var link = L.DomUtil.create('a', className, container);
        link.innerHTML = html;
        link.href = '#';
        link.title = title;

        /*
         * Will force screen readers like VoiceOver to read this as "Zoom in - button"
         */
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', title);
        return link;
    },
    _click: function(e) {
        console.log("clicked", event)
    },
});

export default LayerUpdatedControl
