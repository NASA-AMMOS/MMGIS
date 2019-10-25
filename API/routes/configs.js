/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express   = require('express');
const router    = express.Router();
const execFile = require("child_process").execFile;

const logger    = require('../logger');
const Config      = require('../models/config');
const config_template = require('../templates/config_template');

const fs = require('fs');

function get(req, res, next, cb ) {
  Config.findAll( {
    where: {
      mission: req.query.mission
    }
  } )
  .then( missions => {
    let maxVersion = -Infinity;
    if( missions && missions.length > 0 ) {
      for( let i = 0; i < missions.length; i++ ) {
        maxVersion = Math.max( missions[i].version, maxVersion );
      }
      return maxVersion;
    }
    else return 0;
  } )
  .then( version => {
    if( req.query.version ) version = req.query.version;
    
    if( version < 0 ) {
      //mission doesn't exist
      if( cb )
        cb( { status: 'failure', message: 'Mission not found.' } );
      else
        res.send( { status: 'failure', message: 'Mission not found.' } );
      return null;
    }
    else {
      Config.findOne(
        {
          where: {
            mission: req.query.mission,
            version: version
          }
        }
      ).then( mission => {
        if( req.query.full ) {
          if( cb )
            cb( { status: 'success', mission: mission.mission, config: mission.config, version: mission.version } );
          else
            res.send( { status: 'success', mission: mission.mission, config: mission.config, version: mission.version } );
        }
        else
          res.send( mission.config );
        return null;
      } )
      .catch( err => {
        if( cb )
          cb( { status: 'failure', message: 'Mission not found.' } );
        else
          res.send( { status: 'failure', message: 'Mission not found.' } );
        return null;
      } )
    }
    return null;
  } )
  .catch( err => {
    if( cb )
      cb( { status: 'failure', message: 'Mission not found.' } )
    else
      res.send( { status: 'failure', message: 'Mission not found.' } );
    return null;
  } )
  return null;
}
router.get('/get', function(req, res, next) {
  get( req, res, next )
} )


function add(req, res, next, cb) {
    let configTemplate = JSON.parse(JSON.stringify(config_template));
    configTemplate = req.body.config || configTemplate;
    configTemplate.msv.mission = req.body.mission;

    if( req.body.mission !== req.body.mission.replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '') &&
      req.body.mission.length === 0 &&
      !isNaN(req.body.mission[0]) ) {
        res.send( { status: 'failure', message: 'Bad mission name.' } );
        return;
    }

    let newConfig = {
      mission: req.body.mission,
      config: configTemplate,
      version: 0,
    };

    //Make sure the mission doesn't already exist
    Config.findOne(
      {
        where: {
          mission: req.body.mission
        }
      }
    ).then( mission => {
      if( !mission ) {
        Config.create(newConfig)
          .then(created => {
            let dir = './Missions/' + created.mission
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
                let dir2 = dir + '/Layers'
                if (!fs.existsSync(dir2)){
                  fs.mkdirSync(dir2);
                }
                let dir3 = dir + '/Data'
                if (!fs.existsSync(dir3)){
                  fs.mkdirSync(dir3);
                }
            }

            if( cb )
              cb( { status: 'success', mission: created.mission, version: created.version } );
            else
              res.send( { status: 'success', mission: created.mission, version: created.version } );
            return null;
          })
          .catch( err => {
            if( cb )
              cb( { status: 'failure', message: 'Failed to create new mission.' } );
            else
              res.send( { status: 'failure', message: 'Failed to create new mission.' } );
            return null;
          } )
      }
      else {
        if( cb )
          cb( { status: 'failure', message: 'Mission already exists.' } );
        else
          res.send( { status: 'failure', message: 'Mission already exists.' } );
      }
      return null;
    })
    .catch( err => {
      if( cb )
        cb( { status: 'failure', message: 'Failed to check if mission already exists.' } );
      else
        res.send( { status: 'failure', message: 'Failed to check if mission already exists.' } );
      return null;
    } )
    return null;
}
router.post('/add', function(req, res, next) {
  add( req, res, next )
});


