import { test, expect } from '@playwright/test';

/**
 * Sequelize ORM unit tests.
 *
 * Validates that the Sequelize module exports the classes, data types,
 * and operators used across MMGIS backend models.
 */

test.describe('Sequelize module', () => {
  test('exports expected classes and operators', async () => {
    const { Sequelize, DataTypes, Op } = await import('sequelize');
    expect(Sequelize).toBeDefined();
    expect(DataTypes).toBeDefined();
    expect(DataTypes.STRING).toBeDefined();
    expect(DataTypes.INTEGER).toBeDefined();
    expect(DataTypes.JSON).toBeDefined();
    expect(DataTypes.GEOMETRY).toBeDefined();
    expect(Op).toBeDefined();
    expect(Op.and).toBeDefined();
    expect(Op.or).toBeDefined();
    expect(Op.like).toBeDefined();
  });

  test('can construct a Postgres instance without throwing', async () => {
    const { Sequelize } = await import('sequelize');
    const seq = new Sequelize({  // pragma: allowlist secret
      dialect: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      logging: false,
      dialectOptions: { connectTimeout: 1 },
    });
    expect(seq).toBeDefined();
    expect(seq.config.database).toBe('testdb');
    await seq.close();
  });
});
