---
layout: page
title: ENVs
permalink: /setup/envs
parent: Setup
nav_order: 2
---

# Environment Variables

Environment variables are set within `MMGIS/.env`. A sample file `MMGIS/sample.env` is provided. On startup, erroneous .env setups are logged.

## Required Variables

#### `SERVER=`

The kind of server running (apache is deprecated) | string enum | default `''`

- _node:_ A node express server running NodeJS v22.20.0+
- _apache (deprecated):_ Served through Apache. Some or all functionality may not work

#### `SITE_ACCESS=`

Who can view the main site | string enum | no default (required)

- _public:_ Anyone can view. There is no end-user login on the main site; only admins log in at `/configure`.
- _optional:_ Anyone can view. Users can sign up and log in from within MMGIS (e.g. to save Draw files).
- _required:_ Visitors must log in to see anything. The Admin must log in, create accounts and pass out the credentials or set `AUTH_LOCAL_ALLOW_SIGNUP=true`.

The old `AUTH` variable has been removed. MMGIS refuses to start while `AUTH` is set and prints its replacement:

| Old | New |
|---|---|
| `AUTH=off` | `SITE_ACCESS=public` `AUTH_PROVIDERS=["local"]` |
| `AUTH=none` | `SITE_ACCESS=optional` `AUTH_PROVIDERS=["local"]` |
| `AUTH=local` | `SITE_ACCESS=required` `AUTH_PROVIDERS=["local"]` |
| `AUTH=csso` | `SITE_ACCESS=required` `AUTH_PROVIDERS=["proxy","local"]` `PROXY_TRUST=network` (or `PROXY_SECRET`) |

The `csso` provider is now `proxy`, and its ENVs were renamed: `CSSO_GROUPS` → `PROXY_GROUPS`, `CSSO_LEAD_GROUP` → `PROXY_LEAD_GROUP`, `CSSO_PROXY_SECRET` → `PROXY_SECRET`. MMGIS refuses to start while an old name is set. A proxy that sends `X-Sub`, `X-Groups` and `X-Session` keeps working unchanged with the defaults below plus `PROXY_TRUST=network`, which is how `AUTH=csso` trusted it.

#### `AUTH_PROVIDERS=`

Login methods, as a JSON array or comma-separated list | string[] | default `["local"]`

- _local:_ MMGIS username/password accounts. Keep it listed so `/configure` admins can always log in.
- _proxy:_ An authenticating reverse proxy in front of MMGIS (such as Cloud Single Sign On) that sends the user's identity in request headers. See `PROXY_TRUST`.

Each provider is a core auth provider plugin under `plugins/core/auth/`. To add one, see [Writing an Auth Provider](/MMGIS/contributing/auth-providers).

#### `NODE_ENV=`

Instance type | string enum | default `production`

- _production:_
- _development:_ Shows configure and documentation links on the landing page for convenience

#### `TRUST_PROXY=`

Which proxies in front of MMGIS to trust for the client's IP address (`X-Forwarded-For`), used by rate limits and logs. A number trusts that many proxies, `false` trusts none and uses the direct connection's address, and other values (such as `loopback` or a list of addresses) are passed to Express's `trust proxy` setting. Set it to `false` when browsers reach MMGIS directly, or a client can pick its own IP and get around per-IP rate limits.

**Type**: number, boolean or string | **Default**: `1`

#### `SECRET=`

**Required.** A cryptographically random string used to sign session cookies. This secret ensures that session IDs cannot be forged by attackers.

**Type**: string (minimum 24 characters) | **Default**: None (application will fail to start if not set)

