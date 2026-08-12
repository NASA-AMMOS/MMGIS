/**
 * Guard for what makes a globe click find its 2D feature.
 *
 * selectFeature matches the feature a Cesium entity came from against the
 * Leaflet layer's features by comparing properties. The globe is handed a copy
 * with a dynamic style resolved onto `properties.style` (layerConfig.geojson),
 * which the 2D feature never carries — so a layer with dynamic styling on
 * became unclickable in 3D until that key was left out of the comparison.
 *
 * selection.js pulls in Description and ToolController_, which the unit runner
 * can't load, so this asserts the invariant at the source level.
 */

import { test, expect } from "@playwright/test";

const fs = require("fs");
const path = require("path");

const SELECTION = path.resolve(
  __dirname,
  "../../src/essence/Basics/Layers_/features/selection.js",
);

test("selectFeature ignores properties.style on both sides of the match", () => {
  const src = fs.readFileSync(SELECTION, "utf8");
  expect(src).toContain("delete featureWithout_.properties.style");
  expect(src).toContain("delete lfeatureWithout_.properties.style");
});

const RENDERER = path.resolve(
  __dirname,
  "../../src/essence/Basics/Globe_/GlobeRenderer.js",
);

test("the globe's own feature lookup ignores a resolved style too", () => {
  // Highlighting matches the clicked feature against featureMap the same way.
  const src = fs.readFileSync(RENDERER, "utf8");
  expect(src).toContain("delete cleanProps1.style");
  expect(src).toContain("delete cleanProps2.style");
});

test("an id decides which entity is highlighted before any deep compare", () => {
  // Deduped group_id siblings can compare equal on geometry and properties.
  const src = fs.readFileSync(RENDERER, "utf8");
  const fidAt = src.indexOf("const fid = this._featureIdOf(feature)");
  const deepAt = src.indexOf("const geometryMatch = this._compareGeometry");
  expect(fidAt).toBeGreaterThan(-1);
  expect(deepAt).toBeGreaterThan(fidAt);
});

test("a highlight is drawn as its own outline, not painted onto the entity", () => {
  // Cesium batches draped geometry and ignores a colour changed after load.
  const src = fs.readFileSync(RENDERER, "utf8");
  expect(src).toContain("_outlineHighlightFor(entity)");
  expect(src).not.toContain("entity.polyline.material = Cesium.Color.RED");
  expect(src).not.toContain("entity.polygon.outlineColor = Cesium.Color.RED");
});

test("only a ring is measured as closed when picking by outline", () => {
  // A polyline is an open path: an edge from its last vertex back to its first
  // is never drawn, and measuring one would pick it from far away.
  const src = fs.readFileSync(RENDERER, "utf8");
  expect(src).toContain(
    "const last = line ? positions.length - 1 : positions.length",
  );
});

test("an id of one kind never matches an id of the other", () => {
  // A geodataset writes its row id to properties._.idx and only writes
  // properties.feature_id when the layer asks for that column: matching one
  // against the other names a different feature.
  const {
    sameFeature,
  } = require("../../src/essence/Basics/Layers_/features/identity.js");
  expect(sameFeature({ feature_id: 7 }, { feature_id: "7" })).toBe(true);
  expect(sameFeature({ _: { idx: 7 } }, { feature_id: 7 })).toBe(false);
  // A kind they both carry decides it, whatever else either one has.
  expect(sameFeature({ feature_id: 3, _: { idx: 7 } }, { _: { idx: 7 } })).toBe(
    true,
  );
  expect(sameFeature({ name: "no id" }, { name: "no id" })).toBe(false);
  expect(sameFeature(null, { feature_id: 1 })).toBe(false);
});

test("a resolved style is not part of a feature's identity in either direction", () => {
  const src = fs.readFileSync(SELECTION, "utf8");
  // Both stripped before F_.isEqual compares them.
  const compareAt = src.indexOf("const propertiesMatch");
  expect(compareAt).toBeGreaterThan(-1);
  const before = src.slice(0, compareAt);
  expect(
    (before.match(/properties\.style/g) || []).length,
  ).toBeGreaterThanOrEqual(2);
});
