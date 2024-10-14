export const publicUrl = `${window.location.pathname
  .replace(`configure-beta`, "")
  .replace(/^\//g, "")}configure-beta`;

export const endpoints = {};

export const HASH_PATHS = {
  home: publicUrl + "/",
};
