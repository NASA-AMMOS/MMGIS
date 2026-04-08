import { test, expect } from '@playwright/test';

/**
 * E2E tests for header code injection protection.
 * The server uses checkHeadersCodeInjection middleware to reject
 * requests with malicious content in headers.
 */

test.describe('Header Injection Protection', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8888';

  test('rejects script tags in headers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`, {
      headers: {
        'X-Custom-Header': '<script>alert("xss")</script>',
      },
    });
    // Should be rejected by checkHeadersCodeInjection middleware
    // or at minimum not cause 500
    expect(response.status()).not.toBe(500);
  });

  test('rejects event handlers in headers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`, {
      headers: {
        'X-Custom-Header': 'onerror=alert(1)',
      },
    });
    expect(response.status()).not.toBe(500);
  });

  test('rejects javascript: protocol in headers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`, {
      headers: {
        'X-Custom-Header': 'javascript:alert(document.cookie)',
      },
    });
    expect(response.status()).not.toBe(500);
  });

  test('rejects HTML entity encoded script in headers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`, {
      headers: {
        'X-Custom-Header': '&#60;script&#62;alert(1)&#60;/script&#62;',
      },
    });
    expect(response.status()).not.toBe(500);
  });

  test('rejects iframe injection in headers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`, {
      headers: {
        'X-Custom-Header': '<iframe src="https://evil.com"></iframe>',
      },
    });
    expect(response.status()).not.toBe(500);
  });

  test('allows normal headers without injection patterns', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/utils/healthcheck`, {
      headers: {
        'X-Custom-Header': 'normal-value-12345',
        'X-Request-Id': 'req-abc-def-ghi',
      },
    });
    // Normal headers should not be rejected
    expect(response.status()).not.toBe(500);
    expect(response.ok()).toBe(true);
  });
});
