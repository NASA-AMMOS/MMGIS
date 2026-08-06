import { test, expect } from "@playwright/test";
import {
  asNumber,
  binEdges,
  collectValues,
  compileDynamicStyle,
  isUsableRule,
  rampStops,
  readProperty,
  resolveDomain,
} from "../../src/essence/Basics/Layers_/render/dynamicStyle.js";

/**
 * dynamicStyle unit tests — the pure core of dynamic vector styling.
 * Nothing here touches Leaflet, the globe, or a geodataset.
 */

const RAMP = ["#000000", "#ffffff"];

const numericRule = (over) =>
  Object.assign(
    {
      property: "value",
      attribute: "fillColor",
      type: "numeric",
      ramp: RAMP,
      domain: { source: "literal", min: 0, max: 100 },
    },
    over,
  );

test.describe("dynamicStyle - asNumber", () => {
  test("accepts numbers and numeric strings", () => {
    expect(asNumber(12.5)).toBe(12.5);
    expect(asNumber("12.5")).toBe(12.5);
    expect(asNumber(" -3 ")).toBe(-3);
    expect(asNumber("1e3")).toBe(1000);
    expect(asNumber(".5")).toBe(0.5);
  });

  test("rejects strings that merely start with digits", () => {
    expect(asNumber("2024-01-15")).toBeNull();
    expect(asNumber("1.2.3")).toBeNull();
    expect(asNumber("12px")).toBeNull();
  });

  test("rejects non-numeric types and non-finite numbers", () => {
    expect(asNumber(null)).toBeNull();
    expect(asNumber(undefined)).toBeNull();
    expect(asNumber(true)).toBeNull();
    expect(asNumber([1])).toBeNull();
    expect(asNumber({})).toBeNull();
    expect(asNumber(NaN)).toBeNull();
    expect(asNumber(Infinity)).toBeNull();
    expect(asNumber("1e999")).toBeNull();
  });
});

test.describe("dynamicStyle - readProperty", () => {
  test("reads a top-level property", () => {
    expect(readProperty({ a: 1 }, "a")).toBe(1);
  });

  test("reads a dotted path", () => {
    expect(
      readProperty({ meta: { reading: { value: 7 } } }, "meta.reading.value"),
    ).toBe(7);
  });

  test("returns null for a missing property or path", () => {
    expect(readProperty({ a: 1 }, "b")).toBeNull();
    expect(readProperty({ a: 1 }, "a.b.c")).toBeNull();
    expect(readProperty(null, "a")).toBeNull();
    expect(readProperty({ a: 1 }, "")).toBeNull();
  });

  test("preserves falsy values that exist", () => {
    expect(readProperty({ a: 0 }, "a")).toBe(0);
    expect(readProperty({ a: "" }, "a")).toBe("");
  });
});

test.describe("dynamicStyle - rampStops", () => {
  test("builds stops from an array of colors", () => {
    expect(rampStops(["#000", "#fff"])).toEqual([
      { position: 0, color: "#000" },
      { position: 1, color: "#fff" },
    ]);
  });

  test("reverses when asked", () => {
    const stops = rampStops(["#000", "#fff"], true);
    expect(stops[0].color).toBe("#fff");
    expect(stops[1].color).toBe("#000");
  });

  test("samples a named colormap", () => {
    const stops = rampStops("viridis");
    expect(stops.length).toBeGreaterThan(1);
    expect(stops[0].position).toBe(0);
    expect(stops[stops.length - 1].position).toBe(1);
    expect(stops[0].color).toMatch(/^rgb\(/);
  });

  test("returns nothing for an unknown ramp", () => {
    expect(rampStops("not-a-colormap")).toEqual([]);
    expect(rampStops(null)).toEqual([]);
    expect(rampStops([])).toEqual([]);
  });
});

test.describe("dynamicStyle - resolveDomain", () => {
  const stats = { value: { min: 10, max: 90, avg: 20, stddev: 5 } };

  test("a configured min/max always wins", () => {
    const rule = numericRule({
      domain: { source: "fieldStats", min: 1, max: 2 },
    });
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 1,
      max: 2,
    });
  });

  test("one configured end pins that end only", () => {
    const rule = numericRule({
      domain: { source: "fieldStats", min: 0, max: null },
    });
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 0,
      max: 90,
    });
  });

  test("an inverted configured domain is refused", () => {
    const rule = numericRule({ domain: { min: 10, max: 1 } });
    expect(resolveDomain(rule, {})).toBeNull();
  });

  test("fieldStats reads the stored dataset-wide extent", () => {
    const rule = numericRule({ domain: { source: "fieldStats" } });
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 10,
      max: 90,
    });
  });

  test("loaded reads the values in hand, ignoring stored stats", () => {
    const rule = numericRule({ domain: { source: "loaded" } });
    expect(
      resolveDomain(rule, { fieldStats: stats, values: [3, 5, 4] }),
    ).toEqual({
      min: 3,
      max: 5,
    });
  });

  test("auto prefers stored stats, falling back to loaded values", () => {
    const rule = numericRule({ domain: { source: "auto" } });
    expect(resolveDomain(rule, { fieldStats: stats, values: [3, 5] })).toEqual({
      min: 10,
      max: 90,
    });
    expect(resolveDomain(rule, { values: [3, 5] })).toEqual({ min: 3, max: 5 });
  });

  test("stddev narrows around the mean and clamps to the real extent", () => {
    const rule = numericRule({ domain: { source: "stddev", sigma: 2 } });
    // avg 20 ± 2·5 = 10..30, and 10 is already the minimum.
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 10,
      max: 30,
    });
  });

  test("stddev works with no stored stats, from the values in hand", () => {
    const rule = numericRule({ domain: { source: "stddev", sigma: 1 } });
    // 2,4,4,4,5,5,7,9 → avg 5, population stddev 2
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(resolveDomain(rule, { values })).toEqual({ min: 3, max: 7 });
  });

  test("stddev of zero falls back to the extent rather than a single point", () => {
    const rule = numericRule({ domain: { source: "stddev" } });
    expect(resolveDomain(rule, { values: [5, 5, 5] })).toEqual({
      min: 5,
      max: 5,
    });
  });

  test("returns null when there is nothing to measure", () => {
    const rule = numericRule({ domain: { source: "auto" } });
    expect(resolveDomain(rule, {})).toBeNull();
    expect(resolveDomain(rule, { values: [] })).toBeNull();
    expect(resolveDomain(rule, { values: ["a", "b"] })).toBeNull();
  });

  test("ignores field stats belonging to another property", () => {
    const rule = numericRule({ property: "depth", domain: { source: "auto" } });
    expect(resolveDomain(rule, { fieldStats: stats })).toBeNull();
  });
});

