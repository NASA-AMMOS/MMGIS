const Utils = require("../../utils.js");

const validate = (config) => {
  let errs = [];

  if (config) {
    errs = errs.concat(validateStructure(config));

    if (errs.length === 0) {
      errs = errs.concat(validateLayers(config));
    }
  } else errs.push(err(`Configuration object is missing.`));

  if (errs.length === 0) return { valid: true };
  else
    return {
      valid: false,
      errors: errs,
    };
};

const validateStructure = (config) => {
  const errs = [];
  if (config == null) errs.push(err(`Configuration is missing.`));
  if (config.msv == null)
    errs.push(
      err(`Configuration is missing the 'msv' (mission-site-view) object.`, [
        "msv",
      ])
    );
  if (config.layers == null)
    errs.push(err(`Configuration is missing the 'layers' object.`, ["layers"]));
  if (config.tools == null)
    errs.push(err(`Configuration is missing the 'tools' object.`, ["tools"]));

  return errs;
};

const validateLayers = (config) => {
  let errs = [];

  let existingUUIDs = [];
  Utils.traverseLayers(config.layers, (layer) => {
    // Check layer name
    const validNameErrs = isValidLayerName(layer.name);
    if (validNameErrs.length > 0) {
      errs = errs.concat(validNameErrs);
      return;
    }

    fillInMissingFieldsWithDefaults(layer);

    switch (layer.type) {
      case "header":
        break;
      case "tile":
        // Check url
        errs = errs.concat(isValidUrl(layer));
        // Check zooms
        errs = errs.concat(isValidZooms(layer));
        break;
      case "vectortile":
        // Check url
        errs = errs.concat(isValidUrl(layer));
        // Check zooms
        errs = errs.concat(isValidZooms(layer));
        break;
      case "data":
        // Check url
        errs = errs.concat(isValidDemUrl(layer));
        // Check zooms
        errs = errs.concat(isValidZooms(layer));
        break;
      case "query":
        // Check url
        errs = errs.concat(isValidEndpoint(layer));
        break;
      case "vector":
        // Check url
        if (layer.controlled !== true) errs = errs.concat(isValidUrl(layer));
        break;
      case "velocity":
        // Check url
        if (layer.controlled !== true) errs = errs.concat(isValidUrl(layer));
        break;
      case "model":
        // Check url
        errs = errs.concat(isValidUrl(layer));
        // Check model params (pos, rot, scale)
        errs = errs.concat(isValidModelParams(layer));
        break;
      default:
        errs = errs.concat(
          err(`Unknown layer type: '${layer.type}'`, ["layers[layer].type"])
        );
    }

    if (layer.uuid != null) {
      if (existingUUIDs.includes(layer.uuid)) {
        errs = errs.concat([
          err(
            `Found a layer with duplicate uuid: ${layer.name} - ${layer.uuid}`
          ),
        ]);
      } else existingUUIDs.push(layer.uuid);
    }
  });

  return errs;
};

const isValidLayerName = (name) => {
  const errs = [];
  if (name == null)
    errs.push(err("Found a layer with name: null.", ["layers[layer].name"]));
  if (name === "")
    errs.push(err("Found a layer with name: ''", ["layers[layer].name"]));
  if (name === "undefined")
    errs.push(
      err("Found a layer with name: undefined", ["layers[layer].name"])
    );

  return errs;
};

const isValidUrl = (layer) => {
  const errs = [];
  if (layer.url == null)
    errs.push(
      err(`Layer '${layer.name}' has URL: null.`, ["layers[layer].url"])
    );
  if (layer.url === "")
    errs.push(err(`Layer '${layer.name}' has URL: ''`, ["layers[layer].url"]));
  if (layer.url === "undefined")
    errs.push(
      err(`Layer '${layer.name}' has URL: undefined`, ["layers[layer].url"])
    );
  return errs;
};
const isValidDemUrl = (layer) => {
  const errs = [];
  if (layer.demtileurl == null)
    errs.push(
      err(`Layer '${layer.name}' has DEM tile URL: null.`, [
        "layers[layer].demtileurl",
      ])
    );
  if (layer.demtileurl === "")
    errs.push(
      err(`Layer '${layer.name}' has DEM tile URL: ''`, [
        "layers[layer].demtileurl",
      ])
    );
  if (layer.demtileurl === "undefined")
    errs.push(
      err(`Layer '${layer.name}' has DEM tile URL: undefined`, [
        "layers[layer].demtileurl",
      ])
    );
  return errs;
};

