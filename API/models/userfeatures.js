/*
CREATE TABLE user_features(
    id SERIAL UNIQUE NOT NULL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES user_files(id),
    level INTEGER,
    intent VARCHAR(50),
    properties JSON,
    geom geometry(GEOMETRY,4326)
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
const Sequelize = require('sequelize');
const { sequelize } 	= require('../connection');
const logger    = require('../logger');
require('dotenv').config();

const attributes = {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    file_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    level: {
        type: Sequelize.INTEGER,
        unique: false,
        allowNull: false
    },
    intent: {
        type: Sequelize.ENUM,
        values: ['roi','campaign','campsite','trail','signpost','polygon','line','point','text','arrow'],
        allowNull: true,
        defaultValue: null
    },
    properties: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {}
    },
    geom: {
        type: Sequelize.GEOMETRY,
        allowNull: true
    },
}

const options = {
    timestamps: false,
}

var Userfeatures = sequelize.define('user_features', attributes, options);
var UserfeaturesTEST = sequelize.define('user_features_tests', attributes, options);


// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => {
        logger.info('user_features table has been successfully created, if one doesn\'t exist')
    })
    .catch(error => logger.error('This error occurred' + error));


// export User model for use in other files.
module.exports = { Userfeatures, UserfeaturesTEST, sequelize };