**Important**: This value must be kept confidential. Use a long, random string (e.g., 64+ characters generated with `openssl rand -hex 64` or `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) . Do not use the sample value from `sample.env` in production. If this variable is not set or is shorter than 24 characters, the server will refuse to start. Connection tokens are encrypted with a key derived from it, so changing it removes every stored connection, and users connect again.

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

#### `DB_SSL=`

If the Postgres DB instance is enforcing SSL, set to true to have MMGIS connect to it via SSL | boolean | default `false`

#### `DB_SSL_CERT=`

If `DB_SSL=true` and if needed, the path to a certificate for ssl | string | default `null`

#### `DB_SSL_CERT_BASE64=`

Alternatively, if `DB_SSL=true` and if needed, a base64 encoded certificate for ssl. `DB_SSL_CERT_BASE64` will take priority over `DB_SSL_CERT` | string | default `null`

#### `DB_USER_TEST=`

Test-specific database user. Required by test infrastructure (`tests/global-setup.js`, `tests/test-db-clean.js`) for least-privilege separation. No fallback — tests will not run without this | string | default `null`

#### `DB_PASS_TEST=`

Test-specific database password. Required by test infrastructure for least-privilege separation. No fallback — tests will not run without this | string | default `null`

#### `AUTH_LOCAL_ALLOW_SIGNUP=`

If SITE_ACCESS=required and set to true, this allows all guests to the site to create user accounts otherwise, they just see a login page with no signup section | boolean | default `false`

#### `AUTH_LOCAL_LOGIN=`

Which local accounts may log in with a username and password. `all`: any local account. `admins`: only accounts holding an editing or admin role (Layer Editor, Mission Admin, Data Admin or SuperAdmin), for sites such as `AUTH_PROVIDERS=["proxy","local"]` where everyone else logs in through the external provider. `admins` also turns off visitor sign-up, whatever `AUTH_LOCAL_ALLOW_SIGNUP` says. Any other value stops startup | string | default `all`

#### `SETUP_CODE=`

While the site has no accounts, creating the first (SuperAdmin) account on `/configure` requires a one-time setup code. If unset, the server generates a random code on each start and prints it in its log (not in the log files); the code works once. Set this to choose the code yourself, for scripted installs or several replicas behind one URL. It has no effect once an account exists | string | default `null`

#### `CONNECTIONS_CALLBACK_BASE_URL=`

Public URL of this site, including any `ROOT_PATH`, used to build the address an outside service sends people back to after they connect it (`<url>/api/connections/<id>/callback`). Set it whenever MMGIS runs behind a reverse proxy that changes the host, port or protocol; without it MMGIS uses the request's `X-Forwarded-Host` or `Host`, which a client can spoof. It must be a full `http(s)://` URL ending with `ROOT_PATH`; MMGIS warns at startup otherwise. See [Connections](/MMGIS/contributing/connections) | string | default from the request


#### `PROXY_GROUPS=`

With the `proxy` login provider, a list of proxy groups whose members may open the map and `/configure`. Replaces `CSSO_GROUPS` | string[] | default `[]`

#### `PROXY_TRUST=`

How MMGIS knows a request's identity headers came from the `proxy` login provider's proxy. `secret`: the request must carry `PROXY_SECRET` in the `PROXY_SECRET_HEADER` header. `ips`: the request must come straight from an address in `PROXY_TRUSTED_IPS`. `network`: trust the headers on every request, as `AUTH=csso` did; MMGIS must then be reachable only through the proxy, and the proxy must remove those headers from what clients send. MMGIS refuses to start when `secret` has no `PROXY_SECRET` or `ips` has no valid `PROXY_TRUSTED_IPS` | string enum | default `secret`

#### `PROXY_SECRET=`

The shared secret the proxy adds to every request it forwards, in the `PROXY_SECRET_HEADER` header. Required when `PROXY_TRUST=secret`. Replaces `CSSO_PROXY_SECRET` | string | default `''`

#### `PROXY_SECRET_HEADER=`

Header that carries `PROXY_SECRET` | string | default `X-MMGIS-Proxy-Secret`

#### `PROXY_TRUSTED_IPS=`

With `PROXY_TRUST=ips`, the proxy's addresses or CIDR ranges, as a JSON array or comma list, e.g. `["10.0.0.5","10.1.0.0/16"]`. Checked against the connecting address, never `X-Forwarded-For` | string[] | default `[]`

#### `PROXY_USER_HEADER=`

Header with the signed-in user's name. A request without it is not signed in by the proxy | string | default `X-Sub`

#### `PROXY_GROUPS_HEADER=`

Header with the user's groups. A request without it is signed in with no groups; one whose groups can't be read is not signed in. As with `AUTH=csso`, any truthy value counts as membership, but the lead group (`PROXY_LEAD_GROUP`) needs exactly `true` | string | default `X-Groups`

#### `PROXY_GROUPS_FORMAT=`

How `PROXY_GROUPS_HEADER` is written. `base64-json`: base64 of a JSON object whose `true` keys are the groups, as CSSO sends. `json`: the same object, or an array of group names, not base64-encoded. `list`: comma-separated names | string enum | default `base64-json`

#### `PROXY_SESSION_HEADER=`

Optional header with the proxy's session id, used as `sessionID` in MMGIS logs | string | default `X-Session`

#### `PROXY_STATUS_URL=`

Where the map checks every few minutes that the proxy session is still valid (POST); a failed check signs the user out through `PROXY_LOGOUT_URL`. `off` turns the check off, for proxies without such an endpoint | string | default `/ssostatus`

#### `PROXY_LOGOUT_URL=`

Where Sign out and the "not allowed" page send users signed in by the proxy. Sign out also ends any local MMGIS sign-in made behind the proxy | string | default `/ssologoutredirect`

#### `PROXY_LOGIN_URL=`

The proxy's sign-in redirect the map can send users to (`?redirect=<current page>` is appended) | string | default `/ssologinredirect`

#### `PROXY_REFRESH_URL=`

Where the map POSTs to extend the proxy session when it is about to time out | string | default `/ssorefreshtimeout`

#### `VERBOSE_LOGGING=`

Potentially logs a bunch of extra stuff for development purposes | bool | default `false`

#### `FRAME_ANCESTORS=`

Sets the `Content-Security-Policy: frame-ancestors` header to allow the embedding of MMGIS in the specified external sites | string[] | default `null` | ex. FRAME_ANCESTORS='["http://localhost:8888"]'

#### `FRAME_SRC=`

Sets the `Content-Security-Policy: frame-src` header to allow the embedding iframes from external origins into MMGIS | string[] | default `null` | ex. FRAME_SRC='["http://localhost:8888"]'

#### `THIRD_PARTY_COOKIES=`

Sets "SameSite=None; Secure" on the login cookie. Useful when using SITE_ACCESS=required as an iframe within a cross-origin page. | boolean | default `false`

#### `CORS_ORIGINS=`

Comma-separated origins allowed for cross-origin HTTP requests and websockets. When unset, only same-origin requests are allowed. | comma-separated origins | default `""`

**Upgrade note:** Cross-origin browser clients that previously relied on wildcard CORS must set this to a comma-separated list of their allowed origins.

#### `SESSION_COOKIE_SECURE=`

Controls the session cookie `Secure` flag. Set to `true` or `false`; when unset, it defaults to `true` if `HTTPS=true` or `THIRD_PARTY_COOKIES=true`. `THIRD_PARTY_COOKIES=true` requires this to remain enabled. | boolean | default `HTTPS=true || THIRD_PARTY_COOKIES=true`

**Upgrade note:** Deployments with `HTTPS=true` now receive `Secure` session cookies by default. Set `SESSION_COOKIE_SECURE=false` only when TLS is intentionally not used.

#### `ROOT_PATH=`

Set MMGIS to be deployed under a subpath. For example if serving at the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set `ROOT_PATH=/path/where/I/serve/mmgis`. Should always begin with a `/`. If no subpath, leave blank. | string | default `""`

#### `EXTERNAL_ROOT_PATH=`

Tell MMGIS that it's already deployed under a subpath. For example if already proxying to the subpath 'https://{domain}/path/where/I/serve/mmgis' is desired, set `ROOT_PATH=/path/where/I/serve/mmgis`. This differs from ROOT_PATH in that MMGIS will not place any of it's endpoints under this path but will still query as if it did. Should always begin with a `/`. If `ROOT_PATH` is also set, requests will use `EXTERNAL_ROOT_PATH` + `ROOT_PATH`. If no external subpath, leave blank. | string | default `""`

#### `WEBSOCKET_ROOT_PATH=`

Overrides ROOT_PATH's use when the client connects via websocket. Websocket url: `${ws_protocol}://${window.location.host}${WEBSOCKET_ROOT_PATH || ROOT_PATH || ''}/` | string | default `""`

#### `CLEARANCE_NUMBER=`

Sets a clearance for the website | string | default `CL##-####`

#### `CONTACT_INFO=`

A string of text for contact information on the bottom right corner of the login pages | string | default `None Provided`

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

For local accounts, this is a list of usernames to be treated as leads (users with elevated permissions) | string[] | default `[]`

#### `PROXY_LEAD_GROUP=`

With the `proxy` login provider, the proxy group of leads (users with elevated permissions). Replaces `CSSO_LEAD_GROUP` | string | default `''`

#### `ENABLE_MMGIS_WEBSOCKETS=`

If true, enables the backend MMGIS websockets to tell clients to update layers. Also enables `POST /api/broadcast/layerUpdate`, which lets an admin push a re-query of specific layers to connected clients (time-enabled layers and non-time vector layers only). | boolean | default `false`

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

#### `GDAL_ALLOWED_REMOTE_PREFIXES=`

Comma-separated list of remote GDAL dataset prefixes that `/api/utils/getprofile`, `/api/utils/getbands` and `/api/utils/getminmax` are allowed to open — for instance `/vsis3/my-bucket/,https://my-cdn.example.gov/dems/`. Recognized prefixes are the network-backed GDAL virtual file systems (`/vsicurl/`, `/vsis3/`, `/vsigs/`, `/vsiaz/`, `/vsiadls/`, `/vsioss/`, `/vsiswift/`, `/vsihdfs/`, `/vsiwebhdfs/`, including their `_streaming` variants) plus `http://`, `https://` and `ftp://` urls; entries that are not one of these, or that name no host or bucket (`/vsicurl/`, `https://`), are ignored. When empty, those endpoints only accept rasters under `/Missions`. MMGIS' server fetches these datasets itself and returns their contents as pixel values, so only list locations you trust — a broad entry lets any user of the site read from hosts the server can reach. Local virtual file systems such as `/vsizip/` and `/vsisubfile/` are always rejected. | string | default `""` (no remote datasets)

#### `COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS=`

When using composited time tiles, MMGIS queries the tileset's folder for existing time folders. It caches the results of the these folder listings every COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS milliseconds. Defaults to requerying every 30 minutes. If 0, no caching. If null or NaN, uses default. | number | default `1800000`

## Adjacent Servers

Enables and proxies to other self-hosted services. [Additional setup](/MMGIS/setup/adjacent-servers) may be required.

#### `WITH_STAC=`

STAC Catalogs - https://github.com/stac-utils/stac-fastapi-pgstac | default `false`

#### `STAC_PORT=`

Port to proxy stac on | default `8881`

#### `WITH_TIPG=`

TiTiler PG Vectors - https://github.com/developmentseed/tipg | default `false`

#### `TIPG_PORT=`

Port to ruproxyn tipg on | default `8882`

#### `WITH_TITILER=`

TiTiler - https://developmentseed.org/titiler | default `false`

#### `TITILER_PORT=`

Port to proxy titiler on | default `8883`

#### `TITILER_ALLOWED_URL_PATTERNS=`

**Security Feature**: URL validation for TiTiler proxy to prevent Server-Side Request Forgery (SSRF) attacks.

A JSON array of regular expression patterns that define allowed URLs for TiTiler requests. When configured, any URL passed to TiTiler (via `?url=` parameter) must match at least one pattern or the request will be blocked with HTTP 403 Forbidden.

**Format**: JSON array of regex strings | **Type**: string[] | **Default**: `[]` (allow all)

**Behavior**:
- **Unset or empty array `[]`**: Allow all URLs (backward compatible with existing deployments)
- **Non-empty array**: URL must match at least one regex pattern to be proxied
- **Invalid JSON or regex**: Logs error, disables validation (allows all URLs)
- **Important**: To allow TiTiler to read from the local `/Missions` directory, include the file:// pattern in your configuration (see examples below).

**Security Recommendations**:
- Always configure this in production environments
- Use the most restrictive patterns possible for your use case
- Regularly review logs for blocked requests

**Common Patterns**:

1. **Recommended for Production** (HTTPS + local Missions files):
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://(?!.*\\.\\.)(?!.*\\x00).*$", "^/Missions/(?!.*\\.\\.).*$"]'
   ```
   - Requires HTTPS protocol for remote URLs
   - Allows local `/Missions` directory files as relative paths (e.g., `/Missions/Test/data.tif`)
   - Blocks path traversal (`..`) in both remote and local paths
   - Blocks null byte injection

2. **Specific Trusted Domains**:
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://tiles\\.example\\.com/.*", "^https://data\\.nasa\\.gov/.*"]'
   ```
   - Only allows specific trusted domains

3. **S3 Buckets**:
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://[^/]*\\.s3\\.[^/]*\\.amazonaws\\.com/.*"]'
   ```
   - Allows any S3 bucket URL

4. **Multiple Patterns** (OR logic):
   ```bash
   TITILER_ALLOWED_URL_PATTERNS='["^https://tiles\\.example\\.com/.*", "^https://.*\\.s3\\.amazonaws\\.com/.*", "^https://data\\.nasa\\.gov/.*", "^/Missions/.*"]'
   ```
   - URLs matching ANY pattern are allowed
   - Includes local Missions directory access

**Regex Syntax Notes**:
- Use `\\.` to match literal dots (escape backslash in JSON: `\\\\.`)
- Use `.*` to match any characters (zero or more)
- Use `^` to anchor at start, `$` to anchor at end
- Use `(?!...)` for negative lookahead (e.g., block patterns)
- Test patterns before deployment (invalid regex will be logged and skipped)

**Error Response** (when URL blocked):
```json
{
  "error": "Forbidden",
  "message": "The requested URL does not match allowed patterns",
  "detail": "URL parameter must match one of the configured TITILER_ALLOWED_URL_PATTERNS"
}
```

**Logging**: Blocked requests are logged at `warn` level with the blocked URL, request details, and user session for security auditing.

**Note**: Changes to this ENV variable require server restart to take effect.

**See Also**: [Adjacent Servers Security](../Adjacent-Servers/adjacent-servers.md#security)

#### `WITH_TITILER_PGSTAC=`

TiTiler Mosaicking - https://github.com/stac-utils/titiler-pgstac | default `false`

#### `TITILER_PGSTAC_PORT=`

Port to proxy titiler-pgstac on | default `8884`

#### `WITH_VELOSERVER=`

Veloserver - Velocity and Wind Data Visualization Server - https://github.com/NASA-AMMOS/Veloserver | default `false`

#### `VELOSERVER_PORT=`

Port to proxy veloserver on | default `8104`

### Custom Adjacent Servers

Configure your own adjacent servers without modifying core MMGIS code. These environment variables allow you to add custom proxy endpoints that follow the same pattern as the built-in adjacent servers.

#### `ADJACENT_SERVER_CUSTOM_X=`

Custom adjacent server configuration where X is a number (0, 1, 2, etc.) | JSON array | default `null`

**Format:** `["isEnabled", "routeName", "serviceName", "port"]`

**Parameters:**

- `isEnabled` - String "true" or "false" to enable/disable this server
- `routeName` - URL path name (will be accessible at `/routeName`)
- `serviceName` - Docker service name or "localhost" for non-containerized deployments
- `port` - Port number the service runs on

**Examples:**

```bash
ADJACENT_SERVER_CUSTOM_0=["true", "my_api", "my_api_service", "8105"]
ADJACENT_SERVER_CUSTOM_1=["true", "data_service", "data_service_container", "9000"]
ADJACENT_SERVER_CUSTOM_2=["false", "disabled_service", "disabled_service", "8106"]
```

**Access Pattern:**
Custom servers will be accessible at `{ROOT_PATH}/{routeName}` where `ROOT_PATH` is your configured root path (if any) and `routeName` is the route name specified in the configuration.

**Note:**

- Includes standard authentication middleware (allows all GETs, requires admin auth for other methods)
