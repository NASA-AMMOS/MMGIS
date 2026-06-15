/*
CREATE TABLE user_files(
    id SERIAL UNIQUE NOT NULL PRIMARY KEY,
    file_owner VARCHAR(50) NOT NULL,
    file_owner_group STRING[],
    file_name VARCHAR(355) NOT NULL,
    file_description VARCHAR,
    is_master BOOLEAN NOT NULL DEFAULT false,
    intent VARCHAR(50),
    public CHAR(1) NOT NULL DEFAULT '0',
    hidden CHAR(1) NOT NULL DEFAULT '0',
    created_on TIMESTAMP NOT NULL,
    updated_on TIMESTAMP NOT NULL
) WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE user_files
    OWNER to postgres;

*/
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const logger = require("../../../logger");
require("dotenv").config();

const intents = ["roi", "campaign", "campsite", "trail", "signpost", "all"];

const attributes = {
  file_owner: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: false,
  },
  file_owner_group: {
    type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.STRING),
    unique: false,
    allowNull: true,
  },
  file_name: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: false,
  },
  file_description: {
    type: Sequelize.DataTypes.STRING(10000),
    allowNull: true,
    defaultValue: "",
    unique: false,
  },
  is_master: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    unique: false,
  },
  intent: {
    type: Sequelize.ENUM,
    values: intents,
    allowNull: true,
    defaultValue: null,
    unique: false,
  },
  public: {
    type: Sequelize.ENUM,
    values: ["0", "1"],
    allowNull: false,
    defaultValue: "0",
    unique: false,
  },
  hidden: {
    type: Sequelize.ENUM,
    values: ["0", "1"],
    allowNull: false,
    defaultValue: "0",
    unique: false,
  },
  template: {
    type: Sequelize.JSON,
    allowNull: true,
    defaultValue: null,
  },
  publicity_type: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: true,
  },
  public_editors: {
    type: Sequelize.ARRAY(Sequelize.TEXT),
    unique: false,
    allowNull: true,
  },
};

const options = {
  // don't add the timestamp attributes (updatedAt, createdAt)
  // timestamps: false,
  // don't forget to enable timestamps!
  timestamps: true,

  // I do want createdAt, then true
  createdAt: "created_on",

  // I want updatedAt to actually be called update_on
  updatedAt: "updated_on",
};

// setup Userfiles model and its fields.
var Userfiles = sequelize.define("user_files", attributes, options);
var UserfilesTEST = sequelize.define("user_files_tests", attributes, options);

const makeMasterFiles = (intents) => {
  makeMasterFile(0, Userfiles);

  function makeMasterFile(i, Table) {
    let intent = intents[i];
    if (intent == null) return;

    Table.findOrCreate({
      where: {
        file_owner: "group",
        file_owner_group: ["mmgis-group"],
        file_name: intent.toUpperCase(),
        file_description: "Lead composed " + intent.toUpperCase() + "s.",
        is_master: true,
        intent: intent,
        public: "1",
        hidden: "0",
      },
    }).then(function ([userResult, created]) {
      // userResult is the user instance

      if (created) {
        logger("info", "Created Lead " + intent + " file!", "userfiles");
      }
      makeMasterFile(i + 1, Table);
      return null;
    });
  }
};

// Adds to the table, never removes
const up = async () => {
  // template column
  await sequelize
    .query(
      `ALTER TABLE user_files ADD COLUMN IF NOT EXISTS template json NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to adding user_files.template column. DB tables may be out of sync!`,
        "user_files",
        null,
        err
      );
      return null;
    });

  // publicity_type column
  await sequelize
    .query(
      `ALTER TABLE user_files ADD COLUMN IF NOT EXISTS publicity_type varchar(255) NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to adding user_files.publicity_type column. DB tables may be out of sync!`,
        "user_files",
        null,
        err
      );
      return null;
    });

  // public_editors column
  await sequelize
    .query(
      `ALTER TABLE user_files ADD COLUMN IF NOT EXISTS public_editors text[] NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to adding user_files.public_editors column. DB tables may be out of sync!`,
        "user_files",
        null,
        err
      );
      return null;
    });
};

// export User model for use in other files.
module.exports = { Userfiles, UserfilesTEST, makeMasterFiles, up };
