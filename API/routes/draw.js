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
const Userfeatures_s   	= uf.sequelize;

const router   = express.Router();
const db       = database.db;

router.post('/', function(req, res, next) {
	res.send('test draw');
});

module.exports = router;
