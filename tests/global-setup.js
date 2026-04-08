/**
 * Playwright global setup — runs once before all test suites.
 *
 * Safety guard: refuses to run E2E tests when the configured DB_NAME
 * looks like a production database. This prevents accidental data
 * corruption if someone runs `npm run test:e2e` without switching
 * their .env to the test database first.
 *
 * Allowed DB_NAME values must contain "test" (case-insensitive),
 * e.g. "mmgis_test", "test_mmgis", "mmgis-test-db".
 *
 * The guard reads DB_NAME from both `process.env` AND directly from
 * the `.env` file (in case dotenv fails to load it). If DB_NAME is
 * found from either source and does NOT contain "test", the run is
 * blocked. If DB_NAME is not found anywhere, the run is also blocked
 * to be safe — E2E tests should always target an explicit test DB.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

export default async function globalSetup() {
  // Try to load .env via dotenv
  config({ path: resolve(process.cwd(), '.env') });

  // Also parse .env directly as a fallback (in case dotenv import
  // didn't work correctly with the project's module system)
  let dotenvDbName;
  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContents = readFileSync(envPath, 'utf8');
    const match = envContents.match(/^DB_NAME\s*=\s*(.+)$/m);
    if (match) {
      dotenvDbName = match[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env file doesn't exist — that's fine, we'll check process.env
  }

  // Use whichever source found DB_NAME (prefer process.env, fall back
  // to direct .env parse)
  const dbName = process.env.DB_NAME || dotenvDbName;

  if (!dbName) {
    const msg = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  SAFETY: DB_NAME is not set                                ║',
      '║                                                            ║',
      '║  E2E tests require an explicit test database name          ║',
      '║  containing "test" (e.g. "mmgis_test").                    ║',
      '║                                                            ║',
      '║  Set DB_NAME in your .env file or run:                     ║',
      '║                                                            ║',
      '║    DB_NAME=mmgis_test npm run test:e2e                     ║',
      '║                                                            ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
    ].join('\n');
    throw new Error(msg);
  }

  if (!/test/i.test(dbName)) {
    const msg = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  SAFETY: DB_NAME does not contain "test"                   ║',
      '║                                                            ║',
      `║  Current DB_NAME: ${dbName.padEnd(41)}║`,
      '║                                                            ║',
      '║  Refusing to run tests against a potentially production    ║',
      '║  database. Set DB_NAME to a value containing "test"        ║',
      '║  (e.g. "mmgis_test") in your .env file, or run:           ║',
      '║                                                            ║',
      '║    DB_NAME=mmgis_test npm run test:e2e                     ║',
      '║                                                            ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
    ].join('\n');

    throw new Error(msg);
  }
}
