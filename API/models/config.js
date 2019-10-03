
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require('sequelize');
const { sequelize } 	= require('../connection');
const logger    = require('../logger');

// setup User model and its fields.
var Config = sequelize.define('configs',
    {
        mission: {
            type: Sequelize.STRING,
            unique: false,
            allowNull: false
        },
        config: {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: {}
        },
        version: {
            type: Sequelize.DataTypes.INTEGER,
            unique: false,
            allowNull: false
        },
    },
    {
        timestamps: true,
        updatedAt: false,
    });

// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => logger.info('Config table has been successfully created, if one doesn\'t exist'))
    .catch(error => logger.error('This error occurred' + error));

// export User model for use in other files.
module.exports = Config;