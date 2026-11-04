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
- [Moving local users to LDAP](#moving-local-users-to-ldap)
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
# Once everyone has moved to LDAP (see Moving local users to LDAP):
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

- **One directory address.** `LDAP_URL` takes a single URL; MMGIS doesn't fail over between hosts, so point it at a load-balanced name if the directory has one.
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

Groups are reported by their full DN in lowercase, e.g. `cn=science-team,ou=groups,dc=example,dc=org`, so two groups called `admins` in different OUs can't be confused and someone who can create groups in their own OU can't take another group's role. In Configure > Users & Access > Groups, create a group with **Members from LDAP** and the group's DN as its external name, then give the group a role. DNs you enter are saved in that same lowercase form, so `CN=Science-Team,OU=Groups,DC=example,DC=org` copied from an AD tool works too. Escaped characters may be typed either way (`\,` or `\2c`). A plain name such as `science-team` is refused, since it could never match a DN. External names can be at most 255 characters. Other names (with `LDAP_GROUP_NAME_ATTRIBUTE`) must match exactly, including case. Users & Access > Groups > **Check a provider user** takes one group per line, DNs included. To see what the directory reports, open Groups > **Check a provider user** and leave the groups empty (needs `LDAP_BIND_DN`): it lists every group the directory reports for that person now. The server log also lists them at each login (`Directory groups: …`). Membership is updated at every login and every `AUTH_RECHECK_MINUTES`. To use plain names instead, set `LDAP_GROUP_SEARCH_BASE` to the one OU that holds your MMGIS groups and `LDAP_GROUP_NAME_ATTRIBUTE=cn`. The search includes that OU's sub-OUs, so don't use it if anyone else can create groups below it. Turning `LDAP_GROUP_NAME_ATTRIBUTE` on or off changes the form every group is reported in, so update each LDAP group's external name at the same time, and change the setting on every MMGIS process together; until then those groups have no members, and the server log warns about them at startup and at each sign-in.

## Accounts

- The first LDAP login creates an MMGIS account, linked by `LDAP_SUBJECT_ATTRIBUTE` (`entryUUID`, or `objectGUID` on Active Directory), so renames and moves in the directory keep the same account. MMGIS stores subjects and usernames in up to 255 characters, so with `LDAP_SUBJECT_ATTRIBUTE=dn` someone whose DN is longer is refused (see the server log); keep the default `entryUUID` / `objectGUID` for deep OU trees. With `dn`, whoever can create an entry at a leaver's old DN also signs in as that leaver's account, so prefer `entryUUID` / `objectGUID` wherever directory admins with limited rights can create entries.
- A directory username that already belongs to an MMGIS account (for example a local account) is refused. The user only sees "This sign-in can't be used with MMGIS yet. Ask an administrator.", so the page never reveals that the username is taken; the server log records a warning with the provider, subject and reason. MMGIS never takes over an existing account unless an administrator allows a relink (see below).
- The usernames `group` and `guest` are reserved (the Draw tool owns shared and master files under `group`, and MMGIS calls signed-out visitors `guest`), so a directory entry with either username can't sign in.
- While `ldap` is enabled, LDAP accounts have no MMGIS password, so Users & Access can't generate a password reset link for them.
- With `AUTH_PROVIDERS=["ldap"]`, local accounts, including a SuperAdmin created at setup, can't sign in anywhere. To keep a local admin, use `["ldap","local"]` with `AUTH_LOCAL_LOGIN=admins`: the local option then only appears on Configure sign-in. Set `AUTH_LOCAL_LOGIN=admins` only after every non-admin local account has moved to LDAP (People shows no non-admin "MMGIS account" rows): until then those people can't sign in with either form. To drop local entirely, first sign in once with LDAP, then, while local is still enabled, grant that LDAP account SuperAdmin (or an LDAP group an admin role) in Users & Access. Before moving to another directory or changing `LDAP_SUBJECT_ATTRIBUTE`, enable local again and keep a local SuperAdmin and its password: the change signs out every LDAP account and stops its API tokens until it's relinked, SuperAdmins included, and only a SuperAdmin can allow relinks. Startup logs how many linked accounts a changed `LDAP_SUBJECT_ATTRIBUTE` affects.
- Removing `ldap` from `AUTH_PROVIDERS` stops LDAP sessions from working (those used meanwhile end; the others resume, rechecked, once `ldap` is back); the accounts, groups and grants are kept, but LDAP groups grant nothing until `ldap` is back. Visitor sign-up stays closed meanwhile (unless `AUTH_LOCAL_ALLOW_SIGNUP=true`), so nobody can take a directory username while `ldap` is out; on a site leaving LDAP for good it stays closed until the last LDAP-linked account is deleted. Those accounts (including local accounts that were relinked to LDAP) then count as MMGIS accounts: they can get back in through a password reset link from Users & Access, as long as `local` is enabled. As with any reset, using it revokes the account's existing API tokens for good, so those people need new ones. Their API tokens, and new ones, stay off until `ldap` is back, so a leaver's tokens don't come back with it; creating a token is refused for them meanwhile, and Check linked accounts skips them. Once `ldap` is back, their MMGIS passwords stop working again, and sessions and tokens opened meanwhile are rechecked against the directory like LDAP ones. Give every MMGIS process sharing a database the same `AUTH_PROVIDERS`, `AUTH_LOCAL_LOGIN` and `SITE_ACCESS`, and upgrade and restart them together (an older MMGIS process on the same database skips these protections: it lets visitors sign up, accepts look-alike usernames and saves group DNs in a form that matches nobody): a process that refuses a session ends it for every process, so one without `ldap` ends the LDAP sessions it sees, and one with `AUTH_LOCAL_LOGIN=admins` ends non-admin local sessions.
- Deleting an account keeps its drawings but takes them away from the username, and off other people's shared-editor lists, so someone later given the same username (a reused directory name) can't open or edit them.
- Configure > Users & Access > People shows how each account signs in (`ldap`, or `MMGIS account` for a local password) and its last LDAP login. Someone renamed in the directory keeps the same MMGIS account and MMGIS username, because drawings and other content are kept under the username. The new directory name is shown as `ldap (as newname)`, and the server log notes the rename. A pending relink shows as `(relink to ldap pending)`, or `stale` when it can no longer take effect. The People search also matches this column, so searching `not found`, `relink`, `stale` or `MMGIS account` lists the accounts that still need attention.
- If the directory gives someone a new permanent ID (the directory was rebuilt or migrated, their entry was recreated, or `LDAP_SUBJECT_ATTRIBUTE` changed), their sign-in is refused, because their username already belongs to an MMGIS account. To reconnect them, open the account in Users & Access > People, enter their directory username if it differs from the MMGIS username, and click **Allow LDAP relink**. With `LDAP_BIND_DN` set, MMGIS looks the username up right away, shows which entry (DN) it found, and only that entry can claim the account, even if it is renamed before it signs in. For 24 hours, that person's next LDAP sign-in takes over the account once and keeps its roles, grants, API tokens and drawings. Everyone signed in to the account is signed out, and its MMGIS password stops working, so the same button moves a local account to LDAP. Revoke the account's API tokens as well if someone other than this person used it. Only a SuperAdmin can allow relinks, and the last SuperAdmin who signs in with an MMGIS password can't be relinked, counting other SuperAdmins with a pending relink as already moved (keep one for when the directory is down), and the server log records who allowed each relink and when it was used. Allowing a relink also clears that person's failed sign-ins, so earlier refused attempts don't lock them out. After `LDAP_SUBJECT_ATTRIBUTE` changes, People marks those accounts `linked under an old subject setting` rather than `not found`, and their relink confirmation drops the leaver warning. After a move to a new directory every account shows `not found`, so that warning appears on every relink: check each one against your list of who is moving. When moving to a new directory, allow relinks only after the switch: a relink pinned to an entry in the old directory can't be claimed from the new one. If that happens, People says so on the account (and the server log names it); cancel the relink and allow it again. During the move, keep a local SuperAdmin, list `local` first in `AUTH_PROVIDERS` so people who aren't relinked yet still see their MMGIS sign-in, and after the switch click **Check linked accounts** in People: it asks the directory about every linked account at once, so the ones whose entries are gone show "not found in ldap" without waiting for each person to sign in. If it says some accounts couldn't be checked, the directory settings (URL, CA or service account) are wrong or the directory is down; fix that and check again. If the directory hands a renamed person's old username to someone new, don't relink: MMGIS looks for the old entry anywhere under the directory root (the `dc=` part of `LDAP_USER_SEARCH_BASE`, or the directory's naming context holding it, e.g. `o=corp`; the service account needs read access there, and the startup settings check warns if it hasn't, in which case relinks to a different entry are refused; with `LDAP_SUBJECT_ATTRIBUTE=dn`, where a move changes the subject, a moved leaver isn't found, so check yourself), so a leaver moved to a disabled OU still counts, the relink is refused, and the server log says the old entry still exists, and the newcomer can't sign in while the old account holds that MMGIS username (usernames never change, since drawings are stored under them). Their API tokens stay off until they sign in after the relink is allowed, so ask token owners to sign in first. **Check linked accounts** also flags relinks allowed before the directory changed, which then need allowing again.
- Allow the relink before the person signs in with LDAP. If their directory username differs from their MMGIS username and they sign in first, MMGIS can't tell they're the same person and creates a new, empty account; Allow LDAP relink then names that account. Delete it, entering the original account's username under "Give their drawings to" so anything they saved meanwhile moves with them, then allow the relink again.
- A 409 for an account that People shows as `ldap (as othername)`, or as `not found in ldap since …` (its entry was deleted or disabled), may come from a different person who now has that account's old directory username. Check before relinking: a relink would hand the account and its drawings to the newcomer.
- A person's first LDAP sign-in creates their MMGIS account with only what their directory groups and the "Logged-in users" audience (Users & Access > Site-wide) give. "Default for new accounts" applies to local accounts only, so a directory sign-in never opens missions by itself; to let every directory user view some missions, grant them to "Logged-in users" or to a directory group. A local account relinked to LDAP keeps every grant it had, including the Viewer grant that default gave it at sign-up (People shows it as `Viewer · Site-wide · Direct` by default), so see step 3 of "Moving local users to LDAP" below.
- Groups are matched by their exact name (by default the full DN). Renaming a group or moving it to another OU in the directory changes that name, so its members lose the group's roles at their next sign-in or recheck. Update the group's external name in Users & Access when that happens; to find the new DN, open Groups > **Check a provider user**, enter a former member's username and leave the groups empty: with `LDAP_BIND_DN` set it lists the groups the directory reports for them now, and the server log line for a member leaving lists them too (with `LDAP_GROUP_SEARCH_BASE` set, the new DN must be under it, or it is refused); the Groups tab shows how many members each directory group has, so a group that suddenly has 0 stands out (creating a group, or changing its external name, rechecks linked accounts right away, so its count fills in within moments while the directory can be reached), and the server log names the groups each account leaves or joins at a sign-in or recheck. With `AUTH_RECHECK_MINUTES=0`, a new group fills only as its members sign in, or when you click **Check linked accounts** in People.
- Existing sessions and API tokens are rechecked against the directory every `AUTH_RECHECK_MINUTES` (default 15) with the service account. Group changes update roles, and someone deleted, no longer matched by `LDAP_USER_SEARCH_FILTER`, disabled or expired (Active Directory), or locked (OpenLDAP ppolicy's administrative lock, `pwdAccountLockedTime: 000001010000Z`; 389 DS / FreeIPA `nsAccountLock`) loses their sessions and tokens and their LDAP group roles, and People shows the account as `not found in ldap since …` until the entry comes back. While the directory can't be reached, access stays as it was. On OpenLDAP without ppolicy, changing a leaver's password doesn't end their sessions; delete the entry or lock it with ppolicy's administrative lock. A ppolicy lockout after failed passwords (a timestamp in `pwdAccountLockedTime`) doesn't end sessions or mark the account not found, even under `pwdLockoutDuration: 0`, so lock leavers with the administrative lock or delete their entry. Rechecks may take up to 5 × `LDAP_TIMEOUT_MS`. Without both `LDAP_BIND_DN` and `LDAP_USER_SEARCH_BASE` (for example only `LDAP_USER_DN_TEMPLATE`), MMGIS can't read the directory between logins (startup warns when only the search base is missing), so changes apply at the next login; remove the person's tokens in Users & Access when offboarding.

## Moving local users to LDAP

1. Keep a local SuperAdmin, leave `AUTH_LOCAL_LOGIN` unset, and use `AUTH_PROVIDERS=["local","ldap"]` during the move, so people who aren't moved yet still see their MMGIS sign-in first.
2. In Users & Access > People, open each account and click **Allow LDAP relink** (enter the directory username if it differs). Do this in batches you can tell people about: each relink lasts 24 hours.
3. Ask those people to sign in with LDAP within the day. Their roles, grants, API tokens and drawings stay; their MMGIS password stops working. That includes the direct Viewer grant "Default for new accounts" gave local sign-ups, which LDAP-created accounts don't get and directory groups can't take away; if mission access should come only from directory groups, remove that grant on each account as you relink it. Anyone who tries LDAP before their relink is told to ask an administrator and keep using their MMGIS account meanwhile, and the server log names the account to relink.
4. Accounts with no directory entry (external collaborators, test or shared accounts) can't be relinked: get them a directory entry, delete them, or leave `AUTH_LOCAL_LOGIN` unset so they keep signing in with their MMGIS password.
5. When searching People for `MMGIS account` shows no non-admin rows, you can switch to `["ldap","local"]` and set `AUTH_LOCAL_LOGIN=admins`. "Admin" here means any editing or admin role on any mission (Layer Editor, Mission Admin, Data Admin or SuperAdmin), even where People's Site role says "User". Those accounts keep their MMGIS password and aren't rechecked against the directory, so disabling them there when they leave removes nothing. Relink every one of them except a break-glass SuperAdmin.

## Rotating the service password or CA

MMGIS reads `LDAP_BIND_PASSWORD` at startup, so a change in the directory first takes LDAP sign-in down until MMGIS is updated and restarted. The `LDAP_TLS_CA` file is read again at every connection, so replacing its contents takes effect right away (and a broken file breaks sign-in right away; only the startup settings check validates it). After the directory rejects the service password, MMGIS waits 5 minutes before trying it again, so the directory doesn't lock the account; restart MMGIS to retry sooner.

- **CA certificate:** before the directory switches certificates, put both the old and the new CA in the `LDAP_TLS_CA` PEM file (it's read at every connection, so no restart is needed; restarting only reruns the startup settings check). After the switch, remove the old one.
- **Service password:** create a second service account (or, if the directory allows it, give the account a second password), set `LDAP_BIND_DN`/`LDAP_BIND_PASSWORD` to it and restart, then retire the old one. If the old password is changed first, LDAP sign-ins fail with "<name> is unavailable" until MMGIS has the new one; the startup settings check and the server log say the bind was rejected.

## Troubleshooting

At startup MMGIS checks the settings without anyone's password: it connects, signs in the service account and looks up `LDAP_USER_SEARCH_BASE` and `LDAP_GROUP_SEARCH_BASE`. The server log then says `LDAP settings check passed: ...` or `LDAP settings check failed: ...` with the setting to fix. Every refused login is logged too, with the reason, e.g. `no entry under LDAP_USER_SEARCH_BASE matches (uid=alice)`, `wrong password`, or, on Active Directory, `account disabled`, `account locked` or `account expired`. The person only sees "Invalid <name> username or password".

If the directory rejects the service account, MMGIS stops using it for 5 minutes instead of retrying at every login, so the directory doesn't lock the account. LDAP login answers "unavailable" meanwhile.

| Message | Cause |
|---|---|
| MMGIS refuses to start with an `LDAP_*` error | A required setting is missing or malformed; the message names it. |
| "<name> is unavailable" | MMGIS couldn't reach the directory, the TLS certificate didn't verify, the service account was rejected (MMGIS then waits 5 minutes before trying it again), or a search base doesn't exist. The server log has the reason and the setting to check. |
| "Your <name> entry can't be used with MMGIS" | The person's entry has no `LDAP_SUBJECT_ATTRIBUTE`. If everyone gets this, the setting doesn't suit the directory (e.g. `objectGUID` on OpenLDAP); the server log names the entry and attribute. |
| "MMGIS can't read all of your <name> groups" for one person | They're in more groups than the directory returns to the service account. MMGIS pages group results 500 at a time, but OpenLDAP still caps the total at the hard size limit: raise it for the service account (`olcLimits: dn.exact="<service DN>" size.prtotal=unlimited size.hard=unlimited`), or narrow `LDAP_GROUP_SEARCH_FILTER` to the groups MMGIS maps. Until then that person can't sign in, and existing sessions keep the groups they had. |
| "Invalid <name> username or password" and the log says "found a different entry" | With both `LDAP_USER_DN_TEMPLATE` and `LDAP_USER_SEARCH_BASE`, the search must find the entry the password was checked against (same DN, or for a `{{username}}@domain` template the same `userPrincipalName`). Make the template and `LDAP_USER_SEARCH_FILTER` use the same attribute, e.g. `(userPrincipalName={{username}}@corp.example.org)`. |
| "Invalid <name> username or password" for everyone | The server log says why each login was refused. Check `LDAP_USER_SEARCH_BASE`/`LDAP_USER_SEARCH_FILTER` (or `LDAP_USER_DN_TEMPLATE`) and that the service account may read people. |
| "Invalid <name> username or password" for `CORP\alice` or `alice@corp...` | Set `LDAP_USERNAME_DOMAIN=CORP`, and use a `LDAP_USER_SEARCH_FILTER` that also matches `userPrincipalName` (see the Active Directory example). |
| Groups don't apply | The group's external name must be the directory group's DN (or its `LDAP_GROUP_NAME_ATTRIBUTE` value). The login line in the server log lists the groups the directory reported; if it says `none`, check whether your directory has `memberOf`, or set `LDAP_GROUP_SEARCH_BASE`. |

To try it locally, `plugins/core/auth/Ldap/tests/openldap/start.sh` starts an OpenLDAP container with test users; `plugins/core/auth/Ldap/tests/ldap-provider.spec.js` shows the matching settings.
