import { test, expect } from "@playwright/test";

/**
 * Unit tests for the geodataset statistics helpers
 * (plugins/core/backend/Geodatasets/lib/stats.js).
 *
 * Covers both halves of the feature without touching a database:
 *   - query-time per-group stats: field sanitization, SQL/alias generation,
 *     and reassembly of stat columns into properties._.stats
 *   - dataset-wide field_stats: numeric field discovery, append merging,
 *     and derived averages
 */

const {
  sanitizeStatFields,
  buildStatsSelect,
  statAlias,
  readRowStats,
  collectFieldStats,
  buildFieldStatsScan,
  readFieldStatsScan,
  mergeFieldStats,
  withAverages,
  MAX_STAT_FIELDS,
} = require("../../plugins/core/backend/Geodatasets/lib/stats");

test.describe("sanitizeStatFields", () => {
  test("keeps alphanumerics, underscores, dots and hyphens", () => {
    expect(
      sanitizeStatFields(["elev", "a.b.c", "my_field", "my-field"]),
    ).toEqual(["elev", "a.b.c", "my_field", "my-field"]);
  });

  test("strips characters that could escape an SQL string", () => {
    // Hyphens survive (they are legal in a property name, as with _source);
    // quotes, semicolons and whitespace do not, so no SQL can be smuggled in.
    expect(sanitizeStatFields([`elev'; DROP TABLE x; --`])).toEqual([
      "elevDROPTABLEx--",
    ]);
  });

  test("drops non-strings and empties, and dedupes", () => {
    expect(sanitizeStatFields(["elev", "elev", "", null, 5, {}])).toEqual([
      "elev",
    ]);
  });

  test("returns null when nothing usable is left", () => {
    expect(sanitizeStatFields([])).toBe(null);
    expect(sanitizeStatFields(["   "])).toBe(null);
    expect(sanitizeStatFields(null)).toBe(null);
    expect(sanitizeStatFields("elev")).toBe(null);
  });

  test("caps the number of fields", () => {
    const many = Array.from(
      { length: MAX_STAT_FIELDS + 10 },
      (_, i) => `f${i}`,
    );
    expect(sanitizeStatFields(many).length).toBe(MAX_STAT_FIELDS);
  });
});

