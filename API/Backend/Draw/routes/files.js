const express = require("express");
const logger = require("../../../logger");
const database = require("../../../database");
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const fhistories = require("../models/filehistories");
const Filehistories = fhistories.Filehistories;
const FilehistoriesTEST = fhistories.FilehistoriesTEST;
const ufiles = require("../models/userfiles");
const Userfiles = ufiles.Userfiles;
const UserfilesTEST = ufiles.UserfilesTEST;
const makeMasterFiles = ufiles.makeMasterFiles;
const ufeatures = require("../models/userfeatures");
const Userfeatures = ufeatures.Userfeatures;
const UserfeaturesTEST = ufeatures.UserfeaturesTEST;
const published = require("../models/published");
const Published = published.Published;
const PublishedTEST = published.PublishedTEST;
const PublishedStore = require("../models/publishedstore");

const draw = require("./draw");
const filesutils = require("./filesutils");
const getfile = filesutils.getfile;
const triggerWebhooks = require("../../Webhooks/processes/triggerwebhooks");

const router = express.Router();
const db = database.db;

const historyKey = {
  0: "Add",
  1: "Edit",
  2: "Delete",
  3: "Undo",
  4: "Publish",
  5: "Add (over)",
  6: "Merge",
  7: "Add (under)",
  8: "Split",
};

router.post("/", function (req, res, next) {
  res.send("test files");
});

/**
 * Gets all owned or public files
 */
router.post("/getfiles", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;

  const orWhere = [
    {
      file_owner: req.user,
    },
    { public: "1" },
    {
      public:
        req.leadGroupName != null &&
        req.groups != null &&
        req.groups[req.leadGroupName] === true
          ? "0"
          : "1",
    },
  ];
  Table.findAll({
    where: {
      //file_owner is req.user or public is '0'
      hidden: "0",
      [Sequelize.Op.or]: orWhere,
    },
  })
    .then((files) => {
      if (!files) {
        res.send({
          status: "failure",
          message: "Failed to get files.",
          body: {},
        });
      } else {
        files.sort((a, b) => (a.id > b.id ? 1 : -1));
        res.send({
          status: "success",
          message: "Successfully got files.",
          body: files,
        });
      }
    })
    .catch((err) => {
      logger("error", "Failed to get files.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to get files.",
        body: {},
      });
    });
});

/**
 * Returns a geojson of a file
 * {
 * 	id: <number> (required)
 * 	time: <int> (optional)
 * 	published: <bool> (optional) get last published version (makes 'time' ignored)
 * }
 */
router.post("/getfile", getfile);

/**
 * Makes a new file
 * {
 * 	file_owner: <string> (required)
 * 	file_name: <string> (required)
 * 	file_description: <string> (optional)
 *  intent: <string> (optional)
 *  geojson: <object> (optional) -- geojson to initialize file from
 * }
 */
router.post("/make", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;

  //group is a reserved keyword
  if (req.user === "group") {
    logger(
      "error",
      'Failed to make a new file. Owner can\'t be "group".',
      req.originalUrl,
      req
    );
    res.send({
      status: "failure",
      message: 'Failed to make a new file. Owner can\'t be "group".',
      body: {},
    });
    return;
  }

  let time = Math.floor(Date.now());

  let newUserfile = {
    file_owner: req.user,
    file_name: req.body.file_name,
    file_description: req.body.file_description,
    intent: req.body.intent,
    public: "1",
    publicity_type: "read_only",
    hidden: "0",
    template: req.body.template ? JSON.parse(req.body.template) : null,
  };

  // Insert new userfile into the user_files table
  Table.create(newUserfile)
    .then((created) => {
      let geojson = req.body.geojson ? JSON.parse(req.body.geojson) : null;
      if (
        geojson &&
        geojson.features &&
        geojson.features.length > 0 &&
        req.body.test !== "true"
      ) {
        let features = geojson.features;

        let rows = [];
        for (var i = 0; i < features.length; i++) {
          let intent = null;
          if (
            features[i].properties &&
            features[i].properties._ &&
            features[i].properties._.intent
          )
            intent = features[i].properties._.intent;
          else {
            switch (features[i].geometry.type.toLowerCase()) {
              case "point":
              case "multipoint":
                intent = "point";
                break;
              case "linestring":
              case "multilinestring":
                intent = "line";
                break;
              default:
                intent = "polygon";
                break;
            }
            if (
              features[i].properties &&
              features[i].properties.arrow === true
            ) {
              intent = "arrow";
            }
            if (
              features[i].properties &&
              features[i].properties.annotation === true
            ) {
              intent = "note";
            }
          }
          let geom = features[i].geometry;
          geom.crs = { type: "name", properties: { name: "EPSG:4326" } };

          rows.push({
            file_id: created.id,
            level: "0",
            intent: intent,
            elevated: "0",
            properties: JSON.stringify(features[i].properties),
            geom: geom,
          });
        }

        Userfeatures.bulkCreate(rows, { returning: true })
          .then(function (response) {
            let ids = [];
            for (let i = 0; i < response.length; i++) {
              ids.push(response[i].id);
            }
            Filehistories.findAll({
              limit: 1,
              where: {
                file_id: created.id,
              },
              order: [["history_id", "DESC"]],
            })
              .then((lastHistory) => {
                if (lastHistory && lastHistory.length > 0) {
                  return {
                    historyIndex: lastHistory[0].history_id + 1,
                    history: lastHistory[0].history,
                  };
                } else return { historyIndex: 0, history: [] };
              })
              .then((historyObj) => {
                let history = historyObj.history.concat(ids);
                let newHistoryEntry = {
                  file_id: created.id,
                  history_id: historyObj.historyIndex,
                  time: time,
                  action_index: 0,
                  history: history,
                };
                // Insert new entry into the history table
                Filehistories.create(newHistoryEntry)
                  .then((createdHistory) => {
                    res.send({
                      status: "success",
                      message: "Successfully made a new file from geojson.",
                      body: {
                        file_id: created.id,
                      },
                    });
                    triggerWebhooks("drawFileAdd", {
                      id: created.id,
                      res,
                    });
                    return null;
                  })
                  .catch((err) => {
                    logger(
                      "error",
                      "Upload GeoJSON but failed to update history!",
                      req.originalUrl,
                      req,
                      err
                    );
                    res.send({
                      status: "failure",
                      message: "Upload GeoJSON but failed to update history!",
                      body: {},
                    });
                  });

                return null;
              });
            return null;
          })
          .catch(function (err) {
            logger(
              "error",
              "Failed to upload GeoJSON!",
              req.originalUrl,
              req,
              err
            );
            res.send({
              status: "failure",
              message: "Failed to upload GeoJSON!",
              body: {},
            });
            return null;
          });
      } else {
        res.send({
          status: "success",
          message: "Successfully made a new file.",
          body: {
            file_id: created.id,
          },
        });
        triggerWebhooks("drawFileAdd", {
          id: created.id,
          res,
        });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failed to make a new file.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to make a new file.",
        body: {},
      });
    });
});

