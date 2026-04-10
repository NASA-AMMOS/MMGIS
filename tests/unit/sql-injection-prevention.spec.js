/**
 * Unit tests for SQL injection prevention utilities.
 * Tests Utils.forceAlphaNumUnder() sanitization function.
 */

import { test, expect } from '@playwright/test';
const Utils = require('../../API/utils.js');

test.describe('SQL Injection Prevention', () => {
  const forceAlphaNumUnder = Utils.forceAlphaNumUnder;

  test.describe('forceAlphaNumUnder', () => {
    test('allows simple alphanumeric strings', () => {
      expect(forceAlphaNumUnder('sol')).toBe('sol');
      expect(forceAlphaNumUnder('time')).toBe('time');
      expect(forceAlphaNumUnder('start_time')).toBe('start_time');
    });

    test('allows strings with underscores', () => {
      expect(forceAlphaNumUnder('my_property_name')).toBe('my_property_name');
    });

    test('allows strings with numbers', () => {
      expect(forceAlphaNumUnder('prop123')).toBe('prop123');
      expect(forceAlphaNumUnder('field_2')).toBe('field_2');
    });

    test('strips SQL injection characters', () => {
      const result = forceAlphaNumUnder("'; DROP TABLE users; --");
      expect(result).not.toContain("'");
      expect(result).not.toContain(";");
      expect(result).not.toContain("-");
      expect(result).not.toContain(" ");
    });

    test('strips special characters', () => {
      const result = forceAlphaNumUnder('a$b@c!d');
      expect(result).not.toContain('$');
      expect(result).not.toContain('@');
      expect(result).not.toContain('!');
    });

    test('handles empty string', () => {
      const result = forceAlphaNumUnder('');
      expect(result).toBe('');
    });

    test('handles null/undefined gracefully', () => {
      // null is not a string, number, or array — returns empty string
      expect(forceAlphaNumUnder(null)).toBe('');
      expect(forceAlphaNumUnder(undefined)).toBe('');
    });

    test('handles number input', () => {
      expect(forceAlphaNumUnder(123)).toBe('123');
      expect(forceAlphaNumUnder(0)).toBe('0');
    });

    test('handles unsafe number values', () => {
      expect(forceAlphaNumUnder(NaN)).toBe('0');
      expect(forceAlphaNumUnder(Infinity)).toBe('0');
      expect(forceAlphaNumUnder(-Infinity)).toBe('0');
    });

    test('handles array input', () => {
      const result = forceAlphaNumUnder(['col1', 'col2', 'col3']);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(['col1', 'col2', 'col3']);
    });

    test('strips injection characters from array elements', () => {
      const result = forceAlphaNumUnder(["col1'; DROP TABLE--", 'col2']);
      expect(Array.isArray(result)).toBe(true);
      result.forEach(item => {
        expect(item).not.toContain("'");
        expect(item).not.toContain(";");
        expect(item).not.toContain("-");
      });
    });

    test('strips SQL keywords embedded in special characters', () => {
      // forceAlphaNumUnder strips special chars but preserves alphanumeric
      const result = forceAlphaNumUnder("DROP;TABLE--users");
      expect(result).not.toContain(";");
      expect(result).not.toContain("-");
      // The alphanumeric parts remain concatenated
      expect(result).toBe('DROPTABLEusers');
    });

    test('sanitizes strings like "start_time OR 1=1" by stripping spaces and equals', () => {
      const result = forceAlphaNumUnder('start_time OR 1=1');
      // Spaces and = are stripped, leaving alphanumeric + underscore
      expect(result).toBe('start_timeOR11');
      expect(result).not.toContain(' ');
      expect(result).not.toContain('=');
    });

    test('strips backticks used in SQL injection', () => {
      const result = forceAlphaNumUnder('`col`; DROP TABLE--');
      expect(result).not.toContain('`');
      expect(result).not.toContain(';');
      expect(result).not.toContain('-');
    });

    test('strips curly braces and brackets', () => {
      const result = forceAlphaNumUnder('col{0}[1]');
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
    });

    test('handles complex injection payloads', () => {
      const payload = "1' OR '1'='1' UNION SELECT * FROM information_schema.tables--";
      const result = forceAlphaNumUnder(payload);
      expect(result).not.toContain("'");
      expect(result).not.toContain('=');
      expect(result).not.toContain('-');
      expect(result).not.toContain('*');
      expect(result).not.toContain(' ');
    });

    test('preserves underscores in column-like names after sanitization', () => {
      expect(forceAlphaNumUnder('start_time')).toBe('start_time');
      expect(forceAlphaNumUnder('end_time')).toBe('end_time');
      expect(forceAlphaNumUnder('created_at')).toBe('created_at');
      expect(forceAlphaNumUnder('my_col_123')).toBe('my_col_123');
    });
  });
});
