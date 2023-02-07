const Utils = require("../../utils.js");

const { v4: uuidv4, validate: uuidValidate } = require("uuid");

const populateUUIDs = (config) => {
  const newlyAddedUUIDs = [];
  const definedUUIDs = [];

  Utils.traverseLayers(config.layers, (layer) => {
    if (layer.uuid == null) {
      layer.uuid = uuidv4();
      newlyAddedUUIDs.push({
        name: layer.name,
        uuid: layer.uuid,
      });
    } else if (!uuidValidate(layer.uuid) || definedUUIDs.includes(layer.uuid)) {
      const badUUID = layer.uuid;
      layer.uuid = uuidv4();
      newlyAddedUUIDs.push({
        name: layer.name,
        uuid: layer.uuid,
        replacesBadUUID: badUUID,
      });
    } else {
      definedUUIDs.push(layer.uuid)
    }
  });
  return newlyAddedUUIDs;
};

module.exports = populateUUIDs;
