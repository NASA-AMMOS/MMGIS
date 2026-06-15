/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

// setup User model and its fields.
var Config = sequelize.define(
  "configs",
  {
    mission: {
      type: Sequelize.STRING,
      unique: false,
      allowNull: false,
    },
    config: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
    },
    version: {
      type: Sequelize.DataTypes.INTEGER,
      unique: false,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    updatedAt: false,
  }
);

// export User model for use in other files.
module.exports = Config;
