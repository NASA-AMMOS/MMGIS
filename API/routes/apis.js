/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/

const express  = require('express');
const logger   = require('../logger');
const database = require('../database');
const User     = require('../models/user');

const router   = express.Router();
const db       = database.db;


/**
 * A function to create elevation query based on the selected elevation by the users.
 * @param {*} elevation 
 */
function ST_Z( elevation ){
    return " ST_Z(tar_2.geom) >= " + elevation[0] + " AND ST_Z(tar_2.geom) <= " + elevation[1] + " ";
}

/**
 * A function to create geometry query for ST_Contains GIS function.
 * It is based on the drawn rectangle or polygon that is create by users and
 * the coordinates are sent from front-end.
 * @param {*} coordinates 
 */
function ST_Contains(coordinates){
    let geomAsText = '';
    // parse the coordinates
    let coords = '';
    let i;
    for(i = 0; i < coordinates.length-1; i++){
        coords += coordinates[i].lng + ' ' + coordinates[i].lat + ',';
    }
    coords += coordinates[i].lng + ' ' + coordinates[i].lat;
    // Close the ring
    coords += ',' + coordinates[0].lng + ' ' + coordinates[0].lat;
    geomAsText = " ST_Contains( ST_Transform( ST_GeomFromText('POLYGON((" + coords + "))', 4326), 4326) , tar_2.geom) = true";
    
    return geomAsText;
}


/**
 * Creating a line buffer or circle buffer query using ST_buffer GIS
 * function based on the following parameters that are sent from interface 
 * on the fron-end.
 * @param {*} coordinates 
 * @param {*} bufferType 
 * @param {*} distance 
 */
function ST_Buffer(coordinates, bufferType, distance){
    let geomAsText = '';
    // parse the coordinates
    let coords = '';
    let i;
    // If line buffer is selected. Here, distance is the distance from a draw line.
    if( bufferType === 'line_buffer'){
        for(i = 0; i < coordinates.length-1; i++){
            coords += coordinates[i].lng + ' ' + coordinates[i].lat + ',';
        }
        coords += coordinates[i].lng + ' ' + coordinates[i].lat;
        geomAsText = " ST_DWithin(tar_2.geom, ST_GeomFromText('LINESTRING(" + coords + ")', 4326), " + distance + ", true)";
    }
    // If circle buffer is selected, distance here is the redius of the circle.
    if ( bufferType === 'circle_buffer') {
        coords += coordinates.lng + ' ' + coordinates.lat;
        geomAsText = " ST_Distance_Spheroid(tar_2.geom, ST_Transform(ST_GeomFromText('POINT (" + coords + ")', 4326), 4326), 'SPHEROID[\"WGS 84\",3396190,169.779287]')  <=  " + distance;
    }

    return geomAsText;
}

/**
 * A function to create the ST_Intersect GIS function and it corresponding query for
 * executing geometry operation.
 * @param {*} coordinates 
 * @param {*} selectedLayerData 
 */
