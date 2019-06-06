
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


sequelize
    .authenticate()
    .then( () => {
        logger.info( 'Connection has been established successfully.' );
    } )
    .catch(err => {
        logger.error( 'Unable to connect to the database: ' + err );
    } );


const attributes = {
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