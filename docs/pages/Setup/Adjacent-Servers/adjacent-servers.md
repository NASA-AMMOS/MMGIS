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

### Upgrading Python and Installing the Adjacent Services

**If using docker, this is unneeded.**

1. Make sure you are using python >=3.10 to <3.13 (3.13 is not supported).
1. In the root MMGIS directory `/`, run `python -m pip install -r python-requirements.txt`

### Setting the Adjacent Server ENVs

#### With Docker

1. Fill out the `POSTGRES_*` environment variables in and use `docker-compose.sample.yml`
1. Unused services within the docker-compose.yml can be safely removed.

#### Without Docker

1. Copy `/adjacent-servers/stac/.env.example` to `/adjacent-servers/stac/.env` and fill out the `POSTGRES_*` environment variables.
1. Copy `/adjacent-servers/tipg/.env.example` to `/adjacent-servers/tipg/.env` and fill out the `POSTGRES_*` environment variables.
1. Copy `/adjacent-servers/titiler/.env.example` to `/adjacent-servers/titiler/.env`.
1. Copy `/adjacent-servers/titiler-pgstac/.env.example` to `/adjacent-servers/titiler-pgstac/.env` and fill out the `POSTGRES_*` environment variables.
1. Make sure your system `PROJ_LIB` environment variable is pointed to the installation of proj within the python version in use. For example, my local machine's installation is located at `.../Programs/Python/Python312/Lib/site-packages/pyproj/proj_dir/share/proj`.

### Setting MMGIS ENVs

To finally enable the proxying to services, enable the following MMGIS ENVs in your `.env`:

- WITH_STAC=true
- WITH_TIPG=true
- WITH_TITILER=true
- WITH_TITILER_PGSTAC=true
- WITH_VELOSERVER=true

_Note:_ The STAC, TITILER and TITILER_PGSTAC services being enabled activates certain features within MMGIS. The other services can be setup independently if desired.
