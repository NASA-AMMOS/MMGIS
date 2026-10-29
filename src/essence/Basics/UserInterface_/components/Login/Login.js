//Depends on a div with id 'topBar'
import $ from 'jquery'
import F_ from '../../../Formulae_/Formulae_'
import L_ from '../../../Layers_/Layers_'
import ToolController_ from '../../../ToolController_/ToolController_'
import tippy from 'tippy.js'

import calls from '../../../../../pre/calls'
import Toast from '../../../../../design-system/components/Toast/Toast'

import './Login.css'

// Pages restored from the back/forward cache can show a signed-out user as signed in
window.addEventListener('pageshow', (e) => {
    if (e.persisted && window.mmgisglobal.SITE_ACCESS !== 'public')
        window.location.reload()
})

var emailSuffix = '@domain.com'
var mmgisLogoURL = 'public/images/logos/mmgis.png'

// prettier-ignore
var modalFormSignIn =
  "<img id='loginModalLogo' src='" + mmgisLogoURL + "' alt='MMGIS' />" +
  "<div id='loginModalHeading'><span id='loginModalTitle'>Log in</span> <span id='loginModalTitleRest'>to your account.</span></div>" +
  "<div id='loginModalLead'></div>" +
  "<form id='loginForm' accept-charset='UTF-8'>" +
    "<div class='field'>" +
      "<label id='loginUsernameLabel' for='loginUsernameInput'>Username</label>" +
      "<input id='loginUsernameInput' name='username' type='text' autocomplete='off'>" +
      "<i id='loginUsernameInputIcon' style='opacity: 0;'></i>" +
    "</div>" +
    "<div id='loginEmail' class='field' style='display: none'>" +
      "<label for='loginEmailInput'>Email</label>" +
      "<input id='loginEmailInput' placeholder='name" + emailSuffix + "' name='email' type='text' autocomplete='off'>" +
      "<i id='loginEmailInputIcon' style='opacity: 0;'></i>" +
      "<div class='loginFieldDescription'>An email is optional.</div>" +
    "</div>" +
    "<div class='field'>" +
      "<label for='loginPasswordInput'>Password</label>" +
      "<input id='loginPasswordInput' name='password' type='password' autocomplete='off'>" +
      "<i id='loginPasswordInputIcon' style='opacity: 0;'></i>" +
      "<div id='loginPasswordDescription' class='loginFieldDescription' style='display: none'>Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.</div>" +
    "</div>" +
    "<div id='loginRetypePassword' class='field' style='display: none'>" +
      "<label for='loginRetypePasswordInput'>Retype Password</label>" +
      "<input id='loginRetypePasswordInput' name='retypepassword' type='password' autocomplete='off'>" +
      "<i id='loginRetypePasswordInputIcon' style='opacity: 0;'></i>" +
    "</div>" +
    "<input id='loginSubmit' type='submit' name='Submit' value='Log In'></input>" +
    "<div id='loginInUpToggleWrapper'><div id='loginInUpToggle' role='button' tabindex='0'>or sign up</div></div>" +
  "</form>" +
  "<div id='loginProviderLinks'></div>" +
  "<div id='loginErrorMessage' style='opacity: 0;'>Invalid username or password</div>";

var validate = {
    username: false,
    email: false,
    password: false,
    retypepassword: false,
}

