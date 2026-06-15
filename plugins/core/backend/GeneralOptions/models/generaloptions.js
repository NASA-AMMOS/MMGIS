/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

// setup Webhooks model and its fields.
const GeneralOptions = sequelize.define(
  "generaloptions",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    options: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    timestamps: true,
  }
);

// export Webhooks model for use in other files.
module.exports = GeneralOptions;
