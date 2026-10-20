/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require("sequelize");
const { sequelize } = require("../../../../../API/connection");
const logger = require("../../../../../API/logger");

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
  },
  // Columns below are added by the Authz backend's up()
  token_hash: { type: Sequelize.STRING(128), allowNull: true },
  token_prefix: { type: Sequelize.STRING(64), allowNull: true },
  name: { type: Sequelize.STRING(255), allowNull: true },
  scopes: { type: Sequelize.ARRAY(Sequelize.TEXT), allowNull: true },
  missions: { type: Sequelize.ARRAY(Sequelize.TEXT), allowNull: true },
  expires_at: { type: Sequelize.DATE, allowNull: true },
  revoked_at: { type: Sequelize.DATE, allowNull: true },
  last_used_at: { type: Sequelize.DATE, allowNull: true }
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