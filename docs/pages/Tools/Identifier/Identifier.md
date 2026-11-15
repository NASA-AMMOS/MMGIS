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

### Time Series

When a time-enabled STAC collection layer (`stac-collection:` source) is on, the hover readout ends with _Click for time series_. Hovering never queries history; clicking does.

Clicking the map (or the globe) with the Identifier active places a marker and opens a Time Series panel with one chart per such layer: the value at that point for every acquisition in the layer's current time window (`layer.time.start` to `layer.time.end`, the same window the hover reads), oldest to newest. Clicking elsewhere moves the marker and redraws the charts. Changing the time window or turning layers on and off redraws them in place. Closing the panel, or turning the Identifier off, removes the marker and cancels any requests still running.

A click is left to whatever else is using it:

- **Another tool:** while a toolbar tool is taking map clicks - it sets `disableLayerInteractions` (Measure), or has its own handler on the map's click event (Sightline, Viewshed, Draw while drawing, Animation while drawing) - the Identifier doesn't chart.
- **A feature:** a click on a clickable feature (a vector feature or marker on the map, or an entity on the Cesium globe) selects that feature and isn't charted. To chart a point inside a clickable polygon, hide that layer.
- **A drag:** dragging the map or globe isn't a click.

How each chart is built:

- **Times** come from each STAC item's `properties.datetime` (or, for items that only carry a range, `properties.start_datetime`, with the range shown in the tooltip), read from the STAC API with `GET /stac/search` for the items containing the point in the time window. Items without a valid time are skipped and counted. Times are never taken from file names or result order.
- **Values** are read from TiTiler for exactly those items (`/titilerpgstac/collections/{id}/point/{lng},{lat}?ids=...`), in batches whose `items_limit` equals the batch size, so pgSTAC's per-point item limit can't drop older acquisitions. Each value is matched to its item by name.
- The layer's runtime or configured band expression, or its queried bands, are used as in the hover readout. Units are the Identifier's `unit` for the layer if set, else the layer's `cogUnits`; the Identifier's `scalefactor` for the layer is applied if set.
- Every acquisition keeps its place on the time axis. One with no usable reading is a gap in the line, never 0 and never bridged by the line, and the tooltip says why: "no data" (masked/nodata pixel), "no reading" (TiTiler returned nothing for that item or band), or "invalid value" (a non-finite or non-numeric value). The panel counts each kind. Acquisitions sharing a timestamp are all kept, ordered by item id.
- At most 500 acquisitions are charted per layer and click; the panel says when a history was cut short. Results are cached per point, layer, time window, band selection or expression, scale factor and units, so clicking the same place again doesn't re-query, and changing any of those does.

Layers that can't be charted are listed under _Not charted_ with the reason: vector layers, pre-rendered tiles (colours only), COGs and Identifier `url` sources (see below), and layers that aren't time-enabled or have no time range set. The panel only opens when at least one time-enabled layer is on.

#### COG layers

COG layers (`COG:` sources) are not charted, time-enabled or not. A COG layer's time support is URL templating: `{time}`, `{starttime}`, `{endtime}` and `{customtime.N}` are filled from the time window, so each window resolves to one file, and TiTiler's COG reader has no `datetime` filter (the `datetime` MMGIS appends to COG tile URLs is ignored). Nothing in a COG layer's configuration lists the times it has files for, so building a history would mean guessing timestamps and file names.

Charting COG histories needs a source of acquisition times. Options for maintainers to decide between:

1. Catalogue the COGs as a STAC collection (as the Reference Mission does for its blueprint COGs) and use a `stac-collection:` layer. This works today.
2. Add a layer setting that lists a COG layer's acquisition times explicitly. The Identifier would then read one point per listed time from the resolved URL.


For an external collection (`stac-collection:https://host/titilerpgstac/collections/name`), the STAC API is expected beside its TiTiler at `https://host/stac`, as MMGIS serves them. If it isn't there, the panel says acquisition times couldn't be read.
