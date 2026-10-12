import { test, expect } from "@playwright/test";
import {
  toNumber,
  parseRange,
  resolveEntryIndex,
  resolveCandidateIndex,
  resolveScalePosition,
  resolveCandidatePosition,
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

/**
 * A ramp ticks each of its n stops, stop i at i / (n - 1), so the ticks span
 * the whole bar. The DEM legend in the Reference Mission is these nine stops
 * over a linear 0-800 range, so a reading's tick position is simply how far it
 * sits between the ends: 73.55m lands at (800 - 73.55) / 800 = 90.81%.
 */
const DEM_RAMP = ["800m", "700m", "600m", "500m", "400m", "300m", "200m", "100m", "0m"].map(
  (label) => ({ label: label, propertyValue: null })
);

const pct = (position) => Math.round(position * 10000) / 100;

test.describe("resolveScalePosition", () => {
  test("a stop lands on its own tick", () => {
    expect(pct(resolveScalePosition(DEM_RAMP, "800m"))).toBe(0);
    expect(pct(resolveScalePosition(DEM_RAMP, 200))).toBe(75);
    expect(pct(resolveScalePosition(DEM_RAMP, 100))).toBe(87.5);
    expect(pct(resolveScalePosition(DEM_RAMP, 0))).toBe(100);
  });

  test("a reading on a linear ramp lands where its value falls", () => {
    for (const reading of [73.55, 246.86, 512, 90.23]) {
      expect(pct(resolveScalePosition(DEM_RAMP, reading))).toBeCloseTo(
        ((800 - reading) / 800) * 100,
        1
      );
    }
  });

  test("a reading between stops is interpolated, not snapped", () => {
    // Both sat on the stop nearest them before, up to half a band away.
    expect(pct(resolveScalePosition(DEM_RAMP, 73.55))).toBeCloseTo(90.81, 1);
    expect(pct(resolveScalePosition(DEM_RAMP, 246.86))).toBeCloseTo(69.14, 1);
  });

  test("two readings in one band do not share a position", () => {
    const low = resolveScalePosition(DEM_RAMP, 73.55);
    const high = resolveScalePosition(DEM_RAMP, 130);
    expect(low).not.toBe(high);
    expect(high).toBeLessThan(low);
  });

  test("a reading past the end holds the stop it ran past", () => {
    expect(pct(resolveScalePosition(DEM_RAMP, 950))).toBe(0);
    expect(pct(resolveScalePosition(DEM_RAMP, -20))).toBe(100);
  });

  test("units on the label do not stop it being placed", () => {
    expect(pct(resolveScalePosition(DEM_RAMP, "73.55m"))).toBeCloseTo(90.81, 1);
  });

  test("a lone stop takes the middle rather than dividing by zero", () => {
    expect(pct(resolveScalePosition([{ label: "5", propertyValue: null }], 5))).toBe(50);
  });

  test("what carries no number has no position", () => {
    expect(resolveScalePosition(DEM_RAMP, "Basalt")).toBeNull();
    expect(resolveScalePosition([], 5)).toBeNull();
    expect(resolveScalePosition(DEM_RAMP, null)).toBeNull();
  });

  test("an ascending ramp places the same reading the same way", () => {
    const ascending = [...DEM_RAMP].reverse();
    expect(pct(resolveScalePosition(ascending, 73.55))).toBeCloseTo(
      100 - 90.81,
      1
    );
  });

  test("propertyValue is preferred over the label", () => {
    const styled = [
      { label: "high", propertyValue: 100 },
      { label: "low", propertyValue: 0 },
    ];
    expect(pct(resolveScalePosition(styled, 50))).toBe(50);
  });
});

test.describe("resolveCandidatePosition", () => {
  test("an exact label wins over interpolation", () => {
    expect(pct(resolveCandidatePosition(DEM_RAMP, ["200m"]))).toBe(75);
  });

  test("it falls through to the first candidate it can place", () => {
    expect(pct(resolveCandidatePosition(DEM_RAMP, ["Basalt", 246.86]))).toBeCloseTo(
      69.14,
      1
    );
  });

  test("nothing placeable has no position", () => {
    expect(resolveCandidatePosition(DEM_RAMP, ["Basalt"])).toBeNull();
    expect(resolveCandidatePosition(DEM_RAMP, [])).toBeNull();
  });
});
