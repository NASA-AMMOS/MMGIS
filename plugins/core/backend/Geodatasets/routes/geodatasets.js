/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const { sequelize } = require("../../../../../API/connection");

const logger = require("../../../../../API/logger");
const Utils = require("../../../../../API/utils.js");
const geodatasets = require("../models/geodatasets");
const Geodatasets = geodatasets.Geodatasets;
const makeNewGeodatasetTable = geodatasets.makeNewGeodatasetTable;
const updateGeodatasetFieldStats = geodatasets.updateGeodatasetFieldStats;

const { jsonbAccessor, jsonbAccessorText } = require("../lib/jsonb");
const {
  sanitizeStatFields,
  buildStatsSelect,
  readRowStats,
  collectFieldStats,
  withAverages,
} = require("../lib/stats");

//Returns a geodataset table as a geojson
router.get("/get/:layer", function (req, res, next) {
  get("get", req, res, next, { layer: req.params.layer });
});
router.get("/get", function (req, res, next) {
  get("get", req, res, next);
});

function get(reqtype, req, res, next, options) {
  let layer = null;
  let type = "geojson";
  let xyz = {};
  let _source = null; // Works just like ES _source
  let stats = null; // Fields to compute per-group numeric statistics for
  let noDuplicates = false;
  let get_group_id = null;
  let get_id = null;
  let filters = null;
  let spatialFilter = null; // Not implemented
  let paginationLimit = null;
  let paginationOffset = null;

  if (reqtype === "post") {
    layer = req.body.layer;
    type = req.body.type || type;
    if (req.body._source && Array.isArray(req.body._source))
      _source = req.body._source;

    if (req.body.stats && Array.isArray(req.body.stats)) stats = req.body.stats;
    else if (req.body.stats && typeof req.body.stats === "string")
      stats = req.body.stats.split(",");

    if (req.body.noDuplicates === true || req.body.noDuplicates === "true")
      noDuplicates = true;

    if (req.body.group_id != null) get_group_id = req.body.group_id;
    if (req.body.id != null) get_id = req.body.id;
    if (req.body.filters != null) filters = req.body.filters;
    if (req.body.spatialFilter != null) spatialFilter = req.body.spatialFilter;
    if (req.body.limit != null) { const _parsed = parseInt(req.body.limit); paginationLimit = Number.isNaN(_parsed) ? null : Math.min(Math.max(_parsed, 1), 10000); }
    if (req.body.offset != null) { const _parsed = parseInt(req.body.offset); paginationOffset = Number.isNaN(_parsed) ? 0 : Math.max(_parsed, 0); }

    if (type === "mvt") {
      xyz = {
        x: parseInt(req.body.x),
        y: parseInt(req.body.y),
        z: parseInt(req.body.z),
      };
    }
  } else if (reqtype === "get") {
    layer = (options && options.layer) || req.query.layer;
    type = req.query.type || type;
    if (req.query._source && typeof req.query._source === "string")
      _source = req.query._source.split(",");
    else if (req.query._source && Array.isArray(req.query._source))
      _source = req.query._source;

    if (req.query.stats && typeof req.query.stats === "string")
      stats = req.query.stats.split(",");
    else if (req.query.stats && Array.isArray(req.query.stats))
      stats = req.query.stats;

    if (req.query.noDuplicates === true || req.query.noDuplicates === "true")
      noDuplicates = true;

    if (req.query.group_id != null) get_group_id = req.query.group_id;
    if (req.query.id != null) get_id = req.query.id;
    if (req.query.filters != null) {
      const filterSplit = req.query.filters.split(",");
      filters = [];
      filterSplit.forEach((f) => {
        if (f === "OR" || f === "AND" || f === "NOT_AND" || f === "NOT_OR") {
          filters.push({
            isGroup: true,
            op: f,
          });
        } else {
          const fSplit = f.split("+");
          filters.push({
            key: fSplit[0],
            op: fSplit[1],
            type: fSplit[2],
            value: fSplit.slice(3).join("+"),
          });
        }
      });
    }
    if (req.query.spatialFilter != null) {
      const spatialFilterSplit = req.query.spatialFilter.split(",");
      spatialFilter = {
        lat: spatialFilterSplit[0],
        lng: spatialFilterSplit[1],
        radius: spatialFilterSplit[2],
      };
    }
    if (req.query.limit != null) { const _parsed = parseInt(req.query.limit); paginationLimit = Number.isNaN(_parsed) ? null : Math.min(Math.max(_parsed, 1), 10000); }
    if (req.query.offset != null) { const _parsed = parseInt(req.query.offset); paginationOffset = Number.isNaN(_parsed) ? 0 : Math.max(_parsed, 0); }

    if (type === "mvt") {
      xyz = {
        x: parseInt(req.query.x),
        y: parseInt(req.query.y),
        z: parseInt(req.query.z),
      };
    }
  }

  // Sanitize _source entries - allow alphanumeric, underscores, dots (path separator), and hyphens
  if (_source && Array.isArray(_source)) {
    _source = _source
      .map((s) => Utils.forceAlphaNumUnder(s, [".", "-"]))
      .filter(Boolean);
    if (_source.length === 0) _source = null;
  }

  // Sanitized the same way as _source. Only geojson responses carry stats.
  stats = sanitizeStatFields(stats);

  //First Find the table name
  Geodatasets.findOne({ where: { name: layer } })
    .then(async (result) => {
      if (result) {
        let table = result.dataValues.table;
        if (type === "geojson") {
          let properties = "properties";
          if (Array.isArray(_source)) {
            properties = `jsonb_build_object(
            ${_source
              .map((v, i) => {
                if (["feature_id", "group_id"].indexOf(v) === -1) {
                  let toReturn = `:prop_${i}, properties`;
                  const vSplit = v.split(".");
                  vSplit.forEach((vs, idx) => {
                    toReturn += ` -> :prop_${i}_${idx}`;
                  });
                  return toReturn;
                } else return "";
              })
              .filter(Boolean)
              .join(",")} 
            ) AS properties`;
          }

          // Per-group statistics. Grouping matches noDuplicates' notion of a
          // group (group_id when the geodataset has one, else identical geom)
          // whether or not noDuplicates is on.
          const groupField =
            result.dataValues.group_id_field != null ? "group_id" : "geom";
          const statsSelect = buildStatsSelect(stats, groupField);
          // A single feature's statistics still describe its group, so the
          // query aggregates the group and picks the feature out afterwards.
          // One row comes back either way, so there's nothing to deduplicate.
          const statsOuterId = statsSelect.text !== "" && get_id != null && get_group_id == null;

          let distinct = "";
          let distinctField = null;
          if (noDuplicates === true && !statsOuterId) {
            if (result.dataValues.group_id_field != null) {
              distinct = ` DISTINCT ON (group_id)`;
              distinctField = "group_id";
            } else {
              distinct = ` DISTINCT ON (geom)`;
              distinctField = "geom";
            }
          }

          let cols = ["id"];
          if (result.dataValues.group_id_field != null) cols.push("group_id");
          if (result.dataValues.feature_id_field != null)
            cols.push("feature_id");
          cols = cols.join(", ");

          let q = `SELECT${distinct} ${properties}, ST_AsGeoJSON(geom), ${cols}, start_time, end_time${
            statsSelect.text
          } FROM ${Utils.forceAlphaNumUnder(table)}`;

          let hasBounds = false;
          let minx = req.query?.minx;
          let miny = req.query?.miny;
          let maxx = req.query?.maxx;
          let maxy = req.query?.maxy;
          if (minx != null && miny != null && maxx != null && maxy != null) {
            // ST_MakeEnvelope is (xmin, ymin, xmax, ymax, srid)
            q += ` WHERE ST_Intersects(ST_MakeEnvelope(${Utils.forceAlphaNumUnder(
              parseFloat(minx)
            )}, ${Utils.forceAlphaNumUnder(
              parseFloat(miny)
            )}, ${Utils.forceAlphaNumUnder(
              parseFloat(maxx)
            )}, ${Utils.forceAlphaNumUnder(parseFloat(maxy))}, 4326), geom)`;
            hasBounds = true;
          }
          let startProp = "start_time";
          let start_time = "";
          let endProp = "end_time";
          let end_time = "";
          if (req.query?.endtime != null) {
            const starttime = typeof req.query?.starttime === 'string' ? req.query.starttime : null;
            const endtime = typeof req.query?.endtime === 'string' ? req.query.endtime : null;
            const format = typeof req.query?.format === 'string' ? req.query.format : "YYYY-MM-DDTHH:MI:SSZ";
            let t = ` `;
            if (!hasBounds) t += `WHERE `;
            else t += `AND `;

            if (
              starttime == null ||
              starttime.indexOf(`'`) != -1 ||
              endtime == null ||
              endtime.indexOf(`'`) != -1 ||
              format.indexOf(`'`) != -1
            ) {
              res.send({
                status: "failure",
                message: "Missing or malformed time parameters.",
              });
              return;
            }

            start_time = new Date(
              starttime || "1970-01-01T00:00:00Z"
            ).getTime();
            end_time = new Date(endtime).getTime();

            startProp = Utils.forceAlphaNumUnder(
              req.query.startProp || startProp
            );
            endProp = Utils.forceAlphaNumUnder(req.query.endProp || endProp);

            // Validate against dynamically queried column names
            try {
              const tableColumns = await sequelize.getQueryInterface().describeTable(Utils.forceAlphaNumUnder(table));
              const allowedColumns = Object.keys(tableColumns);
              if (!allowedColumns.includes(startProp)) startProp = 'start_time';
              if (!allowedColumns.includes(endProp)) endProp = 'end_time';
            } catch (_e) {
              // If describeTable fails, fall back to defaults
              startProp = 'start_time';
              endProp = 'end_time';
            }

            // prettier-ignore
            t += [
              `((`,
                `${startProp} IS NOT NULL AND ${endProp} IS NOT NULL AND`, 
                  ` ${startProp} >= :start_time`,
                  ` AND ${endProp} <= :end_time`,
              `)`,
              ` OR `,
              `(`,
                `${startProp} IS NULL AND ${endProp} IS NOT NULL AND`,
                  ` ${endProp} >= :start_time`,
                  ` AND ${endProp} <= :end_time`,
              `)`,
              ` OR `,
              `(`,
                `${startProp} IS NULL AND ${endProp} IS NULL`,
              `))`
          ].join('')
            q += t;
          }

          if (get_group_id != null) {
            q += `${
              q.indexOf(" WHERE ") === -1 ? " WHERE " : " AND "
            }group_id = :get_group_id`;
          } else if (get_id != null) {
            q += `${q.indexOf(" WHERE ") === -1 ? " WHERE " : " AND "}${
              statsOuterId
                ? // Its group rather than the feature itself: the aggregates
                  // are windows over what the WHERE clause leaves.
                  `${groupField} = (SELECT ${groupField} FROM ${Utils.forceAlphaNumUnder(
                    table
                  )} WHERE id = :get_id)`
                : `id = :get_id`
            }`;
          }

          const replacements = {
            start_time: start_time,
            end_time: end_time,
            get_group_id: get_group_id,
            get_id: get_id,
            ...statsSelect.replacements,
          };

          if (Array.isArray(_source)) {
            _source.forEach((v, i) => {
              const vSplit = v.split(".");
              vSplit.forEach((vs, idx) => {
                replacements[`prop_${i}_${idx}`] = vs;
              });
              replacements[`prop_${i}`] = v;
            });
          }

          // Filters
          if (filters != null && filters.length > 0) {
            let filterSQL = [];
            let currentGroupOp = null;
            let currentGroup = [];

            filters.forEach((f, i) => {
              if (f.isGroup === true) {
                if (
                  currentGroupOp != null &&
                  currentGroupOp != f.op &&
                  currentGroup.length > 0
                ) {
                  filterSQL.push(
                    `${
                      currentGroupOp == "NOT_AND" || currentGroupOp == "NOT_OR"
                        ? "NOT "
                        : ""
                    }(${currentGroup.join(
                      ` ${
                        currentGroupOp == "NOT_AND"
                          ? "AND"
                          : currentGroupOp == "NOT_OR"
                          ? "OR"
                          : currentGroupOp
                      } `
                    )})`
                  );
                  currentGroup = [];
                }
                currentGroupOp = f.op;
              } else {
                let fkey = f.key;
                let derivedKey = false;
                if (fkey === "Latitude (Centroid)") {
                  fkey = `ST_Y(ST_Centroid(geom))`;
                  derivedKey = true;
                } else if (fkey === "Longitude (Centroid)") {
                  fkey = `ST_X(ST_Centroid(geom))`;
                  derivedKey = true;
                }

                // Build JSONB accessor (supports nested keys like "a.b.c")
                const acc = derivedKey ? { text: fkey, replacements: {} } : jsonbAccessor(fkey, `filter_key_${i}`);
                Object.assign(replacements, acc.replacements);
                replacements[`filter_value_${i}`] = f.value;
                const propAccessor = acc.text;

                let op = "=";
                switch (f.op) {
                  case ">":
                    op = ">";
                    break;
                  case "<":
                    op = "<";
                    break;
                  case ">=":
                    op = ">=";
                    break;
                  case "<=":
                    op = "<=";
                    break;
                  case "in":
                    op = "IN";
                    break;
                  case "contains":
                  case "beginswith":
                  case "endswith":
                    op = "LIKE";
                    break;
                  case "!=":
                    op = "!=";
                    break;
                  case "regex":
                    op = "~*";
                    if (typeof f.value === 'string' && f.value.length > 200) {
                      f.value = f.value.substring(0, 200);
                    }
                    break;
                  case "isnull":
                    op = "IS NULL";
                    break;
                  case "isnotnull":
                    op = "IS NOT NULL";
                    break;
                  case "=":
                  default:
                    break;
                }
                let value = "";
                if (op === "IS NULL" || op === "IS NOT NULL") {
                  const qNull = `${
                    derivedKey === true ? `${fkey}` : propAccessor
                  } ${op}`;
                  if (currentGroupOp == null) filterSQL.push(qNull);
                  else currentGroup.push(qNull);
                  return;
                } else if (op === "IN") {
                  const valueSplit = f.value.split("$");
                  const values = [];
                  valueSplit.forEach((v) => {
                    replacements[`filter_value_${i}_${v}`] = v;
                    values.push(`:filter_value_${i}_${v}`);
                  });
                  value = `(${values.join(",")})`;
                } else if (op === "LIKE") {
                  if (f.op == "contains")
                    replacements[`filter_value_${i}`] = `%${f.value}%`;
                  else if (f.op == "beginswith")
                    replacements[`filter_value_${i}`] = `${f.value}%`;
                  else if (f.op == "endswith")
                    replacements[`filter_value_${i}`] = `%${f.value}`;

                  value = `:filter_value_${i}`;
                } else {
                  replacements[`filter_value_${i}`] = f.value;
                  value = `:filter_value_${i}`;
                }
                if (f.type === "number" && op !== "LIKE") {
                  const q1 = `${
                    derivedKey === true
                      ? `${fkey}`
                      : `(${propAccessor})`
                  }::FLOAT ${op} ${value}`;
                  if (currentGroupOp == null) filterSQL.push(q1);
                  else currentGroup.push(q1);
                } else {
                  const q2 = `${
                    derivedKey === true ? `${fkey}` : propAccessor
                  } ${op} ${value}`;
                  if (currentGroupOp == null) filterSQL.push(q2);
                  else currentGroup.push(q2);
                }
              }
            });
            // Final group
            if (currentGroup.length > 0) {
              filterSQL.push(
                `${
                  currentGroupOp == "NOT_AND" || currentGroupOp == "NOT_OR"
                    ? "NOT "
                    : ""
                }(${currentGroup.join(
                  ` ${
                    currentGroupOp === "NOT_AND"
                      ? "AND"
                      : currentGroupOp === "NOT_OR"
                      ? "OR"
                      : currentGroupOp || "AND"
                  } `
                )})`
              );
            }
            if (filterSQL.length > 0)
              q += `${
                q.indexOf(" WHERE ") === -1 ? " WHERE " : " AND "
              }${filterSQL.join(` AND `)}`;
          }

          if (
            spatialFilter?.lat != null &&
            spatialFilter?.lng != null &&
            spatialFilter?.radius != null
          ) {
            // prettier-ignore
            q += `${
              q.indexOf(" WHERE ") === -1 ? " WHERE " : " AND "
            }ST_Intersects(
              geom,
              ST_Transform(
                ST_Buffer(
                  ST_Transform(
                    ST_SetSRID(ST_MakePoint(${parseFloat(spatialFilter.lng)}, ${parseFloat(spatialFilter.lat)}), 4326), 3857
                  ),
                  ${parseFloat(spatialFilter.radius)}
                ),
                4326
              ))`;
          }

          if (statsOuterId)
            q = `SELECT * FROM (${q}) AS grouped WHERE id = :get_id`;

          if (req.query?.limited) {
            q += ` ORDER BY id DESC LIMIT 3;`;
          } else if (distinctField != null) {
            q += ` ORDER BY ${distinctField}, id DESC`;
            if (Number.isFinite(paginationLimit) && paginationLimit > 0) {
              q += ` LIMIT :paginationLimit`;
              replacements.paginationLimit = paginationLimit;
              if (Number.isFinite(paginationOffset) && paginationOffset >= 0) {
                q += ` OFFSET :paginationOffset`;
                replacements.paginationOffset = paginationOffset;
              }
            }
            q += `;`;
          } else {
            q += ` ORDER BY id DESC`;
            if (Number.isFinite(paginationLimit) && paginationLimit > 0) {
              q += ` LIMIT :paginationLimit`;
              replacements.paginationLimit = paginationLimit;
              if (Number.isFinite(paginationOffset) && paginationOffset >= 0) {
                q += ` OFFSET :paginationOffset`;
                replacements.paginationOffset = paginationOffset;
              }
            }
            q += `;`;
          }

          sequelize
            .query(q, {
              replacements: replacements,
            })
            .then(([results]) => {
              let geojson = { type: "FeatureCollection", features: [] };
              for (let i = 0; i < results.length; i++) {
                let properties = results[i].properties;
                properties._ = properties._ || {};
                properties._.idx = results[i].id;
                if (stats != null) {
                  const rowStats = readRowStats(results[i], stats);
                  if (rowStats != null) properties._.stats = rowStats;
                }
                if (results[i].start_time != null)
                  properties._.start_time = results[i].start_time;
                if (results[i].end_time != null)
                  properties._.end_time = results[i].end_time;
                let feature = {};
                feature.type = "Feature";
                feature.properties = properties;
                if (Array.isArray(_source)) {
                  if (_source.indexOf("group_id") !== -1)
                    feature.properties.group_id = results[i].group_id;
                  if (_source.indexOf("feature_id") !== -1)
                    feature.properties.feature_id =
                      result.dataValues.feature_id_field != null
                        ? results[i].feature_id
                        : results[i].id;

                  _source.forEach((s) => {
                    if (s && s.split(".").length > 1) {
                      const savedValue = feature.properties[s];
                      delete feature.properties[s];
                      Utils.setIn2(feature.properties, s, savedValue, true);
                    }
                  });
                }
                feature.geometry = JSON.parse(results[i].st_asgeojson);
                geojson.features.push(feature);
              }
              if (get_id != null)
                geojson.feature_id_field = result.dataValues.feature_id_field;
              if (get_group_id != null)
                geojson.group_id_field = result.dataValues.group_id_field;

              if (
                paginationLimit != null &&
                Number.isFinite(paginationLimit) &&
                paginationLimit > 0
              ) {
                geojson.limit = paginationLimit;
                geojson.offset = paginationOffset || 0;
              }

              res.setHeader("Access-Control-Allow-Origin", "*");

              if (reqtype == "post") {
                res.send({
                  status: "success",
                  body: geojson,
                });
              } else {
                res.send(geojson);
              }

              return null;
            })
            .catch((err) => {
              logger(
                "error",
                "Geodataset query SQL error.",
                req.originalUrl,
                req,
                err
              );
              res.send({
                status: "failure",
                message: "Failed to query Geodataset.",
              });
            });
        } else if (
          type == "mvt" &&
          xyz.x != null &&
          xyz.y != null &&
          xyz.z != null
        ) {
          let ne = {
            lat: tile2Lat(xyz.y, xyz.z),
            lng: tile2Lng(xyz.x + 1, xyz.z),
          };
          let sw = {
            lat: tile2Lat(xyz.y + 1, xyz.z),
            lng: tile2Lng(xyz.x, xyz.z),
          };

          //We make these slightly large bounds for our initial bounds of data,
          //This lets ST_AsMvtGeom properly use its bounds ability
          let oLat = Math.abs(ne.lat - sw.lat) / (4096 / 256);
          let oLng = Math.abs(ne.lng - sw.lng) / (4096 / 256);
          let ne2 = { lat: ne.lat + oLat, lng: ne.lng + oLng };
          let sw2 = { lat: sw.lat - oLat, lng: sw.lng - oLng };

          sequelize
            .query(
              "SELECT ST_AsMVT(q, " +
                ":layer" +
                ", 4096, 'geommvt') " +
                "FROM (" +
                "SELECT " +
                "id, " +
                "properties, " +
                "ST_AsMvtGeom(" +
                "geom," +
                "ST_MakeEnvelope(" +
                Utils.forceAlphaNumUnder(parseFloat(sw.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(sw.lat)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne.lat)) +
                ", 4326)," +
                "4096," +
                "256," +
                "true" +
                ") AS geommvt " +
                "FROM " +
                Utils.forceAlphaNumUnder(table) +
                " " +
                "WHERE geom && ST_MakeEnvelope(" +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lat)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lat)) +
                ", 4326) " +
                "AND ST_Intersects(geom, ST_MakeEnvelope(" +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(sw2.lat)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lng)) +
                "," +
                Utils.forceAlphaNumUnder(parseFloat(ne2.lat)) +
                ", 4326))" +
                ") AS q;",
              {
                replacements: {
                  layer: layer,
                },
              }
            )
            .then(([results]) => {
              res.setHeader("Content-Type", "application/x-protobuf");
              res.setHeader("Access-Control-Allow-Origin", "*");

              if (reqtype == "post") {
                res.send({
                  status: "success",
                  body: results,
                });
              } else {
                res.send(Buffer.from(results[0].st_asmvt, "binary"));
              }
              return null;
            })
            .catch((err) => {
              logger(
                "error",
                "Geodataset SQL error.",
                req.originalUrl,
                req,
                err
              );
              res.send({ status: "failure", message: "SQL error" });
            });
        } else {
          res.send({
            status: "failure",
            message: "Unknown type or missing xyz.",
          });
        }
      } else {
        res.send({ status: "failure", message: "Not Found" });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failure finding geodataset.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failure finding geodataset." });
    });
}

