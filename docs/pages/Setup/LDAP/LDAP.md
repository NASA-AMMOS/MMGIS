---
layout: page
title: LDAP Login
permalink: /setup/ldap
parent: Setup
nav_order: 4
---

# LDAP Login

The `ldap` login provider checks usernames and passwords against your organization's directory (OpenLDAP, Active Directory, or anything else that speaks LDAP). People sign in on the normal MMGIS login form, MMGIS links them to an MMGIS account by a permanent directory id, and their directory groups can be given roles in Configure > Users & Access.

MMGIS never stores directory passwords, but it does receive them when people sign in. If your organization offers single sign-on (an authenticating proxy, OIDC or SAML), prefer that.

##### Contents

- [What to ask your directory admins for](#what-to-ask-your-directory-admins-for)
- [Configuration](#configuration)
- [What people see](#what-people-see)
- [Groups and roles](#groups-and-roles)
- [Accounts](#accounts)
- [Troubleshooting](#troubleshooting)

## What to ask your directory admins for

- The server address, and whether it uses LDAPS (port 636) or StartTLS (port 389).
- The CA certificate that signed the server's certificate, if it isn't from a public CA.
- Either a read-only service account for MMGIS, or the format of people's DNs (or Active Directory `user@domain` names) so MMGIS can sign in as them directly.
- Where people and groups live (search bases), which attribute is the login name and which is a permanent id.
- Firewall access from the MMGIS server to the directory's port.

## Configuration

All settings are ENVs; see [ENVs](/MMGIS/setup/envs) for each `LDAP_*` variable. Keep `local` in `AUTH_PROVIDERS` so local admin accounts can still sign in to `/configure`.

OpenLDAP with a service account:

```
AUTH_PROVIDERS=["ldap","local"]
LDAP_URL=ldaps://ldap.example.org:636
LDAP_TLS_CA=/etc/mmgis/internal-ca.pem
LDAP_BIND_DN=cn=mmgis-svc,ou=services,dc=example,dc=org
LDAP_BIND_PASSWORD=...
LDAP_USER_SEARCH_BASE=ou=people,dc=example,dc=org
LDAP_USER_SEARCH_FILTER=(uid={{username}})
LDAP_GROUP_SEARCH_BASE=ou=groups,dc=example,dc=org
LDAP_DISPLAY_NAME=Example Directory
```

Active Directory, signing in as the person (no service account):

```
AUTH_PROVIDERS=["ldap","local"]
LDAP_URL=ldaps://dc1.corp.example.org:636
LDAP_USER_DN_TEMPLATE={{username}}@corp.example.org
LDAP_USER_SEARCH_BASE=OU=Users,DC=corp,DC=example,DC=org
LDAP_USER_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_SUBJECT_ATTRIBUTE=objectGUID
LDAP_USERNAME_ATTRIBUTE=sAMAccountName
```

- **Encryption is required.** `ldaps://`, or `ldap://` with `LDAP_STARTTLS=true`. The certificate must chain to a trusted CA (`LDAP_TLS_CA` for internal CAs) and match the host name in `LDAP_URL`; MMGIS never turns these checks off. `LDAP_ALLOW_INSECURE=true` allows plain `ldap://` for local testing only.
- **`LDAP_BIND_PASSWORD`** can come from the environment like `DB_PASS`. Inject it at runtime (Docker or Kubernetes secrets), keep `.env` readable only by MMGIS, and ask for a read-only account.
- Usernames are escaped before they go into filters and DNs, empty passwords are refused before contacting the directory, and a search must match exactly one person.

## What people see

The login page, Configure sign-in and the in-app login modal share one username/password form:

- **Only LDAP** (or LDAP plus a proxy): a "Sign in with <LDAP_DISPLAY_NAME>" banner above the form, with `LDAP_LOGIN_HINT` under it.
- **LDAP and local accounts:** a switch above the form ("<LDAP_DISPLAY_NAME> | MMGIS account"). The first provider in `AUTH_PROVIDERS` is the default, and the browser remembers the last choice. The password only goes to the selected provider. Sign-up only appears on the MMGIS account tab.
- **`AUTH_LOCAL_LOGIN=admins`:** local accounts are only offered at Configure sign-in.
- `LDAP_USERNAME_LABEL` names the username field. MMGIS doesn't offer a way to reset directory passwords; people use their organization's usual process.
- Errors say which provider failed: wrong username or password, directory unavailable, an expired Active Directory password, or a sign-in that can't be used with MMGIS yet (see below).
- Once signed in, the account bubble's tooltip says which provider was used.

## Groups and roles

By default MMGIS reads the person's `memberOf` attribute (Active Directory, or OpenLDAP with the memberof overlay). Without it, set `LDAP_GROUP_SEARCH_BASE` to search for groups whose `member` is the person, or `LDAP_GROUP_SEARCH_FILTER=(memberUid={{username}})` for posixGroup groups.

Groups are reported by name (`cn=science-team,ou=groups,...` is `science-team`). In Configure > Users & Access > Groups, create a group with **Members from LDAP** and that name, then give the group a role. Membership is updated at every login.

## Accounts

- The first LDAP login creates an MMGIS account, linked by `LDAP_SUBJECT_ATTRIBUTE` (`entryUUID`, or `objectGUID` on Active Directory), so renames and moves in the directory keep the same account.
- A directory username that already belongs to an MMGIS account (for example a local account) is refused. The user only sees "This sign-in can't be used with MMGIS yet. Ask an administrator.", so the page never reveals that the username is taken; the server log records a warning with the provider, subject and reason. MMGIS never takes over an existing account.
- LDAP accounts have no MMGIS password, so Users & Access can't generate a password reset link for them.
- With `AUTH_PROVIDERS=["ldap"]`, local accounts, including a SuperAdmin created at setup, can't sign in anywhere. To keep a local admin, use `["ldap","local"]` with `AUTH_LOCAL_LOGIN=admins`: the local option then only appears on Configure sign-in. To drop local entirely, first sign in once with LDAP, then, while local is still enabled, grant that LDAP account SuperAdmin (or an LDAP group an admin role) in Users & Access.
- Removing `ldap` from `AUTH_PROVIDERS` ends LDAP sessions and API tokens; the accounts, groups and grants are kept.
- Someone disabled in the directory can't sign in again, but an existing MMGIS session (up to its normal lifetime) and their API tokens keep working until an admin removes the account or its tokens.

## Troubleshooting

| Message | Cause |
|---|---|
| MMGIS refuses to start with an `LDAP_*` error | A required setting is missing or malformed; the message names it. |
| "<name> is unavailable" | MMGIS couldn't reach the directory, the TLS certificate didn't verify, the service account was rejected, or the entry had no `LDAP_SUBJECT_ATTRIBUTE`. The server log has the reason. |
| "Invalid <name> username or password" for everyone | Check `LDAP_USER_SEARCH_BASE`/`LDAP_USER_SEARCH_FILTER` (or `LDAP_USER_DN_TEMPLATE`) and that the service account may read people. |
| Groups don't apply | The group's external name must equal the directory group's name; check whether your directory has `memberOf`, or set `LDAP_GROUP_SEARCH_BASE`. |

To try it locally, `tests/e2e/ldap/openldap/start.sh` starts an OpenLDAP container with test users; `tests/e2e/ldap/ldap-provider.spec.js` shows the matching settings.
