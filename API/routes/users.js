/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const buf       = crypto.randomBytes(128);

const logger    = require('../logger');
const User      = require('../models/user');


/* GET users listing. */
router.get('/sign_up', function(req, res, next ) {
  res.render('signup', { title: 'sign up' });
});



router.post('/sign_up', function(req, res, next ){
  // Recording the current time
  let now = new Date();
  let dd = now.getDate(), mm = now.getMonth() + 1, yy = now.getFullYear(), 
  hour = now.getHours(), min = now.getMinutes(), sec = now.getSeconds();
  let curntTime = yy + '-' + mm + '-' + dd +' '+ hour + ':' + min + ':' + sec;

  // Define a new user
  let newUser = {
    first_name: req.body.username,
    last_name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    stauts: 'activated',
    token: buf.toString('hex'),
    permission: '001',
    last_login: '2000-01-01 12:00:00-00',
    createdAt: curntTime
  };


  // Insert new user into the user table
  User.create(newUser)
    .then(() => User.findOrCreate({
        where: {
            password: req.body.password,
            email: req.body.email
        },
        defaults: {
            job: 'Technical Lead JavaScript'
        }
    }))
    .spread((user, created) => { // If the user is crated then print out the info of that user
        logger.info(user.get({
            plain: true
        }));

        // Then inform the user that his/her account is created and if there an email service
        // System in the server then send the user an activate link
        res.send( { message: "You are successfully registered for the application, " +
                    "please check your email for activation link." });
        logger.info( created );
    })
    .catch(function(err) {
        // This message will be send to the user if there is another account with same user and password in the database.
        res.send({ message: "This user exists in our records. If you forgot your credential, " +
                    "please go to the login page and click on 'Forgot my password' to reset your password."});
                    logger.error(err.message, req.body.username, req.body.email);
    });
});



/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


/**
 * User login 
 */
router.post('/login', function( req, res ){
  // Not using this session data for now
  let sessData = req.session;

  let user_name = req.body.email;
  let pass = req.body.password;

  User.findOne(
    {
      where: {
          email: user_name
      }
      ,
      attributes: ['id', 'first_name', 'last_name', 'email', 'password', 'status', 'token']
    }
  ).then( user => {
      
      if (!user){
        logger.info("User does not exist in the database, go to sign up page.");
        res.send( {message: "No records found for this user! Sign up for an account."} );

      } else {
        bcrypt.compare(pass, user.password, function(err, result) {
          if( result ){
            if (user.status === 'activated') {

              // Save the user's info in the session
              req.session.uid = user.id;
              req.session.token = user.token;

              logger.info("Password exists for this user and it is correct and the account is activated.");
              res.send( { id: user.id, token: user.token } );
              
              // Recording the current time
              let now = new Date();
              let dd = now.getDate(), mm = now.getMonth() + 1, yy = now.getFullYear(), 
                  hour = now.getHours(), min = now.getMinutes(), sec = now.getSeconds();

              let curntTime = yy + '-' + mm + '-' + dd +' '+ hour + ':' + min + ':' + sec;

              // Update the token and last login time here for security purposes
              User.update({
                  // token: buf.toString('hex'),
                  last_login: curntTime
              }, {
                  where: {
                      email: user_name
                  }
              });
  
            } else {
              // If the account of this user is not activated yet
              logger.info("Inform the user that his/her account is not activated yet: Your account is not activated yet");
              res.send({message: "Your account is not activated yet! Check your email for activation link."});
            }
          } else {
            // If user credential is not correct. For security reasons, here we are not returning to the users that 
            // what is worng with their inputs.
            logger.info("User exists in the database, but password is not correct!");
            res.send( {message: "Your username or password is wrong!"} );
          }
        });
      }   
    }
  ).catch(err => {
      logger.error(err.message);
  });

});

 /**
  * implement user logout here
  */


module.exports = router;