/**
 * Removes/Hides a file
 * {
 * 	id: <number> (required)
 * }
 */
router.post("/remove", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;

  Table.update(
    {
      hidden: "1",
    },
    {
      where: {
        id: req.body.id,
        file_owner: req.user,
      },
    }
  )
    .then(() => {
      res.send({
        status: "success",
        message: "File removed.",
        body: {},
      });
      triggerWebhooks("drawFileDelete", {
        id: req.body.id,
        res,
      });

      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to find and remove file.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: "Failed to find and remove file.",
        body: {},
      });
    });
});

/**
 * Restores/Unhides a file
 * {
 * 	id: <number> (required)
 * }
 */
router.post("/restore", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;

  Table.update(
    {
      hidden: "0",
    },
    {
      where: {
        id: req.body.id,
        file_owner: req.user,
      },
    }
  )
    .then(() => {
      res.send({
        status: "success",
        message: "File restored.",
        body: {},
      });

      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to find and restore file.",
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: "Failed to find and restore file.",
        body: {},
      });
    });
});

/**
 * Update a file's name and/or description
 * {
 * 	id: <int>
 * 	file_name: <string> (optional)
 * 	file_description: <string> (optional)
 * 	public: <0|1> (optional)
 *  template: <json> (optional)
 *  publicity_type: <string> (optional)
 *  public_editors: <string[]> (optional)
 * }
 */
router.post("/change", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;

  //Form update object
  let toUpdateTo = {};
  if (req.body.hasOwnProperty("file_name") && req.body.file_name != null) {
    toUpdateTo.file_name = req.body.file_name;
  }
  if (
    req.body.hasOwnProperty("file_description") &&
    req.body.file_description != null
  ) {
    toUpdateTo.file_description = req.body.file_description;
  }
  if (
    req.body.hasOwnProperty("public") &&
    (req.body.public == 0 || req.body.public == 1)
  ) {
    toUpdateTo.public = req.body.public;
  }
  if (req.body.hasOwnProperty("template") && req.body.template != null) {
    try {
      toUpdateTo.template = JSON.parse(req.body.template);
    } catch (err) {}
  }
  if (
    req.body.hasOwnProperty("publicity_type") &&
    [null, "read_only", "list_edit", "all_edit"].includes(
      req.body.publicity_type
    )
  ) {
    toUpdateTo.publicity_type = req.body.publicity_type;
  }
  if (req.body.hasOwnProperty("public_editors")) {
    try {
      let public_editors = null;
      if (typeof req.body.public_editors === "string")
        public_editors = req.body.public_editors
          .split(",")
          .map((e) => e.trim());
      toUpdateTo.public_editors = public_editors;
    } catch (err) {}
  }

  let updateObj = {
    where: {
      id: req.body.id,
      file_owner: req.user,
      is_master: false, //No editing these
    },
  };

  // Alow leads to edit file info
  if (req.groups && req.groups["mmgis-group"] === true)
    updateObj = {
      where: {
        id: req.body.id,
        is_master: false, //No editing these
      },
    };
  Table.update(toUpdateTo, updateObj)
    .then(() => {
      res.send({
        status: "success",
        message: "File edited.",
        body: {},
      });
      triggerWebhooks("drawFileChange", {
        id: req.body.id,
        res,
      });

      return null;
    })
    .catch((err) => {
      logger("error", "Failed to edit file.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to edit file.",
        body: {},
      });
    });
});

