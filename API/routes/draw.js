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

/**
 * Crops out duplicate array elements between arrays
 * Ex.
 *  arr1=['a','b'], arr2=['b'] -> ['a']
 *
 * @param {[]} arr1
 * @param {[]} arr2
 * @return {[]} arr1 without any elements of arr2
 */
const uniqueAcrossArrays = (arr1, arr2) => {
    let uniqueArr = Object.assign([], arr1)
    for (let i = uniqueArr.length - 1; i >= 0; i--) {
        if (arr2.indexOf(arr1[i]) != -1) uniqueArr.splice(i, 1)
    }

    return uniqueArr
}

const pushToHistory = ( Table, file_id, feature_id, feature_idRemove, time, undoToTime, action_index, successCallback, failureCallback) => {
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
		case 5: //Clip add over
		case 6: //Merge add array of add ids and remove array of remove ids
		case 7: //Clip add under
			//add
			history = history.concat( feature_idAdd );
			//remove
			history = uniqueAcrossArrays(history, feature_idRemove);
			successCallback( history );
			return;
		default:
			failureCallback();
	}
}

/**
 * 
 * @param {number} file_id 
 * @param {number} added_id
 */
const clipOver = function(req, res, file_id, added_id, time, successCallback, failureCallback ) {	
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	//CLIP OVER
	Histories.findAll({
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
		let history = historyObj.history;
		history = history.join(',');
		history = history || 'NULL';
		//RETURN ALL THE CHANGED SHAPE IDs AND GEOMETRIES
		let q = [
			"SELECT clipped.id, ST_AsGeoJSON( (ST_Dump(clipped.newgeom)).geom ) AS newgeom FROM",
			"(",
				"SELECT data.id, data.newgeom",
				"FROM (",
					"SELECT r.id, ST_DIFFERENCE(ST_MakeValid(r.geom),",
						"ST_MakeValid((",
						"SELECT a.geom",
						"FROM user_features" + ((req.body.test === "true" ) ? "_tests" : "") + " AS a",
						"WHERE a.id = :added_id AND ST_INTERSECTS(a.geom, r.geom)",
						"))",
					") AS newgeom",
					"FROM user_features" + ((req.body.test === "true" ) ? "_tests" : "") + " AS r",
					"WHERE r.file_id = :file_id AND r.id != :added_id AND r.id IN (" + history + ")",
				") data",
				"WHERE data.newgeom IS NOT NULL",
			") AS clipped"
		].join(' ')
		sequelize.query( q,
			{ replacements: {
				file_id: file_id,
				added_id: added_id
			} }
			).spread((results) => {
				let oldIds = [];
				let newIds = [added_id];

				editLoop(0);
				function editLoop( i ) {
					if( i >= results.length ) {
						pushToHistory( Histories, req.body.file_id, newIds, oldIds, time, null, 5,
							() => {
								if( typeof successCallback === 'function' )
									successCallback();
							},
							() => {
								if( typeof failureCallback === 'function' )
									failureCallback();
							}, 'addandremove' )
						return;
					}
					let newReq = Object.assign( {}, req )
					results[i].newgeom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
					newReq.body = {
						file_id: file_id,
						feature_id: results[i].id,
						geometry: results[i].newgeom,
						to_history: false,
						test: req.body.test
					}
					
					if( oldIds.indexOf(results[i].id) == -1 )
						oldIds.push( results[i].id );
					edit( newReq, res, (newId) => {
						newIds.push(newId);
						editLoop(i + 1)
					}, () => {
						editLoop(i + 1)
					} )
				}

			return null;
		} )
		.catch( err => {
			failureCallback();
		} );

		return null;
	} )
	.catch( err => {
		failureCallback();
	} );
}

