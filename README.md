<hr>
<div align="center">
  <h1 align="center">
      MMGIS (Multi-Mission Geographic Information System)
  </h1>
</div>

<pre align="center">Spatial Data Infrastructure for Planetary Missions</pre>

<span style="display:block;text-align:center">![Example](/documentation/images/Full_Example.png)</span>

---

## Features

- Web-based mapping interface
- 2D slippy map
- 3D globe with tiled height data
- Image viewer capable of showing mosaics with targets
- 5 fully customizable layer types
- Easy to use CMS
- Multi-user vector drawing
- Elevation profiler
- Custom projections
- Tiling scripts
- And so much more...

---

## [Full documentation](https://nasa-ammos.github.io/MMGIS/)

---

## Installation

### System Requirements

1. Install the latest version of [Node.js v16.13.2+](https://nodejs.org/en/download/).

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
   _Note:_ Jest has just been added in v2.0.0 and test suites are still very limited. There is strong interest to move to Playwright.

---

## Documentation

### [The latest online documentation can be found here.](https://nasa-ammos.github.io/MMGIS/)

Additionally, documentation pages are served at `http://localhost:8888/docs` or immediately within the [`docs/pages/markdowns`](/docs/pages/markdowns) directory.

---

## Contributing

Check out our contributing guide [here.](CONTRIBUTING.md)

---

## Code of Conduct

Check out our code of conduct [here.](CODE_OF_CONDUCT.md)

---

## Installing with Docker

To build the Docker image, run:
`docker build -t <image tag> .`

To run MMGIS in a container, you need to create a directory on the host machine and map this to a directory in the container. On the host machine, create a `Missions` directory and copy the contents of `./Missions` to your directory. Map this directory to `/usr/src/app/Missions` in the container. For example, if the host directory is `/Missions`, launch the container with:

`docker run -v /Missions:/usr/src/app/Missions <image tag>`

This repo contains a `docker-compose.yml` file that defines a service for the application and a PostgreSQL database with PostGIS installed. Simply set all the env variables in `.env` and run:

`docker-compose up`

---

### License: Apache 2.0 (https://www.apache.org/licenses/LICENSE-2.0)

Copyright (c) 2023, California Institute of Technology ("Caltech"). U.S. Government sponsorship acknowledged.

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
- Redistributions must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
- Neither the name of Caltech nor its operating division, the Jet Propulsion Laboratory, nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---

## Contacts

Dr. Fred J. Calef III - fred.calef@jpl.nasa.gov  
Tariq K. Soliman - tariq.k.soliman@jpl.nasa.gov
