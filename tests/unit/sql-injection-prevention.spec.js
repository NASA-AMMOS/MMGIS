/**
 * Unit tests for SQL injection prevention utilities.
 * Tests Utils.forceAlphaNumUnder() sanitization function.
 */

const Utils = require('../../API/utils.js');

describe('SQL Injection Prevention', () => {
  const forceAlphaNumUnder = Utils.forceAlphaNumUnder;

  describe('forceAlphaNumUnder', () => {
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
  });
});
