# Development

### NOT UP TO DATE if MMGIS2+ (require.js removed, webpack added, react supported)

MMGIS is written in JavaScript and uses [Require.js](http://requirejs.org/) as an architectural platform for the front end and [Node.js](https://nodejs.org/).

##### Contents

- [Developing A New Tool](#developing-a-new-tool)
  - [Setup](#setup)
  - [Developing](#developing)
    - [Overview](#overview)
    - [Template Walkthrough](#template-walkthrough)
- [Developing A New Backend](#developing-a-new-tool)
  - [Setup](#setup)
  - [Developing](#developing)
    - [Overview](#overview)
    - [Template Walkthrough](#template-walkthrough)

---

## Developing A New Tool

### Setup

New tools are automatically found and included on start.

1. Go to `scripts/essence/Tools`
   1. Create a new directory here with the name of your new tool
   1. Copy and paste `New Tool Template.js` into your new directory
   1. Rename the pasted file to `[Your Tool's Name]Tool.js`
1. Restart the server with `npm start`

1. Use the `/configure` page to enable the tool in your development environment

### Developing

#### Overview

Ideally all the code for a tool will be in its `[Tool's Name]Tool.js` and built off of the `New Tool Template.js`.

- All tools must return an object with `make` and `destroy` functions.
  - `make` is called when the user clicks on the tool's icon while `destroy` is called when the user clicks on any other tool's icon.
- Tools should work independently of one another.
- Tools should only change the `#tools` div or something in the viewer, map and/or globe.

#### Template Walkthrough

An in-depth walkthrough of `New Tool Template.js`:

```javascript
define(  [ 'jquery', 'd3', 'Formulae_', 'Layers_', 'Globe_', 'Map_', 'Viewer_' ],
function (    $    ,  d3 ,      F_    ,     L_   ,  Globe_ ,  Map_ ,  Viewer_  ) {
```

This is the main module container form for require.js. Here, by default, jquery, d3, Formulae\_, Layers\_, Globe\_, Map\_ and Viewer\_ are brought in. You can access those module objects by typing their corresponding function parameter (i.e. jquery's is \$) and using the normal dot notation: `F_.hexToRGB( '#000' );`.

- jquery: DOM manipulator
- d3: DOM manipulator
- Formulae\_: A collection of mathy formulas such as bearings between coordinates or a true modulo function
- Layers\_: Manages MMGIS' data and layers such as get layers by name and toggling layers on and off
- Globe\_: The 3D globe panel
- Map\_: The 2D map
- Viewer\_: The image viewer

```javascript
var markup = [].join("\n");
```

Since tools are dynamically added to the DOM, it may be easier to directly write the tool HTML into `markup` where each element is its own line and then add that markup to the `#tools` div.

```javascript
var NewToolTemplate = {
  MMGISInterface: null,
  make: function () {
    this.MMGISInterface = new interfaceWithMMGIS();
  },
  destroy: function () {
    this.MMGISInterface.separateFromMMGIS();
  },
};
```

This is the object the tool must return. `NewToolTemplate` should be renamed to `[Tool's Name]Tool`. `MMGISInterface` just helps keep the DOM elements and stylings separate. `make` is called right when the user activates the tool. Because tools all share the same div, each time a tool is made it must recreate its DOM. `destroy` is called right when the user activates another tool. Feel free to add other functions to this object or outside of it.

```javascript
function interfaceWithMMGIS() {
  this.separateFromMMGIS = function () {
    separateFromMMGIS();
  };

  //MMGIS should always have a div with id 'tools'
  var tools = d3.select("#tools");
  //Clear it
  tools.selectAll("*").remove();
  //Add a semantic container
  tools = tools
    .append("div")
    .attr("class", "center aligned ui padded grid")
    .style("height", "100%");
  //Add the markup to tools or do it manually
  //tools.html( markup );

  //Add event functions and whatnot

  //Share everything. Don't take things that aren't yours.
  // Put things back where you found them.
  function separateFromMMGIS() {}
}
```

`interfaceWithMMGIS` just clears the `#tools` div and adds a semantic-ui grid and is called immediately once the object is invoked. `separateFromMMGIS` is then called later from `destroy`.

```javascript
return NewToolTemplate;
```

Return the NewToolTemplate or whatever its name was changed to.

## Developing A New Backend

### Setup

New backends are automatically found and included on start.

1. Go to `API/Backend`
   1. Create a new directory here with the name of your new backend
   1. Copy and paste `setupTemplate.js` into your new directory
   1. Rename the pasted file to `setup.js`
   1. Edit `setup.js` based on the development guide below
1. Restart the server with `npm start`

### Developing

#### Overview

All the code for a backend must stay in its `API/Backend/[name]` directory.

- Backends should work independently of one another.
- Use the existing backends as a reference point.

#### Template Walkthrough

```javascript
const router = require("./routes/your_router");
```

Write scripts within you backend directory and import them. Most backends follow the directory structure:

- API/Backend/[name]
  - models/
  - routes/
  - setup.js

```
let setup = {
  //Once the app initializes
  onceInit: s => {},
  //Once the server starts
  onceStarted: s => {},
  //Once all tables sync
  onceSynced: s => {},
  envs: [{ name: "ENV_VAR", description: "", required: false, private: false }]
};
```

onceInit() is called immediately on `npm start`
onceStarted() is called once the http server starts up
onceSynced() is called once all table are created/has their existence verified.

The s parameter is an object containing the app and middleware. A common form to attach an API within a `setup.js` is to fill onceInit() with:

```javascript
onceInit: (s) => {
  s.app.use(
    "/API/example",
    s.ensureUser(),
    s.checkHeadersCodeInjection,
    s.setContentType,
    s.stopGuests,
    importedRouter
  );
};
```

`envs` help document which environment values the backend uses and logs errors if required environment variables aren't set. Variables that end with `_HOST` are for URLs and upon start up they'll be pinged and there status will be logged.

Please refer to the existing backend directories for further examples.
