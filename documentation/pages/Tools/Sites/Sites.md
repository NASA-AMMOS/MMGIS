---
layout: page
title: Sites
permalink: /tools/sites
parent: Tools
---

# Sites

Provides a way to navigate to specified latitude, longitude, zoom locations on the map.

### Raw Variables

The following is an example of the Sites Tool's Tool Tab configuration:

```javascript
{
    "sites": [
        {
            "name": "Gale Crater Overview",
            "code": "GCO",
            "view": [
                -4.6748,
                137.3738,
                11
            ]
        },
        {
            "name": "Gale Crater",
            "code": "GAC1",
            "view": [
                -4.6248,
                137.3738,
                16
            ]
        }
    ]
}
```

- `sites`: An array of objects required to add sites.
- `name`: A display name users see when selecting sites.
- `code`: A unique code to identify the site.
- `view`: An array as `[latitude, longitude, zoom]`.
