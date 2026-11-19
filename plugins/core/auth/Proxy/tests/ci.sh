#!/usr/bin/env bash
# CI setup for the proxy provider's tests (see scripts/plugin-ci.js): writes the ENVs the tests
# run with to $MMGIS_CI_ENV. Variant: the PROXY_TRUST mode, network or secret.
set -euo pipefail
trust="${1:-secret}"
case "$trust" in network|secret) ;; *) echo "Unknown variant '$trust' (network or secret)" >&2; exit 1 ;; esac
secret=""
[ "$trust" = secret ] && secret=ci-test-proxy-secret-not-for-production # pragma: allowlist secret
cat >> "${MMGIS_CI_ENV:?}" <<ENV
SITE_ACCESS=required
AUTH_PROVIDERS=["proxy","local"]
PROXY_TRUST=$trust
PROXY_SECRET=$secret
PROXY_GROUPS=["mmgis-users"]
PROXY_LEAD_GROUP=mmgis-leads
ENV