const clipUnder = function(req, res, newFeature, time, successCallback, failureCallback ) {
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	Histories.findAll({
		where: {
			file_id: newFeature.file_id
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
		let history = historyObj.history;
		history = history.join(',');
		history = history || 'NULL';

		let q = [
			"WITH RECURSIVE clipper (n, clippedgeom) AS (",
				"SELECT 0 n, ST_MakeValid(ST_GeomFromGeoJSON(:geom)) clippedgeom",
				"UNION ALL",
					"SELECT n+1, ST_DIFFERENCE(",
						"clippedgeom,",
						"(",
							"SELECT ST_BUFFER(",
								"ST_UNION(",
									"ARRAY((",
										"SELECT ST_BUFFER(a.geom, 0.00001, 'join=mitre')",
										"FROM user_features" + ((req.body.test === "true" ) ? "_tests" : "") + " AS a",
										"WHERE a.id IN (" + history + ") AND ST_INTERSECTS(a.geom, clippedgeom)",
									"))",
								"),",
							"-0.00001,'join=mitre')",
						")",
					")",
				"FROM clipper",
				"WHERE n < 1",
			")",
			"SELECT ST_AsGeoJSON( (ST_Dump(clipped.clippedgeom)).geom ) as geom FROM",
			"(",
				"SELECT c.n, c.clippedgeom as clippedgeom FROM clipper c",
				"WHERE c.clippedgeom IS NOT NULL",
				"ORDER by c.n DESC LIMIT 1",
			") AS clipped"
		].join(' ')

		sequelize.query( q,
			{ replacements: {
				geom: JSON.stringify(newFeature.geom),
			} }
			).spread((results) => {
				let oldIds = [];
				let newIds = [];

				addLoop(0);
				function addLoop( i ) {
					if( i >= results.length ) {
						pushToHistory( Histories, req.body.file_id, newIds, oldIds, time, null, 7,
							() => {
								if( typeof successCallback === 'function' )
									successCallback();
							},
							() => {
								if( typeof failureCallback === 'function' )
									failureCallback();
							}  )
						return null;
					}
					let clippedFeature = Object.assign({}, newFeature );
					clippedFeature.geom = JSON.parse(results[i].geom);
					clippedFeature.geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
					
					Features.create( clippedFeature )
						.then( (created) => {
							newIds.push(created.id)
							addLoop( i + 1 )
							return null;
						} )
						.catch( err => {
							addLoop( i + 1 )
							return null;
							//failureCallback();
						} );
				}


			return null;
		} )
		.catch( err => {
			console.log( 'A', err )
			failureCallback();
		} );
		
		return null;
	} )
	.catch( err => {
		console.log( 'B', err )
		failureCallback();
	} );
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

			Features.findAll( {
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
				
				let newFeature = {
					file_id: req.body.file_id,
					level: level,
					intent: req.body.intent,
					elevated: '0',
					properties: properties,
					geom: geom,
				};

				if( req.body.clip === 'under' ) {
					clipUnder( req, res, newFeature, time, (createdId, createdIntent) => {
						if( typeof successCallback === 'function' )
							successCallback(createdId, createdIntent);
					},
					() => {
						if( typeof failureCallback2 === 'function' )
							failureCallback2();
					} )
				}
				else {
					// Insert new feature into the feature table
					Features.create( newFeature )
						.then( (created) => {
							if( req.body.to_history ) {
								let id = created.id;
								if( req.body.bulk_ids != null ) {
									id = req.body.bulk_ids;
									id.push( created.id );
								}
								if( req.body.clip === 'over' ) {
									clipOver( req, res, newFeature.file_id, id, time, () => {
										if( typeof successCallback === 'function' )
											successCallback(created.id, created.intent);
									},
									() => {
										if( typeof failureCallback2 === 'function' )
											failureCallback2();
									} )
								}
								else {
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
								}
							else {
								if( typeof successCallback === 'function' )
									successCallback(created.id, created.intent);
							}
							return null;
						} )
						.catch( err => {
							console.log( err );
							if( typeof failureCallback2 === 'function' )
								failureCallback2();
							
						} );
					}
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
const edit = function( req, res, successCallback, failureCallback ) {

	let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	let time = Math.floor(Date.now());

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);

	if( req.body.to_history == null )
		req.body.to_history = true;

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
			failureCallback()
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
				if( !feature && !req.body.addIfNotFound ) {
					console.log( 'No feature' )
					failureCallback()
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

					Features.create( newAttributes )
						.then( (created) => {
							if( req.body.to_history ) {
								pushToHistory( Histories, req.body.file_id, created.id, req.body.feature_id, time, null, 1,
									() => {
										successCallback()
									},
									() => {
										failureCallback()
									} )
							}
							else {
								successCallback(created.id)
							}
							return null;
						} )
						.catch( err => {
							failureCallback()
						} );
				}
				return null;
			} )
			.catch( err => {
				failureCallback()
			} );
		}
		
		return null;
	} )
	.catch( err => {
		failureCallback()
	} );
}