function ST_Intersect(coordinates, selectedLayerData){

    return new Promise( resolve => {
        let layerName = selectedLayerData[0];
        let layerType = selectedLayerData[1];
        let geomAsText =  '';
        let coords = '';
        let i;
        for(i = 0; i < coordinates.length-1; i++){
            coords += coordinates[i].lng + ' ' + coordinates[i].lat + ',';
        }
        coords += coordinates[i].lng + ' ' + coordinates[i].lat;
        // Close the ring
        coords += ',' + coordinates[0].lng + ' ' + coordinates[0].lat;
        let q = " SELECT ST_AsGeoJSON( l.geom ) FROM " + layerName + " AS l WHERE ST_Intersects( ST_GeomFromText('POLYGON((" + coords + "))', 4326) , l.geom ) = true";

        // Execute the query
        db.any( q )
        .then( function(geoms) {
            // Create a polygon that covers all the points extracted from ST_Intersects GIS function
            if( layerType === 'Points' ){

                geomAsText += " ST_Intersects( ST_GeographyFromText('SRID=4326;POINT(";
                // ST_GeographyFromText('SRID=4326;POINT(-43.23456 72.4567772)')
                for(let i = 0; i < geoms.length -1; i++){
                    let GeojsonObj = JSON.parse( geoms[i].st_asgeojson );
                    let lng = GeojsonObj.coordinates[0];
                    let lat = GeojsonObj.coordinates[1];

                    geomAsText += lng + ' ' + lat + ")'), tar_2.geom) AND ST_Intersects( ST_GeographyFromText('SRID=4326;POINT(";
                }

                // Set up last round
                let lastGeojsonObj = JSON.parse( geoms[geoms.length -1].st_asgeojson );
                let lastLng = lastGeojsonObj.coordinates[0];
                let lastLat = lastGeojsonObj.coordinates[1];
                geomAsText += lastLng + ' ' + lastLat + ")'), tar_2.geom) ";

                resolve( geomAsText );
            }

            // Create LineString from line coordinates that are received from database for this part
            if( layerType === 'LineString' ){
                geomAsText += ' ST_Intersects(';

                let MultiLineStr = " ST_GeographyFromText('SRID=4326;MULTILINESTRING("
                for( let i = 0; i < geoms.length -1; i++ ){
                    let GeojsonObj = JSON.parse( geoms[i].st_asgeojson );
                    MultiLineStr += "(";
                    let coordins = GeojsonObj.coordinates[0];
                    for(let j = 0; j < coordins.length -1; j++){
                        let lng = coordins[j][0];
                        let lat = coordins[j][1];
                        MultiLineStr += lng + ' ' + lat + ',';
                        // console.log("Line Geometry:", '(' + lng + ' ' + lat + '),');
                    }
                    MultiLineStr += coordins[coordins.length -1][0] + ' ' + coordins[coordins.length -1][1] + "),";
                }
                // Add the last geoms set
                MultiLineStr += "(";
                let lastCoordins = JSON.parse( geoms[geoms.length -1].st_asgeojson ).coordinates[0];
                for( let k = 0; k < lastCoordins.length -1; k++ ){
                    let lng = lastCoordins[k][0];
                    let lat = lastCoordins[k][1];
                    MultiLineStr += lng + ' ' + lat + ',';
                }
                
                MultiLineStr += lastCoordins[lastCoordins.length -1][0] + ' ' + lastCoordins[lastCoordins.length -1][1] + "))')";
                
                geomAsText += MultiLineStr + ', tar_2.geom) = true ';
                resolve( geomAsText );
            }

            // Create a multi polygon from polygon coordinates that are received from database for this part
            if( layerType === 'Polygon' ){
                geomAsText += ' ST_Intersects(';

                let geoJSON_obj = JSON.parse( geoms[0].st_asgeojson );
                let polygonCoords = geoJSON_obj.coordinates[0];
                let counter = 0;

                let PolygonStr = " ST_GeomFromText('POLYGON((";

                for (let t in polygonCoords){
                    if( counter < polygonCoords.length -1 ){
                        PolygonStr += polygonCoords[t][0] + ' ' + polygonCoords[t][1] + ',';
                    }
                    if( counter >= polygonCoords.length-1 ){
                        PolygonStr += polygonCoords[t][0] + ' ' + polygonCoords[t][1] + "))',4326)";
                    }
                    counter++;
                }
                geomAsText += PolygonStr + ', tar_2.geom) = true ';
                resolve( geomAsText );
            }
            
        }).catch(function (err) {
            logger.error("Error in api.js: " + err);
            return next(err);
        });

    }, 2000);
}

/**
 * This function acts as a middleware and first checks for 
 * a user authentication. If this user is a valid user then it passes through
 * , otherwise, it sends back a corresponding message to the front-end.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
function checkAuthentication(req, res, next){
   
    //Get token and id from the link
    let tkn = req.params.token;
    let uid = req.params.user_id;

    // Retrive the token for user with "userID" from database
    User.findOne(
        {
            where: {
                id: uid
            },
            attributes: ['token']
        }
    ).then( user => {
      if (!user){
        logger.info("Not a valid user and valid token!");
        res.send({"usre" : "Not valid", "token": "Not valid", "message": "Please register for the API first!"});
        res.end();
      } else {
          // If the token is correct
          if( user.token === tkn ){
            next();
            logger.info("Valid user and token!");
        } else {
            logger.info("Valid user but not a valid token!");
            res.send({"usre" : uid, "token": "Not valid", "message": "Please create a token by using your account!"});
            res.end();
        }
      }   
    });
}


// A function to calculate the median.
// But not being used by this version.
function getMedian( array ){
	let data = array.sort((a,b) => a - b );
	let l = data.length;
	let median = data[0];

	if(l % 2 === 0){
		median = Math.ceil((data[(data.length/2)-1] + data[(data.length/2)])/2);
	}
	if(l % 2 === 1){
		median = data[Math.ceil(l/2)];
	}
	return median;
}


// Export the router module to use in app.js file
module.exports = router;