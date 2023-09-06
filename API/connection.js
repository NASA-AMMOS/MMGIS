const Sequelize = require("sequelize");
const logger = require("./logger");
require("dotenv").config();

// create a sequelize instance with our local postgres database information.
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: process.env.VERBOSE_LOGGING == "true" || false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Source: http://docs.sequelizejs.com/manual/installation/getting-started.html
sequelize
  .authenticate()
  .then(() => {
    logger(
      "info",
      "Database connection has successfully been established.",
      "connection"
    );
  })
  .catch((err) => {
    logger(
      "infrastructure_error",
      "Unable to connect to the database.",
      "connection",
      null,
      err
    );
  });

module.exports = { sequelize };
