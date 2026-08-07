import { test, expect } from "@playwright/test";
import {
  addDynamicStyleRule,
  applyDynamicStyleToGeoJSON,
  compileLayerDynamicStyle,
  getDynamicStyle,
  getDomainMode,
  getDynamicStyleOverride,
  getDynamicStyleProps,
  getLayerDynamicStyleResolver,
  getStatsFields,
  getViewedRules,
  overrideDynamicStyleRule,
  removeDynamicStyleRule,
  setDynamicStyleOverride,
} from "../../src/essence/Basics/Layers_/render/layerDynamicStyle.js";

/**
 * layerDynamicStyle unit tests — gathering a layer's config, features and
 * stored statistics into one compiled resolver.
 */

const rule = (over) =>
  Object.assign(
    {
      property: "value",
      attribute: "fillColor",
      type: "numeric",
      ramp: ["#000000", "#ffffff"],
      domain: { source: "auto" },
    },
    over,
  );

const layerWith = (rules, extra) =>
  Object.assign(
    { variables: { dynamicStyle: { enabled: true, rules } } },
    extra,
  );

const featuresOf = (...values) =>
  values.map((value) => ({ properties: { value } }));

test.describe("layerDynamicStyle - getDynamicStyle", () => {
  test("returns the configuration when it has a usable rule", () => {
    expect(getDynamicStyle(layerWith([rule()]))).not.toBeNull();
  });

  test("returns null when disabled, absent or unusable", () => {
    expect(getDynamicStyle(null)).toBeNull();
    expect(getDynamicStyle({})).toBeNull();
    expect(
      getDynamicStyle({
        variables: { dynamicStyle: { rules: [rule()] } },
      }),
    ).toBeNull();
    expect(getDynamicStyle(layerWith([{ property: "" }]))).toBeNull();
  });
});

test.describe("layerDynamicStyle - getDynamicStyleProps", () => {
  test("names the properties the layer cannot be styled without", () => {
    const layer = layerWith([rule(), rule({ property: "depth" })]);
    expect(getDynamicStyleProps(layer)).toEqual(["value", "depth"]);
  });

  test("names nothing for a layer with no dynamic style", () => {
    expect(getDynamicStyleProps({})).toEqual([]);
  });
});

test.describe("layerDynamicStyle - compileLayerDynamicStyle", () => {
  test("measures the domain over the features it is given", () => {
    const layer = layerWith([rule()]);
    const resolve = compileLayerDynamicStyle(layer, featuresOf(0, 10));
    expect(resolve({ value: 0 }).fillColor).toBe("#000000");
    expect(resolve({ value: 10 }).fillColor).toBe("#ffffff");
  });

  test("prefers a geodataset stored statistics over the loaded features", () => {
    const layer = layerWith([rule()], {
      _fieldStats: { value: { min: 0, max: 100 } },
    });
    const resolve = compileLayerDynamicStyle(layer, featuresOf(0, 10));
    // 10 of 0..100 is dark; it would be white over the loaded 0..10.
    expect(resolve({ value: 10 }).fillColor).not.toBe("#ffffff");
    expect(resolve({ value: 100 }).fillColor).toBe("#ffffff");
  });

  test("recompiling with different features moves the domain", () => {
    const layer = layerWith([rule()]);
    compileLayerDynamicStyle(layer, featuresOf(0, 10));
    const resolve = compileLayerDynamicStyle(layer, featuresOf(0, 1000));
    expect(resolve({ value: 10 }).fillColor).not.toBe("#ffffff");
  });

  test("each rule measures its own property", () => {
    const layer = layerWith([
      rule(),
      rule({ property: "depth", attribute: "weight", range: [0, 10] }),
    ]);
    const features = [
      { properties: { value: 0, depth: 100 } },
      { properties: { value: 10, depth: 200 } },
    ];
    const resolve = compileLayerDynamicStyle(layer, features);
    expect(resolve({ value: 10, depth: 150 })).toEqual({
      fillColor: "#ffffff",
      weight: 5,
    });
  });

  test("caches the resolver on the layer, and clears it when unconfigured", () => {
    const layer = layerWith([rule()]);
    const resolve = compileLayerDynamicStyle(layer, featuresOf(0, 10));
    expect(getLayerDynamicStyleResolver(layer)).toBe(resolve);

    layer.variables.dynamicStyle.enabled = false;
    expect(compileLayerDynamicStyle(layer, featuresOf(0, 10))).toBeNull();
    expect(getLayerDynamicStyleResolver(layer)).toBeNull();
  });

  test("a layer with nothing to measure compiles to nothing", () => {
    expect(compileLayerDynamicStyle(layerWith([rule()]), [])).toBeNull();
    expect(compileLayerDynamicStyle(null, [])).toBeNull();
  });
});

