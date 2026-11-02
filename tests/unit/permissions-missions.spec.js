/**
 * Unit tests for the cached mission name -> UUID lookup.
 * Source: API/permissions/missions.js
 */

import { test, expect } from '@playwright/test';
const path = require('path');

const rows = [];
let queries = 0;
let delay = null;

function stub(rel, exports) {
  const file = require.resolve(path.resolve(__dirname, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub('../../API/permissions/models.js', {
  AuthMission: {
    findAll: async () => {
      queries++;
      const snapshot = rows.map((r) => ({ ...r }));
      if (delay) await delay;
      return snapshot;
    },
  },
  RoleBinding: {},
});
stub('../../plugins/core/backend/Config/models/config.js', {});

const missions = require(path.resolve(__dirname, '../../API/permissions/missions.js'));

test.describe('missions.uuidForName', () => {
  test.beforeEach(() => {
    rows.length = 0;
    queries = 0;
    delay = null;
    missions.clear();
  });

  test('serves known names from the cache', async () => {
    rows.push({ name: 'A', uuid: 'uuid-a' });
    expect(await missions.uuidForName('A')).toBe('uuid-a');
    expect(await missions.uuidForName('A')).toBe('uuid-a');
    expect(queries).toBe(1);
  });

  test('finds a mission another process added after the cache loaded', async () => {
    rows.push({ name: 'A', uuid: 'uuid-a' });
    expect(await missions.uuidForName('A')).toBe('uuid-a');
    rows.push({ name: 'B', uuid: 'uuid-b' });
    expect(await missions.uuidForName('B')).toBe('uuid-b');
  });

  test('returns null for unknown or empty names', async () => {
    rows.push({ name: 'A', uuid: 'uuid-a' });
    expect(await missions.uuidForName('Nope')).toBeNull();
    expect(await missions.uuidForName('')).toBeNull();
    expect(await missions.uuidForName(undefined)).toBeNull();
  });

  test('a load that overlaps a clear() is not kept as the cache', async () => {
    let release;
    delay = new Promise((r) => (release = r));
    rows.push({ name: 'A', uuid: 'uuid-a' });
    const first = missions.uuidForName('A');
    // A mission is created while the first query is still running
    rows.push({ name: 'B', uuid: 'uuid-b' });
    missions.clear();
    release();
    expect(await first).toBe('uuid-a');
    delay = null;
    const before = queries;
    expect(await missions.uuidForName('B')).toBe('uuid-b');
    // The stale result was dropped, so this lookup hit the database once, without a miss-and-retry
    expect(queries).toBe(before + 1);
  });
});
