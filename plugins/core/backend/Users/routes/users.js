/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();
const { authorize } = require("../../../../../API/permissions/authorize");
const logger = require("../../../../../API/logger");
const { apilimiter } = require("../../../../../scripts/rateLimiters");
const userModel = require("../models/user");
const User = userModel.User;
const { mountLocalRoutes, clearLoginSession } = require("../../../auth/Local/routes");

// Signup, login and password reset belong to the Local login provider; kept here at /api/users/* too
mountLocalRoutes(router);

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

module.exports = router;
