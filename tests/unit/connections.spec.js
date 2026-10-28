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
        writePlugin(root, 'a', 'Good', { type: 'connection', connection: 'Good', display_name: 'Good Svc', guests: true, env: ['GOOD_ID', 5] }, GOOD_JS);
        writePlugin(root, 'b', 'Dup', { type: 'connection', connection: 'good' }, GOOD_JS);
        writePlugin(root, 'a', 'NoId', { type: 'connection' }, GOOD_JS);
        writePlugin(root, 'a', 'BadId', { type: 'connection', connection: '1bad id' }, GOOD_JS);
        writePlugin(root, 'a', 'NoHooks', { type: 'connection', connection: 'nohooks' }, 'module.exports = { exchange() {} }');
        writePlugin(root, 'a', 'Throws', { type: 'connection', connection: 'throws' }, 'throw new Error("boom")');

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
    test('ignores bad expiry values', () => {
        expect(connections.grantRecord({ accessToken: 'a', expiresAt: 'not a date' }).expiresAt).toBeNull();
        expect(connections.grantRecord({ accessToken: 'a', expiresIn: -5 }).expiresAt).toBeNull();
        expect(connections.grantRecord({ accessToken: 'a', refreshToken: 7 }).refreshToken).toBeNull();
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
