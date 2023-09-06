---
layout: page
title: Query
permalink: /configure/layers/query
parent: Layers
grand_parent: Configure
---

# Query Layer

A user queryable layer whose data comes from an external search endpoint. Currently only supports ElasticSearch.

#### Layer Name

_type:_ string  
The unique display name and identifier of the layer. It must be unique and contain no special characters.

#### Endpoint

_type:_ string  
A file path that points to a search endpoint. Currently only supports ElasticSearch.

#### Type

_type:_ enum
Endpoint type.

#### Stroke Color

_type:_ CSS color string or a prop _optional_  
The border color of each feature. If the feature is a line, this field is the color of the line. See the Vector Styling page for more. Colors can be as follows:

- A named color
  - crimson, blue, rebeccapurple
- A hex color
  - #FFF
  - #A58101
- An rgb color
  - rgb(255,89,45)
- An hsl color
  - hsl(130, 26%, 34%)
- Based on a feature's color property
  - `prop:geojson_property_key` will set the feature's color to the values of `features[i].properties.geojson_property_key`
  - If that property is not a valid CSS color and is a string, it will use a random and consistent color based on its hash.

#### Fill Color

_type:_ CSS color string or a prop _optional_  
The fill color of each feature. See Stroke Color for color options. See the Vector Styling page for more.

#### Stroke Weight

_type:_ positive integer _optional_  
The thickness of the stroke/border in pixels. See the Vector Styling page for more.

#### Fill Opacity

_type:_ float _optional_  
A value from 0 to 1 of Fill Color's opacity. 1 is fully opaque. See the Vector Styling page for more.
_Note: It's also possible to set the opacities of colors directly with #CCDDEEFF, rgba() and hsla()._

#### Radius

_type:_ positive integer _optional_  
When a point feature is encountered, this value will be it's radius in pixels.

#### Raw Variables

Clicking "Set Default Variables" will add a template of all possible raw variables (without overwriting ones that are already set). All raw variables are optional.

Example:

```javascript
{
    "useKeyAsName": "propKey || [propKey1, propKey2, ...]",
    "datasetLinks": [
        {
            "prop": "{prop}",
            "dataset": "{dataset}",
            "column": "{column}",
            "type": "{none || images}"
        }
    ],
    "links": [
        {
            "name": "example",
            "link": "url/?param={prop}"
        }
    ],
    "query": {
        "bodyWrapper": "before{BODY}after`,
        "stringifyBody": "boolean - should the body be stringified",
        "withCredentials": "boolean - send cookie credentials with the request",
        "esResponses":
          "boolean - is the es responses nested in a responses object",
        "headers": {
          "Content-Type": "application/x-ndjson",
        },
        "fields": { "field1": "max_agg_size_number(0 for no agging)", "field2": 0 },
        "geoshapeProp": "propName of es geoshape field for spatial searches",
        "must": [
          {
            "match": {
              "fieldName": "fieldValue",
            },
          },
        ],
        "collapse": "directFieldName",
		    "sort": [
          {
            "fieldName": { "order": "desc or asc" }
          }
        ],
        "size": 1000,
      };
}
```

- `useKeyAsName`: The property key whose value should be the hover text of each feature. If left unset, the hover key and value will be the first one listed in the feature's properties. This may also be an array of keys.
- `links`: Configure deep links to other sites based on the properties on a selected feature. This requires the "Minimalist" option in the Look Tab to be unchecked. Upon clicking a feature, a list of deep links are put into the top bar and can be clicked on to navigate to any other page.
  - `name`: The name of the deep link. It should be unique.
  - `link`: A url template. Curly brackets are included. On feature click, all `{prop}` are replaced with the corresponding `features[i].properties.prop` value. Multiple `{prop}` are supported as are access to nested props using dot notation `{stores.food.candy}`.
  - `which`: This only supports the value `last` at this point.
  - `icon`: Any [Material Design Icon](http://materialdesignicons.com/) name
  - `value`: A name to display. All `{prop}`s will be replaced by their corresponding `features[which].properties[prop]` value.
- `query`: An object detailing how a query should be formed.
  - `bodyWrapper`: An optional string to wrapper the request body in. The body replaces `{BODY}` in the string. Use `stringifyBody` if you use `bodyWrapper`.
  - `stringifyBody`: Sends the request body as a string.
  - `withCredentials`: Sends cookie credentials along with the request.
  - `esResponses`: If true, data would be looked for in 'responses.0.data.hits.hits' instead of 'data.hits.hits'
  - `headers`: Header object for the requests.
  - `fields`: Property fields that we want the user to be able to search upon.
  - `geoshapeProp`: The property field of the search result's geoshape feature.
  - `must`: A 'must' stanza to always concatenate with the user's own filtered must.
  - `collapse`: ElasticSearch collapse returns only the top matched document of identical collapsed fieldName values. Just the string field name is needed and not the full object.
  - `sort`: Full ElasticSearch sort array.
  - `size`: Max number of results to show. ES has a default hard limit of 10k.
- _Other high level raw variable fields might still be applicable here but are untested._
