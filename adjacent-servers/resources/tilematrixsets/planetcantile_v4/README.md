# Planetcantile

[![PyPI version](https://img.shields.io/pypi/v/planetcantile.svg)](https://pypi.org/project/planetcantile/)
[![Python Versions](https://img.shields.io/pypi/pyversions/planetcantile.svg)](https://pypi.org/project/planetcantile/)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

Planetcantile provides TileMatrixSets (TMS) for planetary bodies throughout the solar system, enabling tiled map visualization and analysis for the Moon, Mars, and many other celestial bodies using standard web mapping techniques.

A TileMatrixSet defines how a spatial area (like a planet) is divided into a hierarchy of tiles at different zoom levels. By implementing the [OGC TileMatrixSet standard](https://docs.ogc.org/is/17-083r4/17-083r4.html) for planetary bodies, Planetcantile makes it possible to use Earth-focused web mapping tools with data from across the solar system.

## Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Web API](#option-1-using-the-web-api)
  - [Python Library](#option-2-as-a-python-library)
  - [Environment Variables](#environment-variables)
  - [Extending with Custom Definitions](#extending-with-custom-definitions)
- [Supported Planetary Bodies](#supported-planetary-bodies)
- [Integration with Other Libraries](#integration-with-other-libraries)
- [Contributing](#contributing)
- [License](#license)

## Features

- <strong>Extensive Coverage:</strong> Support for ~100 celestial bodies including planets, moons, asteroids, and comets

- <strong>Multiple Projection Types:</strong>
  - Geographic (regular lat/lon) - Standard equirectangular/plate carrée projection
  - Equidistant Cylindrical - Cylindrical projection preserving distances along meridians
  - World Mercator - "Mercator (variant A)" [(EPSG 9804)](https://epsg.io/9804-method)
  - Web Mercator - "Popular Visualisation Pseudo Mercator" [(EPSG 1024)](https://epsg.io/1024-method)
  - North Polar Stereographic - Projection centered on the North Pole
  - South Polar Stereographic - Projection centered on the South Pole


- <strong>Coordinate System Support:</strong> Handles different coordinate systems for planetary bodies:
  - Sphere (spherical approximation)
  - Ocentric (planetocentric, center-based coordinates)
  - Ographic (planetographic, surface-based coordinates)
  
  Multiple coordinate system options are available for many celestial bodies.

- <strong>Coalesced Grids:</strong> Special grid layouts that reduce the number of tiles needed near poles, optimizing storage and performance.

- <strong>Cloud Optimized GeoTIFF (COG) Support:</strong> Works with COG, STAC, and MosaicJSON through TiTiler integration

- <strong>Seamless Integration:</strong> Works with morecantile, TiTiler, and other OGC-compatible web mapping tools

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Pip package manager

### Installation

#### Basic Installation (Python Library)

```
# Make sure pip is up to date
python -m pip install -U pip

# Install planetcantile
python -m pip install planetcantile
```

#### Installation with Web Application

```
# Install with web application dependencies
python -m pip install "planetcantile[app]"

# Launch the application
python -m uvicorn planetcantile.app:app --host 0.0.0.0 --port 8000
```

#### Installation from Source

```
# Clone the repository
git clone https://github.com/AndrewAnnex/planetcantile.git
cd planetcantile

# Install with web application (Includes the core library plus dependencies)
pip install -e ".[app]"

# Or install for development (Includes all dependencies plus development tools)
pip install -e ".[dev]"

# Then launch the application (with auto-reload for development)
uvicorn planetcantile.app:app --host 0.0.0.0 --port 8000 --reload
```

#### Docker Container (Experimental)

Warning: The Docker container is currently experimental and may crash unexpectedly. It can be useful for quick exploration but is not recommended for production use: [planetcantile_docker](https://github.com/AndrewAnnex/planetcantile_docker)

## Usage

### Option 1: Using the Web API

After starting the web application, the API interface will be accessible at [http://localhost:8000/docs](http://localhost:8000/docs)

More information about endpoints is available in the [TiTiler documentation](https://developmentseed.org/titiler/).

Example tile request:

```
http://localhost:8000/cog/tiles/MarsGeographicSphere/{z}/{x}/{y}?url=https://path/to/mars.tif
```

For local files, replace the URL with the local file path: ``url=file:///home/user/path/to/mars.tif``.

### Option 2: As a Python Library

#### Using planetcantile directly

```python
# Import the planetary TMS collection
from planetcantile import planetary_tms

# List available TMS
print(planetary_tms.list())

# Get a specific TMS
mars_tms = planetary_tms.get("MarsGeographicSphere")

# Register a custom TMS (example)
# planetary_tms.register(custom_tms)

# Now use with morecantile
from morecantile import Tile
tile = Tile(x=0, y=0, z=0)
bounds = mars_tms.bounds(tile)
print(f"Bounds of Mars tile: {bounds}")
```

#### Using morecantile directly (without importing planetcantile)

```python
import os
import sysconfig
from pathlib import Path

# Find planetcantile's TMS definitions directory
site_packages = sysconfig.get_path('purelib')
tms_dir = Path(site_packages) / "planetcantile" / "data" / "tms"

if tms_dir.exists():
  # Set the environment variable for morecantile
  os.environ["TILEMATRIXSET_DIRECTORY"] = str(tms_dir)
else:
    print(f"Warning: TMS directory not found at {tms_dir}")

# Now use morecantile directly with planetcantile's TMS definitions
from morecantile import tms

# List available TMS (including planetcantile ones)
print(tms.list())

# Get a specific planetary TMS
mars_tms = tms.get("MarsGeographicSphere")

# Use it with a tile
from morecantile import Tile
tile = Tile(x=0, y=0, z=0)
bounds = mars_tms.bounds(tile)
print(f"Bounds of Mars tile: {bounds}")
```

### Environment Variables

<strong>TILEMATRIXSET_DIRECTORY</strong>
This environment variable allows you to specify a directory containing custom TileMatrixSet JSON definitions. Planetcantile will merge these with its own TMS definitions.

You can set this programmatically before importing planetcantile:

```python
import os

# Option 1: Point to your custom TMS definitions
os.environ["TILEMATRIXSET_DIRECTORY"] = "/path/to/your/custom/tms/definitions"

# Option 2: Point to planetcantile's TMS definitions (for using with morecantile)
import sysconfig
from pathlib import Path
site_packages = sysconfig.get_path('purelib')
planetcantile_tms_dir = Path(site_packages) / "planetcantile" / "data" / "tms"
if planetcantile_tms_dir.exists():
    os.environ["TILEMATRIXSET_DIRECTORY"] = str(planetcantile_tms_dir)
else:
    print(f"Warning: TMS directory not found at {planetcantile_tms_dir}")

# Now import and use either planetcantile or morecantile
from morecantile import tms
# or
from planetcantile import planetary_tms
```

### Extending with Custom Definitions

Planetcantile supports two approaches for adding custom TMS definitions:

1. <strong>Using the generate.py script:</strong> This gives you fine-grained control over how the TMS definitions are generated, particularly when working with complex planetary coordinate reference systems.

2. <strong>Adding JSON files directly:</strong> As a simpler alternative, you can create TMS JSON definition files and add them to your custom directory specified by the ``TILEMATRIXSET_DIRECTORY`` environment variable.

## Supported Planetary Bodies

Planetcantile includes TMS definitions for:

- Planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- Dwarf Planets: Ceres, Pluto
- Moons: Including the Earth's Moon and various moons of Mars, Jupiter, Saturn, Uranus, and Neptune
- Asteroids: Including Vesta, Eros, Ida, and others
- Comets: Including Halley, Wild2, Churyumov-Gerasimenko, and others

Each body has multiple projection types available (see Features section).

All TMS definitions are based on official International Astronomical Union (IAU) Coordinate Reference Systems (CRS) registered with the Open Geospatial Consortium (OGC). The complete catalog of these CRS is available at the [VESPA-CRS Registry](http://voparis-vespa-crs.obspm.fr:8080/web/).

## Integration with Other Libraries

### morecantile

Planetcantile extends [morecantile](https://developmentseed.org/morecantile/) by providing TMS definitions for celestial bodies beyond Earth. When you import planetcantile, it automatically registers all its planetary TMS definitions with morecantile, making them available through morecantile's API.

### TiTiler

The web application component uses [TiTiler](https://developmentseed.org/titiler/), a dynamic tile server for Cloud Optimized GeoTIFFs. Planetcantile's TMS definitions enable TiTiler to serve planetary data with the correct projections.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Distributed under the BSD 3-Clause License.

---

For more information:

[GitHub Repository](https://github.com/AndrewAnnex/planetcantile)  
[Morecantile documentation](https://developmentseed.org/morecantile/)  
[TiTiler documentation](https://developmentseed.org/titiler/)  
[Related abstract (2025)](https://www.hou.usra.edu/meetings/lpsc2025/pdf/1690.pdf)  

