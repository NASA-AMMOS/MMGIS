---
layout: page
title: v3 => v4
permalink: /migration/v3-to-v4
parent: Migration
has_children: false
nav_order: 8
---

# v3.x.x => v4.0.0

## Adding the Adjacent Servers

Version 3.x.x => 4.0.0 adds support for the following adjacent services:

- stac-fastapi - [https://github.com/stac-utils/stac-fastapi](https://github.com/stac-utils/stac-fastapi)
- tipg - [https://github.com/developmentseed/tipg](https://github.com/developmentseed/tipg)
- titiler - [https://github.com/developmentseed/titiler](https://github.com/developmentseed/titiler)
- titiler-pgstac - [https://github.com/stac-utils/titiler-pgstac](https://github.com/stac-utils/titiler-pgstac)

All adjacent services are proxied through MMGIS and endpoints that perform writes are locked behind MMGIS' authentication.

- https://{mmgis-domain}/stac
- https://{mmgis-domain}/tipg
- https://{mmgis-domain}/titiler
- https://{mmgis-domain}/titilerpgstac

### Upgrading Python and Installing the Adjacent Services

**If using docker, this is unneeded.**

1. Make sure you are using python >=3.10 to <3.13 (3.13 is not supported).
1. In the root MMGIS directory `/`, run `python -m pip install -r python-requirements.txt`

### Setting the Adjacent Server ENVs

#### With Docker

1. Fill out the `POSTGRES_*` environment variables in and use `docker-compose.sample.yml`

#### Without Docker

1. Copy `/adjacent-servers/stac/.env.example` to `/adjacent-servers/stac/.env` and fill out the `POSTGRES_*` environment variables.
1. Copy `/adjacent-servers/tipg/.env.example` to `/adjacent-servers/tipg/.env` and fill out the `POSTGRES_*` environment variables.
1. Copy `/adjacent-servers/titiler/.env.example` to `/adjacent-servers/titiler/.env`.
1. Copy `/adjacent-servers/titiler-pgstac/.env.example` to `/adjacent-servers/titiler-pgstac/.env` and fill out the `POSTGRES_*` environment variables.
1. Make sure your system `PROJ_LIB` environment variable is pointed to the installation of proj within the python version in use. For example, my local machine's installation is located at `.../Programs/Python/Python312/Lib/site-packages/pyproj/proj_dir/share/proj`.

## Upgrading Postgres

Depending on how outdated your MMGIS database is, you may need to upgrade it. v16+ is required now. The following example was taken from upgrading MMGIS's database from v10 to v16 on AWS.

1. Take a snapshot of the existing DB
2. Create a dump of the existing DB
   Example (with "mmgisdb" as the database name):
   pg_dump --host="{host}.rds.amazonaws.com" --username={username} -F c -b -v mmgisdb -f "./mmgisdb.backup"
3. Create a new postgres v16 DB
   Initialize a default DB while creating
   (I had to create a new Parameter Group for this DB and set rds.force_ssl = 0 and then reboot. Otherwise the following error occurs: FATAL: no pg_hba.conf entry for host)
4. Point MMGIS to the new DB and start MMGIS
5. Bring MMGIS down
6. Restore DB
   Example (with "mmgisdb" as the database name) Note that this is pointing to a new host:
   pg_restore --host="{new_host}.rds.amazonaws.com" --username={username} d mmgisdb v "./mmgisdb.backup --clean"
7. Restart MMGIS

Depending on your setup and existing version of postgres, other methods of upgrading postgres may be more appropriate.
