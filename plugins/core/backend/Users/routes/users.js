/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();
const { authorize, resolvers } = require("../../../../../API/permissions/authorize");
const crypto = require("crypto");
const { userPrincipal } = require("../../../../../API/permissions/principal");

// AUTH_LOCAL_LOGIN=admins: only accounts holding an admin role may log in locally
const LOCAL_ADMINS_ONLY = "Only administrators may log in with a local account on this site.";
async function localLoginAllowed(userId) {
  if (!siteAccess.localAdminsOnly()) return true;
  return policy.isAdministrator(await userPrincipal(userId));
}
const bcrypt = require("bcryptjs");
const buf = crypto.randomBytes(128);

const logger = require("../../../../../API/logger");
const {
  apilimiter,
  authLimiter,
  signupLimiter,
  resetLimiter,
} = require("../../../../../scripts/rateLimiters");
const { sequelize } = require("../../../../../API/connection");
const userModel = require("../models/user");
const User = userModel.User;
const { getDefaultMissionsViewing } = require("../models/userdefaults");
const siteAccess = require("../../../../../API/permissions/siteAccess");
const policy = require("../../../../../API/permissions/policy");
const bindings = require("../../../../../API/permissions/bindings");
const setupCode = require("../../../../../API/permissions/setupCode");

// Same message whether the username or the email is taken
const SIGNUP_UNAVAILABLE =
  "Failed to sign up. The username or email may be invalid or already in use.";

// Ends every session of a user, e.g. after their password is reset
function endSessionsOf(userId) {
  return sequelize.query(`DELETE FROM "session" WHERE sess->>'uid' = :uid`, {
    replacements: { uid: String(userId) },
  });
}

function isStrongPassword(password) {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  return (
    password.length >= minLength &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    hasSymbol
  );
}

router.post("/has", authorize.public("login and account self-service"), function (req, res, next) {
  User.count()
    .then((count) => {
      res.send({ status: "success", has: count !== 0 });
    })
    .catch((err) => {
      res.send({ status: "failure" });
    });
});

