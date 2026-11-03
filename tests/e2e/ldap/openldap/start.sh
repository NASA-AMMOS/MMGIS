#!/usr/bin/env bash
# Starts an OpenLDAP container for tests/e2e/ldap on ports 3389 (ldap, StartTLS) and 3636 (ldaps),
# with a fresh test CA (written to $OUT/ca.pem) because the image's own certificate has expired.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/.run}"
NAME="${LDAP_CONTAINER:-mmgis-test-ldap}"
mkdir -p "$OUT/certs"
cd "$OUT/certs"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=MMGIS test CA" -keyout ca.key -out ca.crt 2>/dev/null
# slapd (GnuTLS) needs a traditional RSA key
openssl genrsa -traditional -out ldap.key 2048 2>/dev/null
openssl req -new -key ldap.key -subj "/CN=localhost" -out ldap.csr 2>/dev/null
printf "subjectAltName=DNS:localhost,IP:127.0.0.1\n" > san.ext
openssl x509 -req -in ldap.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 2 -extfile san.ext -out ldap.crt 2>/dev/null
openssl dhparam -out dhparam.pem 1024 2>/dev/null
chmod 644 ./*
cp ca.crt "$OUT/ca.pem"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -p 3389:389 -p 3636:636 \
  -e LDAP_ORGANISATION="MMGIS Test" -e LDAP_DOMAIN=example.org -e LDAP_ADMIN_PASSWORD=admin-test-password \
  -e LDAP_TLS_CRT_FILENAME=ldap.crt -e LDAP_TLS_KEY_FILENAME=ldap.key -e LDAP_TLS_CA_CRT_FILENAME=ca.crt \
  -e LDAP_TLS_DH_PARAM_FILENAME=dhparam.pem -e LDAP_TLS_VERIFY_CLIENT=never \
  -v "$OUT/certs:/container/service/slapd/assets/certs" \
  osixia/openldap:1.5.0 >/dev/null
for i in $(seq 1 60); do
  if docker exec "$NAME" ldapsearch -x -H ldap://localhost -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin-test-password -s base >/dev/null 2>&1; then break; fi
  sleep 1
done
docker cp "$HERE/seed.ldif" "$NAME:/tmp/seed.ldif"
docker cp "$HERE/acl.ldif" "$NAME:/tmp/acl.ldif"
docker exec "$NAME" ldapadd -x -H ldap://localhost -D cn=admin,dc=example,dc=org -w admin-test-password -f /tmp/seed.ldif >/dev/null
docker exec "$NAME" ldapmodify -Q -Y EXTERNAL -H ldapi:/// -f /tmp/acl.ldif >/dev/null
echo "OpenLDAP ready: ldap://localhost:3389 (StartTLS), ldaps://localhost:3636, CA $OUT/ca.pem"
