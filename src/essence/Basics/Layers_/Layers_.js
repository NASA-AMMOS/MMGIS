// Holds all layer data
import * as lifecycle from './lifecycle/lifecycle'
import * as subscriptions from './lifecycle/subscriptions'
import { parseConfig } from './lifecycle/config'
import * as tree from './hierarchy/tree'
import * as geojson from './data/geojson'
import * as visibility from './display/visibility'
import * as style from './display/style'
import * as sublayers from './display/sublayers'
import * as selection from './features/selection'
import * as annotations from './features/annotations'
import * as getters from './inspect/getters'

const L_ = {
    url: window.location.href,
    mission: null,
    missionPath: null,
    missionsList: [],
    recentMissions: [],
    site: null,
    view: null,
    radius: null,
    masterdb: false,
    Viewer_: null,
    Map_: null,
    Globe_: null,
    UserInterface_: null,
    TimeControl_: null,
    tools: null,
    _toolCopyables: {},
    //The full, unchanged data
    configData: null,
    layers: {
        data: {}, // layersNamed but by uuid
        dataFlat: [], //layersData
        layer: {}, // layersGroup
        attachments: {}, // layersGroupSubLayers
        on: {}, // toggledArray
        opacity: {}, // opacityArray
        filters: {}, // layerFilters
        nameToUUID: {},
        refreshIntervals: {}, // In order to reloadLayer
        refreshFailed: {}, // Track layers with failed refreshes
    },
    // ===== Private ======
    //Index -> layer name
    _layersOrdered: [], // 78 uses
    //Index -> had loaded (T/F) (same index as orderedLayers)
    _layersLoaded: [], // 27 uses
    //Name -> parent
    _layersParent: {}, // 5 uses
    //
    _localTimeFilterCache: {},
    //FUTURES
    FUTURES: {
        site: null,
        viewerImg: null,
        mapView: null,
        globeView: null,
        globeCamera: null,
        panelPercents: null,
    },
    //URL search strings
    searchStrings: null,
    GEOJSON_PRECISION: 10,
    //URL search file
    searchFile: null,
    toolsLoaded: false,
    addedfiles: {}, //filename -> null (not null if added)
    activeFeature: null,
    lastActiveFeature: {
        layerName: null,
        type: null, // point, line, polygon
        lat: null,
        lon: null,
        key: null, // if not a point, a property field to a unique value
        value: null,
    },
    // features manually turned off
    toggledOffFeatures: [],
    mapAndGlobeLinked: false,
    addLayerQueue: [],
    _layersBeingMade: {}, // Global layer construction lock (default for main map; offscreen maps use their own)
    _onLoadCallbacks: [],
    _loaded: false,
    init(...a) {
        return lifecycle.init(L_, ...a)
    },
    onceLoaded(...a) {
        return lifecycle.onceLoaded(L_, ...a)
    },
    loaded(...a) {
        return lifecycle.loaded(L_, ...a)
    },
    clear(...a) {
        return lifecycle.clear(L_, ...a)
    },
    fina(...a) {
        return lifecycle.fina(L_, ...a)
    },
    fullyLoaded(...a) {
        return lifecycle.fullyLoaded(L_, ...a)
    },
    setSite(...a) {
        return lifecycle.setSite(L_, ...a)
    },
    _timeChangeSubscriptions: {},
    subscribeTimeChange(...a) {
        return subscriptions.subscribeTimeChange(L_, ...a)
    },
    unsubscribeTimeChange(...a) {
        return subscriptions.unsubscribeTimeChange(L_, ...a)
    },
    _timeLayerReloadFinishSubscriptions: {},
    subscribeTimeLayerReloadFinish(...a) {
        return subscriptions.subscribeTimeLayerReloadFinish(L_, ...a)
    },
    unsubscribeTimeLayerReloadFinish(...a) {
        return subscriptions.unsubscribeTimeLayerReloadFinish(L_, ...a)
    },
    _onTimeUIToggleSubscriptions: {},
    subscribeOnTimeUIToggle(...a) {
        return subscriptions.subscribeOnTimeUIToggle(L_, ...a)
    },
    unsubscribeOnTimeUIToggle(...a) {
        return subscriptions.unsubscribeOnTimeUIToggle(L_, ...a)
    },
    _onLayerToggleSubscriptions: {},
    subscribeOnLayerToggle(...a) {
        return subscriptions.subscribeOnLayerToggle(L_, ...a)
    },
    unsubscribeOnLayerToggle(...a) {
        return subscriptions.unsubscribeOnLayerToggle(L_, ...a)
    },
    _onSpecificLayerToggleSubscriptions: {},
    subscribeOnSpecificLayerToggle(...a) {
        return subscriptions.subscribeOnSpecificLayerToggle(L_, ...a)
    },
    unsubscribeOnSpecificLayerToggle(...a) {
        return subscriptions.unsubscribeOnSpecificLayerToggle(L_, ...a)
    },
    getUrl(...a) {
        return getters.getUrl(L_, ...a)
    },
    toggleLayer(...a) {
        return visibility.toggleLayer(L_, ...a)
    },
    toggleLayerHelper(...a) {
        return visibility.toggleLayerHelper(L_, ...a)
    },
    _refreshAnnotationEvents(...a) {
        return sublayers._refreshAnnotationEvents(L_, ...a)
    },
    setSublayerOpacity(...a) {
        return sublayers.setSublayerOpacity(L_, ...a)
    },
    toggleSublayer(...a) {
        return sublayers.toggleSublayer(L_, ...a)
    },
    setAttachmentVisibility(...a) {
        return sublayers.setAttachmentVisibility(L_, ...a)
    },
    disableAllBut(...a) {
        return visibility.disableAllBut(L_, ...a)
    },
    addVisible(...a) {
        return visibility.addVisible(L_, ...a)
    },
    addGeoJSONData(...a) {
        return geojson.addGeoJSONData(L_, ...a)
    },
    clearGeoJSONData(...a) {
        return geojson.clearGeoJSONData(L_, ...a)
    },
    setStyle(...a) {
        return style.setStyle(L_, ...a)
    },
    setActiveFeature(...a) {
        return selection.setActiveFeature(L_, ...a)
    },
    highlight(...a) {
        return selection.highlight(L_, ...a)
    },
    toggleFeature(...a) {
        return visibility.toggleFeature(L_, ...a)
    },
    unhideAllFeatures(...a) {
        return visibility.unhideAllFeatures(L_, ...a)
    },
    enforceVisibilityCutoffs(...a) {
        return visibility.enforceVisibilityCutoffs(L_, ...a)
    },
    _setVisibilityCutoffInternal(...a) {
        return visibility._setVisibilityCutoffInternal(L_, ...a)
    },
    getFirstCoordinate(...a) {
        return selection.getFirstCoordinate(L_, ...a)
    },
    addArrowToMap(...a) {
        return annotations.addArrowToMap(L_, ...a)
    },
    createAnnotation(...a) {
        return annotations.createAnnotation(L_, ...a)
    },
    removePopupStopPropogationFunctions(...a) {
        return annotations.removePopupStopPropogationFunctions(L_, ...a)
    },
    addGradientPolyline(...a) {
        return sublayers.addGradientPolyline(L_, ...a)
    },
    removeGradientPolyline(...a) {
        return sublayers.removeGradientPolyline(L_, ...a)
    },
    setLayerOpacity(...a) {
        return style.setLayerOpacity(L_, ...a)
    },
    getLayerOpacity(...a) {
        return style.getLayerOpacity(L_, ...a)
    },
    setLayerFilter(...a) {
        return style.setLayerFilter(L_, ...a)
    },
    resetLayerFills(...a) {
        return style.resetLayerFills(L_, ...a)
    },
    home(...a) {
        return lifecycle.home(L_, ...a)
    },
    hasTool(...a) {
        return getters.hasTool(L_, ...a)
    },
    getToolVars(...a) {
        return getters.getToolVars(L_, ...a)
    },
    setLastActiveFeature(...a) {
        return selection.setLastActiveFeature(L_, ...a)
    },
    selectFeature(...a) {
        return selection.selectFeature(L_, ...a)
    },
    getDynamicProps(...a) {
        return getters.getDynamicProps(L_, ...a)
    },
    convertGeoJSONLngLatsToPrimaryCoordinates(...a) {
        return geojson.convertGeoJSONLngLatsToPrimaryCoordinates(L_, ...a)
    },
    asLayerUUID(...a) {
        return getters.asLayerUUID(L_, ...a)
    },
    selectPoint(...a) {
        return selection.selectPoint(L_, ...a)
    },
    _selectPointViewHelper(...a) {
        return selection._selectPointViewHelper(L_, ...a)
    },
    reorderLayers(...a) {
        return tree.reorderLayers(L_, ...a)
    },
    clearVectorLayer(...a) {
        return geojson.clearVectorLayer(L_, ...a)
    },
    removeLayerHelper(...a) {
        return tree.removeLayerHelper(L_, ...a)
    },
    trimVectorLayerKeepBeforeTime(...a) {
        return geojson.trimVectorLayerKeepBeforeTime(L_, ...a)
    },
    trimVectorLayerKeepAfterTime(...a) {
        return geojson.trimVectorLayerKeepAfterTime(L_, ...a)
    },
    trimVectorLayerHelper(...a) {
        return geojson.trimVectorLayerHelper(L_, ...a)
    },
    keepFirstN(...a) {
        return geojson.keepFirstN(L_, ...a)
    },
    keepLastN(...a) {
        return geojson.keepLastN(L_, ...a)
    },
    keepNHelper(...a) {
        return geojson.keepNHelper(L_, ...a)
    },
    trimLineString(...a) {
        return geojson.trimLineString(L_, ...a)
    },
    appendLineString(...a) {
        return geojson.appendLineString(L_, ...a)
    },
    updateVectorLayer(...a) {
        return geojson.updateVectorLayer(L_, ...a)
    },
    syncSublayerData(...a) {
        return sublayers.syncSublayerData(L_, ...a)
    },
    clearVectorLayerInfo(...a) {
        return geojson.clearVectorLayerInfo(L_, ...a)
    },
    globeLithoLayerHelper(...a) {
        return tree.globeLithoLayerHelper(L_, ...a)
    },
    parseConfig(...a) {
        return parseConfig(L_, ...a)
    },

    resetConfig(...a) {
        return tree.resetConfig(L_, ...a)
    },
    modifyLayer(...a) {
        return tree.modifyLayer(L_, ...a)
    },
    addLayerToLayersData(...a) {
        return tree.addLayerToLayersData(L_, ...a)
    },
    removeLayerFromLayersData(...a) {
        return tree.removeLayerFromLayersData(L_, ...a)
    },
    expandLayersToArray(...a) {
        return tree.expandLayersToArray(L_, ...a)
    },
    updateLayersHelper(...a) {
        return tree.updateLayersHelper(L_, ...a)
    },
    autoUpdateLayer(...a) {
        return tree.autoUpdateLayer(L_, ...a)
    },
    updateQueueLayers(...a) {
        return tree.updateQueueLayers(L_, ...a)
    },
    timeFilterVectorLayer(...a) {
        return geojson.timeFilterVectorLayer(L_, ...a)
    },
    _updatePairings(...a) {
        return sublayers._updatePairings(L_, ...a)
    },
    getLayersChosenNamePropVal(...a) {
        return getters.getLayersChosenNamePropVal(L_, ...a)
    },
    getFeaturesAtPoint(...a) {
        return selection.getFeaturesAtPoint(L_, ...a)
    },
    propertiesToImages(...a) {
        return getters.propertiesToImages(L_, ...a)
    },
    _globalLoadings: [],
    _globalLoadingsTimeout: null,
    setGlobalLoading(...a) {
        return lifecycle.setGlobalLoading(L_, ...a)
    },
    setGlobalLoaded(...a) {
        return lifecycle.setGlobalLoaded(L_, ...a)
    },
    getListOfUsedGeoDatasets(...a) {
        return getters.getListOfUsedGeoDatasets(L_, ...a)
    },
}


window.L_ = L_
export default L_
