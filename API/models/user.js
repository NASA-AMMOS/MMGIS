
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require('sequelize');
const bcrypt    = require('bcryptjs');
const logger    = require('../logger');

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



// setup User model and its fields.
var User = sequelize.define('users',
    {
    },
    {
    },
    {
        // don't add the timestamp attributes (updatedAt, createdAt)
        // timestamps: false,
        // don't forget to enable timestamps!
        timestamps: true,

        // I do want createdAt, then true
        createdAt: true,

        // I want updatedAt to actually be called updateTimestamp
        // updatedAt: 'updateTimestamp',
        updatedAt: true,

        // And deletedAt to be called destroyTime (remember to enable paranoid for this to work)
        deletedAt: 'destroyTime',
        paranoid: true
    });


// Instance Method for validating user's password
User.prototype.validPassword = function(password, user) {
    logger.info('Entered password: ', password);
    logger.info('User password:', user.password);
    return bcrypt.compareSync(password, user.password);
};


// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => logger.info('User table has been successfully created, if one doesn\'t exist'))
    .catch(error => logger.error('This error occurred' + error));

// export User model for use in other files.
module.exports = User;