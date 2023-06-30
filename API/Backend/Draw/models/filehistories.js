/*
CREATE TABLE file_histories(
    id SERIAL UNIQUE NOT NULL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES user_files(id),
    history_id INTEGER NOT NULL,
    time BIGINT NOT NULL,
    action_index INTEGER NOT NULL,
    history INT[]
) WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE file_histories
    OWNER to postgres;

*/
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
require("dotenv").config();

const attributes = {
  file_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  history_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  time: {
    type: Sequelize.BIGINT,
    allowNull: false,
  },
  action_index: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  history: {
    type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.INTEGER),
    allowNull: true,
  },
  author: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: true,
  },
};

const options = {
  timestamps: false,
};

// setup Filehistories model and its fields.
var Filehistories = sequelize.define("file_histories", attributes, options);
var FilehistoriesTEST = sequelize.define(
  "file_histories_tests",
  attributes,
  options
);

// Adds to the table, never removes
const up = async () => {
  // author column
  await sequelize
    .query(
      `ALTER TABLE file_histories ADD COLUMN IF NOT EXISTS author varchar(255) NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to adding file_histories.author column. DB tables may be out of sync!`,
        "file_histories",
        null,
        err
      );
      return null;
    });
};

// export Filehistories model for use in other files.
module.exports = { Filehistories, FilehistoriesTEST, up };
