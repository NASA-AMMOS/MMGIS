# MMGIS (Multi-Mission Geographic Information System)

Spatial Data Infrastructure for Planetary Missions

## Features

- Web-based mapping interface
- Slippy map
- 3D globe with tiled height data
- Image viewer capable of showing mosaics with targets
- Customizable layers
- Multiuser vector drawing
- Elevation profiler
- And more...

## Requirements/Tested With

- Apache 2.2.27+
- PHP 5.4.16+
  - php-pdo php-mysqli pdo_sqlite modules enabled
- SQLite3 3.8.8.3+
- GDAL 2+ with Python bindings
- Python 2.75+

## Installing

1. Clone the repository on your server (or download the zip):  
   `git clone https://github.jpl.nasa.gov/MIPL/MMGIS`  
   _Note:_ append a folder name to the command to choose which folder to clone to.
2. Run `./install.sh`  
   _Note:_ you may need to make this executable first.
3. To run with apache, change .env file 'SERVER=apache', else 'SERVER=node'. Set PORT number appropriately.
   For authentication, set 'AUTH=csso' for single sign on, or 'AUTH=none' for everything else (inclduing LDAP auth). When using node, you can set 'NODE=development' or 'NODE=production'. Database parameters can also be set in this file, if one is used.

And you're done!

## Setting Up

In order to set up your own missions, navigate to `[path]/MMGIS/config` and either modify `Test` or create a `New Mission`. For instructions on how to use the configuration page visit the [Config Wiki](https://github.jpl.nasa.gov/MIPL/MMGIS/wiki/Config).

## Installing with Docker

To build the Docker image, run:
`docker build -t <image tag> .`

To run MMGIS in a container, you need to create a directory on the host machine and map this to a directory in the container. On the host machine, create a `Missions` directory and copy the contents of `./Missions` to your directory. Map this directory to `/usr/src/app/Missions` in the container. For example, if the host directory is `/Missions`, launch the container with:

`docker run -v /Missions:/usr/src/app/Missions <image tag>`

MMGIS can be configured by setting the following environment variables on the container:

- `DB_HOST`: Database host URL
- `DB_USER`: Username for database connection.
- `DB_PASS`: Password for database.

## License: Apache 2.0

License Terms

Copyright (c) 2019, California Institute of Technology ("Caltech").  U.S. Government sponsorship acknowledged.

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* Redistributions must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Neither the name of Caltech nor its operating division, the Jet Propulsion Laboratory, nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Contacts

Dr. Fred J. Calef III - fred.calef@jpl.nasa.gov  
Tariq K. Soliman - tariq.k.soliman@jpl.nasa.gov
