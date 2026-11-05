import { test, expect, request as apiRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { loginHeaders } from '../../helpers/auth.js';

const { updateLayerTypes } = require('../../../API/updateTools');

/**
 * POST /api/configure/addLayer with header layers (#442).
 *
 * A header added without a `sublayers` array used to be saved as-is, after
 * which `placement.path` could never resolve to it and every later addLayer
 * under that header failed with "Path specified in 'placement.path' not found".
 * A plugin layer type that `extends: "header"` must behave the same way.
 */

test.describe('Configure API — addLayer header sublayers', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  /** Admin request context shared by the tests (one login per worker). */
  let api;
  let adminReady = false;
  const missions = [];

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL });
    const login = await api
      .post('/api/users/login', {
        headers: loginHeaders(),
        data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
      })
      .then((res) => res.json())
      .catch(() => null);
    adminReady = login?.status === 'success';
  });

  test.afterAll(async () => {
    if (!api) return;
    for (const mission of missions) {
      await api.post('/api/configure/destroy', { data: { mission } }).catch(() => {});
    }
    await api.dispose();
  });

  // Creates a mission (optionally from a partial config) or skips the test.
  async function createMission(mission, config) {
    test.skip(!adminReady, 'SKIP: could not log in as test_admin');
    const body = await api
      .post('/api/configure/add', { data: config ? { mission, config } : { mission } })
      .then((res) => res.json())
      .catch(() => null);
    if (body?.status !== 'success') {
      test.skip(true, `SKIP: could not create a mission (${body?.message})`);
    }
    missions.push(mission);
  }

  async function addLayer(mission, layer, path) {
    const res = await api.post('/api/configure/addLayer', {
      data: path ? { mission, layer, placement: { path } } : { mission, layer },
    });
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  async function getLayers(mission) {
    const res = await api.get(
      `/api/configure/get?mission=${encodeURIComponent(mission)}&full=true`,
    );
    const body = await res.json();
    expect(body.status).toBe('success');
    return body.config.layers;
  }

  test('a header added without sublayers is saved with an empty sublayers array', async () => {
    const mission = `HeaderSublayers-${Date.now()}`;
    await createMission(mission);

    const added = await addLayer(mission, { type: 'header', name: 'Group' });
    expect(added, added.message).toMatchObject({ status: 'success' });

    const layers = await getLayers(mission);
    expect(layers[0].name).toBe('Group');
    expect(layers[0].sublayers).toEqual([]);

    // Nested headers, as in the issue: Group > Subgroup > Leaf
    const sub = await addLayer(mission, { type: 'header', name: 'Subgroup' }, 'Group');
    expect(sub, sub.message).toMatchObject({ status: 'success' });

    const leaf = await addLayer(mission, { type: 'header', name: 'Leaf' }, 'Group.Subgroup');
    expect(leaf, leaf.message).toMatchObject({ status: 'success' });

    const nested = await getLayers(mission);
    expect(nested[0].sublayers[0].name).toBe('Subgroup');
    expect(nested[0].sublayers[0].sublayers[0].name).toBe('Leaf');
    expect(nested[0].sublayers[0].sublayers[0].sublayers).toEqual([]);
  });

  test('a stored header without sublayers can still take new layers', async () => {
    const mission = `HeaderSublayersLegacy-${Date.now()}`;
    // A config saved before the fix: the header has no `sublayers` key.
    await createMission(mission, { layers: [{ type: 'header', name: 'Legacy' }] });

    const before = await getLayers(mission);
    expect(before[0].sublayers).toBeUndefined();

    const added = await addLayer(mission, { type: 'header', name: 'Child' }, 'Legacy');
    expect(added, added.message).toMatchObject({ status: 'success' });

    const after = await getLayers(mission);
    expect(after[0].sublayers.map((l) => l.name)).toEqual(['Child']);
  });

  test('a stored layer of a type extending header, without sublayers, can still take new layers', async () => {
    const HEADER_TYPE = 'headersublayersfixture';
    const mission = `HeaderSublayersPlugin-${Date.now()}`;
    // A config saved before the fix: a layer of a plugin type that extends
    // header, with no `sublayers` key, next to a vector layer.
    await createMission(mission, {
      layers: [
        { type: HEADER_TYPE, name: 'CustomGroup' },
        { type: 'vector', name: 'Points', url: 'points.json' },
      ],
    });

    // Register the type the way an activated plugin is: a container with a
    // layertype manifest, then the layer-type registry regenerated. The server
    // reads that registry from disk on every save.
    const container = path.resolve(
      __dirname,
      '../../../plugins/mmgis-test-header-sublayers',
    );
    const typeDir = path.join(container, 'layertypes', 'HeaderSublayersFixture');
    fs.mkdirSync(typeDir, { recursive: true });
    fs.writeFileSync(
      path.join(typeDir, 'plugin.json'),
      JSON.stringify({
        name: 'HeaderSublayersFixture',
        type: 'layertype',
        typeId: HEADER_TYPE,
        extends: 'header',
        version: '1.0.0',
        description: 'Fixture for configure-add-header-layer.spec.js',
        capabilities: {},
      }),
    );
    try {
      updateLayerTypes();

      // Only header types get the empty array: a vector still has no level.
      const underVector = await addLayer(mission, { type: 'header', name: 'Nope' }, 'Points');
      expect(underVector).toMatchObject({ status: 'failure' });
      expect(underVector.message).toContain("not found in 'layers': Points.sublayers.");

      const added = await addLayer(mission, { type: 'header', name: 'Child' }, 'CustomGroup');
      expect(added, added.message).toMatchObject({ status: 'success' });

      // A new layer of that type is saved with an empty sublayers array too.
      const sub = await addLayer(mission, { type: HEADER_TYPE, name: 'CustomSubgroup' }, 'CustomGroup');
      expect(sub, sub.message).toMatchObject({ status: 'success' });

      const after = await getLayers(mission);
      expect(after[0].sublayers.map((l) => l.name)).toEqual(['Child', 'CustomSubgroup']);
      expect(after[0].sublayers[1].sublayers).toEqual([]);
    } finally {
      fs.rmSync(container, { recursive: true, force: true });
      updateLayerTypes();
    }
  });
});
