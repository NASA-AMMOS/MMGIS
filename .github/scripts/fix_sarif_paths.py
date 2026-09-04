#!/usr/bin/env python3
"""
Fix file paths in SARIF files to be relative to the workspace root, and
defensively harden the report so SonarQube can attribute issues to a tool
and rule.

Two responsibilities:

1. Path relativization: absolute artifact/result URIs rooted at the workspace
   are made workspace-relative so SonarQube maps issues to source files.

2. Attribution hardening: SonarQube's SARIF importer reads the tool name from
   ``runs[].tool.driver.name`` (mandatory) and rule metadata from
   ``runs[].tool.driver.rules[]``. Anything placed under ``runs[].tool.rules``
   (a known nasa/scrub output bug) is ignored on import, which silently strips
   rule attribution. This script normalizes the report itself: it moves
   misplaced ``tool.rules`` under ``tool.driver.rules``, ensures a
   ``driver.name`` exists, and corrects the broken ``$schema`` URL.

   For native CodeQL SARIF -- which already has rich rules under
   ``tool.driver`` and a valid schema -- every hardening step is a no-op, so
   CodeQL's rule names, descriptions, and severities are preserved intact.

3. Rule promotion: github/codeql-action puts its query metadata under
   ``runs[].tool.extensions[].rules``, leaving ``tool.driver.rules`` empty.
   SonarQube reads only the driver, so it sees no rule metadata at all and
   defaults every imported issue to MEDIUM. ``promote_extension_rules`` lifts
   those rules onto the driver with their severities intact.

Why this replaced nasa-scrub in the workflow
--------------------------------------------
The AMMOS scanning guide routes CodeQL output through
``scrub.tools.parsers.translate_results`` before import. Measured against a
real CodeQL report from this repo (run 33824590350), that step made the result
strictly worse:

- CodeQL already emits workspace-relative URIs with a symbolic
  ``uriBaseId`` of ``%SRCROOT%``. scrub resolves them to absolute paths and
  writes the absolute source root into ``uriBaseId``, so the relativization
  above existed only to undo scrub's own damage.
- scrub rebuilds ``driver.rules`` as id-only stubs
  (``{"id": "js/redos", "shortDescription": {"text": "js/redos"}}``),
  discarding ``defaultConfiguration.level`` and ``security-severity``. All 67
  findings imported as MEDIUM; ``js/redos`` is really 7.5/error.
- scrub dropped every ``relatedLocations`` entry (61 -> 0).

Feeding CodeQL's own SARIF through this script instead preserves rule
descriptions, severities, code flows and related locations, and needs no
third-party dependency.
"""
import json
import sys
import os

# The valid SARIF 2.1.0 schema URL. CodeQL and other tools sometimes emit the
# old master-branch URL (which 404s); rewrite it. Mirrors nasa/scrub PR #121.
GOOD_SCHEMA_URL = (
    'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/'
    'sarif-2.1/schema/sarif-schema-2.1.0.json'
)
BAD_SCHEMA_URLS = (
    'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/'
    'Schemata/sarif-schema-2.1.0.json',
)


def promote_extension_rules(run):
    """Copy CodeQL's rule metadata from tool.extensions[] into tool.driver.rules.

    github/codeql-action emits query metadata under
    ``runs[].tool.extensions[].rules`` -- one tool component per query pack --
    and has each result reference it indirectly through
    ``result.rule.toolComponent.index``. ``tool.driver.rules`` is left empty.

    SonarQube's SARIF importer only reads ``runs[].tool.driver.rules``, so the
    rules are invisible to it: every issue imports with no description and no
    severity, and the importer falls back to MEDIUM for all of them. Flattening
    the extension rules into the driver preserves CodeQL's real
    ``shortDescription``, ``fullDescription``, ``help``,
    ``defaultConfiguration.level`` and ``properties.security-severity``.

    Returns True if any change was made. No-op when the driver already carries
    its own rules, so a report that is already well-formed is left alone.
    """
    tool = run.get('tool')
    if not isinstance(tool, dict):
        return False
    driver = tool.setdefault('driver', {})
    if not isinstance(driver, dict) or driver.get('rules'):
        return False

    promoted = []
    index_of = {}
    for extension in tool.get('extensions', []):
        for rule in extension.get('rules', []) or []:
            rule_id = rule.get('id')
            if rule_id is None or rule_id in index_of:
                continue
            index_of[rule_id] = len(promoted)
            promoted.append(rule)

    if not promoted:
        return False

    driver['rules'] = promoted

    # Re-point results at the driver's rule array. The original
    # rule.toolComponent index refers to an extension and is meaningless once
    # the rules live on the driver.
    for result in run.get('results', []):
        rule_id = result.get('ruleId') or (result.get('rule') or {}).get('id')
        index = index_of.get(rule_id)
        if index is None:
            continue
        result['ruleId'] = rule_id
        result['ruleIndex'] = index
        result['rule'] = {'id': rule_id, 'index': index}
        # SARIF derives an absent result.level from the rule's
        # defaultConfiguration; make it explicit so the importer cannot miss it.
        if 'level' not in result:
            level = promoted[index].get('defaultConfiguration', {}).get('level')
            if level:
                result['level'] = level

    return True


