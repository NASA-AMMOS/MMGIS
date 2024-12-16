/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const buf = crypto.randomBytes(128);

const logger = require("../../../logger");
const User = require("../models/user");

router.post("/has", function (req, res, next) {
  User.count()
    .then((count) => {
      res.send({ status: "success", has: count !== 0 });
    })
    .catch((err) => {
      res.send({ status: "failure" });
    });
});

router.post("/first_signup", function (req, res, next) {
  User.count()
    .then((count) => {
      if (count === 0) {
        // Define a new user
        let firstUser = {
          username: req.body.username,
          email: null,
          password: req.body.password,
          permission: "111",
          token: null,
        };

        User.create(firstUser)
          .then((created) => {
            res.send({ status: "success", message: "Successfully signed up" });
            return null;
          })
          .catch((err) => {
            res.send({ status: "failure", message: "Failed to sign up" });
            return null;
          });
      } else {
        res.send({ status: "failure", message: "Permission denied" });
        return null;
      }
      return null;
    })
    .catch((err) => {
      res.send({ status: "failure", message: "Validation error" });
      return null;
    });
});

router.post("/signup", function (req, res, next) {
  if (
    (process.env.AUTH === "local" && req.session.permission !== "111") ||
    (process.env.AUTH === "off" && req.session.permission !== "111")
  ) {
    res.send({
      status: "failure",
      message: "Currently set so only administrators may create accounts.",
    });
    return;
  }
  // Define a new user
  let newUser = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    permission: "001",
    token: null,
  };

  //Make sure user doesn't already exit
  User.findOne({
    where: {
      username: newUser.username,
    },
  })
    .then((user) => {
      if (!user) {
        User.create(newUser)
          .then((created) => {
            clearLoginSession(req);
            req.session.regenerate((err) => {
              // Save the user's info in the session
              req.session.user = created.username;
              req.session.uid = created.id;
              req.session.token = crypto.randomBytes(128).toString("hex");
              req.session.permission = created.permission;

              User.update(
                {
                  token: req.session.token,
                },
                {
                  where: {
                    id: created.id,
                    username: created.username,
                  },
                }
              )
                .then(() => {
                  logger(
                    "info",
                    req.body.username + " signed up.",
                    req.originalUrl,
                    req
                  );
                  res.send({
                    status: "success",
                    username: created.username,
                    token: req.session.token,
                    groups: getUserGroups(created.username, req.leadGroupName),
                  });
                  return null;
                })
                .catch((err) => {
                  logger(
                    "error",
                    "Only partially signed up.",
                    req.originalUrl,
                    req,
                    err
                  );
                  res.send({
                    status: "failure",
                    message: "Only partially signed up. Try logging in.",
                  });
                  return null;
                });
              return null;
            });
            return null;
          })
          .catch((err) => {
            logger("error", "Failed to sign up.", req.originalUrl, req, err);
            res.send({ status: "failure", message: "Failed to sign up." });
            return null;
          });
      } else {
        res.send({ status: "failure", message: "User already exists." });
      }
      return null;
    })
    .catch((err) => {
      logger("error", "Failed to sign up.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to sign up." });
    });
  return null;
});

/**
 * User login
 */
