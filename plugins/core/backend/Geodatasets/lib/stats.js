/**
 * Geodataset statistics helpers.
 *
 * Two independent features live here:
 *
 *  1. Query-time, per-group statistics (`stats=` on /get). Numeric aggregates of
 *     a feature's *group* (the same grouping `noDuplicates` uses) computed as
 *     window functions so full feature rows can still be selected.
 *
 *  2. Dataset-wide, per-field statistics (`field_stats` on the geodatasets
 *     metadata row) accumulated while a geodataset is written, so a consumer
 *     knows a field's full domain without querying every feature.
 *
 * Kept free of express/sequelize so both are unit testable.
 */

const Utils = require("../../../../../API/utils.js");
const { jsonbAccessor } = require("./jsonb");

// One number grammar for both halves of the feature: it guards the Postgres
// cast out of JSONB, and is what JS calls numeric text. A grammar rather than a
// character class, so "2024-01-15" and "1.2.3" are text, not numbers.
const SQL_NUMERIC_REGEX =
  "^\\s*[-+]?([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][-+]?[0-9]+)?\\s*$";
const NUMERIC_TEXT_REGEX = new RegExp(SQL_NUMERIC_REGEX);

// Statistics computed per group at query time.
const STAT_AGGREGATES = ["min", "max", "avg"];

// Bound the number of fields a single request may ask for, so `stats` cannot be
// used to build an arbitrarily large query.
const MAX_STAT_FIELDS = 20;

/**
 * Sanitize a requested `stats` list exactly like `_source`: alphanumerics,
 * underscores, dots (nested path separator) and hyphens only.
 * @returns {string[]|null} deduped field list, or null when nothing is usable
 */
function sanitizeStatFields(stats) {
  if (!Array.isArray(stats)) return null;
  const cleaned = [];
  stats.forEach((s) => {
    if (typeof s !== "string") return;
    const safe = Utils.forceAlphaNumUnder(s, [".", "-"]);
    if (safe && cleaned.indexOf(safe) === -1) cleaned.push(safe);
  });
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, MAX_STAT_FIELDS);
}

/**
 * Build the SELECT fragment that computes per-group statistics.
 *
 * Window aggregates (not GROUP BY) because the surrounding query selects whole
 * feature rows: `MIN(x) OVER (PARTITION BY group_id)` annotates every row with
 * its group's value and collapses nothing, so this composes with `noDuplicates`,
 * filters and pagination.
 *
 * Column aliases are index-based (`stat_min_0`) — a requested field name is
 * never used as an SQL identifier.
 *
 * @param {string[]} fields sanitized field list
 * @param {string|null} partitionBy grouping expression, e.g. "group_id" or "geom".
 *   Null/empty partitions over the whole filtered set.
 * @returns {{ text: string, replacements: Object }} `text` is "" when there is
 *   nothing to add, else a fragment beginning with ", ".
 */
function buildStatsSelect(fields, partitionBy) {
  if (!Array.isArray(fields) || fields.length === 0)
    return { text: "", replacements: {} };

  const over = `OVER (${partitionBy ? `PARTITION BY ${partitionBy}` : ""})`;
  const replacements = { stats_numeric_regex: SQL_NUMERIC_REGEX };
  const selects = [];

  fields.forEach((field, i) => {
    const accessor = jsonbAccessor(field, `stat_field_${i}`);
    Object.assign(replacements, accessor.replacements);
    // Non-numeric and missing values become NULL and are ignored by the
    // aggregates; a group with no numeric values at all yields NULL.
    const numeric = `(CASE WHEN ${accessor.text} ~ :stats_numeric_regex THEN (${accessor.text})::FLOAT8 END)`;
    STAT_AGGREGATES.forEach((agg) => {
      selects.push(
        `${agg.toUpperCase()}(${numeric}) ${over} AS ${statAlias(agg, i)}`
      );
    });
  });

  return { text: `, ${selects.join(", ")}`, replacements };
}

/** Column alias for a given aggregate of the i-th requested field. */
function statAlias(agg, i) {
  return `stat_${agg}_${i}`;
}

/**
 * Reassemble a queried row's stat columns into
 * `{ "field": { min, max, avg } }`. Aggregates with no numeric input are null.
 */
