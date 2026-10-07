/**
 * Unit tests for the reserved /Missions/shared folder name
 * (plugins/core/backend/Config/constants.js).
 */

import { test, expect } from '@playwright/test';
const {
  SHARED_MISSION_FOLDER_NAME,
  isReservedMissionName,
  reservedMissionNameMessage,
} = require('../../plugins/core/backend/Config/constants');

test.describe('shared mission folder name', () => {
  test('is reserved, case-insensitively and ignoring surrounding whitespace', () => {
    expect(isReservedMissionName(SHARED_MISSION_FOLDER_NAME)).toBe(true);
    expect(isReservedMissionName(SHARED_MISSION_FOLDER_NAME.toUpperCase())).toBe(true);
    expect(isReservedMissionName(` ${SHARED_MISSION_FOLDER_NAME} `)).toBe(true);
  });

  test('does not reserve ordinary mission names', () => {
    for (const name of [
      'MSL',
      `${SHARED_MISSION_FOLDER_NAME}_mission`,
      `my${SHARED_MISSION_FOLDER_NAME}`,
      '',
      null,
      undefined,
      42,
    ]) {
      expect(isReservedMissionName(name)).toBe(false);
    }
  });

  test('failure message names the reserved folder', () => {
    expect(reservedMissionNameMessage()).toBe(
      `Mission name '${SHARED_MISSION_FOLDER_NAME}' is reserved.`
    );
  });
});
