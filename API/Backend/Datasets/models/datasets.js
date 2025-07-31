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
var Datasets = sequelize.define("datasets", attributes, options);

function makeNewDatasetTable(name, columns, success, failure) {
  name = name.replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "");

  let attributes = {};

  columns.forEach((element) => {
    attributes[element] = {
      type: Sequelize.STRING,
      unique: false,
      allowNull: true,
    };
  });

  const options = {
    timestamps: false,
  };

  Datasets.findOne({ where: { name: name } })
    .then((result) => {
      if (result) {
        let DatasetTable = sequelize.define(
          result.dataValues.table,
          attributes,
          options
        );
        Datasets.update(
          { updatedAt: new Date().toISOString() },
          { where: { name: name }, silent: true }
        )
          .then((r) => {
            success({
              name: result.dataValues.name,
              table: result.dataValues.table,
              tableObj: DatasetTable,
            });

            return null;
          })
          .catch((err) => {
            logger(
              "error",
              "Failed to update datasets.",
              "datasets",
              null,
              err
            );
            failure({
              status: "failure",
              message: "Failed to update datasets",
            });
          });
      } else {
        sequelize
          .query("SELECT COUNT(*) FROM datasets")
          .then(([results]) => {
            let newTable = "d" + (parseInt(results[0].count) + 1) + "_datasets";
            Datasets.create({
              name: name,
              table: newTable,
            })
              .then((created) => {
                let DatasetTable = sequelize.define(
                  newTable,
                  attributes,
                  options
                );
                sequelize
                  .sync()
                  .then(() => {
                    success({
                      name: name,
                      table: newTable,
                      tableObj: DatasetTable,
                    });
                    return null;
                  })
                  .catch((err) => {
                    logger(
                      "error",
                      "Failed to sync dataset table.",
                      "datasets",
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
                  "Failed to create dataset table.",
                  "datasets",
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
              "Failed to count existing datasets.",
              "datasets",
              null,
              err
            );
            failure({
              status: "failure",
              message: "Failed to count existing datasets",
            });
          });
      }

      return null;
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to find existing datasets.",
        "datasets",
        null,
        err
      );
      failure({
        status: "failure",
        message: "Failed to find existing datasets",
        error: err,
        name: name,
      });
    });
}

// export User model for use in other files.
module.exports = {
  Datasets: Datasets,
  makeNewDatasetTable: makeNewDatasetTable,
};
