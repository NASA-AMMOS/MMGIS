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

Depending on how outdated your MMGIS database is, you may need to upgrade it. v18+ is recommended now (v16+ is the minimum). The `docker-compose.sample.yml` ships with `postgis/postgis:18-3.6-alpine`.

### Upgrading from v16 to v18

If you are already running PostgreSQL 16, the upgrade to 18 is straightforward using `pg_dump` / `pg_restore`:

1. Take a snapshot of the existing DB
2. Create a dump of the existing DB
   ```bash
   pg_dump --host="{host}" --username={username} -F c -b -v {dbname} -f "./mmgis_backup.dump"
   ```
3. Stop all MMGIS services (`docker compose down`)
4. Remove the old database volume (e.g. `docker volume rm mmgis_mmgis-db`)
5. Update `docker-compose.yml` to use `postgis/postgis:18-3.6-alpine`
6. Start only the database service (`docker compose up -d db`) and wait for it to be healthy
7. Restore the dump into the new v18 database:
   ```bash
   pg_restore --host="{host}" --username={username} --dbname={dbname} -v "./mmgis_backup.dump"
   ```
8. Start the remaining services (`docker compose up -d`)
9. Verify extensions are present:
   ```sql
   SELECT * FROM pg_extension;
   SELECT PostGIS_Version();
   ```

### Upgrading from older versions (v10–v15)

The following example was taken from upgrading MMGIS's database from v10 to v16 on AWS and applies similarly when targeting v18:

1. Take a snapshot of the existing DB
2. Create a dump of the existing DB
   ```bash
   pg_dump --host="{host}.rds.amazonaws.com" --username={username} -F c -b -v mmgisdb -f "./mmgisdb.backup"
   ```
3. Create a new PostgreSQL v18 DB
   Initialize a default DB while creating
   (You may need to create a new Parameter Group for this DB and set rds.force_ssl = 0 and then reboot. Otherwise the following error occurs: FATAL: no pg_hba.conf entry for host)
4. Point MMGIS to the new DB and start MMGIS
5. Bring MMGIS down
6. Restore DB
   ```bash
   pg_restore --host="{new_host}.rds.amazonaws.com" --username={username} --dbname=mmgisdb -v "./mmgisdb.backup" --clean
   ```
7. Restart MMGIS

Depending on your setup and existing version of PostgreSQL, other methods of upgrading (such as `pg_upgrade` for in-place upgrades) may be more appropriate.