router.post("/intersect", function (req, res, next) {
  let layer = req.body.layer;
  let noDuplicates = null;

  if (req.body.noDuplicates === true || req.body.noDuplicates === "true")
    noDuplicates = true;

  //First Find the table name
  Geodatasets.findOne({ where: { name: layer } })
    .then(async (result) => {
      if (result) {
        let table = result.dataValues.table;

        let distinct = "";
        if (noDuplicates === true) {
          if (result.dataValues.group_id_field != null)
            distinct = ` DISTINCT ON (group_id)`;
          else distinct = ` DISTINCT ON (geom)`;
        }

        let q = `SELECT${distinct} properties, ST_AsGeoJSON(geom) FROM ${Utils.forceAlphaNumUnder(
          table
        )}`;

        // Intersect
        q += ` WHERE ST_Intersects(geom, ST_GeomFromGeoJSON(:intersect))`;

        let startProp = "start_time";
        let start_time = "";
        let endProp = "end_time";
        let end_time = "";
        if (req.body?.endtime != null) {
          const starttime = typeof req.body?.starttime === 'string' ? req.body.starttime : null;
          const endtime = typeof req.body?.endtime === 'string' ? req.body.endtime : null;
          const format = typeof req.body?.format === 'string' ? req.body.format : "YYYY-MM-DDTHH:MI:SSZ";
          let t = ` `;
          t += `AND `;

          if (
            starttime == null ||
            starttime.indexOf(`'`) != -1 ||
            endtime == null ||
            endtime.indexOf(`'`) != -1 ||
            format.indexOf(`'`) != -1
          ) {
            res.send({
              status: "failure",
              message: "Missing or malformed time parameters.",
            });
            return;
          }

          start_time = new Date(
            starttime || "1970-01-01T00:00:00Z"
          ).getTime();
          end_time = new Date(endtime).getTime();

          startProp = Utils.forceAlphaNumUnder(req.body.startProp || startProp);
          endProp = Utils.forceAlphaNumUnder(req.body.endProp || endProp);

          // Validate against dynamically queried column names
          try {
            const tableColumns = await sequelize.getQueryInterface().describeTable(Utils.forceAlphaNumUnder(table));
            const allowedColumns = Object.keys(tableColumns);
            if (!allowedColumns.includes(startProp)) startProp = 'start_time';
            if (!allowedColumns.includes(endProp)) endProp = 'end_time';
          } catch (_e) {
            // If describeTable fails, fall back to defaults
            startProp = 'start_time';
            endProp = 'end_time';
          }
          // prettier-ignore
          t += [
              `((`,
                `${startProp} IS NOT NULL AND ${endProp} IS NOT NULL AND`, 
                  ` ${startProp} >= :start_time`,
                  ` AND ${endProp} <= :end_time`,
              `)`,
              ` OR `,
              `(`,
                `${startProp} IS NULL AND ${endProp} IS NOT NULL AND`,
                  ` ${endProp} >= :start_time`,
                  ` AND ${endProp} <= :end_time`,
              `)`,
              ` OR `,
              `(`,
                `${startProp} IS NULL AND ${endProp} IS NULL`,
              `))`
          ].join('')
          q += t;
        }

        const replacements = {
          intersect:
            typeof req.body.intersect === "string"
              ? req.body.intersect
              : JSON.stringify(req.body.intersect),
          start_time: start_time,
          end_time: end_time,
        };

        q += `;`;

        sequelize
          .query(q, {
            replacements: replacements,
          })
          .then(([results]) => {
            let geojson = { type: "FeatureCollection", features: [] };
            for (let i = 0; i < results.length; i++) {
              let properties = results[i].properties;
              properties._ = properties._ || {};
              properties._.idx = results[i].id;
              let feature = {};
              feature.type = "Feature";
              feature.properties = properties;

              feature.geometry = JSON.parse(results[i].st_asgeojson);
              geojson.features.push(feature);
            }

            res.setHeader("Access-Control-Allow-Origin", "*");

            res.send({
              status: "success",
              body: geojson,
            });

            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "Geodataset query SQL error.",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "Failed to query Geodataset.",
            });
          });
      } else {
        res.send({ status: "failure", message: "Not Found" });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failure finding geodataset.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failure finding geodataset." });
    });
});

