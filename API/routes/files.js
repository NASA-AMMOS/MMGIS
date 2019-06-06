const express  = require('express');
const logger   = require('../logger');
const database = require('../database');
const Sequelize = require('sequelize');
const fhistories       	= require('../models/filehistories')
const Filehistories 	= fhistories.Filehistories
const FilehistoriesTEST	= fhistories.FilehistoriesTEST
const ufiles          	= require('../models/userfiles');
const Userfiles 	   	= ufiles.Userfiles;
const UserfilesTEST	   	= ufiles.UserfilesTEST;
const ufeatures        	= require('../models/userfeatures');
const Userfeatures     	= ufeatures.Userfeatures;
const UserfeaturesTEST 	= ufeatures.UserfeaturesTEST;
const Userfeatures_s   	= ufeatures.sequelize;


const router   = express.Router();
const db       = database.db;

const historyKey = {
	0: 'Add',
	1: 'Edit',
	2: 'Delete',
	3: 'Undo'
}

router.post('/', function(req, res, next) {
	res.send('test files');
});

module.exports = router;
