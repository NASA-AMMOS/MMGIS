---
layout: page
title: Legend
permalink: /tools/legend
parent: Tools
---

# Legend

A layer can be configured with a legend by pointing its Legend field to a .csv file or by including a JSON `legend` array into the layer's Raw Variables. The Legend Tool renders symbologies and gradient scales for any properly configured on layer.

On the Configure page, under Tools, you can specify additional options:

* displayOnStart: Whether the expanded legend should automatically be displayed on start (`true`/`false`)
* filterInView: Whether class legends start narrowed to the classes in the current map view (`true`/`false`). See [Filtering to the current view](#filtering-to-the-current-view).

```javascript
{
    "displayOnStart": true,
    "filterInView": false
}
```

### Moving and resizing

On desktop the Legend's panel, like the other floating tool panels, can be dragged by its header and resized from its bottom-right corner. Double-click the header to put it back. Its position and size are remembered in the browser.

### Filtering to the current view

The **In view only** button at the top of the Legend narrows class legends to the entries present in the current map view, and notes how many that is ("12 of 52 in view"). It is re-read when the map stops moving.

- **`stac-collection:` and `COG:` Tile layers**: one small request per layer reads the view from TiTiler. The legend's entries must name the pixel value or range they stand for, in a `propertyValue` column (`7`, or `10 - 20`) or as the `value` itself. Layers drawn through a Single Data Band COG Transformation or an expression are not narrowed.
- **Vector layers**: narrowed when the legend comes from a categorical Dynamic Style rule, from the features in view. A legend written by hand has no tie to the features and is left as it is.
- The view is sampled, so a class covering only a few pixels can be missed. Hovering it with the Identifier Tool shows its entry.

### Legends from STAC classes

A Tile layer served from a `stac-collection:` URL gets its legend from the collection when no Legend is configured for it. If the collection lists classes with the STAC [classification extension](https://github.com/stac-extensions/classification) (`classification:classes`), each class becomes a legend entry, and the Identifier Tool shows the class's name beside the pixel value.

- Classes are read from the collection's `item_assets` (the rendered band first, then the asset) and then from its `summaries`.
- An entry is labeled with the class's `title`, else its `description`, else its `name`.
- An entry is colored by the layer's Custom Color Table when it has one, else by the class's `color_hint`. Classes marked `nodata` are left out. With a Custom Color Table, so are classes it doesn't list or makes fully transparent, since they aren't drawn: a collection can enumerate every possible class while the legend shows only the ones on the map.
- A configured Legend (a file or a Raw Variables `legend`) takes precedence, as does the scale of a Single Data Band COG Transformation.
- The collection is read once, when the layer's legend is first shown. Classes added to the collection later appear on the next page load.

```json
{
  "item_assets": {
    "asset": {
      "classification:classes": [
        { "value": 1, "name": "water", "title": "Water", "color_hint": "0000ff" },
        { "value": 2, "name": "forest", "title": "Forest", "color_hint": "00a000" },
        { "value": 255, "name": "nodata", "nodata": true }
      ]
    }
  }
}
```

### legend.csv example:

        color,strokecolor,shape,value
        purple,#000,discreet,This
        cyan,#000,discreet,is
        lime,#000,discreet,a
        yellow,#000,discreet,sentential
        orange,#000,discreet,example
        red,#000,discreet,of
        purple,#000,continuous,what
        red,#000,continuous,values
        white,#000,continuous,the
        blue,#000,continuous,legend
        pink,#000,circle,csv
        green,#000,discreet,files
        orange,#000,discreet,could
        crimson,cyan,square,possibly
        indigo,#FFF,rect,contain

### Raw Variables examples:

```json
{
  "legend": [
    {
      "color": "purple",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "This"
    },
    {
      "color": "cyan",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "is"
    },
    {
      "color": "lime",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "a"
    },
    {
      "color": " yellow",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "sentential"
    },
    {
      "color": "orange",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "example"
    },
    {
      "color": "red",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "of"
    },
    {
      "color": "purple",
      "strokecolor": "#000",
      "shape": "continuous",
      "value": "what"
    },
    {
      "color": "red",
      "strokecolor": "#000",
      "shape": "continuous",
      "value": "values"
    },
    {
      "color": "white",
      "strokecolor": "#000",
      "shape": "continuous",
      "value": "the"
    },
    {
      "color": "blue",
      "strokecolor": "#000",
      "shape": "continuous",
      "value": "legend"
    },
    {
      "color": "pink",
      "strokecolor": "#000",
      "shape": "circle",
      "value": "csv"
    },
    {
      "color": "green",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "files"
    },
    {
      "color": " orange",
      "strokecolor": "#000",
      "shape": "discreet",
      "value": "could"
    },
    {
      "color": "crimson",
      "strokecolor": "cyan",
      "shape": "square",
      "value": "possibly"
    },
    {
      "color": "indigo",
      "strokecolor": "#FFF",
      "shape": "rect",
      "value": "contain"
    }
  ]
}
```

#### header

The header/properties must be `color,strokecolor,shape,value`.

#### color

Any [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value) to use as the main fill color.

#### strokecolor

Any [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value) to use as the stroke/border color. _Note: discreet and continuous shapes have no borders._

#### shape

Can be either `circle`, `square`, `rect`, `discreet` and `continuous`. Discreet and continuous describe scales. These scales are broken into groups by a change in shape value. For instance, "discreet, discreet, discreet, circle, discreet, discreet" represents a discreet scales of three colors, a circle and then a discreet scale of two colors.

#### value

A string value for the legend entry.
