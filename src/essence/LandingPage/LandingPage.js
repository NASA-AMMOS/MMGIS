import React from 'react'
import { createRoot } from 'react-dom/client'
import s from '../essence'
import QueryURL from '../services/QueryURL'
import calls from '../../pre/calls'
import { mmgisAPI_ } from '../mmgisAPI/mmgisAPI'
import LandingPageView, {
    MissionNotFound,
    isListedMission,
    getLandingOptions,
} from './LandingPage.jsx'

import './LandingPage.css'

let root = null

function mount(element) {
    unmount()
    const container = document.createElement('div')
    container.id = 'landingPageRoot'
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(element)
}

function unmount() {
    if (root) {
        root.unmount()
        root = null
    }
    const container = document.getElementById('landingPageRoot')
    if (container) container.remove()
}

export default {
    init: function (missions, forceError, forceConfig, missionsMeta) {
        if (forceError) {
            makeMissionNotFoundDiv()
            return
        }

        // Skip loading the landing page if the preview mode is controlling the config
        if (QueryURL.getSingleQueryVariable('_preview')) {
            if (typeof mmgisAPI_.onLoadCallback === 'function') {
                mmgisAPI_.onLoadCallback()
                mmgisAPI_.onLoadCallback = null
            }
            return
        }

        missions = missions || []
        missionsMeta = missionsMeta || {}

        var missionUrl
        var forceLanding =
            QueryURL.getSingleQueryVariable('forcelanding') || false

        if (!forceConfig) {
            missionUrl = QueryURL.checkIfMission()

            //If there's only one listed mission, go straight to it
            const opts = getLandingOptions()
            const listed = missions.filter((m) =>
                isListedMission(m, missionsMeta, opts)
            )
            if (listed.length == 1 && !forceLanding) missionUrl = listed[0]
        }

        if (
            missionUrl == false &&
            !forceLanding &&
            window.mmgisglobal.MAIN_MISSION != null &&
            window.mmgisglobal.MAIN_MISSION != '' &&
            window.mmgisglobal.MAIN_MISSION != 'undefined' &&
            typeof window.mmgisglobal.MAIN_MISSION === 'string' &&
            window.mmgisglobal.MAIN_MISSION.length > 0 &&
            (window.mmgisglobal.AUTH !== 'local' ||
                missions.includes(window.mmgisglobal.MAIN_MISSION))
        ) {
            missionUrl = window.mmgisglobal.MAIN_MISSION
        }

        if (missionUrl == false && !forceConfig) {
            mount(
                <LandingPageView
                    missions={missions}
                    missionsMeta={missionsMeta}
                    onSelectMission={(name) => {
                        unmount()
                        loadMission(name, missions)
                    }}
                />
            )
        } else if (forceConfig) {
            loadConfigJson(forceConfig, missions, 'error')
        } else {
            loadMission(missionUrl, missions)
        }
    },
}

function loadConfigJson(jsonUrl, missions, logLevel) {
    fetch(jsonUrl + '?nocache=' + new Date().getTime())
        .then((r) => {
            if (!r.ok) throw new Error(r.statusText)
            return r.json()
        })
        .then((data) => s.init(data, missions))
        .catch(() => {
            console[logLevel]("Warning: Couldn't load: " + jsonUrl)
            makeMissionNotFoundDiv()
        })
}

function loadMission(missionName, missions) {
    if (window.mmgisglobal.SERVER == 'node') {
        calls.api(
            'get',
            { mission: missionName, full: true },
            function (response) {
                // Extract DB mission name and attach to config
                const config = response.config || response
                if (response.mission) {
                    config._dbMissionName = response.mission
                }
                s.init(config, missions)
            },
            function () {
                console.warn(
                    "Warning: Couldn't load: " + missionName + ' configuration.'
                )
                makeMissionNotFoundDiv()
            }
        )
    } else {
        loadConfigJson('Missions/' + missionName + '/config.json', missions, 'warn')
    }
}

export const makeMissionNotFoundDiv = () => {
    mount(<MissionNotFound />)
}