router.post('/edit', function(req, res) {
	edit( req, res,
		( createdId, createdIntent) => {
			res.send( {
				status: 'success',
				message: 'Successfully edited feature.',
				body: { id: createdId, intent: createdIntent }
			} );
		},
		() => {
			res.send( {
				status: 'failure',
				message: 'Failed to edit feature.',
				body: {}
			} )
		}
	)
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

/**
 * Merge features
 * {
 * 	file_id: <number> (required)
 * 	prop_id: <number> - feature id whose properties will be copied (required)
 *  ids: <int array> - of all the ids to merge together
 * }
 */
router.post('/merge', function(req, res, next) {
	let Files = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Features = req.body.test === 'true' ? UserfeaturesTEST : Userfeatures;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	let time = Math.floor(Date.now());

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);

	//Add prop_ids to ids if it's not already there
	if( req.body.ids.indexOf( req.body.prop_id ) == -1 )
		req.body.ids.push( req.body.prop_id )

	///Check that the provided file_id is an id that belongs to the current user
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
			} )
		}
		else {
			Features.findOne({
				where: {
					id: req.body.prop_id,			
				}
			} )
			.then( feature => {
				let ids = req.body.ids;
				ids = ids.join(',');
				ids = ids || 'NULL';

				let q = [
					"SELECT ST_AsGeoJSON( (ST_Dump(mergedgeom.geom)).geom ) as merged FROM",
					"(",
						"SELECT ST_BUFFER(ST_UNION(",
							"ARRAY((",
								"SELECT ST_BUFFER(geom, 0.00001, 'join=mitre')",
								"FROM user_features" + ((req.body.test === "true" ) ? "_tests" : "") + " AS a",
								"WHERE a.id IN (" + ids + ")",
							"))",
						"), -0.00001,'join=mitre') AS geom",
					") AS mergedgeom"
				].join(' ')
				sequelize.query( q,
					{ replacements: {
						file_id: req.body.file_id,
						prop_id: req.body.prop_id,
					} },
					).spread((results) => {

						let oldIds = req.body.ids.map( function(id) { 
							return parseInt(id, 10) 
						} );

						let newIds = [];

						addLoop(0);
						function addLoop( i ) {
							if( i >= results.length ) {
								pushToHistory( Histories, req.body.file_id, newIds, oldIds, time, null, 6,
									() => {
										res.send( {
											status: 'success',
											message: 'Successfully merged ' + req.body.ids.length + ' features.',
											body: { ids: newIds }
										} );
									},
									() => {
										res.send( {
											status: 'failure',
											message: '',
											body: {}
										} )
									} )
								return null;
							}
							let mergedFeature = JSON.parse(JSON.stringify(feature))
							mergedFeature.geom = JSON.parse(results[i].merged);
							mergedFeature.geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
							delete mergedFeature.id;
							
							Features.create( mergedFeature )
								.then( (created) => {
									newIds.push(created.id)
									addLoop( i + 1 )
									return null;
								} )
								.catch( err => {
									addLoop( i + 1 )
									return null;
									//failureCallback();
								} );
						}
						/*
						let mergedFeature = JSON.parse(JSON.stringify(feature))
						mergedFeature.geom = results[0].merged
						mergedFeature.geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
						delete mergedFeature.id;

						let removeIds = req.body.ids.map( function(id) { 
							return parseInt(id, 10) 
						} );

						Features.create( mergedFeature )
							.then( (created) => {
								pushToHistory( Histories, req.body.file_id, created.id, removeIds, time, null, 6,
									() => {
										res.send( {
											status: 'success',
											message: 'Successfully merged ' + req.body.ids.length + ' features.',
											body: { id: created.id, mergedFeature: mergedFeature  }
										} );
									},
									() => {
										res.send( {
											status: 'failure',
											message: '',
											body: {}
										} )
									} )
								return null;
							} )
							.catch( err => {
								res.send( {
									status: 'failure',
									message: 'Failed to merge feature.',
									body: {}
								} )
							} );
							*/

					} )

				
			} )

		}
	} );
} );

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
					makeMasterFilesTEST( req.leadGroupName, () => {
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

const makeMasterFilesTEST = (leadGroupName, callback) => {
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
                file_owner_group: [leadGroupName],
                file_name: intent.toUpperCase(),
                file_description: 'Lead composed ' + intent.toUpperCase() + 's.',
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
