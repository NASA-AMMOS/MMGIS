/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/

const express = require("express");
const logger = require("../../../logger");
const database = require("../../../database");
const User = require("../../Users/models/user");

const router = express.Router();
const db = database.db;

/**
 * A get call to the API to get all the records from waypoints table
 * as a GeoJSON format.
 * This get call also retrieves all the records from terrain table
 * and returns the result as a GeoJSON format.
 * Also, it gets all the records from traverse table
 * and return the result as a GeoJSON format layer.
 *
 * Test link: http://localhost:3000/apis/layer=waypoints
 */
router.get("/layer=:layer_name", function(req, res, next) {
  let layerName = req.params.layer_name;
  let query_1 =
    "SELECT 'SELECT ' || array_to_string(ARRAY(" +
    "SELECT 'S' || '.' || c.column_name FROM information_schema.columns As c WHERE table_name = '" +
    layerName +
    "' AND  c.column_name NOT IN('geom') ), ',') || ' FROM " +
    layerName +
    " As S' As sqlstmt;";

  db.any(query_1)
    .then(function(d1) {
      // Check the result
      let queryTOexecute = d1[0].sqlstmt;
      let query_2 =
        " SELECT 'FeatureCollection' As type, array_to_json(array_agg(f))" +
        " As features FROM ( SELECT 'Feature' As type, ST_AsGeoJSON(sec1.geom)::json As geometry, " +
        "row_to_json(sec2) As properties FROM " +
        layerName +
        " AS sec1 INNER JOIN (" +
        queryTOexecute +
        ") AS sec2 ON sec1.id = sec2.id) As f;";

      // console.log("Second Query: ", query_2)

      db.any(query_2)
        .then(function(d2) {
          res.send(d2[0]);
        })
        .catch(function(err) {
          return next(err);
        });
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * Get the elevation of all targets form associated table in ascending order.
 *
 * Test link: http://localhost:3000/apis/all_targets_elev
 */
router.get("/all_targets_elev/", function(req, res, next) {
  // A query to get elevation of targets from targets table
  let query =
    "SELECT ST_Z(geom) AS elevation FROM targets ORDER BY elevation ASC;";

  db.any(query)
    .then(function(result) {
      let data = [];

      for (let i in result) {
        data.push(parseFloat(result[i].elevation));
      }

      let numOfBins = 80;
      let minElev = parseFloat(data[0]);
      let maxElev = parseFloat(data[data.length - 1]);
      let diffBetweenMinMax = Math.abs(maxElev - minElev);

      let binSize = diffBetweenMinMax / numOfBins;
      let lowerElev = minElev;
      let binCount = 0;
      let d = 0;
      let bin = [];
      let dataPoints = [];

      while (d <= data.length) {
        // Set a variable for the current elevation
        let currElev = data[d];

        // If the current elevation is in the range, store it in an array
        if (lowerElev <= currElev && currElev < lowerElev + binSize) {
          bin.push(currElev);
        }

        // If the current elevation is greater than upper range elevation
        // it jumps to the next bin container
        if (currElev >= lowerElev + binSize) {
          while (currElev >= lowerElev + binSize) {
            // Store the previous record
            dataPoints.push({
              Bin: bin,
              NumOfPoints: bin.length,
              BinIndex: binCount
            });

            lowerElev = lowerElev + binSize;
            // Reset the values
            bin = [];
            // lowerElev = lowerElev + binSize;
            binCount++;
          }
        }
        d++;
      }

      // Send the result back to the front-end
      res.send({
        totalPoints: data.length,
        min_elev: minElev,
        max_elev: maxElev,
        data_points: dataPoints
      });
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * A get call to the API to retrieve all the layers from database.
 * Test link: http://localhost:3000/apis/all_layers
 */
router.get("/all_layers/", function(req, res, next) {
  let query = "SELECT layer_name, layer_type, table_name_refered FROM layers;";

  db.any(query)
    .then(function(data) {
      // Check the result
      res.send(data);
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * This part of the API will retrieve all the targets name
 * from database and returns the result to the front-end, the
 * query tool interface.
 * Test link: http://localhost:3000/apis/all_targets
 */
router.get("/all_targets", function(req, res, next) {
  let query =
    "SELECT row_to_json(fc) FROM (SELECT 'FeatureCollection' As type, " +
    "array_to_json(array_agg(f)) As features FROM ( SELECT 'Feature' As type, " +
    "ST_AsGeoJSON(tar1.geom)::json As geometry, row_to_json(tar2) As properties " +
    "FROM targets As tar1 INNER JOIN ( SELECT target_plan, sol, rmc, " +
    "EASTING_M, NORTHING_M, ELEV_M, LON_DD, LAT_DD, X, Y, Z, U, V, W, I, J, Image_ID, Notes " +
    "FROM targets) As tar2 ON tar1.target_plan = tar2.target_plan ) As f)  As fc;";
  // Get the data from database
  db.any(query)
    .then(function(data) {
      res.send(data[0].row_to_json);
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * This part of the API will retrieve all the targets name
 * from database and returns the result to the front-end, the
 * query tool interface.
 * Test link: http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/all_targets_name
 */
router.get(
  "/uid=:user_id/tkn=:token/all_targets_name",
  checkAuthentication,
  function(req, res, next) {
    let query = "SELECT target_plan FROM Targets;";
    // Get the data from database
    db.any(query)
      .then(function(data) {
        res.send(data);
      })
      .catch(function(err) {
        return next(err);
      });
  }
);

/**
 * An API to get all targets that are in the bounding box "bbox",
 * Test link: http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/bbox=137.3423,-4.5956,137.5508,-4.7469
 */
router.get("/uid=:user_id/tkn=:token/bbox=:bbox", checkAuthentication, function(
  req,
  res,
  next
) {
  let bbox = req.params.bbox;

  let query =
    "SELECT row_to_json(fc) FROM (SELECT 'FeatureCollection' As type, " +
    "array_to_json(array_agg(f)) As features FROM ( SELECT 'Feature' As type, " +
    "ST_AsGeoJSON(tar1.geom)::json As geometry, row_to_json(tar2) As properties " +
    'FROM public."targets" As tar1 INNER JOIN ( ' +
    'SELECT "targets".target_plan, "targets".sol, "targets".rmc, "targets".image_id ' +
    'FROM public."targets" WHERE "targets".geom && ST_MakeEnvelope(' +
    bbox +
    ",4326)) As tar2 ON tar1.target_plan = tar2.target_plan ) As f)  As fc;";

  // Get the data from database
  db.any(query)
    .then(function(data) {
      res.send(data[0].row_to_json);
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * An API to get all targets that have certain amount of a material observed by Chemcam instrument,
 * Note that, the user ID and token string is taken out for this version but, eventually can be
 * implemented in the product version.
 * Test link: http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/bbox=137.3423,-4.5956,137.5508,-4.7469/inst=ccam&mat=sio2&op=geq&amont=40.0
 */
router.get(
  "/uid=:user_id/tkn=:token/bbox=:bbox/inst=:instrument&mat=:material&op=:operand&amont=:amount",
  checkAuthentication,
  function(req, res, next) {
    // Available materials in the data_ccam table
    let chemcam_materials = [
      "sio2",
      "tio2",
      "al2o3",
      "feot",
      "mgo",
      "cao",
      "na2o",
      "k2o"
    ];
    let apxs_materials = [
      "na2o",
      "mgo",
      "al2o3",
      "sio2",
      "p2o5",
      "so3",
      "cl",
      "k2o",
      "cao",
      "tio2",
      "cr2o3",
      "mno",
      "feo",
      "ni",
      "zn",
      "br"
    ];

    let requestedItems = {
      BoundingBox: req.params.bbox,
      Instrument: req.params.instrument,
      Material: req.params.material,
      Operand: req.params.operand === "geq" ? ">=" : "<=",
      Amount: req.params.amount
    };

    let query = "";

    switch (requestedItems.Instrument) {
      case "ccam":
        if (!chemcam_materials.includes(requestedItems.Material)) {
          res.send({
            Material: requestedItems.Material,
            Message: "Error: The material is not avalable in our records!"
          });
        } else {
          query =
            "SELECT row_to_json(fc) FROM " +
            "( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features" +
            " FROM ( SELECT 'Feature' As type, ST_AsGeoJSON(tar1.geom)::json As geometry, row_to_json(tar2) As properties" +
            " FROM targets As tar1 INNER JOIN (SELECT tar.target_plan, tar.sol, tar.rmc, tar.image_id, chc." +
            requestedItems.Material +
            " FROM targets AS tar, data_" +
            requestedItems.Instrument +
            " AS chc WHERE tar.target_plan = chc.target_plan AND " +
            requestedItems.Material +
            " " +
            requestedItems.Operand +
            " " +
            requestedItems.Amount +
            " GROUP BY tar.target_plan, chc." +
            requestedItems.Material +
            ") As tar2 ON tar1.target_plan = tar2.target_plan ) As f)  As fc;";
        }
        break;
      case "apxs":
        if (!apxs_materials.includes(requestedItems.Material)) {
          res.send({
            Material: requestedItems.Material,
            Message: "Error: The material is not avalable in our records!"
          });
        } else {
          query =
            "SELECT row_to_json(fc) FROM " +
            "( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features" +
            " FROM ( SELECT 'Feature' As type, ST_AsGeoJSON(tar1.geom)::json As geometry, row_to_json(tar2) As properties" +
            " FROM targets As tar1 INNER JOIN (SELECT tar.target_plan, tar.sol, tar.rmc, tar.image_id, chc." +
            requestedItems.Material +
            " FROM targets AS tar, data_chemcam AS chc WHERE tar.target_plan = chc.target_plan AND " +
            requestedItems.Material +
            " " +
            requestedItems.Operand +
            " " +
            requestedItems.Amount +
            " GROUP BY tar.target_plan, chc." +
            requestedItems.Material +
            ") As tar2 ON tar1.target_plan = tar2.target_plan ) As f)  As fc;";
        }
        break;
      default:
        res.send({
          Instrument: requestedItems.Instrument,
          Message: "Error: Data is not avalable for this instrument!"
        });
    }
    // Check the query before execution

    // Get the data from database
    db.any(query)
      .then(function(data) {
        res.send(data[0].row_to_json);
      })
      .catch(function(err) {
        return next(err);
      });
  }
);

/**
 * An API to get the name of all instruments in the
 * "Instruments" table.
 * Test link: http://localhost:3000/apis/instList
 */
router.get("/instList", function(req, res, next) {
  let query = "SELECT inst_type FROM Instruments;";
  // Get the data from database
  db.any(query)
    .then(function(data) {
      res.send(data);
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * An API router to get the name of all the columns in a table.
 * THe name of the table is passed to the query.
 * Test link: Test link: http://localhost:3000/apis/inst=ccam/
 */
router.get("/inst=:instrument/", function(req, res, next) {
  let instrument = req.params.instrument;
  let query =
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = $1;";

  // Get the data from database
  db.any(query, "data_" + instrument)
    .then(function(data) {
      if (data.length >= 1) {
        res.send(data);
      }
      if (data.length === 0) {
        res.send({
          result: "There is no data for table called data_" + instrument + "!"
        });
      }
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * An API router to calculate the statistical information like, minimum, maximum,
 * average and etc. for a parameter in a data_instType table.
 * Test link: http://localhost:3000/apis/inst=ccam/data_min_avg_max&mat=sio2
 */
router.get("/inst=:instrument/data_min_avg_max&mat=:material", function(
  req,
  res,
  next
) {
  let instrument = req.params.instrument;
  let material = req.params.material;

  let query = "SELECT " + material + " FROM data_" + instrument + " ;";

  // Get the data from database
  db.any(query)
    .then(function(d) {
      // Get the data in an array format
      let data = [];
      for (let i in d) {
        data.push(d[i][material]);
      }

      data = Object.values(data);
      // data = Array.from( {length: 350}, () => Math.pow( Math.sin( Math.random() * Math.PI/2), 2 ) );
      // data = Array.from( {length: 350}, () => Math.sin( Math.random() * Math.PI/2));
      // data = Array.from( {length: 100}, () => Math.random() * 100);
      // 1 2 2 3 3 4 5 8 9
      // data = [8, 2, 4, 1, 9, 5, 3, 2, 3]

      // Sort the data
      data.sort((a, b) => a - b);

      // Min, max
      let min = data[0];
      let max = data[data.length - 1];
      let avg = 0;

      // Calculate the median
      let l = data.length;
      let median = data[0];

      if (l % 2 === 1) {
        median = data[Math.floor(l / 2)];
      } else {
        let a = ((data[l / 2 - 1] + data[l / 2]) / 2) * 1.0;
        median =
          a % 1 >= 0.5 ? data[Math.ceil(l / 2)] : data[Math.floor(l / 2)];
        // console.log("Median: ", median);
      }

      // Calculate the standard deviation here

      // Set the bin size
      let binSize = Math.min(data.length, 40);

      let binGap = (max - min) / binSize;
      // console.log( 'binGap:', max - min, data.length, binGap );

      let bins = new Array(binSize).fill(0);

      let medianIndex = 0;

      //8 2 4 1 9 5 3 2 3 3
      data[data.length - 1] -= binGap / 2;

      for (let i in data) {
        let g = parseInt((data[i] - min) / binGap, 10);
        bins[g] += 1;

        // Get the index of median in bins
        if (data[i] === median) medianIndex = g + 0.7; // Calibrating the index for fron-end
        avg += data[i];
      }

      avg /= data.length;

      res.send({
        data: d,
        min: min,
        max: max,
        avg: avg,
        median: median,
        medIndx: medianIndex,
        bins: bins
      });
    })
    .catch(function(err) {
      return next(err);
    });
});

/**
 * Final data to create a final query will be passed to
 * this part of the API and here all the data will be applied
 * to create the final query.
 * This get API is not being used for now.
 */
router.get("/final_query/data=:final_data", function(req, res, next) {
  // Return all targets with their geometry where the following
  // requirements are satisfied based on the final_data from
  // the interface.
  let data = req.params.final_data;
  //console.log("Here is the data: ", JSON.stringify(data));
  res.send("Got the data!");
});

/**
 * A get method to get all the stored queries for a specific user based on
 * his/her id that is being passed in the html page.
 */
router.get(
  "/uid=:user_id/tkn=:token/get_query_names/",
  checkAuthentication,
  function(req, res, next) {
    let uID = req.params.user_id;
    let allQueryNames_query =
      "SELECT id, name, description FROM user_queries WHERE user_id=$1;";

    // Get the data from database
    db.any(allQueryNames_query, [uID])
      .then(function(data) {
        res.send(data);
      })
      .catch(function(err) {
        return next(err);
      });
  }
);

/**
 * The following get method will retrieve all the info that is related
 * a query with the corresponding id from user_query table base on the
 * id of the current user. And then, it returns back the result to the
 * front-end to load into the "load query" section on the interface.
 */
router.get(
  "/uid=:user_id/tkn=:token/get_query/qid=:query_id",
  checkAuthentication,
  function(req, res, next) {
    // Get the id of the selected query from the link
    let queryID = req.params.query_id;
    let getQueryRecord = "SELECT * FROM user_queries WHERE id=$1;";

    // Get selected query data from database
    db.any(getQueryRecord, [queryID])
      .then(function(data) {
        res.send(data[0]);
      })
      .catch(function(err) {
        return next(err);
      });
  }
);

/**
 * This post method is for running a select and saved query that is sent from front end.
 * The query is directly sent to this function as a string and the following router will execute
 * the query and sends back the result to the front-end.
 */
router.post(
  "/uid=:user_id/tkn=:token/run_loaded_query",
  checkAuthentication,
  function(req, res, next) {
    // Get the query string from html
    let loadedQuery = req.body.query;

    // Get selected query data from database
    db.any(loadedQuery)
      .then(function(data) {
        res.send(data[0].row_to_json); // Send back the result as GeoJSON format.
      })
      .catch(function(err) {
        return next(err);
      });
  }
);

/**
 * This get method is responsible for removing a query from database. Here, first we need to
 * authenticate the user by his/her id and token then if it is valid, take the query id and
 * based on that id remove the record that is belong to that id.
 */

router.get(
  "/uid=:user_id/tkn=:token/rmq/id=:query_id",
  checkAuthentication,
  function(req, res, next) {
    let queryID = req.params.query_id;
    let deleteQuery = "DELETE FROM user_queries WHERE id=$1;";

    // Get selected query data from database
    db.any(deleteQuery, [queryID])
      .then(function(data) {
        res.status(200).send(data);
      })
      .catch(function(err) {
        return next(err);
      });
  }
);

/**
 * A post method that would run a user's query on the database and return the
 * result to the MMGIS interface.
 * In this function users should be validated before running his/her query.
 * Test link: http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/final_query_submit/op=run/q_name=query_name
 */
router.post(
  "/uid=:user_id/tkn=:token/final_query_submit/op=:operation/q_name=:name/",
  checkAuthentication,
  runFinalQuery
);

/**
 * creating asynchronous function for executing the final query.
 * Source: https://codeburst.io/javascript-es-2017-learn-async-await-by-example-48acc58bad65
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
async function runFinalQuery(req, res, next) {
  let operation = req.params.operation;
  let queryName = req.params.name;

  let data = req.body;
  let components = data.components;
  let params = data.parameters;
  let selectedColumns = "";

  let queryDescription = data.description;

  let i;
  for (i = 0; i < params.length - 1; i++) {
    if (params[i].column_name !== "target_plan") {
      selectedColumns += "sec_0." + params[i].column_name + ", ";
    }
  }

  selectedColumns += "sec_0." + params[i].column_name;

  let baseQuery = "";
  let geomFlag = true;
  let firtsNumStrComp = true;

  let numStrPartQuery = "";
  let geometryPartQuery = "";

  let instrument, compType, fieldName;

  for (i = 0; i < components.length; i++) {
    instrument = components[i].instrument;
    compType = components[i].comp_type;
    fieldName = components[i].item;

    // Check the type of the query component
    if (compType === "N" || compType === "S") {
      // Add WHERE clause for numerical or string component
      if (firtsNumStrComp) {
        numStrPartQuery += " WHERE ";
        firtsNumStrComp = false;
      }

      if (compType === "N") {
        // Get the range values
        let inputRange = components[i].input;
        // Using "WHERE" clause that says "WHERE component.item >= inputRange[0] AND component.item <= inputRange[1]"
        numStrPartQuery +=
          "(" +
          instrument +
          "." +
          fieldName +
          " >= " +
          inputRange[0] +
          " AND " +
          instrument +
          "." +
          fieldName +
          " <= " +
          inputRange[1] +
          ") "; // + component.and_or + " ";
      }

      if (compType === "S") {
        // Get the input value
        let valueForField = components[i].input;
        let isnum = /^\d+$/.test(valueForField);

        // If input is coming from string input but it is actually a number
        if (isnum) {
          numStrPartQuery += "(" + fieldName + " = '" + valueForField + "') ";
        } else {
          numStrPartQuery +=
            "(" + fieldName + " LIKE '%" + valueForField + "%') ";
        }
      }
    }

    if (compType === "G") {
      if (geomFlag) {
        geometryPartQuery += " " + components[i].and_or;
      }

      let shape = components[i].geomOp;
      let coordinates = components[i].coordinates;

      if (shape === "elevation") {
        let elevation = components[i].input;
        geometryPartQuery += ST_Z(elevation);
      }

      if (shape === "line_buffer" || shape === "circle_buffer") {
        // Create line buffer or circle buffer
        let distance = components[i].input;
        geometryPartQuery += ST_Buffer(coordinates, shape, distance);
      }

      if (shape === "rectangle" || shape === "polygon") {
        geometryPartQuery += ST_Contains(coordinates);
      }

      if (shape === "intersection") {
        let layerData = components[i].input;
        let intersectQuery = await ST_Intersect(coordinates, layerData);
        geometryPartQuery += intersectQuery;
      }
    }

    // Check if there is more component
    if (i < components.length - 1) {
      // If next component is Numerical or String type
      if (
        (components[i + 1].comp_type === "N" ||
          components[i + 1].comp_type === "S") &&
        !firtsNumStrComp
      ) {
        numStrPartQuery += components[i].and_or + " ";
      }

      if (components[i + 1].comp_type === "G") {
        geomFlag = false;
        geometryPartQuery += " " + components[i].and_or + " ";
      }
    }
  }

  // The following part is the final query that will be executed after adding other parts to it.
  baseQuery =
    "SELECT row_to_json(fc) FROM ( " +
    "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM ( " +
    "SELECT 'Feature' As type, ST_AsGeoJSON(tar_0.geom)::json As geometry, row_to_json(sec_1) As properties " +
    "FROM targets As tar_0 INNER JOIN ( " +
    "SELECT tar_2.target_plan, " +
    selectedColumns +
    " FROM targets AS tar_2, ( " +
    "SELECT DISTINCT ON (target_plan) * FROM data_ccam AS ccam " +
    numStrPartQuery +
    " ) AS sec_0 WHERE tar_2.target_plan = sec_0.target_plan" +
    geometryPartQuery +
    " ) AS sec_1 ON tar_0.target_plan = sec_1.target_plan" +
    ") AS f) As fc;";

  if (operation === "run") {
    // Execute the query
    db.any(baseQuery)
      .then(function(d) {
        let data = d[0].row_to_json;
        // Send the data back to the front-end and then save the executed query
        res.send(data);
      })
      .catch(function(err) {
        return next(err);
      });
  }

  // Save the users query in the database, users_queries table ===================================
  if (operation === "save") {
    let saveQuery =
      "INSERT INTO user_queries(user_id, name, description, query, executed_on) values ($1, $2, $3, $4, $5);";

    // Recording the current time
    let now = new Date();
    let dd = now.getDate(),
      mm = now.getMonth() + 1,
      yy = now.getFullYear(),
      hour = now.getHours(),
      min = now.getMinutes(),
      sec = now.getSeconds();
    let curntTime =
      yy + "-" + mm + "-" + dd + " " + hour + ":" + min + ":" + sec;

    db.any(saveQuery, [
      req.params.user_id,
      queryName,
      queryDescription,
      baseQuery,
      curntTime
    ])
      .then(function(r) {
        res.send(true);
      })
      .catch(function(err) {
        return next(err);
      });
  }
}

/**
 * A function to create elevation query based on the selected elevation by the users.
 * @param {*} elevation
 */
function ST_Z(elevation) {
  return (
    " ST_Z(tar_2.geom) >= " +
    elevation[0] +
    " AND ST_Z(tar_2.geom) <= " +
    elevation[1] +
    " "
  );
}

/**
 * A function to create geometry query for ST_Contains GIS function.
 * It is based on the drawn rectangle or polygon that is create by users and
 * the coordinates are sent from front-end.
 * @param {*} coordinates
 */
function ST_Contains(coordinates) {
  let geomAsText = "";
  // parse the coordinates
  let coords = "";
  let i;
  for (i = 0; i < coordinates.length - 1; i++) {
    coords += coordinates[i].lng + " " + coordinates[i].lat + ",";
  }
  coords += coordinates[i].lng + " " + coordinates[i].lat;
  // Close the ring
  coords += "," + coordinates[0].lng + " " + coordinates[0].lat;
  geomAsText =
    " ST_Contains( ST_Transform( ST_GeomFromText('POLYGON((" +
    coords +
    "))', 4326), 4326) , tar_2.geom) = true";

  return geomAsText;
}

/**
 * Creating a line buffer or circle buffer query using ST_buffer GIS
 * function based on the following parameters that are sent from interface
 * on the fron-end.
 * @param {*} coordinates
 * @param {*} bufferType
 * @param {*} distance
 */
function ST_Buffer(coordinates, bufferType, distance) {
  let geomAsText = "";
  // parse the coordinates
  let coords = "";
  let i;
  // If line buffer is selected. Here, distance is the distance from a draw line.
  if (bufferType === "line_buffer") {
    for (i = 0; i < coordinates.length - 1; i++) {
      coords += coordinates[i].lng + " " + coordinates[i].lat + ",";
    }
    coords += coordinates[i].lng + " " + coordinates[i].lat;
    geomAsText =
      " ST_DWithin(tar_2.geom, ST_GeomFromText('LINESTRING(" +
      coords +
      ")', 4326), " +
      distance +
      ", true)";
  }
  // If circle buffer is selected, distance here is the redius of the circle.
  if (bufferType === "circle_buffer") {
    coords += coordinates.lng + " " + coordinates.lat;
    geomAsText =
      " ST_Distance_Spheroid(tar_2.geom, ST_Transform(ST_GeomFromText('POINT (" +
      coords +
      ")', 4326), 4326), 'SPHEROID[\"WGS 84\",3396190,169.779287]')  <=  " +
      distance;
  }

  return geomAsText;
}

/**
 * A function to create the ST_Intersect GIS function and it corresponding query for
 * executing geometry operation.
 * @param {*} coordinates
 * @param {*} selectedLayerData
 */
function ST_Intersect(coordinates, selectedLayerData) {
  return new Promise(resolve => {
    let layerName = selectedLayerData[0];
    let layerType = selectedLayerData[1];
    let geomAsText = "";
    let coords = "";
    let i;
    for (i = 0; i < coordinates.length - 1; i++) {
      coords += coordinates[i].lng + " " + coordinates[i].lat + ",";
    }
    coords += coordinates[i].lng + " " + coordinates[i].lat;
    // Close the ring
    coords += "," + coordinates[0].lng + " " + coordinates[0].lat;
    let q =
      " SELECT ST_AsGeoJSON( l.geom ) FROM " +
      layerName +
      " AS l WHERE ST_Intersects( ST_GeomFromText('POLYGON((" +
      coords +
      "))', 4326) , l.geom ) = true";

    // Execute the query
    db.any(q)
      .then(function(geoms) {
        // Create a polygon that covers all the points extracted from ST_Intersects GIS function
        if (layerType === "Points") {
          geomAsText +=
            " ST_Intersects( ST_GeographyFromText('SRID=4326;POINT(";
          // ST_GeographyFromText('SRID=4326;POINT(-43.23456 72.4567772)')
          for (let i = 0; i < geoms.length - 1; i++) {
            let GeojsonObj = JSON.parse(geoms[i].st_asgeojson);
            let lng = GeojsonObj.coordinates[0];
            let lat = GeojsonObj.coordinates[1];

            geomAsText +=
              lng +
              " " +
              lat +
              ")'), tar_2.geom) AND ST_Intersects( ST_GeographyFromText('SRID=4326;POINT(";
          }

          // Set up last round
          let lastGeojsonObj = JSON.parse(geoms[geoms.length - 1].st_asgeojson);
          let lastLng = lastGeojsonObj.coordinates[0];
          let lastLat = lastGeojsonObj.coordinates[1];
          geomAsText += lastLng + " " + lastLat + ")'), tar_2.geom) ";

          resolve(geomAsText);
        }

        // Create LineString from line coordinates that are received from database for this part
        if (layerType === "LineString") {
          geomAsText += " ST_Intersects(";

          let MultiLineStr =
            " ST_GeographyFromText('SRID=4326;MULTILINESTRING(";
          for (let i = 0; i < geoms.length - 1; i++) {
            let GeojsonObj = JSON.parse(geoms[i].st_asgeojson);
            MultiLineStr += "(";
            let coordins = GeojsonObj.coordinates[0];
            for (let j = 0; j < coordins.length - 1; j++) {
              let lng = coordins[j][0];
              let lat = coordins[j][1];
              MultiLineStr += lng + " " + lat + ",";
              // console.log("Line Geometry:", '(' + lng + ' ' + lat + '),');
            }
            MultiLineStr +=
              coordins[coordins.length - 1][0] +
              " " +
              coordins[coordins.length - 1][1] +
              "),";
          }
          // Add the last geoms set
          MultiLineStr += "(";
          let lastCoordins = JSON.parse(geoms[geoms.length - 1].st_asgeojson)
            .coordinates[0];
          for (let k = 0; k < lastCoordins.length - 1; k++) {
            let lng = lastCoordins[k][0];
            let lat = lastCoordins[k][1];
            MultiLineStr += lng + " " + lat + ",";
          }

          MultiLineStr +=
            lastCoordins[lastCoordins.length - 1][0] +
            " " +
            lastCoordins[lastCoordins.length - 1][1] +
            "))')";

          geomAsText += MultiLineStr + ", tar_2.geom) = true ";
          resolve(geomAsText);
        }

        // Create a multi polygon from polygon coordinates that are received from database for this part
        if (layerType === "Polygon") {
          geomAsText += " ST_Intersects(";

          let geoJSON_obj = JSON.parse(geoms[0].st_asgeojson);
          let polygonCoords = geoJSON_obj.coordinates[0];
          let counter = 0;

          let PolygonStr = " ST_GeomFromText('POLYGON((";

          for (let t in polygonCoords) {
            if (counter < polygonCoords.length - 1) {
              PolygonStr +=
                polygonCoords[t][0] + " " + polygonCoords[t][1] + ",";
            }
            if (counter >= polygonCoords.length - 1) {
              PolygonStr +=
                polygonCoords[t][0] + " " + polygonCoords[t][1] + "))',4326)";
            }
            counter++;
          }
          geomAsText += PolygonStr + ", tar_2.geom) = true ";
          resolve(geomAsText);
        }
      })
      .catch(function(err) {
        return next(err);
      });
  }, 2000);
}

/**
 * This function acts as a middleware and first checks for
 * a user authentication. If this user is a valid user then it passes through
 * , otherwise, it sends back a corresponding message to the front-end.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
function checkAuthentication(req, res, next) {
  //Get token and id from the link
  let tkn = req.params.token;
  let uid = req.params.user_id;

  // Retrive the token for user with "userID" from database
  User.findOne({
    where: {
      id: uid
    },
    attributes: ["token"]
  }).then(user => {
    if (!user) {
      res.send({
        usre: "Not valid",
        token: "Not valid",
        message: "Please register for the API first!"
      });
      res.end();
    } else {
      // If the token is correct
      if (user.token === tkn) {
        next();
      } else {
        res.send({
          usre: uid,
          token: "Not valid",
          message: "Please create a token by using your account!"
        });
        res.end();
      }
    }
  });
}

// A function to calculate the median.
// But not being used by this version.
function getMedian(array) {
  let data = array.sort((a, b) => a - b);
  let l = data.length;
  let median = data[0];

  if (l % 2 === 0) {
    median = Math.ceil((data[data.length / 2 - 1] + data[data.length / 2]) / 2);
  }
  if (l % 2 === 1) {
    median = data[Math.ceil(l / 2)];
  }
  return median;
}

// Export the router module to use in app.js file
module.exports = router;