router.post("/login", function (req, res) {
  clearLoginSession(req);

  req.session.regenerate((err) => {
    let MMGISUser;
    try {
      let userCookie = req.cookies.MMGISUser;
      if (typeof userCookie === "string" && userCookie.endsWith("}undefined"))
        userCookie = userCookie.substring(0, userCookie.length - 9);

      MMGISUser = userCookie ? JSON.parse(userCookie) : false;
    } catch (err) {
      res.send({ status: "failure", message: "Malformed MMGISUser cookie." });
      return;
    }
    let username = req.body.username || (MMGISUser ? MMGISUser.username : null);

    if (username == null) {
      res.send({ status: "failure", message: "No username provided." });
      return;
    }

    User.findOne({
      where: {
        username: username,
      },
      attributes: ["id", "username", "email", "password", "permission"],
    })
      .then((user) => {
        if (!user) {
          res.send({
            status: "failure",
            message: "Invalid username or password.",
          });
        } else {
          function pass(err, result, again) {
            if (result) {
              // Save the user's info in the session
              req.session.user = user.username;
              req.session.uid = user.id;
              req.session.token = crypto.randomBytes(128).toString("hex");
              req.session.permission = user.permission;

              User.update(
                {
                  token: req.session.token,
                },
                {
                  where: {
                    id: user.id,
                    username: user.username,
                  },
                }
              )
                .then(() => {
                  req.session.save(() => {
                    res.send({
                      status: "success",
                      username: user.username,
                      token: req.session.token,
                      groups: getUserGroups(user.username, req.leadGroupName),
                      additional:
                        process.env.THIRD_PARTY_COOKIES === "true"
                          ? `; SameSite=None;${
                              process.env.NODE_ENV === "production"
                                ? " Secure"
                                : ""
                            }`
                          : "",
                    });
                  });
                  return null;
                })
                .catch((err) => {
                  res.send({ status: "failure", message: "Login failed." });
                  return null;
                });
              return null;
            } else {
              res.send({
                status: "failure",
                message: "Invalid username or password.",
              });
              return null;
            }
          }

          if (req.body.useToken && MMGISUser) {
            if (MMGISUser.token == null) {
              res.send({ status: "failure", message: "Bad token." });
              return null;
            }
            User.findOne({
              where: {
                username: MMGISUser.username,
                token: MMGISUser.token,
              },
            })
              .then((user) => {
                if (!user) {
                  res.send({ status: "failure", message: "Bad token." });
                } else {
                  pass(null, true, true);
                }
                return null;
              })
              .catch((err) => {
                res.send({ status: "failure", message: "Bad token." });
              });
            return null;
          } else {
            bcrypt.compare(req.body.password, user.password, pass);
          }
          return null;
        }
        return null;
      })
      .catch((err) => {
        res.send({ status: "failure", message: "Bad token." });
      });
  });
  return null;
});

router.post("/logout", function (req, res) {
  let MMGISUser = req.cookies.MMGISUser
    ? JSON.parse(req.cookies.MMGISUser)
    : false;

  clearLoginSession(req);

  if (MMGISUser == false) {
    res.send({ status: "failure", message: "No user." });
  } else {
    User.update(
      {
        token: null,
      },
      {
        where: {
          username: MMGISUser.username,
          token: MMGISUser.token,
        },
      }
    )
      .then(() => {
        req.session.save(() => {
          req.session.regenerate((err) => {
            res.send({ status: "success" });
          });
        });
        return null;
      })
      .catch((err) => {
        logger("error", "Logout failed.", req.originalUrl, req, err);
        res.send({ status: "failure", message: "Logout Failed." });
        return null;
      });
  }
});

router.get("/logged_in", function (req, res) {
  if (
    typeof req.session.permission === "string" &&
    req.session.permission[req.session.permission.length - 1] === "1"
  )
    res.send({
      status: "success",
      message: `'${req.session.user}' is logged in to this session.`,
      body: {
        loggedIn: true,
        user: req.session.user,
      },
    });
  else
    res.send({
      status: "failure",
      message: `No user is logged in to this session.`,
      body: {
        loggedIn: false,
        user: null,
      },
    });
});

function getUserGroups(user, leadGroupName) {
  let leads = process.env.LEADS ? JSON.parse(process.env.LEADS) : [];
  let groups = {};
  if (leads.indexOf(user) != -1) {
    groups[leadGroupName] = true;
  }
  return Object.keys(groups);
}

function clearLoginSession(req) {
  req.session.user = "guest";
  req.session.uid = null;
  req.session.token = null;
  req.session.permission = null;
}

module.exports = router;
