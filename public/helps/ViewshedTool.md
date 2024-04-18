## Tool: Viewshed

_Real-time line-of-sight visibility maps_

### Interface

- _New +_

  - Displaying simultaneous viewsheds on the map is supported. One, named "Viewshed 0" is created for you by default. Clicking the "New +" at the top-right corner of the tool will add additional viewsheds

- _Toggle All_
  - A shortcut to toggle on and off all viewshed layers on the layer.

#### Heading

- _Checkbox_
  - Toggles the viewshed on and off.
- _Editing Icon_
  - In the case of multiple viewsheds, if the viewshed is being edited, it means clicking and interacting with the map will set its observer point.
- _Viewshed Name_
  - An editable viewshed name.
- _3D_
  - Click to view the viewshed in 3D. (May not be supported depending on configuration.)
- _Options_
  - Click to expand or collapse this viewshed's options.

#### Options

- _Data_
  - The underlying Digital Elevation Model (DEM) on which to run the viewshed.
- _Color_
  - The color to render the viewshed on the map. Colored regions indicate visibility.
- _Opacity_
  - The opacity/transparency to render the viewshed on the map.
- _Resolution_
  - MMGIS downloads terrain data needed for the shading algorithm. Increasing the resolution improves the quality of the shade map and the cost of download and render speed. Each higher option is 4x the resolution of the previous one (i.e. 'ultra' is 4x more terrain data than 'high' and 16x more data than 'medium'). To save on performance, if the resolution is 'high' or 'ultra', the Shade Tool will no longer regenerate the shaded map whenever any parameter changes and instead 'Generate/Regenerate' must manually be pressed.
  - The generated viewshed is zoom-dependent. If you are zoomed in far enough, all resolutions will behave the same. If you are zoomed out far enough, all resolutions will behave differently. For instance assuming a 50m data resolution, we'd have:
    1. At ≤ 50m zoom scale, all four resolutions are the same.
    2. At 100m zoom scale, Ultra, High, and Medium are all the same.
    3. At 200m zoom scale, Ultra and High are the same.
    4. At ≥ 400m zoom scale, all four resolutions result in different maps.
- _Reverse_
  - Whether to invert the viewshedded region. If true, then all the colored regions are **not** visible.
- _Camera Presets_
  - Selecting a camera preset prefills the 'Observer Height', 'FOV (Az)', 'FOV (El)', 'Center Azimuth' and 'Center Elevation' fields.
- _Observer Height_
  - Height in meters from which the observer sees. For instance the viewshed of a person whose eye-level is 1.8 meters above the ground would have an Observer Height of 1.8.
- _Target Height_
  - Height above the surface which counts as visibility of the surface. For instance, a person wishes to know whether they can see their car from their location. The do not need to see the ground beneath their car to see their car. Here, the Target Height would be roughly the height of their car.
- _FOV (Az)_
  - Angle in degrees of the observer's horizontal field of view.
- _FOV (El)_
  - Angle in degrees of the observer's vertical field of view.
- _Center Azimuth_
  - Angle in degrees in which the observer is looking. Clockwise from north.
- _Center Elevation_
  - Tilt angle in degrees in which the observer is looking. 0 is level with the horizon, 90 is looking straight up and -90 is straight down.
- _Latitude_
  - Latitude position of the observer. Clicking on the map or dragging the observer marker will also prefill this.
- _Longitude_
  - Longitude position of the observer. Clicking on the map or dragging the observer marker will also prefill this.

#### Footer

- _Delete_
  - Deletes this viewshed.
- _Save_
  - Exports this viewshed as an ASCII file that contains a numerical grid of visible pixels along with metadata.
- _Clone_
  - Duplicates this viewshed into a new viewshed.
- _Regenerate_
  - Submits the viewshed for generation. This happens automatically if the 'Resolution' is 'medium' or 'low.

### Algorithm

The screen elevation values are placed in an xy grid and the target's respective x,y,elev is computed and run through a modified version of [_Generating Viewsheds without Using Sightlines_](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) by _Jianjun Wang, Gary J. Robinson, and Kevin White_
