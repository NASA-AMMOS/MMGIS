const { test, expect } = require('@playwright/test');
const path = require('path');

const { localLoginRefusal } = require(path.resolve(__dirname, '../routes.js'));

test.describe('Local login refusals', () => {
  test('an account linked to a login provider cannot sign in with a local password', async () => {
    const linked = { AuthIdentity: { count: async ({ where }) => (where.user_id === 7 ? 1 : 0) } };
    expect(await localLoginRefusal(7, linked)).toBe('This account signs in through its login provider.');
    expect(await localLoginRefusal(8, linked)).toBeNull();
  });

  test('a link to a provider no longer in AUTH_PROVIDERS does not refuse the local password', async () => {
    const { Op } = require('sequelize');
    const enabled = require(path.resolve(__dirname, '../../../../../API/permissions/providers.js')).availableProviders()[0];
    const rows = [{ user_id: 7, provider: 'retired-provider' }];
    const models = {
      AuthIdentity: {
        count: async ({ where }) => rows.filter((r) => r.user_id === where.user_id && where.provider[Op.in].includes(r.provider)).length,
      },
    };
    expect(await localLoginRefusal(7, models)).toBeNull();
    rows[0].provider = enabled;
    expect(await localLoginRefusal(7, models)).toBe('This account signs in through its login provider.');
  });
});
