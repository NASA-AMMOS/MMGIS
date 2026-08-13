const validateMissionsPath = require("./validateMissionsPath");
const { fullyDecodePath, decodePathOnce } = validateMissionsPath;
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
  // A remote path has no legitimate need to walk out of its allowlisted scope.
  "..",
];

function remotePrefixOf(datasetPath) {
  return REMOTE_PREFIXES.find((prefix) => datasetPath.startsWith(prefix));
}

function isRemote(datasetPath) {
  return remotePrefixOf(datasetPath) != null;
}

// An entry has to name a host or bucket: "/vsicurl/" or "https://" alone would
// let a caller reach anything the server can.
function namesAHost(prefix) {
  let rest = prefix.slice(remotePrefixOf(prefix).length);
  const nestedScheme = REMOTE_PREFIXES.find(
    (candidate) => candidate.includes("://") && rest.startsWith(candidate)
  );
  if (nestedScheme) rest = rest.slice(nestedScheme.length);
  return rest.split("/")[0].length > 0;
}

// Match on a path boundary so "https://cdn.example.gov" cannot also allow
// "https://cdn.example.gov.evil.com/".
function matchesPrefix(datasetPath, prefix) {
  if (!datasetPath.startsWith(prefix)) return false;
  const rest = datasetPath.slice(prefix.length);
  return prefix.endsWith("/") || rest.length === 0 || rest.startsWith("/");
}

// Prefixes an operator opted into via GDAL_ALLOWED_REMOTE_PREFIXES.
function allowedRemotePrefixes() {
  return String(process.env.GDAL_ALLOWED_REMOTE_PREFIXES || "")
    .split(",")
    .map((prefix) => prefix.trim())
    .filter((prefix) => {
      if (prefix.length === 0) return false;
      if (!isRemote(prefix)) {
        logger(
          "warn",
          `Ignoring GDAL_ALLOWED_REMOTE_PREFIXES entry "${prefix}": not a remote GDAL prefix (expected one of ${REMOTE_PREFIXES.join(
            ", "
          )}).`
        );
        return false;
      }
      if (!namesAHost(prefix)) {
        logger(
          "warn",
          `Ignoring GDAL_ALLOWED_REMOTE_PREFIXES entry "${prefix}": it allows any host. Include the host or bucket, e.g. "/vsis3/my-bucket/".`
        );
        return false;
      }
      return true;
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
 * Remote datasets reach GDAL exactly as written (decoding would change which
 * object they address), so raw and decoded forms must both pass the checks.
 *
 * @param {string} rawPath - The raw path string from the request.
 * @returns {{ error: string }|{ decoded: string, resolved: string }}
 */
function validateGdalDatasetPath(rawPath) {
  const raw = String(rawPath);
  const decodeResult = decodePathOnce(raw);
  if (decodeResult.error) return decodeResult;
  const decoded = decodeResult.decoded;

  if (!isRemote(decoded) && !isRemote(raw)) return validateMissionsPath(rawPath);

  const forms = [raw, decoded, fullyDecodePath(raw).decoded];
  const forbidden = (value) => {
    const lowered = value.toLowerCase();
    return FORBIDDEN_TOKENS.some((token) => lowered.includes(token));
  };
  if (forms.some(forbidden)) {
    return { error: "Invalid path: access denied." };
  }

  const allowed = allowedRemotePrefixes();
  const permitted = (value) =>
    allowed.some((prefix) => matchesPrefix(value, prefix));
  if (!forms.every(permitted)) {
    return {
      error:
        "Remote dataset paths are not allowed. Ask a site administrator to allowlist the prefix via GDAL_ALLOWED_REMOTE_PREFIXES.",
    };
  }
  return { decoded, resolved: raw };
}

module.exports = validateGdalDatasetPath;