test.describe("dynamicStyle - collectValues and binEdges", () => {
  test("collects only the numeric values of a dotted property", () => {
    const features = [
      { properties: { m: { v: 1 } } },
      { properties: { m: { v: "2" } } },
      { properties: { m: { v: "x" } } },
      { properties: {} },
      {},
    ];
    expect(collectValues(features, "m.v")).toEqual([1, 2]);
  });

  test("collects nothing from a non-array", () => {
    expect(collectValues(null, "a")).toEqual([]);
  });

  test("divides a domain into even bins", () => {
    expect(binEdges({ min: 0, max: 10 }, 2)).toEqual([
      { min: 0, max: 5 },
      { min: 5, max: 10 },
    ]);
    expect(binEdges(null, 2)).toEqual([]);
    expect(binEdges({ min: 0, max: 10 }, 0)).toEqual([]);
  });
});

test.describe("dynamicStyle - isUsableRule", () => {
  test("accepts a complete numeric rule", () => {
    expect(isUsableRule(numericRule())).toBe(true);
  });

  test("rejects a rule with no property or an unknown attribute", () => {
    expect(isUsableRule(numericRule({ property: "" }))).toBe(false);
    expect(isUsableRule(numericRule({ attribute: "dashArray" }))).toBe(false);
    expect(isUsableRule(null)).toBe(false);
  });

  test("a categorical rule needs mappings", () => {
    expect(
      isUsableRule({ property: "k", attribute: "color", type: "categorical" }),
    ).toBe(false);
    expect(
      isUsableRule({
        property: "k",
        attribute: "color",
        type: "categorical",
        mappings: [],
      }),
    ).toBe(true);
  });
});

test.describe("dynamicStyle - compileDynamicStyle, numeric colours", () => {
  test("interpolates across the domain", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [numericRule()],
    });
    expect(resolve({ value: 0 }).fillColor).toBe("#000000");
    expect(resolve({ value: 100 }).fillColor).toBe("#ffffff");
    // Interpolated colours come back as rgb() from the shared gradient
    // utils; endpoints are the ramp's own strings.
    expect(resolve({ value: 50 }).fillColor).toBe("rgb(128, 128, 128)");
  });

  test("clamps values outside the domain rather than extrapolating", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [numericRule()],
    });
    expect(resolve({ value: -500 }).fillColor).toBe("#000000");
    expect(resolve({ value: 5000 }).fillColor).toBe("#ffffff");
  });

  test("a discrete rule gives every value in a bin the same colour", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [numericRule({ discrete: true, bins: 2 })],
    });
    const low = resolve({ value: 1 }).fillColor;
    expect(resolve({ value: 49 }).fillColor).toBe(low);
    expect(resolve({ value: 51 }).fillColor).not.toBe(low);
  });

  test("reads numeric strings and dotted paths", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [numericRule({ property: "meta.value" })],
    });
    expect(resolve({ meta: { value: "100" } }).fillColor).toBe("#ffffff");
  });

  test("a value-less feature falls through unless a null value is given", () => {
    const rules = [numericRule()];
    expect(
      compileDynamicStyle({ enabled: true, rules })({ other: 1 }),
    ).toBeNull();

    const withNull = [numericRule({ nullValue: "#ff00ff" })];
    expect(
      compileDynamicStyle({ enabled: true, rules: withNull })({ other: 1 })
        .fillColor,
    ).toBe("#ff00ff");
  });

  test("a domainless rule compiles to nothing rather than a wrong colour", () => {
    const rule = numericRule({ domain: { source: "loaded" } });
    expect(compileDynamicStyle({ enabled: true, rules: [rule] })).toBeNull();
  });
});

