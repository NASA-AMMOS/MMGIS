
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
    .then(() => {
        logger.info('Connection has been established successfully.');
    })
    .catch(err => {
        logger.error('Unable to connect to the database:' + err);
    });


const attributes = {
    
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