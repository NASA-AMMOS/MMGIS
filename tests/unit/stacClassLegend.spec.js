import { test, expect } from "@playwright/test";
import {
  hasConfiguredLegend,
  wantsStacClassLegend,
  stacCollectionUrl,
  findClasses,
  classesToLegend,
  loadStacClasses,
  clearStacClassCache,
} from "../../src/essence/Basics/Layers_/legend/stacClassLegend.js";
import { resolveLegendLabel } from "../../plugins/core/tools/Legend/legendHighlight.js";

/**
 * stacClassLegend unit tests — a classified raster's legend is read from its
 * STAC collection's `classification:classes`.
 */

const LOCATION = { origin: "http://localhost:8888", pathname: "/mmgis/" };

const CLASSES = [
  { value: 1, name: "water", title: "Water", color_hint: "0000ff" },
  { value: 2, name: "forest", description: "Forest", color_hint: "00A000" },
  { value: 3, name: "urban" },
  { value: 255, name: "nodata", nodata: true },
];

const response = (body, ok = true) => ({ ok, json: async () => body });

test.describe("wantsStacClassLegend", () => {
  test("a stac-collection layer with no legend configured", () => {
    expect(wantsStacClassLegend({ url: "stac-collection:lulc" })).toBe(true);
    expect(wantsStacClassLegend({ url: "STAC-COLLECTION:lulc", variables: { legend: [] } })).toBe(true);
    expect(wantsStacClassLegend({ url: "stac-collection:lulc", legend: "" })).toBe(true);
  });

  test("not other urls", () => {
    expect(wantsStacClassLegend({ url: "COG:Data/a.tif" })).toBe(false);
    expect(wantsStacClassLegend({ url: "Layers/{z}/{x}/{y}.png" })).toBe(false);
    expect(wantsStacClassLegend({})).toBe(false);
    expect(wantsStacClassLegend(null)).toBe(false);
  });

  test("a configured legend or a rescaled colormap takes precedence", () => {
    const url = "stac-collection:lulc";
    expect(wantsStacClassLegend({ url, legend: "Layers/legend.csv" })).toBe(false);
    expect(wantsStacClassLegend({ url, variables: { legend: [{ value: "a" }] } })).toBe(false);
    expect(wantsStacClassLegend({ url, cogTransform: true })).toBe(false);
  });
});

test.describe("hasConfiguredLegend", () => {
  test("a legend file or written entries", () => {
    expect(hasConfiguredLegend({ legend: "Layers/legend.csv" })).toBe(true);
    expect(hasConfiguredLegend({ variables: { legend: [{ value: "a" }] } })).toBe(true);
    expect(hasConfiguredLegend({ legend: "", variables: { legend: [] } })).toBe(false);
    expect(hasConfiguredLegend({})).toBe(false);
    expect(hasConfiguredLegend(null)).toBe(false);
  });
});

test.describe("stacCollectionUrl", () => {
  test("a local collection is behind this site's /stac proxy", () => {
    expect(stacCollectionUrl("stac-collection:lulc", LOCATION)).toBe(
      "http://localhost:8888/mmgis/stac/collections/lulc"
    );
    expect(stacCollectionUrl("stac-collection:lulc?bidx=1", { origin: "https://a.org", pathname: "" })).toBe(
      "https://a.org/stac/collections/lulc"
    );
  });

  test("an external collection's /stac sits beside its /titilerpgstac", () => {
    expect(
      stacCollectionUrl("stac-collection:https://b.org/mmgis/titilerpgstac/collections/lulc?x=1", LOCATION)
    ).toBe("https://b.org/mmgis/stac/collections/lulc");
  });

  test("null for anything that isn't a collection url", () => {
    expect(stacCollectionUrl("COG:a.tif", LOCATION)).toBeNull();
    expect(stacCollectionUrl("stac-collection:", LOCATION)).toBeNull();
    expect(stacCollectionUrl(undefined, LOCATION)).toBeNull();
  });
});

test.describe("findClasses", () => {
  const other = [{ value: 9, name: "other" }];

  test("the rendered band's classes come first", () => {
    const collection = {
      item_assets: {
        asset: {
          "classification:classes": other,
          bands: [{ "classification:classes": other }, { "classification:classes": CLASSES }],
        },
      },
    };
    expect(findClasses(collection, 2)).toBe(CLASSES);
    expect(findClasses(collection, 1)).toBe(other);
    // No such band: the asset's own.
    expect(findClasses(collection, 5)).toBe(other);
  });

  test("raster:bands, the asset, another asset, then summaries", () => {
    expect(
      findClasses({ item_assets: { asset: { "raster:bands": [{ "classification:classes": CLASSES }] } } })
    ).toBe(CLASSES);
    expect(findClasses({ item_assets: { asset: { "classification:classes": CLASSES } } })).toBe(CLASSES);
    expect(
      findClasses({ item_assets: { asset: {}, data: { "classification:classes": CLASSES } } })
    ).toBe(CLASSES);
    expect(findClasses({ item_assets: {}, summaries: { "classification:classes": CLASSES } })).toBe(CLASSES);
  });

  test("null when the collection lists none", () => {
    expect(findClasses({ item_assets: { asset: { "classification:classes": [] } } })).toBeNull();
    expect(findClasses({ id: "lulc" })).toBeNull();
    expect(findClasses(null)).toBeNull();
  });
});

