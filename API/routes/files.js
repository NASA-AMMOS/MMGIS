const express  = require('express');
const logger   = require('../logger');
const database = require('../database');
const Sequelize = require('sequelize');
const { sequelize } 	= require('../connection');
const fhistories       	= require('../models/filehistories')
const Filehistories 	= fhistories.Filehistories
const FilehistoriesTEST	= fhistories.FilehistoriesTEST
const ufiles          	= require('../models/userfiles');
const Userfiles 	   	= ufiles.Userfiles;
const UserfilesTEST	   	= ufiles.UserfilesTEST;
const ufeatures        	= require('../models/userfeatures');
const Userfeatures     	= ufeatures.Userfeatures;
const UserfeaturesTEST 	= ufeatures.UserfeaturesTEST;
const published 		= require('../models/published')
const Published     	= published.Published;
const PublishedTEST 	= published.PublishedTEST;

const draw = require('./draw');


const router   = express.Router();
const db       = database.db;

const historyKey = {
	0: 'Add',
	1: 'Edit',
	2: 'Delete',
	3: 'Undo',
	4: 'Publish',
	5: 'Add (over)',
	6: 'Merge',
	7: 'Add (under)'
}

router.post('/', function(req, res, next) {
	res.send('test files');
});

/**
 * Gets all owned or public files
 */
router.post('/getfiles', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;

	Table.findAll({
		where: {
			//file_owner is req.user or public is '0'
			hidden: '0',
			[Sequelize.Op.or]: {
				file_owner: req.user,
				public: '1'
			}
		}
	} )
	.then( files => {
		if( !files ) {
			res.send( {
				status: 'failure',
				message: 'Failed to get files.',
				body: {}
			} );
		}
		else {
			files.sort( (a, b) => ( a.id > b.id ) ? 1 : -1 );
			res.send( {
				status: 'success',
				message: 'Successfully got files.',
				body: files
			} );
		}
	} )
	.catch( err => {
		res.send( {
			status: 'failure',
			message: 'Failed to get files.',
			body: {}
		} );
	});
});

/**
 * Returns a geojson of a file
 * {
 * 	id: <number> (required)
 * 	time: <int> (optional)
 * 	published: <bool> (optional) get last published version (makes 'time' ignored)
 * }
 */
