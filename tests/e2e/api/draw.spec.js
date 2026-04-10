import { test, expect } from '@playwright/test';

/**
 * E2E tests for Draw API endpoints.
 * Backend routes: API/Backend/Draw/routes/files.js
 *
 * Currently covers:
 *   - POST /api/files/getfile (impacted by SQL injection fix in filesutils.js)
 *
 * Future tests can cover:
 *   - POST /api/files/getfiles
 *   - POST /api/files/gethistory
 *   - POST /api/files/add, /edit, /remove, /merge, /split, /undo
 *   - POST /api/files/publish, /clip
 */

test.describe('Draw API', () => {

  test.describe('POST /api/files/getfile', () => {

    test('returns a valid response for a basic getfile request', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: 1,
          test: 'false',
        },
      });
      // Should not crash (no 500)
      expect(response.status()).toBeLessThan(500);
      const body = await response.json().catch(() => null);
      // In AUTH=local the server may return the HTML login page
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(body).toHaveProperty('status');
    });

    test('returns a valid response with temporal filter parameters', async ({ request }) => {
      // Exercises the timeProp SQL path that was fixed
      const response = await request.post('/api/files/getfile', {
        data: {
          id: 1,
          test: 'false',
          timeProp: 'sol',
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
      const body = await response.json().catch(() => null);
      if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
      expect(body).toHaveProperty('status');
    });

    test('handles malicious timeProp without server error', async ({ request }) => {
      // SQL injection attempt via timeProp — should be sanitized, not crash
      const response = await request.post('/api/files/getfile', {
        data: {
          id: 1,
          test: 'false',
          timeProp: "'; DROP TABLE user_features; --",
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

  test('returns valid response with property equality filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'name+=+string+TestValue',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with numeric comparison filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'elevation+>+number+100',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with IN filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'status+in+string+active$pending$closed',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with LIKE/contains filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'description+contains+string+test',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with IS NULL filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'optionalField+isnull+string+',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with geometry.type equality filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'geometry.type+=+string+Point',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with geometry.type IN filter', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'geometry.type+in+string+Point$LineString$Polygon',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with grouped AND/OR filters', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'AND,name+=+string+Test,elevation+>+number+50',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with NOT_AND filter group', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'NOT_AND,name+=+string+Excluded,status+=+string+inactive',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with pagination and filters combined', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: 'name+=+string+Test',
        limit: 10,
        offset: 0,
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with spatial filter (bounds)', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        minx: -180,
        miny: -90,
        maxx: 180,
        maxy: 90,
        crs: 'EPSG:4326',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('returns valid response with sortBy on a property key', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        sortBy: 'name',
        sortOrder: 'asc',
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (!body) { test.skip(true, 'SKIP: Non-JSON response — AUTH=local'); return; }
    expect(body).toHaveProperty('status');
  });

  test('rejects filter with invalid field name characters', async ({ request }) => {
    const response = await request.post('/api/files/getfile', {
      data: {
        id: 1,
        test: 'false',
        filters: "na;me+=+string+test",
      },
    });
    expect(response.status()).toBeLessThan(500);
    const body = await response.json().catch(() => null);
    if (body) {
      // Should return 400 with an error about invalid filter field name
      expect(body.status).toBe('failure');
    }
  });
});
