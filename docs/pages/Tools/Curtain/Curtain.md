---
layout: page
title: Curtain
permalink: /tools/curtain
parent: Tools
---

# Curtain

Vertical imagery aligned under terrain for visualizing data from ground penetrating radar.

### Raw Variables

The following is an example of the Sites Tool's Tool Tab configuration:

```javascript
{
    "withCredentials": false
}
```

- `withCredentials`: An array of objects required to add sites.

### Configuring Features

To setup curtains, add objects of type "radargram" to a LineString feature's `properties.images` array and enable the Viewer Panel.

```json
{
    "type": "Feature",
    "properties": {
        "fromPoint": "A",
        "toPoint": "B",
        "length": 23.4476738253,
        "day": 1,
        "images": [
            {
                "url": "Layers/rfax/026_profile_noaxis.png",
                "type": "radargram",
                "mode": "026",
                "topElev": -2535,
                "depth": 10.99,
                "length": 23.44
            },
            {
                "url": "Layers/rfax/056_profile_noaxis.png",
                "type": "radargram",
                "mode": "056",
                "topElev": -2535,
                "depth": 12.01,
                "length": 23.44
            },
            {
                "url": "Layers/rfax/078_profile_noaxis.png",
                "type": "radargram",
                "mode": "078",
                "topElev": -2535,
                "depth": 12.74,
                "length": 23.44
            },
            {
                "url": "Layers/rfax/214_profile_noaxis.png",
                "type": "radargram",
                "mode": "214",
                "topElev": -2535,
                "depth": 19.74,
                "length": 23.44
            },
            {
                "url": "Layers/rfax/240_profile_noaxis.png",
                "type": "radargram",
                "mode": "240",
                "topElev": -2535,
                "depth": 17.41,
                "length": 23.44
            }
        ]
    },
    "geometry": {
        "type": "LineString",
        "coordinates": [
           ...
        ]
    }
}
```

- `mode`: Any string to show in a dropdown in the Curtain Tool to identify and switch between radargrams in case there are many.
- `topElev`: Top elevation in meters that correspond to the top pixel of the radargram image. Radargrams should be generated to be terrain aligned.
- `depth`: Depth of radargram image in meters.
- `length`: Width of radargram image in meters. May use LineString geometry's length.