router.post('/getfile', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	if( req.session.user == 'guest' && req.body.quick_published !== 'true' ) {
		res.send( {
			status: 'failure',
			message: 'Permission denied.',
			body: {}
		} );
	}

	let published = false;
	if( req.body.published === 'true' )
		published = true;
	if( req.body.quick_published === 'true' ) {
		sequelize.query(
			'SELECT ' +
			'id, intent, parent, children, level, properties, ST_AsGeoJSON(geom)' + ' ' +
			'FROM ' + (req.body.test === 'true' ? 'publisheds_test' : 'publisheds') + '' + ((req.body.intent && req.body.intent.length > 0) ?
			' WHERE intent=:intent'
			: ''),
			{ replacements: {
				intent: req.body.intent || '',
			} }
			).spread((results) => {
				let geojson = { 'type': 'FeatureCollection', 'features': [] };
				for( let i = 0; i < results.length; i++ ) {
					let properties = results[i].properties;
					let feature = {};
					properties._ = {
						id: results[i].id,
						intent: results[i].intent,
						parent: results[i].parent,
						children: results[i].children,
						level: results[i].level,
					};
					feature.type = 'Feature';
					feature.properties = properties;
					feature.geometry = JSON.parse( results[i].st_asgeojson );
					geojson.features.push( feature );
				}
				//Sort features by level
				geojson.features.sort((a,b) =>
					( a.properties._.level > b.properties._.level ) ? 1
					: ( ( b.properties._.level > a.properties._.level ) ? -1
					: 0 )
				); 

				res.send( {
					status: 'success',
					message: 'Successfully got file.',
					body: geojson
				} );
		} )
	}
	else {
		let idArray = false;
		req.body.id = JSON.parse(req.body.id);
		if( typeof req.body.id !== 'number' )
			idArray = true;

		let atThisTime = (published) ? Math.floor(Date.now()) : req.body.time || Math.floor(Date.now());

		Table.findAll({
			where: {
				id: req.body.id,
				//file_owner is req.user or public is '1'
				[Sequelize.Op.or]: {
					file_owner: req.user,
					public: '1'
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
				sequelize.query(
					'SELECT history' + ' ' +
					'FROM file_histories' + ((req.body.test === 'true' ) ? '_tests' : '') + ' ' +
					'WHERE' + ' ' +
					((idArray) ? 'file_id IN (:id)' : 'file_id=:id' )  + ' ' +
					'AND time<=:time' + ' ' +
					((published) ? 'AND action_index=4 ' : '') +
					'ORDER BY time DESC' + ' ' +
					'FETCH first '+ ((published) ? req.body.id.length : '1') + ' rows only',
					{ replacements: {
						id: req.body.id,
						time: atThisTime
					} }
				).spread((results) => {
					let bestHistory = [];
					for( let i = 0; i < results.length; i++ ) {
						bestHistory = bestHistory.concat(results[i].history)
					}
					bestHistory = bestHistory.join(',');
					bestHistory = bestHistory || 'NULL';

					//Find best history
					sequelize.query(
						'SELECT ' +
						'id, file_id, level, intent, properties, ST_AsGeoJSON(geom)' + ' ' +
						'FROM user_features' + ((req.body.test === 'true' ) ? '_tests' : '') + ' ' +
						'WHERE' + ' ' +
						((idArray) ? 'file_id IN (:id)' : 'file_id=:id' )  + ' ' +
						'AND id IN (' + bestHistory + ')',
						{ replacements: {
							id: req.body.id,
						} }
						).spread((results) => {
							let geojson = { 'type': 'FeatureCollection', 'features': [] };
							for( let i = 0; i < results.length; i++ ) {
								let properties = JSON.parse( results[i].properties );
								let feature = {};
								properties._ = {
									id: results[i].id,
									file_id: results[i].file_id,
									level: results[i].level,
									intent: results[i].intent,
								};
								feature.type = 'Feature';
								feature.properties = properties;
								feature.geometry = JSON.parse( results[i].st_asgeojson );
								geojson.features.push( feature );
							}
							//Sort features by level
							geojson.features.sort((a,b) =>
								( a.properties._.level > b.properties._.level ) ? 1
								: ( ( b.properties._.level > a.properties._.level ) ? -1
								: 0 )
							); 

							res.send( {
								status: 'success',
								message: 'Successfully got file.',
								body: {
									file: file,
									geojson: geojson
								}
							} );
						}
					);
				} );
			}
			
			return null;
		} )
		.catch( err => {
			console.log( err );
			res.send( {
				status: 'failure',
				message: 'Failed to get file.',
				body: {}
			} );
		});
	}
});


/**
 * Makes a new file
 * {
 * 	file_owner: <string> (required)
 * 	file_name: <string> (required)
 * 	file_description: <string> (optional)
 *  intent: <string> (optional) 
 *  geojson: <object> (optional) -- geojson to initialize file from
 * }
 */