var Login = {
    loginBar: null,
    loggedIn: false,
    username: null,
    signUp: false,
    beganLoggedIn: false,
    // The non-local provider this browser is signed in through, if any
    provider: null,
    providerLogoutUrl: null,
    providerPerRequest: false,
    providerLinks: null,
    init: function () {
        if (window.mmgisglobal.SITE_ACCESS === 'public') return
        if (
            (window.mmgisglobal.authProviders.includes('proxy') ||
                window.mmgisglobal.SITE_ACCESS === 'optional' ||
                (window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local'))) &&
            window.mmgisglobal.hasOwnProperty('user')
        ) {
            this.username = window.mmgisglobal.user
            if (this.username != 'guest') {
                this.loggedIn = true
                this.beganLoggedIn = true
            }
        }
        // Set by the server on production builds
        const loginProvider = window.mmgisglobal.loginProvider
        if (typeof loginProvider === 'string' && loginProvider !== '' && loginProvider !== 'local' && !loginProvider.startsWith('#{')) {
            this.provider = loginProvider
            this.providerPerRequest = window.mmgisglobal.loginPerRequest === 'true'
            this.providerLogoutUrl = window.mmgisglobal.logoutUrl || null
        }

        Login.loginBar = $('<div>')
            .attr('id', 'loginDiv')
            .css({
                'display': 'flex',
                'z-index': '2006',
                'color': '#aaa',
                'mix-blend-mode': 'luminosity'
            })
        $('#topBarRight').append(Login.loginBar)

        Login.loginBar
            .append($('<div>')
            .attr('id', 'loginUser')
            .css({
                'text-align': 'center',
                'font-size': '12px',
                'font-weight': 'bold',
                'font-family': 'sans-serif',
                'margin-left': '5px',
                'cursor': 'pointer',
                'width': '30px',
                'height': '30px',
                'line-height': '30px',
                'color': 'white',
                'background': Login.loggedIn ? 'var(--color-a)' : 'transparent',
                'display': Login.loggedIn ? 'block' : 'none',
                'text-transform': 'uppercase',
                'transition': 'opacity 0.2s ease-out'
            })
            .html(Login.loggedIn ? Login.username[0] : ''))

        if (Login.loggedIn) {
            if (window._tippyLoginUser && window._tippyLoginUser[0])
                window._tippyLoginUser[0].setContent(Login.username)
            else
                window._tippyLoginUser = tippy('#loginUser', {
                    content: Login.username,
                    placement: 'bottom-end',
                    theme: 'blue',
                    allowHTML: true,
                })
        }

        //Show signup for admins
        if (
            (window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local')) &&
            window.mmgisglobal.role === 'superadmin'
        ) {
            const forceSignupButton = $('<div>')
                .attr('id', 'forceSignupButton')
                .css({
                    'text-align': 'center',
                    'cursor': 'pointer',
                    'width': '30px',
                    'height': '30px',
                    'line-height': '26px',
                    'margin-right': '4px',
                    'background': 'var(--color-a)',
                    'pointer-events': 'all'
                })
                .on('click', function () {
                    //Open login
                    //default to signup
                    Login.signUp = true
                    $('#loginEmail').css({ display: 'block' })
                    $('#loginRetypePassword').css({ display: 'block' })
                    $('#loginSubmit').val('Sign Up')
                    $('#loginInUpToggle').html('or log in')
                    //and open modal
                    Login.openModal()
                })
            forceSignupButton.append($('<i>')
                .attr('id', 'forceSignupButtonIcon')
                .attr('class', 'mdi mdi-account-multiple mdi-18px'))
            Login.loginBar.append(forceSignupButton)
        }

        const loginoutButton = $('<div>')
            .attr('id', 'loginoutButton')
            .attr('title', Login.loggedIn ? 'Logout' : 'Login')
            .attr('tabindex', 500)
            .on('click', function () {
                if (Login.loggedIn) {
                    Login.logout()
                } else {
                    //Open login
                    //default to login
                    Login.signUp = false
                    $('#loginEmail').css({ display: 'none' })
                    $('#loginRetypePassword').css({ display: 'none' })
                    $('#loginSubmit').val('Sign In')
                    $('#loginInUpToggle').html('or sign up')
                    //and open modal
                    Login.openModal()
                }
            })
        loginoutButton.append($('<i>')
            .attr('id', 'loginoutButtonIcon')
            .attr(
                'class',
                Login.loggedIn
                    ? 'mdi mdi-logout mdi-18px'
                    : 'mdi mdi-login mdi-18px'
            ))
        Login.loginBar.append(loginoutButton)

        // Sign in at page load from cookie if possible
        if (
            window.mmgisglobal.SITE_ACCESS !== 'public' &&
            !window.mmgisglobal.authProviders.includes('proxy') &&
            window.mmgisglobal.SKIP_CLIENT_INITIAL_LOGIN != 'true'
        ) {
            Login.initialLogin()
        }
    },
    // Logs the current user out. `onDone` is called after a non-redirecting
    // logout completes (i.e. not for proxy redirects or SITE_ACCESS=required reloads).
    logout: function (onDone) {
        if (Login.provider === 'proxy' && Login.beganLoggedIn) {
            Login.loggedIn = false
            window.location.href = window.mmgisglobal.PROXY_LOGOUT_URL || '/ssologoutredirect'
            return
        }
        // Signed in on every request by a proxy: only the proxy can sign the user out
        if (Login.provider && Login.providerPerRequest) {
            if (Login.providerLogoutUrl) window.location.href = Login.providerLogoutUrl
            else Toast.error('Sign out through your login provider.')
            return
        }
        const username = Login.username || window.mmgisglobal.user
        // The server clears its session before checking the token cookie, so
        // a "No user." failure still means the user is logged out.
        const finish = function () {
            ToolController_.closeActiveTool()
            window.mmgisglobal.user = 'guest'
            window.mmgisglobal.groups = []

            Login.username = null
            Login.loggedIn = false
            $('#loginUser').css('display', 'none').html('')
            $('#loginoutButton').attr('title', 'Login')
            $('#loginoutButtonIcon').attr('class', 'mdi mdi-login mdi-18px')

            document.cookie =
                'MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;'

            // Then end the login at the provider too
            const providerLogoutUrl = Login.providerLogoutUrl
            Login.provider = null
            Login.providerLogoutUrl = null
            if (providerLogoutUrl) {
                window.location.href = providerLogoutUrl
                return
            }

            if ((window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local'))) {
                reloadToLogin()
                return
            }
            document.dispatchEvent(new CustomEvent('mmgis:loginchange'))
            Toast.success('Logged out')
            if (typeof onDone === 'function') onDone()
        }
        calls.api(
            'logout',
            { username: username },
            finish,
            function (d) {
                if (d && d.message === 'No user.') {
                    finish()
                    return
                }
                Toast.error(
                    'Logout failed' +
                        (d && d.message ? ': ' + d.message : '')
                )
            }
        )
    },
    initialLogin() {
        calls.api(
            'login',
            {
                useToken: true,
            },
            function (d) {
                Login.username = d.username
                window.mmgisglobal.user = Login.username
                window.mmgisglobal.groups = d.groups
                Login.provider = d.provider || null
                Login.providerLogoutUrl = d.logoutUrl || null
                Login.providerPerRequest = d.perRequest === true

                loginSuccess(d)
            },
            function (d) {
                loginSuccess(d, true)
            }
        )
    },
    setSignUpView: function (signUp) {
        Login.signUp = signUp
        $('#loginModalTitle').text(signUp ? 'Sign up' : 'Log in')
        $('#loginModalTitleRest').text(signUp ? 'for an account.' : 'to your account.')
        $('#loginModalLead').html(
            signUp
                ? ''
                : window.mmgisglobal.SELF_SIGNUP === 'false'
                  ? 'If you do not have an account,<br>request one from your administrator.'
                  : 'If you do not have an account,<br>sign up or request one from your administrator.'
        )
        $('#loginEmail').css({ display: signUp ? 'block' : 'none' })
        $('#loginRetypePassword').css({ display: signUp ? 'block' : 'none' })
        $('#loginPasswordDescription').css({ display: signUp ? 'block' : 'none' })
        $('#loginSubmit').val(signUp ? 'Sign Up' : 'Log In')
        $('#loginInUpToggle').html(signUp ? 'or log in' : 'or sign up')
    },
    // Buttons for providers whose plugin.json sets "login_path"
    renderProviderLinks: function () {
        const root = window.mmgisglobal.ROOT_PATH ? window.mmgisglobal.ROOT_PATH + '/' : ''
        const draw = (links) => {
            const el = $('#loginProviderLinks').empty()
            if (!links || links.length === 0) return
            const returnTo = window.location.pathname + window.location.search
            if (window.mmgisglobal.authProviders.includes('local'))
                el.append($('<div>').addClass('loginProviderOr').text('or'))
            links.forEach((link) => {
                el.append(
                    $('<a>')
                        .addClass('loginProviderBtn')
                        .attr('href', link.url || `${root}${link.path}?returnTo=${encodeURIComponent(returnTo)}`)
                        .text(link.label)
                )
            })
        }
        if (Login.providerLinks) return draw(Login.providerLinks)
        $.ajax({
            type: 'GET',
            url: `${root}api/auth`,
            xhrFields: { withCredentials: true },
            success: (d) => {
                Login.providerLinks = (d && d.loginLinks) || []
                draw(Login.providerLinks)
            },
        })
    },
    createModal: function () {
        this.removeModal()

        const wrapper = $('<div>')
            .attr('id', 'loginModalWrapper')
        // Mount on body when the landing page is up so the modal stacks above it
        const host =
            $('#topBar').length && !$('.landingPage').length
                ? $('#topBar')
                : $('body')
        host.append(wrapper)

        const modal = $('<div>').attr('id', 'loginModal')
        wrapper.append(modal)

        modal.append(
            $('<div>')
                .attr({ id: 'loginModalClose', role: 'button', tabindex: '0', title: 'Close' })
                .html("<i class='mdi mdi-close mdi-18px'></i>")
        )

        modal.append($('<div>').attr('id', 'loginModalBody').html(modalFormSignIn))

        // Admins opening account creation start in sign-up; visitors only see the toggle if they may sign up
        Login.setSignUpView(Login.signUp)
        if (window.mmgisglobal.SELF_SIGNUP === 'false' && !Login.signUp)
            $('#loginModal #loginInUpToggle').hide()
        if (!window.mmgisglobal.authProviders.includes('local')) {
            $('#loginModal #loginForm').hide()
            $('#loginModalLead').text('Choose how to log in.')
        }
        Login.renderProviderLinks()

        $('#loginModal #loginInUpToggle').on('click', function () {
            $('#loginErrorMessage').animate({ opacity: '0' }, 500)
            Login.setSignUpView(!Login.signUp)
        })

        $('#loginUsernameInput').on('change paste keyup', function () {
            var value = $(this).val()
            if (value.length > 0) {
                $('#loginUsernameInputIcon').animate({ opacity: '1' }, 80)
                $('#loginEmailInputIcon').animate({ opacity: '1' }, 80)
                validate.username = true
                validate.email = true
            } else {
                $('#loginUsernameInputIcon').animate({ opacity: '0' }, 80)
                validate.username = false
            }
        })

        $('#loginEmailInput').on('change paste keyup', function () {
            var value = $(this).val()
            if (value.length > 0) {
                $('#loginEmailInputIcon').animate({ opacity: '1' }, 80)
                validate.email = true
            } else {
                $('#loginEmailInputIcon').animate({ opacity: '0' }, 80)
                validate.email = false
            }
        })

        $('#loginPasswordInput').on('change paste keyup', function () {
            var value = $(this).val()
            var retypePass = $('#loginRetypePasswordInput').val()
            if (value.length > 0) {
                $('#loginPasswordInputIcon').animate({ opacity: '1' }, 80)
                validate.password = true
                if (value == retypePass) {
                    $('#loginRetypePasswordInputIcon')
                        .removeClass('red')
                        .removeClass('remove')
                    $('#loginRetypePasswordInputIcon')
                        .addClass('blue')
                        .addClass('checkmark')
                } else {
                    $('#loginRetypePasswordInputIcon')
                        .removeClass('blue')
                        .removeClass('checkmark')
                    $('#loginRetypePasswordInputIcon')
                        .addClass('red')
                        .addClass('remove')
                }
            } else {
                $('#loginPasswordInputIcon').animate({ opacity: '0' }, 80)
                validate.password = false
            }
        })

        $('#loginRetypePasswordInput').on('change paste keyup', function () {
            var value = $(this).val()
            var actualPass = $('#loginPasswordInput').val()
            if (value.length > 0) {
                $('#loginRetypePasswordInputIcon').animate({ opacity: '1' }, 80)
                if (actualPass == value) {
                    $('#loginRetypePasswordInputIcon')
                        .removeClass('red')
                        .removeClass('remove')
                    $('#loginRetypePasswordInputIcon')
                        .addClass('blue')
                        .addClass('checkmark')
                    validate.retypepassword = true
                } else {
                    $('#loginRetypePasswordInputIcon')
                        .removeClass('blue')
                        .removeClass('checkmark')
                    $('#loginRetypePasswordInputIcon')
                        .addClass('red')
                        .addClass('remove')
                    validate.retypepassword = false
                }
            } else {
                $('#loginRetypePasswordInputIcon').animate({ opacity: '0' }, 80)
                validate.retypepassword = false
            }
        })

        $('#loginForm').submit(function (e) {
            e.preventDefault()
            var values = {}
            $.each($(this).serializeArray(), function (i, field) {
                values[field.name] = field.value
            })

            values['mission'] = L_.mission

            if (!Login.signUp) {
                if (validate.username && validate.password) {
                    calls.api(
                        'login',
                        values,
                        function (d) {
                            Login.username = values.username
                            window.mmgisglobal.user = Login.username
                            window.mmgisglobal.groups = d.groups
                            loginSuccess(d, false, true)
                        },
                        function (d) {
                            Toast.error(
                                (d && d.message) || 'Invalid username or password.'
                            )
                        }
                    )
                } else {
                    var errorMessage = ''
                    if (!validate.username)
                        errorMessage += 'Please enter a username.<br>'
                    if (!validate.password)
                        errorMessage += 'Please enter a password.<br>'
                    $('#loginErrorMessage')
                        .html(errorMessage)
                        .animate({ opacity: '1' }, 80)
                }
            } else {
                if (
                    validate.username &&
                    validate.email &&
                    validate.password &&
                    validate.retypepassword
                ) {
                    calls.api(
                        'signup',
                        values,
                        function (d) {
                            //This automatically signed a new user in
                            if ((window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local'))) {
                                //This just flashes blue to show it worked
                                // prettier-ignore
                                $('#loginErrorMessage').animate({ opacity: '0' }, 500)
                                // prettier-ignore
                                $('#loginModal').parent()
                                    .animate({'background-color': 'rgba(46,180,255,0.6)'}, 1000,
                                        function() {
                                            setTimeout(function() {
                                                $('#loginModal').parent().css({'background-color':'rgba(0,0,0,0.6)'})
                                            }, 2000 )
                                        }
                                    )
                            } else {
                                Login.username = d.username
                                window.mmgisglobal.user = Login.username
                                window.mmgisglobal.groups = d.groups
                                loginSuccess(d)
                            }
                        },
                        function (d) {
                            if ((window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local'))) {
                                $('#loginErrorMessage')
                                    .html(d.message)
                                    .animate({ opacity: '1' }, 80)
                            } else {
                                loginSuccess(d)
                            }
                        }
                    )
                } else {
                    var errorMessage = ''
                    if (!validate.username)
                        errorMessage += 'Please enter a username.<br>'
                    if (!validate.email)
                        errorMessage += 'Please enter an email.<br>'
                    if (!validate.password)
                        errorMessage += 'Please enter a password.<br>'
                    if (!validate.retypepassword)
                        errorMessage += 'Please retype password.<br>'
                    $('#loginErrorMessage')
                        .html(errorMessage)
                        .animate({ opacity: '1' }, 80)
                }
            }
            return false
        })

        $('#loginModal').on('click', function (e) {
            // stop the event from bubbling.
            e.stopPropagation()
        })
        $('#loginModalWrapper').on('click', function (e) {
            // stop the event from bubbling.
            Login.closeModal()
        })
        $('#loginModalClose').on('click', function (e) {
            e.stopPropagation()
            Login.closeModal()
        })
        // Enter or Space on the close and sign-up toggle "buttons"
        $('#loginModalClose, #loginModal #loginInUpToggle').on('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                $(this).trigger('click')
            }
        })
    },
    openModal: function () {
        this.createModal()
        setTimeout(() => {
            $('#loginModalWrapper').addClass('active')
        }, 100)
    },
    closeModal: function () {
        $('#loginModalWrapper').removeClass('active')
        setTimeout(() => {
            Login.removeModal()
        }, 250)
    },
    removeModal: function () {
        $('#loginModalWrapper').remove()
    },
}

function loginSuccess(data, ignoreError, fromModal) {
    if (data.status == 'success') {
        // The landing page lists missions for whoever was signed in, so reload it after a login
        const reloadAfter = fromModal === true && !L_.mission
        // Provider sign-ins live in the session; only local logins save a login cookie
        const saveLogin = !data.provider || data.provider === 'local'
        document.cookie = 'MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        if (saveLogin) document.cookie = `MMGISUser=${JSON.stringify({
            username: data.username,
            token: data.token,
        })}${
            mmgisglobal.THIRD_PARTY_COOKIES === 'true'
                ? `; SameSite=None;${
                      mmgisglobal.NODE_ENV === 'production' ? ' Secure' : ''
                  }`
                : ''
        }`

        Login.loggedIn = true
        $('#loginErrorMessage').animate({ opacity: '0' }, 500)
        $('#loginModal')
            .parent()
            .animate(
                { 'background-color': 'rgba(46,180,255,0.6)' },
                1000,
                function () {
                    ToolController_.closeActiveTool()
                    setTimeout(function () {
                        if (reloadAfter) {
                            window.location.reload()
                            return
                        }
                        Login.closeModal()
                        $('#loginForm').trigger('reset')
                        $('#loginModal')
                            .parent()
                            .css({ 'background-color': 'rgba(0,0,0,0.6)' })
                        $('#loginUsernameInputIcon').css({ opacity: '0' })
                        $('#loginEmailInputIcon').css({ opacity: '0' })
                        $('#loginPasswordInputIcon').css({ opacity: '0' })
                        $('#loginRetypePasswordInputIcon').css({
                            opacity: '0',
                        })
                        validate.username = false
                        validate.email = false
                        validate.password = false
                        validate.retypepassword = false
                    }, 600)
                }
            )

        $('#loginButton').html('logout')
        $('#loginoutButton').attr('title', 'Logout')
        $('#loginoutButtonIcon').attr(
            'class',
            'mdi mdi-logout mdi-18px'
        )

        $('#loginUser').attr(
            'title',
            Login.loggedIn ? Login.username : ''
        )

        $('#loginUser')
            .css({
                display: 'block',
                background: Login.loggedIn ? 'var(--color-a)' : 'transparent',
            })
            .html(Login.username[0])

        if (Login.loggedIn) {
            if (window._tippyLoginUser && window._tippyLoginUser[0])
                window._tippyLoginUser[0].setContent(Login.username)
            else
                window._tippyLoginUser = tippy('#loginUser', {
                    content: Login.username,
                    placement: 'bottom-end',
                    theme: 'blue',
                    allowHTML: true,
                })
        }
        document.dispatchEvent(new CustomEvent('mmgis:loginchange'))
    } else {
        document.cookie = 'MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;'

        if ((window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local'))) reloadToLogin()

        if (ignoreError) return

        $('#loginErrorMessage').html(data.message).animate({ opacity: '1' }, 80)
    }
}

function reloadToLogin() {
    let href
    if (window.mmgisglobal.NODE_ENV === 'development')
        href = 'http://localhost:8888'
    else href = window.location.href
    let url = new URL(href)
    //url.searchParams.set('login', 'true')
    window.location.href = url.href
}

export default Login
