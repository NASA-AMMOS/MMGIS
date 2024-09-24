export const publicUrl = `${(window.mmgisglobal.ROOT_PATH || "").replace(
  /^\/|\/$/g,
  ""
)}/configure-beta`;

export const endpoints = {};

export const HASH_PATHS = {
  home: publicUrl + "/",
};