router.post('/make', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;

	//group is a reserved keyword
	if( req.user === 'group' ) {
		res.send( {
			status: 'failure',
			message: 'Failed to make a new file. Owner can\'t be "group".',
			body: {}
		} );
		return;
	}

	let newUserfile = {
		file_owner: req.user,
		file_name: req.body.file_name,
		file_description: req.body.file_description,
		intent: req.body.intent,
		public: '1',
		hidden: '0'
	};

	// Insert new userfile into the user_files table
	Table.create(newUserfile)
		.then( (created) => {
			
			let geojson = req.body.geojson ? JSON.parse( req.body.geojson ) : null
			if( geojson &&
				geojson.features &&
				geojson.features.length > 0 ) {
				let features = geojson.features;
				
				let ids = [];
				setTimeout( () => {
					addFeature(0)
					function addFeature(i) {
						//console.log( 'ADDING', i, '/', features.length)
						if (i >= features.length) {
							res.send( {
								status: 'success',
								message: 'Successfully made a new file from geojson.',
								body: {}
							} );
						}
						else {
							//Find intent
							let intent = null;
							if( features[i].properties && features[i].properties._ && features[i].properties._.intent )
								intent = features[i].properties._.intent;
							else {
								switch( features[i].geometry.type.toLowerCase() ) {
									case 'point':
									case 'multipoint':
										intent = 'point'; break;
									case 'linestring':
									case 'multilinestring':
										intent = 'line'; break;
									case 'polygon':
									case 'multipolygon':	
										intent = 'polygon'; break;
								}
							}


							let body = {
								to_history: i == features.length - 1,
								bulk_ids: (i == features.length - 1) ? ids : null,
								file_id: created.id,
								intent: intent,
								properties: JSON.stringify(features[i].properties),
								geometry: JSON.stringify(features[i].geometry)
							}
							draw.add( { user: req.user, body: body }, res, (id) => {
								ids.push(id);
								addFeature(i+1);
							} )
						}
					}
				}, 1000 );
			}
			else {
				res.send( {
					status: 'success',
					message: 'Successfully made a new file.',
					body: {}
				} );
			}
			
			return null;
		} )
		.catch( err => {
			console.log( err );
			res.send( {
				status: 'failure',
				message: 'Failed to make a new file.',
				body: {}
			} );
		});
});

/**
 * Removes/Hides a file
 * {
 * 	id: <number> (required)
 * }
 */
router.post('/remove', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;

	Table.update(
		{
			hidden: '1'
		},
		{
		  where: {
			  id: req.body.id,
			  file_owner: req.user,
		  }
		} )
		.then( () => {
			res.send( {
				status: 'success',
				message: 'File removed.',
				body: {}
			} );
		
		return null;
	  } )
	  .catch( err => {
			res.send( {
				status: 'failure',
				message: 'Failed to find and remove file.',
				body: {}
			} );
	  });
});

/**
 * Restores/Unhides a file
 * {
 * 	id: <number> (required)
 * }
 */
router.post('/restore', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;

	Table.update(
		{
			hidden: '0'
		},
		{
		  where: {
			  id: req.body.id,
			  file_owner: req.user,
		  }
		} )
		.then( () => {
			res.send( {
				status: 'success',
				message: 'File restored.',
				body: {}
			} );
		
		return null;
	  } )
	  .catch( err => {
		res.send( {
			status: 'failure',
			message: 'Failed to find and restore file.',
			body: {}
		} );
	  });
});


/**
 * Update a file's name and/or description
 * {
 * 	id: <int>
 * 	file_name: <string> (optional)
 * 	file_description: <string> (optional)
 * 	public: <0|1> (optional)
 * }
 */
router.post('/change', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;

	//Form update object
	let toUpdateTo = {};
	if( req.body.hasOwnProperty( 'file_name' ) && req.body.file_name != null ) {
		toUpdateTo.file_name = req.body.file_name;
	}
	if( req.body.hasOwnProperty( 'file_description' ) && req.body.file_description != null ) {
		toUpdateTo.file_description = req.body.file_description;
	}
	if( req.body.hasOwnProperty( 'public' ) && ( req.body.public == 0 || req.body.public == 1 ) ) {
		toUpdateTo.public = req.body.public;
	}


	Table.update(
		toUpdateTo,
		{
		  where: {
			  id: req.body.id,
			  file_owner: req.user,
			  is_master: false, //No editing these
		  }
		} )
		.then( () => {
			res.send( {
				status: 'success',
				message: 'File edited.',
				body: {}
			} );
		
			return null;
	  } )
	  .catch( err => {
			res.send( {
				status: 'failure',
				message: 'Failed to edit file.',
				body: {}
			} );
	  });
});

