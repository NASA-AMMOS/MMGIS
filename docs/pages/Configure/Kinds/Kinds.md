---
layout: page
title: Kinds
permalink: /configure/kinds
parent: Configure
nav_order: 3
---

# Kinds

- The Kind of layer a layer is describes what happens when a feature of that layer is clicked on.
- Internally, Kinds are treated as quasi-tools. Instead of adding a Tool to a mission, you add a Kind to a layer.

### None

By default and if available, the clicked feature highlights, sends its metadata to the Info Tool and gets briefly described in the top bar. All Kinds have this behavior by default as well.

### Info

Works just like the None Kind but automatically opens the Info Tool too (if it's on and included).

### Waypoint

This Kind is very specific to the Curiosity Rover and only works on point features. It takes hardcoded rover dimensions, `public/images/rovers/CuriosityTopDownOrthoSmall.png` and the geojson feature property `yaw_rad` to orient a to scale Curiosity Rover image under the clicked point.

The Waypoint Kind only applies to point features and uses the `markerAttachments.image` and `markerAttachments.model` layer raw variables. When `show` is set to "click" (or undefined), clicking on a point will draw an image in the Map and a model in the Globe. Both image and model can be set, scaled and rotated dynamically. The Waypoint Kind is specifically useful for rover images and models. See [Vector Layer Raw Variables](Layers_Tab#raw-variables-2) for more information about the image and model marker attachments.

```javascript
markerAttachments: {
    image: {
        initialVisibility: true,
        path: "url to top-down ortho image. ex. public/images/rovers/PerseveranceTopDown.png",
        pathProp: "path to image. take priority over path",
        widthMeters: 2.6924,
        widthPixels: 420,
        heightPixels: 600,
        angleProp: "path.to.angle.prop",
        angleUnit: "deg || rad",
        show: "click || always",
    },
    model: {
        path: "path to mode (.dae, .glb, .gltf, .obj)",
        pathProp: "path to model. take priority over path",
        mtlPath: "if .obj, path to material file (.mtl)",
        yawProp: "path.to.yaw.prop",
        yawUnit: "deg || rad",
        invertYaw: false,
        pitchProp: "path.to.pitch.prop",
        pitchUnit: "deg || rad",
        invertPitch: true,
        rollProp: "path.to.roll.prop",
        rollUnit: "deg || rad",
        invertRoll: false,
        elevationProp: "path.to.elev.prop",
        scaleProp: "path.to.scale.prop",
        show: "click || always",
    }
}
```

### Chemistry Tool

This Kind is used for the Chemistry Tool. Because chemistry data can be big and it's advise to link to it via a dataset, this Kind waits

### Draw Tool

Uses a read only version of the Draw Tool's edit panel and forces the Info Tool open. The main use case for this is to be used with the published Draw Tool layer (setting the vector layer's URL to `api:publishedall`).
