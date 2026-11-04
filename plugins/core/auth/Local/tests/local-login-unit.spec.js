const { test, expect } = require('@playwright/test');
const path = require('path');

const { localLoginRefusal } = require(path.resolve(__dirname, '../routes.js'));

test.describe('Local login refusals', () => {
  test('an account linked to a login provider cannot sign in with a local password', async () => {
    const linked = { AuthIdentity: { count: async ({ where }) => (where.user_id === 7 ? 1 : 0) } };
    expect(await localLoginRefusal(7, linked)).toBe('This account signs in through its login provider.');
    expect(await localLoginRefusal(8, linked)).toBeNull();
  });
});
