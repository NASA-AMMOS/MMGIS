---
layout: page
title: ENVs
permalink: /setup/envs
parent: Setup
---

# Environment Variables

Environment variables are set within `MMGIS/.env`. A sample file `MMGIS/sample.env` is provided. On startup, erroneous .env setups are logged.

## Required Variables

#### `SERVER=`

The kind of server running (apache is deprecated) | string enum | default `''`

- _node:_ A node express server running NodeJS v20.11.1+
- _apache (deprecated):_ Served through Apache. Some or all functionality may not work

#### `AUTH=`

The kind of authentication method used | string enum | default `''`

- _off:_ No authentication. Users cannot sign up or log in. Tools that require log in will not work.
- _none:_ No authentication. Users can still sign up and log in from within MMGIS.
- _local:_ Anyone without credentials is blocked. The Admin must log in, create accounts and pass out the credentials.
- _csso:_ Use a Cloud Single Sign On service that's proxied in front of MMGIS.

#### `NODE_ENV=`

Instance type | string enum | default `production`

- _production:_
- _development:_ Shows configure and documentation links on the landing page for convenience

#### `SECRET=`

Some random string | string | default `null`

#### `DB_HOST=`

URL of Postgres database | string | default `null`

#### `DB_PORT=`

Port for Postgres database | string | default `null`

#### `DB_NAME=`

Name of Postgres database | string | default `null`

#### `DB_USER=`

User of Postgres database | string | default `null`

#### `DB_PASS=`

Password of Postgres database | string | default `null`

## Optional Variables

#### `PORT=`

Port to run on | positive integer | default `8888`

#### `HTTPS=`

If true, MMGIS will use an https server with the, now required, `HTTPS_KEY` and `HTTPS_CERT` envs. If false, use a wrapping https proxy server instead and block `PORT` from being public | boolean | false

#### `HTTPS_KEY=`

Relative path to key. If using docker, make sure the key is mounted. Everything under './ssl/' is gitignored and './ssl/' is mounted into docker.

#### `HTTPS_CERT=`

Relative path to cert. If using docker, make sure the cert is mounted. Everything under './ssl/' is gitignored and './ssl/' is mounted into docker.

#### `DB_POOL_MAX=`

Max number connections in the database's pool. CPUs \* 4 is a good number | integer | default `10`

#### `DB_POOL_TIMEOUT=`

How many milliseconds until a DB connection times out | integer | default `30000` (30 sec)

#### `DB_POOL_IDLE=`

How many milliseconds for an incoming connection to wait for a DB connection before getting kicked away | integer | default `10000` (10 sec)

#### `CSSO_GROUPS=`

A list of CSSO LDAP groups that have access | string[] | default `[]`

#### `VERBOSE_LOGGING=`

Potentially logs a bunch of extra stuff for development purposes | bool | default `false`

#### `FRAME_ANCESTORS=`

Sets the `Content-Security-Policy: frame-ancestors` header to allow the embedding of MMGIS in the specified external sites | string[] | default `null` | ex. FRAME_ANCESTORS='["http://localhost:8888"]'

#### `FRAME_SRC=`

Sets the `Content-Security-Policy: frame-src` header to allow the embedding iframes from external origins into MMGIS | string[] | default `null` | ex. FRAME_SRC='["http://localhost:8888"]'

#### `THIRD_PARTY_COOKIES=`

Sets "SameSite=None; Secure" on the login cookie. Useful when using AUTH=local as an iframe within a cross-origin page. | boolean | default `false`

#### `ROOT_PATH=`

Set MMGIS to be deployed under a subpath. For example if serving at the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set `ROOT_PATH=/path/where/I/serve/mmgis`. Should always begin with a `/`. If no subpath, leave blank. | string | default `""`

#### `EXTERNAL_ROOT_PATH=`

