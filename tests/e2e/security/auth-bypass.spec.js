import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication bypass protection.
 * Verifies that admin-only and authenticated endpoints reject
 * unauthenticated requests properly.
 */

test.describe('Auth Bypass Protection', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  test.skip(process.env.MMGIS_TEST_AUTH_MODE === 'off', 'SKIP: Requires AUTH != off to test auth bypass');

  test('admin endpoints reject unauthenticated requests', async ({ request }) => {
    // Try admin-only endpoints without auth
    const endpoints = [
            { method: 'POST', path: '/api/configure/add', data: { mission: 'test_bypass_attempt' } },
            { method: 'POST', path: '/api/configure/destroy', data: { mission: 'test_bypass_attempt' } },
    ];

    for (const ep of endpoints) {
      const response = await request[ep.method.toLowerCase()](`${baseURL}${ep.path}`, {
        data: ep.data,
      });
      // Should NOT succeed (200 with status: success) without auth
      expect(response.status()).not.toBe(500);
      if (response.status() === 200) {
        const body = await response.json();
        // If the server returns 200, it should be a failure/auth error, not success
        expect(body.status).not.toBe('success');
      }
    }
  });

  test('account management endpoints reject unauthenticated requests', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/accounts/entries' },
      { method: 'POST', path: '/api/accounts/update', data: { id: 1, role: 'user' } },
      { method: 'DELETE', path: '/api/accounts/remove/999999' },
    ];

    for (const ep of endpoints) {
      const response = await request[ep.method.toLowerCase()](
        `${baseURL}${ep.path}`,
        ep.data ? { data: ep.data } : undefined
      );
      expect(response.status()).not.toBe(500);
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.status).not.toBe('success');
      }
    }
  });

  test('webhook endpoints reject unauthenticated requests', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/webhooks/entries' },
      { method: 'POST', path: '/api/webhooks/save', data: { config: {} } },
    ];

    for (const ep of endpoints) {
      const response = await request[ep.method.toLowerCase()](
        `${baseURL}${ep.path}`,
        ep.data ? { data: ep.data } : undefined
      );
      expect(response.status()).not.toBe(500);
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.status).not.toBe('success');
      }
    }
  });

  test('long term token endpoints reject unauthenticated requests', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/longtermtoken/get' },
      { method: 'POST', path: '/api/longtermtoken/generate', data: { name: 'bypass_test', period: '1d' } },
      { method: 'POST', path: '/api/longtermtoken/clear', data: { id: 999999 } },
    ];

    for (const ep of endpoints) {
      const response = await request[ep.method.toLowerCase()](
        `${baseURL}${ep.path}`,
        ep.data ? { data: ep.data } : undefined
      );
      expect(response.status()).not.toBe(500);
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.status).not.toBe('success');
      }
    }
  });

  test('cannot escalate privileges via forged role values', async ({ request }) => {
    // Try to grant the superadmin role, which should not be allowed without a session
    const response = await request.post(`${baseURL}/api/accounts/update`, {
      data: { id: 2, role: 'superadmin' },
    });
    expect(response.status()).not.toBe(500);
    if (response.status() === 200) {
      const body = await response.json();
      // Only a SuperAdmin session may grant roles
      // so this must fail
      expect(body.status).not.toBe('success');
    }
  });
});
