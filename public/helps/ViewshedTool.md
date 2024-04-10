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
- _Editting Icon_
  - In the case of multiple viewsheds, if the viewshed is being editted, it means clicking and interacting with the map will set its observer point.
- _Viewshed Name_
  - An edittable viewshed name.
- _3D_
  - Click to view the viewshed in 3D. (May not be supported depending on configuration.)
- _Options_
  - Click to expand or collapse this viewshed's options.

#### Options

- _Data_
  - Which observing spacecraft/orbiter to use. This is only used for formatting and converting the upcoming 'Time' parameter. The true observer position is always the visible map's center longitude and latitude value (represented by a green circle) and always facing north with zero tilt.
- _Color_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Opacity_
  - Height in meters above the surface to use when calculating line-of-sight shading. For instance, a point on the surface (0m) may not be visible to a 'Source Entity', say the Mars Reconnaissance Orbiter (MRO), but 2m above that point may be. This value does not _only_ apply to the center longtitude and latitude but to all points on the visible terrain. Gradually increaing this value shows the shade map n-meters above the surface.
- _Resolution_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Reverse_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Camera Presets_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Observer Height_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Target Height_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _FOV (Az)_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _FOV (El)_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Center Azimuth_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Center Elevation_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Latitude_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Longitude_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.

#### Footer

- _Delete_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Save_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Clone_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.
- _Regenerate_
  - Offers the ability to set the current working time using a mission/spacecraft's custom date type.

### Results

- _Azimuth_: The compass-angle in (0 -> 360) degrees clockwise from north of the direction of the 'Source Entity' as seen from the map's center longitude and latitude. 0 = North, 90 = East, 180 = South, 270 = West.
- _Elevation_: The angular height (-90 -> 90) between the horizon and the 'Source Entity'. -90 = Straight Down, 0 = Level with the Horizon, 90 = Straight Overhead.
- _Range_: The straight-line distance in kilometers between the map's center longitude, latitude and terrain elevation and the 'Source Entity'.
- _Longitude_: The map's center longitude value used in the computation.
- _Latitude_: The map's center latitude value used in the computation.
- _Altitude_: The distance in kilometers above the map's center position's tangential plane and the 'Source Entity'. In other words, in a 3D cartesian coordinate-system where the Z-axis goes through both the center of the visible map and the center of the planet, this 'Altitude' is the Z distance between that center and the 'Source Entity'.

### Algorithm

The screen elevation values are placed in an xy grid and the target's respective x,y,elev is computed and run through a modified version of [_Generating Viewsheds without Using Sightlines_](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) by _Jianjun Wang, Gary J. Robinson, and Kevin White_