/*
req.query.layer
req.query.limit
req.query.minx
req.query.miny
req.query.maxx
req.query.maxy
req.query.starttime
req.query.endtime
*/
router.get("/aggregations", function (req, res, next) {
  //First Find the table name
  Geodatasets.findOne({ where: { name: req.query.layer } })
    .then(async (result) => {
      if (result) {
        let table = result.dataValues.table;
        let q = `SELECT properties FROM ${Utils.forceAlphaNumUnder(table)}`;

        let hasBounds = false;
        let minx = req.query?.minx;
        let miny = req.query?.miny;
        let maxx = req.query?.maxx;
        let maxy = req.query?.maxy;
        if (minx != null && miny != null && maxx != null && maxy != null) {
          // ST_MakeEnvelope is (xmin, ymin, xmax, ymax, srid)
          q += ` WHERE ST_Intersects(ST_MakeEnvelope(${Utils.forceAlphaNumUnder(
            parseFloat(minx)
          )}, ${Utils.forceAlphaNumUnder(
            parseFloat(miny)
          )}, ${Utils.forceAlphaNumUnder(
            parseFloat(maxx)
          )}, ${Utils.forceAlphaNumUnder(parseFloat(maxy))}, 4326), geom)`;
          hasBounds = true;
        }
        let startProp = "start_time";
        let start_time = "";
        let endProp = "end_time";
        let end_time = "";
        if (req.query?.endtime != null) {
          const starttime = typeof req.query?.starttime === 'string' ? req.query.starttime : null;
          const endtime = typeof req.query?.endtime === 'string' ? req.query.endtime : null;
          const format = typeof req.query?.format === 'string' ? req.query.format : "YYYY-MM-DDTHH:MI:SSZ";
          let t = ` `;
          if (!hasBounds) t += `WHERE `;
          else t += `AND `;

          if (
            starttime == null ||
            starttime.indexOf(`'`) != -1 ||
            endtime == null ||
            endtime.indexOf(`'`) != -1 ||
            format.indexOf(`'`) != -1
          ) {
            res.send({
              status: "failure",
              message: "Missing or malformed time parameters.",
            });
            return;
          }

          start_time = new Date(
            starttime || "1970-01-01T00:00:00Z"
          ).getTime();
          end_time = new Date(endtime).getTime();

          startProp = Utils.forceAlphaNumUnder(
            req.query.startProp || startProp
          );
          endProp = Utils.forceAlphaNumUnder(req.query.endProp || endProp);

          // Validate against dynamically queried column names
          try {
            const tableColumns = await sequelize.getQueryInterface().describeTable(Utils.forceAlphaNumUnder(table));
            const allowedColumns = Object.keys(tableColumns);
            if (!allowedColumns.includes(startProp)) startProp = 'start_time';
            if (!allowedColumns.includes(endProp)) endProp = 'end_time';
          } catch (_e) {
            // If describeTable fails, fall back to defaults
            startProp = 'start_time';
            endProp = 'end_time';
          }
          // prettier-ignore
          t += [
            `((`,
              `${startProp} IS NOT NULL AND ${endProp} IS NOT NULL AND`, 
                ` ${startProp} >= :start_time`,
                ` AND ${endProp} <= :end_time`,
            `)`,
            ` OR `,
            `(`,
              `${startProp} IS NULL AND ${endProp} IS NOT NULL AND`,
                ` ${endProp} >= :start_time`,
                ` AND ${endProp} <= :end_time`,
            `)`,
            ` OR `,
            `(`,
              `${startProp} IS NULL AND ${endProp} IS NULL`,
            `))`
        ].join('')
          q += t;
        }

        q += ` ORDER BY RANDOM() DESC LIMIT :limit;`;

        sequelize
          .query(q, {
            replacements: {
              limit: req.query.limit != null ? parseInt(req.query.limit) : 500,
              start_time: start_time,
              end_time: end_time,
            },
          })
          .then(([results]) => {
            let aggs = {};
            // Recursively aggregate values from nested objects
            function aggProps(obj, prefix) {
              for (let p in obj) {
                let value = obj[p];
                const fullKey = prefix ? `${prefix}.${p}` : p;
                if (
                  value != null &&
                  typeof value === "object" &&
                  !Array.isArray(value)
                ) {
                  aggProps(value, fullKey);
                  continue;
                }
                let type = null;

                if (!isNaN(value) && !isNaN(parseFloat(value))) type = "number";
                else if (typeof value === "string") type = "string";
                else if (typeof value === "number") type = "number";
                else if (typeof value === "boolean") type = "boolean";

                if (type != null) {
                  aggs[fullKey] = aggs[fullKey] || { type: type, aggs: {} };
                  if (aggs[fullKey].type === "number" && type === "string")
                    aggs[fullKey].type = type;
                  aggs[fullKey].aggs[value] = aggs[fullKey].aggs[value] || 0;
                  aggs[fullKey].aggs[value]++;
                }
              }
            }
            results.forEach((feature) => {
              if (feature.properties) aggProps(feature.properties, "");
            });

            // sort
            Object.keys(aggs).forEach((agg) => {
              const sortedAggs = {};
              Object.keys(aggs[agg].aggs)
                .sort()
                .reverse()
                .forEach((agg2) => {
                  sortedAggs[agg2] = aggs[agg].aggs[agg2];
                });
              aggs[agg].aggs = sortedAggs;
            });
            aggs["Latitude (Centroid)"] = {
              type: "number",
              aggs: {},
            };
            aggs["Longitude (Centroid)"] = {
              type: "number",
              aggs: {},
            };

            res.send({ status: "success", aggregations: aggs });
          })
          .catch((err) => {
            logger(
              "error",
              "Failure querying geodataset aggregations.",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "Failure querying geodataset aggregations.",
            });
          });
      } else {
        res.send({ status: "failure", message: "Not Found" });
      }
      return null;
    })
    .catch((err) => {
      logger("error", "Failure finding geodataset.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failure finding geodataset." });
    });
});

