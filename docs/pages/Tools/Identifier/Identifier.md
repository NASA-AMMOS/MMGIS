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

Clicking the map (or the globe) with the Identifier active places a marker and opens a Time Series panel with one chart per such layer: the value at that point for every acquisition in the layer's current time window (`layer.time.start` to `layer.time.end`, the same window the hover reads), oldest to newest. Clicking elsewhere moves the marker and redraws the charts. Changing a layer's time window (including through `setLayerTime`), applying or resetting its band expression in the Layers tool, or turning layers on and off redraws the charts for the same point. Requests for an earlier point or an earlier setting are cancelled, and their late answers are ignored. Closing the panel, or turning the Identifier off, removes the marker and cancels any requests still running.

On a world copy of the map (longitude past ±180°), the point is read at its normalized longitude, and the marker stays where you clicked.

**Keyboard:** with the Identifier active, tabbing into the map reaches a _Chart time series at map centre_ button, shown over the map while it has focus. Pressing Enter charts the point under the centre of the map and moves focus to the panel. The readings are also given as a table under _Readings_. Escape or the close button closes the panel and returns focus to that button.

A click is left to whatever else is using it:

- **Another tool:** while a toolbar tool is taking map clicks - it sets `disableLayerInteractions` (Measure), or has its own handler on the map's click event (Sightline, Viewshed, Draw while drawing, Animation while drawing) - the Identifier doesn't chart.
- **A feature:** a click on a clickable feature (a vector feature or marker on the map, or an entity on the Cesium globe) selects that feature and isn't charted. To chart a point inside a clickable polygon, hide that layer.
- **A drag:** dragging the map or globe isn't a click.

How each chart is built:

- **Times** come from each STAC item's `properties.datetime` (or, for items that only carry a range, `properties.start_datetime`, with the range shown in the tooltip), read from the STAC API with `GET /stac/search` for the items containing the point in the time window. Items are counted by id, once each whatever page they appear on: items without a valid time are skipped and counted once, and the STAC API's `numberMatched` is compared with the number of distinct items read, so repeated items can't make a short history look complete. Items without an id can't be told apart, so they never make up that count: when only they would, the history is flagged as possibly incomplete. An item that comes back with different times on different pages keeps its first time and the history is flagged as possibly incomplete. Times are never taken from file names or result order.
- **Values** are read from TiTiler for exactly those items (`/titilerpgstac/collections/{id}/point/{lng},{lat}?ids=...`), in batches whose `items_limit` equals the batch size, so pgSTAC's per-point item limit can't drop older acquisitions. Each value is matched to its item by name. TiTiler can leave an item out of a multi-item answer without an error (pgSTAC's search stops at its time limit, 5 s by default, and items whose raster doesn't cover the point are dropped), so items left out are asked again in batches of 10 and then one at a time, within 20 extra requests per layer. An item left out of a successful answer to a request for it alone has no reading there (TiTiler found it, and its raster doesn't cover the point). If TiTiler answers a request for one item with "no assets found" (HTTP 204, or the older 404), it didn't find an item the STAC API matched here; that isn't a confirmed gap, so the item is shown as "not read". One the retries didn't reach is shown as "not read", the history is flagged as possibly incomplete, and it isn't cached.
- The layer's runtime or configured band expression, or its queried bands, are used as in the hover readout. Each request uses the settings as they were when it started, so an edit made while a chart loads applies to the next load and never to half of this one.
- Values and units are written as in the hover readout: the value TiTiler returns, rounded to 2 decimal places, followed by the layer's `cogUnits` (per band when it's a list). As in the hover, the Identifier's own `scalefactor` and `unit` settings aren't applied to STAC layers.
- Every acquisition keeps its place on the time axis. One with no usable reading is a gap in the line, never 0 and never bridged by the line, and the tooltip and table say why: "no data" (masked/nodata pixel), "no reading" (TiTiler returned nothing for that item, asked on its own, or for that band), "not read" (TiTiler's answers left the item out and couldn't confirm why: its value may exist), or "invalid value" (a non-finite or non-numeric value). The panel counts each kind. Acquisitions sharing a timestamp are all kept, ordered by item id, and the tooltip lists each one under its item id.
- When acquisitions cover the point but none has a usable value, no chart is drawn: the panel says so and opens the readings table, which lists every acquisition with its time, its item id and why it has no value. When no acquisition covers the point, the panel says that instead and there is no table.
- Times on the axis, in the tooltip and in the table are UTC, whatever the browser's time zone. A range is read as the instants it names and written in UTC too: `08:00+02:00` to `09:00+02:00` shows as 06:00–07:00 UTC. A range whose end is invalid or before its start isn't shown as a range.
- At most 500 acquisitions are charted per layer and click. When a history is cut short, or the STAC API's paging can't be followed to the end, the chart is still drawn and the panel says it may be incomplete.
- Results are cached per point, layer, time window and band selection or expression. Clicking the same place again (or the same place on a world copy) doesn't re-query, and changing any of those does. A history the STAC API or TiTiler left incomplete (paging it couldn't follow, a count its distinct items don't reach, items with differing times, or items left "not read") is shown but not cached, so the next click reads it again; one cut short only by the 500-acquisition or page limit is cached with its note. A failure is shown and retried on the next click: an error status, an unexpected 404, a request taking longer than 60 s from sending it to having read its whole response (a response whose body stalls counts), or a 200 response that isn't a point reading. TiTiler's 204 and its "no assets/items found" 404 mean the point has no data and are not failures. Closing the panel, moving the point or changing the layer's settings cancels the requests still running, including any still reading a response; nothing from them is shown or cached.
- At most 4 requests run at a time per click, shared by all charted layers. Requests go to the same origin and path MMGIS is served from.

Layers that can't be charted are listed under _Not charted (N)_ with the reason: vector layers, pre-rendered tiles (colours only), COGs and Identifier `url` sources (see below), and layers that aren't time-enabled or have no time range set. The list is open when nothing is charted and collapsed while a chart is shown; once you open or close it, it stays that way until the panel closes. The panel only opens when at least one time-enabled layer is on.

#### COG layers

COG layers (`COG:` sources) are not charted, time-enabled or not. A COG layer's time support is URL templating: `{time}`, `{starttime}`, `{endtime}` and `{customtime.N}` are filled from the time window, so each window resolves to one file, and TiTiler's COG reader has no `datetime` filter (the `datetime` MMGIS appends to COG tile URLs is ignored). Nothing in a COG layer's configuration lists the times it has files for, so building a history would mean guessing timestamps and file names.

With only COG layers on, hovering shows no _Click for time series_ hint. A click with a time-enabled COG on opens the panel, charts nothing, and lists the COG under _Not charted_ with this reason; with no time-enabled layer on, a click opens nothing.

Charting COG histories needs a source of acquisition times. Options for maintainers to decide between:

1. Catalogue the COGs as a STAC collection (as the Reference Mission does for its blueprint COGs) and use a `stac-collection:` layer. This works today.
2. Add a layer setting that lists a COG layer's acquisition times explicitly. The Identifier would then read one point per listed time from the resolved URL.

For an external collection (`stac-collection:https://host/titilerpgstac/collections/name`), the STAC API is expected beside its TiTiler at `https://host/stac`, as MMGIS serves them. If it isn't there, the panel says acquisition times couldn't be read.
