/**
 * Unit tests for adjacent-servers/mode.js and the start scripts: which mode
 * ADJACENT_SERVERS_MODE resolves to, and that a server starts without a
 * per-server .env (issue #1138).
 */

import { test, expect } from '@playwright/test';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveAdjacentServersMode } = require('../../adjacent-servers/mode');

test.describe('resolveAdjacentServersMode', () => {
  test('an explicit mode wins over container detection', () => {
    expect(resolveAdjacentServersMode('embedded', true)).toEqual({ mode: 'embedded', source: 'env' });
    expect(resolveAdjacentServersMode('external', false)).toEqual({ mode: 'external', source: 'env' });
    expect(resolveAdjacentServersMode(' External ', false).mode).toBe('external');
  });

  test('unset defaults to external in a container and embedded outside', () => {
    for (const unset of [undefined, '', '  ']) {
      expect(resolveAdjacentServersMode(unset, true)).toEqual({ mode: 'external', source: 'container' });
      expect(resolveAdjacentServersMode(unset, false)).toEqual({ mode: 'embedded', source: 'host' });
    }
  });

  test('an unknown value falls back to the default and is reported', () => {
    expect(resolveAdjacentServersMode('docker', true)).toEqual({
      mode: 'external',
      source: 'container',
      invalid: 'docker',
    });
    expect(resolveAdjacentServersMode('true', false).mode).toBe('embedded');
  });
});

test.describe('start scripts', () => {
  test.skip(process.platform === 'win32', 'sh scripts');

  const servers = ['stac', 'tipg', 'titiler', 'titiler-pgstac'];

  // Runs a start script with a fake `python` that prints its arguments
  function run(server, withEnv) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-start-'));
    try {
      const script = `start-${server}.sh`;
      fs.copyFileSync(path.resolve('adjacent-servers', server, script), path.join(dir, script));
      fs.writeFileSync(path.join(dir, 'python'), '#!/bin/sh\necho "$@"\n', { mode: 0o755 });
      if (withEnv) fs.writeFileSync(path.join(dir, '.env'), 'A=1\n');
      return execFileSync('sh', [script, '8883'], {
        cwd: dir,
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
      })
        .toString()
        .trim();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  for (const server of servers) {
    test(`${server} starts uvicorn directly without a .env`, () => {
      expect(run(server, false)).toMatch(/^-m uvicorn \S+ --port 8883$/);
    });

    test(`${server} loads a .env when there is one`, () => {
      expect(run(server, true)).toMatch(/^-m dotenv run python -m uvicorn \S+ --port 8883$/);
    });
  }
});
