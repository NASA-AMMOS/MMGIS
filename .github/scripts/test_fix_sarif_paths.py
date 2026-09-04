#!/usr/bin/env python3
"""
Unit tests for fix_sarif_paths.py.

Run with the stdlib test runner (no third-party deps required):

    python3 -m unittest .github.scripts.test_fix_sarif_paths -v

or directly:

    python3 .github/scripts/test_fix_sarif_paths.py

These tests cover two responsibilities of the script:

1. Path relativization: absolute artifact/result URIs rooted at the workspace
   are made workspace-relative so SonarQube can map issues to source files.

2. Attribution hardening: the SARIF is defensively normalized so SonarQube's
   SARIF importer can attribute issues to a tool and rule. This mirrors the fix
   in nasa/scrub PR #121 (move rules under ``tool.driver``, correct the
   ``$schema`` URL) so that MMGIS does not depend on an unreleased scrub while
   still guaranteeing importable, well-attributed output.

   Importantly, well-formed CodeQL SARIF (rules already under ``tool.driver``)
   must be left intact -- hardening is a no-op there and must NOT discard
   CodeQL's rich rule metadata.
"""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fix_sarif_paths as mod  # noqa: E402


GOOD_SCHEMA = (
    "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/"
    "sarif-2.1/schema/sarif-schema-2.1.0.json"
)
BAD_SCHEMA = (
    "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/"
    "Schemata/sarif-schema-2.1.0.json"
)


def _run_file(sarif_obj, workspace):
    """Write sarif_obj to a temp file, run the script's file entry point, and
    return the parsed output SARIF."""
    with tempfile.TemporaryDirectory() as d:
        in_path = os.path.join(d, "in.sarif")
        out_path = os.path.join(d, "out.sarif")
        with open(in_path, "w", encoding="utf-8") as f:
            json.dump(sarif_obj, f)
        rc = mod.fix_sarif_paths(in_path, out_path, workspace)
        assert rc == 0, "fix_sarif_paths returned nonzero"
        with open(out_path, "r", encoding="utf-8") as f:
            return json.load(f)


