import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { EventEmitter } from 'events';
import { spawnSync } from 'child_process';
import { transformSync } from '@babel/core';

const root = path.resolve(__dirname, '../..');
const services = [
  ['stac', 'WITH_STAC', 'stac_fastapi.pgstac.app:app'],
  ['tipg', 'WITH_TIPG', 'tipg.main:app'],
  ['titiler', 'WITH_TITILER', 'titiler.application.main:app'],
  ['titiler-pgstac', 'WITH_TITILER_PGSTAC', 'titiler.pgstac.main:app'],
];

// Isolate process spawning and logging; execute the actual startup/proxy code.
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  let source = fs.readFileSync(filename, 'utf8');
  if (file.endsWith('/Tile/config.js')) {
    source = transformSync(source, {
      plugins: ['@babel/plugin-transform-modules-commonjs'],
      babelrc: false, configFile: false,
    }).code;
  }
  vm.runInNewContext(source, {
    module, exports: module.exports, process, Buffer, window: globalThis.window,
    require: (name) => name in mocks ? mocks[name] : localRequire(name),
  }, { filename });
  return module.exports;
}

let savedEnv;
test.beforeEach(() => {
  savedEnv = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (/^(WITH_|ADJACENT_SERVER|STAC_PORT|TIPG_PORT|TITILER.*PORT|VELOSERVER_PORT|ROOT_PATH)/.test(key)) {
      delete process.env[key];
    }
  }
});
test.afterEach(() => {
  process.env = savedEnv;
  delete globalThis.window;
});

test('mode defaults to embedded and rejects invalid deployment modes', () => {
  const getMode = require('../../adjacent-servers/mode');
  expect(getMode()).toBe('embedded');
  process.env.ADJACENT_SERVERS_MODE = 'external';
  expect(getMode()).toBe('external');
  process.env.ADJACENT_SERVERS_MODE = 'typo';
  expect(() => getMode()).toThrow('ADJACENT_SERVERS_MODE');
});

function startup() {
  const children = [];
  const logs = [];
  const start = load('adjacent-servers/adjacent-servers.js', {
    dotenv: { config() {} },
    '../API/logger': (...args) => logs.push(args),
    child_process: {
      spawn(command, args) {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        children.push({ child, command, args });
        return child;
      },
    },
  });
  start();
  return { children, logs };
}

test('external mode never starts duplicate embedded services', () => {
  process.env.ADJACENT_SERVERS_MODE = 'external';
  for (const [, flag] of services) process.env[flag] = 'true';
  expect(startup().children).toHaveLength(0);
});

test('embedded mode starts only enabled services on their configured port', () => {
  process.env.ADJACENT_SERVERS_MODE = 'embedded';
  process.env.WITH_TITILER = 'true';
  process.env.TITILER_PORT = '9876';
  const { children } = startup();
  expect(children).toHaveLength(1);
  expect(children[0].command).toContain('start-titiler');
  expect(children[0].args).toEqual(['9876']);
});

for (const [code, signal] of [[1, null], [null, 'SIGTERM'], [0, null]]) {
  test(`logs child termination (${signal || code}) with stderr diagnostics`, () => {
    process.env.WITH_TITILER = 'true';
    const { children, logs } = startup();
    children[0].child.stderr.emit('data', Buffer.from('x'.repeat(8000)));
    children[0].child.stderr.emit('data', Buffer.from('missing configuration'));
    children[0].child.emit('close', code, signal);
    const failure = logs.find(([level]) => level === (code === 0 ? 'warn' : 'error'));
    expect(failure).toBeDefined();
    expect(failure[1]).toContain('titiler');
    expect(failure[1]).toContain(String(signal || code));
    expect(failure[1]).toContain('missing configuration');
    expect(failure[1].length).toBeLessThan(4500);
  });
}

test('logs process spawn errors', () => {
  process.env.WITH_TITILER = 'true';
  const { children, logs } = startup();
  children[0].child.emit('error', new Error('spawn failed'));
  expect(logs.some(([level, message]) => level === 'error' && message.includes('spawn failed'))).toBe(true);
});

