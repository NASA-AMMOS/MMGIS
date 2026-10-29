/**
 * Unit tests for service connections (API/connections): plugin discovery and
 * validation, token sealing, where connections are stored, grants, setup
 * status, return paths and the standard connection_required reply.
 */

import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');

const secretBox = require('../../API/connections/secretBox');
const connections = require('../../API/connections');

const CORE_PLUGINS = path.join(__dirname, '..', '..', 'plugins');

function writePlugin(root, container, name, manifest, js) {
    const dir = path.join(root, container, 'connections', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir, 'plugin.js'), js);
}

const GOOD_JS = `module.exports = {
    authorizeUrl: ({ state }) => 'https://svc.example/auth?state=' + state,
    exchange: async () => ({ accessToken: 'a' }),
    validate: (env) => (env.BAD ? ['BAD is set'] : []),
};`;

test.describe('secretBox', () => {
    const saved = process.env.SECRET;
    test.afterEach(() => {
        process.env.SECRET = saved;
    });

    test('round-trips and never contains the plaintext', () => {
        process.env.SECRET = 'a'.repeat(32);
        const sealed = secretBox.seal({ accessToken: 'tok-123' });
        expect(sealed.startsWith('v1.')).toBe(true);
        expect(sealed).not.toContain('tok-123');
        expect(secretBox.open(sealed)).toEqual({ accessToken: 'tok-123' });
    });

    test('uses a fresh IV each time', () => {
        process.env.SECRET = 'a'.repeat(32);
        expect(secretBox.seal({ x: 1 })).not.toBe(secretBox.seal({ x: 1 }));
    });

    test('returns null for a different SECRET, tampering or junk', () => {
        process.env.SECRET = 'a'.repeat(32);
        const sealed = secretBox.seal({ accessToken: 'tok' });
        const parts = sealed.split('.');
        const body = Buffer.from(parts[3], 'base64');
        body[0] ^= 1;
        const tampered = [parts[0], parts[1], parts[2], body.toString('base64')].join('.');
        expect(secretBox.open(tampered)).toBeNull();
        expect(secretBox.open('v2.' + parts.slice(1).join('.'))).toBeNull();
        expect(secretBox.open('nope')).toBeNull();
        expect(secretBox.open(null)).toBeNull();
        process.env.SECRET = 'b'.repeat(32);
        expect(secretBox.open(sealed)).toBeNull();
    });
});

test.describe('loadConnections', () => {
    let root;
    test.beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-connections-'));
    });
    test.afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        connections.loadConnections(CORE_PLUGINS);
    });

    test('loads valid plugins and refuses bad ones', () => {
        writePlugin(root, 'a', 'Good', { type: 'connection', connection: 'Good', display_name: 'Good Svc', guests: true, env: ['GOOD_ID'] }, GOOD_JS);
        writePlugin(root, 'b', 'Dup', { type: 'connection', connection: 'good' }, GOOD_JS);
        writePlugin(root, 'a', 'NoId', { type: 'connection' }, GOOD_JS);
        writePlugin(root, 'a', 'BadId', { type: 'connection', connection: '1bad id' }, GOOD_JS);
        writePlugin(root, 'a', 'NoHooks', { type: 'connection', connection: 'nohooks' }, 'module.exports = { exchange() {} }');
        writePlugin(root, 'a', 'Throws', { type: 'connection', connection: 'throws' }, 'throw new Error("boom")');
    writePlugin(root, 'a', 'LongId', { type: 'connection', connection: 'x'.repeat(65) }, GOOD_JS);
    writePlugin(root, 'a', 'BadName', { type: 'connection', connection: 'badname', display_name: { en: 'x' } }, GOOD_JS);
    writePlugin(root, 'a', 'BadEnv', { type: 'connection', connection: 'badenv', env: ['X', 5] }, GOOD_JS);
    writePlugin(root, 'a', 'BadFlags', { type: 'connection', connection: 'badflags', guests: 'yes', pkce: 1 }, GOOD_JS);

        const ids = connections.loadConnections(root);
        expect(ids).toEqual(['good']);
        const c = connections.getConnection('GOOD');
        expect(c.label).toBe('Good Svc');
        expect(c.guests).toBe(true);
        expect(c.env).toEqual(['GOOD_ID']);
        expect(c.ref).toBe('a/connections/Good');
        expect(connections.getConnection('nohooks')).toBeNull();
        expect(connections.getConnection(42)).toBeNull();
    });

    test('guests default to off', () => {
        writePlugin(root, 'a', 'Svc', { type: 'connection', connection: 'svc' }, GOOD_JS);
        connections.loadConnections(root);
        expect(connections.getConnection('svc').guests).toBe(false);
    });

    test('setupStatus reports missing env and validate() problems', () => {
        writePlugin(root, 'a', 'Svc', { type: 'connection', connection: 'svc', env: ['SVC_ID', 'SVC_SECRET'] }, GOOD_JS);
        connections.loadConnections(root);
        const c = connections.getConnection('svc');
        expect(connections.setupStatus(c, {})).toEqual({ configured: false, missingEnv: ['SVC_ID', 'SVC_SECRET'], problems: [] });
        expect(connections.setupStatus(c, { SVC_ID: 'x', SVC_SECRET: 'y' }).configured).toBe(true);
        const bad = connections.setupStatus(c, { SVC_ID: 'x', SVC_SECRET: 'y', BAD: '1' });
        expect(bad.configured).toBe(false);
        expect(bad.problems).toEqual(['BAD is set']);
    });

    test('validate() and warnings() must be synchronous, and their text is scrubbed of env secrets', () => {
    writePlugin(
      root,
      'a',
      'Leaky',
      { type: 'connection', connection: 'leaky', env: ['LEAKY_SECRET'] },
      `module.exports = {
    authorizeUrl: () => 'https://svc.example/',
    exchange: async () => ({ accessToken: 'a' }),
    validate: (env) => ['secret is ' + env.LEAKY_SECRET],
};`,
    );
    writePlugin(
      root,
      'a',
      'Async',
      { type: 'connection', connection: 'async' },
      `module.exports = {
    authorizeUrl: () => 'https://svc.example/',
    exchange: async () => ({ accessToken: 'a' }),
    validate: async () => [],
};`,
    );
    connections.loadConnections(root);
    const leaky = connections.setupStatus(connections.getConnection('leaky'), {
      LEAKY_SECRET: 'hunter2-very-secret', // pragma: allowlist secret
    });
    expect(leaky.configured).toBe(false);
    expect(JSON.stringify(leaky.problems)).not.toContain('hunter2-very-secret');
    const async = connections.setupStatus(connections.getConnection('async'), {});
    expect(async.configured).toBe(false);
    expect(async.problems[0]).toContain('not a Promise');
  });

  test('startupWarnings stays quiet for a connection that is simply not set up', () => {
        writePlugin(root, 'a', 'Svc', { type: 'connection', connection: 'svc', env: ['SVC_ID', 'SVC_SECRET'] }, GOOD_JS);
        connections.loadConnections(root);
        expect(connections.startupWarnings({})).toEqual([]);
        expect(connections.startupWarnings({ SVC_ID: 'x' })).toEqual([
            "Connection 'svc': SVC_SECRET is not set, so users can't connect it.",
        ]);
    });
});

test.describe('core connections', () => {
    test('core ships the connections folder but no connection plugins', () => {
        expect(fs.existsSync(path.join(CORE_PLUGINS, 'core', 'connections'))).toBe(true);
        connections.loadConnections(CORE_PLUGINS);
        const found = connections.allConnections().filter((c) => c.ref.startsWith('core/'));
        expect(found).toEqual([]);
    });
});

