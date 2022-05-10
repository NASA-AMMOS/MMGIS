---
layout: page
title: Legend
permalink: /tools/legend
parent: Tools
---

# Legend

A layer can be configured with a legend by pointing its Legend field to a .csv file. The Legend Tool renders symbologies and gradient scales for any properly configured on layer.

The Legend Tool takes no raw variable configurations in the Tools Tab.

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

#### header

THe header must be `color,strokecolor,shape,value`.

#### color

Any [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value) to use as the main fill color.

#### strokecolor

Any [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value) to use as the stroke/border color. _Note: discreet and continuous shapes have no borders._

#### shape

Can be either `circle`, `square`, `rect`, `discreet` and `continuous`. Discreet and continuous describe scales. These scales are broken into groups by a change in shape value. For instance, "discreet, discreet, discreet, circle, discreet, discreet" represents a discreet scales of three colors, a circle and then a discreet scale of two colors.

### value

A string value for the legend entry.