test.describe("layerDynamicStyle - applyDynamicStyleToGeoJSON", () => {
  const collectionOf = (...features) => ({
    type: "FeatureCollection",
    features,
  });

  test("writes the style the globe reads, without touching the original", () => {
    const layer = layerWith([rule()]);
    const original = collectionOf(...featuresOf(0, 10));
    const styled = applyDynamicStyleToGeoJSON(layer, original);

    expect(styled.features[1].properties.style).toEqual({
      fillColor: "#ffffff",
    });
    expect(original.features[1].properties.style).toBeUndefined();
    expect(original.features[1].properties.value).toBe(10);
  });

  test("a feature's own style wins, as it does in 2D", () => {
    const layer = layerWith([rule()]);
    const styled = applyDynamicStyleToGeoJSON(
      layer,
      collectionOf({
        properties: { value: 10, style: { fillColor: "#ff0000" } },
      }),
    );
    expect(styled.features[0].properties.style.fillColor).toBe("#ff0000");
  });

  test("a partial feature style overrides only what it names", () => {
    const layer = layerWith([rule()]);
    const styled = applyDynamicStyleToGeoJSON(
      layer,
      collectionOf(featuresOf(0, 10)[0], {
        properties: { value: 10, style: { radius: 12 } },
      }),
    );
    expect(styled.features[1].properties.style).toEqual({
      fillColor: "#ffffff",
      radius: 12,
    });
  });

  test("uses the resolver 2D compiled, so the views agree", () => {
    const layer = layerWith([rule()]);
    // 2D measured 0..100; the globe is handed only part of that.
    compileLayerDynamicStyle(layer, featuresOf(0, 100));
    const styled = applyDynamicStyleToGeoJSON(
      layer,
      collectionOf(...featuresOf(0, 10)),
    );
    expect(styled.features[1].properties.style.fillColor).not.toBe("#ffffff");
  });

  test("a layer with no dynamic style is handed back untouched", () => {
    const geojson = collectionOf(...featuresOf(0, 10));
    expect(applyDynamicStyleToGeoJSON({}, geojson)).toBe(geojson);
    expect(applyDynamicStyleToGeoJSON({}, null)).toBeNull();
  });

  test("a feature whose property is missing keeps its own look", () => {
    const layer = layerWith([rule()]);
    const styled = applyDynamicStyleToGeoJSON(
      layer,
      collectionOf(...featuresOf(0, 10), { properties: { other: 1 } }),
    );
    expect(styled.features[2].properties.style).toBeUndefined();
  });

  test("a feature with no properties at all doesn't stop the layer drawing", () => {
    const layer = layerWith([rule({ nullValue: "#666666" })]);
    const styled = applyDynamicStyleToGeoJSON(
      layer,
      collectionOf(...featuresOf(0, 10), { type: "Feature" }),
    );
    expect(styled.features[2].properties.style).toEqual({
      fillColor: "#666666",
    });
  });

  test("a layer 2D never drew measures the geojson it is handed", () => {
    const layer = layerWith([rule()]);
    const styled = applyDynamicStyleToGeoJSON(
      layer,
      collectionOf(...featuresOf(0, 10)),
    );
    expect(styled.features[1].properties.style.fillColor).toBe("#ffffff");
    expect(getLayerDynamicStyleResolver(layer)).not.toBeNull();
  });
});

