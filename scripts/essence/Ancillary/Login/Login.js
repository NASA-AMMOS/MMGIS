//Depends on a div with id 'topBar'
define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'ToolController_',
    'semantic',
], function($, d3, F_, L_, ToolController_) {
    var emailSuffix = '@jpl.nasa.gov'
    // prettier-ignore
    var modalFormSignIn =
  "<img src='../resources/mmgis.png' style='position: relative; left: 50%; transform: translateX(-50%);' />" +
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
    "<div id='loginInUpToggle' class='ui small button' style='width: 80px; margin-left: 95px; padding: 10px 0 0 0; color: #DDD; background: transparent;'>or sign up</div>" +
  "</form>" +
  "<div id='loginErrorMessage' style='text-align: center; font-size: 16px; font-weight: bold; color: #F88; border: 2px solid #F88; border-radius: 4px; margin: 0 14px 0 14px; padding: 8px 0 8px 0; opacity: 0;'>Invalid username or password</div>" +
  "<br><br><br><br><br><br>";

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
        init: function() {
            if (
                mmgisglobal.AUTH == 'csso' &&
                mmgisglobal.hasOwnProperty('user')
            ) {
                this.loggedIn = true
                this.username = mmgisglobal.user
                this.beganLoggedIn = true
            }

            Login.loginBar = d3
                .select('#main-container')
                .append('div')
                .attr('id', 'loginDiv')
                .style('display', 'flex')
                .style('position', 'absolute')
                .style('top', '0px')
                .style('right', '0px')
                .style('z-index', '1090')
                .style('padding', '2px 5px')
                .style('background', 'rgba(31, 31, 31, 0.15)')

            d3.select('#topBar')
                .append('div')
                .attr('id', 'loginModal')
                .attr('class', 'ui small basic modal')
                .style('width', '300px')
                .style('margin', '0 0 0 -150px')
                .html(modalFormSignIn)
            $('#loginModal #loginInUpToggle').on('click', function() {
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

            $('#loginUsernameInput').on('change paste keyup', function() {
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

            $('#loginEmailInput').on('change paste keyup', function() {
                var value = $(this).val()
                if (value.length > 0) {
                    $('#loginEmailInputIcon').animate({ opacity: '1' }, 80)
                    validate.email = true
                } else {
                    $('#loginEmailInputIcon').animate({ opacity: '0' }, 80)
                    validate.email = false
                }
            })

            $('#loginPasswordInput').on('change paste keyup', function() {
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

            $('#loginRetypePasswordInput').on('change paste keyup', function() {
                var value = $(this).val()
                var actualPass = $('#loginPasswordInput').val()
                if (value.length > 0) {
                    $('#loginRetypePasswordInputIcon').animate(
                        { opacity: '1' },
                        80
                    )
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
                    $('#loginRetypePasswordInputIcon').animate(
                        { opacity: '0' },
                        80
                    )
                    validate.retypepassword = false
                }
            })

            $('#loginForm').submit(function(e) {
                e.preventDefault()
                var values = {}
                $.each($(this).serializeArray(), function(i, field) {
                    values[field.name] = field.value
                })

                values['mission'] = L_.mission
                values['master'] = L_.masterdb

                if (!Login.signUp) {
                    if (validate.username && validate.password) {
                        calls.api(
                            'login',
                            values,
                            function(d) {
                                Login.username = values.username
                                mmgisglobal.user = Login.username
                                mmgisglobal.groups = d.groups
                                loginSuccess(d)
                            },
                            function(d) {
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
                            function(d) {
                                Login.username = d.username
                                mmgisglobal.user = Login.username
                                mmgisglobal.groups = d.groups
                                loginSuccess(d)
                            },
                            function(d) {
                                loginSuccess(d)
                            }
                        )
                        /*
                        $.ajax({
                            type: 'POST',
                            url: 'scripts/essence/Ancillary/Login/signup.php',
                            data: values,
                            success: function(data) {
                                loginSuccess(data)
                            },
                        })

                        // An ajax call for creating a new user record in the database for API service
                        $.ajax({
                            type: 'POST',
                            url: 'http://localhost:3000/users/sign_up',
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify(values),
                            success: function(data) {
                                alert(data.message)
                            },
                            error: function(xhr, status) {
                                console.log(
                                    'XHR Object:',
                                    xhr,
                                    'Status:',
                                    status
                                )
                            },
                        })
                        */
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

            Login.loginBar
                .append('div')
                .attr('id', 'loginUser')
                .style('text-align', 'center')
                .style('font-size', '16px')
                .style('font-family', 'monospace')
                .style('color', '#fffdf5')
                .style('cursor', 'pointer')
                .style('padding-right', Login.loggedIn ? '5px' : '0px')
                .html(Login.loggedIn ? Login.username : '')

            Login.loginBar
                .append('div')
                .attr('id', 'loginoutButton')
                .attr('title', Login.loggedIn ? 'Logout' : 'Login')
                .style('padding', '1px 0px 0px 0px')
                .style('text-align', 'center')
                .style('cursor', 'pointer')
                .on('click', function() {
                    if (Login.loggedIn) {
                        //Then Logout
                        if (Login.beganLoggedIn) {
                            Login.loggedIn = false
                            window.location.href = '/ssologoutredirect'
                        } else {
                            calls.api(
                                'logout',
                                { username: Login.username },
                                function(d) {
                                    ToolController_.closeActiveTool()
                                    mmgisglobal.user = 'guest'
                                    mmgisglobal.groups = []

                                    Login.username = null
                                    Login.loggedIn = false
                                    d3.select('#loginUser')
                                        .style('padding-right', '0px')
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
                                    var MMGISUser = cookies[0].split('=')
                                    MMGISUser = JSON.parse(MMGISUser[1])
                                    MMGISUser.username = ''
                                    MMGISUser.token = ''
                                },
                                function(d) {}
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
                        $('#loginModal').modal('show')
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

            $('#loginModal').modal({
                blurring: true,
            })

            //Sign in at page load from cookie if possible
            calls.api(
                'login',
                {
                    useToken: true,
                },
                function(d) {
                    Login.username = d.username
                    mmgisglobal.user = Login.username
                    mmgisglobal.groups = d.groups
                    loginSuccess(d)
                },
                function(d) {
                    loginSuccess(d, true)
                }
            )
        },
    }

    function loginSuccess(data, ignoreError) {
        if (data.status == 'success') {
            document.cookie =
                'MMGISUser=' +
                JSON.stringify({
                    username: data.username,
                    token: data.token,
                })

            Login.loggedIn = true
            $('#loginErrorMessage').animate({ opacity: '0' }, 500)
            $('#loginModal')
                .parent()
                .animate(
                    { 'background-color': 'rgba(46,180,255,0.6)' },
                    1000,
                    function() {
                        ToolController_.closeActiveTool()
                        setTimeout(function() {
                            $('#loginModal').modal('hide')
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
                            $('#loginButton').html('logout')
                            d3.select('#loginoutButton').attr('title', 'Logout')
                            d3.select('#loginoutButtonIcon').attr(
                                'class',
                                'mdi mdi-logout mdi-18px'
                            )
                            $('#loginUser')
                                .css('padding-right', '5px')
                                .html(Login.username)
                        }, 600)
                    }
                )
        } else {
            document.cookie =
                'MMGISUser=' +
                JSON.stringify({
                    username: '',
                    token: '',
                })

            if (ignoreError) return

            $('#loginErrorMessage')
                .html(data.message)
                .animate({ opacity: '1' }, 80)
        }
    }

    return Login
})
