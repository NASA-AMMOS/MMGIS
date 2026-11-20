import { test, expect } from "@playwright/test";
import {
  parseNpy,
  distinctValues,
  entriesInView,
  sampleSize,
  viewValuesUrl,
} from "../../plugins/core/tools/Legend/legendInView.js";

/**
 * legendInView unit tests — the Legend narrows a class raster's entries to the
 * classes under the current view, read from TiTiler as a thumbnail of values.
 */

/** A .npy file as numpy writes it (version 1, little-endian, C order). */
function npy(descr, shape, values, TypedArray) {
  let header = `{'descr': '${descr}', 'fortran_order': False, 'shape': (${shape.join(", ")}${
    shape.length === 1 ? "," : ""
  }), }`;
  while ((10 + header.length + 1) % 64 !== 0) header += " ";
  header += "\n";
  const data = new TypedArray(values);
  const out = new Uint8Array(10 + header.length + data.byteLength);
  out.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]);
  new DataView(out.buffer).setUint16(8, header.length, true);
  for (let i = 0; i < header.length; i++) out[10 + i] = header.charCodeAt(i);
  out.set(new Uint8Array(data.buffer), 10 + header.length);
  return out.buffer;
}

const LOCATION = { origin: "http://localhost:8888", pathname: "/" };
const BOUNDS = { west: -117.7, south: 36.85, east: -117.15, north: 37.4 };

test.describe("parseNpy", () => {
  test("reads the shape and the values", () => {
    const parsed = parseNpy(npy("<u2", [2, 2, 2], [4, 7, 7, 300, 65535, 65535, 0, 65535], Uint16Array));
    expect(parsed.shape).toEqual([2, 2, 2]);
    expect(Array.from(parsed.data)).toEqual([4, 7, 7, 300, 65535, 65535, 0, 65535]);
  });

  test("reads other pixel types", () => {
    expect(Array.from(parseNpy(npy("|u1", [1, 1, 3], [1, 2, 3], Uint8Array)).data)).toEqual([1, 2, 3]);
    expect(Array.from(parseNpy(npy("<f4", [1, 1, 2], [1.5, -2], Float32Array)).data)).toEqual([1.5, -2]);
    expect(Array.from(parseNpy(npy("<i2", [1, 1, 2], [-5, 5], Int16Array)).data)).toEqual([-5, 5]);
  });

  test("null for what it can't read", () => {
    expect(parseNpy(new ArrayBuffer(4))).toBeNull();
    expect(parseNpy(new Uint8Array(64).buffer)).toBeNull();
    expect(parseNpy("not a buffer")).toBeNull();
    expect(parseNpy(npy(">u2", [1, 1, 1], [1], Uint16Array))).toBeNull();
    expect(parseNpy(npy("<c8", [1, 1, 1], [1, 1], Float32Array))).toBeNull();
    // Says it holds more than it does.
    expect(parseNpy(npy("<u2", [1, 4, 4], [1, 2], Uint16Array))).toBeNull();
  });
});

test.describe("distinctValues", () => {
  test("the first band's values where the mask band has data", () => {
    const parsed = parseNpy(npy("<u2", [2, 2, 2], [4, 7, 7, 300, 65535, 65535, 0, 0], Uint16Array));
    expect([...distinctValues(parsed)].sort()).toEqual([4, 7]);
  });

  test("a single band has no mask", () => {
    const parsed = parseNpy(npy("|u1", [1, 2, 2], [0, 3, 3, 9], Uint8Array));
    expect([...distinctValues(parsed)].sort()).toEqual([0, 3, 9]);
  });

  test("nothing for an empty or unexpected array", () => {
    expect(distinctValues(null).size).toBe(0);
    expect(distinctValues({ shape: [2, 2], data: new Uint8Array(4) }).size).toBe(0);
    expect(distinctValues(parseNpy(npy("<f4", [1, 1, 2], [NaN, NaN], Float32Array))).size).toBe(0);
  });
});

