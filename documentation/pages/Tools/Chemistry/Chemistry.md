---
layout: page
title: Chemistry
permalink: /tools/chemistry
parent: Tools
---

# Chemistry

Graphs a feature's oxide percentages by shot number.

### Setup Example

1. Within the configure page's layers tab create a new layer with Kind of Layer set to Chemistry Tool.
1. Set it's URL to a geojson file or geodataset where each feature contains a property called "TARGET". This "TARGET" should correspond to the "Target" in the next step.
1. Upload a csv dataset called "ccam_single_shots" that contains a column for "Target", "ShotNumber", "Al2O3", "CaO", "FeOT", "K2O", "MgO", "Na2O", "SiO2" and "TiO2"
1. Use the following for the layer's raw variables:

   ```javascript
   {
       "datasetLinks": [
           {
               "prop": "TARGET",
               "dataset": "ccam_single_shots",
               "column": "Target",
               "type": ""
           }
       ],
       "chemistry": [
           "Al2O3",
           "CaO",
           "FeOT",
           "K2O",
           "MgO",
           "Na2O",
           "SiO2",
           "TiO2"
       ]
   }
   ```

   - `datasetLinks` is saying: When a user clicks on a feature of this layer, query the MMGIS database. Look for the dataset called "ccam_single_shots" and look at the column "Target". Return back every row of the dataset where the feature's property "TARGET"s value equals that of "Target".
   - `chemistry` describes which chemistry columns to use as percentages and it what order.
