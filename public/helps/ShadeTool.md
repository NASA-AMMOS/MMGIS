## Tool: Shade

_Shades the ground when line-of-sights to an orbiting target are occluded._

**Note:** Terrain beyond the screen's current extent is **not** factored into the displayed visiblity map — only observer-target direction and on-screen terrain is considered. A distant off-screen mountain will **not** cast shadows.

### Algorithm

1. The following are taken and fed into SPICE:
   - The longitude, latitude, and elevation location at the center of the map (the observer)
   - The current date
   - The target (which may be an orbiter, the Sun, etc.)
2. The following are returned
   - The azimuth, elevation, and range from that loctation to the target
     - Source location is assumed to be facing north with no tilt
   - The longitude, latitude on the map directly under the target and its elevation
3. All elevation values from the current screen extent and queried
4. The target's longitude, latitude, elevation are projected onto a plane tangential to the observer
5. The screen elevation values are placed in an xy grid and the, from the previous values, the target's respective x,y,elev is computed and run through a modified version of [_Generating Viewsheds without Using Sightlines_](https://www.asprs.org/wp-content/uploads/pers/2000journal/january/2000_jan_87-90.pdf) by _Jianjun Wang, Gary J. Robinson, and Kevin White_