class TestPathRelativization(unittest.TestCase):
    def test_absolute_result_uri_made_relative(self):
        ws = "/home/runner/work/MMGIS/MMGIS"
        sarif = {
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {"driver": {"name": "CodeQL", "rules": []}},
                    "results": [
                        {
                            "ruleId": "js/xss",
                            "message": {"text": "x"},
                            "locations": [
                                {
                                    "physicalLocation": {
                                        "artifactLocation": {
                                            "uri": ws + "/src/essence/foo.js"
                                        },
                                        "region": {"startLine": 1},
                                    }
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        out = _run_file(sarif, ws)
        uri = out["runs"][0]["results"][0]["locations"][0][
            "physicalLocation"
        ]["artifactLocation"]["uri"]
        self.assertEqual(uri, "src/essence/foo.js")

    def test_file_scheme_prefix_stripped(self):
        ws = "/work/MMGIS"
        sarif = {
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {"driver": {"name": "CodeQL", "rules": []}},
                    "artifacts": [
                        {"location": {"uri": "file://" + ws + "/API/app.js"}}
                    ],
                    "results": [],
                }
            ],
        }
        out = _run_file(sarif, ws)
        self.assertEqual(
            out["runs"][0]["artifacts"][0]["location"]["uri"], "API/app.js"
        )


class TestUriBaseId(unittest.TestCase):
    """nasa-scrub writes the absolute source root into uriBaseId, where SARIF
    expects a symbolic name. It must be dropped; symbolic ids must survive."""

    @staticmethod
    def _sarif(ws, uri, base_id):
        return {
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {"driver": {"name": "CodeQL", "rules": []}},
                    "results": [
                        {
                            "ruleId": "js/xss",
                            "message": {"text": "x"},
                            "locations": [
                                {
                                    "physicalLocation": {
                                        "artifactLocation": {
                                            "uri": uri,
                                            "uriBaseId": base_id,
                                        },
                                        "region": {"startLine": 1},
                                    }
                                }
                            ],
                        }
                    ],
                }
            ],
        }

    def _artifact_loc(self, out):
        return out["runs"][0]["results"][0]["locations"][0][
            "physicalLocation"
        ]["artifactLocation"]

    def test_scrub_style_absolute_uri_base_id_dropped(self):
        ws = "/home/runner/work/MMGIS/MMGIS"
        out = _run_file(self._sarif(ws, ws + "/src/essence/foo.js", ws), ws)
        loc = self._artifact_loc(out)
        self.assertEqual(loc["uri"], "src/essence/foo.js")
        self.assertNotIn("uriBaseId", loc)

    def test_symbolic_uri_base_id_preserved(self):
        ws = "/home/runner/work/MMGIS/MMGIS"
        out = _run_file(self._sarif(ws, "src/essence/foo.js", "%SRCROOT%"), ws)
        loc = self._artifact_loc(out)
        self.assertEqual(loc["uri"], "src/essence/foo.js")
        self.assertEqual(loc.get("uriBaseId"), "%SRCROOT%")


class TestAttributionHardening(unittest.TestCase):
    def test_misplaced_rules_moved_under_driver(self):
        """scrub pre-#121 shape: rules under tool, not tool.driver.
        SonarQube ignores tool.rules, so they must be moved to
        tool.driver.rules to preserve rule attribution."""
        ws = "/work/MMGIS"
        sarif = {
            "version": "2.1.0",
            "$schema": BAD_SCHEMA,
            "runs": [
                {
                    "tool": {
                        "driver": {"name": "javascript"},
                        "rules": [
                            {"id": "js/xss", "shortDescription": {"text": "js/xss"}}
                        ],
                    },
                    "results": [{"ruleId": "js/xss", "message": {"text": "x"}}],
                }
            ],
        }
        out = _run_file(sarif, ws)
        tool = out["runs"][0]["tool"]
        self.assertNotIn(
            "rules", tool, "rules must not remain under tool"
        )
        self.assertEqual(
            tool["driver"]["rules"],
            [{"id": "js/xss", "shortDescription": {"text": "js/xss"}}],
        )

    def test_schema_url_corrected(self):
        """The broken master-branch schema URL must be rewritten to the valid
        main-branch URL (mirrors scrub PR #121)."""
        ws = "/work/MMGIS"
        sarif = {
            "version": "2.1.0",
            "$schema": BAD_SCHEMA,
            "runs": [
                {
                    "tool": {"driver": {"name": "CodeQL", "rules": []}},
                    "results": [],
                }
            ],
        }
        out = _run_file(sarif, ws)
        self.assertEqual(out["$schema"], GOOD_SCHEMA)

    def test_missing_driver_name_defaulted(self):
        """SonarQube requires tool.driver.name. If absent, default it so the
        report is not silently dropped on import."""
        ws = "/work/MMGIS"
        sarif = {
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {"driver": {}},
                    "results": [{"ruleId": "r", "message": {"text": "x"}}],
                }
            ],
        }
        out = _run_file(sarif, ws)
        self.assertTrue(out["runs"][0]["tool"]["driver"].get("name"))

    def test_wellformed_codeql_left_intact(self):
        """Native CodeQL SARIF already has rich rules under tool.driver. The
        hardening step MUST NOT discard or degrade that metadata."""
        ws = "/work/MMGIS"
        rich_rule = {
            "id": "js/xss",
            "name": "js/xss",
            "shortDescription": {"text": "Client-side cross-site scripting"},
            "fullDescription": {"text": "Writing user input to the DOM ..."},
            "defaultConfiguration": {"level": "error"},
            "properties": {"tags": ["security"], "problem.severity": "error"},
        }
        sarif = {
            "version": "2.1.0",
            "$schema": GOOD_SCHEMA,
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": "CodeQL",
                            "organization": "GitHub",
                            "rules": [rich_rule],
                        }
                    },
                    "results": [{"ruleId": "js/xss", "message": {"text": "x"}}],
                }
            ],
        }
        out = _run_file(sarif, ws)
        driver = out["runs"][0]["tool"]["driver"]
        self.assertEqual(driver["name"], "CodeQL")
        self.assertEqual(driver["organization"], "GitHub")
        self.assertEqual(driver["rules"], [rich_rule])
        self.assertNotIn("rules", out["runs"][0]["tool"])
        self.assertEqual(out["$schema"], GOOD_SCHEMA)


if __name__ == "__main__":
    unittest.main(verbosity=2)