test.describe('storageFor', () => {
    const guestsOk = { guests: true };
    const guestsNo = { guests: false };
    test('accounts persist, sessions and allowed guests are session-only, tokens never', () => {
        expect(connections.storageFor({ kind: 'user', userId: 3 }, guestsNo)).toBe('account');
        expect(connections.storageFor({ kind: 'user', userId: null }, guestsNo)).toBeNull();
        expect(connections.storageFor({ kind: 'external' }, guestsNo)).toBe('session');
        expect(connections.storageFor({ kind: 'anonymous' }, guestsOk)).toBe('session');
        expect(connections.storageFor({ kind: 'anonymous' }, guestsNo)).toBeNull();
        expect(connections.storageFor({ kind: 'token', userId: 3 }, guestsOk)).toBeNull();
        expect(connections.storageFor({ kind: 'invalid_token' }, guestsOk)).toBeNull();
        expect(connections.storageFor(null, guestsOk)).toBeNull();
    });
});

test.describe('grantRecord', () => {
    test('needs an access token', () => {
        expect(() => connections.grantRecord(null)).toThrow();
        expect(() => connections.grantRecord({ accessToken: '' })).toThrow();
    });
    test('turns expiresIn into an expiry time and trims the account', () => {
        const before = Date.now();
        const r = connections.grantRecord({ accessToken: 'a', refreshToken: 'r', expiresIn: 3600, account: 'x'.repeat(300) });
        const at = new Date(r.expiresAt).getTime();
        expect(at).toBeGreaterThanOrEqual(before + 3600 * 1000 - 5);
        expect(at).toBeLessThanOrEqual(Date.now() + 3600 * 1000 + 5);
        expect(r.refreshToken).toBe('r');
        expect(r.account.length).toBe(255);
    });
    test('refuses oversized tokens', () => {
    expect(() => connections.grantRecord({ accessToken: 'a'.repeat(64 * 1024 + 1) })).toThrow();
    expect(() =>
      connections.grantRecord({
        accessToken: 'a',
        refreshToken: 'r'.repeat(64 * 1024 + 1),
      }),
    ).toThrow();
    expect(connections.grantRecord({ accessToken: 'a'.repeat(64 * 1024) }).accessToken.length).toBe(64 * 1024);
  });
  test('prefers expiresIn over expiresAt and drops expiries already in the past', () => {
    const r = connections.grantRecord({
      accessToken: 'a',
      expiresIn: 60,
      expiresAt: Date.now() - 3600 * 1000,
    });
    expect(new Date(r.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(
      connections.grantRecord({
        accessToken: 'a',
        expiresAt: Date.now() - 1000,
      }).expiresAt,
    ).toBeNull();
    expect(connections.grantRecord({ accessToken: 'a', expiresAt: { at: 5 } }).expiresAt).toBeNull();
    expect(connections.grantRecord({ accessToken: 'a', expiresAt: true }).expiresAt).toBeNull();
  });
  test('ignores bad expiry values', () => {
        expect(connections.grantRecord({ accessToken: 'a', expiresAt: 'not a date' }).expiresAt).toBeNull();
        expect(connections.grantRecord({ accessToken: 'a', expiresIn: -5 }).expiresAt).toBeNull();
        expect(connections.grantRecord({ accessToken: 'a', refreshToken: 7 }).refreshToken).toBeNull();
    });
});

test.describe('withTimeout', () => {
  test('fails a hook that never settles and passes through one that does', async () => {
    await expect(connections.withTimeout(new Promise(() => {}), 'refresh()', 50)).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
    await expect(connections.withTimeout(Promise.resolve(3), 'x', 50)).resolves.toBe(3);
    await expect(connections.withTimeout(4, 'x', 50)).resolves.toBe(4);
    const t = await connections.withTimeout(new Promise(() => {}), 'refresh()', 50).catch((e) => e);
    expect(connections.isTransient(t)).toBe(true);
  });
});

test.describe('sameOriginOnly', () => {
  const run = (headers) => {
    let status = 200;
    let passed = false;
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const req = {
      get: (h) => lower[h.toLowerCase()],
      protocol: 'https',
      headers: lower,
    };
    const res = {
      status(c) {
        status = c;
        return this;
      },
      send() {
        return this;
      },
    };
    connections.sameOriginOnly(req, res, () => (passed = true));
    return passed ? 200 : status;
  };
  test('refuses cross-site requests and allows same-origin ones', () => {
    expect(run({ host: 'mmgis.example' })).toBe(200);
    expect(
      run({
        host: 'mmgis.example',
        origin: 'https://mmgis.example',
        'sec-fetch-site': 'same-origin',
      }),
    ).toBe(200);
    expect(run({ host: 'mmgis.example', origin: 'https://evil.example' })).toBe(403);
    expect(run({ host: 'mmgis.example', 'sec-fetch-site': 'cross-site' })).toBe(403);
    expect(run({ host: 'mmgis.example', origin: 'null' })).toBe(403);
  });
});

test.describe('sameSitePath', () => {
    test('keeps same-site paths and refuses everything else', () => {
        expect(connections.sameSitePath('/?mission=Test&s=1')).toBe('/?mission=Test&s=1');
        for (const bad of ['https://evil.example/', '//evil.example', '/\\evil.example', 'relative', '/a b', null, 5, '/' + 'a'.repeat(3000)]) {
            expect(connections.sameSitePath(bad)).toBe('/');
        }
    });
});

test.describe('connectionRequired', () => {
    test('sends the standard reply', () => {
        const res = {
            statusCode: 200,
            status(c) {
                this.statusCode = c;
                return this;
            },
            json(b) {
                this.body = b;
                return this;
            },
            send(b) {
                this.body = b;
                return this;
            },
        };
        connections.connectionRequired(res, new connections.ConnectionRequiredError('earthdata', 'not_connected'));
        expect(res.body).toMatchObject({ status: 'failure', code: 'connection_required', service: 'earthdata', reason: 'not_connected' });
        expect(typeof res.body.message).toBe('string');
    });
});

test.describe('session connections belong to the identity that made them', () => {
    const c = { id: 'svc', label: 'Svc', guests: true };
    const guest = { kind: 'anonymous' };
    const alice = { kind: 'external', provider: 'sso', username: 'alice' };
    const bob = { kind: 'external', provider: 'sso', username: 'bob' };
    let saved;
    test.beforeAll(() => {
        saved = process.env.SECRET;
        process.env.SECRET = 'b'.repeat(32);
    });
    test.afterAll(() => {
        if (saved === undefined) delete process.env.SECRET;
        else process.env.SECRET = saved;
    });
    const rec = { accessToken: 'at', account: 'x' };

    test('ownerKey', () => {
        expect(connections.ownerKey(guest)).toBe('guest');
        expect(connections.ownerKey(null)).toBe('guest');
        expect(connections.ownerKey(alice)).toBe('external:sso:alice');
        expect(connections.ownerKey({ kind: 'user', userId: 4 })).toBe('user:4');
        expect(connections.ownerKey({ kind: 'invalid_token' })).toBeNull();
    });

    test('another external identity in the same session does not get it', async () => {
        const req = { session: {} };
        await connections.writeStored(req, alice, c, rec);
        expect((await connections.readStored(req, alice, c)).accessToken).toBe('at');
        expect(await connections.readStored(req, bob, c)).toBeNull();
        expect(req.session.connections.svc).toBeUndefined();
        expect(await connections.readStored(req, alice, c)).toBeNull();
    });

    test('a guest does not get a signed-in identity\'s connection after sign-out', async () => {
        const req = { session: {} };
        await connections.writeStored(req, alice, c, rec);
        expect(await connections.readStored(req, guest, c)).toBeNull();
    });

    test("an external identity does not take over a guest's connection", async () => {
        const req = { session: {} };
        await connections.writeStored(req, guest, c, rec);
        expect((await connections.readStored(req, guest, c)).accessToken).toBe('at');
        expect(await connections.readStored(req, alice, c)).toBeNull();
        expect(await connections.readStored(req, bob, c)).toBeNull();
        expect((await connections.readStored(req, guest, c)).accessToken).toBe('at');
    });

    test('sign-in only adopts guest-owned session connections', async () => {
        const req = { session: {} };
        await connections.writeStored(req, alice, c, rec);
        await connections.adoptSessionConnections(req, { kind: 'user', userId: 9 });
        expect(req.session.connections).toBeUndefined();
    });
});

test.describe('routes follow ROOT_PATH', () => {
    test('mounted under the root path only', async () => {
        const express = require('express');
        const app = express();
        const allow = () => (req, res, next) => next();
        allow.public = allow;
        allow.inHandler = allow;
        connections.mountConnectionRoutes(app, { registerRouter: (p, r) => r, authorize: allow, rootPath: '/MMGIS' });
        const server = app.listen(0);
        try {
            const base = `http://127.0.0.1:${server.address().port}`;
            expect((await fetch(`${base}/MMGIS/api/connections/setup`)).status).toBe(200);
            expect((await fetch(`${base}/api/connections/setup`)).status).toBe(404);
            expect(connections.sameSitePath('//evil')).toBe('/MMGIS/');
        } finally {
            server.close();
            connections.mountConnectionRoutes(express(), { registerRouter: (p, r) => r, authorize: allow, rootPath: '' });
        }
    });
});

test.describe('token refresh', () => {
    let root;
    let saved;
    const REFRESH_JS = `module.exports = {
    authorizeUrl: ({ state }) => 'https://svc.example/auth?state=' + state,
    exchange: async () => ({ accessToken: 'a' }),
    refresh: async ({ refreshToken }) => {
        const t = globalThis.__refreshTest;
        t.calls.push(refreshToken);
        await new Promise((r) => setTimeout(r, t.delay || 20));
        if (t.fail) throw t.fail;
        if (t.spent && t.spent.has(refreshToken)) throw Object.assign(new Error('invalid_grant'), { status: 400 });
        if (t.spent) t.spent.add(refreshToken);
        return { accessToken: t.sameAccess || 'fresh-' + t.calls.length, refreshToken: t.keep ? refreshToken : refreshToken + '-next', expiresIn: 3600 };
    },
};`;
    test.beforeAll(() => {
        saved = process.env.SECRET;
        process.env.SECRET = 'c'.repeat(32);
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-connections-'));
        writePlugin(root, 't', 'Svc', { type: 'connection', connection: 'svc', guests: true }, REFRESH_JS);
        connections.loadConnections(root);
    });
    test.afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
        connections.loadConnections(CORE_PLUGINS);
        if (saved === undefined) delete process.env.SECRET;
        else process.env.SECRET = saved;
    });
    test.beforeEach(() => {
        globalThis.__refreshTest = { calls: [], fail: null };
    });
    const guestReq = () => ({ principal: { kind: 'anonymous' }, session: {}, sessionID: 'sess-1' });
    async function stored(req, grant) {
        const c = connections.getConnection('svc');
        const record = connections.grantRecord(grant);
    // Stored grants can be past their expiry; grantRecord drops those only for fresh grants
    if (grant.expiresAt != null) record.expiresAt = new Date(grant.expiresAt).toISOString();
    await connections.writeStored(req, req.principal, c, { ...record, ...grant.extra });
        return req;
    }

    test('a short-lived token is not refreshed on every call', async () => {
        const req = await stored(guestReq(), { accessToken: 'a', refreshToken: 'short', expiresIn: 30 });
        expect(await connections.token(req, 'svc')).toBe('a');
        expect(globalThis.__refreshTest.calls).toEqual([]);
    });

    test('parallel requests share one refresh of a rotating token', async () => {
        const first = await stored(guestReq(), { accessToken: 'old', refreshToken: 'rot', expiresIn: 1 });
        await new Promise((r) => setTimeout(r, 1100));
        // Each request has its own copy of the session, as with express-session
        const reqs = Array.from({ length: 6 }, () => ({ ...guestReq(), session: JSON.parse(JSON.stringify(first.session)) }));
        const tokens = await Promise.all(reqs.map((r) => connections.token(r, 'svc')));
        expect(globalThis.__refreshTest.calls).toEqual(['rot']);
        expect(new Set(tokens)).toEqual(new Set(['fresh-1']));
    });

    test('parallel refreshes that keep the access token but rotate the refresh token share one refresh', async () => {
        Object.assign(globalThis.__refreshTest, { sameAccess: 'A', spent: new Set() });
        const first = await stored(guestReq(), { accessToken: 'A', refreshToken: 'rot2', expiresIn: 1 });
        await new Promise((r) => setTimeout(r, 1100));
        const reqs = Array.from({ length: 4 }, () => ({ ...guestReq(), session: JSON.parse(JSON.stringify(first.session)) }));
        const tokens = await Promise.all(reqs.map((r) => connections.token(r, 'svc')));
        expect(globalThis.__refreshTest.calls).toEqual(['rot2']);
        expect(new Set(tokens)).toEqual(new Set(['A']));
        reqs.forEach((r) => expect(r.session.connections.svc).toBeTruthy());
    });

    test('a burst of rejections shares one refresh when the access token stays the same', async () => {
        Object.assign(globalThis.__refreshTest, { sameAccess: 'A', spent: new Set() });
        const first = await stored(guestReq(), { accessToken: 'A', refreshToken: 'burst', expiresIn: 3600 });
        const copy = (r) => ({ ...guestReq(), session: JSON.parse(JSON.stringify(r.session)) });
        const reqs = Array.from({ length: 10 }, () => copy(first));
        const tokens = await Promise.all(reqs.map((r) => connections.rejected(r, 'svc', 'A')));
        // Late ones, holding the old grant or the rotated one, share it too
        tokens.push(await connections.rejected(copy(first), 'svc', 'A'));
        tokens.push(await connections.rejected(copy(reqs[0]), 'svc', 'A'));
        expect(globalThis.__refreshTest.calls).toEqual(['burst']);
        expect(new Set(tokens)).toEqual(new Set(['A']));
        reqs.forEach((r) => expect(r.session.connections.svc).toBeTruthy());
    });

    test('a reconnect is not replaced by a cached or in-flight refresh of the old grant', async () => {
        Object.assign(globalThis.__refreshTest, { sameAccess: 'A', spent: new Set() });
        const c = connections.getConnection('svc');
        const req = await stored({ ...guestReq(), sessionID: 'sess-reconnect' }, { accessToken: 'A', refreshToken: 'R1', expiresIn: 3600 });
        expect(await connections.rejected(req, 'svc', 'A')).toBe('A');
        // The user reconnects (as the callback does) and the service hands back the same access token
        const reconnect = async (refreshToken) => {
            connections.forgetRefreshes(req, req.principal, c);
            await connections.writeStored(req, req.principal, c, connections.grantRecord({ accessToken: 'A', refreshToken, expiresIn: 3600 }));
        };
        await reconnect('R3');
        expect(await connections.rejected(req, 'svc', 'A')).toBe('A');
        expect(globalThis.__refreshTest.calls).toEqual(['R1', 'R3']);
        expect((await connections.current(req, 'svc')).record.refreshToken).toBe('R3-next');
        // A refresh still running when the user reconnects doesn't overwrite the new grant
        await reconnect('R5');
        globalThis.__refreshTest.delay = 300;
        const running = connections.rejected(req, 'svc', 'A');
        await expect.poll(() => globalThis.__refreshTest.calls.length, { timeout: 250, intervals: [5] }).toBe(3);
        expect(globalThis.__refreshTest.calls).toEqual(['R1', 'R3', 'R5']);
        await reconnect('R7');
        await running;
        expect((await connections.current(req, 'svc')).record.refreshToken).toBe('R7');
    });

    test('a guest refresh that outlasts the response is saved to the stored session', async () => {
        Object.assign(globalThis.__refreshTest, { delay: 2600, spent: new Set() });
        // A minimal express-session: each request loads its own copy, save() writes it back
        const store = {};
        const request = (id) => {
            const req = { principal: { kind: 'anonymous' }, sessionID: id, res: { headersSent: false } };
            const load = () => {
                req.session = JSON.parse(store[id] || '{}');
                req.session.save = (cb) => { store[id] = JSON.stringify(req.session); if (cb) cb(); };
                req.session.reload = (cb) => { load(); if (cb) cb(); };
            };
            load();
            return req;
        };
        const first = request('sess-late');
        await stored(first, {
            accessToken: 'a', refreshToken: 'L1', expiresIn: 3600,
            expiresAt: Date.now() + 5000, extra: { issuedAt: new Date(Date.now() - 3600 * 1000).toISOString() },
        });
        first.session.save();
        const req = request('sess-late');
        // The token still works for 5 s, so the request gets it after 2 s and the refresh carries on
        expect(await connections.token(req, 'svc')).toBe('a');
        req.res.headersSent = true;
        req.session.save();
        await new Promise((r) => setTimeout(r, 1200));
        expect(globalThis.__refreshTest.calls).toEqual(['L1']);
        expect((await connections.current(request('sess-late'), 'svc')).record.refreshToken).toBe('L1-next');
    });

    test('a session copy saved after Disconnect stays disconnected past ten minutes', async () => {
        const c = connections.getConnection('svc');
        const req = await stored({ ...guestReq(), sessionID: 'sess-gone' }, { accessToken: 'g', refreshToken: 'G1', expiresIn: 3600 });
        const before = JSON.parse(JSON.stringify(req.session));
        await connections.removeStored(req, req.principal, c);
        const realNow = Date.now;
        try {
            Date.now = () => realNow() + 11 * 60 * 1000;
            // A later Disconnect in another session tidies up old ones
            const other = await stored({ ...guestReq(), sessionID: 'sess-other' }, { accessToken: 'o', refreshToken: 'O1', expiresIn: 3600 });
            await connections.removeStored(other, other.principal, c);
            // A request that began before the Disconnect saved its copy of the session afterwards
            await expect(connections.current({ ...guestReq(), sessionID: 'sess-gone', session: before }, 'svc')).rejects.toThrow(/Connect/);
        } finally {
            Date.now = realNow;
        }
    });

    test('a rejection during an expiry refresh shares it', async () => {
        const first = await stored(guestReq(), { accessToken: 'old', refreshToken: 'mid', expiresIn: 1 });
        await new Promise((r) => setTimeout(r, 1100));
        const copy = () => ({ ...guestReq(), session: JSON.parse(JSON.stringify(first.session)) });
        const out = await Promise.all([connections.token(copy(), 'svc'), connections.rejected(copy(), 'svc', 'old')]);
        expect(globalThis.__refreshTest.calls).toEqual(['mid']);
        expect(out).toEqual(['fresh-1', 'fresh-1']);
    });

    test('the callback URL keeps a trusted proxy X-Forwarded-Port', () => {
        const c = connections.getConnection('svc');
        const req = (headers, trusted = true) => ({
            protocol: 'http',
            host: headers.host,
            get: (n) => headers[n.toLowerCase()],
            app: { get: () => () => trusted },
            socket: { remoteAddress: '127.0.0.1' }
        });
        expect(connections.callbackUrl(req({ host: 'localhost', 'x-forwarded-port': '8080' }), c)).toBe('http://localhost:8080/api/connections/svc/callback');
        expect(connections.callbackUrl(req({ host: 'localhost:9000', 'x-forwarded-port': '8080' }), c)).toBe('http://localhost:9000/api/connections/svc/callback');
        expect(connections.callbackUrl(req({ host: 'localhost', 'x-forwarded-port': '80' }), c)).toBe('http://localhost/api/connections/svc/callback');
        expect(connections.callbackUrl(req({ host: 'localhost', 'x-forwarded-port': '8080' }, false), c)).toBe('http://localhost/api/connections/svc/callback');
        expect(connections.callbackUrl(req({ host: 'localhost', 'x-forwarded-port': 'x' }), c)).toBe('http://localhost/api/connections/svc/callback');
    });

    test('a non-Error plugin failure is pattern-redacted too', () => {
        const out = connections.scrubbed({ body: 'access_token=zzz&x=1' }, []);
        expect(out).not.toContain('zzz');
    });

    test('a still-valid token is not held up by a slow early refresh', async () => {
    globalThis.__refreshTest.delay = 4000;
    const req = await stored(guestReq(), {
      accessToken: 'still',
      refreshToken: 'slow',
      expiresIn: 30,
    });
    const c = connections.getConnection('svc');
    // within the early-refresh window but not yet expired
    const rec = await connections.readStored(req, req.principal, c);
    rec.expiresAt = new Date(Date.now() + 20 * 1000).toISOString();
    rec.issuedAt = new Date(Date.now() - 3600 * 1000).toISOString();
    await connections.writeStored(req, req.principal, c, rec);
    const start = Date.now();
    expect(await connections.token(req, 'svc')).toBe('still');
    expect(Date.now() - start).toBeLessThan(3000);
    expect(globalThis.__refreshTest.calls).toEqual(['slow']);
  });

  test('a network error keeps the connection; a refused refresh drops it', async () => {
        const req = await stored(guestReq(), { accessToken: 'x', refreshToken: 'net', expiresAt: Date.now() - 1000 });
        globalThis.__refreshTest.fail = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
        await expect(connections.token(req, 'svc')).rejects.toMatchObject({ reason: 'unavailable' });
        expect(req.session.connections.svc).toBeTruthy();
        // A failed refresh is shared for a few seconds; start the next one now
        connections.forgetRefreshes(req, req.principal, connections.getConnection('svc'));
        globalThis.__refreshTest.fail = Object.assign(new Error('invalid_grant'), { status: 400 });
        await expect(connections.token(req, 'svc')).rejects.toMatchObject({ reason: 'expired' });
        expect(req.session.connections.svc).toBeUndefined();
    });

    test('rejecting a just-refreshed token refreshes again when the refresh token does not rotate', async () => {
        globalThis.__refreshTest.keep = true;
        const req = await stored(guestReq(), { accessToken: 'A', refreshToken: 'keep1', expiresIn: 3600 });
        expect(await connections.rejected(req, 'svc', 'A')).toBe('fresh-1');
        expect(await connections.rejected(req, 'svc', 'fresh-1')).toBe('fresh-2');
        expect(globalThis.__refreshTest.calls).toEqual(['keep1', 'keep1']);
    });

    test('logged plugin errors have known secrets and credential patterns removed', () => {
        const e = connections.scrubbed(new Error('exchange for code abc123def failed'), ['abc123def', null, '']);
        expect(e.message).toBe('exchange for code _redacted_ failed');
        expect(e.stack).not.toContain('abc123def'); // pragma: allowlist secret
        const { redactCredentials } = require('../../API/logger');
        expect(redactCredentials('GET /t?code=xyz&state=1 {"refresh_token":"rrr"} Bearer eyJ.a.b code: ECONNRESET')).toBe(
            'GET /t?code=_redacted_&state=1 {"refresh_token":"_redacted_"} Bearer _redacted_ code: ECONNRESET'
        );
    });

    test('isTransient', () => {
        expect(connections.isTransient(Object.assign(new TypeError('fetch failed')))).toBe(true);
        expect(connections.isTransient({ status: 503 })).toBe(true);
        expect(connections.isTransient({ status: 429 })).toBe(true);
        expect(connections.isTransient({ status: 401 })).toBe(false);
        expect(connections.isTransient(Object.assign(new Error('x'), { transient: true }))).toBe(true);
        expect(connections.isTransient(Object.assign(new Error('x'), { status: 503, transient: false }))).toBe(false);
        expect(connections.isTransient(new Error('bad'))).toBe(false);
    });

    test('rejected() refreshes a token the service refused, or asks to reconnect', async () => {
        const req = await stored(guestReq(), { accessToken: 'valid', refreshToken: 'rej', expiresIn: 3600 });
        expect(await connections.rejected(req, 'svc', 'valid')).toBe('fresh-1');
        // An already-replaced token just returns the current one
        expect(await connections.rejected(req, 'svc', 'valid')).toBe('fresh-1');
        const noRefresh = await stored(guestReq(), { accessToken: 'only', expiresIn: 3600 });
        await expect(connections.rejected(noRefresh, 'svc', 'only')).rejects.toMatchObject({ reason: 'rejected' });
        expect(noRefresh.session.connections.svc).toBeUndefined();
    });

    test('unavailable() and not_connected use the connection label', async () => {
        const err = connections.unavailable('svc');
        expect(err).toBeInstanceOf(connections.ConnectionRequiredError);
        expect(err).toMatchObject({ service: 'svc', reason: 'unavailable' });
        expect(err.message).not.toMatch(/^svc /);
        expect(connections.unavailable('svc', 'Down for maintenance').message).toBe('Down for maintenance');
        await expect(connections.token(guestReq(), 'svc')).rejects.toMatchObject({ reason: 'not_connected' });
    });
});

