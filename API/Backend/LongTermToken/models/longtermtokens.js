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
  }
};

const options = {
  timestamps: true
};

// setup User model and its fields.
var LongTermTokens = sequelize.define("long_term_tokens", attributes, options);

// export User model for use in other files.
module.exports = LongTermTokens;
