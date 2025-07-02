function resetPassword() {
  let token = window.location.href.split("?t=")[1];
  if (
    document.getElementById("username").value === "" ||
    document.getElementById("pwd").value === "" ||
    token === "" ||
    token == null
  ) {
    document.getElementById("msg").innerHTML =
      "Missing username, password, or reset token";
    document.getElementById("msg").style.opacity = 1;
    return;
  }

  $.ajax({
    type: "POST",
    url: "api/users/resetPassword",
    data: {
      username: document.getElementById("username").value,
      password: document.getElementById("pwd").value,
      resetToken: token,
    },
    success: function (data) {
      if (
        !data.hasOwnProperty("status") ||
        (data.hasOwnProperty("status") && data.status === "success")
      ) {
        //success
        document.getElementById("msg").innerHTML = data.message;
        document.getElementById("msg").style.opacity = 1;
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
    if (e.which === 13) {
      login();
    }
  });
});
