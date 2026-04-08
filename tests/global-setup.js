/**
 * Playwright global setup — runs once before all test suites.
 *
 * 1. Loads DB connection settings (DB_HOST, DB_PORT, DB_USER, DB_PASS)
 *    from the project `.env` file.
 * 2. **Forces DB_NAME to `mmgis_test`** — regardless of what `.env` says.
 *    This guarantees tests never touch a production database.
 * 3. Creates the `mmgis_test` database if it doesn't already exist,
 *    initialising it the same way `scripts/init-db.js` does (PostGIS,
 *    btree_gist, session table).
 * 4. Sets `process.env.DB_NAME = 'mmgis_test'` so the MMGIS server
 *    (started by Playwright's `webServer` option) uses the test DB.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import pgPromise from 'pg-promise';

/** Hardcoded test database name — never changes. */
const TEST_DB_NAME = 'mmgis_test';

/**
 * Read a value from the `.env` file by key. Returns `undefined` when
 * the file doesn't exist or the key isn't present.
 */
function readDotenvValue(key) {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const contents = readFileSync(envPath, 'utf8');
    const match = contents.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    // .env not found — fall through
  }
  return undefined;
}

export default async function globalSetup() {
  // Load .env so we can read DB_HOST / DB_PORT / DB_USER / DB_PASS
  config({ path: resolve(process.cwd(), '.env') });

  // Read connection settings (with sensible defaults)
  const dbHost = process.env.DB_HOST || readDotenvValue('DB_HOST') || 'localhost';
  const dbPort = process.env.DB_PORT || readDotenvValue('DB_PORT') || '5432';
  const dbUser = process.env.DB_USER || readDotenvValue('DB_USER') || 'mmgis';
  const dbPass = process.env.DB_PASS || readDotenvValue('DB_PASS') || 'mmgis';

  // Force DB_NAME to the hardcoded test database
  process.env.DB_NAME = TEST_DB_NAME;

  // ── Create the test database if it doesn't exist ──────────────
  const pgp = pgPromise();
  // Connect to the default `postgres` maintenance database
  const adminDb = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: 'postgres',
  });

  try {
    // Check whether the test database already exists
    const exists = await adminDb.oneOrNone(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );

    if (!exists) {
      // CREATE DATABASE cannot run inside a transaction
      await adminDb.none('CREATE DATABASE $1:name', [TEST_DB_NAME]);
      console.log(`[global-setup] Created database "${TEST_DB_NAME}".`);
    } else {
      console.log(`[global-setup] Database "${TEST_DB_NAME}" already exists.`);
    }
  } catch (err) {
    console.error(`[global-setup] Failed to create database "${TEST_DB_NAME}":`, err.message);
    throw err;
  } finally {
    pgp.end(); // release the admin connection
  }

  // ── Initialise extensions & session table ─────────────────────
  const pgp2 = pgPromise();
  const testDb = pgp2({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: TEST_DB_NAME,
  });

  try {
    await testDb.none('CREATE EXTENSION IF NOT EXISTS postgis');
    await testDb.none('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await testDb.none(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    await testDb.none(
      'CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")',
    );
    console.log(`[global-setup] Database "${TEST_DB_NAME}" is ready.`);
  } catch (err) {
    console.error(`[global-setup] Failed to initialise "${TEST_DB_NAME}":`, err.message);
    throw err;
  } finally {
    pgp2.end();
  }
}
