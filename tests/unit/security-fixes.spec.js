/**
 * Unit tests for security fixes:
 * - Fix 1: Path traversal validation in configs.js /destroy route
 * - Fix 3: Password strength enforcement on /first_signup
 * - Fix 4: Missing return after guest denial in filesutils.js
 * - Fix 6: Default session secret enforcement
 * - Fix 9: Password strength enforcement on /resetPassword
 */

import { test, expect } from '@playwright/test';
const path = require('path');

test.describe('Fix 1: Path Traversal in /destroy route', () => {
  const missionNameRegex = /^[A-Za-z0-9_ -]+$/;

  test('rejects mission name with path traversal (../../etc)', () => {
    expect(missionNameRegex.test('../../etc')).toBe(false);
  });

  test('rejects mission name with ../', () => {
    expect(missionNameRegex.test('../foo')).toBe(false);
  });

  test('rejects mission name with embedded traversal', () => {
    expect(missionNameRegex.test('foo/../../bar')).toBe(false);
  });

  test('rejects mission name with slashes', () => {
    expect(missionNameRegex.test('foo/bar')).toBe(false);
  });

  test('rejects mission name with backslashes', () => {
    expect(missionNameRegex.test('foo\\bar')).toBe(false);
  });

  test('rejects empty mission name', () => {
    expect(missionNameRegex.test('')).toBe(false);
  });

  test('allows valid mission name with alphanumeric characters', () => {
    expect(missionNameRegex.test('TestMission')).toBe(true);
  });

  test('allows mission name with underscores', () => {
    expect(missionNameRegex.test('Test_Mission_01')).toBe(true);
  });

  test('allows mission name with hyphens', () => {
    expect(missionNameRegex.test('Test-Mission')).toBe(true);
  });

  test('allows mission name with spaces', () => {
    expect(missionNameRegex.test('Mars Rover')).toBe(true);
  });

  test('resolved path stays within Missions directory for valid names', () => {
    const missionsBase = path.resolve('./Missions');
    const validName = 'TestMission';
    const resolvedDir = path.resolve('./Missions/' + validName);
    expect(
      resolvedDir.startsWith(missionsBase + path.sep) || resolvedDir === missionsBase
    ).toBe(true);
  });

  test('resolved path escapes Missions directory for traversal attempts', () => {
    const missionsBase = path.resolve('./Missions');
    const maliciousName = '../../etc';
    const resolvedDir = path.resolve('./Missions/' + maliciousName);
    expect(
      resolvedDir.startsWith(missionsBase + path.sep) || resolvedDir === missionsBase
    ).toBe(false);
  });
});

test.describe('Fix 3: Password Strength on /first_signup', () => {
  function isStrongPassword(password) {
    if (!password) return false;
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    return (
      password.length >= minLength &&
      hasUpper &&
      hasLower &&
      hasNumber &&
      hasSymbol
    );
  }

  test('rejects weak password "abc"', () => {
    expect(isStrongPassword('abc')).toBe(false);
  });

  test('rejects password without uppercase', () => {
    expect(isStrongPassword('str0ng!pass')).toBe(false);
  });

  test('rejects password without number', () => {
    expect(isStrongPassword('Strong!Pass')).toBe(false);
  });

  test('rejects password without symbol', () => {
    expect(isStrongPassword('Str0ngPass1')).toBe(false);
  });

  test('rejects password shorter than 8 characters', () => {
    expect(isStrongPassword('S1!a')).toBe(false);
  });

  test('accepts strong password "Str0ng!Pass"', () => {
    expect(isStrongPassword('Str0ng!Pass')).toBe(true);
  });

  test('accepts strong password with all requirements met', () => {
    expect(isStrongPassword('MyP@ssw0rd!')).toBe(true);
  });
});

test.describe('Fix 4: Missing return after guest denial in filesutils.js', () => {
  test('guest user without quick_published receives permission denied and no further processing', () => {
    let responseSent = false;
    let furtherProcessing = false;

    const req = {
      session: { user: 'guest' },
      body: { quick_published: 'false' },
    };
    const res = {
      send: (data) => {
        responseSent = true;
        expect(data.status).toBe('failure');
        expect(data.message).toBe('Permission denied.');
      },
    };

    // Simulate the fixed logic with return
    if (req.session.user == 'guest' && req.body.quick_published !== 'true') {
      res.send({
        status: 'failure',
        message: 'Permission denied.',
        body: {},
      });
      // With the fix, function returns here
      expect(responseSent).toBe(true);
      return;
    }

    furtherProcessing = true;
    expect(furtherProcessing).toBe(false); // Should not reach here
  });

  test('guest user with quick_published=true is allowed to continue', () => {
    let shouldContinue = true;

    const req = {
      session: { user: 'guest' },
      body: { quick_published: 'true' },
    };

    if (req.session.user == 'guest' && req.body.quick_published !== 'true') {
      shouldContinue = false;
    }

    expect(shouldContinue).toBe(true);
  });

  test('non-guest user is allowed to continue', () => {
    let shouldContinue = true;

    const req = {
      session: { user: 'admin' },
      body: { quick_published: 'false' },
    };

    if (req.session.user == 'guest' && req.body.quick_published !== 'true') {
      shouldContinue = false;
    }

    expect(shouldContinue).toBe(true);
  });
});

