## Tool: Info

_Displays the metadata of the currently highlighted feature._

Click any vector feature in the Map to view its properties.

### Header Actions

- _Eye:_ This hides (or unhides) the active feature. This is useful if you want a very specific and individually curated view for, say, a screenshot and the Fitlering functionality in the Layers Tool doesn't quite cut it. Deep Links do not store which features are hidden nor do they persist through page reload. If any number of features are hidden, a green eye button will appear next to this one to provide the way to reshow all hidden features.
- _Clipboard:_ Copies the current feature's geometry and properties to your clipboard.
- _Target:_ Pans and zooms to the cuurent feature in the Map.

### Feature Dropdown

This dropdown often acts as title for the currently selected feature, however if there were overlapping features where you clicked to select a feature, this dropdown then contains all features that intersect your click. This is useful for selecting otherwise unclickable features.

### Filter

- _Filter Box:_ Filters the below properties. Looks at both key and value to do so.
- _Hidden Properties:_ This closed and open book button toggles between showing and hiding the features "hidden properties". Hidden properties are the `feature.properties` fields: `_`, `style`, `images`, and `coord_properties`.

### Properties

A list of all the `feature.properties` fields for the current feature. These have a blue left border. If the current feature is a point, the `feature.geometry.coordinates` will also be shown. These have a yellow left border. If the current feature is a line or polygon, post-computed metrics will be shown with an orange left border.

If a field is too long and gets truncated, clicking on it will expand it.
