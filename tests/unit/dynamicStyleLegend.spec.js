import { test, expect } from "@playwright/test";
import {
  dynamicStyleLegendEntries,
  formatValue,
} from "../../src/essence/Basics/Layers_/render/dynamicStyleLegend.js";
import { compileLayerDynamicStyle } from "../../src/essence/Basics/Layers_/render/layerDynamicStyle.js";

/**
 * dynamicStyleLegend unit tests — the legend describes the style, and is
 * coloured by the same resolver the features are.
 */

const numericRule = (over) =>
  Object.assign(
    {
      property: "value",
      attribute: "fillColor",
      type: "numeric",
      ramp: ["#000000", "#ffffff"],
      domain: { min: 0, max: 100 },
    },
    over,
  );

const layerWith = (rules) => ({
  variables: { dynamicStyle: { enabled: true, rules } },
});

test.describe("dynamicStyleLegend - formatValue", () => {
  test("keeps numbers short enough to sit beside a swatch", () => {
    expect(formatValue(0)).toBe("0");
    expect(formatValue(1013.2)).toBe("1013");
    expect(formatValue(12.53)).toBe("12.5");
    expect(formatValue(0.0021)).toBe("0.002");
    expect(formatValue(0.0000021)).toBe("2.1e-6");
    expect(formatValue(21000000)).toBe("2.1e7");
    expect(formatValue(NaN)).toBe("");
  });
});

test.describe("dynamicStyleLegend - dynamicStyleLegendEntries", () => {
  test("a continuous rule becomes a scale, highest value first", () => {
    const entries = dynamicStyleLegendEntries(layerWith([numericRule()]));
    expect(entries.length).toBe(9);
    expect(entries.every((e) => e.shape === "continuous")).toBe(true);
    expect(entries[0].value).toBe("100");
    expect(entries[0].color).toBe("#ffffff");
    expect(entries[entries.length - 1].value).toBe("0");
    expect(entries[entries.length - 1].color).toBe("#000000");
  });

  test("the scale is titled with the property it describes", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([numericRule({ property: "meta.reading.value" })]),
    );
    expect(entries[0].scaleTitle).toBe("meta.reading.value");
    expect(entries[1].scaleTitle).toBeUndefined();
  });

  test("a discrete rule becomes one swatch per bin, labelled by its edges", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([numericRule({ discrete: true, bins: 4 })]),
    );
    expect(entries.length).toBe(4);
    expect(entries.every((e) => e.shape === "discreet")).toBe(true);
    expect(entries[0].value).toBe("75 – 100");
    expect(entries[3].value).toBe("0 – 25");
  });

  test("moved bin boundaries are the ones the legend labels", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([numericRule({ discrete: true, bins: 2, stops: [0.8] })]),
    );
    expect(entries.map((e) => e.value)).toEqual(["80 – 100", "0 – 80"]);
  });

  test("a categorical rule becomes one swatch per mapping, the later of a repeat winning as it does on the map", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([
        {
          property: "reading_type",
          attribute: "fillColor",
          type: "categorical",
          mappings: [
            { value: "trail", color: "#33cc33" },
            { value: "zone", color: "#3333cc", label: "Zone" },
            { value: "trail", color: "#ff0000" },
          ],
        },
      ]),
    );
    expect(entries.map((e) => [e.value, e.color])).toEqual([
      ["trail", "#ff0000"],
      ["Zone", "#3333cc"],
    ]);
    expect(entries[0].scaleTitle).toBe("reading_type");
  });

  test("shows the domain the features were coloured over, not the configured one", () => {
    const layer = layerWith([numericRule({ domain: { source: "loaded" } })]);
    compileLayerDynamicStyle(layer, [
      { properties: { value: 5 } },
      { properties: { value: 45 } },
    ]);
    const entries = dynamicStyleLegendEntries(layer);
    expect(entries[0].value).toBe("45");
    expect(entries[entries.length - 1].value).toBe("5");
  });

  test("drawing a legend leaves the renderers compiled style alone", () => {
    const layer = layerWith([numericRule()]);
    compileLayerDynamicStyle(layer, [{ properties: { value: 5 } }]);
    const compiled = layer._dynamicStyleRules;
    const resolver = layer._dynamicStyleResolver;

    dynamicStyleLegendEntries(layerWith([numericRule()]));
    dynamicStyleLegendEntries(layer);

    expect(layer._dynamicStyleRules).toBe(compiled);
    expect(layer._dynamicStyleResolver).toBe(resolver);
  });

  test("a weight rule is drawn as lines of that weight, titled by attribute", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([numericRule({ attribute: "weight", range: [1, 5] })]),
    );
    expect(entries.length).toBe(5);
    expect(entries.every((e) => e.shape === "rect")).toBe(true);
    // Highest value first, as a colour scale is.
    expect(entries.map((e) => [e.value, e.swatchHeight])).toEqual([
      ["100", 5],
      ["75", 4],
      ["50", 3],
      ["25", 2],
      ["0", 1],
    ]);
    expect(entries[0].scaleTitle).toBe("value (Weight)");
  });

  test("an opacity rule fades its swatches instead of colouring them", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([numericRule({ attribute: "fillOpacity", range: [0, 1] })]),
    );
    expect(entries.every((e) => e.shape === "square")).toBe(true);
    expect(entries.map((e) => e.swatchOpacity)).toEqual([1, 0.75, 0.5, 0.25, 0]);
    expect(entries[0].scaleTitle).toBe("value (Fill Opacity)");
  });

  test("a discrete radius rule keeps its bin labels", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([
        numericRule({
          attribute: "radius",
          range: [2, 8],
          discrete: true,
          bins: 2,
        }),
      ]),
    );
    expect(entries.map((e) => [e.value, e.shape, e.swatchSize])).toEqual([
      ["50 – 100", "circle", 13],
      ["0 – 50", "circle", 7],
    ]);
  });

  test("a colour rule and a weight rule are two scales, not one", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([
        numericRule({ attribute: "weight", range: [1, 5] }),
        numericRule(),
      ]),
    );
    expect(entries.length).toBe(14);
    expect(entries[0].scaleTitle).toBe("value (Weight)");
    expect(entries[5].scaleTitle).toBe("value");
  });

  test("two colour rules each get their own titled scale", () => {
    const entries = dynamicStyleLegendEntries(
      layerWith([
        numericRule(),
        numericRule({ property: "depth", attribute: "color" }),
      ]),
    );
    expect(entries.length).toBe(18);
    expect(entries[0].scaleTitle).toBe("value");
    expect(entries[9].scaleTitle).toBe("depth");
  });

  test("a layer with no usable dynamic style describes nothing", () => {
    expect(dynamicStyleLegendEntries({})).toEqual([]);
    expect(
      dynamicStyleLegendEntries(
        layerWith([numericRule({ domain: { source: "loaded" } })]),
      ),
    ).toEqual([]);
  });
});

test.describe("a configured legend beside a dynamic one", () => {
  const fs = require("fs");
  const path = require("path");
  const SRC = fs.readFileSync(
    path.resolve(__dirname, "../../plugins/core/tools/Legend/LegendTool.js"),
    "utf8",
  );

  test("an image legend is still drawn when the layer also has a scale", () => {
    // A string _legend is an image the admin configured; the scale is drawn
    // as well as it, never instead of it.
    expect(SRC).toContain(
      "if (typeof configured === 'string' && dynamicEntries.length > 0) {",
    );
  });
});
