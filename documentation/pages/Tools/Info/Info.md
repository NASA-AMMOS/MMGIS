---
layout: page
title: Info
permalink: /tools/info
parent: Tools
---

# Info

Display the geojson properties field of a clicked point. Any clicked feature will open the Info tool and display the data in JSON formatting. Some layer 'kinds' disable opening the Info tool and displaying data automatically, like the "Waypoints" kind layer.

To activate, left-click on the tool and then click on a feature in the Map view. The feature properties and geometry will be displayed on a panel on the left side of the web page. Left-clicking the Info icon will close the panel.

### Example Tool Tab Variables

```javascript
{
    "sortAlphabetically": true
}
```

_"sortAlphabetically"_: Whether to sort properties alphabetically or not. Defaults to true.
