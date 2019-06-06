# MMGIS (Multi-Mission Geographic Information System)

Spatial Data Infrastructure for Planetary Missions
[Test Mission Demo](http://miplmmgis.jpl.nasa.gov/mmgis/MMGISTEST/?mission=Test)

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

- Apache 2.2.27
- PHP 5.4.16+
  - php-pdo php-mysqli pdo_sqlite modules enabled
- SQLite3 3.8.8.3
- GDAL 2.0.2 or 1.11.4 with Python bindings
- Python 2.75+

## Installing

1. Clone the repository on your server (or download the zip):  
   `git clone https://github.jpl.nasa.gov/MIPL/MMGIS`  
   _Note:_ append a folder name to the command to choose which folder to clone to.
2. Run `./install.sh`  
   _Note:_ you may need to make this executable first.
3. To run with apache, change .env file 'SERVER=apache', else 'SERVER=node'. Set PORT number appropriately.
   For authentication, set 'AUTH=csso' for single sign on, or 'AUTH=none' for everything else. 'none' doesn't mean no authentication,
   it just means not CSSO. LDAP authentication can be set on the Apache server settings. When using node, you can set 'NODE=development' or 'NODE=production'. Database parameters can also be set in this file, if one is used.
4. Change the line "SELINUX=enforcing" to "SELINUX=permissive" in /etc/selinux/config.
   _Note:_ This allows MMGIS to write files to its SQLITE database.

And you're done!

## Setting Up

In order to set up your own missions, navigate to `[path]/MMGIS/config` and either modify `Test` or create a `New Mission`. For instructions on how to use the configuration page visit the [Config Wiki](https://github.jpl.nasa.gov/MIPL/MMGIS/wiki/Config).

## Installing with Docker

To build the Docker image, run:
`docker build -t <image tag> .`

To run CAMP in a container, you need to create a directory on the host machine and map this to a directory in the container. On the host machine, create a `Missions` directory and copy the contents of `./Missions` to your directory. Map this directory to `/usr/src/app/Missions` in the container. For example, if the host directory is `/Missions`, launch the container with:

`docker run -v /Missions:/usr/src/app/Missions <image tag>`

CAMP can be configured by setting the following environment variables on the container:

- `DB_HOST`: Database host URL
- `DB_USER`: Username for database connection.
- `DB_PASS`: Password for database.
