//function from https://stackoverflow.com/questions/6312993/javascript-seconds-to-time-string-with-format-hhmmss
String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10) // don't forget the second param
    var hours = Math.floor(sec_num / 3600)
    var minutes = Math.floor((sec_num - hours * 3600) / 60)
    var seconds = sec_num - hours * 3600 - minutes * 60

    if (hours < 10) {
        hours = '0' + hours
    }
    if (minutes < 10) {
        minutes = '0' + minutes
    }
    if (seconds < 10) {
        seconds = '0' + seconds
    }
    return hours + ':' + minutes + ':' + seconds
}

//set interval that checks valid sso
//every 4:30min checks if the token will expire in less than 5min
//refreshes if the user moved their mouse in the past 20min
if (mmgisglobal.SERVER == 'node' && mmgisglobal.AUTH == 'csso') {
    console.log(
        '%cAUTH_REFRESH ON',
        'background: #006280; padding: 0px 4px 0px 4px;'
    )
    //Add your own login/logout redirects
    function ssologout() {
        window.location.href = '/ssologoutredirect'
    }
    function ssologin() {
        window.location.href =
            '/ssologinredirect?redirect=' + window.location.href
    }

    mmgisglobal.lastInteraction = Math.floor(Date.now() / 1000)
    var _refreshAuth_checkEvery = 60000 * 10 //milliseconds
    var _refreshAuth_expiringLessThan = 60 * 11 //seconds
    var _refreshAuth_interactedPast = 60000 * 30 //milliseconds

    function ssorefresh() {
        var request = new XMLHttpRequest()
        request.open('Post', '/ssostatus', true)
        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                var result = request.responseText
                result = JSON.parse(result)

                var now = Math.floor(Date.now() / 1000)

                if (mmgisglobal.SHOW_AUTH_TIMEOUT) {
                    var append = false

                    var elm = document.getElementById('AUTH_TIMEOUT')
                    if (elm == null) {
                        elm = document.createElement('div')
                        append = true
                    }
                    elm.id = 'AUTH_TIMEOUT'
                    elm.style.cssText =
                        'position:fixed;left:225px;bottom:0px;z-index:11000;font-family:monospace;font-size:11px;color:#121626;'
                    elm.innerHTML =
                        'Authentication expiring in ' +
                        (result.exp - now).toString().toHHMMSS() +
                        '<div onclick="ssologin()" style="cursor:pointer;">Login again to renew</div>'

                    if (append) document.body.appendChild(elm)
                }

                if (result.authenticated) {
                    if (
                        mmgisglobal.lastInteraction +
                            _refreshAuth_interactedPast <=
                        now
                    ) {
                        ssologout()
                    } else if (
                        now + _refreshAuth_expiringLessThan >=
                        result.inactivity_timeout
                    ) {
                        var refresh = new XMLHttpRequest()
                        refresh.open('Post', '/ssorefreshtimeout', true)
                        refresh.onload = function () {
                            if (refresh.status >= 200 && refresh.status < 400) {
                                var result = refresh.responseText
                                result = JSON.parse(result)
                                if (!result.success) {
                                    ssologout()
                                }
                            } else {
                                ssologout()
                            }
                        }
                        refresh.onerror = function () {
                            ssologout()
                        }
                        refresh.send()
                    }
                } else {
                    ssologout()
                }
            } else {
                ssologout()
            }
        }

        request.onerror = function () {
            ssologout()
        }

        request.send()
    }

    ssorefresh()
    setInterval(ssorefresh, _refreshAuth_checkEvery)
}
