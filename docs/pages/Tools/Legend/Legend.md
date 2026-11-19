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

```javascript
{
    "displayOnStart": true
}
```

### Legends from STAC classes

A Tile layer served from a `stac-collection:` URL gets its legend from the collection when no Legend is configured for it. If the collection lists classes with the STAC [classification extension](https://github.com/stac-extensions/classification) (`classification:classes`), each class becomes a legend entry, and the Identifier Tool shows the class's name beside the pixel value.

- Classes are read from the collection's `item_assets` (the rendered band first, then the asset) and then from its `summaries`.
- An entry is labeled with the class's `title`, else its `description`, else its `name`.
- An entry is colored by the layer's Custom Color Table when it has one, else by the class's `color_hint`. Classes marked `nodata`, and ones the color table makes fully transparent, are left out.
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
