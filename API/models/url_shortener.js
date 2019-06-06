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
const Sequelize = require('sequelize');
const logger    = require('../logger');
require('dotenv').config();

// create a sequelize instance with our local postgres database information.
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',

        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });


// Source: http://docs.sequelizejs.com/manual/installation/getting-started.html
sequelize
    .authenticate()
    .then( () => {
        logger.info( 'Connection has been established successfully.' );
    } )
    .catch(err => {
        logger.error( 'Unable to connect to the database: ' + err );
    } );



// setup UrlShortener model and its fields.
var UrlShortener = sequelize.define('url_shortener',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
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
            defaultValue: ''
        }
    },
    {
        // don't add the timestamp attributes (updatedAt, createdAt)
        // timestamps: false,
        // don't forget to enable timestamps!
        timestamps: true,

        // I do want createdAt, then true
        createdAt: 'created_on',

        // I want updatedAt to actually be called updateTimestamp
        updatedAt: 'updated_on',
    });


// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => {
    })
    .catch( err => logger.error( 'ERROR: ' + err ) );


// export User model for use in other files.
module.exports = { UrlShortener, sequelize };