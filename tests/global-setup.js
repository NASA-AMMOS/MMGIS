/**
 * Playwright global setup — runs once before all test suites.
 *
 * IMPORTANT: Playwright runs webServer plugins BEFORE globalSetup.
 * Therefore we manage the MMGIS server ourselves here (not via the
 * webServer config option) so we can guarantee the database exists
 * before the server starts.
 *
 * Order of operations:
 * 1. Loads DB connection settings from `.env` (DB_HOST, DB_PORT, etc.)
 * 2. Forces DB_NAME to `mmgis-test` — tests never touch production.
 * 3. Creates the `mmgis-test` database if it doesn't exist
 *    (connects to `postgres` maintenance DB which always exists).
 * 4. Sets up PostGIS / btree_gist extensions and session table.
 * 5. Runs schema migrations (ADD COLUMN IF NOT EXISTS).
 * 6. Starts the MMGIS server on port 18888 (or TEST_PORT).
 * 7. Creates admin user + Reference Mission via the API if needed.
 * 8. Returns a teardown function that kills the server when tests end.
 *
 * All HTTP calls use Node's native fetch() for cross-platform support
 * (works on Windows, Linux, macOS without requiring curl).
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import pgPromise from 'pg-promise';

/** Hardcoded test database name — never changes. */
const TEST_DB_NAME = 'mmgis-test';

