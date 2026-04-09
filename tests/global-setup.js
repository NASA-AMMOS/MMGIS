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

    // ── Run schema migrations ─────────────────────────────────────
    // The MMGIS server uses sequelize.sync() (without alter) so new
    // columns added to models after initial table creation are NOT
    // applied automatically. The app has its own up() migration
    // functions that run ALTER TABLE … ADD COLUMN IF NOT EXISTS, but
    // some of them are async-but-not-awaited, creating a race with
    // queries that reference the new columns (e.g. publicity_type).
    //
    // To keep the test DB schema in sync we run the same ALTER TABLE
    // statements here — they are safe no-ops when the columns already
    // exist.
    const migrations = [
      // user_files (Draw/models/userfiles.js)
      'ALTER TABLE IF EXISTS user_files ADD COLUMN IF NOT EXISTS template json NULL',
      'ALTER TABLE IF EXISTS user_files ADD COLUMN IF NOT EXISTS publicity_type varchar(255) NULL',
      'ALTER TABLE IF EXISTS user_files ADD COLUMN IF NOT EXISTS public_editors text[] NULL',
      // Same columns on the test variant table
      'ALTER TABLE IF EXISTS user_files_tests ADD COLUMN IF NOT EXISTS template json NULL',
      'ALTER TABLE IF EXISTS user_files_tests ADD COLUMN IF NOT EXISTS publicity_type varchar(255) NULL',
      'ALTER TABLE IF EXISTS user_files_tests ADD COLUMN IF NOT EXISTS public_editors text[] NULL',
      // file_histories (Draw/models/filehistories.js)
      'ALTER TABLE IF EXISTS file_histories ADD COLUMN IF NOT EXISTS author varchar(255) NULL',
      // users (Users/models/user.js)
      'ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS missions_managing TEXT[] NULL',
      'ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reset_token varchar(2048) NULL',
      'ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS reset_token_expiration BIGINT NULL',
      // geodatasets (Geodatasets/models/geodatasets.js)
      'ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS filename varchar(255) NULL',
      'ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS num_features INTEGER NULL',
      'ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS start_time_field varchar(255) NULL',
      'ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS end_time_field varchar(255) NULL',
      'ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS group_id_field varchar(255) NULL',
      'ALTER TABLE IF EXISTS geodatasets ADD COLUMN IF NOT EXISTS feature_id_field varchar(255) NULL',
      // long_term_tokens (LongTermToken/models/longtermtokens.js)
      'ALTER TABLE IF EXISTS long_term_tokens ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER NULL',
    ];
    for (const sql of migrations) {
      await testDb.none(sql);
    }

    console.log(`[global-setup] Database "${TEST_DB_NAME}" is ready (schema up to date).`);
  } catch (err) {
    console.error(`[global-setup] Failed to initialise "${TEST_DB_NAME}":`, err.message);
    throw err;
  } finally {
    pgp2.end();
  }
}