test.describe('PKCE', () => {
    test('with "pkce": true, exchange() gets the verifier for the challenge sent to authorizeUrl()', async () => {
        const crypto = require('crypto');
        const express = require('express');
        const session = require('express-session');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-connections-'));
        writePlugin(root, 't', 'Pk', { type: 'connection', connection: 'pk', guests: true, pkce: true }, `module.exports = {
    authorizeUrl: ({ state, codeChallenge, codeChallengeMethod }) =>
        'https://svc.example/auth?' + new URLSearchParams({ state, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod }),
    exchange: async ({ codeVerifier }) => { globalThis.__pkceVerifier = codeVerifier; return { accessToken: 'a' } },
};`);
        const saved = process.env.SECRET;
        process.env.SECRET = 'd'.repeat(32);
        connections.loadConnections(root);
        const app = express();
        app.set('views', path.join(__dirname, '..', '..', 'views'));
        app.set('view engine', 'pug');
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true })); // pragma: allowlist secret
        app.use((req, res, next) => {
            req.principal = { kind: 'anonymous' };
            next();
        });
        const allow = () => (req, res, next) => next();
        allow.public = allow;
        allow.inHandler = allow;
        connections.mountConnectionRoutes(app, { registerRouter: (p, r) => r, authorize: allow, rootPath: '' });
        const server = app.listen(0);
        try {
            const base = `http://127.0.0.1:${server.address().port}`;
            const start = await fetch(`${base}/api/connections/pk/connect`, { redirect: 'manual' });
            const cookie = start.headers.get('set-cookie').split(';')[0];
            const to = new URL(start.headers.get('location'));
            expect(to.searchParams.get('code_challenge_method')).toBe('S256');
            const back = await fetch(`${base}/api/connections/pk/callback?state=${to.searchParams.get('state')}&code=c1`, { headers: { cookie } });
            expect(back.status).toBe(200);
            const v = globalThis.__pkceVerifier;
            expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(crypto.createHash('sha256').update(v).digest('base64url')).toBe(to.searchParams.get('code_challenge'));
        } finally {
            server.close();
            fs.rmSync(root, { recursive: true, force: true });
            connections.loadConnections(CORE_PLUGINS);
            if (saved === undefined) delete process.env.SECRET;
            else process.env.SECRET = saved;
        }
    });
});

