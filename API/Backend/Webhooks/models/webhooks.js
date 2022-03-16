/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

// setup Webhooks model and its fields.
var Webhooks = sequelize.define(
  "webhooks",
  {
    config: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {}
    },
  },
  {
    timestamps: true
  }
);

// export Webhooks model for use in other files.
module.exports = Webhooks;