Tell MMGIS that it's already deployed under a subpath. For example if already proxying to the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set `ROOT_PATH=/path/where/I/serve/mmgis`. This differs from ROOT_PATH in that MMGIS will not place any of it's endpoints under this path but will still query as if it did. Should always begin with a `/`. If `ROOT_PATH` is also set, requests will use `EXTERNAL_ROOT_PATH` + `ROOT_PATH`. If no external subpath, leave blank. | string | default `""`

#### `WEBSOCKET_ROOT_PATH=`

Overrides ROOT_PATH's use when the client connects via websocket. Websocket url: `${ws_protocol}://${window.location.host}${WEBSOCKET_ROOT_PATH || ROOT_PATH || ''}/` | string | default `""`

#### `CLEARANCE_NUMBER=`

Sets a clearance for the website | string | default `CL##-####`

#### `LINK_PREVIEW_TITLE=`

Initial HTML page title. When sharing a link to MMGIS in an application that supports link previews, the title to be used | string | default `MMGIS`

#### `LINK_PREVIEW_DESCRIPTION=`

Initial HTML page description. When sharing a link to MMGIS in an application that supports link previews, the description to be used | string | default `A web-based mapping and localization solution for science operation on planetary missions.`

#### `DISABLE_LINK_SHORTENER=`

If true, users that use the 'Copy Link' feature will receive a full-length deep link. Writing new short links will be disabled but expanding existing ones will still work. | bool | default `false`

#### `HIDE_CONFIG=`

Make the configure page inaccessible to everyone | bool | default `false`

#### `FORCE_CONFIG_PATH=`

The path to a json config file that acts as the only configured mission for the instance | string | default `''`

#### `LEADS=`

When not using AUTH=csso, this is a list of usernames to be treated as leads (users with elevated permissions) | string[] | default `[]`

#### `CSSO_LEAD_GROUP=`

LDAP group of leads (users with elevated permissions) | string | default `''`

#### `ENABLE_MMGIS_WEBSOCKETS=`

If true, enables the backend MMGIS websockets to tell clients to update layers | boolean | default `false`

#### `ENABLE_CONFIG_WEBSOCKETS=`

If true, notifications are sent to /configure users whenever the current mission's configuration object changes out from under them and thne puts (overridable) limits on saving | boolean | default `false`

#### `ENABLE_CONFIG_OVERRIDE=`

For use when `ENABLE_CONFIG_WEBSOCKETS=true` (if `ENABLE_CONFIG_WEBSOCKETS=false`, all saves will freely overwrite already). If true, gives /configure users the ability to override changes made to the configuration while they were working on it with their own. | boolean | default `false`

#### `MAIN_MISSION=`

If the new MAIN_MISSION ENV is set to a valid mission, skip the landing page and go straight to that mission. Other missions will still be accessible by either forcing the landing page (clicking the top-left M logo) or by going to a link directly. | string | default `''`

#### `SKIP_CLIENT_INITIAL_LOGIN=`

If true, MMGIS will not auto-login returning users. This can be useful when login is managed someplace else. The initial login process can be manually triggered with `mmgisAPI.initialLogin()` | boolean | default `false`

#### `GENERATE_SOURCEMAP=`

If true at build-time, JavaScript source maps will also be built | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_DOWNLOAD=`

If true, then at every other midnight, MMGIS will read /Missions/spice-kernels-conf.json and re/download all the specified kernels. See /Missions/spice-kernels-conf.example.json | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_DOWNLOAD_ON_START=`

If true, then also triggers the kernel download when MMGIS starts | boolean | default `false`

#### `SPICE_SCHEDULED_KERNEL_CRON_EXPR=`

A cron schedule expression for use in the [node-schedule npm library](https://www.npmjs.com/package/node-schedule) | string | default `"0 0 */2 * *"` (every other day)

#### `COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS=`

When using composited time tiles, MMGIS queries the tileset's folder for existing time folders. It caches the results of the these folder listings every COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS milliseconds. Defaults to requerying every 30 minutes. If 0, no caching. If null or NaN, uses default. | number | default `1800000`
