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
- [Rotating the service password or CA](#rotating-the-service-password-or-ca)
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

Active Directory with a service account. People can type `alice`, `alice@corp.example.org` or `CORP\alice`, and nested groups count:

```
AUTH_PROVIDERS=["ldap","local"]
AUTH_LOCAL_LOGIN=admins
LDAP_URL=ldaps://dc1.corp.example.org:636
LDAP_TLS_CA=/etc/mmgis/corp-ca.pem
LDAP_BIND_DN=CN=mmgis-svc,OU=Service Accounts,DC=corp,DC=example,DC=org
LDAP_BIND_PASSWORD=...
LDAP_USER_SEARCH_BASE=DC=corp,DC=example,DC=org
LDAP_USER_SEARCH_FILTER=(&(objectCategory=person)(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})))
LDAP_USERNAME_DOMAIN=CORP
LDAP_SUBJECT_ATTRIBUTE=objectGUID
LDAP_USERNAME_ATTRIBUTE=sAMAccountName
LDAP_GROUP_SEARCH_BASE=DC=corp,DC=example,DC=org
LDAP_GROUP_SEARCH_FILTER=(&(objectClass=group)(member:1.2.840.113556.1.4.1941:={{dn}}))
LDAP_DISPLAY_NAME=CORP account
LDAP_USERNAME_LABEL=CORP username
```

Active Directory, signing in as the person (no service account):

```
AUTH_PROVIDERS=["ldap","local"]
LDAP_URL=ldaps://dc1.corp.example.org:636
LDAP_USER_DN_TEMPLATE={{username}}@corp.example.org
LDAP_USER_SEARCH_BASE=OU=Users,DC=corp,DC=example,DC=org
LDAP_USER_SEARCH_FILTER=(userPrincipalName={{username}}@corp.example.org)
LDAP_SUBJECT_ATTRIBUTE=objectGUID
LDAP_USERNAME_ATTRIBUTE=sAMAccountName
```

- **Encryption is required.** `ldaps://`, or `ldap://` with `LDAP_STARTTLS=true`. The certificate must chain to a trusted CA (`LDAP_TLS_CA` for internal CAs) and match the host name in `LDAP_URL`; MMGIS never turns these checks off. `LDAP_ALLOW_INSECURE=true` allows plain `ldap://` for local testing only.
- **`LDAP_BIND_PASSWORD`** can come from the environment like `DB_PASS`. Inject it at runtime (Docker or Kubernetes secrets), keep `.env` readable only by MMGIS, and ask for a read-only account.
- Usernames are escaped before they go into filters and DNs, empty passwords are refused before contacting the directory, and a search must match exactly one person.

## What people see

The login page, Configure sign-in and the in-app login modal share one username/password form:

- **Only LDAP** (or LDAP plus a proxy): a "Sign in with <LDAP_DISPLAY_NAME>" banner above the form, with `LDAP_LOGIN_HINT` under it.
- **LDAP and local accounts:** a switch above the form ("<LDAP_DISPLAY_NAME> | MMGIS account"). The first provider in `AUTH_PROVIDERS` is the default, and the browser remembers the provider of the last successful sign-in. After a failed sign-in, the error suggests choosing another account type. The password only goes to the selected provider. Sign-up only appears on the MMGIS account tab.
- **`AUTH_LOCAL_LOGIN=admins`:** local accounts are only offered at Configure sign-in.
- `LDAP_USERNAME_LABEL` names the username field. MMGIS doesn't offer a way to reset directory passwords; people use their organization's usual process.
- Errors say which provider failed: wrong username or password, directory unavailable, an expired Active Directory password, or a sign-in that can't be used with MMGIS yet (see below).
- Once signed in, the account bubble's tooltip says which provider was used.

## Groups and roles

By default MMGIS reads the person's `memberOf` attribute (Active Directory, or OpenLDAP with the memberof overlay). Without it, set `LDAP_GROUP_SEARCH_BASE` to search for groups whose `member` is the person, or `LDAP_GROUP_SEARCH_FILTER=(memberUid={{username}})` for posixGroup groups.

On Active Directory, `memberOf` only lists groups the person is directly in. To include nested groups, search with the in-chain rule: `LDAP_GROUP_SEARCH_BASE=DC=corp,...` and `LDAP_GROUP_SEARCH_FILTER=(&(objectClass=group)(member:1.2.840.113556.1.4.1941:={{dn}}))`. A person's primary group (usually `Domain Users`) appears in neither, so map a regular group instead.

Groups are reported by their full DN in lowercase, e.g. `cn=science-team,ou=groups,dc=example,dc=org`, so two groups called `admins` in different OUs can't be confused and someone who can create groups in their own OU can't take another group's role. In Configure > Users & Access > Groups, create a group with **Members from LDAP** and the group's DN as its external name, then give the group a role. Names must match exactly, including case, so copy the DN from the server log: it lists the groups the directory reported at each login (`Directory groups: …`). Membership is updated at every login and every `AUTH_RECHECK_MINUTES`. To use plain names instead, set `LDAP_GROUP_SEARCH_BASE` to the one OU that holds your MMGIS groups and `LDAP_GROUP_NAME_ATTRIBUTE=cn`. The search includes that OU's sub-OUs, so don't use it if anyone else can create groups below it.

## Accounts

- The first LDAP login creates an MMGIS account, linked by `LDAP_SUBJECT_ATTRIBUTE` (`entryUUID`, or `objectGUID` on Active Directory), so renames and moves in the directory keep the same account.
- A directory username that already belongs to an MMGIS account (for example a local account) is refused. The user only sees "This sign-in can't be used with MMGIS yet. Ask an administrator.", so the page never reveals that the username is taken; the server log records a warning with the provider, subject and reason. MMGIS never takes over an existing account unless an administrator allows a relink (see below).
- LDAP accounts have no MMGIS password, so Users & Access can't generate a password reset link for them.
- With `AUTH_PROVIDERS=["ldap"]`, local accounts, including a SuperAdmin created at setup, can't sign in anywhere. To keep a local admin, use `["ldap","local"]` with `AUTH_LOCAL_LOGIN=admins`: the local option then only appears on Configure sign-in. To drop local entirely, first sign in once with LDAP, then, while local is still enabled, grant that LDAP account SuperAdmin (or an LDAP group an admin role) in Users & Access.
- Removing `ldap` from `AUTH_PROVIDERS` ends LDAP sessions and API tokens; the accounts, groups and grants are kept.
- Configure > Users & Access > People shows how each account signs in (`ldap`, or `MMGIS account` for a local password) and its last LDAP login. Someone renamed in the directory keeps the same MMGIS account and MMGIS username, because drawings and other content are kept under the username. The new directory name is shown as `ldap (as newname)`, and the server log notes the rename.
- If the directory gives someone a new permanent ID (the directory was rebuilt or migrated, their entry was recreated, or `LDAP_SUBJECT_ATTRIBUTE` changed), their sign-in is refused, because their username already belongs to an MMGIS account. To reconnect them, open the account in Users & Access > People, enter their directory username if it differs from the MMGIS username, and click **Allow LDAP relink**. With `LDAP_BIND_DN` set, MMGIS looks the username up right away, shows which entry (DN) it found, and only that entry can claim the account, even if it is renamed before it signs in. For 24 hours, that person's next LDAP sign-in takes over the account once and keeps its roles, grants, API tokens and drawings. Everyone signed in to the account is signed out, and its MMGIS password stops working, so the same button moves a local account to LDAP. Revoke the account's API tokens as well if someone other than this person used it. Only a SuperAdmin can allow relinks, and the last SuperAdmin who signs in with an MMGIS password can't be relinked, counting other SuperAdmins with a pending relink as already moved (keep one for when the directory is down), and the server log records who allowed each relink and when it was used. Allowing a relink also clears that person's failed sign-ins, so earlier refused attempts don't lock them out.
- Allow the relink before the person signs in with LDAP. If their directory username differs from their MMGIS username and they sign in first, MMGIS can't tell they're the same person and creates a new, empty account; Allow LDAP relink then names that account, and you delete it before allowing the relink again.
- A 409 for an account that People shows as `ldap (as othername)` comes from a different person who now has that account's old directory username. Don't relink it: that would hand the account and its drawings to the newcomer.
- Groups are matched by their exact name (by default the full DN). Renaming a group or moving it to another OU in the directory changes that name, so its members lose the group's roles at their next sign-in or recheck. Update the group's external name in Users & Access when that happens; the Groups tab shows how many members each directory group has, so a group that suddenly has 0 stands out.
- Existing sessions and API tokens are rechecked against the directory every `AUTH_RECHECK_MINUTES` (default 15) with the service account. Group changes update roles, and someone deleted, disabled or expired (Active Directory), or locked (OpenLDAP ppolicy, 389 DS / FreeIPA `nsAccountLock`) loses their sessions and tokens and their LDAP group roles. While the directory can't be reached, access stays as it was. On OpenLDAP without ppolicy, changing a leaver's password doesn't end their sessions; delete the entry or lock it with ppolicy. Without `LDAP_BIND_DN` (only `LDAP_USER_DN_TEMPLATE`), MMGIS can't read the directory between logins, so changes apply at the next login; remove the person's tokens in Users & Access when offboarding.

## Rotating the service password or CA

MMGIS reads `LDAP_BIND_PASSWORD` and `LDAP_TLS_CA` at startup, so a change in the directory first takes LDAP sign-in down until MMGIS is updated and restarted.

- **CA certificate:** before the directory switches certificates, put both the old and the new CA in the `LDAP_TLS_CA` PEM file and restart. After the switch, remove the old one.
- **Service password:** create a second service account (or, if the directory allows it, give the account a second password), set `LDAP_BIND_DN`/`LDAP_BIND_PASSWORD` to it and restart, then retire the old one. If the old password is changed first, LDAP sign-ins fail with "<name> is unavailable" until MMGIS has the new one; the startup settings check and the server log say the bind was rejected.

## Troubleshooting

At startup MMGIS checks the settings without anyone's password: it connects, signs in the service account and looks up `LDAP_USER_SEARCH_BASE` and `LDAP_GROUP_SEARCH_BASE`. The server log then says `LDAP settings check passed: ...` or `LDAP settings check failed: ...` with the setting to fix. Every refused login is logged too, with the reason, e.g. `no entry under LDAP_USER_SEARCH_BASE matches (uid=alice)`, `wrong password`, or, on Active Directory, `account disabled`, `account locked` or `account expired`. The person only sees "Invalid <name> username or password".

If the directory rejects the service account, MMGIS stops using it for 5 minutes instead of retrying at every login, so the directory doesn't lock the account. LDAP login answers "unavailable" meanwhile.

| Message | Cause |
|---|---|
| MMGIS refuses to start with an `LDAP_*` error | A required setting is missing or malformed; the message names it. |
| "<name> is unavailable" | MMGIS couldn't reach the directory, the TLS certificate didn't verify, the service account was rejected (MMGIS then waits 5 minutes before trying it again), a search base doesn't exist, or the entry had no `LDAP_SUBJECT_ATTRIBUTE`. The server log has the reason and the setting to check. |
| "MMGIS can't read all of your <name> groups" for one person | They're in more groups than the directory returns to the service account. MMGIS pages group results 500 at a time, but OpenLDAP still caps the total at the hard size limit: raise it for the service account (`olcLimits: dn.exact="<service DN>" size.prtotal=unlimited size.hard=unlimited`), or narrow `LDAP_GROUP_SEARCH_FILTER` to the groups MMGIS maps. Until then that person can't sign in, and existing sessions keep the groups they had. |
| "Invalid <name> username or password" and the log says "found a different entry" | With both `LDAP_USER_DN_TEMPLATE` and `LDAP_USER_SEARCH_BASE`, the search must find the entry the password was checked against (same DN, or for a `{{username}}@domain` template the same `userPrincipalName`). Make the template and `LDAP_USER_SEARCH_FILTER` use the same attribute, e.g. `(userPrincipalName={{username}}@corp.example.org)`. |
| "Invalid <name> username or password" for everyone | The server log says why each login was refused. Check `LDAP_USER_SEARCH_BASE`/`LDAP_USER_SEARCH_FILTER` (or `LDAP_USER_DN_TEMPLATE`) and that the service account may read people. |
| "Invalid <name> username or password" for `CORP\alice` or `alice@corp...` | Set `LDAP_USERNAME_DOMAIN=CORP`, and use a `LDAP_USER_SEARCH_FILTER` that also matches `userPrincipalName` (see the Active Directory example). |
| Groups don't apply | The group's external name must be the directory group's DN (or its `LDAP_GROUP_NAME_ATTRIBUTE` value). The login line in the server log lists the groups the directory reported; if it says `none`, check whether your directory has `memberOf`, or set `LDAP_GROUP_SEARCH_BASE`. |

To try it locally, `plugins/core/auth/Ldap/tests/openldap/start.sh` starts an OpenLDAP container with test users; `plugins/core/auth/Ldap/tests/ldap-provider.spec.js` shows the matching settings.
