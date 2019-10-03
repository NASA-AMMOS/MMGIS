/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const createError  = require('http-errors');
const express      = require('express');
const cors 		     = require('cors');
const path         = require('path');
const cookieParser = require('cookie-parser');
const bodyParser   = require('body-parser');
const logger       = require('morgan');

const indexRouter  = require('./routes/index');
const apiRouter    = require('./routes/apis');
const usersRouter  = require('./routes/users');
const drawRouter  = require('./routes/draw');

const app = express();

app.set('trust proxy', 1);   // trust first proxy

/** set the session for application */
const session = require('express-session');

// const FileStore = require('session-file-store')(session);
// const MemcachedStore = require('connect-memcached')(session);

/*
app.use(session(
  {
    secret: "Shh, its a secret!"
    // name: 'session',
    // cookie: {
    //     path: '/',
    //     httpOnly: true,
    //     maxAge: 60 * 60 * 1000,
    //     signed: false,
    //     secure: true
    // },
    // secret: "Shh, its a secret!",
    // // store: new FileStore(),
    // resave: false,
    // saveUninitialized: true,
    // uid: '',
    // token: ''
  }
));
*/

/***********************************************************
 * This part is for setting up the express framework and its
 * configuration for having more security
 **********************************************************/
const helmet = require('helmet');
app.use(helmet());
app.set('etag', false);
app.disable('x-powered-by');
app.disable('Origin');


/***********************************************************
 * Setting up the view engine and pug files for the view 
 * part. In this application pug template engine is used for
 * rendering the view pages. The traditional view engine 
 * template, jade, is commented out.
 **********************************************************/
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// Setting up the public files of the application like CSS,
// png, js and ...
app.use(express.static(path.join(__dirname, 'public'))); 


/***********************************************************
 * Setting up the routers and path for router files
 **********************************************************/
app.use('/', checkHeadersCodeInjection, indexRouter);
app.use('/users', checkHeadersCodeInjection, usersRouter);
app.use('/apis', checkHeadersCodeInjection, setContentType, apiRouter);
app.use('/draw', checkHeadersCodeInjection, setContentType, drawRouter);


app.use(cors());
// app.set('Origin', false);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



function setContentType(req, res, next){
  res.setHeader('Content-Type', 'application/json');
  next();
}



function checkHeadersCodeInjection( req, res, next ){
  let injectionWords = [
    'pass', 'pw', 'password', 'delete', 'insert', 'update', 'remove', 'select',
    'disable', 'enable' , 'drop', 'set', 'script', '<script>'
  ];

  let code_injected = false;

  // Get the whole requested link from users
  let fullUrl = req.protocol + '://' + req.get('host') + '/apis' + req.url;
  let lowerURL = fullUrl.toLowerCase();

  for(w in injectionWords){
    if (lowerURL.includes(injectionWords[w])){
      code_injected = true;
    }
  }

  if( code_injected ){
    res.send(
      {
        "Warning": "You are not allowed to inject bad code to the application. Your action will be reported!", 
        "Your IP": req.headers['x-forwarded-for'] || req.connection.remoteAddress, 
        "Requested URL": fullUrl
      });
    res.end();
  } else {
    // Set header parameters for this request
    // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:80');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8642');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    // res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requsted-with, Content-Type, Methods');

    let responseHeader = { 
      'x-dns-prefetch-control': res.getHeader('x-dns-prefetch-control'),
        'x-frame-options': res.getHeader('x-frame-options'),
        'strict-transport-security': res.getHeader('strict-transport-security'),
        'x-download-options': res.getHeader('x-download-options'),
        'x-content-type-options': res.getHeader('x-content-type-options'),
        'x-xss-protection': res.getHeader('x-xss-protection'),
        'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
        'access-control-allow-methods': res.getHeader('access-control-allow-methods'),
        'content-type': res.getHeader('content-type')
    };

    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    next();
  }
}

module.exports = app;
