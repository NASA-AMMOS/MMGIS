/**
 * Playwright global setup — runs once before all test suites.
 *
 * 1. Loads DB connection settings (DB_HOST, DB_PORT, DB_USER, DB_PASS)
 *    from the project `.env` file.
 * 2. **Forces DB_NAME to `mmgis-test`** — regardless of what `.env` says.
 *    This guarantees tests never touch a production database.
 * 3. Creates the `mmgis-test` database if it doesn't already exist
 *    (connects to the `postgres` maintenance DB which always exists).
 * 4. Sets up PostGIS / btree_gist extensions and the session table
 *    directly on the test database.
 * 5. Runs schema migrations (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
 *    to handle columns that were added after initial table creation,
 *    preventing race conditions in the server's startup hooks.
 * 6. Starts a temporary MMGIS server and creates the Reference Mission
 *    if it doesn't already exist — so every test suite can navigate to
 *    /?mission=Reference-Mission without hitting a 404.
 * 7. Sets `process.env.DB_NAME = 'mmgis-test'` so the MMGIS server
 *    (started by Playwright's `webServer` option) uses the test DB.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { execSync, spawn } from 'child_process';
import pgPromise from 'pg-promise';

/** Hardcoded test database name — never changes. */
const TEST_DB_NAME = 'mmgis-test';

/** Port used by the temporary setup server (avoids conflicts with 8888). */
const SETUP_PORT = 18888;

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
  // We connect to the `postgres` maintenance DB (which always exists)
  // rather than the user's default DB (which may not exist after a
  // test:clean run).
  const pgp = pgPromise();
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
    pgp.end();
  }

  // ── 2. Set up extensions and session table directly ─────────────
  // We set these up directly rather than calling init-db.js because
  // init-db.js uses Sequelize(null, ...) which defaults to a DB
  // named after the user — that DB may not exist on a fresh system.
  const pgp2 = pgPromise();
  const testDb = pgp2({
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
    pgp2.end();
  }

  // ── 4. Ensure Reference Mission exists ──────────────────────────
  await ensureReferenceMission(dbHost, dbPort, dbUser, dbPass);

  console.log(`[global-setup] Done — "${TEST_DB_NAME}" is ready.`);
}

// ─── Reference Mission helper ──────────────────────────────────────

async function ensureReferenceMission(dbHost, dbPort, dbUser, dbPass) {
  // Quick check: if the configs table has a Reference-Mission row,
  // we can skip the expensive server start entirely.
  const pgp = pgPromise();
  const db = pgp({
    host: dbHost,
    port: Number(dbPort),
    user: dbUser,
    password: dbPass,
    database: TEST_DB_NAME,
  });

  try {
    const hasTable = await db.oneOrNone(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'configs'",
    );
    if (hasTable) {
      const hasMission = await db.oneOrNone(
        "SELECT 1 FROM configs WHERE mission = 'Reference-Mission' LIMIT 1",
      );
      if (hasMission) {
        console.log('[global-setup] Reference Mission already exists — skipping.');
        return;
      }
    }
  } catch {
    // Table doesn't exist yet — we'll create the mission below.
  } finally {
    pgp.end();
  }

  // Start a temporary MMGIS server on SETUP_PORT to create the
  // Reference Mission via the API.  Sequelize.sync() inside the
  // server will also create all application tables for us.
  console.log(
    `[global-setup] Starting temp server on port ${SETUP_PORT} to create Reference Mission...`,
  );

  const serverEnv = {
    ...process.env,
    DB_NAME: TEST_DB_NAME,
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_USER: dbUser,
    DB_PASS: dbPass,
    NODE_ENV: 'test',
    PORT: String(SETUP_PORT),
    HIDE_CONFIG: 'false',
  };

  const server = spawn('node', [resolve(process.cwd(), 'scripts/server.js')], {
    env: serverEnv,
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  // Capture output for debugging
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });

  try {
    // Wait for healthcheck
    await waitForServer(
      `http://localhost:${SETUP_PORT}/api/utils/healthcheck`,
      90_000,
    );
    console.log(`[global-setup] Temp server ready.`);

    const url = `http://localhost:${SETUP_PORT}`;
    const cookieJar = '/tmp/mmgis-test-setup-cookies.txt';
    try { if (existsSync(cookieJar)) unlinkSync(cookieJar); } catch { /* ignore */ }

    // Create admin user via first_signup (safe to fail if user exists)
    execSafe(
      `curl -sf -X POST ${url}/api/users/first_signup`
      + ` -H "Content-Type: application/json"`
      + ` -d '{"username":"test_admin","password":"TestAdmin1!"}'`,
    );

    // Login as admin to get a session cookie
    execSafe(
      `curl -sf -c "${cookieJar}" -X POST ${url}/api/users/login`
      + ` -H "Content-Type: application/json"`
      + ` -d '{"username":"test_admin","password":"TestAdmin1!"}'`,
    );

    // Create Reference Mission — try with auth cookie first
    let result = execSafe(
      `curl -sf -b "${cookieJar}" -X POST ${url}/api/configure/add`
      + ` -H "Content-Type: application/json"`
      + ` -d '{"setupReferenceMission":true}'`,
    );

    // Fallback: try without auth (AUTH=off may not need cookies)
    if (!result) {
      result = execSafe(
        `curl -sf -X POST ${url}/api/configure/add`
        + ` -H "Content-Type: application/json"`
        + ` -d '{"setupReferenceMission":true}'`,
      );
    }

    if (result) {
      console.log(`[global-setup] Reference Mission created: ${result.slice(0, 200)}`);
    } else {
      console.warn(
        '[global-setup] Could not create Reference Mission — some UI tests may 404.',
      );
    }

    // Clean up
    try { if (existsSync(cookieJar)) unlinkSync(cookieJar); } catch { /* ignore */ }
  } catch (err) {
    console.error('[global-setup] Reference Mission setup error:', err.message);
    if (serverLog) {
      console.error('[global-setup] Server log (tail):', serverLog.slice(-1000));
    }
    // Don't throw — the tests will fail individually with clear errors
  } finally {
    // Kill the temp server and wait for the port to be released
    server.kill('SIGTERM');
    await sleep(2000);
    try { server.kill('SIGKILL'); } catch { /* already dead */ }
    await sleep(500);
  }
}

// ─── Utilities ─────────────────────────────────────────────────────

/** Poll a URL until it returns HTTP 200.  Throws on timeout. */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const code = execSync(
        `curl -sf -o /dev/null -w "%{http_code}" "${url}"`,
        { timeout: 5000, stdio: 'pipe' },
      ).toString().trim();
      if (code === '200') return;
    } catch { /* not ready yet */ }
    await sleep(1000);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

/** execSync wrapper that returns stdout on success, null on failure. */
function execSafe(cmd) {
  try {
    return execSync(cmd, { timeout: 30_000, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
