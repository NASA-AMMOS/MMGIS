const express  = require('express');
const logger   = require('../logger');
const database = require('../database');
const Sequelize = require('sequelize');
const fhistories       	= require('../models/filehistories')
const Filehistories 	= fhistories.Filehistories
const FilehistoriesTEST	= fhistories.FilehistoriesTEST
const ufiles           	= require('../models/userfiles');
const Userfiles 	   	= ufiles.Userfiles;
const UserfilesTEST	   	= ufiles.UserfilesTEST;
const uf               	= require('../models/userfeatures');
const Userfeatures     	= uf.Userfeatures;
const UserfeaturesTEST 	= uf.UserfeaturesTEST;
const { sequelize } = require('../connection');

const router   = express.Router();
const db       = database.db;

router.post('/', function(req, res, next) {
	res.send('test draw');
});


const pushToHistory = ( Table, file_id, feature_id, feature_idRemove, time, undoToTime, action_index, successCallback, failureCallback ) => {
	Table.findAll({
		where: {
			file_id: file_id
		},
	} )
	.then( histories => {
		let maxHistoryId = -Infinity;
		if( histories && histories.length > 0 ) {
			for( let i = 0; i < histories.length; i++ ) {
				maxHistoryId = Math.max( histories[i].history_id, maxHistoryId );
			}
			return { historyIndex: maxHistoryId + 1, history: histories[maxHistoryId].history };
		}
		else return { historyIndex: 0, history: [] };
	} )
	.then( historyObj => {
		getNextHistory( Table, historyObj.history, action_index, feature_id, feature_idRemove, file_id, undoToTime, (h) => {
			let newHistoryEntry = {
				file_id: file_id,
				history_id: historyObj.historyIndex,
				time: time,
				action_index: action_index,
				history: h
			}
			// Insert new entry into the history table
			Table.create( newHistoryEntry )
				.then( (created) => {
					successCallback();
					return null;
				} )
				.catch( err => {
					console.log( err );
					failureCallback();
				} );
		}, () => {
			failureCallback();
		} );
		return null;
	} )
}

const getNextHistory = (Table, history, action_index, feature_idAdd, feature_idRemove, file_id, undoToTime, successCallback, failureCallback ) => {
	switch( action_index ) {
		case 0: //add
			history.push( feature_idAdd );
			if( Array.isArray(feature_idAdd) )
				history = feature_idAdd;
			successCallback( history );
			return;
		case 1: //edit
			history.splice( history.indexOf( parseInt( feature_idRemove ) ), 1 );
			history.push( feature_idAdd );
			successCallback( history );
			return;
		case 2: //delete
			history.splice( history.indexOf( parseInt( feature_idRemove ) ), 1 );
			successCallback( history );
			return;
		case 3: //undo
			//Here we do want to use the last history, we want to use the history at undo to time
			Table.findOne({
				where: {
					file_id: file_id,
					time: undoToTime
				},
			} )
			.then( history => {
				successCallback( history.history );
				return null;
			} )
			.catch( err => {
				failureCallback();
				return null;
			} );
			break;
		default:
			failureCallback();
	}
}
/**
 * Adds a feature
 * {
 * 	file_id: <number> (required)
 * 	parent: <number> (optional)
 *  order: <'min' || 'max' || int> (optional) 
 * 		'min' and < 0 adds behind all features
 *  keywords: <string array> (optional)
 *  intent: <string> (optional)
 *  properties: <object> (optional)
 * 	geometry: <geometry> (required)
 * }
 */