/**
 * compile sel file
 * {
 * 	time: int
 * 	verbose: bool
 *  test: bool
 * }
 */
const compile = function(req, res, callback ) {
	let Table = req.query.test === 'true' ? UserfilesTEST : Userfiles;
	
	let atThisTime = req.query.time || Math.floor(Date.now());

	Table.findAll({
		where: {
			is_master: true,
			intent: { [Sequelize.Op.in]: ['roi', 'campaign', 'campsite', 'trail', 'signpost'] }
		}
	} )
	.then( files => {
		let featureIds = [];
		let finished = 0;
		for( let f = 0; f < files.length; f++ ) {
			sequelize.query(
				'SELECT history' + ' ' +
				'FROM file_histories' + ((req.query.test === 'true' ) ? '_tests' : '') + ' ' +
				'WHERE file_id=' + files[f].dataValues.id + ' ' +
				'AND time<=' + atThisTime + ' ' +
				'ORDER BY time DESC' + ' ' +
				'FETCH first 1 rows only'
			).spread((results) => {
				let bestHistory = (results.length > 0) ? results[0].history : [];
				featureIds = featureIds.concat( bestHistory );
				finished++;
				tryProcessFeatures( finished );
			})
		}
		function tryProcessFeatures( finished ) {
			if( finished == files.length ) {
				featureIds = featureIds.join(',') || 'NULL';
				//get all features
				sequelize.query(
					'SELECT ' +
					'id, file_id, level, intent, properties, ST_AsGeoJSON(geom)' + ' ' +
					'FROM user_features' + ((req.query.test === 'true' ) ? '_tests' : '') + ' ' +
					'WHERE id IN (' + featureIds + ')'
				).spread((features) => {
					processFeatures(features)
				});
			}
		}
		function processFeatures(features) {
				sequelize.query(
					'SELECT' + ' ' +
					'\'intersects\' as "association", a.id, a.intent, b.id AS "associated_id", b.intent AS "associated_intent"' + ' ' +
					'FROM user_features' + ((req.query.test === 'true' ) ? '_tests' : '') + ' a,' + ' ' +
					'user_features' + ((req.query.test === 'true' ) ? '_tests' : '') + ' b' + ' ' +
					'WHERE a.id IN (' + featureIds + ')' + ' ' +
					'AND b.id IN (' + featureIds + ')' + ' ' +
					'AND a.id != b.id' + ' ' +
					'AND ((ST_OVERLAPS(a.geom, b.geom)' + ' ' +
					'AND NOT ST_Touches(a.geom, b.geom))' + ' ' +
					'OR ST_CROSSES(a.geom, b.geom))' + ' ' +
					'UNION ALL' + ' ' +
					'SELECT' + ' ' +
					'\'contains\' as "association", a.id, a.intent, b.id AS "associated_id", b.intent AS "associated_intent"' + ' ' +
					'FROM user_features' + ((req.query.test === 'true' ) ? '_tests' : '') + ' a,' + ' ' +
					'user_features' + ((req.query.test === 'true' ) ? '_tests' : '') + ' b' + ' ' +
					'WHERE a.id IN (' + featureIds + ')' + ' ' +
					'AND b.id IN (' + featureIds + ')' + ' ' +
					'AND a.id != b.id' + ' ' +
					'AND ST_Contains(a.geom, b.geom)'
			).spread((results) => {
				let hierarchy = [];
				let intentOrder = ['roi', 'campaign', 'campsite', 'signpost'];
				let flatHierarchy = [];
				let issues = [];

				//Get all immediate children of everything
				for( let f = 0; f < features.length; f++ ) {
					let intersects = [];
					let contains = [];
					let children = [];
					for( let r = 0; r < results.length; r++ ) {
						if( results[r].id == features[f].id  ) {
							if (results[r].association === 'intersects') {
								intersects.push( { id: results[r].associated_id, intent: results[r].associated_intent} )
							}
							else if( results[r].association === 'contains' ) {
								contains.push( { id: results[r].associated_id, intent: results[r].associated_intent } )
								children.push( { id: results[r].associated_id, intent: results[r].associated_intent } )
							}
						}	
					}
					flatHierarchy.push( {
						feature: features[f],
						id: features[f].id,
						intent: features[f].intent,
						children: children,
						possibleChildren: {
							intersects: intersects,
							contains: contains,
							directIntersects: []
						}
					} )
				}
				//Now attach parents to flatHierarchy
				for( let i = 0; i < flatHierarchy.length; i++ ) {
					flatHierarchy[i].parent = {};
					flatHierarchy[i].possibleParents = [];
					for( let j = 0; j < flatHierarchy.length; j++ ) {
						if( i != j ) {
							for( let k = 0; k < flatHierarchy[j].possibleChildren.contains.length; k++ ) {
								if( flatHierarchy[i].id == flatHierarchy[j].possibleChildren.contains[k].id ) {		
									flatHierarchy[i].possibleParents.push( { id: flatHierarchy[j].id, intent: flatHierarchy[j].intent } );
								}
							}
						}
					}
				}
				removeIndirectChildren();
				function removeIndirectChildren() {
					for( let i = 0; i < flatHierarchy.length; i++ ) {
						let node = flatHierarchy[i];
						let intent = node.intent;
						if( intentOrder.indexOf( intent ) === -1 ) continue;
						let associationIntent = intentOrder[intentOrder.indexOf( intent ) + 1];
						if( associationIntent == null ) {
							node.children = [];
						}
						else {
							for( let j = node.children.length - 1; j >= 0; j-- ) {
								if( node.children[j].intent != associationIntent ) {
									node.children.splice(j, 1);
								}
							}
							node.possibleChildren.directIntersects = JSON.parse(JSON.stringify(node.possibleChildren.intersects));
							for( let i = node.possibleChildren.directIntersects.length - 1; i >= 0; i-- )
								if( node.possibleChildren.directIntersects[i].intent != associationIntent &&
									node.possibleChildren.directIntersects[i].intent != intent )
									node.possibleChildren.directIntersects.splice(i, 1);
						}
					}
				}
				addParents();
				function addParents() {
					for( let i = 0; i < flatHierarchy.length; i++ ) {
						for( let j = 0; j < flatHierarchy[i].children.length; j++ ) {
							//Each child
							//Iterate back through to child and add this flatHierarchy[i] as parent
							for( let k = 0; k < flatHierarchy.length; k++ )
								if( flatHierarchy[k].id === flatHierarchy[i].children[j].id )
									flatHierarchy[k].parent = { id: flatHierarchy[i].id, intent: flatHierarchy[i].intent };
						}
						
						//If no parents at this point try to find the best possible parent
						if( Object.keys(flatHierarchy[i].parent).length === 0 && flatHierarchy[i].possibleParents.length > 0 ) {
							let intentOrderReversed = JSON.parse(JSON.stringify(intentOrder));
							intentOrderReversed.reverse();
							let intentId = intentOrderReversed.indexOf(flatHierarchy[i].intent);
							if( intentId != -1) {
								for( let l = intentId + 1; l < intentOrderReversed.length; l++ ) {
									for( let m = 0; m < flatHierarchy[i].possibleParents.length; m++ ) {
										if( Object.keys(flatHierarchy[i].parent).length === 0 && flatHierarchy[i].possibleParents[m].intent === intentOrderReversed[l] ) {
											flatHierarchy[i].parent = flatHierarchy[i].possibleParents[m];
										}
									}
								}
							}
						}
						
							
					}
				}

				//Build the root of the trees
				for( let f = 0; f < features.length; f++ ) {
						let isCovered = false;
						for( let r = 0; r < results.length; r++ ) {
							if( results[r].association === 'contains' && results[r].associated_id == features[f].id ) {
								isCovered = true;
								break;
							}	
						}
						if( !isCovered ) {
							hierarchy.push( { intent: features[f].intent, id: features[f].id, children: {
								intersects: [],
								contains: []
							} } )
							continue;
						}
				}

				//From those roots do a depth traversal, adding the flat children each time
				depthTraversal(hierarchy, 0)
				function depthTraversal(node, depth) {
					for (var i = 0; i < node.length; i++) {
						//Add other feature information while we're at it
						addFeatureData(node[i], depth)

						addRelationships(node[i])
						if ( node[i].children.length > 0 )
							depthTraversal(node[i].children, depth + 1)
					}
				}
				function addRelationships( node ) {
					for( let i = 0; i < flatHierarchy.length; i++ )
						if( node.id == flatHierarchy[i].id ) {
							node.parent = JSON.parse(JSON.stringify(flatHierarchy[i].parent));
							node.children = JSON.parse(JSON.stringify(flatHierarchy[i].children));
							return;
						}
				}
				function addFeatureData( node, depth ) {
					for( let i = 0; i < features.length; i++ ) {
						let f = features[i];
						if( node.id == f.id ) {
							let properties = JSON.parse( f.properties );
							let feature = {};
							properties._ = {
								id: f.id,
								file_id: f.file_id,
								level: f.level,
								intent: f.intent,
							};
							feature.type = 'Feature';
							feature.properties = properties;
							feature.geometry = JSON.parse( f.st_asgeojson );
							//id, file_id, level, intent, properties, ST_AsGeoJSON(geom)' + ' ' +
							node.file_id = f.file_id;
							node.level = f.level;
							node.depth = depth;
							node.intent = f.intent;
							node.properties = JSON.parse( f.properties );
							node.geometry = JSON.parse( f.st_asgeojson );
							node.feature = feature;
							return;
						}
					}
				}


				findIssues();
				function findIssues() {
					for( let i = 0; i < flatHierarchy.length; i++ ) {
						let node = flatHierarchy[i];
						let intent = node.intent;
						if( intentOrder.indexOf( intent ) === -1 ) continue;
						let parentIntent = intentOrder[intentOrder.indexOf( intent ) - 1];
						if( parentIntent != null && intent != 'signpost' ) {
							//Check that it has a valid parent
							if( node.parent.intent != parentIntent) {
								issues.push({
									severity: 'error',
									antecedent: {
										id: node.id,
										intent: node.intent
									},
									message: '{antecedent} does not have a parent of type: ' + parentIntent + '.',
								})
							}
							else if( Object.keys(node.parent).length === 0 ) {
								issues.push({
									severity: 'error',
									antecedent: {
										id: node.id,
										intent: node.intent
									},
									message: '{antecedent} does not have a parent.' }
								)
							}
						}
	
						let ints = node.possibleChildren.directIntersects;
						for( let j = 0; j < ints.length; j++ ) {
							if( node.intent == 'trail' ) {}
							else if( node.intent != ints[j].intent )
								issues.push({
									severity: 'error',
									antecedent: {
										id: node.id,
										intent: node.intent
									},
									message: '{antecedent} does not fully contain possible child {consequent}',
									consequent: {
										id: ints[j].id,
										intent: ints[j].intent
									}
								})
							else
								issues.push({
									severity: 'error',
									antecedent: {
										id: node.id,
										intent: node.intent
									},
									message: '{antecedent} intersects {consequent} of same intent.',
									consequent: {
										id: ints[j].id,
										intent: ints[j].intent
									}
								})
						}
					}
				}


				//
				let body = { hierarchy: hierarchy, issues: issues };
				if( req.query.verbose ) {
					body = { hierarchy: hierarchy, flatHierarchy: flatHierarchy, issues: issues };
				}
				callback( body );
			})
		}
	} );
}
router.get('/compile', function(req, res, next) {
	compile( req, res, (body) => {
		res.send( {
			status: body != null ? 'success' : 'failed',
			message: 'File compiled.',
			body: body
		} );
	} )
});

