/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

// setup Store model and its fields.
var PublishedStore = sequelize.define(
  "published_stores",
  {
    name: {
      type: Sequelize.STRING,
      unique: false,
      allowNull: false,
    },
    value: {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: "",
    },
    time: {
      type: Sequelize.BIGINT,
      allowNull: false,
    },
  },
  {
    timestamps: false,
    updatedAt: false,
  }
);

// export User model for use in other files.
module.exports = PublishedStore;
