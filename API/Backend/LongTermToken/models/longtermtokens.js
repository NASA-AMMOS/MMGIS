/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");
const logger = require("../../../logger");

const attributes = {
  token: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: false
  },
  period: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: false
  },
  created_by_user_id: {
    type: Sequelize.INTEGER,
    unique: false,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
};

const options = {
  timestamps: true
};

// setup User model and its fields.
var LongTermTokens = sequelize.define("long_term_tokens", attributes, options);

// Adds to the table, never removes
const up = async () => {
  // resetToken column
  await sequelize
    .query(
      `ALTER TABLE long_term_tokens ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);`
    )
    .then(() => {
      return null;
    })
    .catch((err) => {
      logger(
        "error",
        `Failed to add long_term_tokens.created_by_user_id column. DB tables may be out of sync!`,
        "long_term_tokens",
        null,
        err
      );
      return null;
    });
};

// export User model for use in other files.
module.exports = {
  LongTermTokens: LongTermTokens,
  up,
};