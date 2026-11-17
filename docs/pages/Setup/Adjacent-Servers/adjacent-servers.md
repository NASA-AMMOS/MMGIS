---
layout: page
title: Adjacent Servers
permalink: /setup/adjacent-servers
parent: Setup
has_children: false
nav_order: 3
---

## Adjacent Servers

Version 4.0.0+ adds support for the following adjacent services:

- stac-fastapi - [https://github.com/stac-utils/stac-fastapi](https://github.com/stac-utils/stac-fastapi)
- tipg - [https://github.com/developmentseed/tipg](https://github.com/developmentseed/tipg)
- titiler - [https://github.com/developmentseed/titiler](https://github.com/developmentseed/titiler)
- titiler-pgstac - [https://github.com/stac-utils/titiler-pgstac](https://github.com/stac-utils/titiler-pgstac)
- veloserver - [https://github.com/NASA-AMMOS/Veloserver](https://github.com/NASA-AMMOS/Veloserver)

All adjacent services are proxied through MMGIS and endpoints that perform writes are locked behind MMGIS' authentication.

**Requirement:** adjacent services must only be reachable through these MMGIS proxy routes. Don't publish their ports outside the host or container network. MMGIS checks access on the proxy routes (reads need the matching `*.read` capability, other methods the `*.write` one), but the services themselves don't, so a directly reachable service is not covered by MMGIS' site access and roles.

- https://{mmgis-domain}/stac
- https://{mmgis-domain}/tipg
- https://{mmgis-domain}/titiler
- https://{mmgis-domain}/titilerpgstac
- https://{mmgis-domain}/veloserver

## Security

### TiTiler SSRF Protection

The TiTiler proxy accepts a `?url=` parameter that specifies which geospatial file to process. Without proper validation, this can be exploited for Server-Side Request Forgery (SSRF) attacks, allowing attackers to:
- Access internal network resources (e.g., `http://localhost:3306/`)
- Read arbitrary files (e.g., `file:///etc/passwd`)
- Scan internal ports and services
- Exfiltrate sensitive data

**Mitigation**: Configure the `TITILER_ALLOWED_URL_PATTERNS` environment variable to restrict URLs to trusted sources. See [ENVs documentation](../ENVs/ENVs.md#titiler_allowed_url_patterns) for detailed configuration instructions.

**Recommended for Production**:
```bash
TITILER_ALLOWED_URL_PATTERNS='["^https://(?!.*\\.\\.)(?!.*\\x00).*$"]'
```

This pattern requires HTTPS and blocks common attack vectors (path traversal, null bytes).

## Embedded or external

`ADJACENT_SERVERS_MODE` decides who runs the adjacent services:

| Mode | Who starts the services | Where MMGIS proxies to | Path TiTiler sees `Missions` under |
| --- | --- | --- | --- |
| `embedded` | MMGIS, as child processes | `localhost:<port>` | `../../Missions` |
| `external` | You (Compose services, Podman quadlet units, ...) | `<service name>:<port>` | `/Missions` |

The service names used in `external` mode are `stac-fastapi`, `tipg`, `titiler`, `titiler-pgstac` and `veloserver`.

When unset, the mode is `external` inside a container (Docker, Podman or Kubernetes) and `embedded` otherwise. Setting it explicitly is recommended for container deployments. MMGIS logs the mode it chose at startup.

To run the services inside the MMGIS container instead of beside it, set `ADJACENT_SERVERS_MODE=embedded`. They take their settings from the container's environment, or from an optional `adjacent-servers/<name>/.env` file.

In `embedded` mode, a service that stops is reported in the MMGIS log with its exit code and its last lines of output.

### Upgrading Python and Installing the Adjacent Services

**If using docker, this is unneeded.**

1. Make sure you are using python >=3.10 to <3.13 (3.13 is not supported).
1. In the root MMGIS directory `/`, run `python -m pip install -r python-requirements.txt`

### Setting the Adjacent Server ENVs

#### With Docker

1. Fill out the `POSTGRES_*` environment variables in and use `docker-compose.sample.yml`
1. Unused services within the docker-compose.yml can be safely removed.

#### With Podman

`examples/podman-quadlet/` has systemd quadlet units for MMGIS, PostGIS, STAC and TiTiler. See its `README.md`.

#### Without Docker (embedded)

The `.env` files below are optional. Without one, a service starts with the environment MMGIS was started with.


1. Copy `/adjacent-servers/stac/.env.example` to `/adjacent-servers/stac/.env` and fill out the `POSTGRES_*` environment variables.
1. Copy `/adjacent-servers/tipg/.env.example` to `/adjacent-servers/tipg/.env` and fill out the `POSTGRES_*` environment variables.
1. Copy `/adjacent-servers/titiler/.env.example` to `/adjacent-servers/titiler/.env`.
1. Copy `/adjacent-servers/titiler-pgstac/.env.example` to `/adjacent-servers/titiler-pgstac/.env` and fill out the `PG*` environment variables (`PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`).
1. Make sure your system `PROJ_LIB` environment variable is pointed to the installation of proj within the python version in use. For example, my local machine's installation is located at `.../Programs/Python/Python312/Lib/site-packages/pyproj/proj_dir/share/proj`.

### Setting MMGIS ENVs

To finally enable the proxying to services, enable the following MMGIS ENVs in your `.env`:

- WITH_STAC=true
- WITH_TIPG=true
- WITH_TITILER=true
- WITH_TITILER_PGSTAC=true
- WITH_VELOSERVER=true

_Note:_ The STAC, TITILER and TITILER_PGSTAC services being enabled activates certain features within MMGIS. The other services can be setup independently if desired.