// Bulk schema endpoint — returns field names, types and source layers for
// multiple geodataset layers in a single call.
// GET /api/geodatasets/schema?layers=layer1,layer2,...
router.get("/schema", function (req, res, next) {
  const layersParam = req.query.layers;
  if (!layersParam) {
    res.send({ status: "failure", message: "Missing 'layers' parameter." });
    return;
  }

  const layerNames = layersParam
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  if (layerNames.length === 0) {
    res.send({ status: "failure", message: "No valid layer names provided." });
    return;
  }

  // Cap at 100 layers to prevent abuse
  const cappedLayerNames = layerNames.slice(0, 100);

  const Op = require("sequelize").Op;
  Geodatasets.findAll({ where: { name: { [Op.in]: cappedLayerNames } } })
    .then(async (results) => {
      if (!results || results.length === 0) {
        res.send({ status: "success", schema: {}, field_stats: {} });
        return;
      }

      // schema: { fieldName: { type, layers: [{ name, displayName }] } }
      const schema = {};
      // field_stats: { layerName: { fieldName: { type, min, max, sum, sumsq,
      // count, nullCount, avg, stddev } } }
      // Dataset-wide, so unlike `schema` (sampled) it covers every feature.
      const field_stats = {};
      results.forEach((result) => {
        const stats = withAverages(
          result.dataValues.field_stats,
          result.dataValues.num_features
        );
        if (stats != null && Object.keys(stats).length > 0)
          field_stats[result.dataValues.name] = stats;
      });
      const promises = results.map((result) => {
        const table = result.dataValues.table;
        const layerName = result.dataValues.name;
        // Sample multiple rows to discover JSONB keys and types
        const q = `SELECT properties FROM ${Utils.forceAlphaNumUnder(
          table
        )} LIMIT 50`;
        return sequelize
          .query(q)
          .then(([rows]) => {
            const seenKeys = new Set();
            // Recursively discover keys from nested objects
            function discoverKeys(obj, prefix) {
              for (const key in obj) {
                const value = obj[key];
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (value == null) continue;
                if (
                  typeof value === "object" &&
                  !Array.isArray(value)
                ) {
                  discoverKeys(value, fullKey);
                  continue;
                }
                let type = "string";
                if (typeof value === "number") type = "number";
                else if (typeof value === "boolean") type = "boolean";
                else if (!isNaN(value) && !isNaN(parseFloat(value)))
                  type = "number";

                if (!schema[fullKey]) {
                  schema[fullKey] = { type: type, layers: [] };
                }
                if (
                  schema[fullKey].type === "number" &&
                  type === "string"
                ) {
                  schema[fullKey].type = type;
                }
                if (!seenKeys.has(fullKey)) {
                  schema[fullKey].layers.push(layerName);
                  seenKeys.add(fullKey);
                }
              }
            }
            rows.forEach((row) => {
              if (!row.properties) return;
              discoverKeys(row.properties, "");
            });
          })
          .catch(() => {
            // Skip layers that fail
          });
      });

      await Promise.all(promises);

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send({ status: "success", schema: schema, field_stats: field_stats });
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failure querying geodataset schema.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: "Failure querying geodataset schema.",
      });
    });
});