test.describe("classesToLegend", () => {
  test("one entry per class, labeled and colored from the class", () => {
    expect(classesToLegend(CLASSES)).toEqual([
      { color: "#0000ff", strokecolor: null, shape: "square", value: "Water", propertyValue: 1 },
      { color: "#00A000", strokecolor: null, shape: "square", value: "Forest", propertyValue: 2 },
      { color: "transparent", strokecolor: "var(--color-a4)", shape: "square", value: "urban", propertyValue: 3 },
    ]);
  });

  test("the layer's color table is how a class is actually drawn", () => {
    const table = { 1: [10, 20, 30, 255], 2: [0, 0, 0, 0], 3: [1, 2, 3] };
    const legend = classesToLegend(CLASSES, JSON.stringify(table));
    expect(legend.map((e) => [e.value, e.color])).toEqual([
      ["Water", "rgba(10,20,30,1)"],
      // Forest is fully transparent in the table, so it is not shown.
      ["urban", "rgba(1,2,3,1)"],
    ]);
  });

  test("an interval color table or a bad one falls back to the hints", () => {
    expect(classesToLegend(CLASSES, [[[0, 2], [1, 1, 1, 255]]])[0].color).toBe("#0000ff");
    expect(classesToLegend(CLASSES, "{not json")[0].color).toBe("#0000ff");
  });

  test("skips what can't be an entry", () => {
    expect(
      classesToLegend([null, { name: "no value" }, { value: "1", name: "text value" }, { value: 4, color_hint: "zzz" }])
    ).toEqual([
      { color: "transparent", strokecolor: "var(--color-a4)", shape: "square", value: "4", propertyValue: 4 },
    ]);
    expect(classesToLegend([{ value: 0, nodata: true }])).toBeNull();
    expect(classesToLegend(undefined)).toBeNull();
  });

  test("the Identifier can name a pixel value from it", () => {
    const legend = classesToLegend(CLASSES);
    expect(resolveLegendLabel(legend, 2)).toEqual({ label: "Forest", color: "#00A000" });
    expect(resolveLegendLabel(legend, 7)).toBeNull();
  });
});

test.describe("loadStacClasses", () => {
  test.beforeEach(() => clearStacClassCache());

  const collection = { item_assets: { asset: { "classification:classes": CLASSES } } };

  test("fetches the collection and returns its classes", async () => {
    const asked = [];
    const fetch = async (url) => {
      asked.push(url);
      return response(collection);
    };
    const classes = await loadStacClasses({ url: "stac-collection:lulc" }, { fetch, location: LOCATION });
    expect(classes).toBe(CLASSES);
    expect(asked).toEqual(["http://localhost:8888/mmgis/stac/collections/lulc"]);
  });

  test("layers sharing a collection ask for it once", async () => {
    let count = 0;
    const fetch = async () => {
      count++;
      return response({
        item_assets: {
          asset: { bands: [{ "classification:classes": CLASSES }, { "classification:classes": [{ value: 7, name: "b2" }] }] },
        },
      });
    };
    const [a, b] = await Promise.all([
      loadStacClasses({ url: "stac-collection:lulc" }, { fetch, location: LOCATION }),
      loadStacClasses({ url: "stac-collection:lulc?x=1", cogBands: [2] }, { fetch, location: LOCATION }),
    ]);
    expect(count).toBe(1);
    expect(a).toBe(CLASSES);
    expect(b).toEqual([{ value: 7, name: "b2" }]);
  });

  test("null, not an error, when there is nothing to read", async () => {
    const options = (fetch) => ({ fetch, location: LOCATION });
    expect(await loadStacClasses({ url: "stac-collection:a" }, options(async () => response({}, false)))).toBeNull();
    expect(await loadStacClasses({ url: "stac-collection:b" }, options(async () => response({ id: "b" })))).toBeNull();
    expect(
      await loadStacClasses({ url: "stac-collection:c" }, options(async () => { throw new Error("offline"); }))
    ).toBeNull();
    expect(await loadStacClasses({ url: "COG:a.tif" }, options(async () => response(collection)))).toBeNull();
  });
});
