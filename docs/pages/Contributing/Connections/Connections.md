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
- **Guests.** If the connection plugin allows guests (`"guests": true`), a signed-out visitor can connect for the current browser session only. Signing in to MMGIS afterwards keeps the connection on their account.

There is no admin view of who has connected what. Disabling or deleting an MMGIS account removes its connections.

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
- `{ "id": "earthdata" }` may be used in place of `"plugin"` to name the connection by its id.

Configure shows these requirements, read-only, on the tool's card and in its settings dialog. Nothing is set per mission.

The browser never sees the service's token. Call your own backend route and pass its reply to `handleResponse`, which shows the reconnect card when the service needs connecting again:

```javascript
import Connections_ from '@basics/Connections_/Connections_'

fetch('api/mytool/granules', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((body) => {
        if (Connections_.handleResponse(body)) return // card is shown
        render(body)
    })
```

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

The reply looks like `{ "status": "failure", "code": "connection_required", "service": "earthdata", "reason": "not_connected", "message": "..." }`. `reason` is `not_connected`, `expired`, `sign_in` (the service needs an MMGIS sign-in), `not_allowed` (the request used a long-term API token), `not_configured` (its `env` isn't set) or `unknown` (no such connection is installed).

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

and a `plugin.js`:

```javascript
module.exports = {
    // URL of the service's sign-in page (OAuth 2 authorization endpoint)
    authorizeUrl({ state, redirectUri, env }) {
        const u = new URL('https://imagery.example/oauth/authorize')
        u.search = new URLSearchParams({
            client_id: env.IMAGERY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: redirectUri,
            state,
        })
        return u.toString()
    },
    // Swap the code for tokens
    async exchange({ code, redirectUri, env }) {
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
  if (!res.ok || typeof body.access_token !== "string")
    throw new Error(`Earthdata token request failed (HTTP ${res.status}).`);
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

- **Signed-in users:** in the `auth_connections` table, one row per user and connection, encrypted with AES-256-GCM using a key derived from `SECRET`. Changing `SECRET` makes stored connections unreadable, and users connect again.
- **Guests and external-provider sessions:** in the server-side session, gone when the session ends.
- Tokens are never put in cookies, the mission config, tile URLs or replies to the browser.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/connections` | anyone who may view the site | Each installed connection and whether the current person is connected |
| `GET /api/connections/:id/connect` | same | Starts connecting; redirects to the service |
| `GET /api/connections/:id/callback` | same | Where the service sends people back |
| `POST /api/connections/:id/disconnect` | same | Removes the stored token and asks the service to revoke it |
| `GET /api/connections/setup` | admins | Which connections are installed and set up, and their env status |

## Gotchas

- **Get the plugin path right** in a tool's `connections` list. A path that matches no installed connection plugin logs a warning in the browser and the tool opens without the card.
- **Register the exact redirect URI** with the service, including `ROOT_PATH`. Behind a proxy, set `CONNECTIONS_CALLBACK_BASE_URL`. If the service rejects it, the error shows on the service's page and MMGIS never hears back.
- **A sign-in link lasts 10 minutes.** After that the callback says the link expired and the person clicks Connect again.
- **No `expiresIn` or `expiresAt`** in a grant means the token is treated as never expiring until the service rejects it.
- **Errors the service sends back** (`error`, `error_description`) are logged as warnings and the description is shown on the return page.
- **Nothing is logged at startup** when a connection's `env` is unset; Configure's Services tab lists what's missing.
- **Don't** ask for a service's username and password in a tool, put tokens in tile URLs, or put credentials in a mission config.
- **Tiles:** Leaflet and Cesium fetch tiles as plain image requests, which can't carry a per-user token. Serve them through your backend route if they need one.