router.post("/first_signup", signupLimiter, authorize.public("login and account self-service"), function (req, res, next) {
  if (!req.body.password || !isStrongPassword(req.body.password)) {
    res.send({
      status: "failure",
      message:
        "Password is not strong enough. Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.",
    });
    return;
  }

  User.count()
    .then((count) => {
      if (count === 0) {
        setupCode.ensure();
        if (!setupCode.consume(req.body.setup_code)) {
          logger("warn", "First account sign-up rejected: wrong or missing setup code.", req.originalUrl, req);
          res.send({
            status: "failure",
            message: "Invalid setup code (see the server log).",
          });
          return null;
        }
        // Define a new user
        let firstUser = {
          username: req.body.username,
          email: null,
          password: req.body.password,
          token: null,
        };

        User.create(firstUser)
          .then(async (created) => {
            await bindings.seedNewUser(created.id, { superadmin: true });
            res.send({ status: "success", message: "Successfully signed up" });
            return null;
          })
          .catch((err) => {
            // The code was consumed; issue a fresh one for the next attempt
            setupCode.ensure();
            res.send({ status: "failure", message: "Failed to sign up" });
            return null;
          });
      } else {
        setupCode.clear();
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

router.post("/signup", signupLimiter, authorize.public("login and account self-service"), function (req, res, next) {
  const accountManager = policy.can(req.principal, "accounts.manage");
  const selfSignup = siteAccess.selfSignupAllowed();
  if (!accountManager && !selfSignup) {
    res.send({
      status: "failure",
      message: "Currently only administrators may create accounts.",
    });
    return;
  }

  // With admins-only local login, only an admin reaches here and stays signed in as themselves
  const skipLogin =
    req.body.skipLogin === true || siteAccess.localAdminsOnly();

  if (req.body.username == null || req.body.username == "") {
    res.send({
      status: "failure",
      message: "Username must be set.",
    });
    return;
  }

  if (!isStrongPassword(req.body.password)) {
    res.send({
      status: "failure",
      message:
        "Password is not strong enough. Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.",
    });
    return;
  }

  // Define a new user
  let newUser = {
    username: req.body.username,
    email: req.body.email == "" ? null : req.body.email,
    password: req.body.password,
    token: null,
  };

  //Make sure user doesn't already exit
  User.findOne({
    where: {
      username: newUser.username,
    },
  })
    .then(async (user) => {
      if (user == null) {
        // SuperAdmins may override the site default viewing missions
        if (
          policy.isSuperAdmin(req.principal) &&
          req.body.hasOwnProperty("missions_viewing") &&
          (req.body.missions_viewing === null ||
            Array.isArray(req.body.missions_viewing))
        ) {
          newUser.missions_viewing =
            req.body.missions_viewing == null
              ? null
              : req.body.missions_viewing.filter((m) => typeof m === "string");
        } else {
          newUser.missions_viewing = await getDefaultMissionsViewing().catch(
            (err) => {
              logger(
                "error",
                "Failed to read default missions_viewing for new account.",
                req.originalUrl,
                req,
                err
              );
              return null;
            }
          );
        }
        User.create(newUser)
          .then(async (created) => {
            await bindings.seedNewUser(created.id, {
              missionsViewing: newUser.missions_viewing,
            });
            // Just make the account -- don't also login
            if (skipLogin === true) {
              logger(
                "info",
                req.body.username + " signed up.",
                req.originalUrl,
                req
              );
              res.send({
                status: "success",
                username: req.body.username,
                token: null,
                groups: [],
              });
              return null;
            }

            // Otherwise login too
            clearLoginSession(req);
            req.session.regenerate((err) => {
              // Save the user's info in the session
              req.session.user = created.username;
              req.session.uid = created.id;
              req.session.token = crypto.randomBytes(128).toString("hex");

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
            logger(
              "error",
              "Failed to sign up. Email might be invalid or already in use.",
              req.originalUrl,
              req,
              err
            );
            res.send({ status: "failure", message: SIGNUP_UNAVAILABLE });
            return null;
          });
      } else {
        res.send({ status: "failure", message: SIGNUP_UNAVAILABLE });
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
router.post("/login", authLimiter, authorize.public("login and account self-service"), function (req, res) {
  let MMGISUser;
  try {
    let userCookie = req.cookies.MMGISUser;
    if (typeof userCookie === "string" && userCookie.endsWith("}undefined"))
      userCookie = userCookie.substring(0, userCookie.length - 9);

    MMGISUser = userCookie ? JSON.parse(userCookie) : false;
  } catch (err) {
    res.send({ status: "failure", message: "Malformed MMGISUser cookie." });
    return null;
  }

  // Password and saved logins are only for sites that use the local provider
  if (!siteAccess.hasProvider("local")) {
    res.send({ status: "failure", message: "Local login is not enabled on this site." });
    return null;
  }

  // Token-based re-authentication (page reload): verify the token in the DB
  // and refresh session data in-place. Session regeneration and token rotation
  // are intentionally skipped to preserve multi-tab compatibility.
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
      attributes: ["id", "username", "email"],
    })
      .then((user) => {
        if (!user) {
          res.send({ status: "failure", message: "Bad token." });
        } else {
          const signIn = () => {
            req.session.user = user.username;
            req.session.uid = user.id;
            if (!req.session.token) {
              req.session.token = MMGISUser.token;
            }
            req.session.save(() => {
              res.send({
                status: "success",
                username: user.username,
                token: req.session.token,
                groups: getUserGroups(user.username, req.leadGroupName),
                additional:
                  process.env.THIRD_PARTY_COOKIES === "true"
                    ? `; SameSite=None;${
                        process.env.NODE_ENV === "production" ? " Secure" : ""
                      }`
                    : "",
              });
            });
          };
          return localLoginAllowed(user.id).then((allowed) => {
            if (!allowed) return res.send({ status: "failure", message: LOCAL_ADMINS_ONLY });
            // A session that is not already this user's gets a new id
            if (String(req.session.uid) === String(user.id)) signIn();
            else
              req.session.regenerate((err) => {
                if (err) res.send({ status: "failure", message: "Bad token." });
                else signIn();
              });
          });
        }
        return null;
      })
      .catch((err) => {
        res.send({ status: "failure", message: "Bad token." });
      });
    return null;
  }

  // Credential-based login: regenerate the session to prevent session fixation
  clearLoginSession(req);

  req.session.regenerate((err) => {
    let username = req.body.username || (MMGISUser ? MMGISUser.username : null);

    if (username == null) {
      res.send({ status: "failure", message: "No username provided." });
      return;
    }

    User.findOne({
      where: {
        username: username,
      },
      attributes: ["id", "username", "email", "password"],
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
                  return;
                })
                .catch((err) => {
                  res.send({ status: "failure", message: "Login failed." });
                  return;
                });
              return;
            } else {
              res.send({
                status: "failure",
                message: "Invalid username or password.",
              });
              return;
            }
          }

          bcrypt.compare(req.body.password, user.password, (err, result, again) => {
            if (!result) return pass(err, result, again);
            localLoginAllowed(user.id)
              .then((allowed) =>
                allowed ? pass(err, result, again) : res.send({ status: "failure", message: LOCAL_ADMINS_ONLY })
              )
              .catch(() => res.send({ status: "failure", message: "Login failed." }));
          });
          return null;
        }
        return null;
      })
      .catch((err) => {
        res.send({ status: "failure", message: "Login failed." });
      });
  });
  return null;
});

router.post("/logout", apilimiter, authorize.public("login and account self-service"), function (req, res) {
  let MMGISUser = false;
  try {
    MMGISUser = req.cookies.MMGISUser ? JSON.parse(req.cookies.MMGISUser) : false;
  } catch (err) {
    MMGISUser = false;
  }
  // The session's account loses the saved logins this browser holds (session and cookie);
  // without a signed-in session, the cookie alone says which saved login ends
  const uid = req.session.uid;
  const tokens = [req.session.token, MMGISUser && MMGISUser.token].filter(
    (t) => typeof t === "string" && t.length > 0
  );
  const bySession = uid != null && tokens.length > 0;

  clearLoginSession(req);

  if (!bySession && !MMGISUser) {
    res.send({ status: "failure", message: "No user." });
  } else {
    User.update(
      {
        token: null,
      },
      {
        where: bySession
          ? { id: uid, token: { [Op.in]: tokens } }
          : { username: String(MMGISUser.username), token: String(MMGISUser.token) },
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

router.get("/logged_in", authorize.public("login and account self-service"), function (req, res) {
  if (req.session.uid != null && typeof req.session.user === "string")
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

router.post("/resetPassword", resetLimiter, authorize.public("login and account self-service"), function (req, res) {
  let username = req.body.username;
  let password = req.body.password;
  let resetToken = req.body.resetToken;

  if (username == null || username == "") {
    res.send({ status: "failure", message: "Missing username." });
  } else if (password == null || password == "") {
    res.send({ status: "failure", message: "Missing password." });
  } else if (resetToken == null || resetToken == "") {
    res.send({ status: "failure", message: "Missing resetToken." });
  } else if (!isStrongPassword(password)) {
    res.send({
      status: "failure",
      message:
        "Password is not strong enough. Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.",
    });
  } else {
    User.findOne({
      where: {
        username: username,
        reset_token: resetToken,
      },
      attributes: [
        "id",
        "username",
        "email",
        "password",
        "reset_token",
        "reset_token_expiration",
        "token",
      ],
    })
      .then((user) => {
        if (user) {
          if (
            user.reset_token_expiration == null ||
            Date.now() >= user.reset_token_expiration
          ) {
            res.send({
              status: "failure",
              message: `Password reset time expired.`,
            });
          } else {
            user.password = password;
            user.reset_token = null;
            user.reset_token_expiration = null;
            // Signs out saved logins (MMGISUser cookie) along with open sessions below
            user.token = null;

            // using user.save() so that the beforeUpdate hook gets triggered (User.update() doesn't trigger it)
            user
              .save()
              .then(() =>
                endSessionsOf(user.id).catch((err) =>
                  logger(
                    "error",
                    `Failed to end sessions after password reset for user: ${username}`,
                    req.originalUrl,
                    req,
                    err
                  )
                )
              )
              .then(() => {
                res.send({
                  status: "success",
                  message: `Successfully reset password for user: ${username}`,
                });
              })
              .catch((err) => {
                logger(
                  "error",
                  `Failed to reset password for user: ${username}`,
                  req.originalUrl,
                  req,
                  err
                );
                res.send({
                  status: "failure",
                  message: `Failed to reset password for user: ${username}`,
                });
              });
          }
        } else {
          res.send({
            status: "failure",
            message: `Invalid username or reset token.`,
          });
        }
        return null;
      })
      .catch((err) => {
        logger("error", "Password reset failed.", req.originalUrl, req, err);
        res.send({ status: "failure", message: "Password reset failed." });
        return null;
      });
  }
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
}

module.exports = router;
