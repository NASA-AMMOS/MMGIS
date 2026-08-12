/**
 * Guard for what makes a globe reload reach the screen.
 *
 * A reload loads the new GeoJSON into the layer's existing entity collection
 * with its events suspended (no flash). Cesium's EntityCollection cancels a
 * removal against an addition of the same id, so entities re-added under the
 * ids they had read as no change at all and the old ones stayed drawn — a
 * restyle from the Layers Tool never appeared on the globe.
 *
 * The module imports Cesium, which the unit runner can't load, so this asserts
 * the invariant at the source level.
 */

import { test, expect } from "@playwright/test";

const fs = require("fs");
const path = require("path");

const CESIUM_VECTOR = path.resolve(
  __dirname,
  "../../plugins/core/layertypes/Vector/globe/cesium.js",
);

test("a reload's entities are ids of their own, not the last load's", () => {
  const src = fs.readFileSync(CESIUM_VECTOR, "utf8");
  expect(src).toContain("const internalId = `${name}_${loadToken}_${index}`");
});

test("a multipart entity still finds its feature", () => {
  // Cesium suffixes the parts of a multi-geometry (`..._2`), which the base id
  // the featureMap is keyed by doesn't have.
  const src = fs.readFileSync(
    path.resolve(__dirname, "../../src/essence/Basics/Globe_/GlobeRenderer.js"),
    "utf8",
  );
  expect(src).toContain("String(entity.id).replace(/_\\d+$/, '')");
  const strip = (id) => id.replace(/_\d+$/, "");
  expect(strip("Layer_3_7_2")).toBe("Layer_3_7");
});
