---
layout: page
title: Service Connections
permalink: /contributing/connections
parent: Contributing
nav_order: 4
---

# Service Connections

##### Contents

- [In one sentence](#in-one-sentence)
- [Connections vs. auth providers](#connections-vs-auth-providers)
- [Setting up a connection](#setting-up-a-connection)
- [What users see](#what-users-see)
- [Using a connection from a tool](#using-a-connection-from-a-tool)
- [Using a connection from a backend plugin](#using-a-connection-from-a-backend-plugin)
- [Writing a connection plugin](#writing-a-connection-plugin)
- [Where tokens are kept](#where-tokens-are-kept)
- [Routes](#routes)
- [Gotchas](#gotchas)

## In one sentence

A connection lets MMGIS tools use an outside service (such as NASA Earthdata) with each person's own account at that service, without that service ever signing anyone in to MMGIS.

## Connections vs. auth providers

|                | Auth provider (`plugins/<c>/auth/`)            | Connection (`plugins/<c>/connections/`)              |
| -------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Answers        | Who is this person in MMGIS?                   | May MMGIS call service X for this person?            |
| Turned on by   | `AUTH_PROVIDERS`                               | Installing the plugin and setting its env variables  |
| Shown under    | "Sign in" in the account menu                  | "Services" in the account menu                       |
| Creates or changes MMGIS accounts | Yes                         | Never                                                |

If a service should be both a way to sign in to MMGIS and a data source, ship one plugin of each type.

## Setting up a connection

MMGIS core ships no connections yet: `plugins/core/connections/` is where core ones will go. Install a connection plugin (your own, or from a plugin repo) into `plugins/<container>/connections/<Name>/`, then:

1. Register an application with the service and set its redirect URI to `<your site>/api/connections/<id>/callback` (including any `ROOT_PATH`), where `<id>` is the plugin's `connection` value.
2. Set the env variables the plugin's `env` lists.
3. If MMGIS sits behind a reverse proxy that changes the host, port or protocol, set `CONNECTIONS_CALLBACK_BASE_URL` to the site's public URL, including `ROOT_PATH`.
4. Restart MMGIS. Configure → Users & Access → Services shows whether it is set up and which tools use it.

Until its env variables are set, a connection shows as "not set up" and nobody can connect it. With no connection plugins installed, the account menu, tools and Configure look as they did before connections existed.

## What users see

- **Account menu (top right).** When the open mission has a tool that uses a connection, the account button opens a menu with "Sign in to MMGIS" (or the signed-in user) and a **Services** section listing each service, its status and a Connect or Disconnect button. The button looks pressed while the menu is open, and shows a dot while an open tool is waiting for a connection. On `SITE_ACCESS=public` sites a Services button is shown instead.
- **Tool card.** Opening a tool that needs a connection the user hasn't made shows a card in the tool panel: "Connect Earthdata", or "Sign in to MMGIS first" for services that don't allow guests. The tool opens as soon as the connection is made.
- **New tab.** Connect opens the service's own sign-in page in a new browser tab, so its real address and padlock are visible. Afterwards the user lands on an MMGIS page saying "Earthdata connected" that closes itself (or offers "Close this tab"), and the original MMGIS tab updates when they return to it.
- **Guests.** If the connection plugin allows guests (`"guests": true`), a signed-out visitor can connect for the current browser session only. Signing in to an MMGIS account afterwards (a local account, or a provider such as OIDC that signs people in to MMGIS accounts) keeps the connection on that account. A per-request provider with no MMGIS account, such as a proxy header, doesn't take over the guest's connection.

There is no admin view of who has connected what. Deleting an MMGIS account removes its connections.

## Using a connection from a tool

Declare it in the tool's `plugin.json`, using the connection plugin's path:

```json
{
    "name": "MyTool",
    "type": "tool",
    "connections": [{ "plugin": "mycontainer/connections/Earthdata", "required": true }],
    "pluginDependencies": ["mytools/backend/MyToolApi"]
}
```

- `required: true` (the default): MMGIS shows the connect card instead of calling the tool's `make()` until the user is connected.
- `required: false`: the tool opens normally and uses the connection only for some features. Place the standard button yourself with `Connections_.button('earthdata', { container })`.
- A required connection that isn't installed (or a typo in `plugin`) shows an "isn't set up" card instead of the tool. `npm run plugins -- validate` reports the missing reference.
- `{ "id": "earthdata" }` may be used in place of `"plugin"` to name the connection by its id.

Configure shows these requirements, read-only, on the tool's card and in its settings dialog. Nothing is set per mission.

The browser never sees the service's token. Call your own backend route and pass its reply to `handleResponse`, which shows the reconnect card when the service needs connecting again. Pass the function that made the request as the second argument and it runs again once the user has reconnected. A separated tool also passes its tool name as the third argument, so the card goes on its own panel and not on whichever tool is open in the side panel:

```javascript
import Connections_ from '@basics/Connections_/Connections_'

function load() {
    fetch('api/mytool/granules', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((body) => {
            if (Connections_.handleResponse(body, load)) return // card is shown
            render(body)
        })
}
```

For a separated tool: `Connections_.handleResponse(body, load, 'MyTool')`.

The card appears over the tool's panel but doesn't clear it. If the tool shows data from the user's account there, clear it before calling `handleResponse`, for example when a disconnect or a reconnect card means the data is no longer the user's to see.

Other helpers: `Connections_.isConnected('earthdata')`, `Connections_.status('earthdata')`, `Connections_.connect('earthdata')` (call it from a click), `Connections_.on('change', fn)` and `Connections_.off('change', fn)`.

## Using a connection from a backend plugin

`s.connections.token(req, id)` returns a valid access token for the current person, refreshing it if needed, or throws `ConnectionRequiredError`. Reply with `s.connections.connectionRequired(res, err)` so the tool shows the standard card:

```javascript
router.get('/granules', s.authorize('site.view'), async (req, res) => {
    let token
    try {
        token = await s.connections.token(req, 'earthdata')
    } catch (err) {
        if (err instanceof s.connections.ConnectionRequiredError)
            return s.connections.connectionRequired(res, err)
        throw err
    }
    const r = await fetch('https://cmr.earthdata.nasa.gov/...', {
        headers: { Authorization: `Bearer ${token}` },
    })
    res.send({ status: 'success', body: await r.json() })
})
```

If the service refuses the token anyway (say, a `401` because the user revoked access there), call `s.connections.rejected(req, id, token)`. It refreshes the token once and returns the new one to retry with, or throws `ConnectionRequiredError` (and forgets the connection) so the user is asked to reconnect:

```javascript
let r = await call(token)
if (r.status === 401) {
    token = await s.connections.rejected(req, 'earthdata', token) // in the same try as token()
    r = await call(token)
}
```

The reply looks like `{ "status": "failure", "code": "connection_required", "service": "earthdata", "reason": "not_connected", "message": "..." }`. `reason` is `not_connected`, `expired`, `rejected` (the service refused the token and refreshing didn't help), `sign_in` (the service needs an MMGIS sign-in), `not_allowed` (the request used a long-term API token), `not_configured` (its `env` isn't set), `unavailable` (refreshing the token failed for a reason worth retrying, such as a network error; the user stays connected and the card offers Try again) or `unknown` (no such connection is installed).

If the service itself is down or failing (a `5xx`, a timeout), reply with `s.connections.connectionRequired(res, s.connections.unavailable('earthdata'))`. The user stays connected and the card offers Try again. `unavailable(id, message?)` takes an optional message.

Long-term API tokens never get a connection: `token()` throws for them, so scripts can't act as a user at the outside service.

Still check mission or layer access in your route (`s.authorize` with a resolver); a connection only says the person may use the service, not which mission's data they may see.

## Writing a connection plugin

Put it in `plugins/<container>/connections/<Name>/` with a `plugin.json`:

```json
{
    "id": "mycontainer-connection-imagery",
    "name": "Imagery",
    "type": "connection",
    "connection": "imagery",
    "display_name": "Imagery API",
    "description": "Lets tools fetch imagery with the user's own Imagery API account.",
    "guests": false,
    "env": ["IMAGERY_CLIENT_ID", "IMAGERY_CLIENT_SECRET"]
}
```

- `connection`: the id used everywhere else. Lowercase letters, digits, `-` or `_`, starting with a letter, and unique across installed plugins. MMGIS lowercases it, so `"Imagery"` becomes `imagery`.
- `guests`: whether signed-out visitors may connect for their browser session. Defaults to `false`.
- `env`: variables that must be set before anyone can connect. Configure lists the missing ones.
- `pkce`: `true` to use PKCE (S256). MMGIS makes a verifier for each sign-in and passes `codeChallenge` and `codeChallengeMethod` to `authorizeUrl()` and `codeVerifier` to `exchange()`. Defaults to `false`.

and a `plugin.js`:

```javascript
module.exports = {
    // URL of the service's sign-in page (OAuth 2 authorization endpoint)
    // With "pkce": true, also add code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod
    authorizeUrl({ state, redirectUri, env, codeChallenge, codeChallengeMethod }) {
        const u = new URL('https://imagery.example/oauth/authorize')
        u.search = new URLSearchParams({
            client_id: env.IMAGERY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: redirectUri,
            state,
        })
        return u.toString()
    },
    // Swap the code for tokens (with "pkce": true, send code_verifier: codeVerifier)
    async exchange({ code, redirectUri, env, codeVerifier }) {
        const body = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri })
        return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: body.expires_in, account: body.username }
    },
    // Optional
    async refresh({ refreshToken, env }) { /* -> same shape as exchange */ },
    async revoke({ accessToken, refreshToken, env }) { /* tell the service to forget the token */ },
    validate(env) { return [] }, // problems that keep it "not set up"
    warnings(env) { return [] }, // logged at startup only
}
```

MMGIS handles the rest: the `state` value and its checks, the callback route, storage, refresh, the menus and cards. `account` is the name shown as "Connected as …" to that user only.

**Refresh.** `token()` calls `refresh()` when the token has under a minute left, or under a quarter of its lifetime for tokens that last less than four minutes. Requests that need a refresh at the same time share one `refresh()` call, so a rotating refresh token is only used once. If `refresh()` throws, the user has to connect again, unless the error is worth retrying: a network error, an error with `status` 429 or 5xx, or one you mark with `err.transient = true`. Then the connection is kept and the reply's `reason` is `unavailable`. Set `err.transient = false` to force either way.

### Example: NASA Earthdata Login

A complete connection for [Earthdata Login](https://urs.earthdata.nasa.gov), as `plugins/<container>/connections/Earthdata/`. Register an Earthdata Login application with the redirect URI `<your site>/api/connections/earthdata/callback`, then set `EARTHDATA_CLIENT_ID` and `EARTHDATA_CLIENT_SECRET` (and `EARTHDATA_URL=https://uat.urs.earthdata.nasa.gov` for UAT). A tool then declares `"connections": [{ "plugin": "<container>/connections/Earthdata", "required": true }]`.

`plugin.json`:

```json
{
  "uuid": "5b1e7f3c-2c4a-4f0e-9a61-6f0c2e8d9b14",
  "id": "mycontainer-connection-earthdata",
  "name": "Earthdata",
  "display_name": "Earthdata",
  "description": "NASA Earthdata Login (OAuth 2). Tools use the user's Earthdata token to fetch Earthdata data.",
  "version": "1.0.0",
  "type": "connection",
  "connection": "earthdata",
  "tier": "community",
  "guests": true,
  "env": ["EARTHDATA_CLIENT_ID", "EARTHDATA_CLIENT_SECRET"],
  "author": "NASA-AMMOS/MMGIS",
  "license": "Apache-2.0",
  "repository": "https://github.com/NASA-AMMOS/MMGIS"
}
```

`plugin.js`:

```javascript
// Earthdata Login (https://urs.earthdata.nasa.gov) as a service connection.
// Register an application with Earthdata Login and set its redirect URI to
// <site>/api/connections/earthdata/callback.
const baseUrl = (env) => (env.EARTHDATA_URL || "https://urs.earthdata.nasa.gov").replace(/\/+$/, "");

const basicAuth = (env) =>
  "Basic " + Buffer.from(`${env.EARTHDATA_CLIENT_ID}:${env.EARTHDATA_CLIENT_SECRET}`).toString("base64");

async function tokenRequest(env, params) {
  const res = await fetch(`${baseUrl(env)}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  // The status lets MMGIS tell an outage (429, 5xx: keep the connection) from a refused grant
  if (!res.ok || typeof body.access_token !== "string")
    throw Object.assign(new Error(`Earthdata token request failed (HTTP ${res.status}).`), { status: res.status });
  return body;
}

// Earthdata returns the user's profile path as "endpoint" (e.g. /api/users/jdoe)
async function accountName(env, body) {
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const fallback = endpoint ? endpoint.split("/").filter(Boolean).pop() : null;
  if (!endpoint || !endpoint.startsWith("/")) return fallback;
  try {
    const res = await fetch(`${baseUrl(env)}${endpoint}`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    const profile = await res.json();
    return (profile && profile.uid) || fallback;
  } catch (err) {
    return fallback;
  }
}

const grant = async (env, body) => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token,
  expiresIn: body.expires_in,
  account: await accountName(env, body),
});

module.exports = {
  authorizeUrl({ state, redirectUri, env }) {
    const q = new URLSearchParams({
      client_id: env.EARTHDATA_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `${baseUrl(env)}/oauth/authorize?${q.toString()}`;
  },
  async exchange({ code, redirectUri, env }) {
    return grant(env, await tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: redirectUri }));
  },
  async refresh({ refreshToken, env }) {
    return grant(env, await tokenRequest(env, { grant_type: "refresh_token", refresh_token: refreshToken }));
  },
  async revoke({ accessToken, env }) {
    await fetch(`${baseUrl(env)}/oauth/revoke?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { Authorization: basicAuth(env) },
    });
  },
  validate(env) {
    if (env.EARTHDATA_URL && !/^https?:\/\//.test(env.EARTHDATA_URL))
      return ["EARTHDATA_URL must start with http:// or https://."];
    return [];
  },
};
```

## Where tokens are kept

- **Signed-in users with an MMGIS account** (local, or through a provider that links to an account): in the `auth_connections` table, one row per user and connection, encrypted with AES-256-GCM using a key derived from `SECRET`. Changing `SECRET` makes stored connections unreadable, and users connect again.
- **Guests and per-request provider identities with no MMGIS account:** in the server-side session, gone when the session ends.
- Tokens are never put in cookies, the mission config, tile URLs or replies to the browser.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/connections` | anyone who may view the site | Each installed connection and whether the current person is connected |
| `GET /api/connections/:id/connect` | same | Starts connecting; redirects to the service |
| `GET /api/connections/:id/callback` | same | Where the service sends people back |
| `POST /api/connections/:id/disconnect` | same | Removes the stored token and asks the service to revoke it |
| `GET /api/connections/setup` | admins | Which connections are installed and set up, and their env status |

## API keys

For a service where each person has a personal API key instead of OAuth, use the same connect flow with a page that hands MMGIS the key indirectly:

1. `authorizeUrl({ state, redirectUri })` returns the URL of a page where the person pastes or confirms their key. Best is a page on the service itself. Otherwise serve it from a companion backend plugin's route (a connection plugin has no routes of its own).
2. That page redirects to `redirectUri` with `state` unchanged and a one-time `code`, never the key.
3. `exchange({ code })` trades the code for the key server-to-server and returns `{ accessToken: key }`. Leave out `expiresIn`, so the key never expires in MMGIS until the service refuses it. A `401` then goes through `s.connections.rejected()`, which forgets the key and asks the person to connect again.

Rules for the key page:

- Never put the key in a URL (query or fragment). URLs end up in logs and browser history.
- Codes are single-use, expire within a minute or so, and are bound to the `redirect_uri` they were issued for. Redirect only to an exact, registered `redirect_uri`.
- Protect the paste form against CSRF, and require a client secret (from `env`) on the code exchange.
- Don't log the request body or query strings of the form or exchange.
- Leave out `revoke()` when the key is the person's own key that other apps also use. Disconnect then only forgets it in MMGIS.

## Gotchas

- **Get the plugin path right** in a tool's `connections` list. A path that matches no installed connection plugin logs a warning in the browser. If that entry is `"required": true`, the tool doesn't open and its card says the service isn't set up; an optional one is ignored.
- **Register the exact redirect URI** with the service, including `ROOT_PATH`. Behind a proxy, set `CONNECTIONS_CALLBACK_BASE_URL`. If the service rejects it, the error shows on the service's page and MMGIS never hears back. Configure → Users & Access → Services shows the callback URL MMGIS sends for each connection, and the tool's waiting card has a Cancel link.
- **Several MMGIS instances** behind a load balancer don't share refreshes. With a refresh token that rotates, use sticky sessions, or two instances refreshing at once can sign the user out of the service.
- **The account menu** lists only services people can connect now. A service that isn't set up appears only on its tools' cards and in Configure.
- **API keys and other pasted credentials** have no built-in form. See [API keys](#api-keys).
- **Disconnecting** doesn't close an open tool; its next request gets `connection_required` and shows the card.
- **A sign-in link lasts 10 minutes.** After that the callback says the link expired and the person clicks Connect again.
- **No `expiresIn` or `expiresAt`** in a grant means the token is treated as never expiring until the service rejects it.
- **Errors the service sends back** (`error`, `error_description`) are logged as warnings and the description is shown on the return page.
- **Nothing is logged at startup** when a connection's `env` is unset; Configure's Services tab lists what's missing.
- **Don't** ask for a service's username and password in a tool, put tokens in tile URLs, or put credentials in a mission config.
- **Tiles:** Leaflet and Cesium fetch tiles as plain image requests, which can't carry a per-user token. Serve them through your backend route if they need one.