test.describe("buildStatsSelect", () => {
  test("is a no-op without fields", () => {
    expect(buildStatsSelect(null, "group_id").text).toBe("");
    expect(buildStatsSelect([], "group_id").text).toBe("");
  });

  test("emits the group aggregates partitioned by the group key", () => {
    const { text, replacements } = buildStatsSelect(["elev"], "group_id");
    expect(text.startsWith(", ")).toBe(true);
    expect(text).toContain("MIN(");
    expect(text).toContain("MAX(");
    expect(text).toContain("AVG(");
    expect(text).toContain("SUM(");
    // Population deviation, as the one derived from field_stats is.
    expect(text).toContain("STDDEV_POP(");
    expect(text).toContain("OVER (PARTITION BY group_id)");
    expect(text).toContain("AS stat_min_0");
    expect(text).toContain("AS stat_max_0");
    expect(text).toContain("AS stat_avg_0");
    expect(text).toContain("AS stat_sum_0");
    expect(text).toContain("AS stat_stddev_0");
    // Flat keys are parameterized, never inlined
    expect(replacements.stat_field_0).toBe("elev");
    expect(text).not.toContain("'elev'");
  });

  test("partitions over the whole result set when there is no group key", () => {
    const { text } = buildStatsSelect(["elev"], null);
    expect(text).toContain("OVER ()");
    expect(text).not.toContain("PARTITION BY");
  });

  test("aliases are index-based, so field names never become identifiers", () => {
    const { text } = buildStatsSelect(["elev", "depth.m"], "geom");
    [
      "stat_min_0",
      "stat_max_0",
      "stat_avg_0",
      "stat_sum_0",
      "stat_stddev_0",
      "stat_min_1",
      "stat_max_1",
      "stat_avg_1",
    ].forEach((alias) => expect(text).toContain(`AS ${alias}`));
    expect(text).not.toContain("AS stat_min_elev");
  });

  test("nested keys become a JSONB path chain", () => {
    const { text } = buildStatsSelect(["depth.m"], "group_id");
    expect(text).toContain(`properties->'depth'->>'m'`);
  });

  test("guards the numeric cast so non-numeric values are ignored, not fatal", () => {
    const { text, replacements } = buildStatsSelect(["elev"], "group_id");
    expect(text).toContain("CASE WHEN");
    expect(text).toContain(":stats_numeric_regex");
    expect(text).toContain("::FLOAT8");
    // The regex must accept plain, negative, decimal and exponent forms and
    // reject anything else — it is the only thing standing between the cast
    // and a query-aborting error.
    const re = new RegExp(replacements.stats_numeric_regex);
    ["1", "-1", "+1", "0.5", "-0.5", ".5", "1e5", "-1.5E-3", " 42 "].forEach(
      (v) => expect(re.test(v), `${v} should be numeric`).toBe(true),
    );
    // A number grammar, not a character class: text that merely starts with
    // digits must not be treated as a number.
    [
      "",
      "abc",
      "12abc",
      "NaN",
      "Infinity",
      "1,000",
      "--1",
      "1.2.3",
      "2024-01-15",
      "1-2",
    ].forEach((v) =>
      expect(re.test(v), `${v} should not be numeric`).toBe(false),
    );
  });

  test("measures as NUMERIC first, so an out-of-range value cannot abort the query", () => {
    const { text, replacements } = buildStatsSelect(["elev"], "group_id");
    // '1e999'::FLOAT8 raises "out of range"; ABS(...::NUMERIC) <= 1e308 keeps
    // that value out of the cast, leaving it NULL like any other unusable one.
    expect(text).toContain("::NUMERIC");
    expect(text).toContain("<= 1e308");
    expect(text.indexOf("::NUMERIC")).toBeLessThan(text.indexOf("::FLOAT8"));
    // An exponent NUMERIC itself could not hold is not even measured.
    const re = new RegExp(replacements.stats_numeric_regex);
    expect(re.test("1e999")).toBe(true);
    expect(re.test("1e999999")).toBe(false);
  });

  test("statAlias matches the emitted aliases", () => {
    expect(statAlias("min", 3)).toBe("stat_min_3");
  });
});

test.describe("readRowStats", () => {
  test("maps stat columns back onto the requested field names", () => {
    const row = {
      id: 7,
      stat_min_0: 0.1,
      stat_max_0: 9.8,
      stat_avg_0: 4.2,
      stat_sum_0: 8.4,
      stat_stddev_0: 4.85,
      stat_min_1: -3,
      stat_max_1: 3,
      stat_avg_1: 0,
      stat_sum_1: 0,
      stat_stddev_1: 3,
    };
    expect(readRowStats(row, ["elev", "depth.m"])).toEqual({
      elev: { min: 0.1, max: 9.8, avg: 4.2, sum: 8.4, stddev: 4.85 },
      "depth.m": { min: -3, max: 3, avg: 0, sum: 0, stddev: 3 },
    });
  });

  test("a group with no numeric values yields nulls rather than NaN", () => {
    expect(
      readRowStats({ stat_min_0: null, stat_max_0: null, stat_avg_0: null }, [
        "elev",
      ]),
    ).toEqual({
      elev: {
        min: null,
        max: null,
        avg: null,
        sum: null,
        stddev: null,
      },
    });
  });

  test("numeric strings from the driver are coerced", () => {
    expect(
      readRowStats(
        {
          stat_min_0: "1.5",
          stat_max_0: "2.5",
          stat_avg_0: "2",
          stat_sum_0: "4",
          stat_stddev_0: "0.5",
        },
        ["elev"],
      ),
    ).toEqual({
      elev: { min: 1.5, max: 2.5, avg: 2, sum: 4, stddev: 0.5 },
    });
  });

  test("returns null when there is nothing to read", () => {
    expect(readRowStats(null, ["elev"])).toBe(null);
    expect(readRowStats({}, [])).toBe(null);
  });
});