// Bulk aggregations endpoint — returns aggregated field values across
// multiple geodataset layers in a single call.
// GET /api/geodatasets/bulk_aggregations?layers=layer1,layer2,...&limit=500
router.get("/bulk_aggregations", function (req, res, next) {
  const layersParam = req.query.layers;
  if (!layersParam) {
    res.send({ status: "failure", message: "Missing 'layers' parameter." });
    return;
  }

  const layerNames = layersParam
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  if (layerNames.length === 0) {
    res.send({ status: "failure", message: "No valid layer names provided." });
    return;
  }

  const cappedLayerNames = layerNames.slice(0, 100);
  const _sl = req.query.limit != null ? parseInt(req.query.limit) : 500;
  const sampleLimit = Number.isNaN(_sl) ? 500 : Math.min(Math.max(_sl, 1), 1000);

  const Op = require("sequelize").Op;
  Geodatasets.findAll({ where: { name: { [Op.in]: cappedLayerNames } } })
    .then(async (results) => {
      if (!results || results.length === 0) {
        res.send({ status: "success", aggregations: {} });
        return;
      }

      // Optional time filtering
      const starttime = req.query.starttime;
      const endtime = req.query.endtime;
      const startProp = req.query.startProp || "start_time";
      const endProp = req.query.endProp || "end_time";

      const aggs = {};
      const allRows = [];
      const promises = results.map((result) => {
        const table = result.dataValues.table;
        let q = `SELECT properties FROM ${Utils.forceAlphaNumUnder(table)}`;
        const replacements = { limit: sampleLimit };

        // Add time bounds WHERE clause when provided.
        // Time fields are top-level table columns (not inside JSONB properties).
        if (starttime && endtime) {
          const spSafe = Utils.forceAlphaNumUnder(startProp);
          const epSafe = Utils.forceAlphaNumUnder(endProp);
          q += ` WHERE ${spSafe} >= :starttime AND ${epSafe} <= :endtime`;
          replacements.starttime = new Date(starttime).getTime();
          replacements.endtime = new Date(endtime).getTime();
        }

        q += ` ORDER BY RANDOM() DESC LIMIT :limit;`;
        return sequelize
          .query(q, { replacements })
          .then(([rows]) => {
            // Recursively aggregate values from nested objects
            function aggProps(obj, prefix) {
              for (let p in obj) {
                let value = obj[p];
                const fullKey = prefix ? `${prefix}.${p}` : p;
                if (
                  value != null &&
                  typeof value === "object" &&
                  !Array.isArray(value)
                ) {
                  aggProps(value, fullKey);
                  continue;
                }
                let type = null;

                if (!isNaN(value) && !isNaN(parseFloat(value))) type = "number";
                else if (typeof value === "string") type = "string";
                else if (typeof value === "number") type = "number";
                else if (typeof value === "boolean") type = "boolean";

                if (type != null) {
                  aggs[fullKey] = aggs[fullKey] || { type: type, aggs: {} };
                  if (aggs[fullKey].type === "number" && type === "string")
                    aggs[fullKey].type = type;
                  aggs[fullKey].aggs[value] = aggs[fullKey].aggs[value] || 0;
                  aggs[fullKey].aggs[value]++;
                }
              }
            }
            rows.forEach((row) => {
              if (row.properties) {
                aggProps(row.properties, "");
                allRows.push(row.properties);
              }
            });
          })
          .catch(() => {
            // Skip layers that fail
          });
      });

      await Promise.all(promises);

      // Sort values within each field
      Object.keys(aggs).forEach((agg) => {
        const sortedAggs = {};
        Object.keys(aggs[agg].aggs)
          .sort()
          .reverse()
          .forEach((agg2) => {
            sortedAggs[agg2] = aggs[agg].aggs[agg2];
          });
        aggs[agg].aggs = sortedAggs;
      });

      res.send({ status: "success", aggregations: aggs, rows: allRows });
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failure querying bulk geodataset aggregations.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: "Failure querying bulk geodataset aggregations.",
      });
    });
});

