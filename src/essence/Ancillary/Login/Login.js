//Depends on a div with id 'topBar'
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'
import tippy from 'tippy.js'

import calls from '../../../pre/calls'

import './Login.css'

var emailSuffix = '@domain.com'
var mmgisLogoURL = 'public/images/logos/mmgis.png'

// prettier-ignore
var modalFormSignIn =
  "<img src='" + mmgisLogoURL + "' alt='Full logo' style='position: relative; left: 50%; transform: translateX(-50%);' />" +
  "<form id='loginForm' class='ui form segment' style='background: transparent; width: 300px; border: none; box-shadow: none; margin: auto;' accept-charset='UTF-8'>" +
    "<div class='field'>" +
      "<label id='loginUsernameLabel' style='color: #CCC;'>Username</label>" +
      "<div class='ui icon input'>" +
        "<input id='loginUsernameInput' placeholder='Username' name='username' type='text' autocomplete='off'>" +
        "<i id='loginUsernameInputIcon' class='inverted blue checkmark icon' style='opacity: 0;'></i>" +
      "</div>" +
    "</div>" +
    "<div id='loginEmail' class='field' style='display: none'>" +
      "<label style='color: #CCC;'>Email</label>" +
      "<div class='ui icon input'>" +
        "<input id='loginEmailInput' placeholder='Email" + emailSuffix + "' name='email' type='text' autocomplete='off'>" +
        "<i id='loginEmailInputIcon' class='inverted blue checkmark icon' style='opacity: 0;'></i>" +
      "</div>" +
    "</div>" +
    "<div class='field'>" +
      "<label style='color: #CCC;'>Password</label>" +
      "<div class='ui icon input'>" +
        "<input id='loginPasswordInput' placeholder='Password' name='password' type='password' autocomplete='off'>" +
        "<i id='loginPasswordInputIcon' class='inverted blue checkmark icon' style='opacity: 0;'></i>" +
      "</div>" +
    "</div>" +
    "<div id='loginRetypePassword' class='field' style='display: none'>" +
      "<label style='color: #CCC;'>Retype Password</label>" +
      "<div class='ui icon input'>" +
        "<input id='loginRetypePasswordInput' placeholder='Retype Password' name='retypepassword' type='password' autocomplete='off'>" +
        "<i id='loginRetypePasswordInputIcon' class='inverted blue checkmark icon' style='opacity: 0;'></i>" +
      "</div>" +
    "</div>" +
    "<input id='loginSubmit' type='submit' name='Submit' value='Sign In' class='ui primary submit button' style='width: 100%; margin-top: 13px;'></input>" +
    "<div id='loginInUpToggle' class='ui small button' style='width: 80px; margin-left: 95px; padding: 10px 0 0 0; background: transparent;'>or sign up</div>" +
  "</form>" +
  "<div id='loginErrorMessage' style='text-align: center; font-size: 16px; font-weight: bold; color: #F88; border: 2px solid #F88; border-radius: 4px; margin: 0 14px 0 14px; padding: 8px 0 8px 0; opacity: 0;'>Invalid username or password</div>" +
  "<br>";

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
    init: function () {
        if (window.mmgisglobal.AUTH == 'off') return
        if (
            (window.mmgisglobal.AUTH === 'csso' ||
                window.mmgisglobal.AUTH === 'none' ||
                window.mmgisglobal.AUTH === 'local') &&
            window.mmgisglobal.hasOwnProperty('user')
        ) {
            this.username = window.mmgisglobal.user
            if (this.username != 'guest') {
                this.loggedIn = true
                this.beganLoggedIn = true
            }
        }

        Login.loginBar = d3
            .select('#topBarRight')
            .append('div')
            .attr('id', 'loginDiv')
            .style('display', 'flex')
            .style('z-index', '2006')
            .style('color', '#aaa')
            .style('mix-blend-mode', 'luminosity')

        Login.loginBar
            .append('div')
            .attr('id', 'loginUser')
            .style('text-align', 'center')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('font-family', 'sans-serif')
            .style('margin-left', '5px')
            .style('cursor', 'pointer')
            .style('width', '30px')
            .style('height', '30px')
            .style('line-height', '30px')
            .style('color', 'white')
            .style(
                'background',
                Login.loggedIn ? 'var(--color-a)' : 'transparent'
            )
            .style('display', Login.loggedIn ? 'block' : 'none')
            .style('text-transform', 'uppercase')
            .style('transition', 'opacity 0.2s ease-out')
            .html(Login.loggedIn ? Login.username[0] : '')

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
            window.mmgisglobal.AUTH === 'local' &&
            window.mmgisglobal.permission === '111'
        ) {
            Login.loginBar
                .append('div')
                .attr('id', 'forceSignupButton')
                .style('text-align', 'center')
                .style('cursor', 'pointer')
                .style('width', '30px')
                .style('height', '30px')
                .style('line-height', '26px')
                .style('margin-right', '4px')
                .style('background', 'var(--color-a)')
                .style('pointer-events', 'all')
                .on('click', function () {
                    //Open login
                    //default to signup
                    Login.signUp = true
                    $('#loginEmail').css({ display: 'inherit' })
                    $('#loginRetypePassword').css({ display: 'inherit' })
                    $('#loginSubmit').val('Sign Up')
                    $('#loginInUpToggle').html('or sign in')
                    //and open modal
                    Login.openModal()
                })
                .append('i')
                .attr('id', 'forceSignupButtonIcon')
                .attr('class', 'mdi mdi-account-multiple mdi-18px')
        }

        Login.loginBar
            .append('div')
            .attr('id', 'loginoutButton')
            .attr('title', Login.loggedIn ? 'Logout' : 'Login')
            .attr('tabindex', 500)
            .on('click', function () {
                if (Login.loggedIn) {
                    //Then Logout
                    if (
                        window.mmgisglobal.AUTH == 'csso' &&
                        Login.beganLoggedIn
                    ) {
                        Login.loggedIn = false
                        window.location.href = '/ssologoutredirect'
                    } else {
                        calls.api(
                            'logout',
                            { username: Login.username },
                            function (d) {
                                ToolController_.closeActiveTool()
                                window.mmgisglobal.user = 'guest'
                                window.mmgisglobal.groups = []

                                Login.username = null
                                Login.loggedIn = false
                                d3.select('#loginUser')
                                    .style('display', 'none')
                                    .html('')
                                d3.select('#loginoutButton').attr(
                                    'title',
                                    'Login'
                                )
                                d3.select('#loginoutButtonIcon').attr(
                                    'class',
                                    'mdi mdi-login mdi-18px'
                                )
                                // Destroy the cookie session here
                                var decodedCookie = decodeURIComponent(
                                    document.cookie
                                )
                                var cookies = decodedCookie.split(';')
                                var MMGISUser = {}
                                try {
                                    MMGISUser = cookies[0].split('=')
                                    MMGISUser = JSON.parse(MMGISUser[1])
                                } catch (err) {}
                                MMGISUser.username = ''
                                MMGISUser.token = ''

                                document.cookie =
                                    'MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;'

                                if (window.mmgisglobal.AUTH === 'local')
                                    reloadToLogin()
                            },
                            function (d) {}
                        )
                    }
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
            .append('i')
            .attr('id', 'loginoutButtonIcon')
            .attr(
                'class',
                Login.loggedIn
                    ? 'mdi mdi-logout mdi-18px'
                    : 'mdi mdi-login mdi-18px'
            )

        // Sign in at page load from cookie if possible
        if (
            window.mmgisglobal.AUTH !== 'off' &&
            window.mmgisglobal.AUTH !== 'csso' &&
            window.mmgisglobal.SKIP_CLIENT_INITIAL_LOGIN != 'true'
        ) {
            Login.initialLogin()
        }
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

                loginSuccess(d)
            },
            function (d) {
                loginSuccess(d, true)
            }
        )
    },
    createModal: function () {
        this.removeModal()

        const wrapper = d3
            .select('#topBar')
            .append('div')
            .attr('id', 'loginModalWrapper')

        wrapper
            .append('div')
            .attr('id', 'loginModalClose')
            .html("<i class='mdi mdi-close mdi-24px'></i>")
        wrapper.append('div').attr('id', 'loginModal').html(modalFormSignIn)

        $('#loginModal #loginInUpToggle').on('click', function () {
            $('#loginErrorMessage').animate({ opacity: '0' }, 500)
            if (!Login.signUp) {
                Login.signUp = true
                $('#loginEmail').css({ display: 'inherit' })
                $('#loginRetypePassword').css({ display: 'inherit' })
                $('#loginSubmit').val('Sign Up')
                $('#loginInUpToggle').html('or sign in')
            } else {
                Login.signUp = false
                $('#loginEmail').css({ display: 'none' })
                $('#loginRetypePassword').css({ display: 'none' })
                $('#loginSubmit').val('Sign In')
                $('#loginInUpToggle').html('or sign up')
            }
        })

        $('#loginUsernameInput').on('change paste keyup', function () {
            $('#loginUsernameInput').css({ 'background-color': 'white' })
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
            $('#loginEmailInput').val(value + emailSuffix)
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
                            loginSuccess(d)
                        },
                        function (d) {
                            alert(d.message)
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
                            if (window.mmgisglobal.AUTH === 'local') {
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
                            if (window.mmgisglobal.AUTH === 'local') {
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
        $('#topBar > #loginModalWrapper').remove()
    },
}

function loginSuccess(data, ignoreError) {
    if (data.status == 'success') {
        document.cookie = 'MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        document.cookie = `MMGISUser=${JSON.stringify({
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
        d3.select('#loginoutButton').attr('title', 'Logout')
        d3.select('#loginoutButtonIcon').attr(
            'class',
            'mdi mdi-logout mdi-18px'
        )

        d3.select('#loginUser').attr(
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
    } else {
        document.cookie = 'MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;'

        if (window.mmgisglobal.AUTH === 'local') reloadToLogin()

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
