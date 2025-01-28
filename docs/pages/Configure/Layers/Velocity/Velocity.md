---
layout: page
title: Velocity
permalink: /configure/layers/velocity
parent: Layers
grand_parent: Configure
---

# Velocity Layer

For visualizing data that represents velocities with magnitude and horizontal direction (e.g., wind, ocean currents). They may be visualized as streamlines or particles (with placeholders to fully support arrows and wind barbs in the future).

## Core

#### Layer Name

_type:_ string  
The unique display name and identifier of the layer. It must be unique and contain no special characters

#### Kind of Layer

_type:_ enum  
The kind of visualization for the layer: streamlines (animated flowlines), particles (similar to streamlines but single direction for all particles), arrows (similar to vectors with arrow styling), or wind barbs.

#### URL

_type:_ string  
A file path that points to a geojson, gribjson (streamlines only), or geotiff (arrows only). If the path is relative, it will be relative to the mission's directory. The URL must contain a proper placeholder ending such as: {z}/{x}/{y}.png.

#### Minimum Zoom

_type:_ integer  
The lowest (smallest number) zoom level of the tile set.  
_Note: This field can be automatically populate with "Populate from XML". "Populate from XML" uses looks for a `tilemapresource.xml` in the tileset directory specified by the URL field._

#### Maximum Zoom

_type:_ integer  
The highest (largest number) zoom level to see in MMGIS. This value is at least as high as Maximum Native Zoom. This allows zooms level higher than that of the tileset. Instead of rendering new tile image, it scales them in instead.

#### Initial Opacity

_type:_ float  
A value from 0 to 1 of the layer's initial opacity. 1 is fully opaque.

#### Controlled

_type:_ boolean  
Whether the layer can be dynamically updated via the JavaScript API or not. If true, the layer can be dynamically updated and the URL is not required. If true and a URL is set and Time Enabled is true, the initial url query will be performed.

## Style

### Streamlines

Utilizes [leaflet-velocity](https://github.com/onaci/leaflet-velocity/).

Sample layer: [https://raw.githubusercontent.com/onaci/leaflet-velocity/refs/heads/master/demo/wind-global.json](https://raw.githubusercontent.com/onaci/leaflet-velocity/refs/heads/master/demo/wind-global.json)

#### Min Velocity

_type:_ float  
Velocity at which particle intensity is minimum (m/s). Default 0

#### Max Velocity

_type:_ float  
Velocity at which particle intensity is maximum (m/s). Default: 15

#### Velocity Scale

_type:_ float  
Scale for wind velocity. Default: 0.005

#### Particle Age

_type:_ float  
Max number of frames a particle is drawn before regeneration. Default: 90

#### Line Width

_type:_ float  
Line width of a drawn particle. Default: 1

#### Particle Multiplier

_type:_ float  
Particle count scalar. Default: 1/300

#### Frame Rate

_type:_ float  
Particle frame rate. Default 15

#### Display Values

_type:_ boolean  
Display label of pixel values on the map.

#### Display Position

_type:_ string  
Where to display data values.

#### Color Scale

_type:_ string  
Set of colors for visualizing velocity magnitude values.

### Particles

Utilizes [Leaflet.Rain](https://github.com/ggolikov/Leaflet.Rain).

Currently only works with GeoJSON containing list of corner points. Example:

```javascript
{
    "type": "FeatureCollection",
    "features": [
      { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-124.409591, 32.534156] }, "properties": {} },
      { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-114.131211, 32.534156] }, "properties": {} },
      { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-114.131211, 42.009518] }, "properties": {} },
      { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-124.409591, 42.009518] }, "properties": {} },
      { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-124.409591, 32.534156] }, "properties": {} }
    ]
}
```

#### Color

_type:_ string  
The color of the particles.

#### Particle Angle

_type:_ float  
Particle angle (degrees). Default: 80

#### Particle Width

_type:_ float  
Particle width (px). Default: 1

#### Particle Spacing

_type:_ float  
X-spacing between particles (px). Default 10

#### Particle Length

_type:_ float  
Particle length (px). Default: 4

#### Particle Interval

_type:_ float  
Y-spacing between particles (px). Default: 10

#### Particle Speed

_type:_ float  
Particle speed factor. Values greater than 1 increase speed. Default: 0.1