test.describe("layerDynamicStyle - session overrides", () => {
  test("an unconfigured layer follows the whole dataset", () => {
    expect(getDomainMode(layerWith([rule()]))).toBe("dataset");
  });

  test("a rule configured to measure what's loaded starts on the current view", () => {
    expect(
      getDomainMode(layerWith([rule({ domain: { source: "loaded" } })])),
    ).toBe("view");
  });

  test("the domain toggle wins over the configuration, and moves every rule", () => {
    const layer = layerWith([
      rule(),
      rule({ attribute: "weight", range: [1, 8] }),
    ]);
    setDynamicStyleOverride(layer, { domain: "view" });
    expect(getDomainMode(layer)).toBe("view");
    expect(getDynamicStyle(layer).rules.map((r) => r.domain.source)).toEqual([
      "loaded",
      "loaded",
    ]);
  });

  test("back at the whole dataset, a rule is measured however it was written", () => {
    const layer = layerWith([
      rule({ domain: { source: "stddev", sigma: 2 } }),
      rule({ attribute: "weight", domain: { source: "loaded" } }),
    ]);
    setDynamicStyleOverride(layer, { domain: "view" });
    setDynamicStyleOverride(layer, { domain: "dataset" });
    expect(getDynamicStyle(layer).rules.map((r) => r.domain.source)).toEqual([
      "stddev",
      "auto",
    ]);
  });

  test("a switched property and ramp restyle the map, and the config is untouched", () => {
    const layer = layerWith([rule()]);
    setDynamicStyleOverride(layer, { property: "other", ramp: "viridis" });
    const resolve = compileLayerDynamicStyle(
      layer,
      [0, 10].map((other) => ({ properties: { other } })),
    );
    expect(resolve({ other: 0 })).not.toBeNull();
    expect(resolve({ value: 0 })).toBeNull();
    expect(layer.variables.dynamicStyle.rules[0].property).toBe("value");
  });

  test("only the first rule follows the property switcher", () => {
    const layer = layerWith([
      rule(),
      rule({
        property: "confidence",
        attribute: "weight",
        range: [1, 8],
      }),
    ]);
    setDynamicStyleOverride(layer, { property: "other" });
    expect(getDynamicStyle(layer).rules.map((r) => r.property)).toEqual([
      "other",
      "confidence",
    ]);
  });

  test("overrides merge rather than replace, and clear together", () => {
    const layer = layerWith([rule()]);
    setDynamicStyleOverride(layer, { ramp: "plasma" });
    setDynamicStyleOverride(layer, { domain: "view" });
    expect(getDynamicStyleOverride(layer)).toEqual({
      ramp: "plasma",
      domain: "view",
    });
    setDynamicStyleOverride(layer, null);
    expect(getDynamicStyleOverride(layer)).toBeNull();
    expect(getDomainMode(layer)).toBe("dataset");
  });

  test("a viewer can aim the first rule at another style attribute", () => {
    const layer = layerWith([rule({ domain: { min: 0, max: 100 } })]);
    setDynamicStyleOverride(layer, {
      attribute: "weight",
      range: [1, 9],
    });
    const resolve = compileLayerDynamicStyle(layer, []);
    expect(resolve({ value: 0 })).toEqual({ weight: 1 });
    expect(resolve({ value: 100 })).toEqual({ weight: 9 });
  });

  test("binning it discretely gives a value one of that many colours", () => {
    const layer = layerWith([rule({ domain: { min: 0, max: 100 } })]);
    setDynamicStyleOverride(layer, { discrete: true, bins: 2 });
    const resolve = compileLayerDynamicStyle(layer, []);
    expect(resolve({ value: 10 }).fillColor).toBe(
      resolve({ value: 40 }).fillColor,
    );
    expect(resolve({ value: 10 }).fillColor).not.toBe(
      resolve({ value: 90 }).fillColor,
    );
  });

  test("dragged bin boundaries apply, and are dropped when the count changes", () => {
    const layer = layerWith([rule({ domain: { min: 0, max: 100 } })]);
    setDynamicStyleOverride(layer, {
      discrete: true,
      bins: 2,
      stops: [0.8],
    });
    let resolve = compileLayerDynamicStyle(layer, []);
    expect(resolve({ value: 60 }).fillColor).toBe(
      resolve({ value: 10 }).fillColor,
    );

    setDynamicStyleOverride(layer, { bins: 4, stops: null });
    resolve = compileLayerDynamicStyle(layer, []);
    expect(resolve({ value: 60 }).fillColor).not.toBe(
      resolve({ value: 10 }).fillColor,
    );
  });
});

