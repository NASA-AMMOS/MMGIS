/*
CREATE TABLE url_shortner(
    id SERIAL UNIQUE NOT NULL PRIMARY KEY,
    short VARCHAR(256) NOT NULL,
    full VARCHAR(2048) NOT NULL,
    creator VARCHAR(50),
    created_on TIMESTAMP NOT NULL,
    updated_on TIMESTAMP NOT NULL
) WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE url_shortener
    OWNER to postgres;

*/
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
require("dotenv").config();

// setup UrlShortener model and its fields.
var UrlShortener = sequelize.define(
  "url_shortener",
  {
    short: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false
    },
    full: {
      type: Sequelize.STRING(2048),
      allowNull: false
    },
    creator: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: ""
    }
  },
  {
    // don't add the timestamp attributes (updatedAt, createdAt)
    // timestamps: false,
    // don't forget to enable timestamps!
    timestamps: true,

    // I do want createdAt, then true
    createdAt: "created_on",

    // I want updatedAt to actually be called updateTimestamp
    updatedAt: "updated_on"
  }
);

// export User model for use in other files.
module.exports = { UrlShortener, sequelize };