test.describe("collectFieldStats", () => {
  test("accumulates min/max/sum/sumsq/count per numeric field", () => {
    const stats = collectFieldStats([
      { properties: { elev: 10, name: "a" } },
      { properties: { elev: -2, name: "b" } },
      { properties: { elev: 4 } },
    ]);
    expect(stats.elev).toEqual({
      type: "number",
      min: -2,
      max: 10,
      sum: 12,
      sumsq: 120,
      count: 3,
    });
    expect(stats.name).toBe(undefined);
  });

  test("flattens nested properties to dotted paths", () => {
    const stats = collectFieldStats([
      { properties: { depth: { m: 1 }, meta: { deep: { n: 2 } } } },
    ]);
    expect(stats["depth.m"].min).toBe(1);
    expect(stats["meta.deep.n"].max).toBe(2);
  });

  test("numeric strings count, mixed-content strings and booleans do not", () => {
    const stats = collectFieldStats([
      { properties: { a: "2.5", b: "12abc", c: true, d: null } },
    ]);
    expect(stats.a).toMatchObject({
      type: "number",
      min: 2.5,
      max: 2.5,
      sum: 2.5,
      count: 1,
    });
    expect(stats.b).toBe(undefined);
    expect(stats.c).toBe(undefined);
    expect(stats.d).toBe(undefined);
  });

  test("date-like and version-like text is not summarized as a number", () => {
    // parseFloat() would happily return 2024 and 1.2 here, fabricating a
    // numeric domain for a text field the query-time SQL treats as text.
    const stats = collectFieldStats([
      { properties: { when: "2024-01-15", version: "1.2.3", range: "1-2" } },
    ]);
    expect(stats.when).toBe(undefined);
    expect(stats.version).toBe(undefined);
    expect(stats.range).toBe(undefined);
  });

  test("accepts the same values the query-time SQL guard accepts", () => {
    const re = new RegExp(
      buildStatsSelect(["x"], null).replacements.stats_numeric_regex,
    );
    [
      "1",
      "-1",
      "+1",
      ".5",
      "1e5",
      " 42 ",
      "2024-01-15",
      "1.2.3",
      "12abc",
      "1e999999",
    ].forEach((value) => {
      const summarized =
        collectFieldStats([{ properties: { x: value } }]).x != null;
      expect(summarized, `${value} should agree with the SQL guard`).toBe(
        re.test(value),
      );
    });
  });

  test("a field that is numeric in only some features counts only those", () => {
    const stats = collectFieldStats([
      { properties: { elev: 5 } },
      { properties: { elev: "unknown" } },
    ]);
    expect(stats.elev.count).toBe(1);
    expect(stats.elev.sum).toBe(5);
  });

  test("arrays are skipped and bad input is tolerated", () => {
    const stats = collectFieldStats([
      { properties: { tags: [1, 2, 3] } },
      {},
      null,
    ]);
    expect(stats.tags).toBe(undefined);
    expect(collectFieldStats(null)).toEqual({});
  });

  test("accumulates into an existing object when given one", () => {
    const acc = collectFieldStats([{ properties: { elev: 1 } }]);
    collectFieldStats([{ properties: { elev: 3 } }], acc);
    expect(acc.elev).toEqual({
      type: "number",
      min: 1,
      max: 3,
      sum: 4,
      sumsq: 10,
      count: 2,
    });
  });
});

