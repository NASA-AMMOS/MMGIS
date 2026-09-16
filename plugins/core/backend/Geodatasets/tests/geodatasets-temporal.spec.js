import { test, expect, request as apiRequest } from '@playwright/test';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import pgPromise from 'pg-promise';

/**
 * Regression tests for temporal geodataset handling:
 *
 * 1. Legacy geodataset tables (created before temporal support) lack physical
 *    start_time/end_time columns, yet /get and /search SELECT them
 *    unconditionally — every query fails until the table is healed. The
 *    startup migration (models/geodatasets.js up()) and /recreate must both
 *    add the missing columns.
 * 2. The time-filter WHERE clause skips rows with start_time set and end_time
 *    NULL, so start-only datasets return zero features under any time filter.
 * 3. Recreating (overwriting) a dataset while adding time mappings drops the
 *    computed start_time/end_time values because the Sequelize model
 *    attributes are deleted based on the dataset's pre-update metadata.
 *
 * Creating / recreating / removing a geodataset requires an admin session
 * (ensureAdmin middleware). global-setup creates `test_admin` when AUTH=local;
 * when admin access is unavailable the suites skip gracefully.
 *
 * The legacy-table suites reach into the `mmgis-test` database directly to
 * DROP the temporal columns — the application (correctly) offers no way to
 * produce that state anymore, so it must be simulated at the schema level.
 */

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

const TEST_DB_NAME = 'mmgis-test';

function readDotenvValue(key) {
  try {
    const contents = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    const match = contents.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    // .env not found — fall through
  }
  return undefined;
}

const dbConfig = {
  host: process.env.DB_HOST || readDotenvValue('DB_HOST') || 'localhost',
  port: Number(process.env.DB_PORT || readDotenvValue('DB_PORT') || '5432'),
  user: process.env.DB_USER_TEST || readDotenvValue('DB_USER_TEST'),
  password: process.env.DB_PASS_TEST || readDotenvValue('DB_PASS_TEST'),
  database: TEST_DB_NAME,
};

const pgp = pgPromise();
let db = null;
function getDb() {
  if (db == null) db = pgp(dbConfig);
  return db;
}

async function loginAdmin() {
  const api = await apiRequest.newContext({ baseURL });
  await api
    .post('/api/users/login', {
      data: { username: 'test_admin', password: 'TestAdmin1!' }, // pragma: allowlist secret
    })
    .catch(() => {});
  return api;
}

async function createDataset(api, name, features, props = {}) {
  // Concurrent creates can collide on new-table naming (SELECT MAX(id) is not
  // atomic), and parallel workers create datasets simultaneously — retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await api.post('/api/geodatasets/recreate', {
      data: {
        name,
        startProp: props.startProp || null,
        endProp: props.endProp || null,
        geojson: JSON.stringify({ type: 'FeatureCollection', features }),
      },
    });
    const data = await res.json().catch(() => null);
    if (!!data && data.status === 'success') return true;
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 500));
  }
  return false;
}

/** Simulate a pre-temporal-support table by dropping its temporal columns. */
async function dropTemporalColumns(name) {
  const row = await getDb().one(
    'SELECT "table" FROM geodatasets WHERE name = $1',
    [name]
  );
  await getDb().none(
    'ALTER TABLE $1:name DROP COLUMN IF EXISTS start_time, DROP COLUMN IF EXISTS end_time',
    [row.table]
  );
  return row.table;
}

function pointFeature(coordinates, properties) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties };
}

test.describe.serial('Geodatasets API — legacy tables without temporal columns', () => {
  const migratedLayer = `test_legacy_migrate_${Date.now()}`;
  const recreatedLayer = `test_legacy_recreate_${Date.now()}`;
  let api;
  let adminReady = false;

  test.beforeAll(async () => {
    api = await loginAdmin();
    adminReady =
      (await createDataset(api, migratedLayer, [
        pointFeature([-122.42, 37.78], { name: 'Legacy A' }),
        pointFeature([-122.43, 37.79], { name: 'Legacy B' }),
      ])) &&
      (await createDataset(api, recreatedLayer, [
        pointFeature([-122.42, 37.78], { name: 'Legacy C' }),
      ]));
    if (adminReady) {
      await dropTemporalColumns(migratedLayer);
      await dropTemporalColumns(recreatedLayer);
    }
  });

  test.afterAll(async () => {
    if (adminReady) {
      await api.delete(`/api/geodatasets/remove/${migratedLayer}`).catch(() => {});
      await api.delete(`/api/geodatasets/remove/${recreatedLayer}`).catch(() => {});
    }
    if (api) await api.dispose();
  });

  test('startup migration (up()) adds missing temporal columns so /get and /search work', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable — cannot create geodataset');
      return;
    }

    // Sanity: the legacy table currently fails to query.
    const before = await (
      await api.get('/api/geodatasets/get', { params: { layer: migratedLayer } })
    ).json();
    expect(before.status).toBe('failure');

    // Run the startup migration the way plugin.js does on server boot.
    const modelPath = resolve(
      process.cwd(),
      'plugins/core/backend/Geodatasets/models/geodatasets.js'
    );
    execFileSync(
      process.execPath,
      [
        '-e',
        `require(${JSON.stringify(modelPath)}).up().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });`,
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DB_NAME: TEST_DB_NAME,
          DB_HOST: String(dbConfig.host),
          DB_PORT: String(dbConfig.port),
          DB_USER: String(dbConfig.user),
          DB_PASS: String(dbConfig.password),
        },
        stdio: 'pipe',
      }
    );

    const getData = await (
      await api.get('/api/geodatasets/get', { params: { layer: migratedLayer } })
    ).json();
    expect(getData.type).toBe('FeatureCollection');
    expect(getData.features.length).toBe(2);

    const searchData = await (
      await api.post('/api/geodatasets/search', {
        data: { layer: migratedLayer, key: 'name', value: 'Legacy A' },
      })
    ).json();
    expect(searchData.status).toBe('success');
    expect(searchData.body.length).toBe(1);
  });

  test('recreate with time mappings heals a legacy table', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable — cannot create geodataset');
      return;
    }

    const START = '2024-06-01T00:00:00Z';
    const END = '2024-06-01T01:00:00Z';
    const recreated = await createDataset(
      api,
      recreatedLayer,
      [pointFeature([-122.42, 37.78], { name: 'Legacy C', begin: START, finish: END })],
      { startProp: 'begin', endProp: 'finish' }
    );
    expect(recreated).toBe(true);

    const data = await (
      await api.get('/api/geodatasets/get', {
        params: {
          layer: recreatedLayer,
          starttime: '2024-05-01T00:00:00Z',
          endtime: '2024-07-01T00:00:00Z',
        },
      })
    ).json();
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBe(1);
    // BIGINT columns serialize as strings — coerce to Number.
    expect(Number(data.features[0].properties._.start_time)).toBe(new Date(START).getTime());
    expect(Number(data.features[0].properties._.end_time)).toBe(new Date(END).getTime());
  });
});

