/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const logger = require("../../../logger");

const attributes = {
  name: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
  filename: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: true,
  },
  num_features: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  start_time_field: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: true,
  },
  end_time_field: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: true,
  },
  table: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
};

const options = {
  timestamps: true,
};

// setup User model and its fields.
var Geodatasets = sequelize.define("geodatasets", attributes, options);

function makeNewGeodatasetTable(
  name,
  filename,
  num_features,
  startProp,
  endProp,
  action,
  success,
  failure
) {
  name = name.replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "");

  const attributes = {
    properties: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
    },
    start_time: {
      type: Sequelize.BIGINT,
      allowNull: true,
    },
    end_time: {
      type: Sequelize.BIGINT,
      allowNull: true,
    },
    geometry_type: {
      type: Sequelize.STRING,
      unique: false,
      allowNull: false,
    },
    geom: {
      type: Sequelize.GEOMETRY,
      allowNull: true,
    },
  };

  const options = {
    timestamps: false,
  };

  if (startProp != null)
    attributes.start_time = {
      type: Sequelize.BIGINT,
      allowNull: true,
    };

  if (endProp != null)
    attributes.end_time = {
      type: Sequelize.BIGINT,
      allowNull: true,
    };

  Geodatasets.findOne({ where: { name: name } })
    .then((result) => {
      if (result) {
        let GeodatasetTable = sequelize.define(
          result.dataValues.table,
          attributes,
          options
        );
        let updateThese = {
          updatedAt: new Date().toISOString(),
          filename: filename,
        };
        if (action != "append") {
          updateThese.start_time_field = startProp;
          updateThese.end_time_field = endProp;
          updateThese.num_features = num_features;
        } else {
          updateThese.num_features = (result.num_features || 0) + num_features;
        }
        Geodatasets.update(updateThese, { where: { name: name }, silent: true })
          .then((r) => {
            sequelize
              .query(
                `CREATE INDEX IF NOT EXISTS ${result.dataValues.table}_geom_idx on ${result.dataValues.table} USING gist (geom);`
              )
              .then(() => {
                if (startProp != null || endProp != null) {
                  sequelize
                    .query(
                      `CREATE INDEX IF NOT EXISTS ${
                        result.dataValues.table
                      }_time_idx on ${result.dataValues.table} USING gist ${
                        startProp != null && endProp != null
                          ? "(start_time, end_time)"
                          : "(end_time)"
                      };`
                    )
                    .then(() => {
                      success({
                        name: result.dataValues.name,
                        table: result.dataValues.table,
                        tableObj: GeodatasetTable,
                      });

                      return null;
                    })
                    .catch((err) => {
                      logger(
                        "error",
                        "Failed to recreate temporal index for geodataset table.",
                        "geodatasets",
                        null,
                        err
                      );
                      failure({
                        status: "failure",
                        message: "Failed to recreate temporal index",
                      });
                    });
                } else {
                  success({
                    name: result.dataValues.name,
                    table: result.dataValues.table,
                    tableObj: GeodatasetTable,
                  });

                  return null;
                }
              })
              .catch((err) => {
                logger(
                  "error",
                  "Failed to recreate spatial index for geodataset table.",
                  "geodatasets",
                  null,
                  err
                );
                failure({
                  status: "failure",
                  message: "Failed to recreate spatial index",
                });
              });
          })
          .catch((err) => {
            logger(
              "error",
              "Failed to update geodatasets.",
              "geodatasets",
              null,
              err
            );
            failure({
              status: "failure",
              message: "Failed to update geodatasets",
            });
          });
      } else {
        sequelize
          .query("SELECT MAX(id) FROM geodatasets")
          .then(([results]) => {
            let newTable =
              "g" + (parseInt(results[0].max) + 1) + "_geodatasets";

            Geodatasets.create({
              name: name,
              table: newTable,
              filename: filename,
              num_features: num_features,
              start_time_field: startProp,
              end_time_field: endProp,
            })
              .then((created) => {
                let GeodatasetTable = sequelize.define(
                  newTable,
                  attributes,
                  options
                );
                sequelize
                  .sync()
                  .then(() => {
                    sequelize
                      .query(
                        `CREATE INDEX ${newTable}_geom_idx on ${newTable} USING gist (geom);`
                      )
                      .then(() => {
                        sequelize
                          .query(
                            `CREATE INDEX ${newTable}_time_idx on ${newTable} USING gist (start_time, end_time);`
                          )
                          .then(() => {
                            success({
                              name: name,
                              table: newTable,
                              tableObj: GeodatasetTable,
                            });
                            return null;
                          })
                          .catch((err) => {
                            logger(
                              "error",
                              "Failed to create temporal index for geodataset table.",
                              "geodatasets",
                              null,
                              err
                            );
                            failure({
                              status: "failure",
                              message: "Failed to create temporal index",
                            });
                          });
                      })
                      .catch((err) => {
                        logger(
                          "error",
                          "Failed to create spatial index for geodataset table.",
                          "geodatasets",
                          null,
                          err
                        );
                        failure({
                          status: "failure",
                          message: "Failed to create spatial index",
                        });
                      });
                  })
                  .catch((err) => {
                    logger(
                      "error",
                      "Failed to sync geodataset table.",
                      "geodatasets",
                      null,
                      err
                    );
                    failure({
                      status: "failure",
                      message: "Failed to sync",
                    });
                  });

                return null;
              })
              .catch((err) => {
                logger(
                  "error",
                  "Failed to create geodataset table.",
                  "geodatasets",
                  null,
                  err
                );
                failure({
                  status: "failure",
                  message: "Failed to create",
                });
              });
            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "Failed to count existing geodatasets.",
              "geodatasets",
              null,
              err
            );
            failure({
              status: "failure",
              message: "Failed to count existing geodatasets",
            });
          });
      }

      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to find existing geodatasets.",
        "geodatasets",
        null,
        err
      );
      failure({
        status: "failure",
        message: "Failed to find existing geodatasets",
        error: err,
        name: name,
      });
    });
}

// Adds to the table, never removes
const up = async () => {
  // filename column
  await sequelize
    .query(
      `ALTER TABLE geodatasets ADD COLUMN IF NOT EXISTS filename varchar(255) NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add geodatasets.filename column. DB tables may be out of sync!`,
        "geodatasets",
        null,
        err
      );
      return null;
    });

  // num_features column
  await sequelize
    .query(
      `ALTER TABLE geodatasets ADD COLUMN IF NOT EXISTS num_features INTEGER NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add geodatasets.num_features column. DB tables may be out of sync!`,
        "geodatasets",
        null,
        err
      );
      return null;
    });

  // start_time_field column
  await sequelize
    .query(
      `ALTER TABLE geodatasets ADD COLUMN IF NOT EXISTS start_time_field varchar(255) NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add geodatasets.start_time_field column. DB tables may be out of sync!`,
        "geodatasets",
        null,
        err
      );
      return null;
    });

  // end_time_field column
  await sequelize
    .query(
      `ALTER TABLE geodatasets ADD COLUMN IF NOT EXISTS end_time_field varchar(255) NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add geodatasets.end_time_field column. DB tables may be out of sync!`,
        "geodatasets",
        null,
        err
      );
      return null;
    });
};

// export User model for use in other files.
module.exports = {
  Geodatasets: Geodatasets,
  makeNewGeodatasetTable: makeNewGeodatasetTable,
  up,
};
