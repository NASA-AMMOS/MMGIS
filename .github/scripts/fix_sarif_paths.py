#!/usr/bin/env python3
"""
Fix file paths in SARIF files to be relative to the workspace root.
This is necessary for SonarQube to correctly map issues to source files.
"""
import json
import sys
import os


def fix_sarif_paths(sarif_file, output_file, workspace_path):
    """
    Convert absolute file paths in SARIF to relative paths.

    Args:
        sarif_file: Input SARIF file path
        output_file: Output SARIF file path
        workspace_path: Workspace root directory path
    """
    try:
        with open(sarif_file, 'r', encoding='utf-8') as f:
            sarif = json.load(f)

        modified = False

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

        # Write the modified SARIF file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sarif, f, ensure_ascii=False, indent=2)

        if modified:
            print(f"✓ Fixed file paths in {os.path.basename(output_file)}")
        else:
            print(f"ℹ No path changes needed for {os.path.basename(output_file)}")
        return 0

    except Exception as e:
        print(f"ERROR processing {sarif_file}: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: fix_sarif_paths.py <input_sarif> <output_sarif> <workspace_path>", file=sys.stderr)
        sys.exit(1)

    sys.exit(fix_sarif_paths(sys.argv[1], sys.argv[2], sys.argv[3]))
