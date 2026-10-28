// Earthdata Login (https://urs.earthdata.nasa.gov) as a service connection.
// Register an application with Earthdata Login and set its redirect URI to
// <site>/api/connections/earthdata/callback.
const baseUrl = (env) => (env.EARTHDATA_URL || "https://urs.earthdata.nasa.gov").replace(/\/+$/, "");

const basicAuth = (env) =>
  "Basic " + Buffer.from(`${env.EARTHDATA_CLIENT_ID}:${env.EARTHDATA_CLIENT_SECRET}`).toString("base64");

async function tokenRequest(env, params) {
  const res = await fetch(`${baseUrl(env)}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(env), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.access_token !== "string")
    throw new Error(`Earthdata token request failed (HTTP ${res.status}).`);
  return body;
}

// Earthdata returns the user's profile path as "endpoint" (e.g. /api/users/jdoe)
async function accountName(env, body) {
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const fallback = endpoint ? endpoint.split("/").filter(Boolean).pop() : null;
  if (!endpoint || !endpoint.startsWith("/")) return fallback;
  try {
    const res = await fetch(`${baseUrl(env)}${endpoint}`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    const profile = await res.json();
    return (profile && profile.uid) || fallback;
  } catch (err) {
    return fallback;
  }
}

const grant = async (env, body) => ({
  accessToken: body.access_token,
  refreshToken: body.refresh_token,
  expiresIn: body.expires_in,
  account: await accountName(env, body),
});

module.exports = {
  authorizeUrl({ state, redirectUri, env }) {
    const q = new URLSearchParams({
      client_id: env.EARTHDATA_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `${baseUrl(env)}/oauth/authorize?${q.toString()}`;
  },
  async exchange({ code, redirectUri, env }) {
    return grant(env, await tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: redirectUri }));
  },
  async refresh({ refreshToken, env }) {
    return grant(env, await tokenRequest(env, { grant_type: "refresh_token", refresh_token: refreshToken }));
  },
  async revoke({ accessToken, env }) {
    await fetch(`${baseUrl(env)}/oauth/revoke?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { Authorization: basicAuth(env) },
    });
  },
  validate(env) {
    if (env.EARTHDATA_URL && !/^https?:\/\//.test(env.EARTHDATA_URL))
      return ["EARTHDATA_URL must start with http:// or https://."];
    return [];
  },
};
