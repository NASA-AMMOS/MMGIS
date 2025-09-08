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
