/**
 * Drop the `mmgis-test` and `mmgis-stac-test` databases.
 *
 * Usage:  npm run test:clean
 *
 * Reads DB_HOST / DB_PORT / DB_USER_TEST / DB_PASS_TEST from the project
 * `.env` and drops the hardcoded test databases. Safe to run at any time
 * — only ever touches test databases.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import pgPromise from 'pg-promise';

const TEST_DB_NAME = 'mmgis-test';
const TEST_STAC_DB_NAME = 'mmgis-stac-test';

function readDotenvValue(key) {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const contents = readFileSync(envPath, 'utf8');
    const match = contents.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    // .env not found
  }
  return undefined;
}

async function clean() {
  config({ path: resolve(process.cwd(), '.env') });

  // ── Production environment fail-safe ──────────────────────────
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '\u26A0\uFE0F DANGER: Refusing to run test operations because NODE_ENV is set to "production". ' +
      'Tests must never be executed against a production environment.'
    );
  }

  const dbHost = process.env.DB_HOST || readDotenvValue('DB_HOST') || 'localhost';
  const dbPort = process.env.DB_PORT || readDotenvValue('DB_PORT') || '5432';

  // Use dedicated test DB credentials (DB_USER_TEST / DB_PASS_TEST) to enforce
  // least-privilege separation between CI/test and production database roles.
  // No fallback — test-db-clean must use explicit test credentials.
  const dbUser = process.env.DB_USER_TEST || readDotenvValue('DB_USER_TEST');
  const dbPass = process.env.DB_PASS_TEST || readDotenvValue('DB_PASS_TEST');

  if (!dbUser || !dbPass) {
    throw new Error(
      'DB_USER_TEST and DB_PASS_TEST must be set for test database cleanup. ' +
      'Set them in your environment or .env file.'
    );
  }

  const pgp = pgPromise();
  const db = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: 'postgres',
  });

  try {
    // Drop mmgis-test
    const exists = await db.oneOrNone(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );

    if (exists) {
      await db.none(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [TEST_DB_NAME],
      );
      await db.none('DROP DATABASE $1:name', [TEST_DB_NAME]);
      console.log(`Dropped database "${TEST_DB_NAME}".`);
    } else {
      console.log(`Database "${TEST_DB_NAME}" does not exist — skipping.`);
    }

    // Drop mmgis-stac-test (independent of main test DB)
    const stacExists = await db.oneOrNone(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_STAC_DB_NAME],
    );

    if (stacExists) {
      await db.none(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [TEST_STAC_DB_NAME],
      );
      await db.none('DROP DATABASE $1:name', [TEST_STAC_DB_NAME]);
      console.log(`Dropped database "${TEST_STAC_DB_NAME}".`);
    } else {
      console.log(`Database "${TEST_STAC_DB_NAME}" does not exist — skipping.`);
    }
  } catch (err) {
    console.error(`Failed to drop test databases:`, err.message);
    process.exit(1);
  } finally {
    pgp.end();
  }
}

clean().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
