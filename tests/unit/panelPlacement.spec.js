import { test, expect } from "@playwright/test";
import {
  STORAGE_KEY,
  normalizePlacement,
  isFloating,
  clampPlacement,
  maxHeightAt,
  loadPlacements,
  savePlacements,
} from "../../src/essence/Basics/UserInterface_/components/Panels/panelPlacement.js";

/**
 * panelPlacement unit tests — a floating tool panel that has been dragged or
 * resized stays inside its area and is remembered.
 */

const AREA = { left: 40, top: 40, right: 1040, bottom: 840 };

test.describe("normalizePlacement", () => {
  test("keeps usable numbers, and a position only as a pair", () => {
    expect(normalizePlacement({ x: 10.4, y: 20.6, w: 300.2, h: 400 })).toEqual({ x: 10, y: 21, w: 300, h: 400 });
    expect(normalizePlacement({ x: 10, w: 300 })).toEqual({ w: 300 });
    expect(normalizePlacement({ x: "10", y: 5, h: NaN })).toBeNull();
    expect(normalizePlacement(null)).toBeNull();
    expect(normalizePlacement("nope")).toBeNull();
  });

  test("a size can't be smaller than the minimum", () => {
    expect(normalizePlacement({ w: 20, h: 10 })).toEqual({ w: 180, h: 80 });
    expect(normalizePlacement({ w: 0, h: -5 })).toBeNull();
  });
});

test.describe("isFloating", () => {
  test("only once it has a position", () => {
    expect(isFloating({ x: 1, y: 2 })).toBe(true);
    expect(isFloating({ w: 300 })).toBe(false);
    expect(isFloating(null)).toBe(false);
  });
});

test.describe("clampPlacement", () => {
  test("left alone when it is inside", () => {
    expect(clampPlacement({ x: 200, y: 300, w: 300 }, AREA)).toEqual({ x: 200, y: 300, w: 300 });
  });

  test("the whole panel stays inside side to side", () => {
    expect(clampPlacement({ x: -500, y: 300, w: 300 }, AREA).x).toBe(44);
    expect(clampPlacement({ x: 5000, y: 300, w: 300 }, AREA).x).toBe(736);
    // Width not remembered: the current one is used.
    expect(clampPlacement({ x: 5000, y: 300 }, AREA, 200).x).toBe(836);
    // Wider than the area: pinned to its left edge.
    expect(clampPlacement({ x: 500, y: 300, w: 2000 }, AREA).x).toBe(44);
  });

  test("top to bottom only the header has to stay reachable", () => {
    expect(clampPlacement({ x: 200, y: -50, w: 300 }, AREA).y).toBe(44);
    expect(clampPlacement({ x: 200, y: 5000, w: 300 }, AREA).y).toBe(796);
  });

  test("a panel still in its row has nothing to clamp", () => {
    expect(clampPlacement({ w: 300 }, AREA)).toEqual({ w: 300 });
    expect(clampPlacement({ x: 1, y: 2 }, null)).toEqual({ x: 1, y: 2 });
  });
});

test.describe("maxHeightAt", () => {
  test("down to the bottom of the area and no further", () => {
    expect(maxHeightAt({ x: 200, y: 300 }, AREA)).toBe(536);
    expect(maxHeightAt({ x: 200, y: 830 }, AREA)).toBe(80);
  });
});

test.describe("remembering", () => {
  const store = () => {
    const data = {};
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = v) };
  };

  test("what is saved is read back", () => {
    const s = store();
    savePlacements({ Legend: { x: 100, y: 120, w: 320 } }, s);
    expect(Object.keys(s.data)).toEqual([STORAGE_KEY]);
    expect(loadPlacements(s)).toEqual({ Legend: { x: 100, y: 120, w: 320 } });
  });

  test("unreadable or refused storage is nothing remembered", () => {
    const s = store();
    expect(loadPlacements(s)).toEqual({});
    s.data[STORAGE_KEY] = "{not json";
    expect(loadPlacements(s)).toEqual({});
    s.data[STORAGE_KEY] = JSON.stringify({ Legend: { x: "a" }, Info: { w: 250 }, Junk: 5 });
    expect(loadPlacements(s)).toEqual({ Info: { w: 250 } });
    const refuses = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadPlacements(refuses)).toEqual({});
    expect(() => savePlacements({ Legend: { w: 300 } }, refuses)).not.toThrow();
  });
});
