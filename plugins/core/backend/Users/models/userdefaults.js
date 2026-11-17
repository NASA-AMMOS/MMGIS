/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../../../API/connection");

// Site-wide defaults applied to newly created user accounts (single row, id 1).
const UserDefaults = sequelize.define(
  "user_defaults",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    missions_viewing: {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    timestamps: true,
  }
);

// null = unrestricted, [] = no missions, [...] = listed missions
async function getDefaultMissionsViewing() {
  const row = await UserDefaults.findOne({ where: { id: 1 } });
  if (row == null || !Array.isArray(row.missions_viewing)) return null;
  return row.missions_viewing;
}

module.exports = {
  UserDefaults,
  getDefaultMissionsViewing,
};
