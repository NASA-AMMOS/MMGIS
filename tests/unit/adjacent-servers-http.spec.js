import { test, expect } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';

const express = require('express');
const initProxy = require('../../adjacent-servers/adjacent-servers-proxy');
const dotenv = require('dotenv');

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

let savedEnv, upstream, proxy, baseUrl;
test.beforeEach(async () => {
  savedEnv = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (/^(WITH_|ADJACENT_SERVER|TITILER_|ROOT_PATH|EXTERNAL_ROOT_PATH)/.test(key)) delete process.env[key];
  }
  upstream = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ upstreamPath: req.url }));
  });
  process.env.WITH_TITILER = 'true';
  process.env.TITILER_PORT = String(await listen(upstream));
  process.env.ROOT_PATH = '/mmgis';
  process.env.TITILER_ALLOWED_URL_PATTERNS = dotenv.parse(
    fs.readFileSync(path.resolve(__dirname, '../../sample.env'))
  ).TITILER_ALLOWED_URL_PATTERNS;
  const app = express();
  app.use(express.json());
  const user = () => (req, res, next) => req.get('x-test-user') ? next() : res.sendStatus(401);
  const admin = () => (req, res, next) => req.get('x-test-admin') ? next() : res.sendStatus(403);
  initProxy(app, 'embedded', admin, user);
  proxy = http.createServer(app);
  baseUrl = `http://127.0.0.1:${await listen(proxy)}/mmgis/titiler`;
});
test.afterEach(async () => {
  for (const server of [proxy, upstream]) {
    if (!server?.listening) continue;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  process.env = savedEnv;
});

test('forwards an authenticated request and query through the real proxy under ROOT_PATH', async () => {
  const response = await fetch(`${baseUrl}/healthz?probe=1`, { headers: { 'x-test-user': 'yes' } });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ upstreamPath: '/healthz?probe=1' });
});

test('keeps user and STAC admin authorization in front of the upstream', async () => {
  expect((await fetch(`${baseUrl}/healthz`)).status).toBe(401);
  expect((await fetch(`${baseUrl}/cog/stac`, { headers: { 'x-test-user': 'yes' } })).status).toBe(403);
  const response = await fetch(`${baseUrl}/cog/stac`, { headers: { 'x-test-admin': 'yes' } });
  expect(response.status).toBe(200);
});

test('sample URL policy accepts Mission paths for both modes but blocks additional traversal', async () => {
  const request = (url) => fetch(`${baseUrl}/cog/info?${new URLSearchParams({ url })}`, { headers: { 'x-test-user': 'yes' } });
  const response = await request('../../Missions/Validation/cog.tif');
  expect(response.status).toBe(200);
  expect((await response.json()).upstreamPath).toContain('cog.tif');
  expect((await request('/Missions/Validation/cog.tif')).status).toBe(200);
  for (const url of [
    '../../Missions/Validation/../../../etc/passwd',
    '../Missions/Validation/cog.tif',
    '../../../Missions/Validation/cog.tif',
    '../../Missions-other/private.tif',
  ]) {
    expect((await request(url)).status, url).toBe(403);
  }
  expect((await request('http://127.0.0.1/private')).status).toBe(403);
});

test('retains URL and expression validation for proxied requests', async () => {
  const response = await fetch(`${baseUrl}/cog/info?expression=${encodeURIComponent('__import__(b1)')}`, {
    headers: { 'x-test-user': 'yes' },
  });
  expect(response.status).toBe(400);
});
