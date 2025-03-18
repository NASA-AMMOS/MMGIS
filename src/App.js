import React from 'react'
import essence from './essence/essence'
import $ from 'jquery'
import LandingPage from './essence/LandingPage/LandingPage'
import F_ from './essence/Basics/Formulae_/Formulae_'

import calls from './pre/calls'

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
                continueOn(s.missions)
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
    return <div className='App'></div>
}

export default App
