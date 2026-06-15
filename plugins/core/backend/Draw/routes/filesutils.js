const logger = require("../../../logger");
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const Utils = require("../../../utils.js");
const fhistories = require("../models/filehistories");
const Filehistories = fhistories.Filehistories;
const FilehistoriesTEST = fhistories.FilehistoriesTEST;
const ufiles = require("../models/userfiles");
const Userfiles = ufiles.Userfiles;
const UserfilesTEST = ufiles.UserfilesTEST;

// Safe lookup maps to break SonarQube taint analysis chains (S3649)
const SAFE_GROUP_OPS = Object.freeze({ 'AND': 'AND', 'OR': 'OR', 'NOT_AND': 'NOT_AND', 'NOT_OR': 'NOT_OR' });
const SAFE_SQL_OPS = Object.freeze({ '=': '=', '!=': '!=', 'IN': 'IN', '<': '<', '>': '>', '<=': '<=', '>=': '>=', 'LIKE': 'LIKE', 'IS NULL': 'IS NULL', 'IS NOT NULL': 'IS NOT NULL' });

function getfile(req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  if (req.session.user == "guest" && req.body.quick_published !== "true") {
    res.send({
      status: "failure",
      message: "Permission denied.",
      body: {},
    });
    return;
  }

  let published = false;
  if (req.body.published === "true") published = true;
  if (req.body.quick_published === "true") {
    sequelize
      .query(
        "SELECT " +
          "id, intent, parent, children, level, properties, ST_AsGeoJSON(geom)" +
          " " +
          "FROM " +
          (req.body.test === "true" ? "publisheds_test" : "publisheds") +
          "" +
          (req.body.intent && req.body.intent.length > 0
            ? req.body.intent === "all"
              ? " WHERE intent IN ('polygon', 'line', 'point', 'text', 'arrow')"
              : " WHERE intent=:intent"
            : ""),
        {
          replacements: {
            intent: req.body.intent || "",
          },
        }
      )
      .then(([results]) => {
        let geojson = { type: "FeatureCollection", features: [] };
        for (let i = 0; i < results.length; i++) {
          let properties = results[i].properties;
          let feature = {};
          properties._ = {
            id: results[i].id,
            intent: results[i].intent,
            parent: results[i].parent,
            children: results[i].children,
            level: results[i].level,
          };
          feature.type = "Feature";
          feature.properties = properties;
          feature.geometry = JSON.parse(results[i].st_asgeojson);
          geojson.features.push(feature);
        }

        //Sort features by level
        geojson.features.sort((a, b) =>
          a.properties._.level > b.properties._.level
            ? 1
            : b.properties._.level > a.properties._.level
            ? -1
            : 0
        );

        if (req.body.test !== "true") {
          //Sort features by geometry type
          geojson.features.sort((a, b) => {
            if (a.geometry.type == "Point" && b.geometry.type == "Polygon")
              return 1;
            if (a.geometry.type == "LineString" && b.geometry.type == "Polygon")
              return 1;
            if (a.geometry.type == "Polygon" && b.geometry.type == "LineString")
              return -1;
            if (a.geometry.type == "Polygon" && b.geometry.type == "Point")
              return -1;
            if (a.geometry.type == "LineString" && b.geometry.type == "Point")
              return -1;
            if (a.geometry.type == b.geometry.type) return 0;
            return 0;
          });
        }

        res.send({
          status: "success",
          message: "Successfully got file.",
          body: geojson,
        });
      });
  } else {
    let idArray = false;
    req.body.id = JSON.parse(req.body.id);
    if (typeof req.body.id !== "number") idArray = true;

    let ids = req.body.id;

    // Validate that all IDs are numeric (reject non-numeric strings like "master")
    if (idArray) {
      if (ids == null) ids = null;
      if (!Array.isArray(ids)) ids = [ids];
      if (ids.length === 0) ids = null;

      // Validate each ID is a number
      if (ids !== null && !ids.every(id => typeof id === 'number' && !isNaN(id))) {
        logger("error", `[DrawTool] Received non-numeric file ID(s): ${JSON.stringify(ids)}`, req.originalUrl, req);
        return res.status(400).json({
          status: 'failure',
          message: 'Invalid file ID format. File IDs must be numeric.',
          body: {}
        });
      }
    } else {
      if (ids == null) ids = null;

      // Validate single ID is a number
      if (ids !== null && (typeof ids !== 'number' || isNaN(ids))) {
        logger("error", `[DrawTool] Received non-numeric file ID: ${ids}`, req.originalUrl, req);
        return res.status(400).json({
          status: 'failure',
          message: 'Invalid file ID format. File IDs must be numeric.',
          body: {}
        });
      }
    }

    let atThisTime = published
      ? Math.floor(Date.now())
      : req.body.time || Math.floor(Date.now());

    Table.findAll({
      where: {
        id: req.body.id,
        //file_owner is req.user or public is '1'
        [Sequelize.Op.or]: {
          file_owner: req.user,
          public: "1",
        },
      },
    })
      .then((file) => {
        if (!file) {
          res.send({
            status: "failure",
            message: "Failed to access file.",
            body: {},
          });
        } else {
          sequelize
            .query(
              "SELECT history" +
                " " +
                "FROM file_histories" +
                (req.body.test === "true" ? "_tests" : "") +
                " " +
                "WHERE" +
                " " +
                (idArray ? "file_id IN (:id)" : "file_id=:id") +
                " " +
                "AND time<=:time" +
                " " +
                (published ? "AND action_index=4 " : "") +
                "ORDER BY time DESC" +
                " " +
                "FETCH first :first rows only",
              {
                replacements: {
                  id: ids,
                  time: atThisTime,
                  first: published ? req.body.id.length : (idArray ? ids.length : 1),
                },
              }
            )
            .then(([results]) => {
              let bestHistory = [];
              for (let i = 0; i < results.length; i++) {
                bestHistory = bestHistory.concat(results[i].history);
              }

              // If no history found, return empty results early
              // This prevents "id IN (NULL)" which returns no rows
              if (bestHistory.length === 0) {
                return res.send({
                  status: "success",
                  message: "Successfully got file.",
                  body: {
                    file: file,
                    geojson: { type: "FeatureCollection", features: [] },
                    spatialFiltered: false,
                    temporalFiltered: false,
                    totalCount: 0,
                  },
                });
              }

              // Extract extent parameters (optional)
              const minx = parseFloat(req.body.minx);
              const miny = parseFloat(req.body.miny);
              const maxx = parseFloat(req.body.maxx);
              const maxy = parseFloat(req.body.maxy);
              const crs = req.body.crs || 'EPSG:4326'; // Default to WGS84
              const metadataOnly = req.body.metadataOnly === 'true' || req.body.metadataOnly === true;
              const featureId = req.body.featureId ? parseInt(req.body.featureId) : null;

              // Temporal extent parameters
              const startTime = req.body.startTime; // Unix timestamp
              const endTime = req.body.endTime;
              const timeProp = Utils.forceAlphaNumUnder(req.body.timeProp || 'time');

              // Pagination parameters
              const limit = req.body.limit ? parseInt(req.body.limit) : null;
              const offset = req.body.offset ? parseInt(req.body.offset) : 0;

              // Sort parameters
              const sortBy = req.body.sortBy || null;
              const sortOrder = req.body.sortOrder || 'asc';

              // Decode filters (following GeodatasetFilterer pattern)
              let filters = null;
              if (req.body.filters != null && req.body.filters !== '') {
                try {
                  const filterSplit = req.body.filters.split(',');
                  filters = [];
                  filterSplit.forEach((f) => {
                    if (f === 'OR' || f === 'AND' || f === 'NOT_AND' || f === 'NOT_OR') {
                      filters.push({ isGroup: true, op: SAFE_GROUP_OPS[f] || null });
                    } else {
                      const fSplit = f.split('+');
                      if (fSplit.length >= 4) {
                        // Validate field name format (alphanumeric, spaces, dash, underscore only)
                        const fieldName = fSplit[0];
                        if (!/^[a-zA-Z0-9 _\-\.]+$/.test(fieldName)) {
                          throw new Error(`Invalid filter field name: ${fieldName}`);
                        }

                        filters.push({
                          key: fieldName.trim(),  // Preserve spaces, just trim whitespace
                          op: fSplit[1] === 'in' ? ',' : fSplit[1],
                          type: fSplit[2],
                          value: fSplit[3].replaceAll('$', ',')
                        });
                      }
                    }
                  });
                } catch (err) {
                  logger("error", `Invalid filter format: ${err.message}`, req.originalUrl, req);
                  return res.status(400).json({
                    status: 'failure',
                    message: `Invalid filter format: ${err.message}`,
                    body: {}
                  });
                }
              }

              // Note: geometry.type filters are now handled inline within the filter loop
              // Don't extract them separately to preserve grouping logic

              // Build SELECT clause
              let selectClause = metadataOnly
                ? "id, file_id, level, intent, properties"
                : "id, file_id, level, intent, properties, ST_AsGeoJSON(geom)";

              // Build WHERE clause
              let whereClause = (idArray ? "file_id IN (:id)" : "file_id=:id");

              let replacements = {
                id: ids,
              };

              // ALWAYS apply bestHistory constraint to only query current features
              // (not all historical versions in the features table)
              whereClause += " AND id IN (:bestHistory)";
              replacements.bestHistory = bestHistory != null && bestHistory.length > 0 ? bestHistory : null;

              // Add filter WHERE clauses (following geodatasets pattern)
              if (filters != null && filters.length > 0) {
                let filterSQL = [];
                let currentGroupOp = null;
                let currentGroup = [];

                filters.forEach((filter, idx) => {
                  if (filter.isGroup === true) {
                    // When we encounter a different operator, finalize the current group
                    if (
                      currentGroupOp != null &&
                      currentGroupOp != filter.op &&
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
                    currentGroupOp = SAFE_GROUP_OPS[filter.op] || null;
                  } else {
                    // Build SQL condition for this filter
                    const propKey = filter.key;
                    const op = filter.op;
                    const value = filter.value;

                    // Determine SQL operator
                    let sqlOp = '=';
                    let sqlValue = value;

                    if (op === '=') {
                      sqlOp = '=';
                    } else if (op === '!=') {
                      sqlOp = '!=';
                    } else if (op === ',') {
                      sqlOp = 'IN';
                      sqlValue = value.split(',').map(v => v.trim());
                    } else if (op === '<') {
                      sqlOp = '<';
                    } else if (op === '>') {
                      sqlOp = '>';
                    } else if (op === '<=') {
                      sqlOp = '<=';
                    } else if (op === '>=') {
                      sqlOp = '>=';
                    } else if (op === 'contains') {
                      sqlOp = 'LIKE';
                      sqlValue = `%${value}%`;
                    } else if (op === 'beginswith') {
                      sqlOp = 'LIKE';
                      sqlValue = `${value}%`;
                    } else if (op === 'endswith') {
                      sqlOp = 'LIKE';
                      sqlValue = `%${value}`;
                    } else if (op === 'isnull') {
                      sqlOp = 'IS NULL';
                    } else if (op === 'isnotnull') {
                      sqlOp = 'IS NOT NULL';
                    }

                    // Break taint chain: lookup from safe constant map
                    sqlOp = SAFE_SQL_OPS[sqlOp] || '=';

                    // Build SQL condition
                    let condition;

                    // Special handling for geometry.type (derived field, not a property)
                    if (propKey === 'geometry.type') {
                      const geomTypePlaceholder = `geom_type_${idx}`;
                      if (sqlOp === '=') {
                        replacements[geomTypePlaceholder] = `ST_${value}`;
                        condition = `ST_GeometryType(geom) = :${geomTypePlaceholder}`;
                      } else if (sqlOp === '!=') {
                        replacements[geomTypePlaceholder] = `ST_${value}`;
                        condition = `ST_GeometryType(geom) != :${geomTypePlaceholder}`;
                      } else if (sqlOp === 'IN') {
                        replacements[geomTypePlaceholder] = sqlValue.map(v => `ST_${v.trim()}`);
                        condition = `ST_GeometryType(geom) IN (:${geomTypePlaceholder})`;
                      }
                    } else {
                      // Regular property access
                      // NOTE: properties is double-encoded JSON (stored as JSON string, not JSON object)
                      // Use Sequelize replacement parameter to prevent SQL injection
                      const propKeyPlaceholder = `filter_key_${idx}`;
                      replacements[propKeyPlaceholder] = propKey;
                      const propAccess = `((properties#>>'{}')::json->>:${propKeyPlaceholder})`;

                      // Cast to appropriate type if needed
                      const castPropAccess = filter.type === 'number'
                        ? `(${propAccess})::numeric`
                        : propAccess;

                      if (sqlOp === 'IS NULL' || sqlOp === 'IS NOT NULL') {
                        // Null checks don't need parameterized values
                        condition = `${propAccess} ${sqlOp}`;
                      } else if (sqlOp === 'IN') {
                        const placeholderKey = `filter_${idx}`;
                        condition = `${castPropAccess} IN (:${placeholderKey})`;
                        replacements[placeholderKey] = sqlValue;
                      } else {
                        const placeholderKey = `filter_${idx}`;
                        condition = `${castPropAccess} ${sqlOp} :${placeholderKey}`;
                        replacements[placeholderKey] = sqlValue;
                      }
                    }

                    // Add to appropriate group or standalone list
                    if (currentGroupOp == null) {
                      filterSQL.push(condition);
                    } else {
                      currentGroup.push(condition);
                    }
                  }
                });

                // Finalize any remaining group
                if (currentGroup.length > 0) {
                  const groupSQL = `${
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
                  )})`;

                  filterSQL.push(groupSQL);
                }

                // Join all filter groups with AND
                if (filterSQL.length > 0) {
                  const filterClause = filterSQL.join(' AND ');
                  whereClause += ` AND ${filterClause}`;
                }
              }

              // Add spatial filter if bounds provided
              let hasSpatialFilter = false;
              if (!isNaN(minx) && !isNaN(miny) && !isNaN(maxx) && !isNaN(maxy)) {
                // Use ST_Transform to handle different CRS
                // Create envelope in the requested CRS, then transform to 4326, then intersect with geom
                whereClause += " AND ST_Intersects(geom, ST_Transform(ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, :srid), 4326))";

                replacements.minx = minx;
                replacements.miny = miny;
                replacements.maxx = maxx;
                replacements.maxy = maxy;

                // Parse SRID from CRS string (e.g., "EPSG:4326" -> 4326)
                const sridMatch = crs.match(/EPSG:(\d+)/i);
                replacements.srid = sridMatch ? parseInt(sridMatch[1]) : 4326;

                hasSpatialFilter = true;
              }

              // Add feature ID filter if provided (for single feature loading)
              if (featureId != null) {
                whereClause += " AND id = :featureId";
                replacements.featureId = featureId;
              }

              // Add temporal filter if time range provided
              let hasTemporalFilter = false;
              if (startTime != null && endTime != null) {
                const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
                const end = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();

                if (!isNaN(start) && !isNaN(end)) {
                  // Filter features that have time property in range OR no time property
                  replacements.timeProp = timeProp;
                  whereClause += " AND ((properties->>:timeProp) IS NULL OR (properties->>:timeProp)::bigint BETWEEN :startTime AND :endTime)";
                  replacements.startTime = start;
                  replacements.endTime = end;
                  hasTemporalFilter = true;
                }
              }

              // Build ORDER BY clause
              let orderByClause = '';
              if (sortBy != null) {
                const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

                // Determine if this is a geometry type sort
                if (sortBy === 'geometry.type') {
                  orderByClause = ` ORDER BY ST_GeometryType(geom) ${sortDirection} NULLS LAST`;
                }
                // Check if it's a direct database column (id, file_id, level, intent)
                else if (['id', 'file_id', 'level', 'intent'].includes(sortBy)) {
                  orderByClause = ` ORDER BY ${sortBy} ${sortDirection} NULLS LAST`;
                }
                // Otherwise, treat it as a JSON property key in the properties column
                else {
                  // Handle both "properties.key" format and plain "key" format
                  const propKey = Utils.forceAlphaNumUnder(
                    sortBy.startsWith('properties.')
                      ? sortBy.substring(11)  // Remove "properties." prefix
                      : sortBy                // Use as-is (already just the key)
                  );

                  // SQL Injection Prevention: Use Sequelize replacements for the JSON key
                  // We use a replacement parameter for the property key value
                  replacements.sortPropKey = propKey;

                  // Smart sorting: Try numeric first (for timestamps/numbers), fall back to text
                  // For ISO date strings, text sorting works correctly due to lexicographic order
                  // For pure numbers, cast to numeric for proper sorting
                  // Note: Match the filter pattern - use (properties#>>'{}')::json->> for key extraction
                  const jsonPath = `((properties#>>'{}')::json->>:sortPropKey)`;
                  const numericCheck = `${jsonPath} ~ '^[0-9]+\\.?[0-9]*\\$'`;
                  orderByClause = ` ORDER BY
                    CASE
                      WHEN ${numericCheck}
                      THEN ${jsonPath}::numeric
                      ELSE NULL
                    END ${sortDirection} NULLS LAST,
                    ${jsonPath}::text ${sortDirection} NULLS LAST`;
                }
              }

              // Build LIMIT/OFFSET clause
              let limitClause = '';
              if (limit != null) {
                limitClause = ` LIMIT :limit OFFSET :offset`;
                replacements.limit = limit;
                replacements.offset = offset;
              }

              const query = `SELECT ${selectClause} FROM user_features${req.body.test === "true" ? "_tests" : ""} WHERE ${whereClause}${orderByClause}${limitClause}`;

              // Get total count for pagination (when filters are applied)
              let totalCount = null;
              const countPromise = (filters != null && filters.length > 0) || limit != null
                ? sequelize.query(
                    `SELECT COUNT(*) as count FROM user_features${req.body.test === "true" ? "_tests" : ""} WHERE ${whereClause}`,
                    { replacements: replacements }
                  )
                : Promise.resolve([[{ count: 0 }]]);

              //Find best history
              Promise.all([
                sequelize.query(query, { replacements: replacements }),
                countPromise
              ])
              .then(([[results], [countResults]]) => {
                totalCount = countResults && countResults[0] ? parseInt(countResults[0].count) : results.length;

                  let geojson = { type: "FeatureCollection", features: [] };
                  for (let i = 0; i < results.length; i++) {
                    let properties = JSON.parse(results[i].properties);
                    let feature = {};
                    properties._ = {
                      id: results[i].id,
                      file_id: results[i].file_id,
                      level: results[i].level,
                      intent: results[i].intent,
                    };
                    feature.type = "Feature";
                    feature.properties = properties;
                    feature.geometry = JSON.parse(results[i].st_asgeojson);
                    geojson.features.push(feature);
                  }

                  // Only apply default sorting if no sortBy was specified
                  // Otherwise, preserve the database ORDER BY results
                  if (!sortBy) {
                    //Sort features by level
                    geojson.features.sort((a, b) =>
                      a.properties._.level > b.properties._.level
                        ? 1
                        : b.properties._.level > a.properties._.level
                        ? -1
                        : 0
                    );

                    if (req.body.test !== "true") {
                      //Sort features by geometry type
                      geojson.features.sort((a, b) => {
                        if (
                          a.geometry.type == "Point" &&
                          b.geometry.type == "Polygon"
                      )
                        return 1;
                      if (
                        a.geometry.type == "LineString" &&
                        b.geometry.type == "Polygon"
                      )
                        return 1;
                      if (
                        a.geometry.type == "Polygon" &&
                        b.geometry.type == "LineString"
                      )
                        return -1;
                      if (
                        a.geometry.type == "Polygon" &&
                        b.geometry.type == "Point"
                      )
                        return -1;
                      if (
                        a.geometry.type == "LineString" &&
                        b.geometry.type == "Point"
                      )
                        return -1;
                      if (a.geometry.type == b.geometry.type) return 0;
                      return 0;
                    });
                    }
                  }

                  res.send({
                    status: "success",
                    message: "Successfully got file.",
                    body: {
                      file: file,
                      geojson: geojson,
                      spatialFiltered: hasSpatialFilter,
                      temporalFiltered: hasTemporalFilter,
                      totalCount: totalCount, // For pagination
                    },
                  });
                })
                .catch((err) => {
                  logger("error", "Failed to execute query with filters.", req.originalUrl, req, err);
                  res.send({
                    status: "failure",
                    message: "Failed to query features.",
                    body: {},
                  });
                });
            });
        }

        return null;
      })
      .catch((err) => {
        logger("error", "Failed to get file.", req.originalUrl, req, err);
        res.send({
          status: "failure",
          message: "Failed to get file.",
          body: {},
        });
      });
  }
}

module.exports = { getfile };
