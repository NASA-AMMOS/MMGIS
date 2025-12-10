const fs = require("fs");
const Sequelize = require("sequelize");
const logger = require("../API/logger");
const utils = require("../API/utils");
const execSync = require("child_process").execSync;
require("dotenv").config({ path: __dirname + "/../.env" });

const isDocker = utils.isDocker();

function classifyPostgresError(err) {
  // Check if we have a PostgreSQL error with a code
  if (!err || !err.parent || !err.parent.code) {
    return {
      isExpected: false,
      type: "unknown",
      message: err?.message || "Unknown error",
    };
  }

  const pgError = err.parent;
  const code = pgError.code;

  // Database already exists - expected
  if (code === "42P04") {
    return {
      isExpected: true,
      type: "already_exists",
      message: pgError.message,
      code: code,
    };
  }

  // Connection-related errors - critical
  if (code.startsWith("08") || code === "53300") {
    return {
      isExpected: false,
      type: "connection_error",
      message: pgError.message,
      code: code,
    };
  }

  // Permission errors - critical
  if (code === "42501") {
    return {
      isExpected: false,
      type: "permission_error",
      message: pgError.message,
      code: code,
    };
  }

  // All other errors - treat as unexpected/critical
  return {
    isExpected: false,
    type: "unexpected",
    message: pgError.message,
    code: code,
  };
}

initializeDatabase()
  .then(() => {
    logger("info", "Finished successfully.", "connection");
    process.exit();
  })
  .catch((err) => {
    logger("info", "Failed.", "connection", err);
    process.exit(1);
  });