const add = function( req, res, successCallback, failureCallback1, failureCallback2 ) {
	let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	let time = Math.floor(Date.now());

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);

	if( req.body.to_history == null )
		req.body.to_history = true;

	//Check that the provided file_id is an id that belongs to the current user
	Files.findOne({
		where: {
			id: req.body.file_id,
			[Sequelize.Op.or]: {
				file_owner: req.user,
				[Sequelize.Op.and]: {
					file_owner: 'group',
					file_owner_group: { [Sequelize.Op.overlap]: groups }
				}
			}			
		}
	} )
	.then( file => {
		if( !file ) {
			if( typeof failureCallback1 === 'function' )
				failureCallback1();
		}
		else {
			//Find the next level
			let order = 'max';
			if( req.body.order == 'min' || req.body.order < 0 )
				order = 'min';

			Features.findAll({
				where: {
					file_id: req.body.file_id
				},
			} )
			.then( features => {
				let maxLevel = -Infinity;
				let minLevel = Infinity;
				if( features && features.length > 0 ) {
					for( let i = 0; i < features.length; i++ ) {
						maxLevel = Math.max( features[i].level, maxLevel );
						minLevel = Math.min( features[i].level, minLevel );
					}
					if( order === 'max' ) return maxLevel + 1;
					else return minLevel - 1;
				}
				else return 0;
			} )
			.then( level => {
				let properties = req.body.properties || {};
				//Remove _ from properties if it has it. This is because the server returns metadata
				// under _ and we don't want it to potentially nest
				delete properties['_'];

				let geom = JSON.parse( req.body.geometry );
				//Geometry needs this for the spatialiness to work
				geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
				
				let newUserfeature = {
					file_id: req.body.file_id,
					level: level,
					intent: req.body.intent,
					elevated: '0',
					properties: properties,
					geom: geom,
				};

				// Insert new feature into the feature table
				Features.create( newUserfeature )
					.then( (created) => {
						if( req.body.to_history ) {
							let id = created.id;
							if( req.body.bulk_ids != null ) {
								id = req.body.bulk_ids;
								id.push( created.id );
							}
							pushToHistory( Histories, req.body.file_id, id, null, time, null, 0,
								() => {
									if( typeof successCallback === 'function' )
										successCallback(created.id, created.intent);
								},
								() => {
									if( typeof failureCallback2 === 'function' )
										failureCallback2();
								} )
							}
						else {
							if( typeof successCallback === 'function' )
								successCallback(created.id, created.intent);
						}
						return null;
					} )
					.catch( err => {
						if( typeof failureCallback2 === 'function' )
							failureCallback2();
						
					} );
			} );
			return null;
		}
	} );
}
router.post('/add', function(req, res, next) {
	add( req, res,
		(id, intent) => {
			res.send( {
				status: 'success',
				message: 'Successfully added a new feature.',
				body: { id: id, intent: intent }
			} );
		},
		() => {
			res.send( {
				status: 'failure',
				message: 'Failed to access file.',
				body: {}
			} )
		},
		() => {
			res.send( {
				status: 'failure',
				message: 'Failed to add new feature.',
				body: {}
			} )
		}
		)
} );

/**
 * Edits a feature
 * {
 * 	file_id: <number> (required)
 *  feature_id: <number> (required)
 * 	parent: <number> (optional)
 *  keywords: <string array> (optional)
 *  intent: <string> (optional)
 *  properties: <object> (optional)
 * 	geometry: <geometry> (optional)
 * }
 */
