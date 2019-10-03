/*
CREATE TABLE published(
    id SERIAL UNIQUE NOT NULL PRIMARY KEY,
    intent VARCHAR(50),
    parent INTEGER,
    children INTEGER[],
    level INTEGER,
    properties JSON,
    geom geometry(GEOMETRY,4326)
) WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE published
    OWNER to postgres;

*/
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require('sequelize');
const { sequelize } = require('../connection');
const logger    = require('../logger');

const attributes = {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    intent: {
        type: Sequelize.ENUM,
        values: ['roi','campaign','campsite','trail','signpost'],
        allowNull: false,
        unique: false,
        defaultValue: null
    },
    parent: {
        type: Sequelize.DataTypes.INTEGER,
        unique: false,
        allowNull: true
    },
    children: {
        type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.INTEGER),
        unique: false,
        allowNull: true
    },
    level: {
        type: Sequelize.INTEGER,
        unique: false,
        allowNull: false
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

var Published = sequelize.define('publisheds', attributes, options);
var PublishedTEST = sequelize.define('publisheds_tests', attributes, options);


// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => {
        logger.info('publisheds table has been successfully created, if one doesn\'t exist')
    })
    .catch(error => logger.error('This error occurred' + error));


// export User model for use in other files.
module.exports = { Published, PublishedTEST };