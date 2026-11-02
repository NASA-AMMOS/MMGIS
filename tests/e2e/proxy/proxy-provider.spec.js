import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';

/**
 * E2E tests for the proxy login provider (AUTH_PROVIDERS=["proxy","local"]), the
 * replacement for AUTH=csso. Run under PROXY_TRUST=network (legacy CSSO behavior)
 * and PROXY_TRUST=secret. Requests carry the headers a reverse proxy would add.
 *
 * Needs PROXY_GROUPS with at least one group and PROXY_LEAD_GROUP set.
 * Skipped unless the proxy provider is enabled.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
const enabled = /"proxy"|\bproxy\b/.test(process.env.AUTH_PROVIDERS || '');
const trust = (process.env.PROXY_TRUST || 'secret').toLowerCase();
const secretHeader = process.env.PROXY_SECRET_HEADER || 'X-MMGIS-Proxy-Secret';
const allowedGroup = enabled && process.env.PROXY_GROUPS ? JSON.parse(process.env.PROXY_GROUPS)[0] : null;
const leadGroup = process.env.PROXY_LEAD_GROUP;
const admin = { username: 'test_admin', password: ['Test', 'Admin', '1!'].join('') };

const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64');

function proxyHeaders(user, groups = { [allowedGroup]: true }, extra = {}) {
  const h = {};
  if (user != null) h['X-Sub'] = user;
  if (groups != null) h['X-Groups'] = typeof groups === 'string' ? groups : b64(groups);
  h['X-Session'] = `proxy-session-${user}`;
  if (trust === 'secret') h[secretHeader] = process.env.PROXY_SECRET;
  return { ...h, ...extra };
}

async function me(request, headers) {
  const res = await request.get(`${baseURL}/api/access/me`, { headers });
  expect(res.status()).toBeLessThan(500);
  if (res.status() !== 200) return { authenticated: false, capabilities: [] };
  const body = await res.json();
  return body.body;
}

test.describe('Proxy login provider', () => {
  test.skip(!enabled, 'SKIP: the proxy login provider is not enabled');

  test('requests without proxy headers are not signed in', async ({ request }) => {
    expect((await me(request, {})).authenticated).toBe(false);
    const missions = await request.get(`${baseURL}/api/configure/missions`);
    expect([401, 403]).toContain(missions.status());
  });

  test('a proxy user in an allowed group is signed in as the X-Sub user', async ({ request }) => {
    const p = await me(request, proxyHeaders('proxy_alice'));
    expect(p.authenticated).toBe(true);
    expect(p.kind).toBe('external');
    expect(p.username).toBe('proxy_alice');
    expect(p.superadmin).toBe(false);
    // Tokens belong to accounts, and this proxy user has none
    expect(p.capabilities).not.toContain('tokens.create');
    const gen = await request.post(`${baseURL}/api/longtermtoken/generate`, {
      headers: proxyHeaders('proxy_alice'),
      data: { name: 'proxyonly', period: '60000' },
    });
    expect(gen.status()).toBeLessThan(500);
    expect((await gen.json()).status).toBe('failure');

    const page = await request.get(`${baseURL}/`, { headers: proxyHeaders('proxy_alice') });
    expect(page.status()).toBe(200);
    expect(await page.text()).not.toContain("isn&apos;t in a group allowed");
  });

  test('a proxy user outside PROXY_GROUPS gets the not-allowed page', async ({ request }) => {
    const page = await request.get(`${baseURL}/`, {
      headers: proxyHeaders('proxy_mallory', { 'not-an-allowed-group': true }),
    });
    const html = await page.text();
    expect(html).toContain('Signed in as proxy_mallory');
    expect(html).toContain("isn&apos;t in a group allowed");
  });

  test('any truthy group value counts as membership; the lead group needs true', async ({ request }) => {
    const truthy = await request.get(`${baseURL}/`, {
      headers: proxyHeaders('proxy_truthy', { [allowedGroup]: 'true' }),
    });
    expect(await truthy.text()).not.toContain("isn&apos;t in a group allowed");

    const check = async (groups) => {
      const res = await request.post(`${baseURL}/api/users/login`, {
        headers: proxyHeaders('proxy_lead', groups),
        data: { useToken: true },
      });
      const body = await res.json();
      expect(body.status).toBe('success');
      expect(body.username).toBe('proxy_lead');
      expect(body.provider).toBe('proxy');
      return body.groups;
    };
    expect(await check({ [allowedGroup]: true, [leadGroup]: true })).toContain('mmgis-group');
    expect(await check({ [allowedGroup]: true, [leadGroup]: 1 })).not.toContain('mmgis-group');
  });

  test('malformed or incomplete proxy headers are not signed in', async ({ request }) => {
    expect((await me(request, proxyHeaders('proxy_bad', '%%%not-base64-json'))).authenticated).toBe(false);
    expect((await me(request, proxyHeaders('', { [allowedGroup]: true }))).authenticated).toBe(false);
    expect((await me(request, proxyHeaders(null, { [allowedGroup]: true }))).authenticated).toBe(false);
  });

  test('the proxy secret is enforced only under PROXY_TRUST=secret', async ({ request }) => {
    const noSecret = { ...proxyHeaders('proxy_bob') };
    delete noSecret[secretHeader];
    const wrongSecret = { ...noSecret, [secretHeader]: 'wrong-proxy-secret' }; // pragma: allowlist secret
    if (trust === 'secret') {
      expect((await me(request, noSecret)).authenticated).toBe(false);
      expect((await me(request, wrongSecret)).authenticated).toBe(false);
      expect((await me(request, proxyHeaders('proxy_bob'))).username).toBe('proxy_bob');
    } else {
      // network: trusts the headers on any request, as AUTH=csso did
      expect((await me(request, noSecret)).username).toBe('proxy_bob');
    }
  });

  test('a local admin signed in behind the proxy keeps the proxy identity, adds admin rights, and owns tokens', async ({ request }) => {
    const headers = proxyHeaders('proxy_carol');
    const login = await request.post(`${baseURL}/api/users/login`, { headers, data: admin });
    expect((await login.json()).status).toBe('success');

    const p = await me(request, headers);
    expect(p.username).toBe('proxy_carol');
    expect(p.superadmin).toBe(true);
    expect(p.capabilities).toContain('tokens.create');

    const name = `proxye2e${Date.now()}`;
    const gen = await request.post(`${baseURL}/api/longtermtoken/generate`, {
      headers,
      data: { name, period: '60000' },
    });
    expect(gen.status()).toBe(200);
    const created = await gen.json();
    expect(created.status).toBe('success');

    const list = await request.get(`${baseURL}/api/longtermtoken/get`, { headers });
    const tokens = (await list.json()).tokens || [];
    const mine = tokens.find((t) => t.name === name);
    expect(mine).toBeTruthy();
    expect(mine.created_by_username).toBe(admin.username);
    if (mine.id != null)
      await request.post(`${baseURL}/api/longtermtoken/clear`, { headers, data: { id: mine.id } });

    // MMGIS logout ends the local account's rights; the proxy identity stays
    await request.post(`${baseURL}/api/users/logout`, { headers });
    const after = await me(request, headers);
    expect(after.username).toBe('proxy_carol');
    expect(after.superadmin).toBe(false);
    expect(after.capabilities).not.toContain('tokens.create');
  });

  test('the migration dry run translates a legacy AUTH=csso env', () => {
    const run = spawnSync(process.execPath, ['scripts/auth-migrate.js', '--dry-run'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        AUTH: 'csso',
        SITE_ACCESS: 'optional',
        AUTH_PROVIDERS: '["local"]',
        PROXY_TRUST: 'secret',
        PROXY_SECRET: '',
      },
      timeout: 60000,
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('dry-run (no changes written)');
    expect(run.stdout).toContain('SITE_ACCESS=required');
    expect(run.stdout).toContain('Legacy AUTH=csso found');
    expect(run.stdout).toContain('PROXY_TRUST=secret is also set but ignored');
  });
});
