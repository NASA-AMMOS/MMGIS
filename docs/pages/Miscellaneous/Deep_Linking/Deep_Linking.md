---
layout: page
title: Deep Linking
permalink: /miscellaneous/deep-linking
parent: Miscellaneous
nav_order: 2
---

# Deep Linking

The main state of MMGIS can be saved and shared by manipulating the URL. The following parameters describe the specifics of that state. Additionally there's a green "Copy Link" icon in the MMGIS toolbar that constructs these URLs. Those URLs are initially shortened but can be navigated to to view their expanded form in the address bar.

## Parameters

### mission=<br>`<mission name>`

The mission to navigate to.

- _form:_ `<string>`
- _dependencies_: NONE
- _unset:_ Will direct to a landing page to choose a mission. If there exists only one configured mission, then automatically go to it.

### site=<br>`<site code>`

The site described in the SitesTool to navigate to.

- _form:_ `<string>`
- _dependencies_: SitesTool
- _unset:_ If the SitesTool is enable and has sites, it will default to the first defined site.

### mapLon=<br>`<longitude>`

- _form:_ `<float>`
- _dependencies_: mapLat, mapZoom
- _unset:_ Will default to the initial view

### mapLat=<br>`<latitude>`

- _form:_ `<float>`
- _dependencies_: mapLon, mapZoom
- _unset:_ Will default to the initial view

### mapZoom=<br>`<zoom level>`

- _form:_ `<positive integer>`
- _dependencies_: mapLon, mapLat
- _unset:_ Will default to the initial view

### globeLon=<br>`<longitude>`

- _form:_ `<float>`
- _dependencies_: globeLat, globeZoom
- _unset:_ Will default to the initial view

### globeLat=<br>`<latitude>`

- _form:_ `<float>`
- _dependencies_: globeLon, globeZoom
- _unset:_ Will default to the initial view

### globeZoom=<br>`<zoom level>`

- _form:_ `<positive integer>`
- _dependencies_: globeLon, globeLat
- _unset:_ Will default to the initial view

### globeCamera=<br>`<posX>,<posY>,<posZ>,<tarX>,<tarY>,<tarZ>`

Defines the 3d coordinates [posX, posY, posZ] of where the Globe camera is position and points the Globe camera to look at [tarX, tarY, tarZ]. The Globe view is always centered at 0,y,0 with the y-axis up.

- _form:_ `<float,float,float,float,float,float>`
- _dependencies_: NONE
- _unset:_ Will default to an initial top-down view

### panePercents=<br>`<viewerPercent>,<mapPercent>,<globePercent>`

How much to open each panel. _All three values should add up to 100_. `0,100,0` would be the map covering the whole screen. `0,50,50` would be the screen split half way between the map and globe.

- _form:_ `<float,float,float>`
- _dependencies_: NONE
- _unset:_ Will default to `0,100,0`

### on=<br>`<name>$<opacity>,<name>$<opacity>...`

The name of the layer that's on and its opacity. When using the on parameter, all unlisted layers are deemed off. If a site is defined in the URL, the site's layers will turn on regardless.

- _form:_ `<string$float,string$float,string$float,...>`
- _dependencies_: NONE
- _unset:_ Only layers visible by default will be on

### centerPin=<br>`<hoverText>`

If a map latitude and longitude is set and centerPin has a value, then render a pin on the map at the its center. The value of centerPin becomes the pin/marker's mouse over text. If centerPin=true (or ''), then there is no mouse over text for the pin. This parameter is useful when you want to link to a specific coordinate on the map and maintain its location for the user rather than just setting the initial map view.

- _form:_ `<hoverText> || true || ''`
- _dependencies_: mapLon, mapLat
- _unset:_ No center point pin will be displayed

### selected=<br>`<layer name>,<lat>,<lon>,<view (opt)>,<zoom level (opt)>`<br>`<layer name>,<key>,<value>,<view (opt)>,<zoom level (opt)>`

