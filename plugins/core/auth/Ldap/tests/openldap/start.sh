#!/usr/bin/env bash
# Starts an OpenLDAP container for the LDAP provider tests on ports 3389 (ldap, StartTLS) and 3636 (ldaps),
# with a fresh test CA (written to $OUT/ca.pem) because the image's own certificate has expired.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/.run}"
NAME="${LDAP_CONTAINER:-mmgis-test-ldap}"
docker rm -f "$NAME" >/dev/null 2>&1 || true
# slapd takes ownership of the mounted certificates, so a previous run's may only be removable from a container
rm -rf "$OUT/certs" 2>/dev/null || docker run --rm --entrypoint rm -v "$OUT:/out" osixia/openldap:1.5.0 -rf /out/certs
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
docker run -d --name "$NAME" -p 3389:389 -p 3636:636 \
  -e LDAP_ORGANISATION="MMGIS Test" -e LDAP_DOMAIN=example.org -e LDAP_ADMIN_PASSWORD=admin-test-password \
  -e LDAP_TLS_CRT_FILENAME=ldap.crt -e LDAP_TLS_KEY_FILENAME=ldap.key -e LDAP_TLS_CA_CRT_FILENAME=ca.crt \
  -e LDAP_TLS_DH_PARAM_FILENAME=dhparam.pem -e LDAP_TLS_VERIFY_CLIENT=never \
  -v "$OUT/certs:/container/service/slapd/assets/certs" \
  osixia/openldap:1.5.0 >/dev/null
# The image starts slapd once to bootstrap, then restarts it, so wait for it to answer several times in a row
ok=0
for i in $(seq 1 90); do
  if docker exec "$NAME" ldapsearch -x -H ldap://localhost -b dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin-test-password -s base >/dev/null 2>&1; then
    ok=$((ok + 1)); [ "$ok" -ge 3 ] && break
  else
    ok=0
  fi
  sleep 1
done
[ "$ok" -ge 3 ] || { echo "OpenLDAP didn't start" >&2; docker logs "$NAME" 2>&1 | tail -20 >&2; exit 1; }
docker cp "$HERE/seed.ldif" "$NAME:/tmp/seed.ldif"
docker cp "$HERE/acl.ldif" "$NAME:/tmp/acl.ldif"
retry() { for i in $(seq 1 10); do "$@" && return 0; sleep 2; done; return 1; }
retry docker exec "$NAME" ldapadd -c -x -H ldap://localhost -D cn=admin,dc=example,dc=org -w admin-test-password -f /tmp/seed.ldif >/dev/null 2>&1 \
  || docker exec "$NAME" ldapsearch -x -H ldap://localhost -b ou=people,dc=example,dc=org -D cn=admin,dc=example,dc=org -w admin-test-password -s base >/dev/null
retry docker exec "$NAME" ldapmodify -Q -Y EXTERNAL -H ldapi:/// -f /tmp/acl.ldif >/dev/null
echo "OpenLDAP ready: ldap://localhost:3389 (StartTLS), ldaps://localhost:3636, CA $OUT/ca.pem"