/**
 * publish sel file
 * {
 * }
 */
router.post('/publish', function(req, res, next) {
	let Table = req.body.test === 'true' ? UserfilesTEST : Userfiles;
	let Histories = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;
	
	let time = Math.floor(Date.now());

	//Check that user belongs to sel group
	if( req.groups[req.leadGroupName] != true ) {
		res.send( {
			status: 'failure',
			message: 'Unauthorized to publish.',
			body: {}
		} );
		return null;
	}

	let groups = [];
	if( req.groups )
		groups = Object.keys(req.groups);

	Table.findAll({
		where: {
			is_master: true,
			[Sequelize.Op.or]: {
				file_owner: req.user,
				[Sequelize.Op.and]: {
					file_owner: 'group',
					file_owner_group: { [Sequelize.Op.overlap]: groups }
				}
			}
		}
	} )
	.then( files => {
		publishToPublished();
		for( let f = 0; f < files.length; f++ ) {
			publishToHistory(Histories, files[f].dataValues.id, time, () => {
				if( f === files.length - 1)
					res.send( {
						status: 'success',
						message: 'Published.',
						body: {}
					} );
			}, () => {
				res.send( {
					status: 'failure',
					message: 'Failed to publish.',
					body: {}
				} );
			} )
		} 
	} );

	function publishToHistory( Table, file_id, time, successCallback, failureCallback ) {
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
			let newHistoryEntry = {
				file_id: file_id,
				history_id: historyObj.historyIndex,
				time: time,
				action_index: 4,
				history: historyObj.history
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
			return null;
		} )
	}

	function publishToPublished() {
		
		let Publisheds = req.body.test === 'true' ? PublishedTEST : Published;
		req.query.verbose = true;
		compile( req, res, (body) => {
			Publisheds.destroy({
				where: {}
			}).then( del => {
				let fH = body.flatHierarchy;
				
				for( let i = 0; i < fH.length; i++ ) {
					let feature = {
						id: fH[i].id,
						intent: fH[i].intent,
						parent: fH[i].parent.hasOwnProperty('id') ? fH[i].parent.id : null,
						children: fH[i].children.map( v => { return v.id } ),
						level: fH[i].feature.level,
						properties: JSON.parse(fH[i].feature.properties),
						geom: JSON.parse(fH[i].feature.st_asgeojson)
					};
					delete feature.properties._;
					feature.geom.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
					Publisheds.create( feature );
				}
			})
		} )
	}
} );

/**
 * Get a file's history
 * {
 * 	id: <int>
 * }
 */
router.post('/gethistory', function(req, res, next) {
	let Table = req.body.test === 'true' ? FilehistoriesTEST : Filehistories;

	Table.findAll({
		where: {
			file_id: req.body.id
		}
	} )
	.then( histories => {
		if( !histories ) {
			res.send( {
				status: 'failure',
				message: 'Failed to get history.',
				body: {}
			} );
		}
		else {
			//Newest first
			histories.sort( (a, b) => ( a.history_id < b.history_id ) ? 1 : -1 );
			for( let i = 0; i < histories.length; i++ )
				histories[i].dataValues.message = historyKey[histories[i].dataValues.action_index];

			res.send( {
				status: 'success',
				message: 'Successfully got history.',
				body: histories
			} );
		}
		
		return null;
	} )
	.catch( err => {
		console.log( err );
		res.send( {
			status: 'failure',
			message: 'Failed to get history.',
			body: {}
		} );
	});
});


module.exports = router;