function readRowStats(row, fields) {
  if (!row || !Array.isArray(fields) || fields.length === 0) return null;
  const stats = {};
  fields.forEach((field, i) => {
    const stat = {};
    STAT_AGGREGATES.forEach((agg) => {
      stat[agg] = toNumberOrNull(row[statAlias(agg, i)]);
    });
    stats[field] = stat;
  });
  return stats;
}

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Accumulate dataset-wide statistics for every numeric property of a feature
 * collection. Nested properties are flattened to dotted paths the same way
 * /aggregations and /schema discover fields, so `field_stats` keys line up with
 * what those endpoints report.
 *
 * `sum` and `count` are stored (rather than an average) so appends can merge
 * without re-reading the table and still report an exact mean.
 *
 * @param {Array} features GeoJSON features
 * @param {Object} [into] existing accumulator to add to
 * @returns {Object} { "path.to.field": { type: "number", min, max, sum, count } }
 */
function collectFieldStats(features, into) {
  const stats = into || {};
  if (!Array.isArray(features)) return stats;
  features.forEach((feature) => {
    if (feature && feature.properties)
      accumulateProperties(stats, feature.properties, "");
  });
  return stats;
}

function accumulateProperties(stats, obj, prefix) {
  for (const key in obj) {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value == null) continue;
    if (typeof value === "object") {
      // Arrays have no meaningful single numeric domain
      if (!Array.isArray(value)) accumulateProperties(stats, value, fullKey);
      continue;
    }
    if (typeof value === "boolean") continue;
    // Numeric text counts, but only when the whole value is a number — the same
    // grammar the query-time SQL casts by, so both halves agree on what a
    // numeric field is ("12abc", "2024-01-15" and "1.2.3" are all text).
    if (typeof value === "string" && !NUMERIC_TEXT_REGEX.test(value)) continue;
    const num = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(num)) continue;

    let stat = stats[fullKey];
    if (stat == null) {
      stat = stats[fullKey] = {
        type: "number",
        min: num,
        max: num,
        sum: 0,
        count: 0,
      };
    }
    if (num < stat.min) stat.min = num;
    if (num > stat.max) stat.max = num;
    stat.sum += num;
    stat.count += 1;
  }
}

/**
 * Merge freshly computed field statistics into previously stored ones — the
 * append case. Extrema take the outer bound; sums and counts add.
 * Recreate overwrites instead of merging, so it does not call this.
 */
function mergeFieldStats(previous, next) {
  const merged = {};
  const prev = previous && typeof previous === "object" ? previous : {};
  const incoming = next && typeof next === "object" ? next : {};

  Object.keys(prev).forEach((key) => {
    if (isFieldStat(prev[key])) merged[key] = Object.assign({}, prev[key]);
  });

  Object.keys(incoming).forEach((key) => {
    const stat = incoming[key];
    if (!isFieldStat(stat)) return;
    const existing = merged[key];
    if (existing == null) {
      merged[key] = Object.assign({}, stat);
      return;
    }
    merged[key] = {
      type: "number",
      min: Math.min(existing.min, stat.min),
      max: Math.max(existing.max, stat.max),
      sum: existing.sum + stat.sum,
      count: existing.count + stat.count,
    };
  });

  return merged;
}

function isFieldStat(stat) {
  return (
    stat != null &&
    typeof stat === "object" &&
    Number.isFinite(stat.min) &&
    Number.isFinite(stat.max) &&
    Number.isFinite(stat.sum) &&
    Number.isFinite(stat.count)
  );
}

/**
 * Add the derived `avg` to stored field statistics for API responses.
 * Stored form stays sum/count so it can keep merging.
 */
function withAverages(fieldStats) {
  if (fieldStats == null || typeof fieldStats !== "object") return null;
  const out = {};
  Object.keys(fieldStats).forEach((key) => {
    const stat = fieldStats[key];
    if (!isFieldStat(stat)) return;
    out[key] = Object.assign({}, stat, {
      avg: stat.count > 0 ? stat.sum / stat.count : null,
    });
  });
  return out;
}

module.exports = {
  SQL_NUMERIC_REGEX,
  STAT_AGGREGATES,
  MAX_STAT_FIELDS,
  sanitizeStatFields,
  buildStatsSelect,
  statAlias,
  readRowStats,
  collectFieldStats,
  mergeFieldStats,
  withAverages,
};
