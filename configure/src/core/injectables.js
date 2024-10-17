import { calls } from "./calls";

const injectablesDefaults = {
  TILE_MATRIX_SETS: ["WebMercatorQuad"],
};
// Initialize with reasonable defaults
const injectables = {
  TILE_MATRIX_SETS: injectablesDefaults["TILE_MATRIX_SETS"],
};

export const getInjectables = () => {
  getTileMatrixSets();
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