test.describe("mergeFieldStats (the append case)", () => {
  test("widens extrema and adds sums and counts", () => {
    const merged = mergeFieldStats(
      {
        elev: {
          type: "number",
          min: 0,
          max: 10,
          sum: 10,
          sumsq: 100,
          count: 2,
        },
      },
      {
        elev: { type: "number", min: -5, max: 5, sum: 0, sumsq: 50, count: 2 },
      },
    );
    expect(merged.elev).toEqual({
      type: "number",
      min: -5,
      max: 10,
      sum: 10,
      sumsq: 150,
      count: 4,
    });
  });

  test("keeps an exact standard deviation across appends", () => {
    const chunk = (values) =>
      collectFieldStats(values.map((v) => ({ properties: { elev: v } })));
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const merged = mergeFieldStats(
      chunk(values.slice(0, 3)),
      chunk(values.slice(3)),
    );
    // Same population deviation as summarizing all eight at once
    expect(withAverages(merged).elev.stddev).toBeCloseTo(2, 10);
    expect(withAverages(chunk(values)).elev.stddev).toBeCloseTo(2, 10);
  });

  test("drops sumsq rather than understating it", () => {
    // Statistics stored before sumsq was kept have nothing to add
    const merged = mergeFieldStats(
      { elev: { type: "number", min: 0, max: 10, sum: 10, count: 2 } },
      { elev: { type: "number", min: 1, max: 1, sum: 1, sumsq: 1, count: 1 } },
    );
    expect(merged.elev.sumsq).toBe(undefined);
    expect(merged.elev.count).toBe(3);
    expect(withAverages(merged).elev.stddev).toBe(null);
  });

  test("keeps an exact average across appends", () => {
    // 3 features averaging 2, then 1 feature of value 10 -> 16/4
    const merged = mergeFieldStats(
      { elev: { type: "number", min: 1, max: 3, sum: 6, count: 3 } },
      { elev: { type: "number", min: 10, max: 10, sum: 10, count: 1 } },
    );
    expect(withAverages(merged).elev.avg).toBe(4);
  });

  test("carries over fields present on only one side", () => {
    const merged = mergeFieldStats(
      { old: { type: "number", min: 1, max: 1, sum: 1, count: 1 } },
      { new: { type: "number", min: 2, max: 2, sum: 2, count: 1 } },
    );
    expect(Object.keys(merged).sort()).toEqual(["new", "old"]);
  });

  test("does not mutate the stored statistics", () => {
    const previous = {
      elev: { type: "number", min: 0, max: 1, sum: 1, count: 2 },
    };
    mergeFieldStats(previous, {
      elev: { type: "number", min: 5, max: 5, sum: 5, count: 1 },
    });
    expect(previous.elev).toEqual({
      type: "number",
      min: 0,
      max: 1,
      sum: 1,
      count: 2,
    });
  });

  test("tolerates missing or malformed stored statistics", () => {
    const next = { elev: { type: "number", min: 1, max: 2, sum: 3, count: 2 } };
    expect(mergeFieldStats(null, next)).toEqual(next);
    expect(mergeFieldStats({ elev: "nonsense" }, next)).toEqual(next);
    expect(mergeFieldStats(next, { elev: { min: "x" } })).toEqual(next);
    expect(mergeFieldStats(null, null)).toEqual({});
  });
});

test.describe("withAverages", () => {
  test("derives avg and stddev without changing the stored shape", () => {
    const stored = {
      elev: { type: "number", min: 0, max: 10, sum: 20, sumsq: 200, count: 4 },
    };
    expect(withAverages(stored, 5).elev).toEqual({
      type: "number",
      min: 0,
      max: 10,
      sum: 20,
      sumsq: 200,
      count: 4,
      nullCount: 1,
      avg: 5,
      stddev: 5,
    });
    expect(stored.elev.avg).toBe(undefined);
    expect(stored.elev.stddev).toBe(undefined);
  });

  test("nullCount is the features the field held no number for", () => {
    const stored = collectFieldStats([
      { properties: { elev: 1 } },
      { properties: { elev: null } },
      { properties: { elev: "unknown" } },
    ]);
    expect(withAverages(stored, 3).elev.nullCount).toBe(2);
    // Without the geodataset's feature count there is nothing to subtract from
    expect(withAverages(stored).elev.nullCount).toBe(null);
  });

  test("an all-identical field deviates by zero, never by NaN", () => {
    const stats = collectFieldStats(
      [0.1, 0.1, 0.1].map((v) => ({ properties: { elev: v } })),
    );
    expect(withAverages(stats).elev.stddev).toBe(0);
  });

  test("a countless field averages to null rather than NaN", () => {
    const out = withAverages({
      elev: { type: "number", min: 0, max: 0, sum: 0, sumsq: 0, count: 0 },
    });
    expect(out.elev.avg).toBe(null);
    expect(out.elev.stddev).toBe(null);
    expect(
      withAverages({
        elev: { type: "number", min: 0, max: 0, sum: 0, count: 1 },
      }).elev.stddev,
    ).toBe(null);
  });

  test("null in, null out; malformed entries are dropped", () => {
    expect(withAverages(null)).toBe(null);
    expect(withAverages({ bad: { min: "x" } })).toEqual({});
  });
});

