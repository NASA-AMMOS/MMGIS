---
layout: page
title: Installation
permalink: /setup/installation
parent: Setup
nav_order: 1
---

# Installation

---

## Installing with Docker

`/` will always refer to the repo's root directory

1. Clone the repo  
   `git clone https://github.com/NASA-AMMOS/MMGIS`

1. From within `/`  
   `npm install`

### Building

To build the Docker image, run:
`docker build -t <image tag> .`

### Running

This repo contains a `/docker-compose.yml` file that defines a service for the application and a PostgreSQL database with PostGIS installed

- Copy `/sample.env` to `.env`  
   `cp sample.env .env`
- Open `.env` and update the following:

  ```
  DB_NAME=<name>
  DB_USER=<user>
  DB_PASS=<password>
  ```

  From the install example:

  ```
  DB_NAME=db
  DB_USER=postgres
  DB_PASS=<POSTGRES_PASSWORD (see below)>
  ```

- Set all the ENV variables in `.env`. More information about the ENVs can be found [here.](https://nasa-ammos.github.io/MMGIS/setup/envs)
  - If using the postgis/postgres image from within the docker-compose.yml, set the ENV `DB_NAME` to the name of the service (in this case `db`)
- In the `db` service in `docker-compose.yml`, set the `POSTGRES_PASSWORD` environment variable and use this for MMGIS's `DB_PASS` ENV value.
- To run MMGIS in a container, you need to create a directory on the host machine and map this to a directory in the container.
  - On the host machine, create a `Missions` directory and copy the contents of `./Missions` to your directory.
  - Via the docker-compose.yml, map this directory to `/usr/src/app/Missions` in the container. For example, if the host directory is `./Missions`, the volume mapping would be `- ./Missions:/usr/src/app/Missions`

Run: `docker-compose up -d`

### First Time UI Setup

1. Setup the admin account:

   - In your browser, navigate to `http://localhost:8888/configure`
   - Sign up for an Administrator account (The Administrator account is always the first user in the database and you are only prompted to create an Administrator account if there are no other users)

1. Now sign in with you Administrator credentials

1. Click `NEW MISSION`  
   Enter a new mission name and click `MAKE MISSION`  
   Optional: (Use the mission name `"Test"` (case-sensitive) to make the sample mission)

Navigate to `http://localhost:8888`.

See the [configuration documentation](https://nasa-ammos.github.io/MMGIS/configure/) for more information on how to use the configure page to customize and add data to MMGIS.

## Installing Without Docker

### System Requirements

1. Install the latest version of [Node.js v20.11.1+](https://nodejs.org/en/download/).

1. Install [PostgreSQL v10.14+](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads). Detailed [install instructions](https://www.postgresqltutorial.com/postgresql-getting-started/) for all platforms.
1. Install [PostGIS 2.5+](https://postgis.net/install/). From the above install, you can use the 'Application Stack Builder' to install PostGIS or the default [PostGIS install instructions](https://postgis.net/install/) for all platforms.
1. Make a new PostgreSQL database and remember the user, password and database name.
   Use 'pgsl' or the 'SQL Shell' to log into Postgres. It will prompt you for the username and password made during the install.

1. GDAL and Python are weaker dependencies (desirable but, without them, not everything will work)

   - GDAL [2.+](https://gdal.org/download.html) with Python bindings (Windows users may find [these](https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal) helpful)
   - Python [3.6+](https://www.python.org/downloads/release/python-396/)
     - `python -m pip install numpy`
     - Note: MMGIS expects and uses the command `python` only and not `python3` or variations.

### Setup

`/` will always refer to the repo's root directory

1. Clone the repo  
   `git clone https://github.com/NASA-AMMOS/MMGIS`

1. From within `/`  
   `npm install`

1. Copy `/sample.env` to `.env`  
   `cp sample.env .env`

1. Open `.env` and update the following:

   ```
   DB_NAME=<name>
   DB_USER=<user>
   DB_PASS=<password>
   ```

   From the install example:

   ```
   DB_NAME=mmgis
   DB_USER=postgres
   DB_PASS=<password>
   ```

1. Run `npm run build` to bundle up the code (first time or if there are any changes)

1. Go into /configure and run `npm install` followed by `npm run build` to build the beta configuration site.

1. Go back to the root `/` directory

1. Run `npm run start:prod`

1. Setup the admin account:

   - In your browser, navigate to `http://localhost:8888/configure`
   - Sign up for an Administrator account (The Administrator account is always the first user in the database and you are only prompted to create an Administrator account if there are no other users)

1. Now sign in with you Administrator credentials

1. Click `NEW MISSION`  
   Enter a new mission name and click `MAKE MISSION`  
   (Use the mission name `"Test"` (case-sensitive) to make the sample mission)

Go to `http://localhost:8888` to see the `Test` mission

_Note:_ The development environment (`npm start`) and only the development environment uses two port numbers `8888` and `8889` (by default) — the latter for the main site and the former for the ancillary pages (such as `/configure` and `/docs`)

---

## Scripts

### Production

1. Run `npm run build` to bundle up the code (first time or if there are any changes)

1. Run `npm run start:prod`

### Development

1. Run `npm start`

### Test

1. Run `npm run test`  
   _Note:_ Jest has just been added in v2.0.0 and test suites are still very limited
