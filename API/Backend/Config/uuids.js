const Utils = require("../../utils.js");

const { v4: uuidv4, validate: uuidValidate } = require("uuid");

const populateUUIDs = (config) => {
  const newlyAddedUUIDs = [];

  Utils.traverseLayers(config.layers, (layer) => {
    if (layer.uuid == null) {
      layer.uuid = uuidv4();
      newlyAddedUUIDs.push({
        name: layer.name,
        uuid: layer.uuid,
      });
    } else if (!uuidValidate(layer.uuid)) {
      const badUUID = layer.uuid;
      layer.uuid = uuidv4();
      newlyAddedUUIDs.push({
        name: layer.name,
        uuid: layer.uuid,
        replacesBadUUID: badUUID,
      });
    }
  });
  return newlyAddedUUIDs;
};

module.exports = populateUUIDs;
