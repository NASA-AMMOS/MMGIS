#!/usr/bin/env bash
# CI setup for the LDAP provider's tests (see scripts/plugin-ci.js): starts the test directory
# and writes the ENVs the tests run with to $MMGIS_CI_ENV. Variant: ldaps or starttls.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${RUNNER_TEMP:-$HERE/openldap}/.run"
case "${1:-ldaps}" in
  ldaps) url=ldaps://localhost:3636 starttls=false ;;
  starttls) url=ldap://localhost:3389 starttls=true ;;
  *) echo "Unknown variant '$1' (ldaps or starttls)" >&2; exit 1 ;;
esac
"$HERE/openldap/start.sh" "$OUT"
service_password=svc-test-password # pragma: allowlist secret
cat >> "${MMGIS_CI_ENV:?}" <<ENV
SITE_ACCESS=optional
AUTH_PROVIDERS=["ldap","local"]
LDAP_URL=$url
LDAP_STARTTLS=$starttls
LDAP_TLS_CA=$OUT/ca.pem
LDAP_BIND_DN=cn=mmgis-svc,ou=services,dc=example,dc=org
LDAP_BIND_PASSWORD=$service_password
LDAP_USER_SEARCH_BASE=ou=people,dc=example,dc=org
LDAP_GROUP_SEARCH_BASE=ou=groups,dc=example,dc=org
AUTH_RECHECK_MINUTES=0.05
ENV
