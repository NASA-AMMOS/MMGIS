/**
 * Unit tests for the one-time legacy permission import.
 * Source: API/permissions/legacyImport.js
 */
import { test, expect } from '@playwright/test';
const path = require('path');

const root = path.resolve(__dirname, '../..');
const USERS = [
  { id: 1, username: 'sa', permission: '111', missions_managing: null, missions_viewing: null },
  { id: 2, username: 'admin', permission: '110', missions_managing: ['M'], missions_viewing: null },
  { id: 3, username: 'user', permission: '001', missions_managing: null, missions_viewing: null },
  { id: 4, username: 'limited', permission: '001', missions_managing: null, missions_viewing: ['M'] },
  { id: 5, username: 'locked', permission: '000', missions_managing: null, missions_viewing: null },
  { id: 6, username: 'locked2', permission: '010', missions_managing: null, missions_viewing: null },
];
const STUBS = {
  'API/permissions/models.js': {},
  'plugins/core/backend/Users/models/user.js': { User: { findAll: async () => USERS } },
  'API/permissions/missions.js': { uuidForName: async (n) => `uuid-${n}`, backfill: async () => {} },
};
const IMPORT = path.join(root, 'API/permissions/legacyImport.js');

// Stub the database-backed modules only while these tests run
let legacyImport;
const replaced = [];
test.beforeAll(() => {
  for (const [rel, exports] of Object.entries(STUBS)) {
    const file = require.resolve(path.join(root, rel));
    replaced.push([file, require.cache[file]]);
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
  }
  delete require.cache[require.resolve(IMPORT)];
  legacyImport = require(IMPORT);
});
test.afterAll(() => {
  for (const [file, entry] of replaced) {
    if (entry) require.cache[file] = entry;
    else delete require.cache[file];
  }
  delete require.cache[require.resolve(IMPORT)];
});

const ENV = ['SITE_ACCESS', 'AUTH_PROVIDERS'];
let saved;
test.beforeEach(() => (saved = ENV.map((k) => process.env[k])));
test.afterEach(() => ENV.forEach((k, i) => (saved[i] == null ? delete process.env[k] : (process.env[k] = saved[i]))));

const rolesOf = (bindings, id) =>
  bindings
    .filter((b) => b.subject_type === 'user' && b.subject_id === String(id))
    .map((b) => `${b.role}@${b.mission_uuid || b.scope_type}`)
    .sort();

test.describe('legacy permission import', () => {
  test('required local sites: only accounts that could log in get view access', async () => {
    process.env.SITE_ACCESS = 'required';
    process.env.AUTH_PROVIDERS = 'local';
    const { bindings } = await legacyImport.plan();
    expect(rolesOf(bindings, 1)).toEqual(['superadmin@global']);
    expect(rolesOf(bindings, 2)).toEqual(['mission_admin@uuid-M', 'viewer@global']);
    expect(rolesOf(bindings, 3)).toEqual(['viewer@global']);
    expect(rolesOf(bindings, 4)).toEqual(['viewer@uuid-M']);
    expect(rolesOf(bindings, 5)).toEqual([]);
    expect(rolesOf(bindings, 6)).toEqual([]);
    expect(bindings.filter((b) => b.subject_type === 'audience')).toEqual([]);
  });

  test('open sites grant Everyone view access and no per-user viewing', async () => {
    process.env.SITE_ACCESS = 'optional';
    process.env.AUTH_PROVIDERS = 'local';
    const { bindings } = await legacyImport.plan();
    for (const id of [3, 4, 5, 6]) expect(rolesOf(bindings, id)).toEqual([]);
    expect(bindings.filter((b) => b.subject_type === 'audience').map((b) => b.subject_id)).toEqual(['everyone']);
  });
});
