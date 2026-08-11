import { test, expect } from "@playwright/test";
import {
  asNumber,
  binEdges,
  collectCategories,
  collectValues,
  compileDynamicStyle,
  isUsableRule,
  normalizeStops,
  rampStops,
  readProperty,
  resolveDomain,
  rulePropertyLabel,
  rulePropertyPath,
  styleableAttributes,
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

  test("reads a key that has a dot in it", () => {
    // A geodataset files a nested field's group stats under the whole name.
    expect(
      readProperty(
        { _: { stats: { "meta.depth": { avg: 4 } } } },
        "_.stats.meta.depth.avg",
      ),
    ).toBe(4);
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

  test("keeps a stop that says where it sits", () => {
    expect(
      rampStops([
        { position: 0, color: "#000" },
        { position: 0.1, color: "#f00" },
        { position: 1, color: "#fff" },
      ]),
    ).toEqual([
      { position: 0, color: "#000" },
      { position: 0.1, color: "#f00" },
      { position: 1, color: "#fff" },
    ]);
  });

  test("reversing placed stops mirrors them rather than reordering colours", () => {
    expect(
      rampStops(
        [
          { position: 0, color: "#000" },
          { position: 0.1, color: "#f00" },
          { position: 1, color: "#fff" },
        ],
        true,
      ),
    ).toEqual([
      { position: 0, color: "#fff" },
      { position: 0.9, color: "#f00" },
      { position: 1, color: "#000" },
    ]);
  });

  test("returns nothing for an unknown ramp", () => {
    expect(rampStops("not-a-colormap")).toEqual([]);
    expect(rampStops(null)).toEqual([]);
    expect(rampStops([])).toEqual([]);
  });
});

test.describe("dynamicStyle - resolveDomain", () => {
  const stats = { value: { min: 10, max: 90, avg: 20, stddev: 5 } };

  test("a literal min/max is the domain", () => {
    const rule = numericRule({
      domain: { source: "literal", min: 1, max: 2 },
    });
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 1,
      max: 2,
    });
  });

  test("one literal end pins that end only", () => {
    const rule = numericRule({
      domain: { source: "literal", min: 0, max: null },
    });
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 0,
      max: 90,
    });
  });

  test("bounds left behind by another source are ignored", () => {
    // Configure only shows Data Min/Max for a literal domain, so numbers typed
    // before the source was changed must not pin a scale nobody can see.
    const rule = numericRule({
      domain: { source: "fieldStats", min: 1, max: 2 },
    });
    expect(resolveDomain(rule, { fieldStats: stats })).toEqual({
      min: 10,
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
    expect(resolveDomain(rule, { values: [3, 5] })).toEqual({
      min: 3,
      max: 5,
    });
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

  test("a group average is bounded by the field's whole-dataset extent", () => {
    // Its groups' averages in hand are 30-40, but an average anywhere in the
    // dataset lies within the field's own 10-90 - a scale that doesn't move.
    const rule = numericRule({
      propertyType: "stats",
      property: "value",
      stat: "avg",
      domain: { source: "auto" },
    });
    expect(
      resolveDomain(rule, { fieldStats: stats, values: [30, 40] }),
    ).toEqual({ min: 10, max: 90 });
  });

  test("a group spread is at widest half the field's extent", () => {
    const rule = numericRule({
      propertyType: "stats",
      property: "value",
      stat: "stddev",
      domain: { source: "auto" },
    });
    expect(resolveDomain(rule, { fieldStats: stats, values: [3, 4] })).toEqual({
      min: 0,
      max: 40,
    });
  });

  test("nothing stored bounds a group sum, so it is measured over the groups", () => {
    const rule = numericRule({
      propertyType: "stats",
      property: "value",
      stat: "sum",
      domain: { source: "auto" },
    });
    expect(
      resolveDomain(rule, { fieldStats: stats, values: [300, 400] }),
    ).toEqual({ min: 300, max: 400 });
  });

  test("following the view measures a group statistic over the groups in it", () => {
    const rule = numericRule({
      propertyType: "stats",
      property: "value",
      stat: "avg",
      domain: { source: "loaded" },
    });
    expect(
      resolveDomain(rule, { fieldStats: stats, values: [30, 40] }),
    ).toEqual({ min: 30, max: 40 });
  });

  test("a group statistic with no groups measured falls back to the field", () => {
    const rule = numericRule({
      propertyType: "stats",
      property: "value",
      stat: "avg",
      domain: { source: "auto" },
    });
    expect(resolveDomain(rule, { fieldStats: stats, values: [] })).toEqual({
      min: 10,
      max: 90,
    });
  });

  test("ignores field stats belonging to another property", () => {
    const rule = numericRule({
      property: "depth",
      domain: { source: "auto" },
    });
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

  test("divides it at the boundaries a rule moved instead", () => {
    expect(binEdges({ min: 0, max: 10 }, 2, [0.8])).toEqual([
      { min: 0, max: 8 },
      { min: 8, max: 10 },
    ]);
  });

  test("falls back to even bins when the boundaries do not describe them", () => {
    const even = binEdges({ min: 0, max: 10 }, 2);
    expect(binEdges({ min: 0, max: 10 }, 2, [0.3, 0.6])).toEqual(even);
    expect(binEdges({ min: 0, max: 10 }, 2, [1.5])).toEqual(even);
  });
});

test.describe("dynamicStyle - normalizeStops", () => {
  test("accepts increasing fractions inside the domain", () => {
    expect(normalizeStops([0.25, 0.5], 3)).toEqual([0.25, 0.5]);
    expect(normalizeStops(["0.5"], 2)).toEqual([0.5]);
  });

  test("rejects anything that would half-apply", () => {
    // Wrong count for the bins, out of order, or outside (0, 1) - each of
    // which describes a different set of bins than the one asked for.
    expect(normalizeStops([0.5], 3)).toBeNull();
    expect(normalizeStops([0.6, 0.4], 3)).toBeNull();
    expect(normalizeStops([0], 2)).toBeNull();
    expect(normalizeStops([1], 2)).toBeNull();
    expect(normalizeStops(["x"], 2)).toBeNull();
    expect(normalizeStops(null, 2)).toBeNull();
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

  test("a categorical rule with no mappings still counts - they may be derived", () => {
    expect(
      isUsableRule({
        property: "k",
        attribute: "color",
        type: "categorical",
      }),
    ).toBe(true);
  });

  test("a rule switched off is not styled by", () => {
    expect(isUsableRule(numericRule({ enabled: false }))).toBe(false);
    expect(isUsableRule(numericRule({ enabled: true }))).toBe(true);
    // Rules written before there was a switch are on.
    expect(isUsableRule(numericRule())).toBe(true);
  });
});

test.describe("dynamicStyle - styleableAttributes", () => {
  const categorical = (mappings) => ({
    property: "k",
    attribute: "fillColor",
    type: "categorical",
    mappings,
  });

  test("a numeric rule can be aimed at any of them", () => {
    expect(styleableAttributes(numericRule())).toEqual([
      "fillColor",
      "color",
      "fillOpacity",
      "opacity",
      "weight",
      "radius",
    ]);
  });

  test("a table of colours offers only the colours", () => {
    expect(
      styleableAttributes(categorical([{ value: "a", color: "#ff0000" }])),
    ).toEqual(["fillColor", "color"]);
  });

  test("a table of numbers offers only what takes a number", () => {
    expect(styleableAttributes(categorical([{ value: "a", to: 4 }]))).toEqual([
      "fillOpacity",
      "opacity",
      "weight",
      "radius",
    ]);
  });

  test("a table holding both offers both", () => {
    expect(
      styleableAttributes(
        categorical([{ value: "a", color: "#ff0000", to: 4 }]),
      ).length,
    ).toBe(6);
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

  test("a moved boundary changes which bin a value is in, not the colours", () => {
    const even = compileDynamicStyle({
      enabled: true,
      rules: [numericRule({ discrete: true, bins: 2 })],
    });
    const moved = compileDynamicStyle({
      enabled: true,
      rules: [numericRule({ discrete: true, bins: 2, stops: [0.8] })],
    });
    // 60 sat in the upper bin under an even split; it is in the lower one
    // now, and wearing the same colour that bin always had.
    expect(even({ value: 60 }).fillColor).toBe(even({ value: 90 }).fillColor);
    expect(moved({ value: 60 }).fillColor).toBe(even({ value: 10 }).fillColor);
    expect(moved({ value: 90 }).fillColor).toBe(even({ value: 90 }).fillColor);
  });

  test("a numeric range bins the same way", () => {
    const resolve = compileDynamicStyle({
      enabled: true,
      rules: [
        numericRule({
          attribute: "weight",
          range: [1, 5],
          discrete: true,
          bins: 2,
          stops: [0.8],
        }),
      ],
    });
    expect(resolve({ value: 60 }).weight).toBe(2);
    expect(resolve({ value: 90 }).weight).toBe(4);
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
      compileDynamicStyle({ enabled: true, rules: withNull })({
        other: 1,
      }).fillColor,
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

test.describe("dynamicStyle - derived categories", () => {
  const features = [
    { properties: { kind: "trail" } },
    { properties: { kind: "road" } },
    { properties: { kind: "trail" } },
  ];

  test("names the distinct values a property takes", () => {
    expect(collectCategories(features, "kind")).toEqual(["road", "trail"]);
  });

  test("names none for a field with more values than categories", () => {
    const many = [];
    for (let i = 0; i < 30; i++) many.push({ properties: { kind: `k${i}` } });
    expect(collectCategories(many, "kind")).toEqual([]);
  });

  test("a rule aimed at a text field maps its values across the ramp", () => {
    const resolve = compileDynamicStyle(
      {
        enabled: true,
        rules: [numericRule({ property: "kind" })],
      },
      { values: [], categories: collectCategories(features, "kind") },
    );
    expect(resolve({ kind: "road" }).fillColor).toBe("#000000");
    expect(resolve({ kind: "trail" }).fillColor).toBe("#ffffff");
    expect(resolve({ kind: "river" })).toBeNull();
  });

  test("a numeric attribute spreads its range over them instead", () => {
    const resolve = compileDynamicStyle(
      {
        enabled: true,
        rules: [
          numericRule({
            property: "kind",
            attribute: "weight",
            range: [1, 5],
          }),
        ],
      },
      { values: [], categories: collectCategories(features, "kind") },
    );
    expect(resolve({ kind: "road" }).weight).toBe(1);
    expect(resolve({ kind: "trail" }).weight).toBe(5);
  });

  test("written mappings are kept over derived ones", () => {
    const written = {
      property: "kind",
      attribute: "color",
      type: "categorical",
      mappings: [{ value: "trail", color: "#33cc33" }],
    };
    const resolve = compileDynamicStyle(
      { enabled: true, rules: [written] },
      { values: [], categories: ["trail", "road", "river"] },
    );
    expect(resolve({ kind: "trail" }).color).toBe("#33cc33");
    expect(resolve({ kind: "river" })).toBeNull();
  });

  test("a property whose values are numbers is still a scale", () => {
    const resolve = compileDynamicStyle(
      { enabled: true, rules: [numericRule()] },
      { values: [0, 100], categories: ["0", "100"] },
    );
    expect(resolve({ value: 50 }).fillColor).toBe("rgb(128, 128, 128)");
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

  test("a stats rule reads the group statistic it names", () => {
    const rule = numericRule({
      propertyType: "stats",
      property: "depth_m",
      stat: "max",
    });
    expect(rulePropertyPath(rule)).toBe("_.stats.depth_m.max");
    expect(rulePropertyLabel(rule)).toBe("depth_m (group max)");
    const resolve = compileDynamicStyle({ enabled: true, rules: [rule] });
    expect(
      resolve({ depth_m: 0, _: { stats: { depth_m: { max: 100 } } } }),
    ).toEqual({ fillColor: "#ffffff" });
  });

  test("a stats rule averages by default", () => {
    expect(
      rulePropertyPath({ propertyType: "stats", property: "depth_m" }),
    ).toBe("_.stats.depth_m.avg");
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
