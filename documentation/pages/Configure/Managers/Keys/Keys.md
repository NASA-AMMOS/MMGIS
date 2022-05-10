---
layout: page
title: Keys
permalink: /configure/managers/keys
parent: Managers
grand_parent: Configure
---

# Keys

### General Usage

Make any (currently limited to only those listed below) configuration API call with the header "Authorization:Bearer <token>" included.

### Uploading CSVs

```
curl -i -X POST -H "Authorization:Bearer <token>" -F "name={dataset_name}" -F "upsert=true" -F "header=["File","Target","ShotNumber","Distance(m)","LaserPower","SpectrumTotal","SiO2","TiO2","Al2O3","FeOT","MgO","CaO","Na2O","K2O","Total","SiO2_RMSEP","TiO2_RMSEP","Al2O3_RMSEP","FeOT_RMSEP","MgO_RMSEP","CaO_RMSEP","Na2O_RMSEP","K2O_RMSEP"]" -F "data=@{path/to.csv};type=text/csv" http://localhost:8888/api/datasets/upload
```
