---
layout: page
title: Writing an Auth Provider
permalink: /contributing/auth-providers
parent: Contributing
nav_order: 3
---

# Writing an Auth Provider

##### Contents

- [In one sentence](#in-one-sentence)
- [Quick start](#quick-start)
- [plugin.json](#pluginjson)
- [plugin.js hooks](#pluginjs-hooks)
- [Identities, accounts and groups](#identities-accounts-and-groups)
- [The ctx object](#the-ctx-object)
- [Login buttons, returnTo and sign out](#login-buttons-returnto-and-sign-out)
- [Example: proxy header provider](#example-proxy-header-provider)
- [Example: login form provider](#example-login-form-provider)
- [Redirect (OIDC / OAuth2) providers](#redirect-oidc--oauth2-providers)
- [Testing your provider](#testing-your-provider)
- [Startup errors and what they mean](#startup-errors-and-what-they-mean)
- [Gotchas](#gotchas)

## In one sentence

A login provider answers "who is this?"; MMGIS roles, groups and grants decide what that person may do, whichever provider answered.

`local` (MMGIS username/password accounts) and `csso` (a Cloud Single Sign-On proxy) ship with MMGIS. A new provider is a folder under `plugins/core/auth/` and is turned on by listing its id in [`AUTH_PROVIDERS`](/MMGIS/setup/envs). Nothing else in MMGIS needs to change: Configure > Users & Access, roles, mission and layer grants, groups and API tokens all work for its users.

## Quick start

1. Create `plugins/core/auth/<Name>/plugin.json` and `plugins/core/auth/<Name>/plugin.js` (copy one of the [examples](#example-login-form-provider)).
2. Add the id to `.env`, keeping `local` so `/configure` admins can still sign in: `AUTH_PROVIDERS=["local","myprovider"]`.
3. Restart MMGIS. The log prints `AUTH_PROVIDERS` and any problems your `validate`/`warnings` hooks report.
4. In Configure > Users & Access > Groups, create a group with **Members from MYPROVIDER** and the external group name your provider reports, then give that group a role.
5. Log in through your provider and check the user in Users & Access > People (session providers) or with **Check a provider user** (per-request providers).

There are two kinds of provider. Pick one:

| Kind | Hook | When | Examples |
|---|---|---|---|
| Per-request | `identify(req)` | Something in front of MMGIS (a proxy) has already logged the user in and sends who they are on every request. | `csso`, a trusted header proxy |
| Session | `routes(router, ctx)` + `ctx.completeLogin` | MMGIS shows a login page or redirects to an identity provider, then starts its own session. | a login form against a directory, OIDC, OAuth2, SAML |

## plugin.json

```json
{
  "name": "MyProvider",
  "display_name": "My Provider",
  "type": "auth",
  "provider": "myprovider",
  "tier": "core",
  "overridable": false,
  "login_path": "/login",
  "login_label": "Log in with My Provider",
  "logout_url": "https://idp.example.org/logout"
}
```

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | Always `"auth"`. |
| `provider` | yes | The id used in `AUTH_PROVIDERS`, in group sources and in `/api/auth/<id>`. Lowercase letters, digits, `-` and `_`, starting with a letter. `local` and `csso` belong to the shipped providers. |
| `tier`, `overridable` | yes | Must be `"core"` and `false`. Providers can't be overridden by external plugin containers. |
| `display_name` | no | Shown on login buttons (`Log in with <display_name>`). Defaults to the folder name. |
| `login_path` | no | Session providers: the route that starts a login, relative to `/api/auth/<id>`. When set, the login page, the Configure sign-in page and the in-app login modal show a button for it. |
| `login_url` | no | Per-request providers: a login page outside MMGIS (for example the proxy's), linked as is. Use it instead of `login_path`. |
| `login_label` | no | Text of that button. |
| `logout_url` | no | Where the main site's **Sign out** sends the browser after ending the MMGIS session, e.g. your identity provider's logout page. Per-request providers need it, because MMGIS can't end a proxy's login. |
| `dependencies` | no | npm/pip packages your provider needs, e.g. `{ "npm": { "ldapts": "^7.0.0" } }`. `node scripts/resolve-plugin-deps.js` collects them with every other plugin's (see `plugins/README.md`, Dependencies). |

## plugin.js hooks

Every export is optional.

```js
module.exports = {
  // Per-request login. Return an identity, or null for "not mine". May be async.
  identify(req) {},
  // Session login. Mount routes on router; they are served at /api/auth/<id>.
  routes(router, ctx) {},
  // Problems that refuse startup, as strings. Only called when the provider is in AUTH_PROVIDERS.
  validate(env) { return []; },
  // Problems logged at startup, as strings.
  warnings(env) { return []; },
};
```

- `identify` runs on every HTTP request and websocket connection, for each enabled provider in `AUTH_PROVIDERS` order. The first provider that returns an identity wins. A signed-in MMGIS session takes precedence over it.
- `validate(env)` and `warnings(env)` get `process.env` and must return an array of strings synchronously (an empty array means no problems). Anything else, or an exception, is reported at startup under your provider id.
- If `identify(req)` throws, the error is logged under your provider id and the request is treated as not identified.
- Read your provider's settings from `env` and name them `<PROVIDERID>_*` (for example `MYPROVIDER_URL`). Document them in `docs/pages/Setup/ENVs/ENVs.md` and `sample.env`.
- Every route you mount must declare its permission, usually `ctx.authorize.public("...")` for login pages; startup lists routes that don't. See [Backend Permissions](/MMGIS/contributing/permissions).
- JSON and URL-encoded bodies are already parsed into `req.body`, and `req.session` is the MMGIS session.

## Identities, accounts and groups

An identity is:

```js
{ subject, username?, email?, groups?: string[], session? }
```

- `subject` (required) is the provider's stable id for the person. MMGIS links accounts by provider + subject, never by username, so renames at the provider keep the same account (and its first username; MMGIS doesn't rename accounts).
- `username` defaults to `subject`. `email` is optional. `groups` are the provider's group names.

**Session providers.** `await ctx.completeLogin(req, identity)`:

- finds the account linked to this provider + subject, or creates one on first login (with a random password, so it can only sign in through the provider, and the identity's email if no other account uses it);
- throws `ctx.LinkError` when the username already belongs to another account (for example a local account). Respond `409` with `err.message`. MMGIS never takes over an existing account;
- sets the person's membership of groups whose source is this provider to exactly the reported `groups`, adding and removing as needed;
- starts a fresh session (new session id) and returns `{ id, username }`.

**Per-request providers** create no account. Their users don't appear in People and can't hold a grant of their own; they get access through groups (matched on every request) and the Everyone / Logged-in users audiences.

**Groups.** A provider's groups only matter for groups an admin has created in Users & Access with **Members from <PROVIDER>** and an external name equal to the reported group. Other reported groups are ignored; MMGIS never creates groups on its own. For session providers, membership changes at the provider apply at the next login; a new grant to a group applies at the next request.

## The ctx object

`routes(router, ctx)` receives exactly:

| Member | What it is |
|---|---|
| `ctx.completeLogin(req, identity)` | Links the account, syncs groups and starts the session (see above). Returns a promise. |
| `ctx.LinkError` | The error class `completeLogin` throws on a username clash. |
| `ctx.returnTo(value)` | Returns `value` if it's a same-site path (`/...`), otherwise the site root. Use it on any "where to go after login" value. |
| `ctx.authorize` | The permission helpers; use `ctx.authorize.public("reason")` on login routes. |
| `ctx.logger` | `logger(level, message, caller, req, err)`. |

There's no database handle or config object; read settings from `process.env`.

**Rate limiting is automatic.** Each provider's routes share a limit of 10 failed responses (status 400 or higher) per IP per 15 minutes, like local login. So answer bad credentials with `401`, not `200`; successful logins and redirects don't count.

## Login buttons, returnTo and sign out

- **Buttons.** With `login_path` set, the login page, Configure sign-in and the main site's login modal link to `/api/auth/<id><login_path>?returnTo=<the page the user was on>`. `GET /api/auth` returns the enabled providers and these links.
- **Keeping provider tokens.** To keep something for later (for example an ID token for RP-initiated logout), set it on `req.session` after `completeLogin` resolves and call `req.session.save(...)` before redirecting.
- **returnTo.** Read it with `ctx.returnTo(req.query.returnTo)`. `completeLogin` starts a new session, so read anything you stored in `req.session` (state, nonce, returnTo) **before** calling it, then `res.redirect(...)`.
- **On a site without `local`.** With `SITE_ACCESS=required` and no `local`, the login page shows only the provider buttons. Without any button it shows the "not allowed" page meant for proxies.
- **Main site.** On page load the main site asks `/api/users/login` (`useToken`) who is signed in; provider sessions and per-request identities are reported as signed in, with no saved-login cookie.
- **Sign out.** For session providers, Sign out ends the MMGIS session, then goes to `logout_url` if set. For per-request providers it goes to `logout_url`, or tells the user to sign out through their provider.

## Example: proxy header provider

A proxy in front of MMGIS logs people in and sends `X-Remote-User`, `X-Remote-Email` and `X-Remote-Groups` (comma separated), plus a shared secret so the headers can't be forged by clients.

`plugins/core/auth/ProxyHeader/plugin.json`

```json
{
  "name": "ProxyHeader",
  "display_name": "Proxy",
  "type": "auth",
  "provider": "proxyheader",
  "tier": "core",
  "overridable": false,
  "logout_url": "/proxy/logout"
}
```

`plugins/core/auth/ProxyHeader/plugin.js`

```js
const crypto = require("crypto");

function secretMatches(req) {
  const sent = Buffer.from(String(req.get("X-Proxy-Secret") || ""));
  const expected = Buffer.from(String(process.env.PROXYHEADER_SECRET || ""));
  return expected.length > 0 && sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
}

module.exports = {
  identify(req) {
    const user = req.get("X-Remote-User");
    if (!user || !secretMatches(req)) return null;
    return {
      subject: user,
      email: req.get("X-Remote-Email") || undefined,
      groups: String(req.get("X-Remote-Groups") || "").split(",").map((g) => g.trim()),
    };
  },
  validate(env) {
    const problems = [];
    if (!env.PROXYHEADER_SECRET || env.PROXYHEADER_SECRET.length < 16)
      problems.push("PROXYHEADER_SECRET must be set to at least 16 characters.");
    return problems;
  },
  warnings(env) {
    return env.SITE_ACCESS === "public"
      ? ["proxyheader is enabled on a public site, so guests are never asked to log in."]
      : [];
  },
};
```

Enable it with `AUTH_PROVIDERS=["local","proxyheader"]` and `PROXYHEADER_SECRET=...`, and make sure the proxy removes these headers from client requests.

## Example: login form provider

A username/password form checked against a directory. Here the directory is a JSON file so the example runs as is; replace `checkPassword` with your LDAP or HTTP call.

`plugins/core/auth/Directory/plugin.json`

```json
{
  "name": "Directory",
  "display_name": "Directory",
  "type": "auth",
  "provider": "directory",
  "tier": "core",
  "overridable": false,
  "login_path": "/login"
}
```

`plugins/core/auth/Directory/plugin.js`

```js
const fs = require("fs");
const crypto = require("crypto");

// DIRECTORY_FILE: [{ "id": "u1", "username": "alice", "password": "...", "email": "...", "groups": ["science"] }]
function checkPassword(username, password) {
  const people = JSON.parse(fs.readFileSync(process.env.DIRECTORY_FILE, "utf8"));
  const person = people.find((p) => p.username === username);
  if (!person) return null;
  const a = Buffer.from(String(password));
  const b = Buffer.from(String(person.password));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? person : null;
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (returnTo, message = "") => `<!doctype html><title>Directory login</title>
<form method="post">
  <p>${escape(message)}</p>
  <input type="hidden" name="returnTo" value="${escape(returnTo)}">
  <label>Username <input name="username" autocomplete="username"></label>
  <label>Password <input name="password" type="password" autocomplete="current-password"></label>
  <button>Log in</button>
</form>`;

module.exports = {
  routes(router, ctx) {
    router.get("/login", ctx.authorize.public("directory login page"), (req, res) => {
      res.send(page(ctx.returnTo(req.query.returnTo)));
    });

    router.post("/login", ctx.authorize.public("directory login"), async (req, res) => {
      const returnTo = ctx.returnTo(req.body.returnTo);
      const person = checkPassword(req.body.username, req.body.password);
      // 401 so failed attempts count towards the rate limit
      if (!person) return res.status(401).send(page(returnTo, "Invalid username or password."));
      try {
        await ctx.completeLogin(req, {
          subject: person.id,
          username: person.username,
          email: person.email,
          groups: person.groups,
        });
        res.redirect(returnTo);
      } catch (err) {
        if (err instanceof ctx.LinkError) return res.status(409).send(page(returnTo, err.message));
        ctx.logger("error", "Directory login failed.", "Directory", req, err);
        res.status(500).send(page(returnTo, "Login failed."));
      }
    });
  },
  validate(env) {
    return env.DIRECTORY_FILE && fs.existsSync(env.DIRECTORY_FILE)
      ? []
      : ["DIRECTORY_FILE must point to the directory's JSON file."];
  },
};
```

Enable it with `AUTH_PROVIDERS=["local","directory"]` and `DIRECTORY_FILE=/path/to/people.json`. The login page and the in-app modal now show **Log in with Directory**.

## Redirect (OIDC / OAuth2) providers

The shape is the same as the form provider, with two routes:

1. `GET /login`: create `state`, `nonce` and a PKCE verifier, store them and `ctx.returnTo(req.query.returnTo)` in `req.session`, call `req.session.save(...)`, then redirect to the identity provider's authorize URL with `redirect_uri` set to `<site>/api/auth/<id>/callback`.
2. `GET /callback`: read and delete the stored values, check `state`, exchange the code at the token endpoint, verify the ID token (signature, `iss`, `aud`, `exp`, `nonce`), then `await ctx.completeLogin(req, { subject: claims.sub, username: claims.preferred_username, email: claims.email, groups: claims.groups })` and redirect to the stored returnTo.

Declare both with `ctx.authorize.public(...)`, set `"login_path": "/login"`, and use a maintained OIDC library rather than verifying tokens by hand. Validate the issuer URL, client id, client secret and redirect URI in `validate(env)`.

## Testing your provider

- **Startup:** each `validate` problem stops the server with your message; `warnings` are printed.
- **Login:** session providers: start from the login page button and from the main site's modal, and land back on the page you started from. Per-request: send the headers with `curl` and check `GET /api/access/me`.
- **Accounts:** a second login reuses the same account (People shows one row); a username that's already a local account gets your 409 message.
- **Groups:** create a **Members from <PROVIDER>** group, give it a role, log in and check what the user can see; remove the group at the provider and log in again.
- **Coexistence:** local accounts still log in with your provider enabled.
- **Removal:** take the id out of `AUTH_PROVIDERS` and restart: its routes return 404 and its sessions and tokens stop working. Its accounts, groups and grants are kept.
- **Websockets:** scripted websocket clients must send an `Origin` header, or MMGIS closes the connection (the reason is only in the server log).
- **Unit tests:** see `tests/unit/permissions-providers.spec.js` for loading a provider from a temporary plugins folder.

Redirect flows are easiest to test with a production build (`npm run build`, then `NODE_ENV=production npm start`). In development the map is served on a different port (PORT+1) from the API, so redirects back to `/` land on the API port.

## Startup errors and what they mean

| Log message | Fix |
|---|---|
| `AUTH_PROVIDERS lists an unknown provider 'x'` | The folder isn't under `plugins/core/auth/`, its `plugin.json` has a different `provider`, or it failed to load (see the errors above it). |
| `Auth provider '…' was not loaded: auth providers must be core plugins` | Move it to `plugins/core/auth/`. |
| `… must set "tier": "core" and "overridable": false` | Add both fields to `plugin.json`. |
| `… needs a "provider" id` | Add a lowercase `provider` to `plugin.json`. |
| `… is the id of the built-in … provider` | Pick another id. |
| `… is already provided by …` | Two folders use the same id. |
| `… its plugin.js threw …` | Your `plugin.js` failed when loaded; the stack trace follows. |
| `MMGIS cannot start because of its authentication settings` | Lists every `validate` problem; fix your provider's ENVs. |

## Gotchas

- Keep `local` in `AUTH_PROVIDERS` unless your provider's users include an administrator; local accounts are how `/configure` admins sign in.
- A trusted-header provider must check a shared secret (or be reachable only through the proxy), because anyone who can reach MMGIS can send headers.
- `CSSO_LEAD_GROUP` and `CSSO_GROUPS` only apply to `csso`.
- Draw files belong to a username, so keep usernames unique across providers; `completeLogin` already refuses a username that another account has.

Code: `API/permissions/providers.js` (loading, `completeLogin`, routes), `API/permissions/siteAccess.js` (`AUTH_PROVIDERS`), `plugins/core/auth/CSSO/plugin.js` (a per-request provider).
