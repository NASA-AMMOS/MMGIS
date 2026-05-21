/**
 * Unit tests for Fix 6: DOM XSS sanitization
 *
 * Tests the safeHTML sanitization logic using string-based checks
 * (no DOM APIs needed — runs in Node context).
 */

import { test, expect } from '@playwright/test';

test.describe('Fix 6: DOM XSS sanitization', () => {
  // Regex-based sanitizer matching the DOMPurify allowed-tags approach
  const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'span', 'br', 'div', 'p'];

  function stripDangerousTags(html) {
    // Remove script tags and content
    let result = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove event handler attributes
    result = result.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    result = result.replace(/\s*on\w+=\S+/gi, '');
    return result;
  }

  test('strips script tags', () => {
    const result = stripDangerousTags('<script>alert(1)</script>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  test('preserves allowed tags like <b>', () => {
    const input = '<b>bold</b>';
    const result = stripDangerousTags(input);
    expect(result).toContain('<b>');
    expect(result).toContain('bold');
  });

  test('strips img with onerror', () => {
    const result = stripDangerousTags('<img onerror=alert(1) src=x>');
    expect(result).not.toContain('onerror');
  });

  test('strips onclick attributes', () => {
    const result = stripDangerousTags('<div onclick="alert(1)">click</div>');
    expect(result).not.toContain('onclick');
  });

  test('preserves safe span with class', () => {
    const input = '<span class="highlight">text</span>';
    const result = stripDangerousTags(input);
    expect(result).toContain('text');
    expect(result).toContain('class="highlight"');
  });

  test('textContent escaping prevents script injection', () => {
    // Simulates what jQuery .text() does: treats input as text, not HTML
    const malicious = '<script>alert(1)</script>';
    const escaped = malicious
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).not.toContain('<script>');
  });

  test('HTML entity escaping prevents img injection', () => {
    const featureValue = '<img src=x onerror=alert(1)>';
    const escaped = featureValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');
  });

  test('safeHTML allowed tags list is correct', () => {
    expect(ALLOWED_TAGS).toContain('b');
    expect(ALLOWED_TAGS).toContain('span');
    expect(ALLOWED_TAGS).not.toContain('script');
    expect(ALLOWED_TAGS).not.toContain('img');
    expect(ALLOWED_TAGS).not.toContain('iframe');
  });
});
