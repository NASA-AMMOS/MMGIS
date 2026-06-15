const path = require("path");

const rootDir = `${__dirname}/..`;

/**
 * Validate and decode a path intended to access files under /Missions/.
 * Handles multiple levels of URL encoding, verifies the resolved path
 * stays within the Missions directory (cross-mission ../ is allowed).
 *
 * @param {string} rawPath - The raw path string from the request.
 * @returns {{ error: string }|{ decoded: string, resolved: string }}
 *   On failure: `{ error }` with a user-facing message.
 *   On success: `{ decoded, resolved }` — the fully decoded path and its absolute resolved form.
 */
function validateMissionsPath(rawPath) {
  let decoded = String(rawPath);
  let prev = '';
  while (decoded !== prev) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      return { error: 'Invalid URL encoding in path.' };
    }
  }
  // Normalise: accept both "Missions/…" and "/Missions/…"
  if (!decoded.startsWith('/')) decoded = '/' + decoded;
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

module.exports = validateMissionsPath;
