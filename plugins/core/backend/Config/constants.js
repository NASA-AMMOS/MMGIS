// Reserved /Missions/<folder> for data shared across missions. Under
// AUTH=local any authenticated user may read it; it is never a mission.
const SHARED_MISSION_FOLDER_NAME = "shared";

// Case-insensitive so it cannot collide on case-insensitive filesystems
function isReservedMissionName(name) {
  return (
    typeof name === "string" &&
    name.trim().toLowerCase() === SHARED_MISSION_FOLDER_NAME.toLowerCase()
  );
}

const reservedMissionNameMessage = () =>
  `Mission name '${SHARED_MISSION_FOLDER_NAME}' is reserved.`;

module.exports = {
  SHARED_MISSION_FOLDER_NAME,
  isReservedMissionName,
  reservedMissionNameMessage,
};