const isValidEndpoint = (layer) => {
  const errs = [];
  if (layer.query?.endpoint == null)
    errs.push(
      err(`Layer '${layer.name}' has Endpoint: null.`, [
        "layers[layer].query.endpoint",
      ])
    );
  if (layer.query?.endpoint === "")
    errs.push(
      err(`Layer '${layer.name}' has Endpoint: ''`, [
        "layers[layer].query.endpoint",
      ])
    );
  if (layer.query?.endpoint === "undefined")
    errs.push(
      err(`Layer '${layer.name}' has Endpoint: undefined`, [
        "layers[layer].query.endpoint",
      ])
    );
  return errs;
};

const isValidZooms = (layer) => {
  const errs = [];

  if (isNaN(layer.minZoom))
    errs.push(
      err(`Layer '${layer.name}' has Minimum Zoom: undefined`, [
        "layers[layer].minZoom",
      ])
    );
  else if (layer.minZoom < 0)
    errs.push(
      err(`Layer '${layer.name}' has Minimum Zoom: < 0`, [
        "layers[layer].minZoom",
      ])
    );
  if (isNaN(layer.maxNativeZoom))
    errs.push(
      err(`Layer '${layer.name}' has Maximum Native Zoom: undefined`, [
        "layers[layer].maxNativeZoom",
      ])
    );
  if (isNaN(layer.maxZoom))
    errs.push(
      err(`Layer '${layer.name}' has Maximum Zoom: undefined`, [
        "layers[layer].maxZoom",
      ])
    );
  if (
    !isNaN(layer.minZoom) &&
    !isNaN(layer.maxNativeZoom) &&
    !isNaN(layer.maxZoom) &&
    layer.minZoom > layer.maxNativeZoom
  )
    errs.push(
      err(`Layer '${layer.name}' has Minimum Zoom > Maximum Native Zoom`, [
        "layers[layer].minZoom",
        "layers[layer].maxNativeZoom",
      ])
    );

  return errs;
};

const isValidModelParams = (layer) => {
  const errs = [];

  if (
    isNaN(layer.position?.longitude) ||
    isNaN(layer.position?.latitude) ||
    isNaN(layer.position?.elevation)
  )
    errs.push(
      err(
        `Layer '${layer.name}' has invalid Longitude, Latitude or Elevation. Defaulting to 0.`,
        [
          "layers[layer].position.longitude",
          "layers[layer].position.latitude",
          "layers[layer].position.elevation",
        ],
        true
      )
    );
  if (
    isNaN(layer.rotation?.x) ||
    isNaN(layer.rotation?.y) ||
    isNaN(layer.rotation?.z)
  )
    errs.push(
      err(
        `Layer '${layer.name}' has invalid Rotation X, Y or Z. Defaulting to 0.`,
        [
          "layers[layer].rotation.x",
          "layers[layer].rotation.y",
          "layers[layer].rotation.z",
        ],
        true
      )
    );
  if (isNaN(layer.scale))
    errs.push(
      err(
        `Layer '${layer.name}' has invalid Scale. Defaulting to 0.`,
        ["layers[layer].scale"],
        true
      )
    );

  return errs;
};

const hasNonHeaderWithSublayers = (config) => {
  const errs = [];
  Utils.traverseLayers(config.layers, (layer) => {
    if (layer.type !== "header" && layer.sublayers != null)
      errs.push(
        err(`Non-header layer '${layer.name}' has sublayers.`, [
          "layers[non-header-layer].!sublayer",
        ])
      );
  });
  return errs;
};

const fillInMissingFieldsWithDefaults = (layer) => {
  if (layer.type != "header") {
    layer.initialOpacity =
      layer.initialOpacity == null ? 1 : layer.initialOpacity;
    layer.visibility = layer.visibility == null ? true : layer.visibility;
  }
  switch (layer.type) {
    case "header":
      break;
    case "tile":
      layer.tileformat = layer.tileformat == null ? "tms" : layer.tileformat;
      break;
    case "vectortile":
      layer.style = layer.style || {};
      layer.style.className = layer.name.replace(/ /g, "").toLowerCase();
      break;
    case "data":
      layer.style = layer.style || {};
      layer.style.className = layer.name.replace(/ /g, "").toLowerCase();

      layer.tileformat = layer.tileformat == null ? "tms" : layer.tileformat;
      break;
    case "query":
      layer.style = layer.style || {};
      layer.style.className = layer.name.replace(/ /g, "").toLowerCase();
      break;
    case "vector":
      layer.style = layer.style || {};
      layer.style.className = layer.name.replace(/ /g, "").toLowerCase();
      break;
    case "model":
      break;
    default:
  }
};

const err = (reason, invalidFields, onlyAWarning) => {
  return {
    type: onlyAWarning ? "warning" : "error",
    reason: reason,
    invalidFields: invalidFields || [],
  };
};
module.exports = validate;
