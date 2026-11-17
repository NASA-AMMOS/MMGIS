/**
 * Unit tests for adjacent-servers/proxyPath.js: the path TiTiler routes, and
 * stripping MMGIS credentials from proxied requests.
 */

import { test, expect } from '@playwright/test';
const { routedPath, stripCredentials, forwardParsedBody } = require('../../adjacent-servers/proxyPath');

test.describe('routedPath', () => {
  test('decodes, resolves dot segments and duplicate slashes, and lowercases', () => {
    for (const raw of [
      '/titiler/cog/stac/info',
      '/titiler/cog/%73tac/info',
      '/titiler/cog/%2573tac/info',
      '/titiler//cog//stac',
      '/titiler/cog/./stac',
      '/titiler/cog/x/../stac',
      '/titiler/cog\\stac',
      '/TITILER/COG/STAC?url=x',
      '/titiler/cog%2fstac',
    ])
      expect(routedPath(raw), raw).toContain('/cog/stac');
  });

  test('leaves ordinary paths alone and refuses undecodable ones', () => {
    expect(routedPath('/titiler/cog/tiles/1/2/3?url=a')).toBe('/titiler/cog/tiles/1/2/3');
    expect(routedPath('/titiler/cog/%E0%A4%A')).toBe(null);
  });
});

test.describe('stripCredentials', () => {
  function fakeReq(headers) {
    const h = { ...headers };
    return {
      headers: h,
      getHeader: (n) => h[n],
      setHeader: (n, v) => (h[n] = v),
      removeHeader: (n) => delete h[n],
    };
  }

  test('removes the bearer token and MMGIS cookies but keeps other cookies', () => {
    const r = fakeReq({ authorization: 'Bearer abc', cookie: 'MMGISSession=s; other=1; MMGISUser={"a":1}' });
    stripCredentials(r);
    expect(r.headers.authorization).toBeUndefined();
    expect(r.headers.cookie).toBe('other=1');
  });

  test('removes proxy identity headers and the proxy secret', () => {
    const r = fakeReq({
      'x-mmgis-proxy-secret': 's', 'x-sub': 'u', 'x-groups': 'g', 'x-session': 'x', accept: 'application/json',
    });
    stripCredentials(r);
    expect(Object.keys(r.headers)).toEqual(['accept']);
  });

  test('removes custom proxy identity header names too', () => {
    const saved = { u: process.env.PROXY_USER_HEADER, k: process.env.PROXY_SECRET_HEADER };
    process.env.PROXY_USER_HEADER = 'X-Forwarded-User';
    process.env.PROXY_SECRET_HEADER = 'X-Edge-Key'; // pragma: allowlist secret
    try {
      const r = fakeReq({ 'x-forwarded-user': 'u', 'x-edge-key': 'k', 'x-sub': 'u', accept: 'application/json' });
      stripCredentials(r);
      expect(Object.keys(r.headers)).toEqual(['accept']);
    } finally {
      for (const [k, v] of [['PROXY_USER_HEADER', saved.u], ['PROXY_SECRET_HEADER', saved.k]])
        v === undefined ? delete process.env[k] : (process.env[k] = v);
    }
  });

  test('drops the cookie header when only MMGIS cookies were sent', () => {
    const r = fakeReq({ cookie: 'MMGISSession=s' });
    stripCredentials(r);
    expect(r.headers.cookie).toBeUndefined();
  });
});

test.describe('forwardParsedBody', () => {
  function fakeProxyReq(headers) {
    const h = { ...headers };
    return {
      headers: h, written: '',
      getHeader: (n) => h[n.toLowerCase()],
      setHeader: (n, v) => { h[n.toLowerCase()] = String(v); },
      removeHeader: (n) => delete h[n.toLowerCase()],
      write(d) { this.written += d; },
    };
  }

  test('replaces chunked encoding with Content-Length when the parsed body is re-sent', () => {
    const r = fakeProxyReq({ 'content-type': 'application/json', 'transfer-encoding': 'chunked' });
    forwardParsedBody(r, { readableLength: 0, body: { a: 1 } });
    expect(r.headers['transfer-encoding']).toBeUndefined();
    expect(r.headers['content-length']).toBe('7');
    expect(r.written).toBe('{"a":1}');
  });

  test('leaves bodies it does not re-send alone', () => {
    const r = fakeProxyReq({ 'content-type': 'application/octet-stream', 'transfer-encoding': 'chunked' });
    forwardParsedBody(r, { readableLength: 0, body: undefined });
    expect(r.headers['transfer-encoding']).toBe('chunked');
    expect(r.written).toBe('');
  });
});
