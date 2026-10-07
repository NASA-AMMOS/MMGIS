export const publicUrl = `${window.location.pathname
  .replace(`configure`, "")
  .replace(/^\//g, "")}configure`;

export const publicUrlMainSite = `${
  window.location.origin
}${window.location.pathname.replace(`/configure`, "")}`;

export const endpoints = {};

export const HASH_PATHS = {
  home: publicUrl + "/",
};

// Reserved /Missions/<folder> for shared data; never a mission name.
// Mirrors SHARED_MISSION_FOLDER_NAME in plugins/core/backend/Config/constants.js
export const SHARED_MISSION_NAME = "_shared";
