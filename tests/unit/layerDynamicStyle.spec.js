import { test, expect } from "@playwright/test";
import {
  compileLayerDynamicStyle,
  getDynamicStyle,
  getDynamicStyleProps,
  getLayerDynamicStyleResolver,
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
      getDynamicStyle({ variables: { dynamicStyle: { rules: [rule()] } } }),
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
