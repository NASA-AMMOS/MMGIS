import { calls } from "./calls";

const injectablesDefaults = {
  TILE_MATRIX_SETS: ["WebMercatorQuad"],
  COLORMAP_NAMES: ["viridis"],
};
// Initialize with reasonable defaults
const injectables = {
  TILE_MATRIX_SETS: injectablesDefaults["TILE_MATRIX_SETS"],
  COLORMAP_NAMES: injectablesDefaults["COLORMAP_NAMES"],
};

export const getInjectables = () => {
  getTileMatrixSets();
  getColormapNames();
};

export const inject = (configJson) => {
  let injected = JSON.stringify(configJson);
  Object.keys(injectables).forEach((inj) => {
    injected = injected.replaceAll(
      `"{{${inj}}}"`,
      Array.isArray(injectables[inj])
        ? JSON.stringify(injectables[inj])
        : injectables[inj]
    );
  });
  return JSON.parse(injected);
};

function getTileMatrixSets() {
  const injectableName = "TILE_MATRIX_SETS";
  if (window.mmgisglobal.WITH_TITILER === "true") {
    calls.api(
      "titiler_tileMatrixSets",
      null,
      (res) => {
        // ... new Set removes duplicates
        injectables[injectableName] = [
          ...new Set(
            injectablesDefaults["TILE_MATRIX_SETS"].concat(
              res.tileMatrixSets.map((s) => s.id)
            )
          ),
        ];
      },
      (res) => {
        console.warn(`Failed to query for ${injectableName}. Using defaults.`);
        injectables[injectableName] = [
          "WebMercatorQuad",
          "CanadianNAD83_LCC",
          "CDB1GlobalGrid",
          "EuropeanETRS89_LAEAQuad",
          "GNOSISGlobalGrid",
          "LINZAntarticaMapTilegrid",
          "NZTM2000Quad",
          "UPSAntarcticWGS84Quad",
          "UPSArcticWGS84Quad",
          "UTM31WGS84Quad",
          "WGS1984Quad",
          "WorldCRS84Quad",
          "WorldMercatorWGS84Quad",
        ];
      }
    );
  }
}

function getColormapNames() {
  const injectableName = "COLORMAP_NAMES";
  if (window.mmgisglobal.WITH_TITILER === "true") {
    calls.api(
      "titiler_colormapNames",
      null,
      (res) => {
        // ... new Set removes duplicates
        injectables[injectableName] = [
          ...new Set(
            injectablesDefaults["COLORMAP_NAMES"].concat(res.colorMaps)
          ),
        ];
      },
      (res) => {
        console.warn(`Failed to query for ${injectableName}. Using defaults.`);
        injectables[injectableName] = [
          "gist_earth",
          "gist_earth_r",
          "gist_gray",
          "gist_gray_r",
          "gist_heat",
          "gist_heat_r",
          "gist_ncar",
          "gist_ncar_r",
          "gist_rainbow",
          "gist_rainbow_r",
          "gist_stern",
          "gist_stern_r",
          "gist_yarg",
          "gist_yarg_r",
          "terrain",
          "terrain_r",
          "viridis",
          "viridis_r",
        ];
      }
    );
  }
}
