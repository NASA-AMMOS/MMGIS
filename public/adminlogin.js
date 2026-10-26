let setup = false;

function login() {
  if (setup) {
    setupLogin();
    return;
  }

  if (
    document.getElementById("username").value == "" ||
    document.getElementById("pwd").value == ""
  ) {
    document.getElementById("msg").innerHTML = "Missing username or password.";
    document.getElementById("msg").style.opacity = 1;
    return;
  }

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
        (data.hasOwnProperty("status") && data.status == "success")
      ) {
        //success
        document.cookie =
          "MMGISUser=" +
          JSON.stringify({
            username: data.username,
            token: data.token,
          });
        location.reload();
      } else {
        //error
        document.getElementById("msg").innerText =
          (data && data.message) || "Invalid username or password.";
        document.getElementById("msg").style.opacity = 1;
      }
    },
    error: function (xhr) {
      //error
      document.getElementById("msg").innerText =
        (xhr && xhr.responseJSON && xhr.responseJSON.message) || "Server error.";
      document.getElementById("msg").style.opacity = 1;
    },
  });
}

function signOut() {
  $.ajax({
    type: "POST",
    url: "api/users/logout",
    complete: function () {
      document.cookie =
        "MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/";
      location.reload();
    },
  });
}

function setupLogin() {
  if (
    document.getElementById("username").value == "" ||
    document.getElementById("pwd").value == "" ||
    document.getElementById("pwd_retype").value == ""
  ) {
    document.getElementById("msg").innerHTML = "Missing username or password.";
    document.getElementById("msg").style.opacity = 1;
    return;
  }

  if (document.getElementById("setup_code").value.trim() == "") {
    document.getElementById("msg").innerHTML =
      "Enter the setup code from the server log.";
    document.getElementById("msg").style.opacity = 1;
    return;
  }

  if (
    document.getElementById("pwd").value !=
    document.getElementById("pwd_retype").value
  ) {
    document.getElementById("msg").innerHTML = "Passwords do not match.";
    document.getElementById("msg").style.opacity = 1;
    return;
  }

  $.ajax({
    type: "POST",
    url: "api/users/first_signup",
    data: {
      username: document.getElementById("username").value,
      password: document.getElementById("pwd").value,
      setup_code: document.getElementById("setup_code").value,
    },
    success: function (data) {
      if (
        !data.hasOwnProperty("status") ||
        (data.hasOwnProperty("status") && data.status == "success")
      ) {
        //success
        location.reload();
      } else {
        //error
        document.getElementById("msg").innerHTML = data.message;
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

$(document).ready(function () {
  $(document).on("keypress", function (e) {
    if (e.which == 13) {
      login();
    }
  });

  $.ajax({
    type: "POST",
    url: "api/users/has",
    data: {},
    success: function (data) {
      if (data.status == "success") {
        if (data.has == false) {
          setup = true;
          $("#setup").css("opacity", "1");
          $(".container").css("height", "520px");
          $(".box h5").css("margin-bottom", "30px");
          $("#pwd_retype").css("display", "block");
          $("#setup_code").css("display", "block");
          $(".btn1").css("top", "82%");
          $(".btn1").text("Create Administrator Account");
          $("#signInTitle").text("Create the first administrator account.");
        }
      }
    },
  });

  $("#backIcon").on("click", function () {
    // Remove last directory from pathname
    const path = window.location.pathname.split("/");
    window.location.href = path.slice(0, path.length - 1).join("/") || "/";
  });
});