async function initializeDatabase() {
  return new Promise(async (resolve, reject) => {
    const baseSequelize = new Sequelize(
      null,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || "5432",
        dialect: "postgres",
        dialectOptions: {
          ssl:
            process.env.DB_SSL === "true"
              ? {
                  require: true,
                  rejectUnauthorized: true,
                  ca:
                    process.env.DB_SSL_CERT_BASE64 != null &&
                    process.env.DB_SSL_CERT_BASE64 !== ""
                      ? Buffer.from(
                          process.env.DB_SSL_CERT_BASE64,
                          "base64"
                        ).toString("utf-8")
                      : process.env.DB_SSL_CERT != null &&
                        process.env.DB_SSL_CERT !== ""
                      ? fs.readFileSync(process.env.DB_SSL_CERT)
                      : false,
                }
              : false,
        },
        logging: process.env.VERBOSE_LOGGING == "true" || false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      }
    );
    await baseSequelize
      .query(`SELECT version();`)
      .then((version) => {
        logger(
          "info",
          `Database version: ${version[0][0].version}`,
          "connection"
        );
      })
      .catch((err) => {
        return null;
      });

    if (
      process.env.WITH_STAC === "true" ||
      process.env.WITH_TIPG === "true" ||
      process.env.WITH_TITILER_PGSTAC === "true"
    ) {
      // mmgis-stac
      await baseSequelize
        .query(`CREATE DATABASE "mmgis-stac";`)
        .then(() => {
          logger("info", `Created mmgis-stac database.`, "connection");

          keepGoingSTAC();
          return null;
        })
        .catch((err) => {
          const errorInfo = classifyPostgresError(err);

          if (errorInfo.isExpected) {
            // Expected error - database already exists
            logger(
              "info",
              `Database mmgis-stac already exists. Nothing to do...`,
              "connection"
            );
            keepGoingSTAC();
          } else {
            // Unexpected/critical error
            logger(
              errorInfo.type === "connection_error"
                ? "infrastructure_error"
                : "error",
              `Failed to create mmgis-stac database: ${errorInfo.message} (code: ${errorInfo.code})`,
              "connection",
              null,
              err
            );
            // Still attempt to continue, but log the real error
            keepGoingSTAC();
          }
          return null;
        });

      function keepGoingSTAC() {
        try {
          const output = execSync(
            `${
              isDocker ? `source ~/.bashrc && micromamba run -n mmgis ` : ``
            }pypgstac migrate`,
            {
              env: {
                PYTHONUTF8: 1,
                PGHOST: process.env.DB_HOST,
                PGPORT: process.env.DB_PORT,
                PGUSER: process.env.DB_USER,
                PGDATABASE: "mmgis-stac",
                PGPASSWORD: process.env.DB_PASS,
              },
            }
          );
          logger(
            "info",
            `Conformed the mmgis-stac database to pgstac.`,
            "connection",
            output
          );
        } catch (err) {
          logger(
            "warning",
            `Failed to conform the mmgis-stac database to pgstac.`,
            "connection",
            err
          );
        }
      }
    }

    await baseSequelize
      .query(`CREATE DATABASE "${process.env.DB_NAME}";`)
      .then(() => {
        logger(
          "info",
          `Created ${process.env.DB_NAME} database.`,
          "connection"
        );
        keepGoing();
        return null;
      })
      .catch((err) => {
        const errorInfo = classifyPostgresError(err);

        if (errorInfo.isExpected) {
          // Expected error - database already exists
          logger(
            "info",
            `Database ${process.env.DB_NAME} already exists. Nothing to do...`,
            "connection"
          );
          keepGoing();
        } else {
          // Unexpected/critical error
          logger(
            errorInfo.type === "connection_error"
              ? "infrastructure_error"
              : "error",
            `Failed to create ${process.env.DB_NAME} database: ${errorInfo.message} (code: ${errorInfo.code})`,
            "connection",
            null,
            err
          );
          // Still attempt to continue, but log the real error
          keepGoing();
        }
        return null;
      });

    async function keepGoing() {
      const sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT || "5432",
          dialect: "postgres",
          dialectOptions: {
            ssl:
              process.env.DB_SSL === "true"
                ? {
                    require: true,
                    rejectUnauthorized: true,
                    ca:
                      process.env.DB_SSL_CERT_BASE64 != null &&
                      process.env.DB_SSL_CERT_BASE64 !== ""
                        ? Buffer.from(
                            process.env.DB_SSL_CERT_BASE64,
                            "base64"
                          ).toString("utf-8")
                        : process.env.DB_SSL_CERT != null &&
                          process.env.DB_SSL_CERT !== ""
                        ? fs.readFileSync(process.env.DB_SSL_CERT)
                        : false,
                  }
                : false,
          },
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
        .then(async () => {
          logger("info", "Database connection is successful.", "connection");
          await sequelize
            .query(`CREATE EXTENSION postgis;`)
            .then(() => {
              logger("info", `Created POSTGIS extension.`, "connection");
              return null;
            })
            .catch((err) => {
              logger(
                "info",
                `POSTGIS extension already exists. Nothing to do...`,
                "connection"
              );
              return null;
            });

          await sequelize
            .query(`CREATE EXTENSION btree_gist;`)
            .then(() => {
              logger("info", `Created BTREE_GIST extension.`, "connection");
              return null;
            })
            .catch((err) => {
              logger(
                "info",
                `BTREE_GIST extension already exists. Nothing to do...`,
                "connection"
              );
              return null;
            });
          await sequelize
            .query(
              `
            CREATE TABLE "session" (
              "sid" varchar NOT NULL COLLATE "default",
              "sess" json NOT NULL,
              "expire" timestamp(6) NOT NULL
            )
            WITH (OIDS=FALSE);
            
            ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
            
            CREATE INDEX "IDX_session_expire" ON "session" ("expire");`
            )
            .then(() => {
              logger("info", `Created "session" table.`, "connection");
              return null;
            })
            .catch((err) => {
              logger(
                "info",
                `"session" table already exists. Nothing to do...`,
                "connection"
              );
              return null;
            });
          resolve();
        })
        .catch((err) => {
          logger(
            "infrastructure_error",
            "Unable to connect to the database.",
            "connection",
            null,
            err
          );
          reject();
          return null;
        });
    }

    return null;
  });
}
