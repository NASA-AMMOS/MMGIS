/* global $ */
/* exported LoginForms */
// The provider switch above the username/password form on the login page and Configure
// sign-in (views/mixins/loginForms.pug). Each .loginProvider button carries its provider's
// wording; local accounts keep their own login code, other providers get a JSON POST.
const LoginForms = (function () {
  const KEY = "mmgisLoginProvider";
  let active = null;
  let onChange = function () {};

  const buttons = () => Array.from(document.querySelectorAll(".loginProvider"));
  const read = (b) => ({
    id: b.dataset.id,
    title: b.dataset.title,
    label: b.dataset.label,
    hint: b.dataset.hint,
    path: b.dataset.path,
  });

  function select(id) {
    const all = buttons();
    const button = all.find((b) => b.dataset.id === id) || all[0];
    if (!button) return;
    all.forEach((b) => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-selected", b === button ? "true" : "false");
    });
    active = read(button);
    const label = document.getElementById("username_label");
    if (label) label.textContent = active.label || "Username";
    // A single provider shows its hint in the banner instead
    const hint = document.getElementById("loginHint");
    if (hint) {
      hint.textContent = all.length > 1 ? active.hint || "" : "";
      hint.style.display = hint.textContent ? "block" : "none";
    }
    onChange(active);
  }

  function init(changed) {
    if (typeof changed === "function") onChange = changed;
    buttons().forEach((b) => b.addEventListener("click", () => select(b.dataset.id)));
    let remembered = null;
    try {
      remembered = localStorage.getItem(KEY);
    } catch (err) {}
    select(remembered);
  }

  // Only a successful sign-in is remembered, so a shared browser doesn't keep someone else's mistaken choice
  function remember() {
    if (!active || buttons().length < 2) return;
    try {
      localStorage.setItem(KEY, active.id);
    } catch (err) {}
  }

  // A wrong password may just be the wrong account type; other failures (status 409, 503) aren't
  const failed = (message, status) =>
    buttons().length > 1 && (!status || status === 401) ? `${message} ${otherType(active)}` : message;

  // e.g. a relinked person still on the MMGIS account tab, or a renamed one on the directory's
  function otherType(form) {
    if (!form || form.id === "local") return "If your account was moved to another sign-in, choose it above.";
    return `If you sign in with an MMGIS password, choose MMGIS account above; otherwise ask an administrator.`;
  }

  // Shows only the local account form, e.g. while creating the first administrator
  function onlyLocal() {
    document.querySelectorAll(".loginProviders, .loginBanner").forEach((el) => (el.style.display = "none"));
    select("local");
    const label = document.getElementById("username_label");
    if (label) label.textContent = "Username";
  }

  // Local accounts, or no provider switch at all
  const isLocal = () => !active || active.id === "local";

  // Shown while a sign-in is running: a directory that doesn't answer takes up to LDAP_TIMEOUT_MS
  let busy = false;
  function submit(username, password, done, button) {
    if (busy) return;
    busy = true;
    const label = button ? button.textContent : null;
    if (button) {
      button.disabled = true;
      button.textContent = "Signing in…";
    }
    const finish = (message) => {
      busy = false;
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
      done(message);
    };
    $.ajax({
      type: "POST",
      url: active.path,
      contentType: "application/json",
      data: JSON.stringify({ username: username, password: password }),
      success: function (data) {
        if (data && data.status === "success") {
          remember();
          document.cookie = "MMGISUser=;expires=Thu, 01 Jan 1970 00:00:01 GMT;";
          window.location.reload();
        } else finish(failed((data && data.message) || "Login failed."));
      },
      error: function (xhr) {
        finish(failed((xhr && xhr.responseJSON && xhr.responseJSON.message) || "Server error.", xhr && xhr.status));
      },
    });
  }

  return {
    init: init,
    onlyLocal: onlyLocal,
    isLocal: isLocal,
    submit: submit,
    remember: remember,
    failed: failed,
    otherType: otherType,
    current: () => active,
  };
})();
