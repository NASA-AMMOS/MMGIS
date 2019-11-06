
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require('sequelize');
const { sequelize } 	= require('../connection');
const logger    = require('../logger');

// setup Store model and its fields.
var PublishedStore = sequelize.define('published_stores',
    {
        name: {
            type: Sequelize.STRING,
            unique: false,
            allowNull: false
        },
        value: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: ''
        },
        time: {
            type: Sequelize.BIGINT,
            allowNull: false
        },
    },
    {
        timestamps: false,
        updatedAt: false,
    });

// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => logger.info('Published Store table has been successfully created, if one hadn\'t existed'))
    .catch(error => logger.error('This error occurred' + error));

// export User model for use in other files.
module.exports = PublishedStore;