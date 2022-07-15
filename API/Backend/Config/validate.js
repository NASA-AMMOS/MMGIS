const Utils = require("../../utils.js");

const validate = (config) => {
  let errs = [];

  errs = errs.concat(validateStructure(config));

  if (errs.length === 0) {
    errs = errs.concat(validateLayers(config));
  }

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

  Utils.traverseLayers(config.layers, (layer) => {
    // Check layer name
    errs = errs.concat(isValidLayerName(layer.name));

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
        errs = errs.concat(isValidUrl(layer));
        // Check zooms
        errs = errs.concat(isValidZooms(layer));
        break;
      case "query":
        // Check url
        errs = errs.concat(isValidEndpoint(layer));
        break;
      case "vector":
        // Check url
        errs = errs.concat(isValidUrl(layer));
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
  });

  errs = errs.concat(hasDuplicateLayerNames(config));
  errs = errs.concat(hasNonHeaderWithSublayers(config));

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
  if (!validCSSName(name))
    errs.push(
      err(`Layer: '${name}' must not contain symbols or begin with numbers.`, [
        "layers[layer].name",
      ])
    );

  return errs;

  function validCSSName(name) {
    const match = name.match(/[_A-Z ]+[_A-Z0-9- ]+/gi);
    if (match && match[0].length === name.length) return true;

    return false;
  }
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

const hasDuplicateLayerNames = (config) => {
  let allNames = [];

  depthTraversal(config.layers, 0);

  function depthTraversal(node, depth) {
    for (var i = 0; i < node.length; i++) {
      allNames.push(node[i].name);
      //Add other feature information while we're at it
      if (node[i].sublayers != null && node[i].sublayers.length > 0) {
        depthTraversal(node[i].sublayers, depth + 1);
      }
    }
  }

  let unique = [];
  const errs = [];
  allNames.forEach((name) => {
    if (!unique.includes(name)) unique.push(name);
    else
      errs.push(
        err(`Found duplicate layer name: '${name}'`, ["layers[layer].name"])
      );
  });

  return errs;
};

const err = (reason, invalidFields, onlyAWarning) => {
  return {
    type: onlyAWarning ? "warning" : "error",
    reason: reason,
    invalidFields: invalidFields || [],
  };
};
module.exports = validate;