test.describe("buildFieldStatsScan (rescanning an existing table)", () => {
  test("aggregates in postgres over the table it is given", () => {
    const scan = buildFieldStatsScan("geodatasets_old");
    expect(scan.text).toContain(
      "FROM geodatasets_old, jsonb_each(properties::JSONB)",
    );
    // One pass, grouped by field, rather than reading features into node.
    expect(scan.text).toContain("GROUP BY path");
    [
      "MIN(num)",
      "MAX(num)",
      "SUM(num)",
      "SUM(num * num)",
      "COUNT(num)",
    ].forEach((agg) => expect(scan.text).toContain(agg));
  });

  test("flattens nested properties to the dotted paths ingest stores", () => {
    const scan = buildFieldStatsScan("t");
    expect(scan.text).toContain("WITH RECURSIVE");
    expect(scan.text).toContain("flat.path || '.' || kv.key");
    // Bounded, as the accessors that read these paths back are.
    expect(scan.text).toContain("flat.depth < 10");
  });

  test("counts only what the query-time half counts as a number", () => {
    const scan = buildFieldStatsScan("t");
    // The same grammar, parameterized rather than inlined, so "12abc" and
    // "2024-01-15" are text here too.
    expect(scan.replacements.stats_numeric_regex).toBe(
      require("../../plugins/core/backend/Geodatasets/lib/stats")
        .SQL_NUMERIC_REGEX,
    );
    expect(scan.text).toContain("~ :stats_numeric_regex");
    expect(scan.text).toContain("jsonb_typeof(value) IN ('number', 'string')");
    // A value no float can hold is left out rather than aborting the scan.
    expect(scan.text).toContain("<= 1e308");
  });
});

test.describe("readFieldStatsScan", () => {
  test("reads the scan's text numbers into storable statistics", () => {
    expect(
      readFieldStatsScan([
        {
          path: "elev",
          min: "1",
          max: "9",
          sum: "10",
          sumsq: "82",
          count: "2",
        },
      ]),
    ).toEqual({
      elev: { type: "number", min: 1, max: 9, sum: 10, sumsq: 82, count: 2 },
    });
  });

  test("a field whose squares outgrew a float keeps its other numbers", () => {
    const stats = readFieldStatsScan([
      {
        path: "huge",
        min: "1e300",
        max: "1e300",
        sum: "1e300",
        sumsq: "1e600",
        count: "1",
      },
    ]);
    // No sumsq means no deviation, exactly as statistics stored before it was
    // kept report.
    expect(stats.huge.sumsq).toBe(undefined);
    expect(withAverages(stats).huge.stddev).toBe(null);
    expect(withAverages(stats).huge.avg).toBe(1e300);
  });

  test("unusable rows are skipped and bad input is tolerated", () => {
    expect(
      readFieldStatsScan([
        { path: "", min: "1", max: "1", sum: "1", count: "1" },
        { path: "bad", min: null, max: null, sum: null, count: "0" },
        null,
      ]),
    ).toEqual({});
    expect(readFieldStatsScan(null)).toEqual({});
  });
});
