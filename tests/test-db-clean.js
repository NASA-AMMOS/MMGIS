/**
 * Drop the `mmgis-test` database.
 *
 * Usage:  npm run test:clean
 *
 * Reads DB_HOST / DB_PORT / DB_USER / DB_PASS from the project `.env`
 * (or falls back to sensible defaults) and drops the hardcoded
 * `mmgis-test` database. Safe to run at any time — only ever touches
 * the test database.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import pgPromise from 'pg-promise';

const TEST_DB_NAME = 'mmgis-test';

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
      '\u26A0\uFE0F DANGER: Refusing to run destructive test operations because NODE_ENV is set to "production". ' +
      'Tests must never be executed against a production environment.'
    );
  }

  if (process.env.DATABASE_URL && /prod/i.test(process.env.DATABASE_URL)) {
    throw new Error(
      '\u26A0\uFE0F DANGER: DATABASE_URL appears to reference a production database. Aborting test setup.'
    );
  }

  const dbHost = process.env.DB_HOST || readDotenvValue('DB_HOST') || 'localhost';
  const dbPort = process.env.DB_PORT || readDotenvValue('DB_PORT') || '5432';

  // Prefer test-specific DB credentials (DB_USER_TEST / DB_PASS_TEST) to enforce
  // least-privilege separation between CI/test and production database roles.
  // Falls back to DB_USER / DB_PASS for backward compatibility.
  const dbUser = process.env.DB_USER_TEST || readDotenvValue('DB_USER_TEST') || process.env.DB_USER || readDotenvValue('DB_USER') || 'mmgis';
  const dbPass = process.env.DB_PASS_TEST || readDotenvValue('DB_PASS_TEST') || process.env.DB_PASS || readDotenvValue('DB_PASS') || 'mmgis';

  process.env.DB_USER = dbUser;
  process.env.DB_PASS = dbPass;

  const pgp = pgPromise();
  const db = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: 'postgres',
  });

  try {
    const exists = await db.oneOrNone(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );

    if (!exists) {
      console.log(`Database "${TEST_DB_NAME}" does not exist. Nothing to clean.`);
      return;
    }

    // Terminate active connections before dropping
    await db.none(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME],
    );

    await db.none('DROP DATABASE $1:name', [TEST_DB_NAME]);
    console.log(`Dropped database "${TEST_DB_NAME}".`);
  } catch (err) {
    console.error(`Failed to drop "${TEST_DB_NAME}":`, err.message);
    process.exit(1);
  } finally {
    pgp.end();
  }
}

clean();
