/**
 * Unit tests for Webhooks entries response formatting.
 */

import { test, expect } from '@playwright/test';
const path = require('path');

const buildEntriesResponse = require(path.resolve(
  __dirname,
  '../../plugins/core/backend/Webhooks/routes/buildEntriesResponse.js'
));

test.describe('Webhooks entries response', () => {
  test('returns an empty successful response when no configuration exists', () => {
    expect(buildEntriesResponse([])).toEqual({
      status: 'success',
      body: { entries: [] },
    });
  });

  test('maps stored configurations to API entries', () => {
    const updatedAt = new Date('2026-09-20T00:00:00.000Z');

    expect(
      buildEntriesResponse([
        { config: '{"webhooks":[]}', updatedAt },
      ])
    ).toEqual({
      status: 'success',
      body: {
        entries: [
          { config: '{"webhooks":[]}', updated: updatedAt },
        ],
      },
    });
  });
});