test.describe("entriesInView", () => {
  // As the Legend records its rows: the label and the styled value beside it.
  const rows = [
    { label: "Hematite", propertyValue: "2 - 2" },
    { label: "Goethite", propertyValue: "4 - 7" },
    { label: "Calcite", propertyValue: "45" },
    { label: "No value", propertyValue: "" },
  ];

  test("the entries the values on screen belong to", () => {
    expect([...entriesInView(rows, new Set([5, 45, 999]))].sort()).toEqual([1, 2]);
    expect([...entriesInView(rows, new Set([2, 4, 7]))].sort()).toEqual([0, 1]);
  });

  test("none when nothing on screen has an entry", () => {
    expect(entriesInView(rows, new Set([0, 65535])).size).toBe(0);
    expect(entriesInView(rows, new Set()).size).toBe(0);
    expect(entriesInView(null, new Set([2])).size).toBe(0);
    expect(entriesInView(rows, null).size).toBe(0);
  });
});

test.describe("sampleSize", () => {
  test("the map's proportions, longest side 256", () => {
    expect(sampleSize({ x: 1600, y: 800 })).toEqual({ width: 256, height: 128 });
    expect(sampleSize({ x: 500, y: 1000 })).toEqual({ width: 128, height: 256 });
    expect(sampleSize(undefined)).toEqual({ width: 256, height: 256 });
  });
});

test.describe("viewValuesUrl", () => {
  const options = { location: LOCATION, mapSize: { x: 1024, y: 512 } };

  test("the view as raw values from this site's TiTiler-pgSTAC", () => {
    expect(viewValuesUrl({ url: "stac-collection:minerals" }, BOUNDS, options)).toBe(
      "http://localhost:8888/titilerpgstac/collections/minerals/bbox/-117.7,36.85,-117.15,37.4/256x128.npy" +
        "?assets=asset&resampling=nearest&reproject=nearest&items_limit=100"
    );
  });

  test("the same bands, time and mosaic limits the tiles are drawn with", () => {
    const url = viewValuesUrl(
      {
        url: "stac-collection:https://b.org/titilerpgstac/collections/minerals",
        cogBands: [2],
        time: { enabled: true, start: "2025-01-01", end: "2026-01-01" },
      },
      BOUNDS,
      { ...options, stac: { mosaicItemLimit: 20, mosaicScanLimit: 500, mosaicTimeLimit: 5 } }
    );
    expect(url).toContain("https://b.org/titilerpgstac/collections/minerals/bbox/");
    expect(url).toContain("assets=asset|bidx=2&");
    expect(url).toContain("&items_limit=20&scan_limit=500&time_limit=5");
    expect(url).toContain("&datetime=2025-01-01/2026-01-01");
  });

  test("a view past the edge of the world is clamped to it", () => {
    const url = viewValuesUrl(
      { url: "stac-collection:minerals" },
      { west: -400, south: -120, east: 250, north: 95 },
      options
    );
    expect(url).toContain("/bbox/-180,-90,180,90/");
  });

  test("null for a layer whose drawn values aren't the legend's, or no view", () => {
    expect(viewValuesUrl({ url: "COG:a.tif" }, BOUNDS, options)).toBeNull();
    expect(viewValuesUrl({ url: "stac-collection:m", cogTransform: true }, BOUNDS, options)).toBeNull();
    expect(viewValuesUrl({ url: "stac-collection:m", cogExpression: "b1*2" }, BOUNDS, options)).toBeNull();
    expect(viewValuesUrl({ url: "stac-collection:m" }, null, options)).toBeNull();
    expect(viewValuesUrl({ url: "stac-collection:m" }, { west: 5, south: 1, east: 5, north: 2 }, options)).toBeNull();
    expect(viewValuesUrl(undefined, BOUNDS, options)).toBeNull();
  });
});

