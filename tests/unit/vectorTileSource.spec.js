import { test, expect } from "@playwright/test";
import {
  featureProperties,
  geodatasetTileUrl,
} from "../../plugins/core/layertypes/VectorTile/source.js";

/**
 * VectorTile source unit tests — the tile URL and feature properties the map
 * and the globe share.
 */

test("a geodataset layer's tiles come from the geodatasets MVT API", () => {
  global.window = { mmgisglobal: { ROOT_PATH: "/mmgis" } };
  expect(geodatasetTileUrl("geodatasets:counties")).toBe(
    "/mmgis/api/geodatasets/get?layer=counties&type=mvt&x={x}&y={y}&z={z}"
  );
  expect(geodatasetTileUrl("https://example.com/tiles/{z}/{x}/{y}.pbf")).toBe(null);
});

test("serialized properties are unpacked, and others are kept as they are", () => {
  expect(featureProperties({ properties: '{"population":500}' })).toEqual({
    population: 500,
  });
  const plain = { population: 500, properties: { nested: true } };
  expect(featureProperties(plain)).toBe(plain);
});

test("text in a properties field is an ordinary value, not serialized properties", () => {
  for (const text of ["Public land", "{not json", "[1,2]", ""]) {
    const plain = { properties: text, population: 500 };
    expect(featureProperties(plain)).toBe(plain);
  }
});