The feature of a layer to have selected. If `lat` and `lon` are both numbers, the first _point_ in `layer name` with coordinates `lat` `lon` will be selected. Otherwise it'll be treated as a `key` `value` search. Under `key` `value` the first _feature_ in `layer name` whose `properties.<key>` matches `value` gets selected. `key` supports nested properties with dot notation ("buildings.stores.candy"). The selected `layer name` layer will always be turned on regardless of what the other parameters may say. `view` and `zoom level` are _optional_. If `view` is set to "go", the selection would not only be made but also panned to. `zoom level` sets the zoom of `view's` "go". If `zoom level` is unset but `view` is set, it will default to the `Zoom Level of Map Scale` configuration value if set or finally the `Initial Zoom Level` configuration variable.

- _form:_ `<string,float,float,string,integer | string,string,string,string,integer>`
- _dependencies_: NONE
- _unset:_ No feature will be selected

### viewerImg=<br>`<index>`

The index of the list of image products within the viewer. The viewer will only be populated with this list if a feature with image products is selected. The viewer captures any image, dzi, obj URLs found within the selected point's metadata to form this list.

- _form:_ `<integer>`
- _dependencies_: NONE
- _unset:_ Will default to the first image (if any)

### viewerLoc=<br>`<posX>,<posY>,<w>,<h>` (boundingbox for images)<br>`<tarX>,<tarY>,<tarZ>,<fov>` (target and field of view for photosphere)<br>`<posX>,<posY>,<posZ>,<tarX>,<tarY>,<tarZ>` (position and target for models)

- Bounding box is a top-left origined bounding box.
- Photosphere describes the camera's target and its field of view. Field of view in the photosphere is effectively zoom.
- Model is of the same form as `globeCamera`

The view of the image. The viewer supports regular images, spherically projected images and models and this parameter should match the view type of the image at `viewImg`s index.

- _form:_ `<float,float,integer,integer | float,float,float,float | float,float,float,float,float,float>`
- _dependencies_: NONE
- _unset:_ Will default to an initial view

### forcelanding=<br>`<boolean>`

If no `mission` is set in the URL, there exists only one configured mission and `forcelanding` is set to "true", then the landing page will not automatically redirect to the only configured mission.

- _form:_ `<boolean>`
- _dependencies_: mission is unset
- _unset:_ The landing page will redirect to the only mission if there exists only one configured mission

### startTime=<br>`<start time>`

Sets the start time for the Time Control feature.

- _form:_ `<string> (that moment.js understands)`
- _dependencies_: Time Control to be enabled
- _unset:_ Will default to current time if Time Control feature is enabled

### endTime=<br>`<end time>`

Sets the end time for the Time Control feature.

- _form:_ `<string> (that moment.js understands)`
- _dependencies_: Time Control to be enabled
- _unset:_ Will default to current time if Time Control feature is enabled

## Examples

#### General

```
https://<domain>/?mission=MSL&site=GAC&mapLon=137.36826181411746&mapLat=-4.676391308143136&mapZoom=16&globeLon=137.3738&globeLat=-4.674800000000008&globeZoom=16&globeCamera=673.9200228913286,3890.288691365299,-1563,0,4423.768073682673,0&panePercents=32.64331210191082,45.1167728237792,22.23991507430998&on=ChemCam$1.00,Waypoints$0.57,Traverse$1.00,GPR_1$1.00,HiRISE$1.00,Aeolis%20Palus$1.00&selected=Waypoints,-4.675793594577601,137.36642934025107&viewerImg=0&viewerLoc=0.04430,0.05091,-0.03785,37.5
```

#### Selecting and navigating to a feature in a layer named `Published Strategic Targets` by its property `uuid`

```
https://<domain>/?mission=<mission>&selected=Published%20Strategic%20Targets,uuid,a6222bca-6c51-4647-b28c-70b5e2d05886,go
```

#### Selecting and navigating to a feature in a layer named `Tactical Targets` by its nested property `data.uuid`

```
https://<domain>/?mission=<mission>&selected=Tactical%20Targets,data.uuid,170e096a-75c9-4db5-be64-d713e3a40955,go
```

#### Selecting and navigating to a feature in a layer named `End of Drive` by its property `site_pos`

```
https://<domain>/?mission=<mission>&selected=End%20of%2Drive,site_pos,<site>_<pos>,go
```
