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

### Upgrading Python and Installing the Adjacent Services

**If using docker, this is unneeded.**

1. Make sure you are using python >=3.10 to <3.13 (3.13 is not supported).
1. In the root MMGIS directory `/`, run `python -m pip install -r python-requirements.txt`

### Setting the Adjacent Server ENVs

Set `ADJACENT_SERVERS_MODE` explicitly for your deployment. The mode controls process startup, proxy targets and local COG paths; it does not depend on the container runtime.

#### Separate services (`external`)

1. Fill out the `POSTGRES_*` environment variables in and use `docker-compose.sample.yml`
1. Set `ADJACENT_SERVERS_MODE=external` for MMGIS. Both Compose samples already set this on the MMGIS service and work with Docker or Podman. Existing container deployments with separate services must also add this setting when upgrading.
1. Unused services within the docker-compose.yml can be safely removed.
1. Mount Missions at `/Missions` in TiTiler services to resolve local COG paths.

MMGIS only proxies to these services and does not start duplicate local processes. Service hostnames and ports are listed in the [ENVs documentation](../ENVs/ENVs.md#adjacent_servers_mode).

#### Local processes (`embedded`, the default)

Set `ADJACENT_SERVERS_MODE=embedded` to let MMGIS start the enabled Python services and proxy to `localhost`. This also works inside a standalone Docker or Podman container. The child processes inherit MMGIS's environment, so per-service `.env` files are optional. To use service-specific settings instead, follow the steps below. Values in these files override inherited variables. An unsuccessful startup is logged with the exit code or signal and the last stderr output.

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
