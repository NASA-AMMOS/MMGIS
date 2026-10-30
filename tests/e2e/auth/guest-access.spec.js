import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Guests on sites that allow them (SITE_ACCESS=public or optional) can browse.
 * They read the shared mission folder only if they can view some mission, and
 * cannot write through adjacent-server proxies.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';
const ADMIN = { username: 'test_admin', password: ['Test', 'Admin', '1!'].join('') };
// Denials are a redirect, a 401/403, or the JSON "Unauthorized" failure the admin gate sends
async function blocked(r) {
  if ([301, 302, 303, 401, 403].includes(r.status())) return true;
  const body = await r.json().catch(() => null);
  return body != null && body.status === 'failure' && /unauthori/i.test(body.message || '');
}

test.describe('Guests on open sites', () => {
  test.skip(
    !['public', 'optional'].includes(process.env.MMGIS_TEST_SITE_ACCESS),
    'SKIP: needs SITE_ACCESS=public or optional'
  );

  test('guests read the shared mission folder only if they can view a mission', async ({ request, playwright }) => {
    const rel = `Data/guest-access-${Date.now()}.json`;
    const file = path.join(process.cwd(), 'Missions', 'shared', rel);
    const url = `${baseURL}/Missions/shared/${rel}`;
    const guestMissions = async () =>
      (((await (await request.get(`${baseURL}/api/configure/missions`)).json().catch(() => null)) || {}).missions || []);
    const admin = await playwright.request.newContext({ baseURL });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"shared":true}');
    let grantId = null;
    try {
      const login = await admin.post('/api/users/login', { data: ADMIN });
      expect((await login.json()).status).toBe('success');
      if ((await guestMissions()).length === 0) {
        expect(await blocked(await request.get(url, { maxRedirects: 0 }))).toBe(true);
        const add = await admin.post('/api/access/bindings/add', {
          data: { subject_type: 'audience', subject_id: 'everyone', role: 'viewer', scope_type: 'mission', mission: 'Reference-Mission' },
        });
        const added = await add.json();
        expect(added.status, JSON.stringify(added)).toBe('success');
        grantId = added.body.id;
      }
      const r = await request.get(url, { maxRedirects: 0 });
      expect(r.status()).toBe(200);
      expect(await r.json()).toEqual({ shared: true });
    } finally {
      if (grantId != null) await admin.post('/api/access/bindings/remove', { data: { id: grantId } });
      await admin.dispose();
      fs.rmSync(file, { force: true });
    }
  });

  for (const path of ['/stac/collections', '/tipg/collections', '/titiler/cog/info', '/titilerpgstac/collections']) {
    test(`guests cannot write through ${path}`, async ({ request }) => {
      const read = await request.get(`${baseURL}${path}`, { maxRedirects: 0 });
      test.skip(read.status() === 404, `${path} is not proxied in this run`);
      for (const method of ['post', 'put', 'delete']) {
        const r = await request[method](`${baseURL}${path}`, { data: {}, maxRedirects: 0 });
        expect(await blocked(r), `${method.toUpperCase()} ${path}: ${r.status()}`).toBe(true);
      }
    });
  }
});