test.describe("a COG and a vector layer", () => {
  const {
    cogViewEntriesUrl,
    entryIndexColormap,
    distinctEntryIndexes,
    distinctPropertyValues,
  } = require("../../plugins/core/tools/Legend/legendInView.js");
  const TILES =
    "http://localhost:8888/titiler/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.webp?url=/Missions/A/Data/classes.tif&bidx=1&resampling=bilinear";
  const options = { mapSize: { x: 1024, y: 512 } };
  const ROWS = [
    { label: "Hematite", propertyValue: "2 - 2" },
    { label: "Not a number", propertyValue: "" },
    { label: "Goethite", propertyValue: "4 - 7" },
    { label: "45", propertyValue: "" },
  ];

  test("a color table that paints each pixel with its entry", () => {
    // Reversed, so the first entry holding a value paints last and wins.
    expect(JSON.parse(entryIndexColormap(ROWS))).toEqual([
      [[45, 45.000001], [0, 4, 0, 255]],
      [[4, 7.000001], [0, 3, 0, 255]],
      [[2, 2.000001], [0, 1, 0, 255]],
    ]);
    expect(entryIndexColormap([{ label: "words", propertyValue: "" }])).toBeNull();
    expect(entryIndexColormap(null)).toBeNull();
    // Entry 300 needs both bytes.
    const many = Array.from({ length: 300 }, (_, i) => ({ label: String(i), propertyValue: "" }));
    expect(JSON.parse(entryIndexColormap(many))[0][1]).toEqual([1, 44, 0, 255]);
  });

  test("the entries present in the painted image", () => {
    // 4 pixels: entry 0, entry 2, entry 299, and one transparent.
    const painted = parseNpy(
      npy("|u1", [4, 2, 2], [0, 0, 1, 0, /* G */ 1, 3, 44, 9, /* B */ 0, 0, 0, 0, /* A */ 255, 255, 255, 0], Uint8Array)
    );
    expect([...distinctEntryIndexes(painted)].sort((a, b) => a - b)).toEqual([0, 2, 299]);
    expect(distinctEntryIndexes(parseNpy(npy("<u2", [2, 1, 1], [5, 1], Uint16Array))).size).toBe(0);
    expect(distinctEntryIndexes(null).size).toBe(0);
  });

  test("the layer's own tile url, asked which entries are in the view", () => {
    const url = cogViewEntriesUrl(TILES, { url: "COG:Data/classes.tif" }, BOUNDS, ROWS, options);
    expect(url.startsWith(
      "http://localhost:8888/titiler/cog/bbox/-117.7,36.85,-117.15,37.4/256x128.npy" +
        "?url=/Missions/A/Data/classes.tif&bidx=1&resampling=nearest&reproject=nearest&colormap="
    )).toBe(true);
    expect(JSON.parse(decodeURIComponent(url.split("&colormap=")[1]))).toEqual(JSON.parse(entryIndexColormap(ROWS)));
  });

  test("null for anything that isn't a plain COG tile url with a numeric legend", () => {
    expect(cogViewEntriesUrl("https://a.org/{z}/{x}/{y}.png", {}, BOUNDS, ROWS, options)).toBeNull();
    expect(cogViewEntriesUrl(TILES.replace("url=", "u="), {}, BOUNDS, ROWS, options)).toBeNull();
    expect(cogViewEntriesUrl(TILES, { cogTransform: true }, BOUNDS, ROWS, options)).toBeNull();
    expect(cogViewEntriesUrl(TILES, { currentCogExpression: "b1+1" }, BOUNDS, ROWS, options)).toBeNull();
    expect(cogViewEntriesUrl(TILES, {}, null, ROWS, options)).toBeNull();
    expect(cogViewEntriesUrl(TILES, {}, BOUNDS, [{ label: "words" }], options)).toBeNull();
    expect(cogViewEntriesUrl(undefined, {}, BOUNDS, ROWS, options)).toBeNull();
  });

  test("distinctPropertyValues: what the features in view are", () => {
    const features = [
      { properties: { kind: "basalt", meta: { rank: 2 } } },
      { properties: { kind: "basalt", meta: { rank: 5 } } },
      { properties: { kind: "", meta: {} } },
      { properties: null },
    ];
    const values = distinctPropertyValues(features, ["kind", "meta.rank", ""]);
    expect([...values.keys()]).toEqual(["kind", "meta.rank"]);
    expect([...values.get("kind")]).toEqual(["basalt"]);
    expect([...values.get("meta.rank")].sort()).toEqual([2, 5]);
    expect(distinctPropertyValues(null, ["kind"]).get("kind").size).toBe(0);
  });

  test("a category is matched on its recorded value, whatever it is labelled", () => {
    const rows = [
      { label: "Basalt flows", propertyValue: "basalt" },
      { label: "Sandstone", propertyValue: "sandstone" },
      { label: "Unit 7", propertyValue: "7" },
    ];
    expect([...entriesInView(rows, new Set(["basalt", 7]))].sort()).toEqual([0, 2]);
  });
});
