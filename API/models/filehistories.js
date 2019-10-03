/*
CREATE TABLE file_histories(
    id SERIAL UNIQUE NOT NULL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES user_files(id),
    history_id INTEGER NOT NULL,
    time BIGINT NOT NULL,
    action_index INTEGER NOT NULL,
    history INT[]
) WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE file_histories
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
    history_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    time: {
        type: Sequelize.BIGINT,
        allowNull: false
    },
    action_index: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    history: {
        type: Sequelize.DataTypes.ARRAY(Sequelize.DataTypes.INTEGER),
        allowNull: true
    },
}

const options = {
    timestamps: false,
}

// setup Filehistories model and its fields.
var Filehistories = sequelize.define('file_histories', attributes, options);
var FilehistoriesTEST = sequelize.define('file_histories_tests', attributes, options);


// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => {
    })
    .catch( err => logger.error( 'ERROR: ' + err ) );


// export Filehistories model for use in other files.
module.exports = { Filehistories, FilehistoriesTEST };