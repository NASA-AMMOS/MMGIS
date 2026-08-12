/**
 * Guard for what makes a globe reload reach the screen.
 *
 * A reload draws into a new data source and retires the one it replaces once
 * the new features are up, so the layer is never off the globe. Loading into
 * the source already on screen instead made a restyle invisible: Cesium's
 * EntityCollection cancels a removal against an addition of the same id, so the
 * entities it already had went on being drawn.
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

test("what a load replaces stays up until the new features are drawn", () => {
  const src = fs.readFileSync(CESIUM_VECTOR, "utf8");
  expect(src).toContain("retire(gctx, outgoing, ds)");
  // Retired after the new source is on the scene, never before.
  expect(src.indexOf("gctx.renderer.dataSources.add(ds)")).toBeLessThan(
    src.indexOf("retire(gctx, outgoing, ds)"),
  );
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