test.describe("layerDynamicStyle - session rules", () => {
  test("a rule other than the first can be re-aimed", () => {
    const layer = layerWith([
      rule(),
      rule({ property: "confidence", attribute: "weight", range: [1, 8] }),
    ]);
    overrideDynamicStyleRule(layer, 1, { property: "depth" });
    expect(getDynamicStyle(layer).rules.map((r) => r.property)).toEqual([
      "value",
      "depth",
    ]);
    expect(
      layer.variables.dynamicStyle.rules.map((r) => r.property),
    ).toEqual(["value", "confidence"]);
  });

  test("a viewer can add a rule and remove one, for the session only", () => {
    const layer = layerWith([rule({ domain: { min: 0, max: 100 } })]);
    addDynamicStyleRule(layer, { attribute: "weight", range: [1, 9] });
    let resolve = compileLayerDynamicStyle(layer, []);
    expect(resolve({ value: 100 })).toEqual({
      fillColor: "#ffffff",
      weight: 9,
    });

    removeDynamicStyleRule(layer, 0);
    resolve = compileLayerDynamicStyle(layer, []);
    expect(resolve({ value: 100 })).toEqual({ weight: 9 });
    expect(layer.variables.dynamicStyle.rules).toHaveLength(1);

    setDynamicStyleOverride(layer, null);
    expect(getViewedRules(layer)).toHaveLength(1);
    expect(getViewedRules(layer)[0].attribute).toBe("fillColor");
  });

  test("the domain toggle still moves every rule, added ones included", () => {
    const layer = layerWith([rule({ domain: { source: "stddev", sigma: 2 } })]);
    addDynamicStyleRule(layer, { attribute: "weight", range: [1, 9] });
    setDynamicStyleOverride(layer, { domain: "view" });
    expect(getDynamicStyle(layer).rules.map((r) => r.domain.source)).toEqual([
      "loaded",
      "loaded",
    ]);

    // And back: a rule is measured however it was written again.
    setDynamicStyleOverride(layer, { domain: "dataset" });
    expect(getDynamicStyle(layer).rules.map((r) => r.domain.source)).toEqual([
      "stddev",
      "stddev",
    ]);
  });
});

test.describe("layerDynamicStyle - getStatsFields", () => {
  test("asks for the group statistics a rule is aimed at", () => {
    const layer = layerWith([rule({ property: "_.stats.depth_m.avg" })]);
    expect(getStatsFields(layer)).toEqual(["depth_m"]);
  });

  test("asks for what an admin listed too, without asking twice", () => {
    const layer = layerWith([rule({ property: "_.stats.depth_m.avg" })], {
      variables: {
        statsFields: "depth_m, temp_c",
        dynamicStyle: {
          enabled: true,
          rules: [rule({ property: "_.stats.depth_m.avg" })],
        },
      },
    });
    expect(getStatsFields(layer)).toEqual(["depth_m", "temp_c"]);
  });

  test("asks for nothing when no rule and no admin wants statistics", () => {
    expect(getStatsFields(layerWith([rule()]))).toEqual([]);
    expect(getStatsFields({})).toEqual([]);
  });
});
