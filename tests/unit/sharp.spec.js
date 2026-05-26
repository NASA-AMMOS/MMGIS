import { test, expect } from '@playwright/test';

/**
 * Sharp image processing unit tests.
 *
 * Validates that the sharp module's constructor and pipeline methods
 * match the usage patterns in scripts/middleware.js (compositeImageUrls).
 */

test.describe('Sharp module', () => {
  test('constructor creates an image pipeline with composite/png/toBuffer', async () => {
    const sharp = (await import('sharp')).default;
    const pipeline = sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
    expect(pipeline).toBeDefined();
    expect(typeof pipeline.composite).toBe('function');
    expect(typeof pipeline.png).toBe('function');
    expect(typeof pipeline.toBuffer).toBe('function');
  });

  test('generates a valid PNG buffer from a transparent canvas', async () => {
    const sharp = (await import('sharp')).default;
    const buffer = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // 'P'
    expect(buffer[2]).toBe(0x4e); // 'N'
    expect(buffer[3]).toBe(0x47); // 'G'
  });
});
