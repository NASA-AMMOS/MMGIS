/**
 * Unit tests for adjacent-servers/proxyPath.js: the path TiTiler routes, and
 * stripping MMGIS credentials from proxied requests.
 */

import { test, expect } from '@playwright/test';
const { routedPath, stripCredentials } = require('../../adjacent-servers/proxyPath');

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

  test('removes CSSO identity headers and the proxy secret', () => {
    const r = fakeReq({
      'x-mmgis-proxy-secret': 's', 'x-sub': 'u', 'x-groups': 'g', 'x-session': 'x', accept: 'application/json',
    });
    stripCredentials(r);
    expect(Object.keys(r.headers)).toEqual(['accept']);
  });

  test('drops the cookie header when only MMGIS cookies were sent', () => {
    const r = fakeReq({ cookie: 'MMGISSession=s' });
    stripCredentials(r);
    expect(r.headers.cookie).toBeUndefined();
  });
});
