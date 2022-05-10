# Layer URLs

Layers in the Configure CMS can take in a variety of URLs aside from standard absolute and relative ones. Visit the Layers Tab page for more information about constructing standard URLs.

## API

### `api:publishedall`

_For a vector layer._  
Grabs all features published via the DrawTool

### `api:published:<file_intent>`

_For a vector layer._  
Grabs all features published via the DrawTool of a certain intent.
Possible values are: `roi, campaign, campsite, signpost, trail, all`

### `api:tacticaltargets`

_For a vector layer._  
If applicable, grabs all ingested tactical targets.

## GeoDatasets

### `geodatasets:<geodataset_name>`

_For a vector or vectortile layer._  
Grab features uploaded to the CMS as a geodataset (a geojson dataset). _Case Sensitive_
