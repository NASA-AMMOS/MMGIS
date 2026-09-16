import { test, expect } from "@playwright/test";
import {
  toNumber,
  parseRange,
  resolveEntryIndex,
  resolveCandidateIndex,
} from "../../plugins/core/tools/Legend/legendHighlight.js";

/**
 * legendHighlight unit tests — the Identifier reads a value off the map and
 * the Legend has to say which of its entries that value is.
 */

/** Entries as the Legend records them: a label, and the styled value if any. */
const entries = (labels, propertyValues) =>
  labels.map((label, i) => ({
    label,
    propertyValue: propertyValues ? propertyValues[i] : "",
  }));

const ROWS = false;
const RAMP = true;

test.describe("parseRange", () => {
  test("a bin label names the span it covers", () => {
    expect(parseRange("10 - 20")).toEqual([10, 20]);
    expect(parseRange("10 – 20")).toEqual([10, 20]);
    expect(parseRange("10—20")).toEqual([10, 20]);
    expect(parseRange("-20 – -10")).toEqual([-20, -10]);
    expect(parseRange("1,000 - 2,000 m")).toEqual([1000, 2000]);
  });

  test("a descending span is still the span between its ends", () => {
    expect(parseRange("20 - 10")).toEqual([10, 20]);
  });

  test("a single value names no span", () => {
    expect(parseRange("84.98m")).toBeNull();
    expect(parseRange("Basalt")).toBeNull();
    expect(parseRange(null)).toBeNull();
  });

  test("a date is not a span", () => {
    // 2026-09-16 otherwise reads as 2026 to 9.
    expect(parseRange("2026-09-16")).toBeNull();
  });
});

test.describe("resolveEntryIndex - discrete rows", () => {
  test("a label the legend carries is that row", () => {
    const rows = entries(["Water", "Forest", "Urban"]);
    expect(resolveEntryIndex(rows, "Urban", ROWS)).toBe(2);
  });

  test("a value no row carries lights nothing", () => {
    // Rows are unrelated values that happen to be numbers, and a legend may
    // hide some of them, so nearest would light whichever row was closest.
    const rows = entries(["1", "2", "50"]);
    expect(resolveEntryIndex(rows, 27, ROWS)).toBe(-1);
    expect(resolveEntryIndex(rows, 3, ROWS)).toBe(-1);
  });

  test("a number matching a row exactly still lights it", () => {
    const rows = entries(["1", "2", "50"]);
    expect(resolveEntryIndex(rows, 50, ROWS)).toBe(2);
  });

  test("a reading inside a bin belongs to that bin", () => {
    const bins = entries(["0 - 10", "10 - 20", "20 - 30"]);
    expect(resolveEntryIndex(bins, 19, ROWS)).toBe(1);
    expect(resolveEntryIndex(bins, 5, ROWS)).toBe(0);
    expect(resolveEntryIndex(bins, 25, ROWS)).toBe(2);
    // Outside every bin is still nothing.
    expect(resolveEntryIndex(bins, 99, ROWS)).toBe(-1);
  });
});

test.describe("resolveEntryIndex - continuous ramps", () => {
  test("a reading between two bands takes the nearer one", () => {
    const ramp = entries(["0m", "100m", "200m", "300m"]);
    expect(resolveEntryIndex(ramp, 84.98, RAMP)).toBe(1);
    expect(resolveEntryIndex(ramp, 255.02, RAMP)).toBe(3);
    expect(resolveEntryIndex(ramp, 16.73, RAMP)).toBe(0);
  });

  test("a bin is preferred to the nearest edge", () => {
    // Nearest alone reduces "10 - 20" to 10, which puts 19 in "20 - 30".
    const bins = entries(["0 - 10", "10 - 20", "20 - 30"]);
    expect(resolveEntryIndex(bins, 19, RAMP)).toBe(1);
  });

  test("units on the labels do not stop a match", () => {
    expect(resolveEntryIndex(entries(["0 km", "5 km"]), 4, RAMP)).toBe(1);
  });

  test("a value that is not a number lights nothing", () => {
    const ramp = entries(["0m", "100m"]);
    expect(resolveEntryIndex(ramp, "Basalt", RAMP)).toBe(-1);
    expect(resolveEntryIndex(ramp, null, RAMP)).toBe(-1);
  });

  test("an empty legend lights nothing", () => {
    expect(resolveEntryIndex([], 5, RAMP)).toBe(-1);
  });
});

test.describe("resolveEntryIndex - propertyValue", () => {
  test("a text label is matched on the value it is styled by", () => {
    const classed = entries(["Low", "Medium", "High"], [0, 50, 100]);
    expect(resolveEntryIndex(classed, 97, RAMP)).toBe(2);
    expect(resolveEntryIndex(classed, 72, RAMP)).toBe(1);
  });

  test("without one, a text label cannot be matched by number", () => {
    const classed = entries(["Low", "Medium", "High"]);
    expect(resolveEntryIndex(classed, 97, RAMP)).toBe(-1);
  });

  test("the label itself still wins outright", () => {
    const classed = entries(["Low", "Medium", "High"], [0, 50, 100]);
    expect(resolveEntryIndex(classed, "Medium", RAMP)).toBe(1);
  });
});

test.describe("resolveCandidateIndex", () => {
  test("the number is preferred while the legend can place it", () => {
    const ramp = entries(["0m", "100m", "200m"]);
    expect(resolveCandidateIndex(ramp, [84.98, ""], RAMP)).toBe(1);
  });

  test("a label carries the match when the number resolves to nothing", () => {
    // Otherwise the colour pass lights a row and the value pass puts it out.
    const rows = entries(["Water", "Forest", "Urban"]);
    expect(resolveCandidateIndex(rows, [3, "Urban"], ROWS)).toBe(2);
  });

  test("neither resolving lights nothing", () => {
    const rows = entries(["Water", "Forest"]);
    expect(resolveCandidateIndex(rows, [3, "Granite"], ROWS)).toBe(-1);
    expect(resolveCandidateIndex(rows, [], ROWS)).toBe(-1);
  });
});

test.describe("toNumber", () => {
  test("a label's units do not stop it being a number", () => {
    expect(toNumber("233.58m")).toBe(233.58);
    expect(toNumber("1,024 MB")).toBe(1024);
    expect(toNumber(42)).toBe(42);
  });

  test("what is not a number is null", () => {
    expect(toNumber("Basalt")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(NaN)).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
  });
});
