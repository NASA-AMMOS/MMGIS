/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const bcrypt = require("bcryptjs");
const logger = require("../../../logger");

// setup User model and its fields.
var User = sequelize.define(
  "users",
  {
    username: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: true,
      validate: {
        isEmail: true
      },
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    permission: {
      type: Sequelize.ENUM,
      values: ["000", "001", "010", "011", "100", "101", "110", "111"],
      allowNull: false,
      defaultValue: "000",
    },
    token: {
      type: Sequelize.DataTypes.STRING(2048),
      allowNull: true,
    },
    missions_managing: {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
      defaultValue: null,
    },
    reset_token: {
      type: Sequelize.DataTypes.STRING(2048),
      allowNull: true,
    },
    reset_token_expiration: {
      type: Sequelize.DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    hooks: {
      beforeCreate: (user) => {
        const salt = bcrypt.genSaltSync();
        user.password = bcrypt.hashSync(user.password, salt);
      },
      beforeUpdate: (user) => {
        const salt = bcrypt.genSaltSync();
        user.password = bcrypt.hashSync(user.password, salt);
      },
    },
  },
  {
    timestamps: true,
  }
);

// Instance Method for validating user's password
User.prototype.validPassword = function (password, user) {
  return bcrypt.compareSync(password, user.password);
};

// Adds to the table, never removes
const up = async () => {
  // resetToken column
  await sequelize
    .query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS missions_managing TEXT[] NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add users.missions_managing column. DB tables may be out of sync!`,
        "user",
        null,
        err
      );
      return null;
    });

  // resetToken column
  await sequelize
    .query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token varchar(2048) NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add users.reset_token column. DB tables may be out of sync!`,
        "user",
        null,
        err
      );
      return null;
    });

  // resetTokenExpiration column
  await sequelize
    .query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiration BIGINT NULL;`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add users.reset_token_expiration column. DB tables may be out of sync!`,
        "user",
        null,
        err
      );
      return null;
    });
};

// export User model for use in other files.
module.exports = User;

module.exports = {
  User: User,
  up,
};