test.describe("dynamicStyle - compileDynamicStyle, numeric attributes", () => {
  test("maps a value onto a numeric range", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [numericRule({ attribute: "weight", range: [1, 9] })],
    });
    expect(resolve({ value: 0 }).weight).toBe(1);
    expect(resolve({ value: 50 }).weight).toBe(5);
    expect(resolve({ value: 100 }).weight).toBe(9);
  });

  test("an inverted range shrinks with the value", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [numericRule({ attribute: "radius", range: [16, 4] })],
    });
    expect(resolve({ value: 0 }).radius).toBe(16);
    expect(resolve({ value: 100 }).radius).toBe(4);
  });

  test("a numeric attribute with no range compiles to nothing", () => {
    const rule = numericRule({ attribute: "weight" });
    expect(compileDynamicStyle({ enabled: true, rules: [rule] })).toBeNull();
  });
});

test.describe("dynamicStyle - compileDynamicStyle, categorical", () => {
  const categorical = {
    property: "kind",
    attribute: "color",
    type: "categorical",
    mappings: [
      { value: "trail", color: "#33cc33" },
      { value: "road", color: "#cc3333" },
    ],
  };

  test("maps a value through the table", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [categorical],
    });
    expect(resolve({ kind: "trail" }).color).toBe("#33cc33");
    expect(resolve({ kind: "road" }).color).toBe("#cc3333");
  });

  test('compares by string, so 3 and "3" are the same category', () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [
        Object.assign({}, categorical, {
          mappings: [{ value: 3, color: "#123456" }],
        }),
      ],
    });
    expect(resolve({ kind: "3" }).color).toBe("#123456");
    expect(resolve({ kind: 3 }).color).toBe("#123456");
  });

  test("an unmapped category falls through, or takes the fallback", () => {
    expect(
      compileDynamicStyle({ enabled: true, rules: [categorical] })({
        kind: "river",
      }),
    ).toBeNull();
    const withFallback = Object.assign({}, categorical, {
      fallbackValue: "#999999",
    });
    expect(
      compileDynamicStyle({ enabled: true, rules: [withFallback] })({
        kind: "river",
      }).color,
    ).toBe("#999999");
  });

  test("drives a numeric attribute through `to`", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [
        {
          property: "kind",
          attribute: "weight",
          type: "categorical",
          mappings: [{ value: "trail", to: 4 }],
        },
      ],
    });
    expect(resolve({ kind: "trail" }).weight).toBe(4);
  });

  test("a table of nothing usable compiles to nothing", () => {
    const rule = Object.assign({}, categorical, {
      mappings: [{ color: "#fff" }],
    });
    expect(compileDynamicStyle({ enabled: true, rules: [rule] })).toBeNull();
  });
});

test.describe("dynamicStyle - compileDynamicStyle, whole configurations", () => {
  test("rules compose, each owning one attribute", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [
        numericRule(),
        numericRule({
          property: "confidence",
          attribute: "weight",
          range: [1, 5],
        }),
      ],
    });
    expect(resolve({ value: 100, confidence: 0 })).toEqual({
      fillColor: "#ffffff",
      weight: 1,
    });
  });

  test("per-property values are used for each rule", () => {
    const resolve = compileDynamicStyle(
      {
        enabled: true,
        rules: [
          numericRule({ domain: { source: "loaded" } }),
          numericRule({
            property: "depth",
            attribute: "weight",
            range: [0, 10],
            domain: { source: "loaded" },
          }),
        ],
      },
      { values: { value: [0, 10], depth: [100, 200] } },
    );
    expect(resolve({ value: 10, depth: 150 })).toEqual({
      fillColor: "#ffffff",
      weight: 5,
    });
  });

  test("unusable rules are skipped, not fatal", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [{ property: "" }, numericRule()],
    });
    expect(resolve({ value: 100 }).fillColor).toBe("#ffffff");
  });

  test("a disabled or empty configuration compiles to nothing", () => {
    expect(compileDynamicStyle(null)).toBeNull();
    expect(compileDynamicStyle({ rules: [numericRule()] })).toBeNull();
    expect(compileDynamicStyle({ enabled: true })).toBeNull();
    expect(compileDynamicStyle({ enabled: true, rules: [] })).toBeNull();
  });
});
