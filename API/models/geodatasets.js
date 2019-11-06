
/***********************************************************
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const Sequelize = require('sequelize');
const { sequelize } 	= require('../connection');
const logger    = require('../logger');


const attributes = {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    table: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
}

const options = {
    timestamps: true,
}

// setup User model and its fields.
var Geodatasets = sequelize.define('geodatasets', attributes, options )


// create all the defined tables in the specified database.
sequelize.sync()
    .then(() => logger.info('The Geodatasets table has been successfully created, if one hadn\'t existed'))
    .catch(error => logger.error('This error occurred' + error));

function makeNewGeodatasetTable( name, success, failure ) {

    name = name.replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');

    const attributes = {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        properties: {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: {}
        },
        geometry_type: {
            type: Sequelize.STRING,
            unique: false,
            allowNull: false
        },
        geom: {
            type: Sequelize.GEOMETRY,
            allowNull: true
        },
    }
    
    const options = {
        timestamps: false,
    }


    Geodatasets.findOne({ where: { name: name } })
        .then((result) => {
            if( result ) {
                let GeodatasetTable = sequelize.define(result.dataValues.table, attributes, options)
                Geodatasets.update({ updatedAt: new Date().toISOString() }, { where: { name: name }, silent: true })
                    .then( r => {
                        success({
                            name: result.dataValues.name,
                            table: result.dataValues.table,
                            tableObj: GeodatasetTable
                        })

                        return null;
                    })
                    .catch(error => failure({
                        status: 'failure',
                        message: 'Failed to update geodatasets'
                    }));
            }
            else {
                sequelize.query( 'SELECT COUNT(*) FROM geodatasets' )
                    .spread((results) => {
                        let newTable = 'g' + (parseInt(results[0].count) + 1) + '_geodatasets';
                        Geodatasets.create({
                            name: name,
                            table: newTable
                        })
                        .then( (created) => {
                            let GeodatasetTable = sequelize.define(newTable, attributes, options)
                            sequelize.sync()
                                .then(() => {
                                    success({
                                        name: name,
                                        table: newTable,
                                        tableObj: GeodatasetTable
                                    })
                                    return null;
                                } )
                                .catch(error => failure({
                                    status: 'failure',
                                    message: 'Failed to sync'
                                }));

                            return null;
                        } )
                        .catch(error => failure({
                            status: 'failure',
                            message: 'Failed to create'
                        }));
                        return null;
                    } )
                    .catch(error => failure({
                        status: 'failure',
                        message: 'Failed to count existing geodatasets'
                    }));
            }

            return null;
        } )
        .catch(error => failure({
            status: 'failure',
            message: 'Failed to find existing geodatasets',
            error: error,
            name: name
        }));
}

// export User model for use in other files.
module.exports = { 
    Geodatasets: Geodatasets,
    makeNewGeodatasetTable: makeNewGeodatasetTable
};