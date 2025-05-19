function login() {
  if (
    document.getElementById("username").value === "" ||
    document.getElementById("pwd").value === ""
  ) {
    document.getElementById("msg").innerHTML = "Missing username or password";
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
          "Invalid username or password";
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
    if (e.which === 13) {
      login();
    }
  });
});
