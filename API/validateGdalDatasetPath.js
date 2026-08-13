const validateMissionsPath = require("./validateMissionsPath");
const { fullyDecodePath } = validateMissionsPath;
const logger = require("./logger");

// Network-backed GDAL dataset prefixes. Local /vsi* wrappers (/vsizip/, /vsitar/,
// /vsisubfile/, …) are deliberately absent: they read from disk, so they must
// never be reachable through the remote allowlist.
const REMOTE_PREFIXES = [
  "/vsicurl/",
  "/vsicurl_streaming/",
  "/vsis3/",
  "/vsis3_streaming/",
  "/vsigs/",
  "/vsigs_streaming/",
  "/vsiaz/",
  "/vsiaz_streaming/",
  "/vsiadls/",
  "/vsioss/",
  "/vsioss_streaming/",
  "/vsiswift/",
  "/vsiswift_streaming/",
  "/vsihdfs/",
  "/vsiwebhdfs/",
  "http://",
  "https://",
  "ftp://",
];

// Anything matching these anywhere in the dataset name can pull in local bytes
// or an inline dataset definition (VRT XML), even behind a remote prefix.
const FORBIDDEN_TOKENS = [
  "/vsizip",
  "/vsitar",
  "/vsigzip",
  "/vsi7z",
  "/vsirar",
  "/vsisubfile",
  "/vsimem",
  "/vsistdin",
  "/vsistdout",
  "/vsisparse",
  "/vsicrypt",
  "<",
];

function isRemote(datasetPath) {
  return REMOTE_PREFIXES.some((prefix) => datasetPath.startsWith(prefix));
}

/**
 * Prefixes an operator has opted into via GDAL_ALLOWED_REMOTE_PREFIXES.
 * Entries that are not themselves network-backed are dropped, so a typo or an
 * over-broad entry cannot re-open local file access.
 */
function allowedRemotePrefixes() {
  return String(process.env.GDAL_ALLOWED_REMOTE_PREFIXES || "")
    .split(",")
    .map((prefix) => prefix.trim())
    .filter((prefix) => {
      if (prefix.length === 0) return false;
      if (isRemote(prefix)) return true;
      logger(
        "warn",
        `Ignoring GDAL_ALLOWED_REMOTE_PREFIXES entry "${prefix}": not a remote GDAL prefix (expected one of ${REMOTE_PREFIXES.join(
          ", "
        )}).`
      );
      return false;
    });
}

/**
 * Validate a client-supplied GDAL dataset name.
 *
 * Local paths must resolve under /Missions (see validateMissionsPath). Remote
 * datasets (/vsicurl/, /vsis3/, plain http(s) urls, …) are refused unless an
 * operator allowlisted their prefix in GDAL_ALLOWED_REMOTE_PREFIXES, since the
 * server fetches them itself and returns their bytes as pixel values.
 *
 * @param {string} rawPath - The raw path string from the request.
 * @returns {{ error: string }|{ decoded: string, resolved: string }}
 */
function validateGdalDatasetPath(rawPath) {
  const decodeResult = fullyDecodePath(rawPath);
  if (decodeResult.error) return decodeResult;
  const decoded = decodeResult.decoded;

  if (!isRemote(decoded)) return validateMissionsPath(rawPath);

  const lowered = decoded.toLowerCase();
  if (FORBIDDEN_TOKENS.some((token) => lowered.includes(token))) {
    return { error: "Invalid path: access denied." };
  }
  if (!allowedRemotePrefixes().some((prefix) => decoded.startsWith(prefix))) {
    return {
      error:
        "Remote dataset paths are not allowed. Ask a site administrator to allowlist the prefix via GDAL_ALLOWED_REMOTE_PREFIXES.",
    };
  }
  return { decoded, resolved: decoded };
}

module.exports = validateGdalDatasetPath;
