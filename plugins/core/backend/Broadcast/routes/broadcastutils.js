function websocketsEnabled(env = process.env) {
  return (
    Object.prototype.hasOwnProperty.call(env, "ENABLE_MMGIS_WEBSOCKETS") &&
    env.ENABLE_MMGIS_WEBSOCKETS == "true"
  );
}

function isValidName(n) {
  return typeof n === "string" && n.length > 0;
}

// Returns an error message string, or null if the body is valid
function validateLayerUpdateBody(body) {
  if (!body || typeof body !== "object") return "Missing request body.";
  if (!isValidName(body.mission)) return "Missing or invalid 'mission'.";
  const layerName = body.layerName;
  if (
    !(
      isValidName(layerName) ||
      (Array.isArray(layerName) &&
        layerName.length > 0 &&
        layerName.every(isValidName))
    )
  )
    return "'layerName' must be a non-empty string or array of strings.";
  return null;
}

// Notify-only envelope; shape must match the client's parsed.info/parsed.body reads
function buildRefreshLayerEnvelope(mission, layerName) {
  return {
    info: { type: "refreshLayer", layerName },
    body: { mission },
  };
}

module.exports = {
  websocketsEnabled,
  validateLayerUpdateBody,
  buildRefreshLayerEnvelope,
};