def harden_attribution(sarif):
    """Normalize a SARIF document so SonarQube can attribute imported issues.

    Returns True if any change was made. Safe no-op on well-formed CodeQL
    SARIF -- it never overwrites existing driver.name or driver.rules and never
    discards rule metadata.
    """
    modified = False

    # Correct a broken top-level $schema URL (see PR #121).
    if sarif.get('$schema') in BAD_SCHEMA_URLS:
        sarif['$schema'] = GOOD_SCHEMA_URL
        modified = True

    for run in sarif.get('runs', []):
        tool = run.get('tool')
        if not isinstance(tool, dict):
            continue
        driver = tool.setdefault('driver', {})
        if not isinstance(driver, dict):
            continue

        # Move any misplaced rules from tool.rules to tool.driver.rules.
        # SonarQube only reads tool.driver.rules, so leaving them under tool
        # loses attribution. Only move when the driver doesn't already have
        # its own (richer) rules, so native CodeQL metadata is never clobbered.
        if 'rules' in tool:
            if not driver.get('rules'):
                driver['rules'] = tool['rules']
            del tool['rules']
            modified = True

        # SonarQube drops the whole report if driver.name is missing.
        if not driver.get('name'):
            driver['name'] = 'CodeQL'
            modified = True

    return modified


def strip_absolute_uri_base_id(artifact_loc):
    """Drop a ``uriBaseId`` that holds a filesystem path rather than a symbolic name.

    SARIF 2.1.0 defines ``uriBaseId`` as a key into ``run.originalUriBaseIds``
    (e.g. ``%SRCROOT%``). nasa-scrub instead writes the absolute source root,
    which SonarQube can prepend to an already-relative ``uri``. Symbolic ids are
    left untouched. Returns True if the key was removed.
    """
    base_id = artifact_loc.get('uriBaseId')
    if isinstance(base_id, str) and (base_id.startswith('/') or base_id.startswith('file://')):
        del artifact_loc['uriBaseId']
        return True
    return False


def fix_sarif_paths(sarif_file, output_file, workspace_path):
    """
    Convert absolute file paths in SARIF to relative paths and harden the
    report for SonarQube attribution.

    Args:
        sarif_file: Input SARIF file path
        output_file: Output SARIF file path
        workspace_path: Workspace root directory path
    """
    try:
        with open(sarif_file, 'r', encoding='utf-8') as f:
            sarif = json.load(f)

        modified = False

        # Lift CodeQL's rule metadata out of tool.extensions[] first, so the
        # hardening below sees a driver that already has its real rules.
        for run in sarif.get('runs', []):
            if promote_extension_rules(run):
                modified = True

        # Normalize tool/driver/rules and schema for reliable attribution.
        if harden_attribution(sarif):
            modified = True

        # Process all runs in the SARIF file
        for run in sarif.get('runs', []):
            # Fix artifact locations
            for artifact in run.get('artifacts', []):
                if 'location' in artifact and 'uri' in artifact['location']:
                    uri = artifact['location']['uri']
                    # Remove file:// prefix if present
                    if uri.startswith('file://'):
                        uri = uri[7:]
                    # Make path relative to workspace
                    if uri.startswith(workspace_path + '/'):
                        uri = uri[len(workspace_path) + 1:]
                        artifact['location']['uri'] = uri
                        modified = True

            # Fix result locations
            for result in run.get('results', []):
                for location in result.get('locations', []):
                    if 'physicalLocation' in location and 'artifactLocation' in location['physicalLocation']:
                        artifact_loc = location['physicalLocation']['artifactLocation']
                        if 'uri' in artifact_loc:
                            uri = artifact_loc['uri']
                            # Remove file:// prefix if present
                            if uri.startswith('file://'):
                                uri = uri[7:]
                            # Make path relative to workspace
                            if uri.startswith(workspace_path + '/'):
                                uri = uri[len(workspace_path) + 1:]
                                artifact_loc['uri'] = uri
                                modified = True
                        # SARIF expects uriBaseId to be a symbolic name that keys
                        # into originalUriBaseIds, not a filesystem path. scrub
                        # writes the absolute source root here, which SonarQube
                        # may prepend to an already-relative uri. Drop it.
                        if strip_absolute_uri_base_id(artifact_loc):
                            modified = True

        # Write the modified SARIF file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sarif, f, ensure_ascii=False, indent=2)

        if modified:
            print(f"✓ Normalized paths/attribution in {os.path.basename(output_file)}")
        else:
            print(f"ℹ No changes needed for {os.path.basename(output_file)}")
        return 0

    except Exception as e:
        print(f"ERROR processing {sarif_file}: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: fix_sarif_paths.py <input_sarif> <output_sarif> <workspace_path>", file=sys.stderr)
        sys.exit(1)

    sys.exit(fix_sarif_paths(sys.argv[1], sys.argv[2], sys.argv[3]))
