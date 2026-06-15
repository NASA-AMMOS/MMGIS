/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const logger = require("../../../logger");
const us = require("../models/url_shortener");
const UrlShortener = us.UrlShortener;
const UrlShortener_s = us.sequelize;

/**
 * Creates and saves a shortened url and returns it
 * @param url
 * @param text *optional*
 */
router.post("/shorten", function (req, res, next) {
  if (process.env.DISABLE_LINK_SHORTENER == "true") {
    res.send({
      status: "failure",
      message: "Won't shorten.",
      body: {},
    });
    return;
  }

  var loop = 0;
  var maxLoop = 20;

  shorten();
  function shorten() {
    var short = Math.random()
      .toString(36)
      .substr(2, 5 + loop);

    let newUrlShortened = {
      full: encodeURIComponent(req.body.url),
      short: short,
      creator: req.user,
    };

    UrlShortener.create(newUrlShortened)
      .then((created) => {
        res.send({
          status: "success",
          message: "Successfully shortened URL.",
          body: { url: short },
        });
      })
      .catch((err) => {
        if (
          loop < maxLoop &&
          err.hasOwnProperty("errors") &&
          err.errors[0] &&
          err.errors[0].hasOwnProperty("path") &&
          err.errors[0].hasOwnProperty("type")
        ) {
          loop++;
          shorten();
        } else {
          logger("error", "Failed to shorten URL.", req.originalUrl, req, err);
          res.send({
            status: "failure",
            message: "Failed to shorten URL.",
            body: {},
          });
        }
      });
  }
});

router.post("/expand", function (req, res, next) {
  if (req.body.short == null) {
    res.send({
      status: "failure",
      message: "Short URL not defined in body.",
      body: {},
    });
    return;
  }
  UrlShortener.findOne({
    where: {
      short: req.body.short,
    },
  })
    .then((url) => {
      if (!url) {
        logger("error", "Failed to find short URL.", req.originalUrl, req);
        res.send({
          status: "failure",
          message: "Failure to find URL.",
          body: {},
        });
      } else {
        res.send({
          status: "success",
          message: "Successfully shortened URL.",
          body: { url: decodeURIComponent(url.full) },
        });
      }
    })
    .catch((err) => {
      res.send({
        status: "failure",
        message: "Failed to expand URL.",
        body: {},
      });
    });
});

module.exports = router;
