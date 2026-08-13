/**
 * Unit tests for API/validateGdalDatasetPath.js — the guard the raster compute
 * endpoints use. Local paths fall through to validateMissionsPath; remote
 * datasets are only opened when an operator allowlisted their prefix.
 */

import { test, expect } from '@playwright/test';
const path = require('path');
const validateGdalDatasetPath = require('../../API/validateGdalDatasetPath');

const missionsDir = path.resolve(__dirname, '../..', 'Missions');

function withAllowedPrefixes(value, fn) {
  const previous = process.env.GDAL_ALLOWED_REMOTE_PREFIXES;
  process.env.GDAL_ALLOWED_REMOTE_PREFIXES = value;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.GDAL_ALLOWED_REMOTE_PREFIXES;
    else process.env.GDAL_ALLOWED_REMOTE_PREFIXES = previous;
  }
}

test.describe('validateGdalDatasetPath', () => {
  test('still accepts Missions paths and rejects escapes', () => {
    const result = validateGdalDatasetPath('Missions/MSL/Layers/DEM.tif');
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBe(path.join(missionsDir, 'MSL/Layers/DEM.tif'));
    expect(validateGdalDatasetPath('/Missions/../../etc/passwd').error).toBeTruthy();
    expect(validateGdalDatasetPath('/etc/passwd').error).toBeTruthy();
  });

  test('rejects remote datasets when no allowlist is configured', () => {
    withAllowedPrefixes('', () => {
      for (const p of [
        '/vsicurl/http://169.254.169.254/latest/meta-data/',
        '/vsis3/some-bucket/dem.tif',
        'https://example.gov/dem.tif',
      ]) {
        expect(validateGdalDatasetPath(p).error).toBeTruthy();
      }
    });
  });

  test('accepts remote datasets matching an allowlisted prefix', () => {
    withAllowedPrefixes('/vsis3/my-bucket/,https://cdn.example.gov/dems/', () => {
      for (const p of [
        '/vsis3/my-bucket/dems/site.tif',
        'https://cdn.example.gov/dems/site.tif',
      ]) {
        const result = validateGdalDatasetPath(p);
        expect(result.error).toBeUndefined();
        expect(result.resolved).toBe(p);
      }
    });
  });

  test('hands GDAL the url as written, percent-escapes intact', () => {
    withAllowedPrefixes('https://cdn.example.gov/dems/', () => {
      const url = 'https://cdn.example.gov/dems/site%20a%2520b.tif';
      const result = validateGdalDatasetPath(url);
      expect(result.error).toBeUndefined();
      expect(result.resolved).toBe(url);
    });
  });

  test('ignores allowlist entries that do not name a host', () => {
    for (const allowlist of [
      '/vsicurl/',
      'https://',
      '/vsicurl/https://',
      '/vsis3/',
    ]) {
      withAllowedPrefixes(allowlist, () => {
        expect(
          validateGdalDatasetPath('/vsicurl/http://169.254.169.254/').error
        ).toBeTruthy();
        expect(validateGdalDatasetPath('https://evil.example.com/dem.tif').error).toBeTruthy();
        expect(validateGdalDatasetPath('/vsis3/any-bucket/dem.tif').error).toBeTruthy();
      });
    }
  });

  test('rejects remote datasets outside the allowlisted prefix', () => {
    withAllowedPrefixes('/vsis3/my-bucket/,https://cdn.example.gov/dems/', () => {
      for (const p of [
        '/vsis3/other-bucket/dem.tif',
        '/vsicurl/http://169.254.169.254/latest/meta-data/',
        'https://cdn.example.gov/../secrets/dem.tif',
        'https://evil.example.com/dems/dem.tif',
      ]) {
        expect(validateGdalDatasetPath(p).error).toBeTruthy();
      }
    });
  });

  test('ignores allowlist entries that are not remote prefixes', () => {
    withAllowedPrefixes('/,/etc/,Missions/', () => {
      expect(validateGdalDatasetPath('/vsicurl/http://evil.example.com/').error).toBeTruthy();
      expect(validateGdalDatasetPath('https://evil.example.com/').error).toBeTruthy();
    });
  });

  test('never allows local virtual file systems or inline VRT behind an allowlisted prefix', () => {
    withAllowedPrefixes(
      '/vsicurl/http://example.gov/,/vsis3/my-bucket/,https://example.gov/',
      () => {
        for (const p of [
          '/vsicurl/http://example.gov//vsizip//etc/passwd',
          '/vsis3/my-bucket/../../vsisubfile/0_100,/etc/passwd',
          '/vsicurl/http://example.gov/<VRTDataset>',
          // Encoded so that only the decoded form reveals the local wrapper.
          '/vsicurl/http://example.gov/%2Fvsizip%2F%2Fetc%2Fpasswd',
        ]) {
          expect(validateGdalDatasetPath(p).error).toBeTruthy();
        }
      }
    );
  });

  test('rejects missing paths and invalid encodings', () => {
    expect(validateGdalDatasetPath(undefined).error).toBeTruthy();
    expect(validateGdalDatasetPath('/Missions/%E0%A4%A').error).toBeTruthy();
  });
});