test.describe('authorization request checks', () => {
    async function withApp(manifest, js, fn) {
        const express = require('express');
        const session = require('express-session');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-connections-'));
        writePlugin(root, 't', 'Ar', { type: 'connection', connection: 'ar', guests: true, ...manifest }, js);
        const saved = process.env.SECRET;
        process.env.SECRET = 'd'.repeat(32);
        connections.loadConnections(root);
        const app = express();
        app.set('views', path.join(__dirname, '..', '..', 'views'));
        app.set('view engine', 'pug');
        app.use(session({ secret: 'test', resave: false, saveUninitialized: true })); // pragma: allowlist secret
        app.use((req, res, next) => {
            req.principal = { kind: 'anonymous' };
            next();
        });
        const allow = () => (req, res, next) => next();
        allow.public = allow;
        allow.inHandler = allow;
        connections.mountConnectionRoutes(app, { registerRouter: (p, r) => r, authorize: allow, rootPath: '' });
        const server = app.listen(0);
        try {
            await fn(`http://127.0.0.1:${server.address().port}`);
        } finally {
            server.close();
            fs.rmSync(root, { recursive: true, force: true });
            connections.loadConnections(CORE_PLUGINS);
            if (saved === undefined) delete process.env.SECRET;
            else process.env.SECRET = saved;
        }
    }
    const echoJs = (params) => `module.exports = {
    authorizeUrl: (a) => 'https://svc.example/auth?' + new URLSearchParams(${params}),
    exchange: async ({ redirectUri, codeVerifier }) => { globalThis.__arExchange = { redirectUri, codeVerifier }; return { accessToken: 'a' } },
};`;

    test('authorizeUrlMissing', () => {
        expect(connections.authorizeUrlMissing('https://s/a?state=x&code_challenge=c&code_challenge_method=S256', 'x', 'c')).toBeNull();
        expect(connections.authorizeUrlMissing('https://s/a?state=x', 'x', null)).toBeNull();
        expect(connections.authorizeUrlMissing('https://s/a?state=y', 'x', null)).toMatch(/state/);
        expect(connections.authorizeUrlMissing('https://s/a?state=x', 'x', 'c')).toMatch(/code_challenge/);
        expect(connections.authorizeUrlMissing('https://s/a?state=x&code_challenge=c&code_challenge_method=plain', 'x', 'c')).toMatch(/code_challenge/);
        expect(connections.authorizeUrlMissing('https://s/a?state=x&state=x2', 'x2', null)).toMatch(/state/);
    });

    test('PKCE is on unless the manifest sets "pkce": false', async () => {
        await withApp({}, echoJs('{ state: a.state, code_challenge: a.codeChallenge, code_challenge_method: a.codeChallengeMethod }'), async (base) => {
            const to = new URL((await fetch(`${base}/api/connections/ar/connect`, { redirect: 'manual' })).headers.get('location'));
            expect(to.searchParams.get('code_challenge_method')).toBe('S256');
        });
        await withApp({ pkce: false }, echoJs('{ state: a.state, cc: String(a.codeChallenge) }'), async (base) => {
            const start = await fetch(`${base}/api/connections/ar/connect`, { redirect: 'manual' });
            const to = new URL(start.headers.get('location'));
            expect(to.searchParams.get('cc')).toBe('undefined');
            const cookie = start.headers.get('set-cookie').split(';')[0];
            await fetch(`${base}/api/connections/ar/callback?state=${to.searchParams.get('state')}&code=c1`, { headers: { cookie } });
            expect(globalThis.__arExchange.codeVerifier).toBeUndefined();
        });
    });

    test('a sign-in is not started when the authorize URL drops state or the PKCE challenge', async () => {
        for (const params of ['{}', '{ state: a.state }', '{ state: a.state, code_challenge: a.codeChallenge, code_challenge_method: "plain" }']) {
            await withApp({}, echoJs(params), async (base) => {
                const r = await fetch(`${base}/api/connections/ar/connect`, { redirect: 'manual' });
                expect(r.status).not.toBe(302);
                expect(await r.text()).toContain("couldn't be reached");
            });
        }
    });

    test('exchange() gets the redirect URI of the authorization request, and a callback on another host is refused', async () => {
        const js = echoJs('{ state: a.state, redirect_uri: a.redirectUri, code_challenge: a.codeChallenge, code_challenge_method: a.codeChallengeMethod }');
        await withApp({}, js, async (base) => {
            const start = async () => {
                const r = await fetch(`${base}/api/connections/ar/connect`, { redirect: 'manual' });
                return { cookie: r.headers.get('set-cookie').split(';')[0], to: new URL(r.headers.get('location')) };
            };
            let { cookie, to } = await start();
            globalThis.__arExchange = null;
            const ok = await fetch(`${base}/api/connections/ar/callback?state=${to.searchParams.get('state')}&code=c1`, { headers: { cookie } });
            expect(ok.status).toBe(200);
            expect(globalThis.__arExchange.redirectUri).toBe(to.searchParams.get('redirect_uri'));
            ({ cookie, to } = await start());
            globalThis.__arExchange = null;
            const http = require('http');
            const status = await new Promise((resolve, reject) => {
                const u = new URL(`${base}/api/connections/ar/callback?state=${to.searchParams.get('state')}&code=c2`);
                http.get({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { cookie, host: `localhost:${u.port}` } }, (res) => {
                    res.resume();
                    resolve(res.statusCode);
                }).on('error', reject);
            });
            expect(status).toBe(400);
            expect(globalThis.__arExchange).toBeNull();
        });
    });
});

