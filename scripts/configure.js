// Configure Require.js
var require = {
    //relative to the index calling it
    baseUrl: 'scripts',
    //Some browsers suspend script loading on inactive tabs so disable script load timeouts
    waitSeconds: 0,
    paths: {
        //core
        loading: 'pre/loading/loading',
        landingPage: 'essence/LandingPage/LandingPage',
        essence: 'essence/essence',

        //externals
        attributions: 'external/attributions',

        arc: 'external/Arc/arc',

        colorPicker: 'external/ColorPicker/jqColorPicker.min',

        d3: 'external/D3/d3.v4.min',
        d33: 'external/D3/d3.v3.min', //!!!chemistryplot.js still uses

        jquery: 'external/JQuery/jquery.min',
        jqueryUI: 'external/JQuery/jquery-ui',
        mark: 'external/JQuery/jquery.mark.min',

        leaflet: 'external/Leaflet/leaflet1.5.1',
        leafletDraw: 'external/Leaflet/leaflet.draw',
        leafletGeometryUtil: 'external/Leaflet/leaflet.geometryutil',
        leafletSnap: 'external/Leaflet/leaflet.snap',
        leafletCorridor: 'external/Leaflet/leaflet-corridor',
        leafletPip: 'external/Leaflet/leaflet-pip',
        leafletImageTransform: 'external/Leaflet/leaflet-imagetransform',
        proj4: 'external/Leaflet/proj4-compressed',
        proj4leaflet: 'external/Leaflet/proj4leaflet',
        leafletEditable: 'external/Leaflet/leaflet-editable',
        leafletHotline: 'external/Leaflet/leaflet.hotline.min',
        leafletPolylineDecorator: 'external/Leaflet/leaflet.polylineDecorator',
        leafletScaleFactor: 'external/Leaflet/leaflet.scalefactor.min',
        leafletColorFilter: 'external/Leaflet/leaflet-tilelayer-colorfilter',
        leafletTileLayerGL: 'external/Leaflet/leaflet.tilelayer.gl',
        leafletVectorGrid: 'external/Leaflet/leaflet.vectorGrid.bundled',

        metricsGraphics: 'external/MetricsGraphics/metricsgraphics.min',
        openSeadragon: 'external/OpenSeadragon/openseadragon.min',
        fabricA: 'external/OpenSeadragon/fabric.adapted',
        fabricOverlay: 'external/OpenSeadragon/openseadragon-fabricjs-overlay',
        dataTables: 'external/DataTables/datatables.min',
        nipple: 'external/NippleJS/nipplejs.min',
        multiRange: 'external/MultiRange/multirange',
        jsonViewer: 'external/JSONViewer/jquery.json-viewer',
        fileSaver: 'external/FileSaver/FileSaver.min',

        Hammer: 'external/Hammer/hammer.min',

        HTML2Canvas: 'external/HTML2Canvas/html2canvas.min',

        png: 'external/PNG/png',
        zlib: 'external/PNG/zlib',

        semantic: 'external/SemanticUI/semantic.min',

        shp: 'external/shpjs/shapefile',
        shpwrite: 'external/SHPWrite/shpwrite',

        three: 'external/THREE/three',
        threeWindow: 'external/THREE/threeWindow',
        threeCore: 'external/THREE/three112.min',
        OrbitControls: 'external/THREE/OrbitControls',
        PointerLockControls: 'external/THREE/PointerLockControls',
        DeviceOrientationControls: 'external/THREE/DeviceOrientationControls',
        ThreeSky: 'external/THREE/ThreeSky',
        MeshLine: 'external/THREE/MeshLine',
        OBJLoader: 'external/THREE/OBJLoader',
        MTLLoader: 'external/THREE/MTLLoader',
        ColladaLoader: 'external/THREE/ColladaLoader',
        LineWidthPR: 'external/THREE/LineWidthPR',
        WebGLWireframes: 'external/THREE/WebGLWireframes',
        WebVR: 'external/THREE/WebVR',
        VRController: 'external/THREE/VRController',
        Detector: 'external/THREE/Detector',
        VRControls: 'external/THREE/VRControls',
        ThreeAR: 'external/THREE/three.ar',

        turf: 'external/Turf/turf5.1.6.min',
        turfLegacy: 'external/Turf/turf.min',
        highcharts: 'external/Highcharts',
        //essences
        //basics
        Layers_: 'essence/Basics/Layers_/Layers_',
        //viewer
        Viewer_: 'essence/Basics/Viewer_/Viewer_',
        Photosphere: 'essence/Basics/Viewer_/Photosphere',
        ModelViewer: 'essence/Basics/Viewer_/ModelViewer',
        //map
        Map_: 'essence/Basics/Map_/Map_',
        //globe
        Globe_: 'essence/Basics/Globe_/Globe_',
        Cameras: 'essence/Basics/Globe_/Cameras',
        container: 'essence/Basics/Globe_/container',
        projection: 'essence/Basics/Globe_/projection',
        renderer: 'essence/Basics/Globe_/renderer',
        scene: 'essence/Basics/Globe_/scene',
        shaders: 'essence/Basics/Globe_/shaders',
        Globe_AR: 'essence/Basics/Globe_/Addons/Globe_AR',
        Globe_Compass: 'essence/Basics/Globe_/Addons/Globe_Compass',
        Globe_Walk: 'essence/Basics/Globe_/Addons/Globe_Walk',
        Globe_VectorsAsTiles:
            'essence/Basics/Globe_/Addons/Globe_VectorsAsTiles',
        Globe_Radargrams: 'essence/Basics/Globe_/Addons/Globe_Radargrams',
        //other
        Formulae_: 'essence/Basics/Formulae_/Formulae_',
        ToolController_: 'essence/Basics/ToolController_/ToolController_',
        UserInterface_: 'essence/Basics/UserInterface_/UserInterface_',
        Test_: 'essence/Basics/Test_/Test_',

        //ancillary
        CursorInfo: 'essence/Ancillary/CursorInfo',
        ContextMenu: 'essence/Ancillary/ContextMenu',
        Coordinates: 'essence/Ancillary/Coordinates',
        DataShaders: 'essence/Ancillary/DataShaders',
        Description: 'essence/Ancillary/Description',
        Login: 'essence/Ancillary/Login/Login',
        PanelChanger: 'essence/Ancillary/PanelChanger',
        ScaleBar: 'essence/Ancillary/ScaleBar',
        ScaleBox: 'essence/Ancillary/ScaleBox',
        Swap: 'essence/Ancillary/Swap',
        Search: 'essence/Ancillary/Search',
        QueryURL: 'essence/Ancillary/QueryURL',
        SiteChanger: 'essence/Ancillary/SiteChanger',
        Sprites: 'essence/Ancillary/Sprites',
    },
    shim: {
        //externals
        jqueryUI: { deps: ['jquery'], exports: '$' },
        mark: { deps: ['jquery'], exports: '$' },

        leaflet: { exports: 'L' },
        leafletDraw: { deps: ['leaflet'] },
        leafletGeometryUtil: { deps: ['leaflet'] },
        leafletSnap: {
            deps: ['leaflet', 'leafletDraw', 'leafletGeometryUtil'],
        },
        leafletCorridor: { deps: ['leaflet'] },
        leafletPip: { deps: ['leaflet'] },
        leafletImageTransform: { deps: ['leaflet'] },
        proj4: { deps: ['leaflet'] },
        proj4leaflet: { deps: ['leaflet', 'proj4'] },
        leafletEditable: { deps: ['leaflet'] },
        leafletPolylineDecorator: { deps: ['leaflet'] },
        leafletScaleFactor: { deps: ['leaflet'] },
        leafletColorFilter: { deps: ['leaflet'] },
        leafletTileLayerGL: { deps: ['leaflet'] },
        leafletVectorGrid: { deps: ['leaflet'] },

        metricsGraphics: { deps: ['jquery', 'd3'] },
        dataTables: { deps: ['jquery'] },

        fabricOverlay: { deps: ['openSeadragon'] },
        fabricA: { exports: 'fabric' },

        png: { deps: ['zlib'] },

        semantic: { deps: ['jquery'] },

        threeCore: { exports: 'THREE' },
        OrbitControls: { deps: ['threeWindow'], exports: 'THREE' },
        PointerLockControls: { deps: ['threeCore'], exports: 'THREE' },
        DeviceOrientationControls: { deps: ['threeCore'], exports: 'THREE' },
        ThreeSky: { deps: ['threeCore'], exports: 'THREE' },
        Photosphere: { deps: ['threeCore'], exports: 'THREE' },
        ModelViewer: { deps: ['threeCore'], exports: 'THREE' },
        MeshLine: { deps: ['threeCore'], exports: 'THREE' },
        OBJLoader: { deps: ['threeCore'], exports: 'THREE' },
        MTLLoader: { deps: ['threeCore'], exports: 'THREE' },
        ColladaLoader: { deps: ['threeCore'], exports: 'THREE' },
        LineWidthPR: { deps: ['threeCore'], exports: 'THREE' },
        WebGLWireframes: { deps: ['threeCore'], exports: 'THREE' },
        WebVR: { deps: ['threeCore'], exports: 'THREE' },
        VRController: { deps: ['threeCore'], exports: 'THREE' },
        VRControls: { deps: ['threeCore'], exports: 'THREE' },
        ThreeAR: { deps: ['threeCore'], exports: 'THREE' },
        highcharts: { deps: ['jquery'], exports: 'Highcharts' },
    },
    wrapShim: true,
    map: {
        '*': {
            css: 'css.min', // or whatever the path to require-css is
        },
    },
    findNestedDependencies: false,
    packages: [
        {
            name: 'highcharts',
            main: 'highcharts',
        },
    ],
}

if (!mmgisglobal.toolConfigs.hasOwnProperty('Kinds')) {
    console.warn('Error: Kinds tool not found. Are you missing a config.js?')
}

//Now add toolConfigs
for (let c in mmgisglobal.toolConfigs) {
    //First add paths
    for (let p in mmgisglobal.toolConfigs[c].paths) {
        if (!require.paths.hasOwnProperty(p)) {
            require.paths[p] = mmgisglobal.toolConfigs[c].paths[p]
        } else {
            console.warn(
                'Failed to add tool to configuration as path already exists: ' +
                    p
            )
        }
    }
    //Then add shim
    for (let s in mmgisglobal.toolConfigs[c].shim) {
        if (!require.shim.hasOwnProperty(s)) {
            require.shim[s] = mmgisglobal.toolConfigs[c].shim[s]
        } else {
            console.warn(
                'Failed to add tool to configuration as shim already exists: ' +
                    s
            )
        }
    }
}
