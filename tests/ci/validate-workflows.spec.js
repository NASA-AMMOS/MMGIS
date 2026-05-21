/**
 * Fix 4: GitHub Actions hardening — validate workflow files
 *
 * Parses each workflow YAML and asserts:
 * - `permissions:` key exists at the top level or job level
 * - All `uses:` references to third-party actions use 40-char hex SHA pins
 * - bump-version.yml does not use the unsafe `node -e "require('./package.json')"` pattern
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const WORKFLOWS_DIR = path.join(process.cwd(), '.github', 'workflows');

const workflowFiles = [
  'docker-build.yml',
  'security-scan.yml',
  'playwright-tests.yml',
  'bump-version.yml',
];

function getWorkflowContent(filename) {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, filename), 'utf-8');
}

const SHA_PATTERN = /^[a-f0-9]{40}$/;

test.describe('Fix 4: GitHub Actions workflow hardening', () => {
  for (const file of workflowFiles) {
    test(`${file} has permissions: key`, () => {
      const content = getWorkflowContent(file);
      expect(/^\s*permissions\s*:/m.test(content)).toBe(true);
    });
  }

  for (const file of workflowFiles) {
    test(`${file} uses SHA-pinned action references`, () => {
      const content = getWorkflowContent(file);
      const usesMatches = [...content.matchAll(/uses:\s*([^\s]+)/g)];

      for (const match of usesMatches) {
        const action = match[1];
        if (action.startsWith('./')) continue;

        const atIndex = action.lastIndexOf('@');
        expect(atIndex, `action ${action} has no @ version reference`).toBeGreaterThan(-1);

        const ref = action.substring(atIndex + 1);
        expect(SHA_PATTERN.test(ref), `action ${action} uses tag "${ref}" instead of SHA pin`).toBe(true);
      }
    });
  }

  test('bump-version.yml does not use unsafe node -e require pattern', () => {
    const content = getWorkflowContent('bump-version.yml');
    const hasUnsafePattern = /node\s+-e\s+["'].*require\s*\(\s*['"]\.\/package\.json['"]\s*\)/.test(content);
    expect(hasUnsafePattern).toBe(false);
  });
});