//Returns a list of entries in the geodatasets table
router.post("/entries", function (req, res, next) {
  Geodatasets.findAll()
    .then((sets) => {
      if (sets && sets.length > 0) {
        let entries = [];
        for (let i = 0; i < sets.length; i++) {
          entries.push({
            name: sets[i].name,
            updated: sets[i].updatedAt,
            filename: sets[i].filename,
            num_features: sets[i].num_features,
            start_time_field: sets[i].start_time_field,
            end_time_field: sets[i].end_time_field,
            group_id_field: sets[i].group_id_field,
            feature_id_field: sets[i].feature_id_field,
            field_stats: withAverages(sets[i].field_stats, sets[i].num_features),
          });
        }
        // For each entry, list all occurrences in latest configuration objects
        sequelize
          .query(
            `
            SELECT t1.*
            FROM configs AS t1
            INNER JOIN (
                SELECT mission, MAX(version) AS max_version
                FROM configs
                GROUP BY mission
            ) AS t2
            ON t1.mission = t2.mission AND t1.version = t2.max_version ORDER BY mission ASC;
            `
          )
          .then(([results]) => {
            // Populate occurrences
            results.forEach((m) => {
              Utils.traverseLayers(m.config.layers, (layer, path) => {
                entries.forEach((entry) => {
                  entry.occurrences = entry.occurrences || {};
                  entry.occurrences[m.mission] =
                    entry.occurrences[m.mission] || [];
                  if (layer.url === `geodatasets:${entry.name}`) {
                    entry.occurrences[m.mission].push({
                      name: layer.name,
                      uuid: layer.uuid,
                      path: path,
                    });
                  }
                });
              });
            });

            res.send({
              status: "success",
              body: { entries: entries },
            });
            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "Failed to find missions.",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "Failed to find missions.",
            });
            return null;
          });
      } else {
        res.send({
          status: "failure",
        });
      }
    })
    .catch((err) => {
      logger(
        "error",
        "Failure finding geodatasets.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
      });
    });
});

/*
 * req.body.layer
 * req.body.key
 * req.body.value
 * req.body.id (specific feature id instead of key:value)
 * req.body.orderBy
 * req.body.restrictToGeometryType
 * req.body.offset (i.e. if -1, then return feature previous to key:val) (can also be 'first' or 'last')
 */
