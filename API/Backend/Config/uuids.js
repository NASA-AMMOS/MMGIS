const Utils = require("../../utils.js");

const { v4: uuidv4, validate: uuidValidate } = require("uuid");

const populateUUIDs = (config) => {
  const newlyAddedUUIDs = [];
  const definedUUIDs = [];

  // Track of all of the previously defined UUIDs (i.e. ignore the UUIDs of the newly added layers)
  Utils.traverseLayers(config.layers, (layer) => {
    if (layer.uuid != null && !layer.proposed_uuid) {
      definedUUIDs.push(layer.uuid)
    }
  });

  Utils.traverseLayers(config.layers, (layer) => {
    if (layer.uuid != null  && !layer.proposed_uuid) {
      definedUUIDs.push(layer.uuid)
    }
  });

  Utils.traverseLayers(config.layers, (layer) => {
    console.log("layer", layer.name, definedUUIDs.includes(layer.proposed_uuid), layer.proposed_uuid)
    if (layer.uuid == null) {
      layer.uuid = uuidv4();
      newlyAddedUUIDs.push({
        name: layer.name,
        uuid: layer.uuid,
      });
    } else if (!uuidValidate(layer.uuid) || definedUUIDs.includes(layer.proposed_uuid)) {
      const badUUID = layer.uuid;
      layer.uuid = uuidv4();
      newlyAddedUUIDs.push({
        name: layer.name,
        uuid: layer.uuid,
        replacesBadUUID: badUUID,
      });
    } else {
      definedUUIDs.push(layer.uuid);
    }

    if (layer.proposed_uuid) {
      delete layer.proposed_uuid;
    }
  });

  return newlyAddedUUIDs;
};

module.exports = populateUUIDs;
