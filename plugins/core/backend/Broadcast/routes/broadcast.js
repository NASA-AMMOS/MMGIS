/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
require("dotenv").config();
const express = require("express");
const router = express.Router();

const logger = require("../../../../../API/logger");
const websocket = require("../../../../../API/websocket.js");
const { checkMissionPermission } = require("../../Config/routes/configs");
const {
  websocketsEnabled,
  validateLayerUpdateBody,
  buildRefreshLayerEnvelope,
} = require("./broadcastutils");

/**
 * POST /api/broadcast/layerUpdate
 * Notify-only: tells connected clients of `mission` to re-query `layerName`.
 * body: { mission: string, layerName: string | string[] }
 */
function validateBody(req, res, next) {
  const validationError = validateLayerUpdateBody(req.body);
  if (validationError) {
    res.send({ status: "failure", message: validationError });
    return;
  }
  next();
}

router.post(
  "/layerUpdate",
  validateBody,
  checkMissionPermission,
  function (req, res, next) {
    const { mission, layerName } = req.body;

    if (!websocketsEnabled()) {
      res.send({
        status: "success",
        message:
          "Websockets are disabled (ENABLE_MMGIS_WEBSOCKETS != 'true'). No clients notified.",
        broadcasted: false,
      });
      return;
    }

    try {
      const sent = websocket.websocket.broadcast(
        JSON.stringify(buildRefreshLayerEnvelope(mission, layerName)),
      );
      if (!sent) {
        res.send({
          status: "success",
          message: "Websocket server is not running. No clients notified.",
          broadcasted: false,
        });
        return;
      }
      logger(
        "info",
        `Broadcasted refreshLayer for mission '${mission}'.`,
        req.originalUrl,
        req,
      );
      res.send({
        status: "success",
        message: "Layer refresh broadcasted.",
        broadcasted: true,
      });
    } catch (err) {
      logger(
        "error",
        "Failed to broadcast layer refresh.",
        req.originalUrl,
        req,
        err,
      );
      res.send({
        status: "failure",
        message: "Failed to broadcast layer refresh.",
      });
    }
  },
);

module.exports = router;
