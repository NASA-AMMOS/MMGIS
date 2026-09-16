// Exposes the managed proj4 package as window.proj4, which proj4leaflet and
// several tools read off the global.
import proj4 from 'proj4'

window.proj4 = proj4

export default proj4