router.post('/edit', function(req, res, next) {
	let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	let time = Math.floor(Date.now());

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);

	Files.findOne({
		where: {
			id: req.body.file_id,
			[Sequelize.Op.or]: {
				file_owner: req.user,
				[Sequelize.Op.and]: {
					file_owner: 'group',
					file_owner_group: { [Sequelize.Op.overlap]: groups }
				}
			}
			
		}
	} )
	.then( file => {
		if( !file ) {
			res.send( {
				status: 'failure',
				message: 'Failed to access file.',
				body: {}
			} );
		}
		else {
			Features.findOne({
				where: {
					id: req.body.feature_id,
					file_id: req.body.file_id
				},
				attributes: { include: [[Sequelize.fn('ST_AsGeoJSON', Sequelize.col('geom')), 'geojson_geom']] }
			} )
			.then( feature => {
				if( !feature ) {
					res.send( {
						status: 'failure',
						message: 'Failed to access feature.',
						body: {}
					} );
				}
				else {
					var newAttributes = feature.dataValues;
					
					delete newAttributes['id'];
					delete newAttributes.properties['_'];
					newAttributes.extant_start = time;

					if( req.body.hasOwnProperty('parent') ) newAttributes.parent = req.body.parent;
					if( req.body.hasOwnProperty('keywords') ) newAttributes.keywords = req.body.keywords;
					if( req.body.hasOwnProperty('intent') ) newAttributes.intent = req.body.intent;
					if( req.body.hasOwnProperty('properties') ) newAttributes.properties = req.body.properties;
					if( req.body.hasOwnProperty('geometry') ) {
						newAttributes.geom = JSON.parse( req.body.geometry );
					}
					else {
						newAttributes.geom = JSON.parse( feature.dataValues.geojson_geom );
					}

					newAttributes.geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
					Features.update(
						{
							extant_end: time
						},
						{
							where: {
								id: req.body.feature_id,
								file_id: req.body.file_id,
							}
						} )
						.then( (created) => {
							Features.create( newAttributes )
								.then( (created) => {
									pushToHistory( Histories, req.body.file_id, created.id, req.body.feature_id, time, null, 1,
										() => {
											res.send( {
												status: 'success',
												message: 'Successfully edited feature.',
												body: { id: created.id, intent: created.intent }
											} );
										},
										() => {
											res.send( {
												status: 'failure',
												message: 'Failed to edit feature.',
												body: {}
											} );
										} )
									return null;
								} )
								.catch( err => {
									res.send( {
										status: 'failure',
										message: 'Failed to edit feature.',
										body: {}
									} );
								} );
							return null;
						} )
						.catch( err => {
							res.send( {
								status: 'failure',
								message: 'Failed to edit feature.',
								body: {}
							} );
						} );
				}
				return null;
			} )
			.catch( err => {
				res.send( {
					status: 'failure',
					message: 'Failed to find feature.',
					body: {}
				} );
			} );
		}
		
		return null;
	} )
	.catch( err => {
		res.send( {
			status: 'failure',
			message: 'Failed to edit feature.',
			body: {}
		} );
	} );
});

/**
 * Hides a feature
 * {
 * 	file_id: <number> (required)
 *  feature_id: <number> (required)
 * }
*/
router.post('/remove', function(req, res, next) {
	let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	let time = Math.floor(Date.now());

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);

	Files.findOne({
		where: {
			id: req.body.file_id,
			[Sequelize.Op.or]: {
				file_owner: req.user,
				[Sequelize.Op.and]: {
					file_owner: 'group',
					file_owner_group: { [Sequelize.Op.overlap]: groups }
				}
			}
		}
	} )
	.then( file => {
		if( !file ) {
			res.send( {
				status: 'failure',
				message: 'Failed to access file.',
				body: {}
			} );
		}
		else {
			Features.update(
				{
					extant_end: time
				},
				{
				where: {
					file_id: req.body.file_id,
					id: req.body.id,
				}
				} )
				.then( () => {
					//Table, file_id, feature_id, feature_idRemove, time, undoToTime, action_index
					pushToHistory( Histories, req.body.file_id, null, req.body.id, time, null, 2,
						() => {
							res.send( {
								status: 'success',
								message: 'Feature removed.',
								body: {}
							} );
						},
						() => {
							res.send( {
								status: 'failure',
								message: 'Failed to remove feature.',
								body: {}
							} );
						} )
						
					return null;
				} )
				.catch( err => {
						res.send( {
							status: 'failure',
							message: 'Failed to find and remove feature.',
							body: {}
						} );
				});
		}
		
		return null;
	} );
});


