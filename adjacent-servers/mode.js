function getAdjacentServersMode() {
  const mode = process.env.ADJACENT_SERVERS_MODE || "embedded";
  if (mode !== "embedded" && mode !== "external") {
    throw new Error("ADJACENT_SERVERS_MODE must be embedded or external.");
  }
  return mode;
}

module.exports = getAdjacentServersMode;