test.describe.serial('Geodatasets API — time filter with only a start time', () => {
  const layerName = `test_start_only_${Date.now()}`;
  const IN_WINDOW = '2024-06-15T00:00:00Z';
  const OUT_OF_WINDOW = '2023-01-01T00:00:00Z';
  let api;
  let adminReady = false;

  test.beforeAll(async () => {
    api = await loginAdmin();
    adminReady = await createDataset(
      api,
      layerName,
      [
        pointFeature([-122.42, 37.78], { name: 'In window', t0: IN_WINDOW }),
        pointFeature([-122.43, 37.79], { name: 'Out of window', t0: OUT_OF_WINDOW }),
      ],
      { startProp: 't0' }
    );
  });

  test.afterAll(async () => {
    if (adminReady) {
      await api.delete(`/api/geodatasets/remove/${layerName}`).catch(() => {});
    }
    if (api) await api.dispose();
  });

  test('GET /get time filter includes features whose start_time is in the window', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable — cannot create geodataset');
      return;
    }

    const data = await (
      await api.get('/api/geodatasets/get', {
        params: {
          layer: layerName,
          starttime: '2024-06-01T00:00:00Z',
          endtime: '2024-07-01T00:00:00Z',
        },
      })
    ).json();
    expect(data.type).toBe('FeatureCollection');
    const names = data.features.map((f) => f.properties?.name);
    expect(names).toContain('In window');
    expect(names).not.toContain('Out of window');
  });

  test('POST /intersect time filter includes features whose start_time is in the window', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable — cannot create geodataset');
      return;
    }

    const data = await (
      await api.post('/api/geodatasets/intersect', {
        data: {
          layer: layerName,
          intersect: {
            type: 'Polygon',
            coordinates: [
              [
                [-123, 37],
                [-122, 37],
                [-122, 38],
                [-123, 38],
                [-123, 37],
              ],
            ],
          },
          starttime: '2024-06-01T00:00:00Z',
          endtime: '2024-07-01T00:00:00Z',
        },
      })
    ).json();
    expect(data.status).toBe('success');
    const names = data.body.features.map((f) => f.properties?.name);
    expect(names).toContain('In window');
    expect(names).not.toContain('Out of window');
  });
});

test.describe.serial('Geodatasets API — recreate that adds time mappings', () => {
  const layerName = `test_add_time_fields_${Date.now()}`;
  const START = '2024-03-01T00:00:00Z';
  const END = '2024-03-01T02:00:00Z';
  let api;
  let adminReady = false;

  test.beforeAll(async () => {
    api = await loginAdmin();
    // First upload: the same temporal properties exist but are not mapped.
    adminReady = await createDataset(api, layerName, [
      pointFeature([-122.42, 37.78], { name: 'Timed', begin: START, finish: END }),
    ]);
  });

  test.afterAll(async () => {
    if (adminReady) {
      await api.delete(`/api/geodatasets/remove/${layerName}`).catch(() => {});
    }
    if (api) await api.dispose();
  });

  test('overwriting with startProp/endProp persists the temporal values', async () => {
    if (!adminReady) {
      test.skip(true, 'SKIP: admin session unavailable — cannot create geodataset');
      return;
    }

    const recreated = await createDataset(
      api,
      layerName,
      [pointFeature([-122.42, 37.78], { name: 'Timed', begin: START, finish: END })],
      { startProp: 'begin', endProp: 'finish' }
    );
    expect(recreated).toBe(true);

    const data = await (
      await api.get('/api/geodatasets/get', { params: { layer: layerName } })
    ).json();
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBe(1);
    expect(Number(data.features[0].properties._.start_time)).toBe(new Date(START).getTime());
    expect(Number(data.features[0].properties._.end_time)).toBe(new Date(END).getTime());

    // A disjoint window must now exclude the feature (it is no longer timeless).
    const disjoint = await (
      await api.get('/api/geodatasets/get', {
        params: {
          layer: layerName,
          starttime: '2020-01-01T00:00:00Z',
          endtime: '2020-02-01T00:00:00Z',
        },
      })
    ).json();
    expect(disjoint.type).toBe('FeatureCollection');
    expect(disjoint.features.length).toBe(0);
  });
});
