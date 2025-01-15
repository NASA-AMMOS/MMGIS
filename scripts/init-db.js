const Sequelize = require("sequelize");
const logger = require("../API/logger");
const execSync = require("child_process").execSync;
require("dotenv").config({ path: __dirname + "/../.env" });

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
          logger(
            "info",
            `Database mmgis-stac already exists. Nothing to do...`,
            "connection"
          );
          keepGoingSTAC();
          return null;
        });

      function keepGoingSTAC() {
        try {
          const output = execSync(`pypgstac migrate`, {
            env: {
              PYTHONUTF8: 1,
              PGHOST: process.env.DB_HOST,
              PGPORT: process.env.DB_PORT,
              PGUSER: process.env.DB_USER,
              PGDATABASE: "mmgis-stac",
              PGPASSWORD: process.env.DB_PASS,
            },
          });
          logger(
            "info",
            `Conformed the mmgis-stac database to pgstac.`,
            "connection"
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
        logger(
          "info",
          `Database ${process.env.DB_NAME} already exists. Nothing to do...`,
          "connection"
        );
        keepGoing();
        return null;
      });

    async function keepGoing() {
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