function upsert(req, res, next, cb) {
  let hasVersion = false;
  if( req.body.version != null ) hasVersion = true;
  let versionConfig = null;

  Config.findAll( {
    where: {
      mission: req.body.mission
    },
  } )
  .then( missions => {
    let maxVersion = -Infinity;
    if( missions && missions.length > 0 ) {
      for( let i = 0; i < missions.length; i++ ) {
        maxVersion = Math.max( missions[i].version, maxVersion );
        if( hasVersion && missions[i].version == req.body.version )
          versionConfig = missions[i].config
      }
      return maxVersion;
    }
    else return -1; //will get incremented to 0
  } )
  .then( version => {
    Config.create(
      {
        mission: req.body.mission,
        config: versionConfig || JSON.parse(req.body.config),
        version: version + 1
      }
    )
    .then( created => {
      if( cb )
        cb( { status: 'success', mission: created.mission, version: created.version } )
      else
        res.send( { status: 'success', mission: created.mission, version: created.version } );
      return null;
    } ) 
    .catch( err => {
      if( cb )
        cb( { status: 'failure', message: 'Failed to update mission.' } )
      else
        res.send( { status: 'failure', message: 'Failed to update mission.' } );
      return null;
    } )
    return null;
  } )
  .catch( err => {
    if( cb )
      cb( { status: 'failure', message: 'Failed to update mission.' } )
    else
      res.send( { status: 'failure', message: 'Failed to find mission.' } );
    return null;
  } )
  return null;
}
router.post('/upsert', function(req, res, next) {
  upsert(req, res, next)
});

router.post('/missions', function(req, res, next) {
  Config.aggregate('mission', 'DISTINCT', { plain: false })
  .then( missions => {
    let allMissions = [];
    for( let i = 0; i < missions.length; i++)
      allMissions.push(missions[i].DISTINCT)
    allMissions.sort()
    res.send( { status: 'success', missions: allMissions } );
    return null;
  } )
  .catch( err => {
    res.send( { status: 'failure', message: 'Failed to find missions.' } );
    return null;
  } )
  return null;
});

router.post('/versions', function(req, res, next) {
  Config.findAll( {
    where: {
      mission: req.body.mission
    },
    attributes: ['mission', 'version', 'createdAt']
  } )
  .then( missions => {
    res.send( { status: 'success', versions: missions } );
    return null;
  } )
  .catch( err => {
    res.send( { status: 'failure', message: 'Failed to find versions.' } );
    return null;
  } )
  return null;
});


function relativizePaths(config, mission) {
  let relConfig = JSON.parse(JSON.stringify(config))

  setAllKeys( relConfig, '../' + mission + '/' )

  function setAllKeys(data, prepend) {
    if( typeof data === 'object' && data !== null ) {
      for( let k in data ) {
        if( typeof data[k] === 'object' && data[k] !== null )
          setAllKeys( data[k], prepend )
        else if( Array.isArray(data[k]) )
          setAllKeys( data[k], prepend )
        else if (k == 'url' || k == 'demtileurl' || k == 'legend')
          if( data[k].indexOf('://') == -1 )
            data[k] = prepend + '' + data[k]
      }
    }
    else if( Array.isArray(data) ) {
      for( let i = 0; i < data.length; i++ ) {
        if( typeof data[i] === 'object' && data[i] !== null )
          setAllKeys( data[i], prepend )
        else if( Array.isArray(data[i]) )
          setAllKeys( data[i], prepend )
      }
    }
  }

  return relConfig;
}
  
//existingMission
//cloneMission
//hasPaths
router.post('/clone', function(req, res, next) {

  req.query.full = true
  req.query.mission = req.body.existingMission

  get( req, res, next, function(r) {

    if( r.status == 'success' ) {
      r.config.msv.mission = req.body.cloneMission
      req.body.config = req.body.hasPaths == 'true' ? relativizePaths(r.config, req.body.existingMission) : r.config
      req.body.mission = req.body.cloneMission
      execFile("php", ["private/api/create_mission.php", encodeURIComponent(req.body.cloneMission)], function(
        error,
        stdout,
        stderr
      ) {
        stdout = JSON.parse(stdout);
        if( stdout.status == 'success') {
          add( req, res, next, function(r2) {
            if( r2.status == 'success' ) {
                res.send( r2 );
            }
            else {
              res.send( r2 );
            }
          } )
        }
        else
            res.send(stdout);
      });

    }
    else {
      res.send( r )
    }

  } );

});

router.post('/rename', function(req, res, next) { });
router.post('/destroy', function(req, res, next) {
  Config.destroy( {
    where: {
      mission: req.body.mission
    },
  } ).then( mission => {
    const m = encodeURIComponent(req.body.mission);

    execFile("php", ["private/api/destroy_mission.php", m], function(
      error,
      stdout,
      stderr
    ) {
      res.send( { s: stdout, d: process.cwd() }  );
    });
  })
  .catch( err => {
    res.send( { status: 'failure', message: 'Failed to delete mission ' + req.body.mission + '.' } );
    return null;
  } )
  return null;
});

module.exports = router;
