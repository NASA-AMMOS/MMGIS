---
layout: page
title: Look
permalink: /configure/tabs/look
parent: Tabs
grand_parent: Configure
---

# Look Tab

Configure the look of MMGIS's UI for the mission

### Rebranding

#### Page Name

Sets the browser tab title and, if the UI is not minimalist, sets the title in the top bar. Defaults to `MMGIS`

### User Interface

Toggles user interface elements on or off.

#### Minimalist UI (DISABLED)

If checked, hides the top bar. The top bar contains descriptive elements and interactions as well as a search bar. Checking this may cause other setups to be irrelevant.

#### Tob Bar

#### Tool Bar

#### Scale Bar

#### Coordinates

#### Map Zoom Control

If checked, adds `+` and `-` zoom buttons to the top right of the Map.

#### Map Graticule

Displays a grid of longitudinal and latitudinal lines over the Map.

#### Miscellaneous

### Colors

#### Body Color

Sets the background color of MMGIS to a [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Might have little impact.

#### TopBar Color

Sets the color of the top bar to a [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Minimalist UI needs to be unchecked to see impact.

#### ToolBar Color

Sets the color of vertical tool bar to a [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value).

#### Map Color

Sets the background of the Map to a [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). The color is seen in regions of the 2D map where there is no data.

#### Highlight Color

Sets the highlight of active vector features to a [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value).

### Secondary Tools

#### Swap (DISABLED)

If checked, adds a button in the tool bar that enables users to switch seamlessly between missions. This functionality may be buggy and break things depending on the missions switched to and from. It's recommended to return to the landing page to switch between missions or to extensively test swapping between your missions before enabling Swap.

#### Copy Link

If checked, adds a button in the tool bar that enables users to create a shortened deep link of their current view in MMGIS. The link is automatically copied to their clipboard for easy sharing.

#### Screenshot

If checked, adds a button in the tool bar that enables users to screenshot the current view of the 2D Map. Because this works by rerendering all of HTML and CSS into an image, there may be missing or misplaced elements in the image.

#### Fullscreen

If checked, adds a button in the tool bar that enables users to quickly enter and exit fullscreen mode.

### User Help

#### Help

If checked, adds a button in the tool bar that links to help documentation. That link can be specified below in Help URL.

#### Square Logo Image URL

A URL to a new logo if the default MMGIS is unwanted. The logo should be reasonably sized, square and centered.

#### Help URL

The URL to take users to in they click the help icon in the bottom left. Help above should be checked on.
