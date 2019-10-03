//Start MMWebGIS
require(['essence', 'jquery', 'landingPage'], function(s, $, landingPage) {
    if (mmgisglobal.FORCE_CONFIG_PATH) {
        var u = window.location.href.split('?s=')
        if (!u[1]) {
            //Not a shortened URL
            landingPage.init(null, false, mmgisglobal.FORCE_CONFIG_PATH)
        } else {
            calls.api(
                'shortener_expand',
                {
                    short: u[1],
                },
                function(s) {
                    //Set and update the url
                    var url = u[0] + s.body.url
                    window.history.replaceState('', '', url)

                    landingPage.init(null, false, mmgisglobal.FORCE_CONFIG_PATH)
                },
                function(e) {
                    landingPage.init(null, true, mmgisglobal.FORCE_CONFIG_PATH)
                }
            )
        }
    } else {
        if (mmgisglobal.SERVER == 'node' && !mmgisglobal.CONFIGCONFIG_PATH)
            calls.api(
                'missions',
                {},
                function(s) {
                    continueOn(s.missions)
                },
                function(e) {
                    continueOn([])
                }
            )
        else
            $.getJSON(
                (mmgisglobal.CONFIGCONFIG_PATH || 'config/configconfig.json') +
                    '?nocache=' +
                    new Date().getTime(),
                function(data) {
                    continueOn(data.missions)
                }
            )
        function continueOn(missions) {
            var u = window.location.href.split('?s=')
            if (!u[1]) {
                //Not a shortened URL
                landingPage.init(missions)
            } else {
                calls.api(
                    'shortener_expand',
                    {
                        short: u[1],
                    },
                    function(s) {
                        //Set and update the url
                        var url = u[0] + s.body.url
                        window.history.replaceState('', '', url)
                        landingPage.init(missions)
                    },
                    function(e) {
                        landingPage.init(missions, true)
                    }
                )
            }
        }
    }
})
