// AES-256-GCM for stored service tokens. The key is derived from SECRET, so
// changing SECRET makes stored tokens unreadable and users connect again.
const crypto = require("crypto");

let cachedKey = null;
let cachedFor = null;
function key() {
  const secret = process.env.SECRET || "";
  if (cachedKey && cachedFor === secret) return cachedKey;
  cachedKey = Buffer.from(crypto.hkdfSync("sha256", secret, "mmgis", "mmgis-connections-v1", 32));
  cachedFor = secret;
  return cachedKey;
}

function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

// null when the value can't be read (other SECRET, tampered, malformed)
function open(sealed) {
  try {
    const [v, iv, tag, body] = String(sealed).split(".");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]);
    return JSON.parse(out.toString("utf8"));
  } catch (err) {
    return null;
  }
}

module.exports = { seal, open };
