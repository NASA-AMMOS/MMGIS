/* global $, LoginForms, allowSignup */
let toggleState = "login";

function login() {
  // Sites without local login only show provider links
  if (!document.getElementById("username")) return;
  if (
    document.getElementById("username").value === "" ||
    document.getElementById("pwd").value === ""
  ) {
    document.getElementById("msg").innerHTML = "Missing username or password.";
    document.getElementById("msg").style.opacity = 1;
    return;
  }

  if (toggleState === "login" && !LoginForms.isLocal()) {
    LoginForms.submit(
      document.getElementById("username").value,
      document.getElementById("pwd").value,
      function (message) {
        document.getElementById("msg").innerText = message;
        document.getElementById("msg").style.opacity = 1;
      },
      document.getElementById("login")
    );
  } else if (toggleState === "login") {
    $.ajax({
      type: "POST",
      url: "api/users/login",
      data: {
        username: document.getElementById("username").value,
        password: document.getElementById("pwd").value,
      },
      success: function (data) {
        if (
          !data.hasOwnProperty("status") ||
          (data.hasOwnProperty("status") && data.status === "success")
        ) {
          //success
          LoginForms.remember();
          document.cookie = "MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;";
          document.cookie = `MMGISUser=${JSON.stringify({
            username: data.username,
            token: data.token,
          })}${data.additional}`;
          window.location.reload();
        } else {
          //error
          document.getElementById("msg").innerText =
            LoginForms.failed((data && data.message) || "Invalid username or password");
          document.getElementById("msg").style.opacity = 1;
        }
      },
      error: function (xhr) {
        //error
        document.getElementById("msg").innerText = LoginForms.failed(
          (xhr && xhr.responseJSON && xhr.responseJSON.message) || "Server error.",
          xhr && xhr.status
        );
        document.getElementById("msg").style.opacity = 1;
      },
    });
  } else if (toggleState === "signup") {
    if (
      document.getElementById("pwd").value !=
      document.getElementById("pwd_retype").value
    ) {
      document.getElementById("msg").innerHTML = "Passwords don't match.";
      document.getElementById("msg").style.opacity = 1;
      return;
    }

    $.ajax({
      type: "POST",
      url: "api/users/signup",
      data: {
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        password: document.getElementById("pwd").value,
      },
      success: function (data) {
        if (
          !data.hasOwnProperty("status") ||
          (data.hasOwnProperty("status") && data.status === "success")
        ) {
          //success
          document.cookie = "MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;";
          document.cookie = `MMGISUser=${JSON.stringify({
            username: data.username,
            token: data.token,
          })}${data.additional}`;
          window.location.reload();
        } else {
          //error
          document.getElementById("msg").innerHTML =
            data.message || "Something went wrong.";
          document.getElementById("msg").style.opacity = 1;
        }
      },
      error: function () {
        //error
        document.getElementById("msg").innerHTML = "Server error.";
        document.getElementById("msg").style.opacity = 1;
      },
    });
  }
}
function toggle() {
  if (toggleState === "login") {
    document.getElementById("login").innerHTML = "Sign Up";
    document.getElementById("toggle").innerHTML = "Or Log In";

    document.getElementById("email_label").style.display = "block";

    document.getElementById("email").style.display = "block";
    document.getElementById("email_description").style.display = "block";
    document.getElementById("pwd_description").style.display = "block";
    document.getElementById("pwd_retype_label").style.display = "block";
    document.getElementById("pwd_retype").style.display = "block";
    document.getElementById("pwd").setAttribute("autocomplete", "new-password");

    toggleState = "signup";
  } else {
    document.getElementById("login").innerHTML = "Log In";
    document.getElementById("toggle").innerHTML = "Or Sign Up";

    document.getElementById("email_label").style.display = "none";

    document.getElementById("email").style.display = "none";
    document.getElementById("email_description").style.display = "none";

    document.getElementById("pwd_description").style.display = "none";

    document.getElementById("pwd_retype_label").style.display = "none";

    document.getElementById("pwd_retype").style.display = "none";
    document.getElementById("pwd").setAttribute("autocomplete", "current-password");

    toggleState = "login";
  }
}

$(document).ready(function () {
  // Sign-up is only for local accounts
  LoginForms.init(function (form) {
    const wrapper = document.getElementById("toggleWrapper");
    if (!wrapper) return;
    if (form.id !== "local" && toggleState === "signup") toggle();
    wrapper.style.display = allowSignup === true && form.id === "local" ? "flex" : "none";
  });
  if (allowSignup === true && LoginForms.isLocal() && document.getElementById("toggleWrapper"))
    document.getElementById("toggleWrapper").style.display = "flex";
  $(document).on("keypress", function (e) {
    // Enter on a button already clicks it
    if (e.which === 13 && !$(e.target).is("button")) {
      login();
    }
  });
});
