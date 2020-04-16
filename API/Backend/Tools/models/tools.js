const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

var Tools = sequelize.define(
  "tools",
  {
    tools: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {}
    }
  },
  {
    timestamps: true,
    updatedAt: false
  }
);

module.exports = Tools;
