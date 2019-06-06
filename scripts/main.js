//Start MMWebGIS
require(['essence', 'jquery', 'landingPage'], function(s, $, landingPage) {
    $.getJSON(
        'config/configconfig.json' + '?nocache=' + new Date().getTime(),
        function(data) {
            var u = window.location.href.split('?s=')
            if (!u[1]) {
                //Not a shortened URL
                landingPage.init(data.missions)
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
                        landingPage.init(data.missions)
                    },
                    function(e) {
                        landingPage.init(data.missions, true)
                    }
                )
            }
        }
    )
})