// A stand-in for the auth_connections table, so account storage runs without a database
function fakeAccountTable() {
    let n = 0;
    const rows = [];
    const t = { rows, down: false, delay: 5 };
    const tick = async () => {
        await new Promise((r) => setTimeout(r, t.delay));
        if (t.down) throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { name: 'SequelizeConnectionRefusedError' });
    };
    const hit = (r, where) =>
        Object.entries(where).every(([k, v]) => (k === 'updatedAt' ? new Date(r[k]).getTime() === new Date(v).getTime() : r[k] === v));
    const stamp = () => new Date(Date.now() + ++n);
    const row = (fields) => {
        const r = { id: ++n, createdAt: new Date(), updatedAt: stamp(), ...fields };
        r.update = async (f) => {
            await tick();
            Object.assign(r, f, { updatedAt: stamp() });
            return r;
        };
        r.destroy = async () => {
            await tick();
            rows.splice(rows.indexOf(r), 1);
        };
        return r;
    };
    const matching = (where) => rows.filter((r) => hit(r, where));
    t.model = {
        findOne: async ({ where }) => (await tick(), matching(where)[0] || null),
        findAll: async ({ where }) => (await tick(), matching(where)),
        create: async (f) => {
            await tick();
            const r = row(f);
            rows.push(r);
            return r;
        },
        update: async (f, { where }) => {
            await tick();
            const m = matching(where);
            m.forEach((r) => Object.assign(r, f, { updatedAt: stamp() }));
            return [m.length];
        },
        destroy: async ({ where }) => {
            await tick();
            const m = matching(where);
            m.forEach((r) => rows.splice(rows.indexOf(r), 1));
            return m.length;
        },
    };
    return t;
}

