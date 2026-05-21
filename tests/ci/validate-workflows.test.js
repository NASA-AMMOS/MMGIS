/**
 * Fix 4: GitHub Actions hardening — validate workflow files
 *
 * Parses each workflow YAML and asserts:
 * - `permissions:` key exists at the top level or job level
 * - All `uses:` references to third-party actions use 40-char hex SHA pins
 * - bump-version.yml does not use the unsafe `node -e "require('./package.json')"` pattern
 */

const fs = require('fs');
const path = require('path');

// Simple YAML-like parser for `uses:` and `permissions:` detection
// (avoids requiring js-yaml as a dev dependency)

const WORKFLOWS_DIR = path.join(__dirname, '..', '..', '.github', 'workflows');

const workflowFiles = [
  'docker-build.yml',
  'security-scan.yml',
  'playwright-tests.yml',
  'bump-version.yml',
];

function getWorkflowContent(filename) {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, filename), 'utf-8');
}

// Test: permissions key exists
for (const file of workflowFiles) {
  const content = getWorkflowContent(file);
  const hasPermissions = /^\s*permissions\s*:/m.test(content);
  if (!hasPermissions) {
    console.error(`FAIL: ${file} missing permissions: key`);
    process.exit(1);
  }
  console.log(`PASS: ${file} has permissions: key`);
}

// Test: all third-party uses: references use SHA pins
const SHA_PATTERN = /^[a-f0-9]{40}$/;
for (const file of workflowFiles) {
  const content = getWorkflowContent(file);
  const usesMatches = content.matchAll(/uses:\s*([^\s]+)/g);
  for (const match of usesMatches) {
    const action = match[1];
    // Skip local actions (starting with ./)
    if (action.startsWith('./')) continue;

    const atIndex = action.lastIndexOf('@');
    if (atIndex === -1) {
      console.error(`FAIL: ${file} — action ${action} has no @ version reference`);
      process.exit(1);
    }
    const ref = action.substring(atIndex + 1);
    if (!SHA_PATTERN.test(ref)) {
      console.error(`FAIL: ${file} — action ${action} uses tag "${ref}" instead of SHA pin`);
      process.exit(1);
    }
    console.log(`PASS: ${file} — ${action} is SHA-pinned`);
  }
}

// Test: bump-version.yml does not use node -e "require('./package.json')" pattern
{
  const content = getWorkflowContent('bump-version.yml');
  const hasUnsafePattern = /node\s+-e\s+["'].*require\s*\(\s*['"]\.\/package\.json['"]\s*\)/.test(content);
  if (hasUnsafePattern) {
    console.error('FAIL: bump-version.yml still uses unsafe node -e require(package.json) pattern');
    process.exit(1);
  }
  console.log('PASS: bump-version.yml does not use unsafe node -e require pattern');
}

console.log('\nAll workflow validation checks passed!');
