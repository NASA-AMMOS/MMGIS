import Description from '../../UserInterface_/components/Description/Description'

import $ from 'jquery'

import { parseConfig } from './config'

export async function init(L_, configData, missionsList, urlOnLayers) {
    await parseConfig(L_, configData, urlOnLayers)
    L_.missionsList = missionsList
}

export function onceLoaded(L_, cb) {
    if (L_._loaded === true) cb()
    else L_._onLoadCallbacks.push(cb)
}

export function loaded(L_) {
    L_._loaded = true
    L_._onLoadCallbacks.forEach((cb) => {
        cb()
    })
    L_._onLoadCallbacks = []
}

export function clear(L_) {
    L_.mission = null
    L_.missionPath = null
    L_.missionsList = []
    L_.site = null
    L_.view = null
    L_.radius = null
    L_.masterdb = false
    L_.Viewer_ = null
    L_.Map_ = null
    L_.Globe_ = null
    L_.UserInterface_ = null
    L_.tools = null
    L_.configData = null
    L_.layers = {
        data: {},
        dataFlat: [],
        layer: {},
        attachments: {},
        toggled: {},
        opacity: {},
        filters: {},
    }
    L_._layersOrdered = []
    L_._layersLoaded = []
    L_._layersParent = {}
    L_._localTimeFilterCache = {}
    L_.FUTURES = {
        site: null,
        mapView: null,
        globeView: null,
        globeCamera: null,
        panelPercents: null,
        activePoint: null,
        centerPin: null,
    }
    L_.searchStrings = null
    L_.searchFile = null
    L_.toolsLoaded = false
    L_.activeFeature = null
    L_.lastActiveFeature = {
        layerName: null,
        lat: null,
        lon: null,
        key: null,
        value: null,
    }
}

export function fina(
    L_,
    viewer_,
    map_,
    globe_,
    userinterface_,
    coordinates,
    timecontrol_
) {
    L_.Viewer_ = viewer_
    L_.Map_ = map_
    L_.Globe_ = globe_
    L_.UserInterface_ = userinterface_
    L_.Coordinates = coordinates
    L_.TimeControl_ = timecontrol_
}

export function fullyLoaded(L_) {
    L_.selectPoint(L_.FUTURES.activePoint)

    // Search is now a React component (SearchBar) mounted in TopBar.jsx
    // It initializes itself via useEffect when L_.layers.data is available
    Description.updateInfo()

    $('#main-container').css('filter', '')
    $('.LoadingPage').animate(
        {
            opacity: 0,
        },
        1400,
        function () {
            $('.LoadingPage').remove()
        }
    )
}

export function setSite(L_, newSite, newView, dontSetGlobe) {
    if (newSite != undefined && newSite != null) {
        L_.site = newSite
        if (newView != null) {
            L_.view = newView

            if (L_.FUTURES.activePoint == null) {
                L_.Map_.resetView(newView)
                if (!dontSetGlobe && L_.hasGlobe) {
                    L_.Globe_.litho.setCenter(newView)
                }
            }
        }
    } else console.log('Failure updating to new site')
}

export function home(L_) {
    L_.Map_.resetView(L_.configData.msv.view)
    L_.Globe_.litho.setCenter(L_.configData.msv.view)
}

export function setGlobalLoading(L_, uuid) {
    L_._globalLoadings.push(uuid)
    L_._globalLoadings = [...new Set(L_._globalLoadings)]
    clearTimeout(L_._globalLoadingsTimeout)
    L_._globalLoadingsTimeout = setTimeout(() => {
        $('#dataLoadingSpinner').css({ opacity: 1 })
    }, 500)
}

export function setGlobalLoaded(L_, uuid) {
    L_._globalLoadings = L_._globalLoadings.filter(function (id) {
        return id !== uuid
    })
    if (L_._globalLoadings.length === 0) {
        clearTimeout(L_._globalLoadingsTimeout)
        $('#dataLoadingSpinner').css({ opacity: 0 })
    }
}
