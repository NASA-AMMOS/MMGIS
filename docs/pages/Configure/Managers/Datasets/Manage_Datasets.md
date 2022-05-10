---
layout: page
title: Datasets
permalink: /configure/managers/datasets
parent: Managers
grand_parent: Configure
---

# Datasets

Instead of attaching massive amounts of data as geojson properties, you can use datasets to fetch the necessary data on feature click.

Upload a CSV and then link to them within a layer's variables with:

```
"datasetLinks": [{"prop": "{geojson_property_to_match}","dataset": "{dataset_name}","column": "{dataset_column_name}"}]
```

_Note:_ All matching rows will be returned — not just the first.
