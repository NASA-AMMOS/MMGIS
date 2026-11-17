import { test, expect } from "@playwright/test";
import {
  propertyStats,
  summarizeProperty,
} from "../../src/essence/Basics/Layers_/render/dynamicStyleRuntime.js";

/**
 * dynamicStyleRuntime unit tests — what a layer reports about a property, over
 * whatever its domain is measured on.
 */

const layer = () => ({
  name: "Stats",
  variables: {
    dynamicStyle: {
      enabled: true,
      rules: [{ property: "depth", domain: { source: "fieldStats" } }],
    },
  },
  _fieldStats: {
    depth: { min: 1, max: 9, avg: 5, stddev: 2, count: 10, nullCount: 1 },
  },
});

test("a whole-dataset domain reports the dataset's own statistics", () => {
  expect(propertyStats(layer(), "depth")).toMatchObject({
    min: 1,
    max: 9,
    count: 10,
    scope: "dataset",
  });
});

test("features are summarized, counting the ones without a number", () => {
  const features = [
    { properties: { depth: 2 } },
    { properties: { depth: 4 } },
    { properties: { depth: null } },
    { properties: {} },
  ];
  expect(summarizeProperty(features, "depth")).toEqual({
    min: 2,
    max: 4,
    avg: 3,
    stddev: 1,
    count: 2,
    nullCount: 2,
  });
});

test("nothing to measure is no statistics at all", () => {
  expect(summarizeProperty([], "depth")).toBe(null);
  expect(summarizeProperty([{ properties: { depth: "n/a" } }], "depth")).toBe(
    null,
  );
});
