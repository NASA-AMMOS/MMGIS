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

Why this still runs after nasa-scrub
------------------------------------
nasa-scrub 3.0.1 fixed the misplaced-rules bug upstream (nasa/scrub PR #119),
so responsibility 2 is now largely defensive. Responsibility 1 is not: scrub's
``translate_results`` resolves every primary result location to an *absolute*
path (``parse_sarif`` joins relative URIs onto the source root, and the 2.1.0
writer emits ``str(warning['file'])`` verbatim -- only code-flow locations get
``relative_to(source_root)``). It also writes that absolute source root into
``uriBaseId``, where SARIF expects a symbolic name that keys into
``originalUriBaseIds``. Both defeat SonarQube's file mapping, so the scrub
output is passed through this script before import.
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