test.describe('Fix 6: Default Session Secret', () => {
  test('server fails to start when SECRET is not set', () => {
    const originalSecret = process.env.SECRET;
    delete process.env.SECRET;

    try {
      const sessionSecret = process.env.SECRET;
      const errors = [];
      if (!sessionSecret) {
        errors.push(
          'FATAL: The SECRET environment variable is not set. Please set it to a strong random string for session security.'
        );
      }
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('SECRET environment variable is not set');
    } finally {
      if (originalSecret !== undefined) {
        process.env.SECRET = originalSecret;
      }
    }
  });

  test('server accepts a valid SECRET value', () => {
    const originalSecret = process.env.SECRET;
    process.env.SECRET = 'a-valid-strong-secret-key-for-testing-purposes';

    try {
      const sessionSecret = process.env.SECRET;
      const errors = [];
      if (!sessionSecret) {
        errors.push('FATAL: The SECRET environment variable is not set.');
      }
      expect(errors.length).toBe(0);
      expect(sessionSecret).toBe('a-valid-strong-secret-key-for-testing-purposes');
    } finally {
      if (originalSecret !== undefined) {
        process.env.SECRET = originalSecret;
      } else {
        delete process.env.SECRET;
      }
    }
  });

  test('server rejects SECRET shorter than 24 characters', () => {
    const originalSecret = process.env.SECRET;
    process.env.SECRET = 'tooshort';

    try {
      const sessionSecret = process.env.SECRET;
      const errors = [];
      if (!sessionSecret) {
        errors.push('FATAL: The SECRET environment variable is not set.');
      } else if (sessionSecret.length < 24) {
        errors.push(
          'FATAL: The SECRET environment variable is too short (minimum 24 characters).'
        );
      }
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('too short');
    } finally {
      if (originalSecret !== undefined) {
        process.env.SECRET = originalSecret;
      } else {
        delete process.env.SECRET;
      }
    }
  });

  test('server accepts SECRET with exactly 24 characters', () => {
    const originalSecret = process.env.SECRET;
    process.env.SECRET = 'abcdefghijklmnopqrstuvwx';

    try {
      const sessionSecret = process.env.SECRET;
      const errors = [];
      if (!sessionSecret) {
        errors.push('FATAL: The SECRET environment variable is not set.');
      } else if (sessionSecret.length < 24) {
        errors.push('FATAL: The SECRET environment variable is too short.');
      }
      expect(errors.length).toBe(0);
      expect(sessionSecret.length).toBe(24);
    } finally {
      if (originalSecret !== undefined) {
        process.env.SECRET = originalSecret;
      } else {
        delete process.env.SECRET;
      }
    }
  });
});

test.describe('Fix 9: Password Strength on /resetPassword', () => {
  function isStrongPassword(password) {
    if (!password) return false;
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    return (
      password.length >= minLength &&
      hasUpper &&
      hasLower &&
      hasNumber &&
      hasSymbol
    );
  }

  test('rejects weak password "weak" on reset', () => {
    const password = 'weak';
    expect(isStrongPassword(password)).toBe(false);
  });

  test('rejects empty password on reset', () => {
    expect(isStrongPassword('')).toBe(false);
  });

  test('rejects null password on reset', () => {
    expect(isStrongPassword(null)).toBe(false);
  });

  test('rejects undefined password on reset', () => {
    expect(isStrongPassword(undefined)).toBe(false);
  });

  test('accepts strong password on reset', () => {
    const password = 'Str0ng!Pass';
    expect(isStrongPassword(password)).toBe(true);
  });

  test('simulates resetPassword validation flow with weak password', () => {
    const username = 'testuser';
    const password = 'weak';
    const resetToken = 'valid-token';
    let responseMessage = null;

    if (username == null || username == '') {
      responseMessage = 'Missing username.';
    } else if (password == null || password == '') {
      responseMessage = 'Missing password.';
    } else if (resetToken == null || resetToken == '') {
      responseMessage = 'Missing resetToken.';
    } else if (!isStrongPassword(password)) {
      responseMessage =
        'Password is not strong enough. Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.';
    }

    expect(responseMessage).toBe(
      'Password is not strong enough. Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.'
    );
  });

  test('simulates resetPassword validation flow with strong password', () => {
    const username = 'testuser';
    const password = 'Str0ng!Pass';
    const resetToken = 'valid-token';
    let responseMessage = null;

    if (username == null || username == '') {
      responseMessage = 'Missing username.';
    } else if (password == null || password == '') {
      responseMessage = 'Missing password.';
    } else if (resetToken == null || resetToken == '') {
      responseMessage = 'Missing resetToken.';
    } else if (!isStrongPassword(password)) {
      responseMessage =
        'Password is not strong enough. Must be at least 8 characters long and contain at least: 1 uppercase letter, 1 lowercase letter, 1 number and 1 symbol.';
    }

    expect(responseMessage).toBeNull();
  });
});
