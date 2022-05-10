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
