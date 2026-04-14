import React from 'react'
import essence from './essence/essence'
import $ from 'jquery'
import LandingPage from './essence/LandingPage/LandingPage'
import F_ from './essence/Basics/Formulae_/Formulae_'

import calls from './pre/calls'

import UserInterfaceLayout from './essence/Basics/UserInterface_/components/UserInterfaceLayout'

// Feature flag: The primary initialization of window.mmgisglobal.useReactUI
// happens in public/index.html (before any bundled JS runs) so that
// UserInterface_.js sees the correct value during ES module evaluation.
//
// NOTE: This IIFE runs AFTER ES module imports have resolved, so it cannot
// affect UserInterface_.js module selection (which happens at import time).
// It only ensures the flag is set for runtime checks (e.g., App() render,
// $(document).ready guard in UserInterfaceDefault_.js). In normal operation,
// index.html always sets the flag first; this is a defensive fallback for
// non-standard bootstrap scenarios where index.html's inline script didn't run.
;(function initReactUIFlag() {
    if (typeof window.mmgisglobal === 'undefined') window.mmgisglobal = {}
    if (window.mmgisglobal.useReactUI == null) {
        window.mmgisglobal.useReactUI = false
    }
    // Environment variable override (set at build time via webpack DefinePlugin).
    // Only apply if index.html didn't already handle it (e.g., via URL param).
    // This avoids overriding ?reactui=false when REACT_UI=true is set.
    if (
        window.mmgisglobal._reactUISetByHTML == null &&
        typeof process !== 'undefined' &&
        process.env &&
        process.env.REACT_UI === 'true'
    ) {
        window.mmgisglobal.useReactUI = true
    }
})()

//Start MMGIS
$(document).ready(function () {
    const browser = F_.getBrowser()
    if (browser === 'firefox') {
        $('body').css({
            'scrollbar-color': 'var(--color-a2) transparent',
            'scrollbar-width': 'thin',
        })
    }

    calls.api(
        'get_generaloptions',
        {},
        function (resp) {
            mmgisglobal.options = resp.options
            initApp()
        },
        function (err) {
            mmgisglobal.options = {}
            initApp()
        }
    )
})

function initApp() {
    if (window.mmgisglobal.FORCE_CONFIG_PATH) {
        const u = window.location.href.split('?s=')
        if (!u[1]) {
            //Not a shortened URL
            LandingPage.init(null, false, window.mmgisglobal.FORCE_CONFIG_PATH)
        } else {
            calls.api(
                'shortener_expand',
                {
                    short: u[1],
                },
                function (s) {
                    //Set and update the url
                    const url = u[0] + s.body.url
                    window.history.replaceState('', '', url)

                    LandingPage.init(
                        null,
                        false,
                        window.mmgisglobal.FORCE_CONFIG_PATH
                    )
                },
                function (e) {
                    LandingPage.init(
                        null,
                        true,
                        window.mmgisglobal.FORCE_CONFIG_PATH
                    )
                }
            )
        }
    } else {
        calls.api(
            'missions',
            {},
            function (s) {
                const missions = (s.missions || [])
                    .slice()
                    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                continueOn(missions)
            },
            function (e) {
                continueOn([])
            }
        )

        function continueOn(missions) {
            const u = window.location.href.split('?s=')
            if (!u[1]) {
                //Not a shortened URL
                LandingPage.init(missions)
            } else {
                calls.api(
                    'shortener_expand',
                    {
                        short: u[1],
                    },
                    function (s) {
                        //Set and update the url
                        const url = u[0] + s.body.url
                        window.history.replaceState('', '', url)
                        LandingPage.init(missions)
                    },
                    function (e) {
                        LandingPage.init(missions, true)
                    }
                )
            }
        }
    }
}

function App() {
    if (window.mmgisglobal.useReactUI) {
        return (
            <div className='App'>
                <UserInterfaceLayout />
            </div>
        )
    }
    return <div className='App'></div>
}

export default App
