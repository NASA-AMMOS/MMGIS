import { test, expect } from "@playwright/test";
import {
  splitValueUnits,
  extractUnits,
} from "../../plugins/core/tools/Legend/legendValueUnits.js";

/**
 * legendValueUnits unit tests — a legend hides the units it shows once in the
 * title, so what counts as units decides what a label still says.
 */

test.describe("splitValueUnits", () => {
  test("units are what follows the number", () => {
    expect(splitValueUnits("5 km")).toEqual({ number: "5", units: "km" });
    expect(splitValueUnits("-12.5m")).toEqual({ number: "-12.5", units: "m" });
    expect(splitValueUnits("1,024 MB")).toEqual({
      number: "1,024",
      units: "MB",
    });
  });

  test("an exponent belongs to its number, not to the units", () => {
    // Stripping `e10` as units left 1.8e10 reading as 1.8, smaller than 1.0.
    expect(splitValueUnits("1.8e10")).toEqual({ number: "1.8e10", units: "" });
    expect(splitValueUnits("2.1e-7")).toEqual({ number: "2.1e-7", units: "" });
    expect(splitValueUnits("7.9E+9 ns")).toEqual({
      number: "7.9E+9",
      units: "ns",
    });
  });

  test("a bin's range is one label, not a number with units", () => {
    // Taking "– 80" for units labelled the 60-80 bin "60".
    expect(splitValueUnits("60 – 80")).toEqual({
      number: "60 – 80",
      units: "",
    });
    expect(extractUnits(["60 – 80", "80 – 100"]).units).toBe("");
  });

  test("a label that is not a number keeps all of itself", () => {
    expect(splitValueUnits("Basalt")).toEqual({ number: "Basalt", units: "" });
    expect(splitValueUnits("")).toEqual({ number: "", units: "" });
    expect(splitValueUnits(null)).toEqual({ number: "", units: "" });
  });
});

test.describe("extractUnits", () => {
  test("units shared by every label are the legend's units", () => {
    expect(extractUnits(["5 km", "10 km", "15 km"]).units).toBe("km");
  });

  test("labels that disagree have no shared units to take off them", () => {
    expect(extractUnits(["5 km", "10", "15 m"]).units).toBe("");
  });

  test("an exponent is never mistaken for shared units", () => {
    expect(extractUnits(["2.1e10", "1.8e10", "0"]).units).toBe("");
  });

  test("nothing to read is no units", () => {
    expect(extractUnits([])).toEqual({ number: "", units: "" });
    expect(extractUnits(null)).toEqual({ number: "", units: "" });
  });
});
