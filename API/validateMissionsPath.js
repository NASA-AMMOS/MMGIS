const path = require("path");

const rootDir = `${__dirname}/..`;

function decodePathOnce(rawPath) {
  try {
    return { decoded: decodeURIComponent(String(rawPath)) };
  } catch (e) {
    return { error: 'Invalid URL encoding in path.' };
  }
}

// Best-effort repeated decode, only used to spot traversal hidden behind several
// layers of encoding. Stops at the first step that will not decode.
function fullyDecodePath(rawPath) {
  let decoded = String(rawPath);
  let prev = '';
  while (decoded !== prev) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      return { decoded: prev };
    }
  }
  return { decoded };
}

function resolveInMissions(rawDecoded) {
  // Normalise: accept both "Missions/…" and "/Missions/…"
  const decoded = rawDecoded.startsWith('/') ? rawDecoded : '/' + rawDecoded;
  if (!decoded.startsWith('/Missions')) {
    return { error: "Only paths beginning with '/Missions' are supported." };
  }
  const resolved = path.resolve(path.join(rootDir, decoded));
  const allowed = path.resolve(rootDir, 'Missions');
  const normalizedResolved = resolved.replace(/\\/g, '/');
  const normalizedAllowed = allowed.replace(/\\/g, '/');
  if (normalizedResolved !== normalizedAllowed && !normalizedResolved.startsWith(normalizedAllowed + '/')) {
    return { error: 'Invalid path: access denied.' };
  }
  return { decoded, resolved };
}

/**
 * Validate and decode a path intended to access files under /Missions/.
 * Verifies the resolved path stays within the Missions directory (cross-mission
 * ../ is allowed) both once decoded — the form its consumers see — and fully
 * decoded, so traversal cannot hide behind extra layers of encoding.
 *
 * @param {string} rawPath - The raw path string from the request.
 * @returns {{ error: string }|{ decoded: string, resolved: string }}
 *   On failure: `{ error }` with a user-facing message.
 *   On success: `{ decoded, resolved }` — the decoded path and its absolute resolved form.
 */
function validateMissionsPath(rawPath) {
  const once = decodePathOnce(rawPath);
  if (once.error) return once;
  const deep = resolveInMissions(fullyDecodePath(rawPath).decoded);
  if (deep.error) return deep;
  return resolveInMissions(once.decoded);
}

module.exports = validateMissionsPath;
module.exports.fullyDecodePath = fullyDecodePath;
module.exports.decodePathOnce = decodePathOnce;
