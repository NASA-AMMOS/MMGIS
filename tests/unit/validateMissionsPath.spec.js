/**
 * Unit tests for API/validateMissionsPath.js — the shared guard that keeps
 * client-supplied dataset paths inside the Missions directory before they
 * reach GDAL or the filesystem.
 */

import { test, expect } from '@playwright/test';
const path = require('path');
const validateMissionsPath = require('../../API/validateMissionsPath');

const missionsDir = path.resolve(__dirname, '../..', 'Missions');

test.describe('validateMissionsPath', () => {
  test('accepts leading-slash and relative Missions paths alike', () => {
    for (const p of [
      '/Missions/MSL/Layers/DEM.tif',
      'Missions/MSL/Layers/DEM.tif',
    ]) {
      const result = validateMissionsPath(p);
      expect(result.error).toBeUndefined();
      expect(result.resolved).toBe(path.join(missionsDir, 'MSL/Layers/DEM.tif'));
    }
  });

  test('allows cross-mission ../ that stays under Missions', () => {
    const result = validateMissionsPath(
      '/Missions/MSL/Layers/../../M20/Layers/DEM.tif'
    );
    expect(result.error).toBeUndefined();
    expect(result.resolved).toBe(path.join(missionsDir, 'M20/Layers/DEM.tif'));
  });

  test('rejects traversal out of Missions', () => {
    for (const p of [
      '/Missions/../../etc/passwd',
      '/Missions/MSL/../../../etc/passwd',
      '/Missions/%2e%2e/%2e%2e/etc/passwd',
    ]) {
      expect(validateMissionsPath(p).error).toBeTruthy();
    }
  });

  test('keeps file names containing a percent sign intact', () => {
    // Consumers decode once, so only one layer may be peeled off here.
    expect(validateMissionsPath('/Missions/M20/Data/50%25_dem.tif').resolved).toBe(
      path.join(missionsDir, 'M20/Data/50%_dem.tif')
    );
    expect(validateMissionsPath('/Missions/M20/Data/a%2520b.tif').resolved).toBe(
      path.join(missionsDir, 'M20/Data/a%20b.tif')
    );
  });

  test('rejects double-encoded traversal out of Missions', () => {
    expect(
      validateMissionsPath('/Missions/%252e%252e/%252e%252e/etc/passwd').error
    ).toBeTruthy();
  });

  test('rejects absolute paths outside Missions', () => {
    expect(validateMissionsPath('/etc/passwd').error).toBeTruthy();
    expect(validateMissionsPath('/../package.json').error).toBeTruthy();
  });

  test('rejects GDAL dataset strings that are not filesystem paths', () => {
    // Inline VRT XML: VRTRawRasterBand maps raw bytes of an arbitrary file
    // onto pixel values, so GDAL must never see one of these.
    const vrt =
      '<VRTDataset rasterXSize="64" rasterYSize="1">' +
      '<VRTRasterBand dataType="Byte" band="1" subClass="VRTRawRasterBand">' +
      '<SourceFilename relativeToVRT="0">/etc/passwd</SourceFilename>' +
      '</VRTRasterBand></VRTDataset>';
    expect(validateMissionsPath(vrt).error).toBeTruthy();
    expect(validateMissionsPath('/vsicurl/http://169.254.169.254/').error).toBeTruthy();
    expect(validateMissionsPath('GTIFF_DIR:1:/etc/passwd').error).toBeTruthy();
  });

  test('rejects missing paths and invalid encodings', () => {
    expect(validateMissionsPath(undefined).error).toBeTruthy();
    expect(validateMissionsPath(null).error).toBeTruthy();
    expect(validateMissionsPath('/Missions/%E0%A4%A').error).toBeTruthy();
  });
});
