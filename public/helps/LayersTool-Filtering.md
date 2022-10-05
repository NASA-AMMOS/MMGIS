## Layer Filtering

_Filter down a layer's displayed features through a logical property-value query or through a spatial query._

Layer filtering works on both `Vector` and `Query` layer types. For `Vector` layers, the performed filter is done solely in the browser using each feature's metadata. For `Query` layers, the filter will be sent to a service (such as `ElasticSearch`) and must be submitted at least once before viewing its data.

### Property-Value Queries

These queries allow you to filter features by property-value equivalencies and ranges. A list of rows of the structure `Property | Operator | Value | Clear` enables this.

- The `Property` field auto-completes and must be one of the auto-completed values.
- The `Operator` dropdown contains the following operators:
  - `=` - The feature's `Property` must equal `Value` to remain visible.
  - `in` - The feature's `Property` must equal _at least one of_ of the _comma-separated_ entries of `Value` to remain visible.
  - `<` - The feature's `Property` must be less than `Value`. If performed on a textual `Property`, the comparison becomes alphabetical.
  - `>` - The feature's `Property` must be greater than `Value`. If performed on a textual `Property`, the comparison becomes alphabetical.

#### Add +

By default one property-value row is provide. To add more, click the top-right "Add +" button. Use a property-value row's right-most "X" to then remove the row.

#### Logical Groupings (Parentheticals)

In favoring simplicity, not all boolean logic queries are possible. There is no **NOT** operator. All property-value rows are **AND**ed together with the following exception:

- If there exists multiple instances of the same `Property`, only the `<` and `>` are **AND**ed together and the other operations are **OR**ed together. (See example below)

Rows of the same `Property` are color coded to better visually track this function. Row order has zero bearing on the derived parenthetical groupings.

#### Example

```json
sol > 10
sol < 20
sol = 25
drive = 0
```

_becomes:_

```
((sol > 10 AND sol < 20) OR sol = 25) AND drive = 0
```

### Spatial Queries

These queries allow you to restrict features to some spatial extent. To begin:

- Click "Place Point" and then click a location on the Map to place a query feature.
- Enter a radius in meters into the "R" field to set the placed query feature's radius.

There are two spatial modes and they depend on the value of "R" or Radius.

- _Contains:_ If `Radius = 0`, the query feature will be a point and the filter will search for _all features that contain that point_. This primarily works on polygonal features.
- _Intersects:_ If `Radius > 0`, the query feature will be a circle and the filter will search for _all features that either intersect or are contained by the circle._

The spatial query is *AND*ed with the property-value query.

### Finally

Use the `Submit` button to submit the query and the `Clear Filter` button to reset the layer to its initial unfiltered state.