/**
 * Renames a tags/folders/efolders (efolders = elevated folders)
 * These were quickly and over time hacked into the file description
 * If newKeyword is null, removes
 * {
 *   keyword: <string>
 *   type: "tags" || "folders" || "efolders"
 *   newKeyword: <string>
 * }
 */
router.post("/modifykeyword", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;

  let keyword = req.body.keyword;
  const type = req.body.type;
  const newKeyword = req.body.newKeyword;
  let symbol = null;
  switch (type.toLowerCase()) {
    case "tags":
      symbol = "~#";
      break;
    case "folders":
      symbol = "~@";
      break;
    case "efolders":
      symbol = "~^";
      break;
    default:
      break;
  }

  if (
    symbol == null ||
    keyword == null ||
    (keyword != null &&
      (keyword.indexOf(" ") > -1 || keyword.indexOf("~") > -1)) ||
    (newKeyword != null &&
      (newKeyword.indexOf(" ") > -1 ||
        newKeyword.indexOf("~") > -1 ||
        newKeyword.indexOf("$") > -1))
  ) {
    res.send({
      status: "failure",
      message: `Bad Input. Either: no 'keyword', no 'type', 'keyword' or 'newKeyword' contains spaces, dollar-signs, tildes.`,
      body: {},
    });
    return;
  }

  const existing = `${symbol}${keyword}`;
  let replace = "";
  if (newKeyword != null) replace = `${symbol}${newKeyword}`;

  Table.update(
    {
      file_description: Sequelize.fn(
        "replace",
        Sequelize.col("file_description"),
        existing,
        replace
      ),
    },
    {
      where: {
        file_description: {
          // Escape special chars so that regex works
          [Sequelize.Op.like]: sequelize.literal(
            `'%${existing
              .replaceAll("%", "$%")
              .replaceAll("_", "$_")}%' ESCAPE '$'`
          ),
        },
      },
    }
  )
    .then((data) => {
      res.send({
        status: "success",
        message: `Successfully modified keyword ${existing} into ${replace}`,
        body: {},
      });
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to modify keyword ${existing} into ${replace}`,
        req.originalUrl,
        req,
        err
      );
      res.send({
        status: "failure",
        message: `Failed to modify keyword ${existing} into ${replace}`,
        body: {},
      });
    });
});

/**
 * compile sel file
 * {
 * 	time: int
 * 	verbose: bool
 *  test: bool
 * }
 */
const compile = function (req, res, callback) {
  const isTest = req.query.test === "true" || req.body.test === "true";
  let Table = isTest ? UserfilesTEST : Userfiles;

  let atThisTime = req.query.time || Math.floor(Date.now());

  Table.findAll({
    where: {
      is_master: true,
      intent: {
        [Sequelize.Op.in]: [
          "roi",
          "campaign",
          "campsite",
          "trail",
          "signpost",
          "all",
        ],
      },
    },
  })
    .then((files) => {
      let featureIds = [];
      let finished = 0;
      for (let f = 0; f < files.length; f++) {
        sequelize
          .query(
            "SELECT history" +
              " " +
              "FROM file_histories" +
              (isTest ? "_tests" : "") +
              " " +
              "WHERE file_id=" +
              ":id" +
              " " +
              "AND time<=" +
              ":atThisTime" +
              " " +
              "ORDER BY time DESC" +
              " " +
              "FETCH first 1 rows only",
            {
              replacements: {
                id: files[f].dataValues.id,
                atThisTime: atThisTime,
              },
            }
          )
          .then(([results]) => {
            let bestHistory = results.length > 0 ? results[0].history : [];
            featureIds = featureIds.concat(bestHistory);
            finished++;
            tryProcessFeatures(finished);
          })
          .catch((err) => {
            logger("error", "Failed to compile.", req.originalUrl, req, err);
            callback();
            return null;
          });
      }
      function tryProcessFeatures(finished) {
        if (finished == files.length) {
          //get all features
          sequelize
            .query(
              "SELECT " +
                "id, file_id, level, intent, properties, ST_AsGeoJSON(geom)" +
                " " +
                "FROM user_features" +
                (isTest ? "_tests" : "") +
                " " +
                "WHERE id IN (" +
                ":featureIds" +
                ")",
              {
                replacements: {
                  featureIds:
                    featureIds.length == 0 ? null : featureIds || null,
                },
              }
            )
            .then(([features]) => {
              processFeatures(features);
            })
            .catch((err) => {
              logger("error", "Failed to compile.", req.originalUrl, req, err);
              callback();
              return null;
            });
        }
      }
      function processFeatures(features) {
        sequelize
          .query(
            "SELECT" +
              " " +
              '\'intersects\' as "association", a.id, a.intent, b.id AS "associated_id", b.intent AS "associated_intent", b.properties AS "associated_properties"' +
              " " +
              "FROM user_features" +
              (isTest ? "_tests" : "") +
              " a," +
              " " +
              "user_features" +
              (isTest ? "_tests" : "") +
              " b" +
              " " +
              "WHERE a.id IN (" +
              ":featureIds" +
              ")" +
              " " +
              "AND b.id IN (" +
              ":featureIds" +
              ")" +
              " " +
              "AND a.id != b.id" +
              " " +
              "AND ((ST_OVERLAPS(ST_BUFFER(a.geom, -0.000005, 'join=mitre'), b.geom)" +
              " " +
              "AND NOT ST_Touches(a.geom, b.geom))" +
              " " +
              "OR ST_CROSSES(ST_BUFFER(a.geom, -0.000005, 'join=mitre'), b.geom))" +
              " " +
              "UNION ALL" +
              " " +
              "SELECT" +
              " " +
              '\'contains\' as "association", a.id, a.intent, b.id AS "associated_id", b.intent AS "associated_intent", b.properties AS "associated_properties"' +
              " " +
              "FROM user_features" +
              (isTest ? "_tests" : "") +
              " a," +
              " " +
              "user_features" +
              (isTest ? "_tests" : "") +
              " b" +
              " " +
              "WHERE a.id IN (" +
              ":featureIds" +
              ")" +
              " " +
              "AND b.id IN (" +
              ":featureIds" +
              ")" +
              " " +
              "AND a.id != b.id" +
              " " +
              "AND ST_Contains(a.geom, b.geom)",
            {
              replacements: {
                featureIds: featureIds.length == 0 ? null : featureIds || null,
              },
            }
          )
          .then(([results]) => {
            let hierarchy = [];
            let intentOrder = ["roi", "campaign", "campsite", "signpost"];
            let excludeIntents = ["polygon", "line", "point", "text", "arrow"];
            let flatHierarchy = [];
            let issues = [];
            let changes = [];

            //Get all immediate children of everything
            for (let f = 0; f < features.length; f++) {
              let intersects = [];
              let contains = [];
              let children = [];

              if (!excludeIntents.includes(features[f].intent)) {
                for (let r = 0; r < results.length; r++) {
                  if (results[r].id == features[f].id) {
                    let childProps = JSON.parse(
                      results[r].associated_properties
                    );
                    if (results[r].association === "intersects") {
                      intersects.push({
                        name: childProps.name,
                        uuid: childProps.uuid,
                        id: results[r].associated_id,
                        intent: results[r].associated_intent,
                      });
                    } else if (results[r].association === "contains") {
                      contains.push({
                        name: childProps.name,
                        uuid: childProps.uuid,
                        id: results[r].associated_id,
                        intent: results[r].associated_intent,
                      });
                      children.push({
                        name: childProps.name,
                        uuid: childProps.uuid,
                        id: results[r].associated_id,
                        intent: results[r].associated_intent,
                      });
                    }
                  }
                }
              }

              let featureProps = JSON.parse(features[f].properties);
              flatHierarchy.push({
                feature: features[f],
                id: features[f].id,
                name: featureProps.name,
                uuid: featureProps.uuid,
                intent: features[f].intent,
                children: children,
                possibleChildren: {
                  intersects: intersects,
                  contains: contains,
                  directIntersects: [],
                },
              });
            }
            //Now attach parents to flatHierarchy
            for (let i = 0; i < flatHierarchy.length; i++) {
              flatHierarchy[i].parent = {};
              flatHierarchy[i].possibleParents = [];
              for (let j = 0; j < flatHierarchy.length; j++) {
                if (i != j) {
                  for (
                    let k = 0;
                    k < flatHierarchy[j].possibleChildren.contains.length;
                    k++
                  ) {
                    if (
                      flatHierarchy[i].id ==
                      flatHierarchy[j].possibleChildren.contains[k].id
                    ) {
                      flatHierarchy[i].possibleParents.push({
                        name: flatHierarchy[j].name,
                        uuid: flatHierarchy[j].uuid,
                        id: flatHierarchy[j].id,
                        intent: flatHierarchy[j].intent,
                      });
                    }
                  }
                }
              }
            }
            removeIndirectChildren();
            function removeIndirectChildren() {
              for (let i = 0; i < flatHierarchy.length; i++) {
                let node = flatHierarchy[i];
                let intent = node.intent;
                if (intentOrder.indexOf(intent) === -1) continue;
                let associationIntent =
                  intentOrder[intentOrder.indexOf(intent) + 1];
                if (associationIntent == null) {
                  node.children = [];
                } else {
                  for (let j = node.children.length - 1; j >= 0; j--) {
                    if (node.children[j].intent != associationIntent) {
                      node.children.splice(j, 1);
                    }
                  }
                  node.possibleChildren.directIntersects = JSON.parse(
                    JSON.stringify(node.possibleChildren.intersects)
                  );
                  for (
                    let i = node.possibleChildren.directIntersects.length - 1;
                    i >= 0;
                    i--
                  )
                    if (
                      node.possibleChildren.directIntersects[i].intent !=
                        associationIntent &&
                      node.possibleChildren.directIntersects[i].intent != intent
                    )
                      node.possibleChildren.directIntersects.splice(i, 1);
                }
              }
            }
            addParents();
            function addParents() {
              for (let i = 0; i < flatHierarchy.length; i++) {
                for (let j = 0; j < flatHierarchy[i].children.length; j++) {
                  //Each child
                  //Iterate back through to child and add this flatHierarchy[i] as parent
                  for (let k = 0; k < flatHierarchy.length; k++)
                    if (flatHierarchy[k].id === flatHierarchy[i].children[j].id)
                      flatHierarchy[k].parent = {
                        name: flatHierarchy[i].name,
                        uuid: flatHierarchy[i].uuid,
                        id: flatHierarchy[i].id,
                        intent: flatHierarchy[i].intent,
                      };
                }

                //If no parents at this point try to find the best possible parent
                if (
                  Object.keys(flatHierarchy[i].parent).length === 0 &&
                  flatHierarchy[i].possibleParents.length > 0
                ) {
                  let intentOrderReversed = JSON.parse(
                    JSON.stringify(intentOrder)
                  );
                  intentOrderReversed.reverse();
                  let intentId = intentOrderReversed.indexOf(
                    flatHierarchy[i].intent
                  );
                  if (intentId != -1) {
                    for (
                      let l = intentId + 1;
                      l < intentOrderReversed.length;
                      l++
                    ) {
                      for (
                        let m = 0;
                        m < flatHierarchy[i].possibleParents.length;
                        m++
                      ) {
                        if (
                          Object.keys(flatHierarchy[i].parent).length === 0 &&
                          flatHierarchy[i].possibleParents[m].intent ===
                            intentOrderReversed[l]
                        ) {
                          flatHierarchy[i].parent =
                            flatHierarchy[i].possibleParents[m];
                        }
                      }
                    }
                  }
                }
              }
            }

            //Build the root of the trees
            for (let f = 0; f < features.length; f++) {
              let isCovered = false;
              if (!excludeIntents.includes(features[f].intent)) {
                for (let r = 0; r < results.length; r++) {
                  if (
                    !excludeIntents.includes(results[r].intent) &&
                    results[r].association === "contains" &&
                    results[r].associated_id == features[f].id
                  ) {
                    isCovered = true;
                    break;
                  }
                }

                if (!isCovered) {
                  let featureProps = JSON.parse(features[f].properties);
                  hierarchy.push({
                    intent: features[f].intent,
                    id: features[f].id,
                    name: featureProps.name,
                    uuid: featureProps.uuid,
                    children: {
                      intersects: [],
                      contains: [],
                    },
                  });
                  continue;
                }
              }
            }

            //From those roots do a depth traversal, adding the flat children each time
            depthTraversal(hierarchy, 0);
            function depthTraversal(node, depth) {
              for (var i = 0; i < node.length; i++) {
                //Add other feature information while we're at it
                addFeatureData(node[i], depth);

                addRelationships(node[i]);
                if (node[i].children.length > 0)
                  depthTraversal(node[i].children, depth + 1);
              }
            }
            function addRelationships(node) {
              for (let i = 0; i < flatHierarchy.length; i++)
                if (node.id == flatHierarchy[i].id) {
                  node.parent = JSON.parse(
                    JSON.stringify(flatHierarchy[i].parent)
                  );
                  node.children = JSON.parse(
                    JSON.stringify(flatHierarchy[i].children)
                  );
                  return;
                }
            }
            function addFeatureData(node, depth) {
              for (let i = 0; i < features.length; i++) {
                let f = features[i];
                if (node.id == f.id) {
                  let properties = JSON.parse(f.properties);
                  let feature = {};
                  properties._ = {
                    id: f.id,
                    file_id: f.file_id,
                    level: f.level,
                    intent: f.intent,
                  };
                  feature.type = "Feature";
                  feature.properties = properties;
                  feature.geometry = JSON.parse(f.st_asgeojson);
                  //id, file_id, level, intent, properties, ST_AsGeoJSON(geom)' + ' ' +
                  node.file_id = f.file_id;
                  node.level = f.level;
                  node.depth = depth;
                  node.intent = f.intent;
                  node.name = properties.name;
                  node.uuid = properties.uuid;
                  node.properties = JSON.parse(f.properties);
                  node.geometry = JSON.parse(f.st_asgeojson);
                  node.feature = feature;
                  return;
                }
              }
            }

            let saviors = {};
            //Not always do all features fit in the hierarchy at this point, one last chance to fit them in
            addOutcasts();
            function addOutcasts() {
              let includedIds = [];
              let allIds = [];
              let outcastIds = [];

              //populate includedIds
              depthTraversalA(hierarchy, 0);
              function depthTraversalA(node, depth) {
                for (let i = 0; i < node.length; i++) {
                  includedIds.push(node[i].id);
                  if (node[i].children.length > 0) {
                    depthTraversalA(node[i].children, depth + 1);
                  }
                }
              }

              //populate allIds
              for (let i = 0; i < flatHierarchy.length; i++) {
                allIds.push(flatHierarchy[i].id);
              }

              //populate outcasts
              for (let i = 0; i < allIds.length; i++) {
                if (includedIds.indexOf(allIds[i]) == -1)
                  outcastIds.push(allIds[i]);
              }

              // parentId: child
              //let saviors = {}
              for (let i = 0; i < flatHierarchy.length; i++) {
                if (outcastIds.indexOf(flatHierarchy[i].id) != -1) {
                  if (
                    flatHierarchy[i].parent &&
                    flatHierarchy[i].parent.id != null
                  ) {
                    let outcast = JSON.parse(JSON.stringify(flatHierarchy[i]));
                    saviors[flatHierarchy[i].parent.id] = outcast;
                  }
                }
              }

              //The Savioring
              depthTraversalB(hierarchy, 0);
              function depthTraversalB(node, depth) {
                for (let i = 0; i < node.length; i++) {
                  if (saviors[node[i].id] != null) {
                    node[i].children = Array.isArray(node[i].children)
                      ? node[i].children
                      : [];
                    for (let j = 0; j < features.length; j++) {
                      let f = features[j];
                      if (saviors[node[i].id].id == f.id) {
                        let outcast = {};
                        let properties = JSON.parse(f.properties);
                        let feature = {};
                        properties._ = {
                          id: f.id,
                          file_id: f.file_id,
                          level: f.level,
                          intent: f.intent,
                        };
                        feature.type = "Feature";
                        feature.properties = properties;
                        feature.geometry = JSON.parse(f.st_asgeojson);

                        outcast.name = properties.name;
                        outcast.uuid = properties.uuid;
                        outcast.id = f.id;
                        outcast.intent = f.intent;
                        outcast.file_id = f.file_id;
                        outcast.level = f.level;
                        outcast.depth = depth + 1;
                        outcast.properties = JSON.parse(f.properties);
                        outcast.geometry = JSON.parse(f.st_asgeojson);
                        outcast.feature = feature;
                        outcast.children = saviors[node[i].id] || [];
                        outcast.parent = saviors[node[i].id].parent || {};
                        node[i].children.push(outcast);
                      }
                    }
                  }
                  if (node[i].children && node[i].children.length > 0) {
                    depthTraversalB(node[i].children, depth + 1);
                  }
                }
              }
            }

            findIssues();
            function findIssues() {
              let uuidsFound = {};
              let namesFound = {};

              for (let i = 0; i < flatHierarchy.length; i++) {
                let node = flatHierarchy[i];
                let intent = node.intent;
                let props = JSON.parse(node.feature.properties);

                if (excludeIntents.includes(intent)) continue;

                //Check for duplicate uuids
                if (props.uuid == null) {
                  issues.push({
                    severity: "error",
                    antecedent: {
                      id: node.id,
                      intent: node.intent,
                    },
                    message: "{antecedent} is missing a uuid.",
                  });
                } else {
                  let uuidKeys = Object.keys(uuidsFound);
                  let uuidI = uuidKeys.indexOf(props.uuid);
                  if (uuidI >= 0) {
                    issues.push({
                      severity: "error",
                      antecedent: {
                        id: node.id,
                        intent: node.intent,
                      },
                      message: "{antecedent} has the same uuid as {consequent}",
                      consequent: {
                        id: uuidsFound[uuidKeys[uuidI]].id,
                        intent: uuidsFound[uuidKeys[uuidI]].intent,
                      },
                    });
                  } else {
                    uuidsFound[props.uuid] = {
                      id: node.id,
                      intent: node.intent,
                    };
                  }
                }

                //Check for duplicate names
                if (props.name == null) {
                  issues.push({
                    severity: "error",
                    antecedent: {
                      id: node.id,
                      intent: node.intent,
                    },
                    message: "{antecedent} is missing a name.",
                  });
                } else {
                  let nameKeys = Object.keys(namesFound);
                  let nameI = nameKeys.indexOf(props.name);
                  if (nameI >= 0) {
                    issues.push({
                      severity: "error",
                      antecedent: {
                        id: node.id,
                        intent: node.intent,
                      },
                      message: "{antecedent} has the same name as {consequent}",
                      consequent: {
                        id: namesFound[nameKeys[nameI]].id,
                        intent: namesFound[nameKeys[nameI]].intent,
                      },
                    });
                  } else {
                    namesFound[props.name] = {
                      id: node.id,
                      intent: node.intent,
                    };
                  }
                }

                if (intentOrder.indexOf(intent) === -1) continue;
                let parentIntent = intentOrder[intentOrder.indexOf(intent) - 1];
                if (parentIntent != null && intent != "signpost") {
                  //Check that it has a valid parent
                  if (node.parent.intent != parentIntent) {
                    issues.push({
                      severity: "error",
                      antecedent: {
                        id: node.id,
                        intent: node.intent,
                      },
                      message:
                        "{antecedent} does not have a parent of type: " +
                        parentIntent +
                        ".",
                    });
                  } else if (Object.keys(node.parent).length === 0) {
                    issues.push({
                      severity: "error",
                      antecedent: {
                        id: node.id,
                        intent: node.intent,
                      },
                      message: "{antecedent} does not have a parent.",
                    });
                  }
                }

                let ints = node.possibleChildren.directIntersects;
                for (let j = 0; j < ints.length; j++) {
                  if (node.intent == "trail") {
                  } else if (node.intent != ints[j].intent)
                    issues.push({
                      severity: "error",
                      antecedent: {
                        id: node.id,
                        intent: node.intent,
                      },
                      message:
                        "{antecedent} does not fully contain possible child {consequent}",
                      consequent: {
                        id: ints[j].id,
                        intent: ints[j].intent,
                      },
                    });
                  else
                    issues.push({
                      severity: "error",
                      antecedent: {
                        id: node.id,
                        intent: node.intent,
                      },
                      message:
                        "{antecedent} intersects {consequent} of same intent.",
                      consequent: {
                        id: ints[j].id,
                        intent: ints[j].intent,
                      },
                    });
                }
              }
            }

            function findChanges(cb) {
              //Get published_family_tree from our store
              sequelize
                .query(
                  "SELECT value" +
                    " " +
                    "FROM published_stores" +
                    " " +
                    "WHERE time<=:time" +
                    " " +
                    "ORDER BY time DESC" +
                    " " +
                    "FETCH first 1 rows only",
                  {
                    replacements: {
                      time: Math.floor(Date.now()),
                    },
                  }
                )
                .then(([published_family_tree]) => {
                  if (
                    !published_family_tree ||
                    !published_family_tree[0] ||
                    !published_family_tree[0].value
                  ) {
                    cb(false);
                    return;
                  } else {
                    let tree = JSON.parse(published_family_tree[0].value);
                    let fh = tree.flatHierarchy;
                    let oldFeatures = {};
                    let newFeatures = {};
                    let added = [];
                    let changed = [];
                    let removed = [];

                    //Find all the old and new uuids and names first
                    for (let i = 0; i < fh.length; i++) {
                      let node = fh[i];
                      let props = JSON.parse(node.feature.properties);
                      oldFeatures[props.uuid] = {
                        name: props.name,
                        id: node.id,
                      };
                    }
                    for (let i = 0; i < flatHierarchy.length; i++) {
                      let node = flatHierarchy[i];
                      let props = JSON.parse(node.feature.properties);
                      newFeatures[props.uuid] = {
                        name: props.name,
                        id: node.id,
                      };
                    }
                    let newFeatureUUIDs = Object.keys(newFeatures);
                    let oldFeatureUUIDs = Object.keys(oldFeatures);

                    //Added
                    for (let i = 0; i < newFeatureUUIDs.length; i++) {
                      if (oldFeatureUUIDs.indexOf(newFeatureUUIDs[i]) == -1)
                        added.push({
                          uuid: newFeatureUUIDs[i],
                          name: newFeatures[newFeatureUUIDs[i]].name,
                          id: newFeatures[newFeatureUUIDs[i]].id,
                        });
                    }
                    //Removed
                    for (let i = 0; i < oldFeatureUUIDs.length; i++) {
                      if (newFeatureUUIDs.indexOf(oldFeatureUUIDs[i]) == -1)
                        removed.push({
                          uuid: oldFeatureUUIDs[i],
                          name: oldFeatures[oldFeatureUUIDs[i]].name,
                          id: oldFeatures[oldFeatureUUIDs[i]].id,
                        });
                    }
                    //Changed
                    for (let i = 0; i < newFeatureUUIDs.length; i++) {
                      if (oldFeatureUUIDs.indexOf(newFeatureUUIDs[i]) != -1) {
                        if (
                          oldFeatures[newFeatureUUIDs[i]].name !=
                          newFeatures[newFeatureUUIDs[i]].name
                        ) {
                          changed.push({
                            uuid: newFeatureUUIDs[i],
                            old_name: oldFeatures[newFeatureUUIDs[i]].name,
                            new_name: newFeatures[newFeatureUUIDs[i]].name,
                            id: newFeatures[newFeatureUUIDs[i]].id,
                          });
                        }
                      }
                    }

                    cb({ added, changed, removed });
                  }
                });
            }

            findChanges(function (changes) {
              let body = {
                hierarchy: hierarchy,
                issues: issues,
                changes: changes,
              };
              if (req.query.verbose) {
                body = {
                  hierarchy: hierarchy,
                  flatHierarchy: flatHierarchy,
                  issues: issues,
                  changes: changes,
                  saviors: saviors,
                };
              }
              callback(body);
            });
          })
          .catch((err) => {
            logger("error", "Failed to compile.", req.originalUrl, req, err);
            callback();
            return null;
          });
      }
    })
    .catch((err) => {
      logger("error", "Failed to compile.", req.originalUrl, req, err);
      callback();
      return null;
    });
};
router.get("/compile", function (req, res, next) {
  let sent = false;
  compile(req, res, (body) => {
    if (sent === true) return;
    sent = true;

    if (body == null) {
      logger("error", "Failed compile file.", req.originalUrl, req);
    }
    res.send({
      status: body != null ? "success" : "failed",
      message: "File compiled.",
      body: body,
    });
  });
});

/**
 * publish sel file
 * {
 * }
 */
router.post("/publish", function (req, res, next) {
  let Table = req.body.test === "true" ? UserfilesTEST : Userfiles;
  let Histories = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  let time = Math.floor(Date.now());

  //Check that user belongs to sel group
  if (req.groups[req.leadGroupName] != true) {
    logger("info", "Unauthorized to publish.", req.originalUrl, req);
    res.send({
      status: "failure",
      message: "Unauthorized to publish.",
      body: {},
    });
    return null;
  }

  let groups = [];
  if (req.groups) groups = Object.keys(req.groups);

  Table.findAll({
    where: {
      is_master: true,
      [Sequelize.Op.or]: {
        file_owner: req.user,
        [Sequelize.Op.and]: {
          file_owner: "group",
          file_owner_group: { [Sequelize.Op.overlap]: groups },
        },
      },
    },
  }).then((files) => {
    publishToPublished(function (pass, message) {
      if (pass) {
        for (let f = 0; f < files.length; f++) {
          publishToHistory(
            Histories,
            files[f].dataValues.id,
            time,
            () => {
              if (f === files.length - 1) {
                res.send({
                  status: "success",
                  message: "Published.",
                  body: {},
                });
                triggerWebhooks("drawFileChange", {
                  id: files[f].dataValues.id,
                  res,
                });
              }
            },
            (err) => {
              logger("error", "Failed to publish.", req.originalUrl, req, err);
              res.send({
                status: "failure",
                message: "Failed to publish.",
                body: {},
              });
            }
          );
        }
      } else {
        logger("error", "Failed to publish. " + message, req.originalUrl, req);
        res.send({
          status: "failure",
          message: "Failed to publish. " + message,
          body: {},
        });
      }
    });
  });

  function publishToHistory(
    Table,
    file_id,
    time,
    successCallback,
    failureCallback
  ) {
    Table.findAll({
      limit: 1,
      where: {
        file_id: file_id,
      },
      order: [["history_id", "DESC"]],
    })
      .then((lastHistory) => {
        if (lastHistory && lastHistory.length > 0) {
          return {
            historyIndex: lastHistory[0].history_id + 1,
            history: lastHistory[0].history,
          };
        } else return { historyIndex: 0, history: [] };
      })
      .then((historyObj) => {
        let newHistoryEntry = {
          file_id: file_id,
          history_id: historyObj.historyIndex,
          time: time,
          action_index: 4,
          history: historyObj.history,
        };
        // Insert new entry into the history table
        Table.create(newHistoryEntry)
          .then((created) => {
            successCallback(newHistoryEntry);
            triggerWebhooks("drawFileAdd", {
              id: file_id,
              res,
            });
            return null;
          })
          .catch((err) => {
            failureCallback(newHistoryEntry);
          });
        return null;
      });
  }

  function publishToPublished(cb) {
    let Publisheds = req.body.test === "true" ? PublishedTEST : Published;
    req.query.verbose = true;
    compile(req, res, (body) => {
      if (body.issues.length > 0) {
        cb(false, " File has unresolved issues.");
      } else if (req.body.test === "true") {
        cb(true);
        return null;
      } else {
        PublishedStore.create({
          name: "published_family_tree",
          value: JSON.stringify(body),
          time: time,
        })
          .then(() => {
            Publisheds.destroy({
              where: {},
            }).then((del) => {
              let fH = body.flatHierarchy;

              let rows = [];
              for (let i = 0; i < fH.length; i++) {
                let feature = {
                  id: fH[i].id,
                  intent: fH[i].intent,
                  parent: fH[i].parent.hasOwnProperty("id")
                    ? fH[i].parent.id
                    : null,
                  children: fH[i].children.map((v) => {
                    return v.id;
                  }),
                  level: fH[i].feature.level,
                  properties: JSON.parse(fH[i].feature.properties),
                  geom: JSON.parse(fH[i].feature.st_asgeojson),
                };
                delete feature.properties._;
                feature.geom.crs = {
                  type: "name",
                  properties: { name: "EPSG:4326" },
                };

                rows.push(feature);
              }

              Publisheds.bulkCreate(rows, { returning: true })
                .then(function (response) {
                  cb(true);
                  return null;
                })
                .catch(function (err) {
                  logger(
                    "error",
                    "Error adding to published.",
                    req.originalUrl,
                    req,
                    err
                  );
                  cb(false);
                  return null;
                });

              return null;
            });

            return null;
          })
          .catch(function (err) {
            logger(
              "error",
              "Error adding published tree.",
              req.originalUrl,
              req,
              err
            );
            cb(false);
            return null;
          });
      }
    });
  }
});

/**
 * Get a file's history
 * {
 * 	id: <int>
 * }
 */
router.post("/gethistory", function (req, res, next) {
  let Table = req.body.test === "true" ? FilehistoriesTEST : Filehistories;

  Table.findAll({
    where: {
      file_id: req.body.id,
    },
  })
    .then((histories) => {
      if (!histories) {
        res.send({
          status: "failure",
          message: "Failed to get history.",
          body: {},
        });
      } else {
        //Newest first
        histories.sort((a, b) => (a.history_id < b.history_id ? 1 : -1));
        for (let i = 0; i < histories.length; i++)
          histories[i].dataValues.message =
            historyKey[histories[i].dataValues.action_index];

        res.send({
          status: "success",
          message: "Successfully got history.",
          body: histories,
        });
      }

      return null;
    })
    .catch((err) => {
      logger("error", "Failed to get history.", req.originalUrl, req, err);
      res.send({
        status: "failure",
        message: "Failed to get history.",
        body: {},
      });
    });
});

module.exports = { router, makeMasterFiles };