router.post("/search", function (req, res, next) {
  //First Find the table name
  Geodatasets.findOne({ where: { name: req.body.layer } })
    .then((result) => {
      if (result) {
        let table = result.dataValues.table;

        let offset = req.body.offset;
        const origOffset = offset;
        if (offset === "first") offset = -1;
        else if (offset === "last") offset = 1;

        let featureId = req.body.id;

        if (offset != null && featureId == null) {
          res.send({
            status: "failure",
            message: "If 'offset' is set, 'id' must also be set.",
          });
          return;
        }
        offset = offset != null ? parseInt(offset) : null;
        featureId = featureId != null ? parseInt(featureId) : null;

        let orderBy = "id";
        if (req.body.orderBy != null) orderBy = `properties->>:orderBy`;

        let minx = req.body?.minx;
        let miny = req.body?.miny;
        let maxx = req.body?.maxx;
        let maxy = req.body?.maxy;
        let where = "";
        if (minx != null && miny != null && maxx != null && maxy != null) {
          // ST_MakeEnvelope is (xmin, ymin, xmax, ymax, srid)
          where = ` WHERE ST_Intersects(ST_MakeEnvelope(${Utils.forceAlphaNumUnder(
            parseFloat(minx)
          )}, ${Utils.forceAlphaNumUnder(
            parseFloat(miny)
          )}, ${Utils.forceAlphaNumUnder(
            parseFloat(maxx)
          )}, ${Utils.forceAlphaNumUnder(parseFloat(maxy))}, 4326), geom)`;
        }

        const geometryTypes = [
          "Point",
          "LineString",
          "Polygon",
          "MultiPoint",
          "MultiLineString",
          "MultiPolygon",
        ];

        const hasGeomTypeFilter =
          geometryTypes.indexOf(req.body.restrictToGeometryType) != -1;
        const geomTypeAnd = hasGeomTypeFilter
          ? " AND geometry_type = :geomtype"
          : "";

        // Build operator clause for search (supports nested keys via jsonbAccessor)
        const validOps = ["=", "!=", "<", ">", "<=", ">=", "contains", "beginswith", "endswith", ",", "in", "isnull", "isnotnull", "regex"];
        let searchOp = req.body.operator || "=";
        if (validOps.indexOf(searchOp) === -1) searchOp = "=";
        const allowedOps = ["=", "!=", "<", ">", "<=", ">="];
        const searchKey = req.body.key || "";
        const keyAcc = jsonbAccessor(searchKey, "key");
        const keyExpr = keyAcc.text; // e.g. "properties->>'name'" or "properties->'meta'->>'author'"
        let opClause;

        if (allowedOps.indexOf(searchOp) !== -1) {
          opClause = `${keyExpr} ${searchOp} :value`;
        } else if (searchOp === "contains") {
          opClause = `${keyExpr} ILIKE '%' || :value || '%'`;
        } else if (searchOp === "beginswith") {
          opClause = `${keyExpr} ILIKE :value || '%'`;
        } else if (searchOp === "endswith") {
          opClause = `${keyExpr} ILIKE '%' || :value`;
        } else if (searchOp === "," || searchOp === "in") {
          opClause = `${keyExpr} IN (:valueList)`;
        } else if (searchOp === "regex") {
          opClause = `${keyExpr} ~* :value`;
        } else if (searchOp === "isnull") {
          opClause = `${keyExpr} IS NULL`;
        } else if (searchOp === "isnotnull") {
          opClause = `${keyExpr} IS NOT NULL`;
        } else {
          opClause = `${keyExpr} = :value`;
        }

        // For numeric operators, cast to numeric only when the field type is number
        if (["<", ">", "<=", ">="].indexOf(searchOp) !== -1 && req.body.type === "number") {
          opClause = `(${keyExpr})::NUMERIC ${searchOp} :value::NUMERIC`;
        }

        let q =
          `SELECT properties, ST_AsGeoJSON(geom), id, start_time, end_time FROM ${Utils.forceAlphaNumUnder(
            table
          )}` +
          (req.body.last || offset != null
            ? `${where || (hasGeomTypeFilter ? ' WHERE geometry_type = :geomtype' : '')}${where ? geomTypeAnd : ''} ORDER BY id ${
                offset != null && !req.body.last ? "ASC" : "DESC LIMIT 1"
              }`
            : ` WHERE ${opClause}${geomTypeAnd}`);

        const sanitizedValue =
          typeof req.body.value === "string"
            ? req.body.value
            : null;

        const replacements = {
          orderBy: orderBy || "id",
          geomtype: req.body.restrictToGeometryType,
          value: sanitizedValue,
          ...keyAcc.replacements,
        };

        // For IN operator, split value by comma into a list
        if (searchOp === "," || searchOp === "in") {
          const parsedList = sanitizedValue
            ? sanitizedValue.split(",").map((v) => v.trim()).filter(Boolean)
            : [];
          replacements.valueList = parsedList.length > 0 ? parsedList : [""];
        }

        // For regex operator, cap length to prevent ReDoS and strip delimiters
        if (searchOp === "regex" && sanitizedValue) {
          let regexValue = sanitizedValue;
          if (regexValue.length > 200) regexValue = regexValue.substring(0, 200);
          replacements.value = regexValue;
          const regexMatch = regexValue.match(/^\/(.+)\/([gimsuy]*)$/);
          if (regexMatch) {
            replacements.value = regexMatch[1];
            // Use case-sensitive (~) if no 'i' flag, case-insensitive (~*) otherwise
            if (!regexMatch[2].includes("i")) {
              opClause = `${keyExpr} ~ :value`;
              // Rebuild query with updated opClause
              q = `SELECT properties, ST_AsGeoJSON(geom), id, start_time, end_time FROM ${Utils.forceAlphaNumUnder(
                table
              )}` +
              (req.body.last || offset != null
                ? `${where || (hasGeomTypeFilter ? ' WHERE geometry_type = :geomtype' : '')}${where ? geomTypeAnd : ''} ORDER BY id ${
                    offset != null && !req.body.last ? "ASC" : "DESC LIMIT 1"
                  }`
                : ` WHERE ${opClause}${geomTypeAnd}`);
            }
          }
        }

        sequelize
          .query(q + ";", {
            replacements,
          })
          .then(([results]) => {
            let r = [];
            for (let i = 0; i < results.length; i++) {
              let properties = results[i].properties;
              properties._ = properties._ || {};
              properties._.idx = results[i].id;
              // Include time columns so clients can check whether a
              // feature falls within the active time range.
              if (results[i].start_time != null)
                properties._.start_time = results[i].start_time;
              if (results[i].end_time != null)
                properties._.end_time = results[i].end_time;
              let feature = {};
              feature.type = "Feature";
              feature.properties = properties;
              feature.geometry = JSON.parse(results[i].st_asgeojson);
              r.push(feature);
            }

            if (offset != null) {
              if (orderBy != "id") {
                r.sort((a, b) => {
                  let sign = 1;
                  if (offset > 0) sign = -1;
                  const af = Utils.getIn(a, `properties.${orderBy}`, 0);
                  const bf = Utils.getIn(b, `properties.${orderBy}`, 1);
                  if (typeof af === "string" || typeof bf === "string") {
                    return af.localeCompare(bf) * sign;
                  } else return (af - bf) * sign;
                });
              }

              const rLen = r.length;
              if (origOffset === "first" || origOffset === "last") {
                r = [r[rLen - 1]];
              } else {
                for (let i = 0; i < rLen; i++) {
                  if (r[i].properties._.idx === featureId) {
                    r = [
                      r[Math.min(Math.max(0, i + Math.abs(offset)), rLen - 1)],
                    ]; //abs because we already sort differently by it
                    break;
                  }
                }
              }
            }

            res.send({
              status: "success",
              body: r,
            });

            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "SQL error search through geodataset.",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "SQL error.",
            });
          });
      } else {
        res.send({
          status: "failure",
          message: "Layer not found.",
        });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failure finding geodataset.", req.originalUrl, req, err);
      res.send({
        status: "failure",
      });
    });
});

router.post("/append/:name", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: req.query.start_prop || null,
    endProp: req.query.end_prop || null,
    groupIdProp: req.query.group_id_prop || null,
    featureIdProp: req.query.feature_id_prop || null,
    filename: req.query.filename || null,
    geojson: typeof req.body === "string" ? JSON.parse(req.body) : req.body,
    action: "append",
  };
  recreate(req, res, next);
});

router.post("/append/:name/:start_end_prop", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: req.params.start_end_prop.split(",")[0] || null,
    endProp: req.params.start_end_prop.split(",")[1] || null,
    groupIdProp: null,
    featureIdProp: null,
    geojson: req.body,
    action: "append",
  };
  recreate(req, res, next);
});

router.post("/recreate/:name", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: null,
    endProp: null,
    groupIdProp: null,
    featureIdProp: null,
    geojson: req.body,
    action: "recreate",
  };
  recreate(req, res, next);
});

router.post("/recreate/:name/:start_end_prop", function (req, res, next) {
  req.body = {
    name: req.params.name,
    startProp: req.params.start_end_prop.split(",")[0] || null,
    endProp: req.params.start_end_prop.split(",")[1] || null,
    groupIdProp: null,
    featureIdProp: null,
    geojson: req.body,
    action: "recreate",
  };
  recreate(req, res, next);
});

router.post("/recreate", function (req, res, next) {
  recreate(req, res, next);
});

