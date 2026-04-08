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
 * If DB_NAME is not set at all, the check is skipped (the server
 * may not be managed by the test runner).
 */

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { resolve } from 'path';

export default async function globalSetup() {
  // Load .env from the project root so DB_NAME is available
  const env = dotenv.config({ path: resolve(process.cwd(), '.env') });
  dotenvExpand.expand(env);

  const dbName = process.env.DB_NAME;

  // If DB_NAME is set, verify it looks like a test database
  if (dbName && !/test/i.test(dbName)) {
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
