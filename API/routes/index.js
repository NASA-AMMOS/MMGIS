/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require('express');
const router  = express.Router();
const logger  = require('../logger');


/* GET home page. */
/**
 * A middleware is implemented to set the request header
 * and the requested url from users.
 */
router.get('/', function(req, res, next) {
  	res.render('index', { title: 'MMGIS API' });
});


module.exports = router;
