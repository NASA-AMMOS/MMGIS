/**
 * Cross-worker mutex for the generated plugin registries.
 *
 * `src/pre/*.js` and `configure/public/*Configs.json` are single copies in the
 * repo, so any spec that regenerates them (directly, or by running the CLI)
 * races every other spec asserting on them — Playwright runs spec files in
 * parallel workers locally. Wrap both the regeneration and the assertions that
 * read it, so a fixture written by one worker can't be generated away by
 * another mid-test.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const LOCK_DIR = path.join(os.tmpdir(), 'mmgis-test-registry.lock');
const STALE_MS = 60000;

// A lock is a directory: mkdir is atomic on every platform we run on.
/* global Atomics, SharedArrayBuffer */
function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquire() {
    for (;;) {
        try {
            fs.mkdirSync(LOCK_DIR);
            return;
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
            // Reclaim a lock left behind by a killed worker.
            let age = 0;
            try {
                age = Date.now() - fs.statSync(LOCK_DIR).mtimeMs;
            } catch {
                continue;
            }
            if (age > STALE_MS) {
                try {
                    fs.rmdirSync(LOCK_DIR);
                } catch {
                    // another worker won the reclaim
                }
                continue;
            }
            sleepSync(25);
        }
    }
}

function release() {
    try {
        fs.rmdirSync(LOCK_DIR);
    } catch {
        // already released
    }
}

/** Run `fn` with exclusive access to the generated registries. */
function withRegistryLock(fn) {
    acquire();
    try {
        return fn();
    } finally {
        release();
    }
}

module.exports = { withRegistryLock };
