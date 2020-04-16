# Kinds

- The Kind of layer a layer is describes what happens when a feature of that layer is clicked on.
- Internally, Kinds are treated as quasi-tools. Instead of adding a Tool to a mission, you add a Kind to a layer.

### None

By default and if available, the clicked feature highlights, sends its metadata to the Info Tool and gets briefly described in the top bar. All Kinds have this behavior by default as well.

### Info

Works just like the None Kind but automatically opens the Info Tool too (if it's on and included).

### Waypoint

This Kind is very specific to the Curiosity Rover and only works on point features. It takes hardcoded rover dimensions, `resources/RoverImages/CuriosityTopDownOrthoSmall.png` and the geojson feature property `yaw_rad` to orient a to scale Curiosity Rover image under the clicked point.

### Chemistry Tool

This Kind is used for the Chemistry Tool. Because chemistry data can be big and it's advise to link to it via a dataset, this Kind waits

### Draw Tool

Uses a read only version of the Draw Tool's edit panel and forces the Info Tool open. The main use case for this is to be used with the published Draw Tool layer (setting the vector layer's URL to `api:publishedall`).
