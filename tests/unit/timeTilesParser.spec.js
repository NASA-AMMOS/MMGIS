/**
 * Unit tests for time-tile directory timestamp parsing.
 */

import { test, expect } from '@playwright/test';

const { parseTilesetTimeDir } = require('../../plugins/core/backend/Utils/routes/timeTiles');

test.describe('parseTilesetTimeDir', () => {
  test('parses bare timestamps and supported tag delimiters', () => {
    expect(parseTilesetTimeDir('2022-09-07T00_00_00Z')).toEqual({
      t: '2022-09-07T00:00:00Z',
      n: '',
    });
    expect(parseTilesetTimeDir('2022-09-07T00_00_00Z-Name').n).toBe('Name');
    expect(parseTilesetTimeDir('2022-09-07T00_00_00Z--Name').n).toBe('Name');
    expect(parseTilesetTimeDir('2022-09-07T00_00_00Z_Name').n).toBe('Name');
  });

  test('uses the start of a time range and keeps the remainder as the name', () => {
    expect(
      parseTilesetTimeDir(
        '2022-09-07T00_00_00Z-to-2022-10-01T00_00_00Z--Name'
      )
    ).toEqual({
      t: '2022-09-07T00:00:00Z',
      n: 'to-2022-10-01T00_00_00Z--Name',
    });
  });

  test('accepts fractional seconds and colon separators', () => {
    expect(parseTilesetTimeDir('2023-03-04T14:00:30.123Z_ORR')).toEqual({
      t: '2023-03-04T14:00:30.123Z',
      n: 'ORR',
    });
  });

  test('skips names without valid leading timestamps', () => {
    expect(parseTilesetTimeDir('not-a-time')).toBeNull();
    expect(parseTilesetTimeDir('2023-02-30T14_00_30Z')).toBeNull();
  });
});
