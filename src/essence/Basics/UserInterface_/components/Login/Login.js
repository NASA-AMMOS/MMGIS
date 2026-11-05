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
  "<div id='loginModalProviders'></div>" +
  "<form id='loginForm' accept-charset='UTF-8'>" +
    "<div class='field'>" +
      "<label id='loginUsernameLabel' for='loginUsernameInput'>Username</label>" +
      "<input id='loginUsernameInput' name='username' type='text' maxlength='255' autocomplete='username' autocapitalize='none' spellcheck='false'>" +
      "<i id='loginUsernameInputIcon' style='opacity: 0;'></i>" +
    "</div>" +
    "<div id='loginEmail' class='field' style='display: none'>" +
      "<label for='loginEmailInput'>Email</label>" +
      "<input id='loginEmailInput' placeholder='name" + emailSuffix + "' name='email' type='text' autocomplete='email'>" +
      "<i id='loginEmailInputIcon' style='opacity: 0;'></i>" +
      "<div class='loginFieldDescription'>An email is optional.</div>" +
    "</div>" +
    "<div class='field'>" +
      "<label for='loginPasswordInput'>Password</label>" +
      "<input id='loginPasswordInput' name='password' type='password' autocomplete='current-password'>" +
      "<i id='loginPasswordInputIcon' style='opacity: 0;'></i>" +
      "<div id='loginPasswordDescription' class='loginFieldDescription' style='display: none'>Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.</div>" +
      "<div id='loginModalHint' class='loginFieldDescription' style='display: none'></div>" +
    "</div>" +
    "<div id='loginRetypePassword' class='field' style='display: none'>" +
      "<label for='loginRetypePasswordInput'>Retype Password</label>" +
      "<input id='loginRetypePasswordInput' name='retypepassword' type='password' autocomplete='new-password'>" +
      "<i id='loginRetypePasswordInputIcon' style='opacity: 0;'></i>" +
    "</div>" +
        "<input id='loginSubmit' type='submit' name='Submit' value='Log In'></input>" +
    "<div id='loginInUpToggleWrapper'><div id='loginInUpToggle' role='button' tabindex='0'>or sign up</div></div>" +
  "</form>" +
  "<div id='loginProviderLinks'></div>" +
  "<div id='loginErrorMessage' role='alert' aria-live='assertive' style='opacity: 0;'>Invalid username or password</div>";

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
    // Providers that take a username and password in the modal's form (GET /api/auth loginForms)
    loginForms: null,
    activeForm: null,
    // What the signed-in provider is called, e.g. "Example Directory"
    providerTitle: null,
    // Its icon (an mdi name), shown as a badge on the account avatar
    providerIcon: null,
    init: function () {
        if (window.mmgisglobal.SITE_ACCESS === 'public') return
        if (
            (window.mmgisglobal.authProviders.includes('proxy') ||
                window.mmgisglobal.SITE_ACCESS === 'optional' ||
                (window.mmgisglobal.SITE_ACCESS === 'required' && window.mmgisglobal.authProviders.includes('local'))) &&
            window.mmgisglobal.hasOwnProperty('user')
        ) {
            // The page template HTML-escapes the name; keep the raw name so it's escaped once where shown
            this.username = new DOMParser().parseFromString(
                String(window.mmgisglobal.user),
                'text/html'
            ).documentElement.textContent
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
            Login.fetchAuth(() => Login.updateAccountProvider())
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
            .text(Login.loggedIn ? Login.username[0] : ''))

        if (Login.loggedIn) Login.updateAccountProvider()

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
            const toProxy = () => {
                window.location.href =
                    window.mmgisglobal.PROXY_LOGOUT_URL || '/ssologoutredirect'
            }
            // Also end any local MMGIS sign-in (e.g. an admin) made behind the proxy
            calls.api('logout', {}, toProxy, toProxy)
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
            Login.providerTitle = null
            Login.providerIcon = null
            Login.providerLogoutUrl = null
            Login.updateAccountProvider()
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
                if (Login.provider) Login.fetchAuth(() => Login.updateAccountProvider())

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
        $('#loginPasswordInput').attr('autocomplete', signUp ? 'new-password' : 'current-password')
        $('#loginSubmit').val(signUp ? 'Sign Up' : 'Log In')
        $('#loginInUpToggle').html(signUp ? 'or log in' : 'or sign up')
    },
    // The provider the user signed in with, for the account avatar's badge and menu (null for local accounts)
    signedInWith: function () {
        if (!Login.loggedIn || !Login.provider || Login.provider === 'local' || !Login.providerTitle) return null
        return {
            title: Login.providerTitle,
            icon: /^[a-z0-9-]+$/.test(Login.providerIcon || '') ? Login.providerIcon : 'account-outline',
        }
    },
    updateAccountProvider: function () {
        window.mmgisglobal.accountProvider = Login.signedInWith()
        document.dispatchEvent(new CustomEvent('mmgis:accountprovider'))
    },
    // GET /api/auth once: the login forms, login buttons and provider names
    fetchAuth: function (done) {
        if (Login.providerLinks) {
            if (done) done()
            return
        }
        const root = window.mmgisglobal.ROOT_PATH ? window.mmgisglobal.ROOT_PATH + '/' : ''
        $.ajax({
            type: 'GET',
            url: `${root}api/auth`,
            xhrFields: { withCredentials: true },
            success: (d) => {
                Login.providerLinks = (d && d.loginLinks) || []
                Login.loginForms = (d && d.loginForms) || []
                const p = ((d && d.providers) || []).find((x) => x.id === Login.provider)
                if (p) {
                    Login.providerTitle = p.label
                    Login.providerIcon = p.icon || null
                }
                if (done) done()
            },
        })
    },
    // The provider switch (several form providers) or banner (one that isn't local accounts)
    renderForms: function () {
        if (!Login.loginForms) return
        const forms = Login.loginForms
        const el = $('#loginModalProviders').empty()
        if (Login.signUp) {
            // Admins create local accounts
            Login.selectForm(null)
            return
        }
        if (forms.length === 0) {
            $('#loginModal #loginForm').hide()
            $('#loginModalLead').text('Choose how to log in.')
            return
        }
        $('#loginModal #loginForm').show()
        if (forms.length > 1) {
            $('#loginModalLead').text('Choose your account type.')
            const tabs = $('<div>')
                .addClass('loginProviders')
                .attr({ role: 'tablist', 'aria-label': 'Account type' })
            forms.forEach((f) => {
                tabs.append(
                    $('<button>')
                        .addClass('loginProvider')
                        .attr({ type: 'button', role: 'tab', 'data-id': f.id, title: f.title })
                        .append($('<i>').addClass(`mdi mdi-${f.icon}`).attr('aria-hidden', 'true'))
                        .append($('<span>').text(f.title))
                        .on('click', () => Login.selectForm(f.id))
                )
            })
            el.append(tabs)
        } else if (forms[0].id !== 'local') {
            $('#loginModalLead').text('')
            const f = forms[0]
            const text = $('<div>')
                .append($('<small>').text('Sign in with'))
                .append($('<b>').text(f.title))
            if (f.hint) text.append($('<span>').text(f.hint))
            el.append(
                $('<div>')
                    .addClass('loginBanner')
                    .append($('<i>').addClass(`mdi mdi-${f.icon}`).attr('aria-hidden', 'true'))
                    .append(text)
            )
        }
        let remembered = null
        try {
            remembered = localStorage.getItem('mmgisLoginProvider')
        } catch (err) {}
        Login.selectForm(remembered)
    },
    selectForm: function (id) {
        const forms = Login.loginForms || []
        const form = Login.signUp ? null : forms.find((f) => f.id === id) || forms[0] || null
        Login.activeForm = form
        $('#loginModalProviders .loginProvider').each(function () {
            const on = form != null && $(this).attr('data-id') === form.id
            $(this).toggleClass('active', on).attr('aria-selected', on ? 'true' : 'false')
        })
        $('#loginUsernameLabel').text(form ? form.usernameLabel : 'Username')
        // A single provider shows its hint in the banner instead
        const hint = form && forms.length > 1 ? form.hint : ''
        $('#loginModalHint').text(hint).css('display', hint ? 'block' : 'none')
        // Sign-up is only for local accounts
        const local = form == null || form.id === 'local'
        $('#loginModal #loginInUpToggle').toggle(
            local && (Login.signUp || window.mmgisglobal.SELF_SIGNUP !== 'false')
        )
    },
    // Only a successful sign-in is remembered, so a shared browser doesn't keep someone else's mistaken choice
    rememberForm: function () {
        if (!Login.activeForm || (Login.loginForms || []).length < 2) return
        try {
            localStorage.setItem('mmgisLoginProvider', Login.activeForm.id)
        } catch (err) {}
    },
    // Shown in the modal, like the login page; a failure may just be the wrong account type
    // (status 409, 503 aren't a wrong account type)
    showError: function (message, status) {
        const text =
            (Login.loginForms || []).length > 1 && (!status || status === 401)
                ? `${message} ${
                      !Login.activeForm || Login.activeForm.id === 'local'
                          ? 'If your account was moved to another sign-in, choose it above.'
                          : 'If you sign in with an MMGIS password, choose MMGIS account above; otherwise ask an administrator.'
                  }`
                : message
        $('#loginErrorMessage').stop(true).text(text).css('opacity', '1')
    },
    // Signs in with a provider other than local accounts (JSON POST to its login_path)
    formProviderLogin: function (values) {
        const root = window.mmgisglobal.ROOT_PATH ? window.mmgisglobal.ROOT_PATH + '/' : ''
        const form = Login.activeForm
        // A directory that doesn't answer takes up to LDAP_TIMEOUT_MS
        const button = $('#loginSubmit')
        if (button.prop('disabled')) return
        const label = button.val()
        button.prop('disabled', true).val('Signing in…')
        $.ajax({
            type: 'POST',
            url: `${root}${form.path}`,
            contentType: 'application/json',
            data: JSON.stringify({ username: values.username, password: values.password }),
            xhrFields: { withCredentials: true },
            complete: () => button.prop('disabled', false).val(label),
            success: (d) => {
                if (d && d.status === 'success') {
                    Login.username = d.username
                    window.mmgisglobal.user = d.username
                    window.mmgisglobal.groups = d.groups || []
                    Login.provider = d.provider || form.id
                    Login.providerTitle = form.title
                    Login.providerIcon = form.icon || null
                    Login.providerLogoutUrl = d.logoutUrl || null
                    Login.providerPerRequest = false
                    Login.rememberForm()
                    loginSuccess(d, false, true)
                } else Login.showError((d && d.message) || 'Login failed.')
            },
            error: (xhr) => {
                Login.showError(
                    (xhr && xhr.responseJSON && xhr.responseJSON.message) || 'Login failed.',
                    xhr && xhr.status
                )
            },
        })
    },
    // Buttons for providers whose plugin.json sets "login_path" and not "login_form"
    renderProviderLinks: function () {
        const root = window.mmgisglobal.ROOT_PATH ? window.mmgisglobal.ROOT_PATH + '/' : ''
        const draw = (links) => {
            const el = $('#loginProviderLinks').empty()
            if (!links || links.length === 0) return
            const returnTo = window.location.pathname + window.location.search
            if ((Login.loginForms || []).length > 0)
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
        Login.fetchAuth(() => {
            Login.renderForms()
            draw(Login.providerLinks)
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
            Login.renderForms()
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
                if (validate.username && validate.password && Login.activeForm && Login.activeForm.id !== 'local') {
                    Login.formProviderLogin(values)
                } else if (validate.username && validate.password) {
                    calls.api(
                        'login',
                        values,
                        function (d) {
                            Login.username = values.username
                            window.mmgisglobal.user = Login.username
                            window.mmgisglobal.groups = d.groups
                            Login.rememberForm()
                            loginSuccess(d, false, true)
                        },
                        function (d) {
                            Login.showError(
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
        Login.opener = document.activeElement
        this.createModal()
        $('#loginModal').attr({ role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'loginModalHeading' })
        // Esc closes; Tab stays inside the dialog
        $('#loginModalWrapper').on('keydown', function (e) {
            if (e.key === 'Escape') {
                e.preventDefault()
                Login.closeModal()
                return
            }
            if (e.key !== 'Tab') return
            const focusable = $('#loginModal')
                .find('input, button, a[href], [tabindex="0"]')
                .filter(':visible')
                .toArray()
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            } else if (!$('#loginModal')[0].contains(document.activeElement)) {
                e.preventDefault()
                first.focus()
            }
        })
        setTimeout(() => {
            $('#loginModalWrapper').addClass('active')
            const input = $('#loginUsernameInput:visible')
            if (input.length) input.trigger('focus')
            else $('#loginModal').find('a[href], button').filter(':visible').first().trigger('focus')
        }, 100)
    },
    closeModal: function () {
        $('#loginModalWrapper').removeClass('active')
        if (Login.opener && document.body.contains(Login.opener)) Login.opener.focus()
        Login.opener = null
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
            .text(Login.username[0])

        if (Login.loggedIn) Login.updateAccountProvider()
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
