## Layer Filtering

_Filter down a layer's displayed features through a logical property-value query or through a spatial query._

Layer filtering works on both `Vector` and `Query` layer types. For `Vector` layers, the performed filter is done solely in the browser using each feature's metadata. For `Query` layers, the filter will be sent to a service (such as `ElasticSearch`) and must be submitted at least once before viewing its data.

### Property-Value Queries

These queries allow you to filter features by property-value equivalencies and ranges. A list of rows of the structure `Property | Operator | Value | Clear` enables this.

- The `Property` field auto-completes and must be one of the auto-completed values.
- The `Operator` dropdown contains the following operators:
  - `=` - _Equals._ The feature's `Property` must equal `Value` to remain visible.
  - `in` - _In List._ The feature's `Property` must equal _at least one of_ of the _comma-separated_ entries of `Value` to remain visible.
  - `<` - _Less Than._ The feature's `Property` must be less than `Value`. If performed on a textual `Property`, the comparison becomes alphabetical.
  - `>` - _Greater Than._ The feature's `Property` must be greater than `Value`. If performed on a textual `Property`, the comparison becomes alphabetical.
  - `[...]` - _Contains._ The feature's `Property` must contain `Value`. If performed on a numeric `Property`, its value is first parsed into a string.
  - `[...` - _Begins With._ The feature's `Property` must begin with `Value`. If performed on a numeric `Property`, its value is first parsed into a string.
  - `...]` - _Ends With._ The feature's `Property` must end with `Value`. If performed on a numeric `Property`, its value is first parsed into a string.

#### Add +

By default, one property-value row is provide. To add more, click the top-right "Add +" button. Use a property-value row's right-most "X" to then remove the row.

#### Group +

By default, all property-value rows are ANDed together. Adding Operator Groups and dragging to rearrange rows enables modifying this behavior. Each Group is still ANDed together with the other groups. Each Group ends when another Group starts. Groups cannot be nested.

- `Match All (AND)` - All property-value rows beneath this row and up until the next Group row or up until the end are ANDed together - they must all be true for a feature to match the query.
- `Match Any (OR)` - All property-value rows beneath this row and up until the next Group row or up until the end are ORed together - at least one match must be true for a feature to match the query.
- `Match Inverse (NOT AND)` - All property-value rows beneath this row and up until the next Group row or up until the end are ANDed together and then negated - all matches must be false for a feature to match the query.

#### Example

```json
group OR
sol > 10
sol < 20
sol = 25
group AND
site = 3
drive = 1
group NOT AND
pose = 0
```

_becomes:_

```
(sol > 10 OR sol < 20 OR sol = 25) AND (site = 3 && drive = 1) AND NOT (pose = 0)
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
