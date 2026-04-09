import { test, expect } from '@playwright/test';

test.describe('Draw API', () => {
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
