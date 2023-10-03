---
layout: page
title: Vector
permalink: /configure/layers/vector
parent: Layers
grand_parent: Configure
---

# Vector Layer

A [geojson](https://geojson.org/) layer.

#### Layer Name

_type:_ string  
The unique display name and identifier of the layer. It must be unique and contain no special characters.

#### Kind of Layer

_type:_ enum  
A special kind of interaction for the layer. Please see the Kinds page for more.

#### URL

_type:_ string  
A file path that points to a geojson. If the path is relative, it will be relative to the mission's directory. The URL must contain a proper placeholder ending such as: `{z}/{x}/{y}.png`. Alternatively vectors can be served with Geodatasets. Simply go to "Manage Geodatasets" at the bottom left, upload a geojson and link to it in this URL field with "geodatasets:{geodataset\*name}"

#### Controlled

_type:_ bool
Whether the layer can be dynamically updated or not. If true, the layer can be dynamically updated and the URL is not required.

If true and a URL is set and Time Enabled is true, the initial url query will be performed.

#### Legend

_type:_ string  
An absolute or relative file path pointing to a `legend.csv` that describes the symbology of the layer. Please see the Legend Tool to see how to form a `legend.csv`.

#### Initial Visibility

_type:_ bool  
Whether the layer is on initially.

#### Visibility Cutoff

_type:_ integer _optional_
If set, this vector layer will be hidden if the current zoom level is less than or equal to that of the visibility cutoff. `Visibility Cutoff * -1` will invert its visibility condition. This is useful when the dataset is dense, local to a one region, or irrelevant when far away and the desired range of zoom levels is large.

#### Initial Opacity

_type:_ float  
A value from 0 to 1 of the layer's initial opacity. 1 is fully opaque.

#### Time Enabled

_type:_ bool  
True if the layer is time enabled. URLs that contain `{starttime}` or `{endtime}` will be dynamically replaced by their set values when the layer is fetched.

If true and a URL is set and Controlled is true, only the initial url query will be performed.

#### Time Type

_type:_ enum [Requery, Local]  
When the time changes, whether the layer should Requery the source or filter the layer Locally (based on feature properties. Note that)

#### Start Time Property Name

_type:_ string _optional_  
Optional and only in use if `Time Enabled = true` and `Time Type = Local`. The starting time property path. Setting this is addition to `Main Time Property Name` casts the feature's time over a range instead of as a single point in time. Can use dot-notation for nested path. Can be a unix timestamp or an ISO time (end the ISO with a `Z` to designate that it should be treated as a UTC time).

#### Main Time Property Name

_type:_ string  
Required in `Time Enabled = true` and `Time Type = Local`. The main time property path. Can use dot-notation for nested path. Can be a unix timestamp or an ISO time (end the ISO with a `Z` to designate that it should be treated as a UTC time).

#### Time Format

_type:_ string _optional_  
The string format to be used in the URL for `{starttime}` and `{endtime}`. Defaults to `YYYY-MM-DDTHH:mm:ssZ`.

#### Stroke Color

_type:_ CSS color string or a prop _optional_  
The border color of each feature. If the feature is a line, this field is the color of the line. See the Vector Styling page for more. Colors can be as follows:

- A named color
  - crimson, blue, rebeccapurple
- A hex color
  - #FFF
  - #A58101
- An rgb color
  - rgb(255,89,45)
- An hsl color
  - hsl(130, 26%, 34%)
- Based on a feature's color property
  - `prop:geojson_property_key` will set the feature's color to the values of `features[i].properties.geojson_property_key`
  - If that property is not a valid CSS color and is a string, it will use a random and consistent color based on its hash.

#### Fill Color

_type:_ CSS color string or a prop _optional_  
The fill color of each feature. See Stroke Color for color options. See the Vector Styling page for more.

#### Stroke Weight

_type:_ positive integer _optional_  
The thickness of the stroke/border in pixels. See the Vector Styling page for more.

#### Fill Opacity

_type:_ float _optional_  
A value from 0 to 1 of Fill Color's opacity. 1 is fully opaque. See the Vector Styling page for more.
_Note: It's also possible to set the opacities of colors directly with #CCDDEEFF, rgba() and hsla()._

#### Radius

_type:_ positive integer _optional_  
When a point feature is encountered, this value will be it's radius in pixels.

#### Raw Variables

Clicking "Set Default Variables" will add a template of all possible raw variables (without overwriting ones that are already set). All raw variables are optional.

Example:

```javascript
{
    "useKeyAsName": "propKey || [propKey1, propKey2, ...]",
    "shortcutSuffix": "single letter to 'ATL + {letter}' toggle the layer on and off",
    "hideMainFeature": false,
    "datasetLinks": [
        {
            "prop": "{prop}",
            "dataset": "{dataset}",
            "column": "{column}",
            "type": "{none || images}"
        }
    ],
    "links": [
        {
            "name": "example",
            "link": "url/?param={prop}"
        }
    ],
    "info": [
        {
            "which": "last",
            "icon": "material design icon",
            "value": "Prop: {prop}"
        }
    ],
    "layerAttachments": {
        "labels": {
          "initialVisibility": false,
          "theme": "default || solid",
          "size": "default || large"
        },
        "pairings": {
          "initialVisibility": false,
          "layers": ["Array of layer names to pair"],
          "originOffsetOrder": [
            "X",
            "Y",
            "Z"
          ],
          "pairProp":
            "path.to.pair.prop.for.this.layer.and.all.paired.layers.to.link.on",
          "layersAzProp": "optional.prop.path.to.azimuth.value.in.all.paired.layers",
          "layersElProp": "optional.prop.path.to.elevation.value.in.all.paired.layers",
          "style": {
            "any_normal_style_field": "to_style_connective_lines",
          }
        }
    },
    "coordinateAttachments": {
        "marker": {
          "initialVisibility": true,
          "opacity": 1,
          "color": "stroke css color (or prop:...)",
          "weight": 2,
          "fillColor": "fill css color (or prop:...)",
          "fillOpacity": 1,
          "radius": 8,
        }
    },
    "markerAttachments": {
        "bearing": {
          "angleProp": "path.to.angle.prop",
          "angleUnit": "deg || rad",
          "color": "#FFFFFF",
        },
        "uncertainty": {
          "initialVisibility": true,
          "xAxisProp": "path.to.x.prop",
          "yAxisProp": "path.to.y.prop",
          "axisUnit": "meters || kilometers",
          "angleProp": "path.to.angle.prop",
          "angleUnit": "deg || rad",
          "color": "#888888",
          "color3d": "#FFFF00",
          "depth3d": 8
        },
        "image": {
          "initialVisibility": true,
          "path": "url to top-down ortho image. ex. public/images/rovers/PerseveranceTopDown.png",
          "pathProp": "path to image. take priority over path",
          "widthMeters": 2.6924,
          "widthPixels": 420,
          "heightPixels": 600,
          "angleProp": "path.to.angle.prop",
          "angleUnit": "deg || rad",
          "show": "click || always",
        },
        "model": {
          "path": "path to model (.dae, .glb, .gltf, .obj)",
          "pathProp": "path to model in feature properties. take priority over path",
          "mtlPath": "if .obj, path to material file (.mtl)",
          "mtlProp": "path to mtl in feature props",
          "yawProp": "path.to.yaw.prop",
          "yawUnit": "deg || rad",
          "invertYaw": false,
          "pitchProp": "path.to.pitch.prop",
          "pitchUnit": "deg || rad",
          "invertPitch": true,
          "rollProp": "path.to.roll.prop",
          "rollUnit": "deg || rad",
          "invertRoll": false,
          "elevationProp": "path.to.elev.prop",
          "scaleProp": "path.to.scale.prop",
          "show": "click || always",
          "onlyLastN": false
        },
    },
    "pathAttachments": {
        "gradient": {
          "colorWithProp": "path.to.prop",
          "dropdownColorWithProp": ["prop3", "path.to.prop3"],
          "colorRamp": ["cssColor1", "cssColor2"],
          "weight": 4,
        },
    },
    "markerIcon": { //See: https://leafletjs.com/reference-1.7.1.html#icon-l-icon
        "iconUrl": "pathToMainIconImage.png",
        "shadowUrl": "(opt)pathToShadowImage.png",
        "iconSize":     [38, 95], // size of the icon
        "shadowSize":   [50, 64], // size of the shadow
        "iconAnchor":   [22, 94], // point of the icon which will correspond to marker's location
        "shadowAnchor": [4, 62],  // the same for the shadow
    }.
    "search": "(prop1) round(prop2.1) rmunder(prop_3)"
}
```

- `useKeyAsName`: The property key whose value should be the hover text of each feature. If left unset, the hover key and value will be the first one listed in the feature's properties. This may also be an array of keys.
- `shortcutSuffix`: A single letter to 'ALT + {letter}' toggle the layer on and off. Please verify that your chosen shortcut does not conflict with other system or browser-level keyboard shortcuts.
- `hideMainFeature`: If true, hides all typically rendered features. This is useful if showing only `*Attachments` sublayers is desired. Default false
- `datasetLinks`: Datasets are csvs uploaded from the "Manage Datasets" page accessible on the lower left. Every time a feature from this layer is clicked with datasetLinks configured, it will request the data from the server and include it with it's regular geojson properties. This is especially useful when single features need a lot of metadata to perform a task as it loads it only as needed.
  - `prop`: This is a property key already within the features properties. It's value will be searched for in the specified dataset column.
  - `dataset`: The name of a dataset to link to. A list of datasets can be found in the "Manage Datasets" page.
  - `column`: This is a column/csv header name within the dataset. If the value of the prop key matches the value in this column, the entire row will be return. All rows that match are returned.
  - `type`: Unused.
- `links`: Configure deep links to other sites based on the properties on a selected feature. This requires the "Minimalist" option in the Look Tab to be unchecked. Upon clicking a feature, a list of deep links are put into the top bar and can be clicked on to navigate to any other page.
  - `name`: The name of the deep link. It should be unique.
  - `link`: A url template. Curly brackets are included. On feature click, all `{prop}` are replaced with the corresponding `features[i].properties.prop` value. Multiple `{prop}` are supported as are access to nested props using dot notation `{stores.food.candy}`.
- `info`: Creates an informational record at the top of the page. The first use case was showing the value of the latest sol. Clicking this record pans to the feature specified by `which`. This requires the "Minimalist" option in the Look Tab to be unchecked. This is used on startup and not when a user selects a feature in this layer.
  - `which`: This only supports the value `last` at this point.
  - `icon`: Any [Material Design Icon](http://materialdesignicons.com/) name
  - `value`: A name to display. All `{prop}`s will be replaced by their corresponding `features[which].properties[prop]` value.
- `layerAttachments`: Attachments that may apply to the entire layer.
  - `labels`: Place a label beside each feature. Also applies to `coordinateAttachments.marker` features.
    - `initialVisibility`: Whether the label sublayer is initially on. Users can toggle sublayers on and off in the layer settings in the LayersTool.
    - `theme`: Label theme. Either `default` or `solid`. Default is white text with a black border. Solid is white text with a dark-grey background box.
    - `size`: Label size. Either `default` or `large`. Default is 14px, large is 16px.
  - `pairings`: Links cross-layer features together. Features paired to this layer will attempt to compute the azimuth-elevation relationship between the two to draw in the Viewer's PhotoSphere. Additionally, on the Map, a line will be drawn between the two features.
    - `initialVisibility`: Whether the pairing line sublayer is initially on. Users can toggle sublayers on and off in the layer settings in the LayersTool.
    - `layers`: An array of names of other layers. Note: Do not use css shorthand color names ("blue", "maroon", ...) in the paired layers styles as they won't parse properly when drawing in the PhotoSphere.
    - `originOffsetOrder`: In many cases, a marker's center is not the camera's center. Within a feature's `properties.images` objects, `originOffset` can be defined. `originOffsetOrder` describes the XYZ order and signage that `originOffset` should be read in. Possible values are `X, -X, Y, -Y, Z, -Z`.
    - `pairProp`: The dot notated path to the feature properties that contains the property to pair on. This layer and all paired layers need this property to properly pair up. A feature in this layer is said to be paired with a feature of one of the other specified layers, if and only if the values of this property in both features matches.
    - `layersAzProp`: The dot notated path to the feature properties that contains the features' azimuth. If unset, the azimuth will be calculated through the feature's longitude, latitude, elevation coordinates.
    - `layersElProp`:The dot notated path to the feature properties that contains the features' elevation. If unset, the elevation will be calculated through the feature's longitude, latitude, elevation coordinates.
    - `style`: A style object to change the style of the connective lines on the Map between features. (Ex. { "color": "#00000", "weight": 5})
- `coordinateAttachments`: Attachment layers for each coordinate of every feature.
  - `marker`: Place a marker at every coordinate of every feature.
    - `initialVisibility`: Whether the coordinate marker sublayer is initially on. Users can toggle sublayers on and off in the layer settings in the LayersTool.
    - `opacity`: Opacity of markers. Default 1
    - `color`: A stroke css color (or prop:...)
    - `weight`: Integer for stroke thickness in pixels.
    - `fillColor`: A fill css color (or prop:...)
    - `fillOpacity`: Opacity of marker fill. Default 1
    - `radius`: Integer for radius of marker.
- `markerAttachments`: An object for attaching dynamic items to point features.
  - `bearing`: Sets the bearing direction (clockwise from north) of this layer's point markers (or markerIcons if set). Overrides the layer's shape dropdown value.
    - `angleProp`: The dot notated path to the feature properties that contains the desired rotation angle. Ex. `headings.yaw`.
    - `angleUnit`: Unit of the value of `angleProp`. Either `deg` or `rad`.
    - `color`: A css color for the directional arrow for non-markerIcon bearings.
  - `uncertainty`: A sublayer feature that places ellipses about point features to indicate positional uncertainty
    - `initialVisibility`: Whether the uncertainty sublayer is initially on. Users can toggle sublayers on and off in the layer settings in the LayersTool.
    - `xAxisProp`: Prop path to the x axis radius value of the ellipse.
    - `yAxisProp`: Prop path to the y axis radius value of the ellipse.
    - `axisUnit`: "meters OR kilometers",
    - `angleProp`: Prop path to the rotation of the ellipse.
    - `angleUnit`: "deg OR rad"
    - `color`: A css fill color. Will be made more transparent than set. Default 'white'
    - `fillOpacity`: Map and clamped ellipse fill opacity. 0 to 1. Default 0.25
    - `strokeColor`: Map and clamped ellipse stroke/border color. Default 'black'
    - `weight`: Map and clamped ellipse stroke/border weight/thickness. Default 1
    - `opacity`: Overall Map and clamped ellipse opacity. Default 0.8
    - `color3d`: 3d curtain ellipse color. Can be an array for a vertical gradient: ["rgba(0,0,0,0)", "#26A8FF"]
    - `depth3d`: Depth in meters for 3d ellipse curve. Default 2
    - `opacity3d`: 3d curtain ellipse opacity
  - `image`: Places a scaled and orientated image under each marker. A sublayer.
    - `initialVisibility`: Whether the image sublayer is initially on. Users can toggle sublayers on and off in the layer settings in the LayersTool.
    - `path`: A url to a (preferably) top-down north-facing orthographic image.
    - `pathProp`: A prop path to an image url. Take priority over path. Useful if the path is feature specific.
    - `widthMeters`: Width of image in meters in order to calculate scale.
    - `widthPixels`: Image width in pixels.
    - `heightPixels`: Image height in pixel.
    - `angleProp`: Prop path to the rotation of the image.
    - `angleUnit`: "deg OR rad"
    - `show`: "click OR always". If set to "always", overrides the Waypoints Kind (if set) and always renders the image under the marker. "click" just shows the image on click and requires the layer to have the Waypoints Kind.
  - `model`:
    - `path`: Path to model (.dae, .glb, .gltf, .obj)
    - `pathProp`: A prop path to a model. Takes priority over path. Useful if model is feature specific.
    - `mtlPath`: If .obj, the path to its material file (.mtl)
    - `yawProp`: Prop path to the model's yaw. If this value is a number, uses it directly.
    - `yawUnit`: "deg OR rad"
    - `invertYaw`: Boolean that, if true, multiplies yaw by -1.
    - `pitchProp`: Prop path to the model's pitch. If this value is a number, uses it directly.
    - `pitchUnit`: "deg OR rad"
    - `invertPitch`: Boolean that, if true, multiplies pitch by -1.
    - `rollProp`: Prop path to the model's roll. If this value is a number, uses it directly.
    - `rollUnit`: "deg OR rad"
    - `invertRoll`: Boolean that, if true, multiplies roll by -1.
    - `elevationProp`: Prop path to the model's elevation (in meters). If this value is a number, uses it directly. Default 0.
    - `scaleProp`: Prop path to the model's scale. If this value is a number, uses it directly. Default 1.
    - `show`: "click OR always"
    - `onlyLastN`: If false, shows models at all points. If a number, only shows models for the last n points.
- `pathAttachments`: Attach specialized paths to LineStrings and Polygons. Useful with `hideMainFeature: true`.
  - `gradient`: Renders a "hotline" gradient for visualizing value changes along a path.
    - `colorWithProp`: Prop path to the value's key to visualize.
    - `dropdownColorWithProp`: Array of additional prop paths. Users can toggle between value properties in the LayersTool. `colorWithProp`'s path is automatically added here if not already included.
    - `colorRamp`: Array of css colors indicating the color ramp. The first color represents the min value and the last color represents the max value in the layer.
    - `weight`: Integer for path thickness in pixels.
- `markerIcon`: Uses an icon image instead of an svg for all of the layer's point markers. If you're using this as a bearing marker, make sure the base icon is pointing north.
- `search`: This requires the "Minimalist" option in the Look Tab to be unchecked. When set, this layer will become searchable through the search bar at the top. The search will look for and autocomplete on the properties specified. All properties are enclosed by parentheses and space-separated. `round` can be used like a function to round the property beforehand. `rmunder` works similarly but removes all underscores instead.
