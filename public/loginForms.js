/* global $ */
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

  // A failed sign-in may just be the wrong account type
  const failed = (message) =>
    buttons().length > 1 ? `${message} Using a different account type? Choose it above.` : message;

  // Shows only the local account form, e.g. while creating the first administrator
  function onlyLocal() {
    document.querySelectorAll(".loginProviders, .loginBanner").forEach((el) => (el.style.display = "none"));
    select("local");
    const label = document.getElementById("username_label");
    if (label) label.textContent = "Username";
  }

  // Local accounts, or no provider switch at all
  const isLocal = () => !active || active.id === "local";

  function submit(username, password, done) {
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
        } else done(failed((data && data.message) || "Login failed."));
      },
      error: function (xhr) {
        done(failed((xhr && xhr.responseJSON && xhr.responseJSON.message) || "Server error."));
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
    current: () => active,
  };
})();
