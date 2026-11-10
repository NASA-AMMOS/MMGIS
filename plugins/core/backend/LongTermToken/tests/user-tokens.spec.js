import { test, expect } from '@playwright/test';
import http from 'http';

/**
 * API token limits (AUTH_TOKENS, default all): an account without an admin role
 * holds one unexpired token of at most 90 days, replaceable in one step;
 * administrators hold any number of any length.
 * Backend routes: plugins/core/backend/LongTermToken/routes/longtermtokens.js
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
const RUN = Date.now().toString(36);
const ADMIN = { username: 'test_admin', password: ['Test', 'Admin', '1!'].join('') };
const USER = { username: `tokenuser_${RUN}`, password: ['Token', 'Pass', '1!'].join('') };
const DAY = 24 * 60 * 60 * 1000;

// Own loopback source per login keeps the per-address login limiter out of the way
let nextAddress = 10;
const freshAddress = () => {
  const n = nextAddress++;
  return `127.3.${Math.floor(n / 250)}.${(n % 250) + 2}`;
};

function api(who, method, url, body, { bearer, localAddress } = {}) {
  const target = new URL(baseURL + url);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        hostname: localAddress && target.hostname === 'localhost' ? '127.0.0.1' : target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        localAddress,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(who && who.cookie && !bearer ? { Cookie: who.cookie } : {}),
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
      },
      (res) => {
        const setCookie = res.headers['set-cookie'] || [];
        if (who && setCookie.length) who.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (text += d));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (err) {}
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const ok = (r) => r.status === 200 && r.json && r.json.status === 'success';

async function login({ username, password }) {
  const who = {};
  const r = await api(who, 'POST', '/api/users/login', { username, password }, { localAddress: freshAddress() });
  expect(ok(r), `login ${username}: ${r.text.slice(0, 200)}`).toBe(true);
  return who;
}

const generate = (who, body) => api(who, 'POST', '/api/longtermtoken/generate', body);
const list = async (who) => {
  const r = await api(who, 'GET', '/api/longtermtoken/get');
  expect(ok(r)).toBe(true);
  return r.json;
};
const mine = async (who) => {
  const l = await list(who);
  return l.tokens.filter((t) => t.created_by_user_id === l.user_id);
};
const clearAll = async (who) => {
  for (const t of await mine(who)) await api(who, 'POST', '/api/longtermtoken/clear', { id: t.id });
};
// Who a bearer token acts as, or null when it's refused
const actsAs = async (token) => {
  const r = await api(null, 'GET', '/api/access/me', null, { bearer: token });
  return ok(r) && r.json.body.kind === 'token' ? r.json.body.username : null;
};

test.describe.serial('API token limits', () => {
  test.skip(process.env.MMGIS_TEST_SITE_ACCESS === 'public', 'SKIP: needs sign-in');
  test.skip(process.env.AUTH_TOKENS === 'admins', 'SKIP: covers AUTH_TOKENS=all');

  let admin, user;

  test.beforeAll(async () => {
    admin = await login(ADMIN);
    const s = await api(admin, 'POST', '/api/users/signup', { ...USER, skipLogin: true });
    expect(ok(s), `signup: ${s.text.slice(0, 200)}`).toBe(true);
    user = await login(USER);
  });

  test.afterAll(async () => {
    if (user) await clearAll(user);
    if (admin) await clearAll(admin);
  });

  test('a regular account is told its limits', async () => {
    const l = await list(user);
    expect(l.limits).toEqual({ unlimited: false, max_tokens: 1, max_period: 90 * DAY });
    expect((await list(admin)).limits).toEqual({ unlimited: true, max_tokens: null, max_period: null });
  });

  test('a 64-character name is stored while its token prefix fits the column', async () => {
    await clearAll(user);
    const name = 'a'.repeat(64);
    const created = await generate(user, { name, period: String(DAY) });
    expect(ok(created), created.text.slice(0, 200)).toBe(true);

    const [token] = await mine(user);
    expect(token.name).toBe(name);
    expect(token.token.replace(/\.\.\.$/, '').length).toBeLessThanOrEqual(64);
    await clearAll(user);
  });

  test('a regular account cannot make a token that never expires or lasts over 90 days', async () => {
    for (const period of ['never', undefined, String(90 * DAY + 1), String(365 * DAY)]) {
      const r = await generate(user, { name: 'toolong', period });
      expect(r.json.status, `period ${period}`).toBe('failure');
      expect(r.json.message).toMatch(/at most 90 days/);
    }
    expect(await mine(user)).toEqual([]);
  });

  test('a regular account holds one token; a second is refused', async () => {
    const first = await generate(user, { name: 'first', period: String(90 * DAY) });
    expect(ok(first)).toBe(true);
    expect(await actsAs(first.json.body.token)).toBe(USER.username);
    const second = await generate(user, { name: 'second', period: String(DAY) });
    expect(second.json.status).toBe('failure');
    expect(second.json.message).toMatch(/already have an API token/);
    expect((await mine(user)).map((t) => t.name)).toEqual(['first']);
  });

  test('replacing swaps the old token for a new one in one step', async () => {
    const [old] = await mine(user);
    const r = await generate(user, { name: 'replacement', period: String(30 * DAY), replace_id: old.id });
    expect(ok(r), r.text.slice(0, 200)).toBe(true);
    expect((await mine(user)).map((t) => t.name)).toEqual(['replacement']);
    expect(await actsAs(r.json.body.token)).toBe(USER.username);
    // Someone else's token, or one that doesn't exist, can't be replaced
    const adminToken = await generate(admin, { name: 'adminsown', period: String(DAY) });
    expect(ok(adminToken)).toBe(true);
    for (const id of [adminToken.json.body.id, 99999999]) {
      const bad = await generate(user, { name: 'x', period: String(DAY), replace_id: id });
      expect(bad.json.status).toBe('failure');
      expect(bad.json.message).toMatch(/not found/);
    }
    expect(await actsAs(adminToken.json.body.token)).toBe(ADMIN.username);
  });

  test('concurrent requests still leave one token', async () => {
    await clearAll(user);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => generate(user, { name: `race${i}`, period: String(DAY) }))
    );
    expect(results.filter(ok).length).toBe(1);
    expect((await mine(user)).length).toBe(1);
  });

  test("an expired token doesn't count, and is removed when a new one is made", async () => {
    await clearAll(user);
    const short = await generate(user, { name: 'short', period: '1' });
    expect(ok(short)).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(await actsAs(short.json.body.token)).toBe(null);
    const next = await generate(user, { name: 'next', period: String(DAY) });
    expect(ok(next), next.text.slice(0, 200)).toBe(true);
    expect((await mine(user)).map((t) => t.name)).toEqual(['next']);
  });

  test('administrators may hold many tokens, including ones that never expire', async () => {
    await clearAll(admin);
    const made = [];
    for (const period of ['never', String(365 * DAY), String(DAY)]) {
      const r = await generate(admin, { name: `admin${made.length}`, period });
      expect(ok(r), r.text.slice(0, 200)).toBe(true);
      made.push(r.json.body.token);
    }
    expect((await mine(admin)).length).toBe(3);
    for (const t of made) expect(await actsAs(t)).toBe(ADMIN.username);
  });
});