for (const mode of ['embedded', 'external']) {
  test(`${mode} COG paths ignore the container runtime`, () => {
    globalThis.window = { mmgisglobal: {
      ADJACENT_SERVERS_MODE: mode,
      IS_DOCKER: mode === 'embedded' ? 'true' : 'false',
    } };
    const config = load('plugins/core/layertypes/Tile/config.js', {
      '@basics/Formulae_/Formulae_': { isUrlAbsolute: (url) => url.startsWith('https://') },
    }).default;
    expect(config.resolveUrl('Missions/test/cog.tif', { throughTileServer: true }))
      .toBe(mode === 'external' ? '/Missions/test/cog.tif' : '../../Missions/test/cog.tif');
    expect(config.resolveUrl('Missions/test/cog.tif', {})).toBe('Missions/test/cog.tif');
    expect(config.resolveUrl('https://example.com/cog.tif', { throughTileServer: true }))
      .toBe('https://example.com/cog.tif');
  });

  test(`${mode} mode selects matching proxy hosts for all services`, () => {
    const routes = [];
    for (const [, flag] of services) process.env[flag] = 'true';
    process.env.WITH_VELOSERVER = 'true';
    process.env.ADJACENT_SERVER_CUSTOM_0 = '["true","custom","my-service","9000"]';
    const init = load('adjacent-servers/adjacent-servers-proxy.js', {
      '../API/logger': () => {},
      'http-proxy-middleware': {
        createProxyMiddleware: (options) => options,
        responseInterceptor: (handler) => handler,
      },
    });
    init({ use: (route, ...handlers) => routes.push([route, handlers.at(-1).target]) }, mode, () => () => {}, () => () => {});
    expect(routes).toEqual([
      ['/stac', `http://${mode === 'external' ? 'stac-fastapi' : 'localhost'}:8881`],
      ['/tipg', `http://${mode === 'external' ? 'tipg' : 'localhost'}:8882`],
      ['/titiler', `http://${mode === 'external' ? 'titiler' : 'localhost'}:8883`],
      ['/titilerpgstac', `http://${mode === 'external' ? 'titiler-pgstac' : 'localhost'}:8884`],
      ['/veloserver', `http://${mode === 'external' ? 'veloserver' : 'localhost'}:8104`],
      ['/custom', `http://${mode === 'external' ? 'my-service' : 'localhost'}:9000`],
    ]);
  });
}

test('disabled adjacent services do not register proxies or start processes', () => {
  const routes = [];
  const init = require('../../adjacent-servers/adjacent-servers-proxy');
  init({ use: (...args) => routes.push(args) }, 'embedded', () => () => {}, () => () => {});
  expect(routes).toEqual([]);
  expect(startup().children).toHaveLength(0);
});

for (const [name, , app] of services) {
  for (const withEnv of [false, true]) {
    test(`${name} launcher ${withEnv ? 'loads optional .env' : 'uses inherited environment without .env'}`, () => {
      test.skip(process.platform === 'win32', 'Unix shell launcher');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmgis-adjacent-'));
      try {
        // Stand in for the Python executable, so no geospatial packages or DB are required.
        fs.writeFileSync(path.join(dir, 'python'), '#!/bin/sh\nprintf "%s\\n" "$*" "$ADJACENT_TEST_VALUE"\nexit 7\n', { mode: 0o755 });
        if (withEnv) fs.writeFileSync(path.join(dir, '.env'), 'EXAMPLE=value\n');
        const result = spawnSync('sh', [path.join(root, `adjacent-servers/${name}/start-${name}.sh`), '9876'], {
          cwd: dir,
          env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, ADJACENT_TEST_VALUE: 'inherited' },
          encoding: 'utf8',
        });
        const command = `-m uvicorn ${app} --port 9876`;
        expect(result.stdout.trim().split('\n')).toEqual([
          withEnv ? `-m dotenv -f .env run python ${command}` : command,
          'inherited',
        ]);
        expect(result.status).toBe(7);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}