test.describe('lifecycle and failure handling', () => {
    const models = require('../../API/connections/models');
    let root;
    let saved;
    let savedModel;
    const table = fakeAccountTable();
    const JS = `module.exports = {
    authorizeUrl: (a) => 'https://svc.example/auth?' + new URLSearchParams({ state: a.state, code_challenge: a.codeChallenge, code_challenge_method: a.codeChallengeMethod }),
    exchange: async ({ code }) => {
        await new Promise((r) => setTimeout(r, globalThis.__r2.exchangeDelay || 0));
        return { accessToken: 'at-' + code, refreshToken: 'rt-' + code, expiresIn: 3600, account: 'acct' };
    },
    refresh: async ({ refreshToken }) => {
        const t = globalThis.__r2;
        t.refreshes.push(refreshToken);
        await new Promise((r) => setTimeout(r, t.refreshDelay || 20));
        if (t.fail) throw t.fail;
        return { accessToken: 'fresh-' + t.refreshes.length, refreshToken: t.keep ? refreshToken : refreshToken + '+', expiresIn: 3600 };
    },
    revoke: async (g) => {
        await new Promise((r) => setTimeout(r, globalThis.__r2.revokeDelay || 0));
        globalThis.__r2.revoked.push(g.refreshToken || g.accessToken);
    },
    validate: (env) => (env.R2_LEAK ? ['leak ' + ['MAPBOX_APIKEY', 'PRIVATE_KEY_PEM', 'DB_PASSWD', 'CREDENTIALS', 'SHORTSEC_TOKEN'].map((n) => env[n]).join(' ')] : []),
};`;
    test.beforeAll(() => {
        saved = process.env.SECRET;
        process.env.SECRET = 'e'.repeat(32);
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-connections-'));
        writePlugin(root, 't', 'R2', { type: 'connection', connection: 'r2', guests: true, description: 'x'.repeat(5000) }, JS);
        connections.loadConnections(root);
        savedModel = models.AuthConnection;
        models.AuthConnection = table.model;
    });
    test.afterAll(() => {
        models.AuthConnection = savedModel;
        fs.rmSync(root, { recursive: true, force: true });
        connections.loadConnections(CORE_PLUGINS);
        if (saved === undefined) delete process.env.SECRET;
        else process.env.SECRET = saved;
    });
    test.beforeEach(() => {
        globalThis.__r2 = { refreshes: [], revoked: [] };
        table.rows.length = 0;
        table.down = false;
    });
    const c = () => connections.getConnection('r2');
    let sid = 0;
    const user = (id = 7) => ({ principal: { kind: 'user', userId: id, authenticated: true }, session: {}, sessionID: `u-${id}` });
    const guest = () => ({ principal: { kind: 'anonymous' }, session: {}, sessionID: `g-${++sid}` });
    const copyOf = (req) => ({ ...req, session: JSON.parse(JSON.stringify(req.session)) });
    async function put(req, grant) {
        const record = connections.grantRecord(grant);
        if (grant.expiresAt != null) record.expiresAt = new Date(grant.expiresAt).toISOString();
        if (grant.issuedAt != null) record.issuedAt = new Date(grant.issuedAt).toISOString();
        await connections.writeStored(req, req.principal, c(), record);
        return req;
    }
    const netError = () => Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });

    test('concurrent refreshes of a non-rotating account token do not wait on each other', async () => {
        globalThis.__r2.keep = true;
        await put(user(), { accessToken: 'old', refreshToken: 'keep', expiresAt: Date.now() - 1000 });
        const start = Date.now();
        const tokens = await Promise.all([1, 2, 3].map(() => connections.token(user(), 'r2')));
        expect(Date.now() - start).toBeLessThan(3000);
        expect(globalThis.__r2.refreshes).toEqual(['keep']);
        expect(new Set(tokens)).toEqual(new Set(['fresh-1']));
    });

    test('a refresh that outlives the token does not hand back the expired token', async () => {
        Object.assign(globalThis.__r2, { refreshDelay: 800, fail: netError() });
        const req = await put(guest(), { accessToken: 'soon', refreshToken: 'slow', expiresAt: Date.now() + 400, issuedAt: Date.now() - 3600 * 1000 });
        await expect(connections.token(req, 'r2')).rejects.toMatchObject({ reason: 'unavailable' });
    });

    test('a service that is down is asked once, not on every request', async () => {
        globalThis.__r2.fail = netError();
        const req = await put(guest(), { accessToken: 'x', refreshToken: 'down', expiresAt: Date.now() - 1000 });
        await expect(connections.token(req, 'r2')).rejects.toMatchObject({ reason: 'unavailable' });
        await expect(connections.token(req, 'r2')).rejects.toMatchObject({ reason: 'unavailable' });
        expect(globalThis.__r2.refreshes).toEqual(['down']);
        expect(req.session.connections.r2).toBeTruthy();
    });

    test('a database outage reads as unavailable, not a raw error', async () => {
        await put(user(), { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 });
        table.down = true;
        await expect(connections.token(user(), 'r2')).rejects.toMatchObject({ reason: 'unavailable' });
    });

    test('a stored connection sealed with another SECRET is kept, in case SECRET is put back', async () => {
        await put(user(), { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 });
        process.env.SECRET = 'f'.repeat(32);
        try {
            expect(await connections.readStored(user(), user().principal, c())).toBeNull();
        } finally {
            process.env.SECRET = 'e'.repeat(32);
        }
        expect(table.rows.length).toBe(1);
        expect((await connections.readStored(user(), user().principal, c())).accessToken).toBe('a');
    });

    test('signing in does not wait for the revoke of a discarded guest grant', async () => {
        const browser = await put(guest(), { accessToken: 'g', refreshToken: 'guest-grant', expiresIn: 3600 });
        await put(user(), { accessToken: 'u', refreshToken: 'user-grant', expiresIn: 3600 });
        globalThis.__r2.revokeDelay = 1500;
        const signedIn = { ...user(), session: browser.session };
        const start = Date.now();
        await connections.adoptSessionConnections(signedIn, signedIn.principal);
        expect(Date.now() - start).toBeLessThan(1000);
        await expect.poll(() => globalThis.__r2.revoked, { timeout: 3000 }).toEqual(['guest-grant']);
    });

    test('a refresh that finishes after Disconnect does not bring the connection back', async () => {
        globalThis.__r2.refreshDelay = 300;
        const tab = await put(guest(), { accessToken: 'old', refreshToken: 'live', expiresAt: Date.now() - 1000 });
        const inFlight = copyOf(tab);
        const refreshing = connections.token(inFlight, 'r2');
        await expect.poll(() => globalThis.__r2.refreshes.length, { timeout: 250, intervals: [5] }).toBe(1);
        // Disconnect from another request of the same browser session
        await connections.removeStored(copyOf(tab), tab.principal, c());
        await expect(refreshing).rejects.toMatchObject({ reason: 'not_connected' });
        expect(inFlight.session.connections.r2).toBeUndefined();
        await expect.poll(() => globalThis.__r2.revoked, { timeout: 1000 }).toEqual(['live+']);
        // A request that started before Disconnect doesn't keep using the old token
        await expect(connections.token(copyOf(tab), 'r2')).rejects.toMatchObject({ reason: 'not_connected' });
    });

    test('an id like "constructor" does not read Object.prototype', async () => {
        const seen = [];
        const open = secretBox.open;
        secretBox.open = (v) => (seen.push(typeof v), open(v));
        try {
            const req = guest();
            req.session.connections = {};
            expect(await connections.readStored(req, req.principal, { id: 'constructor', label: 'C', guests: true })).toBeNull();
        } finally {
            secretBox.open = open;
        }
        expect(seen).toEqual([]);
    });

    test('plugin text is scrubbed of more kinds of secret env values', () => {
        const env = { R2_LEAK: '1', MAPBOX_APIKEY: 'pk.mapbox1', PRIVATE_KEY_PEM: '-----BEGIN-x', DB_PASSWD: 'hunter2x', CREDENTIALS: 'cr3dz!', SHORTSEC_TOKEN: 'sixsix', SITE_ACCESS: 'optional' }; // pragma: allowlist secret
        const out = connections.setupStatus(c(), env).problems.join(' ');
        for (const n of ['MAPBOX_APIKEY', 'PRIVATE_KEY_PEM', 'DB_PASSWD', 'CREDENTIALS', 'SHORTSEC_TOKEN']) expect(out).not.toContain(env[n]);
    });

    test('manifest text is capped', () => {
        expect(c().description.length).toBeLessThanOrEqual(1000);
    });

    test('a forwarded protocol other than http(s) is not used in the callback URL', () => {
        const req = { protocol: 'javascript', host: 'mmgis.example', get: () => undefined };
        expect(connections.callbackUrl(req, c())).toBe('http://mmgis.example/api/connections/r2/callback');
    });

    test('a CONNECTIONS_CALLBACK_BASE_URL without a scheme or ROOT_PATH is warned about', () => {
        const warn = (env) => connections.startupWarnings(env).filter((w) => /CONNECTIONS_CALLBACK_BASE_URL/.test(w));
        expect(warn({ CONNECTIONS_CALLBACK_BASE_URL: 'mmgis.example' }).length).toBe(1);
        expect(warn({ CONNECTIONS_CALLBACK_BASE_URL: 'https://mmgis.example', ROOT_PATH: '/mmgis' }).length).toBe(1);
        expect(warn({ CONNECTIONS_CALLBACK_BASE_URL: 'https://mmgis.example/mmgis/', ROOT_PATH: '/mmgis' })).toEqual([]);
        expect(warn({ CONNECTIONS_CALLBACK_BASE_URL: 'https://mmgis.example' })).toEqual([]);
    });

    test('external identities with the same username but different subjects do not share connections', () => {
        const a = { kind: 'external', provider: 'sso', subject: '1', username: 'al' };
        const b = { kind: 'external', provider: 'sso', subject: '2', username: 'al' };
        expect(connections.ownerKey(a)).not.toBe(connections.ownerKey(b));
    });

    test("deleting an account revokes its connections at the service", async () => {
        await put(user(9), { accessToken: 'a', refreshToken: 'doomed', expiresIn: 3600 });
        const grants = await connections.accountGrants(9);
        connections.revokeGrants(grants);
        await expect.poll(() => globalThis.__r2.revoked, { timeout: 1000 }).toEqual(['doomed']);
    });

    test('a plugin fault outside its hook promise is recognised, other errors are not', () => {
        const fromPlugin = new Error('boom');
        fromPlugin.stack = `Error: boom\n    at Timeout._onTimeout (${path.join(root, 't', 'connections', 'R2', 'plugin.js')}:3:9)`;
        const pluginFaults = require('../../API/pluginFaults');
        expect(pluginFaults.isPluginFault(fromPlugin)).toBe(true);
        expect(pluginFaults.pluginOf(fromPlugin).family).toBe('connection');
        expect(pluginFaults.isPluginFault(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))).toBe(true);
        expect(pluginFaults.isPluginFault(new Error('a bug in MMGIS'))).toBe(false);
        expect(pluginFaults.isPluginFault(null)).toBe(false);
    });

    test('plugin faults cover every plugin family outside core, and never core code', () => {
        const pluginFaults = require('../../API/pluginFaults');
        const at = (dir) => Object.assign(new Error('boom'), { stack: `Error: boom\n    at Timeout._onTimeout (${path.join(dir, 'plugin.js')}:1:1)` });
        const ext = path.join(root, 'ext');
        try {
            pluginFaults.register('auth', [path.join(ext, 'auth', 'Sso')]);
            pluginFaults.register('backend', [path.join(ext, 'backend', 'Thing')]);
            expect(pluginFaults.pluginOf(at(path.join(ext, 'auth', 'Sso')))).toEqual({ family: 'auth', dir: path.join(ext, 'auth', 'Sso') });
            expect(pluginFaults.pluginOf(at(path.join(ext, 'backend', 'Thing'))).family).toBe('backend');
            // A sibling folder whose name starts the same is not the plugin
            expect(pluginFaults.isPluginFault(at(path.join(ext, 'backend', 'Thing2')))).toBe(false);
            expect(pluginFaults.isPluginFault(at(path.join(__dirname, '..', '..', 'plugins', 'core', 'backend', 'Users')))).toBe(false);
        } finally {
            pluginFaults.register('auth', []);
            pluginFaults.register('backend', []);
        }
    });

    test('the split modules keep the public API', () => {
        for (const name of ['token', 'rejected', 'unavailable', 'connectionRequired', 'ConnectionRequiredError', 'mountConnectionRoutes',
            'loadConnections', 'getConnection', 'allConnections', 'setupStatus', 'startupWarnings', 'accountGrants', 'revokeGrants',
            'adoptSessionConnections', 'carryGuestConnections', 'readStored', 'writeStored', 'removeStored', 'current', 'callbackUrl'])
            expect(connections[name], name).toBeDefined();
        expect(connections.ConnectionRequiredError).toBe(require('../../API/connections/common').ConnectionRequiredError);
    });

    test.describe('routes', () => {
        async function withRoutes(fn) {
            const express = require('express');
            const session = require('express-session');
            const app = express();
            app.set('views', path.join(__dirname, '..', '..', 'views'));
            app.set('view engine', 'pug');
            app.use(session({ secret: 'test', resave: false, saveUninitialized: true })); // pragma: allowlist secret
            app.use((req, res, next) => {
                req.principal = req.get('x-test-user') ? { kind: 'user', userId: Number(req.get('x-test-user')), authenticated: true } : { kind: 'anonymous' };
                next();
            });
            const allow = () => (req, res, next) => next();
            allow.public = allow;
            allow.inHandler = allow;
            connections.mountConnectionRoutes(app, { registerRouter: (p, r) => r, authorize: allow, rootPath: '' });
            const server = app.listen(0);
            try {
                await fn(`http://127.0.0.1:${server.address().port}/api/connections/r2`);
            } finally {
                server.close();
            }
        }
        const connect = async (url, headers = {}) => {
            const r = await fetch(`${url}/connect`, { redirect: 'manual', headers });
            const cookie = headers.cookie || (r.headers.get('set-cookie') || '').split(';')[0];
            const to = r.headers.get('location');
            return { r, cookie, state: to ? new URL(to).searchParams.get('state') : null };
        };

        test('cross-site <img> requests do not use up the Connect and callback limits', async () => {
            await withRoutes(async (url) => {
                const img = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'no-cors', 'sec-fetch-dest': 'image' };
                for (let i = 0; i < 110; i++) await fetch(`${url}/connect`, { redirect: 'manual', headers: img });
                for (let i = 0; i < 40; i++) await fetch(`${url}/callback?state=${'0'.repeat(48)}&code=x`, { headers: img });
                const { r, cookie, state } = await connect(url);
                expect(r.status).toBe(302);
                // fetch() sets its own Sec-Fetch-Mode, so send the service's redirect back with http.get
                const back = await new Promise((resolve, reject) => {
                    const u = new URL(`${url}/callback?state=${state}&code=c1`);
                    require('http')
                        .get({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { cookie, 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } }, (res) => {
                            res.resume();
                            resolve(res.statusCode);
                        })
                        .on('error', reject);
                });
                expect(back).toBe(200);
            });
        });

        test('refused callbacks do not use up the callback limit', async () => {
            await withRoutes(async (url) => {
                for (let i = 0; i < 40; i++) await fetch(`${url}/callback?state=${'0'.repeat(48)}&code=x`);
                const { cookie, state } = await connect(url);
                expect((await fetch(`${url}/callback?state=${state}&code=c1`, { headers: { cookie } })).status).toBe(200);
            });
        });

        test('Connect and callback pages are not cached, and control characters from the service are not shown', async () => {
            await withRoutes(async (url) => {
                const { r, cookie, state } = await connect(url);
                expect(r.headers.get('cache-control')).toContain('no-store');
                const back = await fetch(`${url}/callback?state=${state}&error=access_denied&error_description=${encodeURIComponent('no\u202Eway\u0000 here')}`, { headers: { cookie } });
                expect(back.headers.get('cache-control')).toContain('no-store');
                const html = await back.text();
                expect(html).toContain('noway here');
                expect(html).not.toMatch(/[\u0000\u202E]/);
            });
        });

        test('five more Connects in the same session keep an earlier sign-in going', async () => {
            await withRoutes(async (url) => {
                const first = await connect(url);
                for (let i = 0; i < 5; i++) await connect(url, { cookie: first.cookie });
                expect((await fetch(`${url}/callback?state=${first.state}&code=c1`, { headers: { cookie: first.cookie } })).status).toBe(200);
            });
        });

        test('two Connects finishing at once revoke the grant that lost', async () => {
            await withRoutes(async (url) => {
                const headers = { 'x-test-user': '11' };
                const a = await connect(url, headers);
                const b = await connect(url, { ...headers, cookie: a.cookie });
                globalThis.__r2.exchangeDelay = 200;
                await Promise.all(
                    [[a.state, 'c1'], [b.state, 'c2']].map(([state, code]) => fetch(`${url}/callback?state=${state}&code=${code}`, { headers: { ...headers, cookie: a.cookie } }))
                );
                const kept = await connections.readStored(user(11), user(11).principal, c());
                expect(['rt-c1', 'rt-c2']).toContain(kept.refreshToken);
                await expect.poll(() => globalThis.__r2.revoked, { timeout: 1000 }).toEqual([kept.refreshToken === 'rt-c1' ? 'rt-c2' : 'rt-c1']);
            });
        });
    });
});

test.describe('sameOriginOnly behind a proxy', () => {
    const run = (headers) => {
        let status = 200;
        let passed = false;
        const req = { get: (h) => headers[h.toLowerCase()], protocol: 'https', headers };
        const res = { status: (s) => ((status = s), res), send: () => res };
        connections.sameOriginOnly(req, res, () => (passed = true));
        return passed ? 200 : status;
    };
    test('a same-origin Disconnect is allowed when the proxy drops the port from Host', () => {
        expect(run({ host: 'mmgis.example', origin: 'https://mmgis.example:8443', 'sec-fetch-site': 'same-origin' })).toBe(200);
        const savedBase = process.env.CONNECTIONS_CALLBACK_BASE_URL;
        process.env.CONNECTIONS_CALLBACK_BASE_URL = 'https://mmgis.example:8443/';
        try {
            expect(run({ host: 'mmgis.example', origin: 'https://mmgis.example:8443' })).toBe(200);
            expect(run({ host: 'mmgis.example', origin: 'https://evil.example' })).toBe(403);
        } finally {
            if (savedBase === undefined) delete process.env.CONNECTIONS_CALLBACK_BASE_URL;
            else process.env.CONNECTIONS_CALLBACK_BASE_URL = savedBase;
        }
    });
});
