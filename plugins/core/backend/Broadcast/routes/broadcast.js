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

function websocketsEnabled() {
  return (
    process.env.hasOwnProperty("ENABLE_MMGIS_WEBSOCKETS") &&
    process.env.ENABLE_MMGIS_WEBSOCKETS == "true"
  );
}

/**
 * POST /api/broadcast/layerUpdate
 * Notify-only: tells connected clients of `mission` to re-query `layerName`.
 * body: { mission: string, layerName: string | string[] }
 */
router.post("/layerUpdate", checkMissionPermission, function (req, res, next) {
  const mission = req.body.mission;
  const layerName = req.body.layerName;

  if (typeof mission !== "string" || mission.length === 0) {
    res.send({
      status: "failure",
      message: "Missing or invalid 'mission'.",
    });
    return;
  }

  const isValidName = (n) => typeof n === "string" && n.length > 0;
  if (
    !(
      isValidName(layerName) ||
      (Array.isArray(layerName) &&
        layerName.length > 0 &&
        layerName.every(isValidName))
    )
  ) {
    res.send({
      status: "failure",
      message: "'layerName' must be a non-empty string or array of strings.",
    });
    return;
  }

  if (!websocketsEnabled()) {
    res.send({
      status: "success",
      message:
        "Websockets are disabled (ENABLE_MMGIS_WEBSOCKETS != 'true'). No clients notified.",
      broadcasted: false,
    });
    return;
  }

  const data = {
    info: { type: "refreshLayer", layerName },
    body: { mission },
  };

  try {
    websocket.websocket.broadcast(JSON.stringify(data));
    logger(
      "info",
      `Broadcasted refreshLayer for mission '${mission}'.`,
      req.originalUrl,
      req
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
      err
    );
    res.send({
      status: "failure",
      message: "Failed to broadcast layer refresh.",
    });
  }
});

module.exports = router;
