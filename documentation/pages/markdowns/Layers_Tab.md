# Layers Tab

Add, alter and remove Layers:

"Saving Changes" will catch most structural mistakes made here and will inform you of what's wrong. It will not verify anything further such as whether a layer's data exists or whether the raw variables entered are valid.

##### Contents

- [Adding Layers](#adding-layers)
- [Cloning Layers](#cloning-layers)
- [Removing Layers](#removing-layers)
- [Layer Structure](#layer-structure)
- [Configuring Individual Layers](#configuring-individual-layers)
- [Layer Types](#layer-types)

## Adding Layers

- Scroll to the bottom of the page and click "Add Layer +"
  - This will add a blank `header` layer named "Name Layer" to the bottom of the layers list.

## Cloning Layers

- Clicking a layer brings up its form. At the top right of this form there is a button to clone the layer. Clicking it clones the layer and adds it to the bottom of the layers list. Because layer names must be unique, the layer name of the newly cloned layer must be changed before saving changes can be successful.

## Removing Layers

- Clicking a layer brings up its form. A the bottom left of this form there is a button to delete the layer. There is no additional warning prompt.

## Layer Structure

- The layer at the top of the layers list renders on top of all other layers. The layer second from the top of the list of layers renders on top of all other layers except the first one. And so on.
- Layers can be reordered by clicking and dragging them vertically to a new position. If you're dealing with a long list of layers, use the mouse-wheel while holding a layer to move it more quickly.
- Layers can also be clicked and dragged horizontally. If a layer is indented, it will be grouped under the header above it. Headers can be indented/nested within other headers too.

## Configuring Individual Layers

- Clicking a layer brings of a form to change its parameters.
- Layers can be broken up by 6 types and can be set with the "Layer Type" field.

---

## Layer Types

- [Header](?page=Header)
- [Tile](?page=Tile)
- [Vector Tile](?page=Vector_Tile)
- [Data](?page=Data)
- [Query](?page=Query)
- [Vector](?page=Vector)
- [Model](?page=Model)
