import { test, expect } from "@playwright/test";
import {
  attachDynamicStyle,
  hasDynamicStyle,
  vectorTileStyles,
} from "../../plugins/core/layertypes/VectorTile/dynamicStyle.js";
import { dynamicStyleSignature } from "../../src/essence/Basics/Layers_/render/dynamicStyleRuntime.js";

/**
 * VectorTile dynamic style unit tests — the styles a vector tile layer is drawn
 * with, and what it gives the dynamic style runtime from its tiles.
 */

const HIDDEN = {
  fill: false,
  stroke: false,
  weight: 0,
  fillOpacity: 0,
  opacity: 0,
};

const layer = (overrides = {}) =>
  Object.assign(
    {
      name: "Counties",
      style: { fillColor: "#888888", vtId: "GEOID" },
      variables: {
        dynamicStyle: {
          enabled: true,
          rules: [{ property: "population", attribute: "fillColor" }],
        },
      },
      // What compileLayerDynamicStyle leaves on a layer.
      _dynamicStyleResolver: (p) =>
        p.population == null
          ? null
          : { fillColor: p.population > 100 ? "#ff0000" : "#0000ff" },
    },
    overrides
  );

test("a layer is drawn ready for dynamic styling only when it is configured with it", () => {
  expect(hasDynamicStyle(layer())).toBe(true);
  expect(
    hasDynamicStyle(layer({ variables: { dynamicStyle: { enabled: false, rules: [] } } }))
  ).toBe(false);
  expect(hasDynamicStyle(layer({ variables: {} }))).toBe(false);
});

test("without a dynamic style, listed sublayers keep their style and the rest are hidden", () => {
  const listed = { counties: { fillColor: "#00ff00" } };
  const styles = vectorTileStyles(
    layer({ variables: {}, style: { vtLayer: listed } })
  );
  expect(styles.counties).toBe(listed.counties);
  expect(styles.roads).toEqual(HIDDEN);
  expect("roads" in styles).toBe(true);
});

test("with none listed, a dynamic style colors every sublayer over the layer's own colors", () => {
  const styles = vectorTileStyles(layer());
  expect(styles.counties).toBeInstanceOf(Function);
  expect(styles.counties({ population: 500 })).toMatchObject({
    fill: true,
    fillColor: "#ff0000",
  });
  // No value to style by: the layer's configured color.
  expect(styles.counties({})).toMatchObject({ fillColor: "#888888" });
  // One function per sublayer, so VectorGrid can compare styles by identity.
  expect(styles.counties).toBe(styles.counties);
});

test("with sublayers listed, only those are dynamically styled, over their own styles", () => {
  const styles = vectorTileStyles(
    layer({
      style: { vtId: "GEOID", vtLayer: { counties: { weight: 3, fillColor: "#111111" } } },
    })
  );
  expect(styles.counties({ population: 5 })).toEqual({
    weight: 3,
    fillColor: "#0000ff",
  });
  expect(styles.roads).toEqual(HIDDEN);
});

test("features are remembered for a whole-dataset scale, once per id", () => {
  const layerObj = layer();
  const styles = vectorTileStyles(layerObj);
  // One county cut across two tiles, and a second county.
  styles.counties({ GEOID: "a", population: 1 });
  styles.counties({ GEOID: "a", population: 1 });
  styles.counties({ GEOID: "b", population: 900 });
  const remembered = [...layerObj._vtRememberedFeatures.values()];
  expect(remembered.map((f) => f.properties.GEOID)).toEqual(["a", "b"]);
});

/** A VectorGrid's tiles, as far as the dynamic style reads them. */
function fakeGrid(layerObj, tiles) {
  const updated = [];
  const grid = {
    options: { vectorTileLayerStyles: vectorTileStyles(layerObj) },
    _overriddenStyles: {},
    _vectorTiles: {},
    _tileCoordsToBounds: (coords) => ({ x: coords.x }),
    _updateStyles: (symbolizer, renderer, style) =>
      updated.push([symbolizer.properties.GEOID, style(symbolizer.properties)]),
  };
  tiles.forEach((tile, x) => {
    const renderer = { getCoord: () => ({ x, y: 0, z: 5 }), _layers: {} };
    tile.forEach(({ sublayer, properties }, i) => {
      // Drawing a feature runs its sublayer's style, as VectorGrid does.
      const style = grid.options.vectorTileLayerStyles[sublayer];
      if (style instanceof Function) style(properties, 5);
      renderer._layers[i] = { properties };
    });
    grid._vectorTiles[`${x}:0:5`] = renderer;
  });
  attachDynamicStyle(grid, layerObj);
  return { grid, updated };
}

test("the features in view are the drawn ones in tiles that meet the view", () => {
  const layerObj = layer({ style: { vtId: "GEOID", vtLayer: { counties: {} } } });
  const { grid } = fakeGrid(layerObj, [
    [{ sublayer: "counties", properties: { GEOID: "a", population: 1 } }],
    [
      { sublayer: "counties", properties: { GEOID: "b", population: 2 } },
      // A sublayer that isn't dynamically styled is not measured.
      { sublayer: "roads", properties: { GEOID: "r", population: 99 } },
    ],
  ]);
  const onlySecondTile = { intersects: (tileBounds) => tileBounds.x === 1 };
  expect(
    grid.dynamicStyleFeatures(onlySecondTile).map((f) => f.properties.GEOID)
  ).toEqual(["b"]);
  // No bounds: every feature seen, for a whole-dataset scale.
  expect(
    grid.dynamicStyleFeatures(null).map((f) => f.properties.GEOID)
  ).toEqual(["a", "b"]);
});

test("a repaint restyles every drawn feature except a highlighted one", () => {
  const layerObj = layer();
  const { grid, updated } = fakeGrid(layerObj, [
    [
      { sublayer: "counties", properties: { GEOID: "a", population: 1 } },
      { sublayer: "counties", properties: { GEOID: "b", population: 500 } },
    ],
  ]);
  grid._overriddenStyles.a = { color: "red" };
  grid.repaintDynamicStyle();
  expect(updated).toEqual([["b", expect.objectContaining({ fillColor: "#ff0000" })]]);
});

test("the signature changes when a rule's scale does, and only then", () => {
  const compiled = (max) => ({
    _dynamicStyleRules: [
      { rule: { property: "population" }, domain: { min: 0, max }, mappings: [] },
    ],
  });
  expect(dynamicStyleSignature(compiled(10))).toBe(
    dynamicStyleSignature(compiled(10))
  );
  expect(dynamicStyleSignature(compiled(10))).not.toBe(
    dynamicStyleSignature(compiled(20))
  );
  expect(dynamicStyleSignature({})).toBe("[]");
});