/** Port the test server listens on. */
const TEST_PORT = Number(process.env.TEST_PORT || 18888);

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

  // Single pg-promise instance — the library requires exactly one
  // initialization per process.
  const pgp = pgPromise();

  // ── Create the test database if it doesn't exist ──────────────
  // We connect to the `postgres` maintenance DB (which always exists)
  // rather than the user's default DB (which may not exist after a
  // test:clean run).
  const adminDb = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: 'postgres',
  });

  try {
    const exists = await adminDb.oneOrNone(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );

    if (!exists) {
      await adminDb.none('CREATE DATABASE $1:name', [TEST_DB_NAME]);
      console.log(`[global-setup] Created database "${TEST_DB_NAME}".`);
    } else {
      console.log(`[global-setup] Database "${TEST_DB_NAME}" already exists.`);
    }
  } catch (err) {
    console.error(`[global-setup] Failed to create database "${TEST_DB_NAME}":`, err.message);
    throw err;
  } finally {
    await adminDb.$pool.end();
  }

  // ── 2. Set up extensions and session table directly ─────────────
  // We set these up directly rather than calling init-db.js because
  // init-db.js uses Sequelize(null, ...) which defaults to a DB
  // named after the user — that DB may not exist on a fresh system.
  const testDb = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: TEST_DB_NAME,
  });

  try {
    // Extensions (same as init-db.js)
    await testDb.none('CREATE EXTENSION IF NOT EXISTS postgis');
    await testDb.none('CREATE EXTENSION IF NOT EXISTS btree_gist');
    console.log(`[global-setup] Extensions ready.`);

    // Session table (same as init-db.js)
    await testDb.none(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `);
    await testDb.none(
      'CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")',
    );
    console.log(`[global-setup] Session table ready.`);

    // ── 3. Schema migrations ────────────────────────────────────────
    // Safe no-ops when columns already exist.
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

    console.log(`[global-setup] Schema migrations applied.`);
  } catch (err) {
    console.error(`[global-setup] DB setup failed:`, err.message);
    throw err;
  } finally {
    await testDb.$pool.end();
  }

  // ── 4. Check if Reference Mission already exists ────────────────
  let needsMission = true;
  const checkDb = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: TEST_DB_NAME,
  });
  try {
    const hasTable = await checkDb.oneOrNone(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'configs'",
    );
    if (hasTable) {
      const hasMission = await checkDb.oneOrNone(
        "SELECT 1 FROM configs WHERE mission = 'Reference-Mission' LIMIT 1",
      );
      if (hasMission) {
        console.log('[global-setup] Reference Mission already exists.');
        needsMission = false;
      }
    }
  } catch {
    // Table doesn't exist yet — will create mission below.
  } finally {
    await checkDb.$pool.end();
  }

  // Done with pg-promise
  pgp.end();

  // ── 5. Start the MMGIS test server ──────────────────────────────
  // We start it here (not via playwright.config.js webServer) because
  // Playwright runs webServer plugins BEFORE globalSetup — so the DB
  // wouldn't exist yet when the server tries to connect.
  const serverEnv = {
    ...process.env,
    DB_NAME: TEST_DB_NAME,
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_USER: dbUser,
    DB_PASS: dbPass,
    NODE_ENV: 'test',
    PORT: String(TEST_PORT),
    HIDE_CONFIG: 'false',
  };

  const server = spawn('node', [resolve(process.cwd(), 'scripts/server.js')], {
    env: serverEnv,
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => {
    process.stdout.write(`[WebServer] ${d.toString()}`);
  });
  server.stderr.on('data', (d) => {
    process.stderr.write(`[WebServer] ${d.toString()}`);
  });

  const baseUrl = `http://localhost:${TEST_PORT}`;
  const healthUrl = `${baseUrl}/api/utils/healthcheck`;

  // Helper to kill the server process (used in both teardown and error paths)
  const killServer = async () => {
    console.log('[global-teardown] Stopping test server...');
    server.kill('SIGTERM');
    await sleep(2000);
    try { server.kill('SIGKILL'); } catch { /* already dead */ }
    console.log('[global-teardown] Server stopped.');
  };

  console.log(`[global-setup] Starting MMGIS server on port ${TEST_PORT}...`);
  try {
    await waitForServer(healthUrl, 120_000);
  } catch (err) {
    // Server failed to start — kill the orphaned process before re-throwing
    await killServer();
    throw err;
  }
  console.log(`[global-setup] Server is ready.`);

  // ── 6. Create Reference Mission if needed ───────────────────────
  if (needsMission) {
    console.log('[global-setup] Creating Reference Mission...');
    try {
      // Create admin user (safe to fail if already exists)
      await fetchJSON(`${baseUrl}/api/users/first_signup`, {
        method: 'POST',
        body: { username: 'test_admin', password: 'TestAdmin1!' },  // pragma: allowlist secret
      }).catch(() => {});

      // Login to get session cookie
      const loginRes = await fetch(`${baseUrl}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_admin', password: 'TestAdmin1!' }),  // pragma: allowlist secret
        redirect: 'manual',
      });
      const rawCookies = loginRes.headers.getSetCookie?.() || [];
      // Strip Set-Cookie attributes (Path, HttpOnly, etc.) — Cookie header expects only name=value pairs
      const cookieHeader = rawCookies.map(c => c.split(';')[0].trim()).join('; ');

      // Create Reference Mission — try with auth cookie
      let result = await fetchJSON(`${baseUrl}/api/configure/add`, {
        method: 'POST',
        body: { setupReferenceMission: true },
        cookies: cookieHeader,
      }).catch(() => null);

      // Fallback: try without auth (AUTH=off may not need cookies)
      // Check for a proper JSON success response — HTML login pages are truthy strings.
      if (!result || typeof result !== 'object' || result.status !== 'success') {
        result = await fetchJSON(`${baseUrl}/api/configure/add`, {
          method: 'POST',
          body: { setupReferenceMission: true },
        }).catch(() => null);
      }

      if (result && typeof result === 'object' && result.status === 'success') {
        console.log(`[global-setup] Reference Mission created.`);
      } else {
        console.warn('[global-setup] Could not create Reference Mission — UI tests may 404.');
      }

      // Create test_user (non-admin, permission "001") if it doesn't exist.
      // The signup endpoint requires admin session or AUTH_LOCAL_ALLOW_SIGNUP=true.
      if (cookieHeader) {
        const signupResult = await fetchJSON(`${baseUrl}/api/users/signup`, {
          method: 'POST',
          body: {
            username: 'test_user',
            password: 'TestUser1!', // pragma: allowlist secret
            email: 'user@test.com',
          },
          cookies: cookieHeader,
        }).catch(() => null);

        if (signupResult && typeof signupResult === 'object' && signupResult.status === 'success') {
          console.log('[global-setup] test_user created.');
        } else {
          // May already exist — that's fine
          console.log('[global-setup] test_user already exists or signup not available.');
        }
      }
    } catch (err) {
      console.error('[global-setup] Reference Mission setup error:', err.message);
    }
  }

  console.log(`[global-setup] Done — "${TEST_DB_NAME}" is ready, server running on port ${TEST_PORT}.`);

  // Return teardown function — Playwright calls this after all tests.
  return killServer;
}

// ─── Utilities ─────────────────────────────────────────────────────

/** Poll a URL until it returns HTTP 200. Uses native fetch(). */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await sleep(1000);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

/** POST JSON and return parsed response. Uses native fetch(). */
async function fetchJSON(url, { method = 'GET', body, cookies } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) headers['Cookie'] = cookies;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
