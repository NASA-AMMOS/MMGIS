import { test, expect } from '@playwright/test';

/**
 * E2E tests for path traversal protection.
 * Verifies that the server rejects attempts to access files outside
 * the intended directory structure via directory traversal sequences.
 */

test.describe('Path Traversal Protection', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  const traversalPayloads = [
    '../../../etc/passwd',
    '..\\..\\..\\etc\\passwd',
    '%2e%2e%2f%2e%2e%2f',
    '....//....//....//etc/passwd',
  ];

  for (const payload of traversalPayloads) {
    test(`rejects path traversal: ${payload.substring(0, 20)}...`, async ({ request }) => {
      // Try various endpoints that accept file paths
      const response = await request.get(`${baseURL}/api/files/${payload}`);
      // The key assertion: server must not return sensitive file contents
      const body = await response.text();
      expect(body).not.toContain('root:');
      expect(body).not.toContain('/bin/bash');
    });
  }

  test('rejects path traversal in Missions path', async ({ request }) => {
    const response = await request.get(
      `${baseURL}/api/files/Missions/../../etc/passwd`
    );
    // The key assertion: server must not return sensitive file contents
    const body = await response.text();
    expect(body).not.toContain('root:');
    expect(body).not.toContain('/bin/bash');
  });

  test('rejects null byte injection in file path', async ({ request }) => {
    const response = await request.get(
      `${baseURL}/api/files/Missions/test%00.json`
    );
    // Should not return 200 with unexpected content
    expect(response.status()).not.toBe(500);
    const body = await response.text();
    expect(body).not.toContain('root:');
  });
});
