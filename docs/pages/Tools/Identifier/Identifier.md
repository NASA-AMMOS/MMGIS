---
layout: page
title: Identifier
permalink: /tools/identifier
parent: Tools
---

# Identifier

Mouse over to query underlying datasets. This will read the raw values from a geo-referenced dataset, which can be any bit-depth (8,16,32). You can set up multiple file to return values from.

### Raw Variables

The following is an example of the Sites Tool's Tool Tab configuration:

```javascript
{
    "Layer_Name": {
        "url": "(str) path_to_data/data.tif",
        "bands": "(int) how many bands to query from",
        "sigfigs": "(int) how many digits after the decimal",
        "scalefactor": "(float) number to multiply value",
        "unit": "(str) whatever string unit",
        "timeFormat": "(str) for formatting injected '{starttime}' and '{endtime}' in url."
    },
    "...": {}
}
```

- `Layer_Name`: This is the layer name exactly as it appears in the Layers section in the configuration.
- `url`: This can be a relative path to a file under the Mission name or a full url path. The former is preferred is the file is large. Can use '{starttime}' and '{endtime}' if the layer is time enabled.
- `bands`: Allows you to specify how many bands to return data from. Default is 1.
- `sigfigs`: Sets the decimal precision.
- `scalefactor`: A float number that will multiply the value to scale.
- `unit`: A string that is appended to your returned value. e.g. " m" would be appended on a raw value ("41") and show "41 m". If it was "m", it would return "41m", without a space.
- `timeFormat`: A string for formatting the injected '{starttime}' and '{endtime}' in the url. See syntax in https://d3js.org/d3-time-format#locale_format
