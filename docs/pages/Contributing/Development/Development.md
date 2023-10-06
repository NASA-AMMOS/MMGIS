---
layout: page
title: Development
permalink: /contributing/development
parent: Contributing
nav_order: 1
---

# Development

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

1. Go to `src/essence/Tools`

   1. Create a new directory here with the name of your new tool
   1. Copy and paste `New Tool Template.js` into your new directory
   1. Rename the pasted file to `[Your Tool's Name]Tool.js`
   1. Add a `config.json` file so that MMGIS can find it. Do look at the existing tools' `config.json` but here's a template:

   ```javascript
   {
        "defaultIcon": "a material design icon https://pictogrammers.com/library/mdi/ identifier",
        "description": "A quick description of the tool's capabilities.",
        "descriptionFull": {
            "title": "A longer description of the tool's capabilities.",
            "example": {
                "A example object of the configuration variables the tool accepts": "value"
            }
        },
        "hasVars": true,
        "name": "{toolName}",
        "toolbarPriority": 3,
        "paths": {
            "{toolName}Tool": "essence/Tools/{toolName}/{toolName}Tool"
        },
        "expandable": false
    }

   ```

1. Restart the server with `npm start`

1. Use the `/configure` page to enable the tool in your development environment

### Developing

#### Overview

Ideally all the code for a tool will be in its `[Tool's Name]Tool.js` and built off of the `New Tool Template.js`.

- All tools must return an object with `make` and `destroy` functions.
  - `make` is called when the user clicks on the tool's icon while `destroy` is called when the user clicks on any other tool's icon.
- Tools should work independently of one another.
- Tools should only change the `#tools` div or something in the viewer, map and/or globe.
- Use `width` or `height` entries to set the tool div's dimensions.

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
