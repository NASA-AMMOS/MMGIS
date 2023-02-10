---
layout: page
title: Model
permalink: /configure/layers/model
parent: Layers
grand_parent: Configure
---

# Model Layer

A 3D Model for the Globe

#### Layer Name

_type:_ string  
The unique display name and identifier of the layer. It must be unique and contain no special characters.

#### URL

_type:_ string  
A file path that points to a .dae or .obj. If the path is relative, it will be relative to the mission's directory.

#### Longitude

_type:_ float  
The longitude in decimal degrees at which to place the model.

#### Latitude

_type:_ float  
The latitude in decimal degrees at which to place the model.

#### Elevation

_type:_ float  
The elevation in meters at which to place the model.

#### Rotation X

_type:_ float _optional_  
An x-axis rotation in radians to orient the model.

#### Rotation Y

_type:_ float _optional_  
A y-axis rotation in radians to orient the model.

#### Rotation Z

_type:_ float _optional_  
A z-axis rotation in radians to orient the model.

#### Scale

_type:_ float _optional_  
A scaling factor to resize the model.

#### Initial Visibility

_type:_ bool  
Whether the layer is on initially.

#### Initial Opacity

_type:_ float  
A value from 0 to 1 of the layer's initial opacity. 1 is fully opaque.

#### Time Enabled

_type:_ bool  
True if the layer is time enabled. URLs that contain `{starttime}` or `{endtime}` will be dynamically replaced by their set values when the layer is fetched.

#### Time Type

_type:_ enum [Global, Individual]  
Whether the layer should use global time values or function independently with its own time values.

#### Time Format

_type:_ string _optional_  
The string format to be used in the URL for `{starttime}` and `{endtime}`. Defaults to `YYYY-MM-DDTHH:mm:ssZ`.

---

_Note:_ Additional vector layer stylings can be found on the [Vector Styling](/MMGIS/configure/formats/vector-styling) page.

---

#### Alternatively

Do know that models can also be added via a Vector layer's `markerAttachments.model`. An example to have vector points show up in the Map and their respective models to appear in both the Viewer and Globe is as follows:

Example .geojson:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "Name": "OBJ",
        "images": [
          {
            "name": "Model Example",
            "url": "Data/models/m20a_bettys_rock_1m/m20a_bettys_rock_1m_centered.obj",
            "texture": "Data/models/m20a_bettys_rock_1m/m20a_bettys_rock.jpg",
            "type": "image",
            "isModel": true,
            "mtl": "Data/models/m20a_bettys_rock_1m/m20a_bettys_rock_1m_centered.mtl",
            "yaw": 0,
            "pitch": 0,
            "roll": 0,
            "elev": -4369.7648860680883
          }
        ]
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          137.35458264484535, -4.699610086614438, -4360.7648860680883
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "Name": "GLTF",
        "images": [
          {
            "name": "Model Example2",
            "url": "Data/models/bettys_rock_sol_467_gltf/scene.gltf",
            "type": "image",
            "isModel": true,
            "yaw": 0,
            "pitch": 0,
            "roll": 0,
            "elev": -4369.7648860680883
          }
        ]
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          137.35058264484535, -4.70610086614438, -4360.7648860680883
        ]
      }
    }
  ]
}
```

Vector Layer Raw Variables

```json
{
  "useKeyAsName": "propKey || [propKey1, propKey2, ...]",
  "markerAttachments": {
    "model": {
      "pathProp": "images.0.url",
      "mtlProp": "images.0.mtl",
      "pitchProp": -90,
      "pitchUnit": "deg",
      "show": "always"
    }
  }
}
```
