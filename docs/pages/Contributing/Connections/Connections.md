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
- [Setting up Earthdata](#setting-up-earthdata)
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

## Setting up Earthdata

The core Earthdata connection is `plugins/core/connections/Earthdata`.

1. Register an application with [Earthdata Login](https://urs.earthdata.nasa.gov) and set its redirect URI to `<your site>/api/connections/earthdata/callback` (including any `ROOT_PATH`).
2. Set `EARTHDATA_CLIENT_ID` and `EARTHDATA_CLIENT_SECRET`. For the UAT server also set `EARTHDATA_URL=https://uat.urs.earthdata.nasa.gov`.
3. If MMGIS sits behind a proxy that changes the host or protocol, set `CONNECTIONS_CALLBACK_BASE_URL` to the site's public URL.
4. Restart MMGIS. Configure → Users & Access → Services shows whether it is set up and which tools use it.

Until both variables are set, the connection shows as "not set up" and nobody can connect it.

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
    "connections": [{ "plugin": "core/connections/Earthdata", "required": true }],
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

The reply looks like `{ "status": "failure", "code": "connection_required", "service": "earthdata", "reason": "not_connected", "message": "..." }`. `reason` is `not_connected`, `expired`, `sign_in` (the service needs an MMGIS sign-in) or `not_allowed` (the request used a long-term API token).

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

- `connection`: the id used everywhere else. Lowercase letters, digits, `-` or `_`, starting with a letter, and unique across installed plugins.
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
- **Register the exact redirect URI** with the service, including `ROOT_PATH`. Behind a proxy, set `CONNECTIONS_CALLBACK_BASE_URL`.
- **Don't** ask for a service's username and password in a tool, put tokens in tile URLs, or put credentials in a mission config.
- **Tiles:** Leaflet and Cesium fetch tiles as plain image requests, which can't carry a per-user token. Serve them through your backend route if they need one.