/**
 * Undoes drawings
 * {
 * 	file_id: <number> (required)
 *  undo_time: <number> (required)
 * }
*/
router.post('/undo', function(req, res, next) {
	let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	let time = Math.floor(Date.now());

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);
		
	Files.findOne({
		where: {
			id: req.body.file_id,
			[Sequelize.Op.or]: {
				file_owner: req.user,
				[Sequelize.Op.and]: {
					file_owner: 'group',
					file_owner_group: { [Sequelize.Op.overlap]: groups }
				}
			}
		}
	} )
	.then( file => {
		if( !file ) {
			res.send( {
				status: 'failure',
				message: 'Failed to access file.',
				body: {}
			} );
		}
		else {
			Features.update(
				{
					trimmed_start: Sequelize.fn('array_append', Sequelize.col('trimmed_start'), req.body.undo_time),
					trimmed_at: Sequelize.fn('array_append', Sequelize.col('trimmed_at'), String(time) ),
					trimmed_at_final: time
				},
				{
				where: {
					file_id: req.body.file_id,
					
					[Sequelize.Op.or]: {
						[Sequelize.Op.and]: {
							extant_start: {
								[Sequelize.Op.gt]: req.body.undo_time
							},
							[Sequelize.Op.or]: {
								extant_end: {
									[Sequelize.Op.gt]: req.body.undo_time
								},
								extant_end: null
							}
						},
						trimmed_at_final: { //undo time less than any trimmed end value
							[Sequelize.Op.lte]: time
						},
					}
				}
				} )
				.then( (r) => {
					pushToHistory( Histories, req.body.file_id, null, null, time, req.body.undo_time, 3,
						() => {
							res.send( {
								status: 'success',
								message: 'Undo successful.',
								body: {}
							} );
						},
						() => {
							res.send( {
								status: 'failure',
								message: 'Failed to undo.',
								body: {}
							} );
						} )
					
					return null;
				} )
				.catch( err => {
					console.log( err );
					res.send( {
						status: 'failure',
						message: 'Failed to undo file.',
						body: {}
					} );
				});
		}
		
		return null;
	} );
});

router.post('/replace', function(req, res, next) {
	res.send('test draw replace');
});

router.post('/sendtofront', function(req, res, next) {
	res.send('test draw front');
});

router.post('/sendtoback', function(req, res, next) {
	res.send('test draw back');
});

/**
 * Clears out testing tables
 */
router.post('/clear_test', function(req, res, next) {
	sequelize.query('TRUNCATE TABLE "user_features_tests" RESTART IDENTITY').then( () => {
		sequelize.query('TRUNCATE TABLE "publisheds_tests" RESTART IDENTITY').then( () => {
			sequelize.query('TRUNCATE TABLE "file_histories_tests" RESTART IDENTITY').then( () => {
				sequelize.query('TRUNCATE TABLE "user_files_tests" RESTART IDENTITY').then( () => {
					//Add back sel files
					makeMasterFilesTEST( () => {
						res.send( {
							status: 'success',
							message: 'Successfully cleared tables.',
							body: {}
						} );

						return null;
					} );

					return null;
				} )
				.catch( err => {
					res.send( {
						status: 'failure',
						message: 'Failed to clear 1 table.',
						body: {}
					} );
					
					return null;
				});
				return null;
			} )
			.catch( err => {
				res.send( {
					status: 'failure',
					message: 'Failed to clear 1 table.',
					body: {}
				} );
				return null;
			});
			
			return null;
		} )
		.catch( err => {
			res.send( {
				status: 'failure',
				message: 'Failed to clear 1 table.',
				body: {}
			} );
			return null;
		});
		
		return null;
	} )
	.catch( err => {
		res.send( {
			status: 'failure',
			message: 'Failed to clear both tables',
			body: {}
		} );

		return null;
	} );
} );

const makeMasterFilesTEST = (callback) => {
    let intents = ['roi', 'campaign', 'campsite', 'trail', 'signpost'];
    makeMasterFileTEST( 0, UserfilesTEST );

    function makeMasterFileTEST( i, Table ) {
        let intent = intents[i];
        if( intent == null ) {
			callback();
			return null;
		}

        Table.findOrCreate({
            where: {
                file_owner: 'group',
                file_owner_group: ['m2020-camp-sel'],
                file_name: intent.toUpperCase(),
                file_description: 'SEL composed ' + intent.toUpperCase() + 's.',
                is_master: true,
                intent: intent,
                public: '1',
                hidden: '0'
            }
        })
        .spread(function(userResult, created){
            makeMasterFileTEST( i + 1, Table );
            return null;
		});
		
		return null;
    }
}  

module.exports = { router, add };
