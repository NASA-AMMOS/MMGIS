---
layout: page
title: Administrator Agent Guide
permalink: /configure/administrator-agent
parent: Configure
nav_order: 11
---

# Administrator Agent Guide

This page is written for an AI agent (or a person) acting as an MMGIS **site administrator**: someone who stands up a mission, loads data into it and configures the map, without changing MMGIS source code. The developer-facing agent context lives in `AGENTS.md` and `.knowledge/` in the repository; this page covers the other role.

The second half is a complete, tested walkthrough: a lunar south pole DEM goes from a GeoTIFF to a configured mission with a basemap, a queryable elevation layer and a working elevation profiler.

#### Contents

- [The administrator role](#the-administrator-role)
- [Session essentials](#session-essentials)
- [How a mission configuration is built](#how-a-mission-configuration-is-built)
- [Projections](#projections)
- [Walkthrough: a lunar south pole DEM](#walkthrough-a-lunar-south-pole-dem)
- [Variant: a global DEM in an equirectangular projection](#variant-a-global-dem-in-an-equirectangular-projection)
- [Checklist and common failures](#checklist-and-common-failures)

---

## The administrator role

An administrator works through the **Configure page** (`/configure`) and the **Configure REST API** (`/api/configure`). The boundary matters for an agent:

| Do | Do not |
| --- | --- |
| Create and edit missions in `/configure` or through `/api/configure` | Edit files under `src/`, `plugins/`, `configure/src/` or `scripts/` |
| Put data files under `Missions/<MissionName>/` | Write to `blueprints/` (those are developer templates) |
| Run the tiling scripts in `auxiliary/` on data | Add or change plugins, tools or layer types |
| Use `.env` to switch services on (TiTiler, STAC) and restart | Touch the database with SQL; use the application UI and APIs only |
| Report a product gap as an issue | Patch around a product gap in code |

If a task cannot be completed without a code change, stop and report it rather than switching roles.

## Session essentials

**URLs and ports.** The map is served on `PORT` (default `8888`, `http://localhost:8888`). In development mode (`npm start`) the map is on `PORT+1` (`8889`) and `/configure` stays on `8888`. Docker deployments use `8888` for both.

**Credentials.** The first account created at `/configure` becomes the Administrator; the sign-up form only appears while the user table is empty. Record the username and password at the start of a session in your working notes (not in any file under the repository, and never in `.env`, which is for service secrets). Over a long session, re-read those notes before trying to recover access. If the password is lost there are two supported routes, in this order:

1. Another admin opens **Users** in `/configure` and generates a password reset link for the account (the link looks like `<site>/resetPassword?t=<token>`).
2. If no admin can log in, the operator of the deployment resets the user through the application's own mechanisms. Do not edit the `users` table directly.

With `AUTH=none` or `AUTH=off` the map itself needs no login, but `/api/configure/*` always requires an admin session or an API token, even with `AUTH=off`.

**API tokens.** For scripted work, log in to `/configure`, open **API Tokens**, generate a token, and send `Authorization: Bearer <token>` with every request. The token carries the permission level of the user who created it. Store it in your session notes alongside the credentials. Mission creation (`POST /api/configure/add`) is limited to the Administrator account.

**Where data lives.** Every mission has a folder `Missions/<MissionName>/`. Paths in the configuration are relative to that folder: tilesets usually go under `Layers/`, GeoTIFFs and other inputs under `Data/`. On Docker, `Missions/` is the volume mounted into the container.

## How a mission configuration is built

A mission is one JSON object (`config.json` in the exports) with seven top-level sections. The Configure page edits it tab by tab; the API accepts it whole.

| Section | Configure tab | What it holds |
| --- | --- | --- |
| `msv` | Initial | Mission name, folder, initial view `[lat, lon, zoom]`, body radius, `mapscale` |
| `projection` | Projection | Custom projection switch, EPSG label, proj4 string, world `bounds`, tile `origin`, `reszoomlevel`, `resunitsperpixel` |
| `coordinates` | Coordinates | Which coordinate readouts to show, DEM for the elevation readout |
| `look` | Look | Page and mission titles, UI toggles |
| `time` | Time | Time control |
| `panels` | Panels | Map, globe and viewer panels and their widths |
| `layers` | Layers | Tree of `header` groups with `sublayers` of type `tile`, `data`, `vector`, `vectortile`, `model`, `image`, `video`, `velocity`, `query` |
| `tools` | Tools | The tools in the toolbar and their `variables` |

Where to look up each part, in order of usefulness:

1. **Blueprints.** `blueprints/Missions/*/config.*.json` are complete, valid configurations. `Reference-Mission-Lunar-SouthPole` is the closest starting point for any polar planetary mission; `Reference-Mission` (Earth) shows every layer type and tool. Create one from `/configure` with **New Mission** and the **Setup Reference Mission Demo** checkbox, then export it from the Home tab to read it.
2. **Layer fields.** Each layer type is a plugin with a manifest `plugins/core/layertypes/<Type>/plugin.json`. Its `config.rows` block lists every field the Configure page renders for that type, with the JSON key (`field`), the label shown in the UI (`name`) and the allowed values for dropdowns. For example the Data type's `demSourceType` is labelled "Source Type" with options `url`, `COG`, `stac-collection`. The prose descriptions are in `docs/pages/Configure/Layers/<Type>/<Type>.md` (published under [Layers](/configure/layers)).
3. **Tool variables.** Each tool is a plugin with a manifest `plugins/core/tools/<Tool>/plugin.json`. Its `descriptionFull.example` block is the template for that tool's `variables` object in the configuration, and `config.rows` lists the fields the Configure page renders for it. There is no single schema file for `layers` or `tools`; the manifests are the schema. The same applies to third-party plugins in `plugins/<container>/`.
4. **Validation.** `POST /api/configure/validate` with `{"config": <object>}` runs the same checks as saving. A configuration that passes validation can be pushed with `POST /api/configure/upsert`. Layers without a `uuid` get one assigned on save.
5. **Home tab.** `/configure` > mission > Home has **Export** (download the current `config.json`) and **Upload Config.JSON** (replace it). Uploading a hand-written file is often faster than clicking through the tabs.

Only the sections `msv`, `layers` and `tools` are required by the validator; the walkthrough below includes all seven for clarity.

## Projections

MMGIS renders a 2D slippy map in one projection per mission. Web Mercator is the default. Anything else, including every planetary projection, is a **custom projection** and needs five pieces of information. They describe the tile pyramid, not the data:

| Field | Meaning |
| --- | --- |
| `proj` | proj4 string of the map projection. All tilesets in the mission must be in this projection. |
| `epsg` | A label only, shown to users (`IAU_2015:30135`, `IAU2000:30120`, `EPSG:3031`). Use the code that `gdalsrsinfo` reports for your data. |
| `bounds` | `[minx, miny, maxx, maxy]` in projected meters: the "world" the tile pyramid covers. |
| `origin` | `[minx, miny]` of that world. For TMS tilesets this is the lower-left corner. |
| `reszoomlevel` and `resunitsperpixel` | The resolution (meters per pixel) of one zoom level, normally zoom `0`. Every other zoom is a power of two from it. |

The pyramid's zoom 0 is a single 256 px tile, so `resunitsperpixel` at zoom 0 equals `(maxx - minx) / 256` **only if** the world width is exactly `256 * 2^n` native pixels. Choose the world so that it is: for a raster with pixel size `p`, pick `n`, set the world width to `256 * 2^n * p`, center it where you like (on the pole for polar data), and the native resolution lands exactly on zoom `n`. The tiling script below reports the result in `tilemapresource.xml`; the Projection tab's **Populate from XML** button reads `bounds`, `origin`, `reszoomlevel` and `resunitsperpixel` from that file, so you rarely type them.

There are two ways to get raster data into a custom projection:

**Route A: pre-tiled (TMS).** Run `auxiliary/gdal2customtiles/gdal2customtiles.py` with `-p raster --extentworld <ulx>,<uly>,<lrx>,<lry>,<pixel_size>` (upper-left and lower-right corners of the world in meters, then the native pixel size). Works for any projection GDAL can write and needs no extra service. The walkthrough uses this route.

**Route B: Cloud Optimized GeoTIFF through TiTiler.** Set `WITH_TITILER=true` in `.env`, restart, and point a Tile Layer at a COG with **Use TiTiler** checked. TiTiler serves planetary projections through `planetcantile` TileMatrixSets. In the Coordinates tab select the TileMatrixSet and click **Load from TileMatrixSet**; it fills in all five projection fields and the body radius. See [Planetcantile Integration](/configure/projections/planetcantile). The TileMatrixSet names follow the pattern `<Body><Projection>Sphere`; the ones most often needed:

| Body | TileMatrixSet ids (planetcantile) |
| --- | --- |
| Moon | `MoonGeographicSphere`, `MoonEquidistantCylindricalSphere`, `MoonWebMercatorSphere`, `MoonNorthPolarSphere`, `MoonSouthPolarSphere` |
| Mars | `MarsGeographicSphere`, `MarsEquidistantCylindricalSphere`, `MarsWebMercatorSphere`, `MarsNorthPolarSphere`, `MarsSouthPolarSphere` |
| Venus | `VenusGeographicSphere`, `VenusEquidistantCylindricalSphere`, `VenusWebMercatorSphere`, `VenusNorthPolarSphere`, `VenusSouthPolarSphere` |

Both routes need the map projection and every tileset to agree. The most common failure is a dataset in a different projection, datum or false easting than the mission; `gdalsrsinfo -o proj4 <file>` on every input before configuring anything avoids it.

**Body radius.** `msv.radius.major` and `msv.radius.minor` must match the sphere in the proj4 string (`+R=1737400` for the IAU 2015 Moon sphere, `6051000` for Venus, `3396190` for the Mars sphere). Scale bar, measurements and lon/lat readouts use them.

## Walkthrough: a lunar south pole DEM

The goal: a new mission `Lunar-South-Pole-DEM` in south polar stereographic projection, with a hillshade basemap, an elevation Data Layer that users can query, and the Measure tool profiling the DEM.

**Example dataset.** `elevation_m.tif` from the *South Pole Ops Atlas 240m* (Terranova Robotics, [huggingface.co/datasets/terranova-robotics/south-pole-ops-atlas-240m](https://huggingface.co/datasets/terranova-robotics/south-pole-ops-atlas-240m), CC-BY-4.0): a 256 x 256 px, 240 m/px Float32 elevation grid centered on the lunar south pole, derived from the LOLA `LDEM_80S_40M` product. It is small (260 KB), already in the target projection and free to redistribute, which makes it a good first test. Any lunar DEM works the same way; the LOLA polar DEMs at [imbrium.mit.edu/DATA/LOLA_GDR/POLAR](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/) are the usual production source. Every command below was run with GDAL 3.13 and the output checked.

### 1. Inspect the file

```bash
gdalinfo elevation_m.tif
gdalsrsinfo -o proj4 elevation_m.tif
```

Read off: pixel size (`240 x 240 m`), corner coordinates (`-30820 .. 30620 m` on both axes, so a 61 km window around the pole), band type (`Float32`), nodata (none here), and the projection. In this file the CRS is a polar stereographic with `+lat_0=-90 +k=1 +R=1737400` but the datum is labelled `unknown`. That is common for research products and harmless for MMGIS, but it is cleaner to stamp the official code:

```bash
gdal_translate -a_srs IAU_2015:30135 elevation_m.tif south_pole_elevation_240m.tif
gdalsrsinfo -o proj4 south_pole_elevation_240m.tif
# +proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs
```

`IAU_2015:30135` is "Moon (2015) - Sphere / Ocentric / South Polar"; `30130` is the north polar equivalent, `30110` equirectangular, `30100` geographic. `-a_srs` only rewrites metadata; it does not resample.

If the source is in a different projection (a global equirectangular LOLA DEM, for example), reproject instead of relabelling. This was checked on a LOLA mosaic in `IAU_2015:30110`:

```bash
gdalwarp -t_srs IAU_2015:30135 -tr 240 240 -r bilinear -dstnodata -32768 \
  -co COMPRESS=DEFLATE source_dem.tif south_pole_elevation_240m.tif
```

PROJ prints `stere: Invalid latitude` warnings for pixels on the far side of the body during a polar warp; they are expected.

### 2. Decide the world extent

The mission's tile pyramid needs a square world around the pole. For 240 m data choose `n = 4`: world width `256 * 2^4 * 240 = 983 040 m`, so the world is `[-491520, -491520, 491520, 491520]`, zoom 0 is `3840 m/px` and the native 240 m lands on zoom 4. The same world works for finer data later (a 40 m DEM would be native at zoom 6 or 7). Write the four numbers down; they are used by every tiling command and by the Projection tab.

### 3. Build a hillshade basemap and tile it

Tile layers must be 8-bit. A hillshade is the quickest honest basemap for a DEM:

```bash
gdaldem hillshade -z 1 -az 315 -alt 20 -compute_edges \
  south_pole_elevation_240m.tif south_pole_hillshade_240m.tif

python auxiliary/gdal2customtiles/gdal2customtiles.py -p raster \
  --extentworld -491520,491520,491520,-491520,240 -z 0-4 \
  south_pole_hillshade_240m.tif Missions/Lunar-South-Pole-DEM/Layers/south_pole_hillshade_240m
```

`--extentworld` takes `ulx,uly,lrx,lry,pixel_size` (upper-left then lower-right, no spaces). `-z 0-4` must include the native zoom. Output: 22 PNG tiles in `{z}/{x}/{y}.png` layout and a `tilemapresource.xml` whose `TileSets` read `3840, 1920, 960, 480, 240` units per pixel for zooms 0 to 4, with `BoundingBox` and `Origin` at `-491520`. The script needs the GDAL Python bindings (`from osgeo import gdal`); the MMGIS Docker image and the `python-environment.yml` conda environment both have them.

### 4. Tile the DEM itself as a Data Layer

Data Layers carry the real elevation values, encoded into RGBA PNGs, so users can click for values and tools can read terrain. Use the same script with `--dem` and **no `-z` option**:

```bash
python auxiliary/gdal2customtiles/gdal2customtiles.py -p raster \
  --extentworld -491520,491520,491520,-491520,240 --dem \
  south_pole_elevation_240m.tif Missions/Lunar-South-Pole-DEM/Layers/south_pole_elevation_240m_dem
```

Two things differ from step 3. The input must be 32-bit (Float32 is fine). And DEM tiles are 32 x 32 px, not 256, so the native resolution lands three zoom levels higher: the XML for this run lists zooms 0 to 7 with `30720 .. 240` units per pixel. The zoom numbers still line up with the basemap (a zoom 7 DEM tile covers the same ground as a zoom 7 basemap tile), which is why the Data Layer gets `maxNativeZoom: 7` below while the hillshade gets `4`. Forcing `-z 0-4` here produces empty tiles. The run produced 159 tiles; decoding a zoom 7 tile gives elevations between about `-676` and `+445` m, matching the source raster.

### 5. Keep a COG for the tools

The Measure tool, the coordinate elevation readout and the Sightline tool read a GeoTIFF directly from `Data/`. A Cloud Optimized GeoTIFF keeps those reads fast on large files:

```bash
gdal_translate -of COG -co COMPRESS=DEFLATE \
  south_pole_elevation_240m.tif Missions/Lunar-South-Pole-DEM/Data/south_pole_elevation_240m_cog.tif
```

`gdalinfo` on the result reports `LAYOUT=COG`.

### 6. Create the mission

In `/configure`: **New Mission**, name `Lunar-South-Pole-DEM`, leave the Reference Mission checkbox off, **Make Mission**. Then copy the tilesets and the COG into `Missions/Lunar-South-Pole-DEM/Layers/` and `Data/` if they are not there already (steps 3 to 5 wrote them in place).

Through the API, the same thing is `POST /api/configure/add` with `{"mission": "Lunar-South-Pole-DEM", "makedir": true}` and a bearer token from the Administrator account; `makedir` creates the mission folder with empty `Layers/` and `Data/`.

### 7. Configure the projection

Projection tab:

- **Custom Projection**: on
- **EPSG**: `IAU_2015:30135`
- **Proj4 String**: `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs`
- **Path to tilemapresource.xml**: `Layers/south_pole_hillshade_240m/tilemapresource.xml`, then **Populate from XML**. It fills bounds `-491520, -491520, 491520, 491520`, origin `-491520, -491520`, resolution zoom level `0`, units per pixel `3840`. Use the basemap's XML, not the DEM's (the DEM XML has 32 px tiles and would give `30720`).

Initial tab: planet radius major and minor `1737400`; initial latitude `-89.7`, longitude `0`, zoom `3`.

Coordinates tab: enable Longitude/Latitude; enable **Primary Projection** (display name `Polar Stereographic`, axis names `E` and `N`) so the readout shows easting and northing from the mission's proj4 string; enable **With Elevation** with `Data/south_pole_elevation_240m_cog.tif`. Leave the plain **Easting, Northing** option off for a polar mission: that readout is not projected through `projection.proj`, it is longitude and latitude in radians multiplied by the body radius (an equirectangular convention), so near the pole its northing would read about -2.7 million meters while the tiles and the DEM sit at a few thousand meters from the origin. The `cproj` readout uses the same proj4 string as the tiles and agrees with the raster.

### 8. Add the layers and tools

Layers tab: a header `Terrain` with two sublayers.

- Tile Layer `Hillshade 240m`: Source Type `url`, Source URL `Layers/south_pole_hillshade_240m/{z}/{x}/{y}.png`, Tile Format `tms`, then **Populate from XML** (Minimum Zoom `0`, Maximum Native Zoom `4`); set Maximum Zoom `7`.
- Data Layer `Elevation 240m`: Source Type `url`, Data Tile URL `Layers/south_pole_elevation_240m_dem/{z}/{x}/{y}.png`, DEM Parser `rgba`, Tile Format `tms`, **Populate from XML** (Minimum Zoom `0`, Maximum Native Zoom `7`), Initially On unchecked. Then set **Shader** to `colorize`, Units `m`, SigFigs `1`, and one Color Ramp (a list of hex colours; the JSON below uses six). Without a shader the layer falls back to the `image` shader, which paints the raw RGBA encoding bytes instead of elevations: the tiles look like noise, and that is the sign that `variables.shader` is missing. `colorize` stretches the ramp between the minimum and maximum values in the current view, so no fixed min/max is needed; this DEM spans about `-3616` to `+1954` m. `noDataValues` stays empty because the source raster has no nodata; for a LOLA product with `-32768` nodata, list it there so those pixels render transparent.

Tools tab: Layers, Legend, Info, Measure. In Measure set the DEM path to `Data/south_pole_elevation_240m_cog.tif`.

Save. The equivalent complete configuration, which passes `POST /api/configure/validate`, is:

```json
{
  "msv": {
    "mission": "Lunar-South-Pole-DEM",
    "missionFolderName": "Lunar-South-Pole-DEM",
    "site": "",
    "masterdb": false,
    "view": [-89.7, 0, 3],
    "radius": { "major": "1737400", "minor": "1737400" },
    "mapscale": "4"
  },
  "projection": {
    "custom": true,
    "epsg": "IAU_2015:30135",
    "proj": "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
    "globeproj": "",
    "xmlpath": "Layers/south_pole_hillshade_240m/tilemapresource.xml",
    "bounds": ["-491520", "-491520", "491520", "491520"],
    "origin": ["-491520", "-491520"],
    "reszoomlevel": "0",
    "resunitsperpixel": "3840"
  },
  "coordinates": {
    "coordll": true,
    "coorden": false,
    "coordcustomproj": true,
    "coordcustomprojname": "Polar Stereographic",
    "coordcustomprojnamex": "E",
    "coordcustomprojnamey": "N",
    "coordelev": true,
    "coordelevurl": "Data/south_pole_elevation_240m_cog.tif"
  },
  "look": {
    "pagename": "Lunar South Pole DEM",
    "missionname": "Lunar South Pole DEM",
    "missionsubtitle": "Administrator walkthrough",
    "minimalist": false,
    "topbar": true,
    "toolbar": true,
    "scalebar": true,
    "coordinates": true,
    "zoomcontrol": true,
    "graticule": false,
    "miscellaneous": true,
    "copylink": true,
    "screenshot": true,
    "fullscreen": true,
    "help": true
  },
  "time": { "enabled": false, "visible": false },
  "panels": {
    "viewer": false,
    "map": true,
    "globe": false,
    "defaultWidths": { "viewer": 0, "map": 100, "globe": 0 }
  },
  "layers": [
    {
      "name": "Terrain",
      "type": "header",
      "expanded": true,
      "sublayers": [
        {
          "name": "Elevation 240m",
          "type": "data",
          "demSourceType": "url",
          "demtileurl": "Layers/south_pole_elevation_240m_dem/{z}/{x}/{y}.png",
          "demparser": "rgba",
          "tileformat": "tms",
          "minZoom": 0,
          "maxNativeZoom": 7,
          "maxZoom": 7,
          "boundingBox": [-180, -90, 180, -88.5],
          "visibility": false,
          "initialOpacity": 1,
          "variables": {
            "shader": {
              "type": "colorize",
              "units": "m",
              "sigfigs": 1,
              "noDataValues": [],
              "ramps": [
                ["#2c105c", "#711f81", "#b63679", "#ee605e", "#fdae78", "#fcfdbf"]
              ]
            }
          },
          "description": "South Pole Ops Atlas 240m, elevation_m.tif, encoded as RGBA DEM tiles."
        },
        {
          "name": "Hillshade 240m",
          "type": "tile",
          "sourceType": "url",
          "url": "Layers/south_pole_hillshade_240m/{z}/{x}/{y}.png",
          "tileformat": "tms",
          "minZoom": 0,
          "maxNativeZoom": 4,
          "maxZoom": 7,
          "boundingBox": [-180, -90, 180, -88.5],
          "visibility": true,
          "initialOpacity": 1,
          "description": "Hillshade of the 240 m elevation model (gdaldem hillshade)."
        }
      ]
    }
  ],
  "tools": [
    { "name": "Layers", "icon": "layers", "js": "LayersTool" },
    { "name": "Legend", "icon": "format-list-bulleted-type", "js": "LegendTool" },
    { "name": "Info", "icon": "information-variant", "js": "InfoTool" },
    {
      "name": "Measure",
      "icon": "ruler",
      "js": "MeasureTool",
      "variables": {
        "dem": "Data/south_pole_elevation_240m_cog.tif",
        "defaultMode": "segment"
      }
    }
  ]
}
```

To push it instead of clicking: save it as `config.json` and run

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d @config.json.wrapped http://localhost:8888/api/configure/upsert
```

where `config.json.wrapped` is `{"mission": "Lunar-South-Pole-DEM", "config": <the object above>}`. Or use **Upload Config.JSON** on the Home tab.

### 9. Verify

Open the mission (`http://localhost:8888/?mission=Lunar-South-Pole-DEM`, or `8889` in development mode). Expected:

- The hillshade appears centered on the pole; zooming past level 4 scales the tiles rather than fetching new ones.
- The coordinate bar shows lon/lat, the `Polar Stereographic` E/N in meters (a few thousand meters from the origin near the pole, matching `gdalinfo` corner coordinates of the DEM), and an elevation that changes with the cursor inside the 61 km window.
- Turning on `Elevation 240m` shows a colour ramp over the window (dark for the deep crater floors, light for the ridges) and clicking a point reports the elevation in meters.
- The Measure tool draws a profile; across the whole 61 km window values run from about `-3616` to `+1954` m.

If the hillshade is offset from the coordinate readout, `bounds` or `origin` disagree with the tiling `--extentworld`. If it renders at the wrong size, `resunitsperpixel` was taken from the wrong XML or the world width is not `256 * 2^n` pixels. If tiles never load, check the browser's network tab for the tile URL and compare it to the folder layout; a `404` with the right path means the mission folder is not where the server looks (`Missions/<MissionName>/` relative to the MMGIS root, or the mounted volume on Docker).

## Variant: a global DEM in an equirectangular projection

Not every DEM is polar. For a global or regional product in an equidistant cylindrical grid (for example the 300 m Venus DEM at [zenodo.org/records/22164484](https://zenodo.org/records/22164484), 3.85 GB, `+proj=eqc +R=6051000`), tiling the whole file is unnecessary: it is already a Cloud Optimized GeoTIFF. Use Route B:

1. `WITH_TITILER=true` in `.env`, restart MMGIS.
2. Coordinates tab: select `VenusEquidistantCylindricalSphere`, **Load from TileMatrixSet**. This sets `proj` to `+proj=eqc +R=6051000 ...`, the world bounds to the full body, and the radius to `6051000`.
3. Tile Layer: Source URL is the path of the COG under `Data/` (or a `/vsicurl/https://...` URL for a remote file), **Use TiTiler** on, Tile Matrix Set `VenusEquidistantCylindricalSphere`. For a single-band DEM switch on **Transform Single Data Band COG** and set Minimum and Maximum Pixel Data Value and a Colormap (`cogTransform`, `cogMin`, `cogMax`, `cogColormap` in JSON).
4. Verify with `gdalsrsinfo -o proj4 <file>` that the file's projection matches the TileMatrixSet before adding more layers.

A polar region of such a file can still go through Route A: cut and reproject it with `gdalwarp -t_srs IAU_2015:<south polar code> -te ...` as in step 1 and continue from step 2.

## Checklist and common failures

Before reporting success, confirm each line:

- [ ] Credentials and API token recorded in session notes at the start; none written into repository files.
- [ ] `gdalsrsinfo -o proj4` run on every input; all match the mission's `projection.proj`.
- [ ] World extent chosen so the native resolution is an exact zoom level; the same `--extentworld` used for every tileset in the mission.
- [ ] `projection.bounds`, `origin`, `reszoomlevel`, `resunitsperpixel` populated from the basemap's `tilemapresource.xml`.
- [ ] `msv.radius` matches the `+R=` or `+a=`/`+b=` in the proj4 string.
- [ ] Tile layers are 8-bit; DEM Data Layers are 32-bit and tiled with `--dem` and without `-z`.
- [ ] Tool DEM paths point at a GeoTIFF under `Data/`, relative to the mission folder.
- [ ] Every Data Layer has `variables.shader` (`colorize` for DEMs); the coordinate readout for a custom projection uses **Primary Projection** (`coordcustomproj`), not the plain Easting/Northing option.
- [ ] Configuration passes `POST /api/configure/validate` (or saves without errors in `/configure`).
- [ ] The map, the coordinate readout and one tool checked in the browser.

Failures seen while writing this page, and their cause:

| Symptom | Cause |
| --- | --- |
| DEM tiles are all 83 bytes (empty) | `-z` passed to a `--dem` run; DEM tiles are 32 px and have a different native zoom |
| `gdal2customtiles.py` refuses the file: "convert to 8-bit" | A Float32 raster passed without `--dem`; make a hillshade or colour relief first |
| `gdalwarp` asks for petabytes of disk | `-tr` given in degrees for a projection in meters (or the reverse) |
| Elevation readout empty | `coordinates.coordelevurl` not set, file not under the mission folder, or not a GeoTIFF |
| Data Layer renders as coloured noise | No `variables.shader` on the layer, so the `image` shader draws the RGBA encoding bytes |
| Easting/Northing readout in the millions of meters on a polar mission | Plain `coorden` readout enabled; it is lon/lat times body radius, not the custom projection. Use `coordcustomproj` |
| Projection "Populate from XML" gives `30720` m/px | The DEM tileset's XML (32 px tiles) was used instead of the basemap's |
| `/api/configure/*` returns an auth error with `AUTH=off` | Configure endpoints always need an admin session or token |
