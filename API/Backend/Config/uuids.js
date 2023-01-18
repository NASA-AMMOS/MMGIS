const Utils = require("../../utils.js");

const { v4: uuidv4 } = require("uuid");

const populateUUIDs = (config) => {
  Utils.traverseLayers(config.layers, (layer) => {
    if (layer.uuid == null) layer.uuid = uuidv4();
  });
};

module.exports = populateUUIDs;
