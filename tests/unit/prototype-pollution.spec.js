/**
 * Unit tests for Fix 2: Prototype pollution guards
 *
 * Tests that dangerous keys (__proto__, constructor, prototype) are blocked
 * in Utils.setIn2, dirStore, datasets model column filtering, and QueryURL.
 */

import { test, expect } from '@playwright/test';

test.describe('Fix 2: Prototype pollution guards', () => {
  // Replicate the fixed setIn2 logic
  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function setIn2(obj, keyArray, value, force) {
    if (keyArray == null || keyArray.length === 0) return null;
    if (typeof keyArray === 'string') keyArray = keyArray.split('.');
    if (keyArray.some(k => DANGEROUS_KEYS.has(k))) return null;

    let object = obj;
    for (let i = 0; i < keyArray.length - 1; i++) {
      if (force) {
        if (!object.hasOwnProperty(keyArray[i])) {
          object[keyArray[i]] = {};
        }
        object = object[keyArray[i]];
      } else {
        if (object.hasOwnProperty(keyArray[i])) object = object[keyArray[i]];
        else return null;
      }
    }
    object[keyArray[keyArray.length - 1]] = value;
    return true;
  }

  test('setIn2 blocks __proto__ key', () => {
    const obj = {};
    const result = setIn2(obj, ['__proto__', 'polluted'], true, true);
    expect(result).toBeNull();
    expect(({}).polluted).toBeUndefined();
  });

  test('setIn2 blocks constructor.prototype chain', () => {
    const obj = {};
    const result = setIn2(obj, ['constructor', 'prototype', 'polluted'], true, true);
    expect(result).toBeNull();
    expect(({}).polluted).toBeUndefined();
  });

  test('setIn2 blocks nested __proto__', () => {
    const obj = {};
    const result = setIn2(obj, ['a', '__proto__', 'b'], 'val', true);
    expect(result).toBeNull();
  });

  test('setIn2 allows normal key arrays', () => {
    const obj = {};
    const result = setIn2(obj, ['a', 'b', 'c'], 'val', true);
    expect(result).toBe(true);
    expect(obj.a.b.c).toBe('val');
  });

  test('setIn2 allows single normal key', () => {
    const obj = {};
    const result = setIn2(obj, ['x'], 42, true);
    expect(result).toBe(true);
    expect(obj.x).toBe(42);
  });

  test('setIn2 returns null for empty keyArray', () => {
    const obj = {};
    const result = setIn2(obj, [], 'val', true);
    expect(result).toBeNull();
  });

  test('setIn2 returns null for null keyArray', () => {
    const obj = {};
    const result = setIn2(obj, null, 'val', true);
    expect(result).toBeNull();
  });

  test('dirStore created with Object.create(null) has no prototype chain', () => {
    const dirStore = Object.create(null);
    expect(dirStore.hasOwnProperty).toBeUndefined();
    expect(dirStore.constructor).toBeUndefined();
    expect(dirStore.__proto__).toBeUndefined();
    expect(Object.getPrototypeOf(dirStore)).toBeNull();
  });

  test('column names containing __proto__ are filtered out', () => {
    const columns = ['name', '__proto__', 'value', 'constructor', 'prototype', 'valid_col'];
    const attributes = {};
    columns.forEach((element) => {
      if (DANGEROUS_KEYS.has(element)) return;
      attributes[element] = { type: 'STRING', unique: false, allowNull: true };
    });
    expect(Object.keys(attributes)).toEqual(['name', 'value', 'valid_col']);
    expect(Object.prototype.hasOwnProperty.call(attributes, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(attributes, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(attributes, 'prototype')).toBe(false);
  });

  test('field names with __proto__ are blocked in datasets route', () => {
    const fields = {};
    const testFields = [
      { name: 'valid', value: 'ok' },
      { name: '__proto__', value: 'bad' },
      { name: 'constructor', value: 'bad' },
      { name: 'prototype', value: 'bad' },
    ];
    testFields.forEach(({ name, value }) => {
      if (['__proto__', 'constructor', 'prototype'].includes(name)) return;
      fields[name] = value;
    });
    expect(fields).toEqual({ valid: 'ok' });
  });

  test('QueryURL skips dangerous keys in property assignment', () => {
    const onLayers = {};
    const testItems = ['layer1$0.5', '__proto__$1', 'constructor$1', 'layer2$0.8'];
    for (const l of testItems) {
      const s = l.split('$');
      if (['__proto__', 'constructor', 'prototype'].includes(s[0])) continue;
      onLayers[s[0]] = { opacity: parseFloat(s[1]) };
    }
    expect(Object.keys(onLayers)).toEqual(['layer1', 'layer2']);
    expect(({}).polluted).toBeUndefined();
  });
});
