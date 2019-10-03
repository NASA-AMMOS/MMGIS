module.exports = {
  baseUrl: '../scripts',
  mainConfigFile: '../scripts/configure.js',
  name: '../scripts/main',
  buildCSS: true,
  separateCSS: true,
  include: ['../scripts/pre/**/*.js', '../scripts/essence/Tools/**/*.js'],
  out: '../dist/mmgis.min.js'
}