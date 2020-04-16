module.exports = {
  baseUrl: "../scripts",
  mainConfigFile: "../scripts/configure.js",
  name: "../scripts/main",
  buildCSS: true,
  separateCSS: true,
  include: ["pre/**/*.js", "essence/Tools/**/*.js"],
  out: "../dist/mmgis.min.js"
};
