import { test, expect } from '@playwright/test';

/**
 * E2E tests for the compute endpoints that hand a client-supplied dataset
 * path to GDAL: /api/utils/getprofile, /api/utils/getbands and
 * /api/utils/getminmax.
 *
 * GDAL accepts more than filesystem paths as a dataset name — an inline VRT
 * with a VRTRawRasterBand maps the raw bytes of any local file onto pixel
 * values, which the responses would then echo back. Every one of these
 * routes must reject anything that does not resolve inside /Missions.
 */

test.describe('GDAL dataset path validation', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:18888';

  // With AUTH=local an unauthenticated POST is answered with the login page
  // instead of reaching the route, so there is nothing to assert here.
  const state = { loginRequired: false };
  test.beforeAll(async ({ request }) => {
    const probe = await request.post(`${baseURL}/api/utils/getminmax`, {
      form: { type: 'minmax', path: '/etc/passwd', bands: '[1]' },
    });
    state.loginRequired = (probe.headers()['content-type'] || '').includes(
      'text/html'
    );
  });

  const rawVRT = (file) =>
    '<VRTDataset rasterXSize="64" rasterYSize="1">' +
    '<VRTRasterBand dataType="Byte" band="1" subClass="VRTRawRasterBand">' +
    `<SourceFilename relativeToVRT="0">${file}</SourceFilename>` +
    '<ImageOffset>0</ImageOffset><PixelOffset>1</PixelOffset>' +
    '<LineOffset>64</LineOffset>' +
    '</VRTRasterBand></VRTDataset>';

  const maliciousPaths = [
    ['inline raw VRT over /etc/passwd', rawVRT('/etc/passwd')],
    ['inline raw VRT over .env', rawVRT('.env')],
    ['absolute path outside Missions', '/etc/passwd'],
    ['traversal out of Missions', '/Missions/../../../etc/passwd'],
    ['encoded traversal out of Missions', '/Missions/%2e%2e/%2e%2e/etc/passwd'],
    ['vsicurl remote dataset', '/vsicurl/http://169.254.169.254/latest/meta-data/'],
    ['bare http url', 'http://169.254.169.254/latest/meta-data/'],
    ['vsizip local wrapper', '/vsizip//etc/passwd'],
  ];

  const endpoints = [
    [
      'getprofile',
      (p) => ({
        type: '2pts',
        path: p,
        lat1: 0,
        lon1: 0,
        lat2: 1,
        lon2: 1,
        steps: 4,
        axes: 'z',
      }),
    ],
    [
      'getbands',
      (p) => ({ type: 'band', path: p, x: 0, y: 0, xyorll: 'll', bands: '[[1,1]]' }),
    ],
    ['getminmax', (p) => ({ type: 'minmax', path: p, bands: '[1]' })],
  ];

  for (const [endpoint, body] of endpoints) {
    for (const [label, badPath] of maliciousPaths) {
      test(`${endpoint} rejects ${label}`, async ({ request }) => {
        test.skip(state.loginRequired, 'AUTH=local: route is behind the login page');

        const response = await request.post(`${baseURL}/api/utils/${endpoint}`, {
          form: body(badPath),
        });

        expect(response.status()).toBe(400);

        const text = await response.text();
        // Rejected by the path guard, not by GDAL failing to open the dataset.
        expect(JSON.parse(text)).toMatchObject({ error: true });
        // Never any file contents in the response.
        expect(text).not.toContain('root:');
        expect(text).not.toContain('/bin/bash');
        expect(text).not.toContain('SECRET');
      });
    }

    test(`${endpoint} rejects a missing path`, async ({ request }) => {
      test.skip(state.loginRequired, 'AUTH=local: route is behind the login page');

      const response = await request.post(`${baseURL}/api/utils/${endpoint}`, {
        form: body(''),
      });
      expect(response.status()).toBe(400);
    });
  }
});
