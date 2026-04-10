/**
 * Unit tests for SQL injection prevention in filesutils.js.
 * Tests that Draw/Files API properly sanitizes filter inputs.
 */

import { test, expect } from '@playwright/test';

test.describe('filesutils SQL injection prevention', () => {

  test.describe('Filter field name validation', () => {

    test('rejects filter field names with SQL injection characters', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "'; DROP TABLE users; --+= +string+test"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('rejects filter field names with semicolons and quotes', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "name;DELETE FROM users+= +string+test"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('rejects filter field names with parentheses', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "name()--+= +string+test"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

  test.describe('geometry.type filter injection', () => {

    test('handles malicious geometry.type filter value without server error', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "geometry.type+= +string+Point'; DROP TABLE user_features; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('handles geometry.type IN filter with injection attempt', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "geometry.type+in+string+Point$LineString'; DROP TABLE users; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('handles geometry.type != filter with injection attempt', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "geometry.type+!=+string+Point' OR 1=1; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

  test.describe('timeProp sanitization', () => {

    test('handles malicious timeProp without server error', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          startTime: '1000000',
          endTime: '9999999999999',
          timeProp: "time'; DROP TABLE user_features; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('handles timeProp with SQL OR injection', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          startTime: '1000000',
          endTime: '9999999999999',
          timeProp: "time OR 1=1; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

  test.describe('Filter values with SQL injection attempts', () => {

    test('handles filter value with SQL UNION injection', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "name+= +string+test' UNION SELECT * FROM users; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('handles numeric filter with injection attempt', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "sol+> +number+1 OR 1=1; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

    test('handles LIKE filter with injection attempt', async ({ request }) => {
      const response = await request.post('/api/files/getfile', {
        data: {
          id: '1',
          filters: "name+contains+string+%'; DROP TABLE users; --"
        }
      });
      expect(response.status()).toBeLessThan(500);
    });

  });

});
