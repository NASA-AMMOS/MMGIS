import { test, expect } from '@playwright/test';

test.describe('SQL Injection Protection — Draw/Files filters', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  // SQL injection via filter property key
  const keyPayloads = [
    "name'+OR+1=1--",
    "'; DROP TABLE user_features; --",
    "key' UNION SELECT * FROM pg_tables--",
  ];

  for (const payload of keyPayloads) {
    test(`rejects SQL injection in filter property key: ${payload.substring(0, 30)}...`, async ({ request }) => {
      // Filter format: key+op+type+value
      const filter = `${encodeURIComponent(payload)}+=+string+test`;
      const response = await request.post(`${baseURL}/api/files/getfile`, {
        data: {
          id: 1,
          test: 'false',
          filters: filter,
        },
      });
      // Should NOT return 500 (SQL error) — 400 (bad request) or other non-500 is acceptable
      expect(response.status()).not.toBe(500);
    });
  }

  // SQL injection via filter value
  const valuePayloads = [
    "test' OR '1'='1",
    "'; DROP TABLE user_features;--",
    "1 UNION SELECT username FROM users--",
  ];

  for (const payload of valuePayloads) {
    test(`rejects SQL injection in filter value: ${payload.substring(0, 30)}...`, async ({ request }) => {
      const filter = `name+=+string+${encodeURIComponent(payload)}`;
      const response = await request.post(`${baseURL}/api/files/getfile`, {
        data: {
          id: 1,
          test: 'false',
          filters: filter,
        },
      });
      expect(response.status()).not.toBe(500);
    });
  }

  // SQL injection via geometry.type filter value
  const geomPayloads = [
    "Point' OR '1'='1",
    "Point'; DROP TABLE user_features;--",
  ];

  for (const payload of geomPayloads) {
    test(`rejects SQL injection in geometry.type filter: ${payload.substring(0, 30)}...`, async ({ request }) => {
      const filter = `geometry.type+=+string+${encodeURIComponent(payload)}`;
      const response = await request.post(`${baseURL}/api/files/getfile`, {
        data: {
          id: 1,
          test: 'false',
          filters: filter,
        },
      });
      expect(response.status()).not.toBe(500);
    });
  }

  // SQL injection via timeProp parameter
  const timePropPayloads = [
    "'; DROP TABLE user_features; --",
    "time' OR '1'='1",
    "sol); DELETE FROM user_features; --",
  ];

  for (const payload of timePropPayloads) {
    test(`rejects SQL injection in timeProp: ${payload.substring(0, 30)}...`, async ({ request }) => {
      const response = await request.post(`${baseURL}/api/files/getfile`, {
        data: {
          id: 1,
          test: 'false',
          timeProp: payload,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
        },
      });
      expect(response.status()).not.toBe(500);
    });
  }

  // SQL injection via sortBy parameter
  test('rejects SQL injection in sortBy parameter', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/files/getfile`, {
      data: {
        id: 1,
        test: 'false',
        sortBy: "name'; DROP TABLE user_features;--",
        sortOrder: 'asc',
      },
    });
    expect(response.status()).not.toBe(500);
  });
});