function recreate(req, res, next) {
  let startProp = req.body.startProp;
  let endProp = req.body.endProp;
  let groupIdProp = req.body.groupIdProp;
  let featureIdProp = req.body.featureIdProp;
  let filename = req.body.filename;

  let features = null;
  try {
    features =
      typeof req.body.geojson === "string"
        ? JSON.parse(req.body.geojson).features
        : req.body.geojson.features;
  } catch (err) {
    logger("error", "Failure: Malformed file.", req.originalUrl, req, err);
    res.send({
      status: "failure",
      message: "Failure: Malformed file.",
      body: {},
    });
  }
  if (!features) {
    //Must be a single feature from an append.  Make an array
    features = [JSON.parse(req.body.geojson)];
  } else {
    startProp = req?.body?.geojson?.startProp || startProp;
    endProp = req?.body?.geojson?.endProp || endProp;
    groupIdProp = req?.body?.geojson?.groupIdProp || groupIdProp;
    featureIdProp = req?.body?.geojson?.featureIdProp || featureIdProp;
  }

  if (startProp == "") startProp = null;
  if (endProp == "") endProp = null;
  if (groupIdProp == "") groupIdProp = null;
  if (featureIdProp == "") featureIdProp = null;

  makeNewGeodatasetTable(
    req.body.name,
    filename,
    features.length,
    startProp,
    endProp,
    groupIdProp,
    featureIdProp,
    req?.body?.action || null,
    function (result) {
      let checkEnding = result.table.split("_");
      if (checkEnding[checkEnding.length - 1] !== "geodatasets") {
        logger("error", "Malformed table name.", req.originalUrl, req);
        res.send({
          status: "failed",
          message: "Malformed table name",
        });
        return;
      }

      let drop_qry = `TRUNCATE TABLE ${Utils.forceAlphaNumUnder(
        result.table
      )} RESTART IDENTITY`;
      if (req.body.hasOwnProperty("action") && req.body.action == "append") {
        drop_qry = "";
      }

      sequelize
        .query(drop_qry, {
          replacements: {},
        })
        .then(() => {
          populateGeodatasetTable(
            result.tableObj,
            features,
            startProp,
            endProp,
            groupIdProp,
            featureIdProp,
            function (success) {
              res.send({
                status: success == true ? "success" : "failure",
                message: "",
                body: {},
              });
            },
            {
              name: result.name,
              // An append that created the geodataset holds all of its
              // features, so its statistics replace rather than merge.
              action: result.existed ? req?.body?.action || null : null,
            }
          );

          return null;
        })
        .catch((err) => {
          logger("error", "Recreation error.", req.originalUrl, req, err.stack);
          res.send(result);
        });
    },
    function (result) {
      res.send(result);
    }
  );
}

function populateGeodatasetTable(
  Table,
  features,
  startProp,
  endProp,
  groupIdProp,
  featureIdProp,
  cb,
  options
) {
  let rows = [];

  for (var i = 0; i < features.length; i++) {
    let start_time =
      startProp != null
        ? Utils.getIn(features[i].properties, startProp, null)
        : null;
    if (start_time != null) {
      start_time = new Date(start_time).getTime();
      start_time = isNaN(start_time) ? null : start_time;
    }
    let end_time =
      endProp != null
        ? Utils.getIn(features[i].properties, endProp, null)
        : null;
    if (end_time != null) {
      end_time = new Date(end_time).getTime();
      end_time = isNaN(end_time) ? null : end_time;
    }

    // group_id can be comma-separated to merge various props into one. i.e. "track,frame"
    let group_id = null;
    if (groupIdProp != null) {
      const vals = [];
      groupIdProp.split(",").forEach((v) => {
        vals.push(Utils.getIn(features[i].properties, v, null));
      });
      group_id = vals.join("_");
      if (group_id == "") group_id = null;
      if (group_id != null) {
        group_id = String(group_id);
      }
    }

    // feature_id can be comma-separated to merge various props into one. i.e. "track,id"
    let feature_id = null;
    if (featureIdProp != null) {
      const vals = [];
      featureIdProp.split(",").forEach((v) => {
        vals.push(Utils.getIn(features[i].properties, v, null));
      });
      feature_id = vals.join("_");
      if (feature_id == "") feature_id = null;
      if (feature_id != null) {
        feature_id = String(feature_id);
      }
    }

    const row = {
      properties: features[i].properties,
      geometry_type: features[i].geometry.type,
      geom: {
        crs: { type: "name", properties: { name: "EPSG:4326" } },
        type: features[i].geometry.type,
        coordinates: features[i].geometry.coordinates,
      },
    };

    if (startProp) row.start_time = start_time;
    if (endProp) row.end_time = end_time;
    if (groupIdProp) row.group_id = group_id;
    if (featureIdProp) row.feature_id = feature_id;

    rows.push(row);
  }

  Table.bulkCreate(rows, { returning: true })
    .then(function (response) {
      sequelize
        .query(`VACUUM ANALYZE ${Utils.forceAlphaNumUnder(Table.tableName)};`, {
          replacements: {},
        })
        .then(async () => {
          // Dataset-wide statistics of every numeric property. Metadata only:
          // a failure here does not fail the write.
          if (options && options.name) {
            try {
              await updateGeodatasetFieldStats(
                options.name,
                collectFieldStats(features),
                options.action
              );
            } catch (statsErr) {
              logger(
                "error",
                "Geodatasets: Failed to compute field statistics.",
                null,
                null,
                statsErr
              );
            }
          }
          cb(true);
          return null;
        })
        .catch((err) => {
          logger(
            "error",
            "Geodatasets: Failed to vacuum a geodataset spatial index!",
            null,
            null,
            err
          );
          cb(false);
          return null;
        });
    })
    .catch(function (err) {
      logger(
        "error",
        "Geodatasets: Failed to populate a geodataset table!",
        null,
        null,
        err
      );
      cb(false);
      return null;
    });
}

router.delete("/remove/:name", function (req, res, next) {
  Geodatasets.findOne({ where: { name: req.params.name } })
    .then((result) => {
      if (result) {
        sequelize
          .query(
            `DROP TABLE IF EXISTS ${Utils.forceAlphaNumUnder(
              result.dataValues.table
            )};`,
            {
              replacements: {},
            }
          )
          .then(() => {
            Geodatasets.destroy({ where: { name: req.params.name } })
              .then(() => {
                logger(
                  "info",
                  `Successfully deleted geodataset '${req.params.name}'.`
                );
                res.send({
                  status: "success",
                  message: `Successfully deleted geodataset '${req.params.name}'.`,
                });
              })
              .catch((err) => {
                logger(
                  "error",
                  `Failed to delete geodataset table entry '${req.params.name}'.`,
                  "geodatasets",
                  null,
                  err
                );
                res.send({
                  status: "failure",
                  message: `Failed to delete geodataset entry '${req.params.name}'.`,
                });
                return null;
              });
            return null;
          })
          .catch((err) => {
            logger(
              "error",
              `Failed to delete geodataset table '${req.params.name}'.`,
              "geodatasets",
              null,
              err
            );
            res.send({
              status: "failure",
              message: `Failed to delete geodataset '${req.params.name}'.`,
            });
            return null;
          });
      } else {
        logger(
          "info",
          `Tried to delete nonexistent geodataset table: ${req.params.name}`,
          "geodatasets",
          null,
          err
        );
        res.send({
          status: "failure",
          message: `No geodataset named '${req.params.name}' to delete.`,
        });
        return null;
      }
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to find existing geodatasets.",
        "geodatasets",
        null,
        err
      );
      res.send({
        status: "failure",
        message: "Failed to find existing geodatasets",
        error: err,
        name: req.params.name,
      });
      return null;
    });
});

function tile2Lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2Lat(y, z) {
  let n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

module.exports = router;
module.exports.populateGeodatasetTable = populateGeodatasetTable;
