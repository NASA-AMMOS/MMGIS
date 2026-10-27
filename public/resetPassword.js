function resetPassword() {
  let token = window.location.href.split("?t=")[1];
  if (
    document.getElementById("username").value === "" ||
    document.getElementById("pwd").value === "" ||
    token === "" ||
    token == null
  ) {
    document.getElementById("msgError").innerHTML =
      "Missing username, password, or reset token.";
    document.getElementById("msgError").style.opacity = 1;
    return;
  }

  if (
    document.getElementById("pwd").value !=
    document.getElementById("pwd_retype").value
  ) {
    document.getElementById("msgError").innerHTML = "Passwords don't match.";
    document.getElementById("msgError").style.opacity = 1;
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
        document.getElementById("msgSuccessMsg").innerHTML =
          "Successfully Reset Password!";
        document.getElementById("msgSuccess").style.opacity = 1;
        document.getElementById("msgSuccess").style.pointerEvents = "all";
        document.getElementById("container").style.borderTop =
          "4px solid #08ea67";
        document.getElementById("container").style.borderBottom =
          "4px solid #08ea67";
      } else {
        //error
        document.getElementById("msgError").innerHTML = data.message;
        document.getElementById("msgError").style.opacity = 1;
      }
    },
    error: function () {
      //error
      document.getElementById("msgError").innerHTML = "Server error.";
      document.getElementById("msgError").style.opacity = 1;
    },
  });
}

function goHome() {
  const url = new URL(window.location.href);

  // Remove search params and hash
  url.search = "";
  url.hash = "";

  // Split path, remove last segment
  const parts = url.pathname.split("/").filter(Boolean);
  parts.pop();

  // Join back and set the new pathname
  const newPath = "/" + parts.join("/");
  url.pathname = newPath === "/" ? "/" : newPath + "/";

  window.location.href = url.href;
}
