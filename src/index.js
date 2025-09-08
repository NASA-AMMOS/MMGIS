import React, { StrictMode } from 'react'
import { render } from 'react-dom'
import './index.css'

import RefreshAuth from './pre/RefreshAuth'

import $ from 'jquery'
import L from './external/Leaflet/leaflet1.5.1' // './external/Leaflet/leaflet1.5.1_DEBUG' //
import ld from './external/Leaflet/leaflet.draw'
import pd from './external/Leaflet/Path.Drag'
import lgu from './external/Leaflet/leaflet.geometryutil'
import ls from './external/Leaflet/leaflet.snap'
import lc from './external/Leaflet/leaflet-corridor'
import lp from './external/Leaflet/leaflet-pip'
import lit from './external/Leaflet/leaflet-imagetransform'
import llg from './external/Leaflet/leaflet-latlng-graticule'
import lp4 from './external/Leaflet/proj4'
import lpl from './external/Leaflet/proj4leaflet'
import le from './external/Leaflet/leaflet-editable'
import lh from './external/Leaflet/leaflet.hotline'
import lpd from './external/Leaflet/leaflet.polylineDecorator'
import lpat from './external/Leaflet/leaflet.pattern'
import lsf from './external/Leaflet/leaflet.scalefactor.min'
import ltm from './essence/Basics/Layers_/leaflet-tilelayer-middleware'
import ltl from './external/Leaflet/leaflet.tilelayer.gl'
import lvg from './external/Leaflet/leaflet.vectorGrid.bundled'
import lrm from './external/Leaflet/leaflet.rotatedMarker'
import lv from './external/Leaflet/leaflet-velocity'
import lr from './external/Leaflet/L.Rain'
import lpm from './external/Leaflet/Leaflet.PolylineMeasure'

import THREE from './external/THREE/three118.js'
import OrbitControls from './external/THREE/OrbitControls'
import PointerLockControls from './external/THREE/PointerLockControls'
import DeviceOrientationControls from './external/THREE/DeviceOrientationControls'
import ThreeSky from './external/THREE/ThreeSky'
import { MeshLine, MeshLineMaterial } from './external/THREE/MeshLine'
import OBJLoader from './external/THREE/OBJLoader'
import MTLLoader from './external/THREE/MTLLoader'
import ColladaLoader from './external/THREE/ColladaLoader'
import GLTFLoader from './external/THREE/GLTFLoader'
import LineWidthPR from './external/THREE/LineWidthPR'
import WebGLWireframes from './external/THREE/WebGLWireframes'
import WebVR from './external/THREE/WebVR'
import VRController from './external/THREE/VRController'
import Detector from './external/THREE/Detector'
import VRControls from './external/THREE/VRControls'
import ThreeAR from './external/THREE/three.ar'

import OpenSeadragon from './external/OpenSeadragon/openseadragon'
import fabricOverlay from './external/OpenSeadragon/openseadragon-fabricjs-overlay'
import fabricA from './external/OpenSeadragon/fabric.adapted'
import rsp from './external/svelte-range-slider-pips/svelte-range-slider-pips'

import './fonts/materialdesignicons/css/materialdesignicons.min.css'
import './external/Leaflet/leaflet1.5.1.css'
import './external/Leaflet/leaflet.draw.css'
import './css/external/leaflet.label.css'
import './external/MetricsGraphics/metricsgraphics.css'
import './external/MetricsGraphics/metricsgraphics-dark.css'
import './external/DataTables/datatables.css'
import './css/mmgis.css'
import './css/mmgisUI.css'
import './css/tools.css'
import 'tippy.js/dist/tippy.css'

import App from './App'
import * as serviceWorker from './serviceWorker'

render(
    <StrictMode>
        <App />
    </StrictMode>,
    document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
