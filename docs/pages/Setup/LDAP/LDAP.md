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
- [Relinking an account](#relinking-an-account)
- [Moving to a new directory or changing LDAP_SUBJECT_ATTRIBUTE](#moving-to-a-new-directory-or-changing-ldap_subject_attribute)
- [Rotating the service password or CA](#rotating-the-service-password-or-ca)
- [Troubleshooting](#troubleshooting)

## What to ask your directory admins for

- The server address, and whether it uses LDAPS (port 636) or StartTLS (port 389).
- The CA certificate that signed the server's certificate, if it isn't from a public CA.
- Either a read-only service account for MMGIS, or the format of people's DNs (or Active Directory `user@domain` names) so MMGIS can sign in as them directly.
- Where people and groups live (search bases), which attribute is the login name and which is a permanent id.
- Firewall access from the MMGIS server to the directory's port.

## Configuration

All settings are ENVs; see [ENVs](/MMGIS/setup/envs) for each `LDAP_*` variable. Keep `local` in `AUTH_PROVIDERS` so local admin accounts can still sign in to `/configure`. The examples list `ldap` first, for sites whose people are already in the directory; while existing local users are still moving to LDAP, list `local` first instead (see [Moving local users to LDAP](#moving-local-users-to-ldap)).

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

On Active Directory, `memberOf` only lists groups the person is directly in. To include nested groups, search with the in-chain rule: `LDAP_GROUP_SEARCH_BASE=DC=corp,...` and `LDAP_GROUP_SEARCH_FILTER=(&(objectClass=group)(member:1.2.840.113556.1.4.1941:={{dn}}))`. A person's primary group (usually `Domain Users`) appears in neither, so map a regular group instead. OpenLDAP has no such rule: only groups that list the person themselves count, so a person in a group that is itself a member of a mapped group doesn't get that group's roles. Map each group they're directly in.

Groups are reported by their full DN in lowercase, e.g. `cn=science-team,ou=groups,dc=example,dc=org`, so two groups called `admins` in different OUs can't be confused and someone who can create groups in their own OU can't take another group's role. In Configure > Users & Access > Groups, create a group with **Members from LDAP** and the group's DN as its external name, then give the group a role. DNs you enter are saved in that same lowercase form, so `CN=Science-Team,OU=Groups,DC=example,DC=org` copied from an AD tool works too. Escaped characters may be typed either way (`\,` or `\2c`). A plain name such as `science-team` is refused, since it could never match a DN. External names can be at most 255 characters. Other names (with `LDAP_GROUP_NAME_ATTRIBUTE`) must match exactly, including case. Users & Access > Groups > **Check a provider user** takes one group per line, DNs included. To see what the directory reports, open Groups > **Check a provider user** and leave the groups empty (needs `LDAP_BIND_DN`): it lists every group the directory reports for that person now. The server log also lists them at each login (`Directory groups: …`). Membership is updated at every login and every `AUTH_RECHECK_MINUTES`. To use plain names instead, set `LDAP_GROUP_SEARCH_BASE` to the one OU that holds your MMGIS groups and `LDAP_GROUP_NAME_ATTRIBUTE=cn`. The search includes that OU's sub-OUs, so don't use it if anyone else can create groups below it. Turning `LDAP_GROUP_NAME_ATTRIBUTE` on or off changes the form every group is reported in, so update each LDAP group's external name at the same time, and change the setting on every MMGIS process together; until then those groups have no members, and the server log warns about them at startup and at each sign-in.

## Accounts

- The first LDAP login creates an MMGIS account, linked by `LDAP_SUBJECT_ATTRIBUTE` (`entryUUID`, or `objectGUID` on Active Directory), so renames and moves in the directory keep the same account. MMGIS stores subjects and usernames in up to 255 characters, so with `LDAP_SUBJECT_ATTRIBUTE=dn` someone whose DN is longer is refused (see the server log); keep the default `entryUUID` / `objectGUID` for deep OU trees. With `dn`, whoever can create an entry at a leaver's old DN also signs in as that leaver's account, so prefer `entryUUID` / `objectGUID` wherever directory admins with limited rights can create entries.
- A directory username that already belongs to an MMGIS account (for example a local account) is refused. The user only sees "This sign-in can't be used with MMGIS yet. Ask an administrator.", so the page never reveals that the username is taken; the server log records a warning with the provider, subject and reason. MMGIS never takes over an existing account unless an administrator allows a relink (see below).
- The usernames `group` and `guest` are reserved (the Draw tool owns shared and master files under `group`, and MMGIS calls signed-out visitors `guest`), so a directory entry with either username can't sign in.
- While `ldap` is enabled, LDAP accounts have no MMGIS password, so Users & Access can't generate a password reset link for them.
- With `AUTH_PROVIDERS=["ldap"]`, local accounts, including a SuperAdmin created at setup, can't sign in anywhere. To keep a local admin, use `["ldap","local"]` with `AUTH_LOCAL_LOGIN=admins`: the local option then only appears on Configure sign-in. Set `AUTH_LOCAL_LOGIN=admins` only after every non-admin local account has moved to LDAP (People shows no non-admin "MMGIS account" rows): until then those people can't sign in with either form. To drop local entirely, first sign in once with LDAP (with `AUTH_PROVIDER_NEW_ACCOUNTS=false`, create a local account under your directory username, allow its relink and sign in with LDAP to claim it; grant SuperAdmin only after the claim, so its throwaway password never holds SuperAdmin), then, while local is still enabled, grant that LDAP account SuperAdmin (or an LDAP group an admin role) in Users & Access. Before moving to another directory or changing `LDAP_SUBJECT_ATTRIBUTE`, enable local again and keep a local SuperAdmin and its password: the change signs out every LDAP account and stops its API tokens until it's relinked, SuperAdmins included, and only a SuperAdmin can allow relinks. Startup logs how many linked accounts a changed `LDAP_SUBJECT_ATTRIBUTE` affects.
- Removing `ldap` from `AUTH_PROVIDERS` stops LDAP sessions from working (those used meanwhile end; the others resume, rechecked, once `ldap` is back); the accounts, groups and grants are kept, but LDAP groups grant nothing until `ldap` is back. Visitor sign-up stays closed meanwhile (unless `AUTH_LOCAL_ALLOW_SIGNUP=true`), so nobody can take a directory username while `ldap` is out; on a site leaving LDAP for good it stays closed until the last LDAP-linked account is deleted. Those accounts (including local accounts that were relinked to LDAP) then count as MMGIS accounts: they can get back in through a password reset link from Users & Access, as long as `local` is enabled. As with any reset, using it revokes the account's existing API tokens for good, so those people need new ones. Their API tokens, and new ones, stay off until `ldap` is back, so a leaver's tokens don't come back with it; creating a token is refused for them meanwhile, and Check linked accounts skips them. Once `ldap` is back, their MMGIS passwords stop working again, and sessions and tokens opened meanwhile are rechecked against the directory like LDAP ones. Give every MMGIS process sharing a database the same `AUTH_PROVIDERS`, `AUTH_LOCAL_LOGIN` and `SITE_ACCESS`, and upgrade and restart them together (an older MMGIS process on the same database skips these protections: it lets visitors sign up, accepts look-alike usernames and saves group DNs in a form that matches nobody): a process that refuses a session ends it for every process, so one without `ldap` ends the LDAP sessions it sees, and one with `AUTH_LOCAL_LOGIN=admins` ends non-admin local sessions. Failed sign-in counts and the 5-minute pause after the directory rejects the service account are kept in each process, so with several processes keep `AUTH_MAX_FAILED_LOGINS` times the number of processes below the directory's lockout threshold.
- Deleting an account keeps its drawings but takes them away from the username, and off other people's shared-editor lists, so someone later given the same username (a reused directory name) can't open or edit them.
- Configure > Users & Access > People shows how each account signs in (`ldap`, or `MMGIS account` for a local password) and its last LDAP login. Someone renamed in the directory keeps the same MMGIS account and MMGIS username, because drawings and other content are kept under the username. The new directory name is shown as `ldap (as newname)`, and the server log notes the rename. A pending relink shows as `(relink to ldap pending)`, or `stale` when something may stop it taking effect (the person's panel says what, and whether it still works). The People search also matches this column, so searching `not found`, `relink`, `stale` or `MMGIS account` lists the accounts that still need attention, and **Not found / needs relink** lists the linked accounts that can't sign in: people who left, and those who need a relink. The Allow relink dialog names the entry it found, and confirming refuses if a different entry has that username by then.
- If the directory gives someone a new permanent ID (the directory was rebuilt or migrated, their entry was recreated, or `LDAP_SUBJECT_ATTRIBUTE` changed), their sign-in is refused, because their username already belongs to an MMGIS account. Reconnect them with **Allow LDAP relink**: see [Relinking an account](#relinking-an-account) and [Moving to a new directory or changing LDAP_SUBJECT_ATTRIBUTE](#moving-to-a-new-directory-or-changing-ldap_subject_attribute).
- Allow the relink before the person signs in with LDAP. If their directory username differs from their MMGIS username and they sign in first, MMGIS can't tell they're the same person and creates a new, empty account; Allow LDAP relink then names that account. Delete it, entering the original account's username under "Give their drawings to" so anything they saved meanwhile moves with them, then allow the relink again.
- A 409 for an account that People shows as `ldap (as othername)`, or as `not found since …` (its entry was deleted or disabled), may come from a different person who now has that account's old directory username. Check before relinking: a relink would hand the account and its drawings to the newcomer.
- A person's first LDAP sign-in creates their MMGIS account with only what their directory groups and the "Logged-in users" audience (Users & Access > Site-wide) give. "Default for new accounts" applies to local accounts only, so a directory sign-in never opens missions by itself; to let every directory user view some missions, grant them to "Logged-in users" or to a directory group. A local account relinked to LDAP keeps every grant it had, including the Viewer grant that default gave it at sign-up (People shows it as `Viewer · Site-wide · Direct` by default), so see step 3 of "Moving local users to LDAP" below.
- Groups are matched by their exact name (by default the full DN). Renaming a group or moving it to another OU in the directory changes that name, so its members lose the group's roles at their next sign-in or recheck. Update the group's external name in Users & Access when that happens; to find the new DN, open Groups > **Check a provider user**, enter a former member's username and leave the groups empty: with `LDAP_BIND_DN` set it lists the groups the directory reports for them now, and the server log line for a member leaving lists them too (with `LDAP_GROUP_SEARCH_BASE` set, the new DN must be under it, or it is refused); the Groups tab shows how many members each directory group has, so a group that suddenly has 0 stands out (creating a group, or changing its external name, rechecks linked accounts right away, so its count fills in within moments while the directory can be reached), and the server log names the groups each account leaves or joins at a sign-in or recheck. With `AUTH_RECHECK_MINUTES=0`, a new group fills only as its members sign in, or when you click **Check linked accounts** in People.
- Existing sessions and API tokens are rechecked against the directory every `AUTH_RECHECK_MINUTES` (default 15) with the service account. Group changes update roles, and someone deleted, no longer matched by `LDAP_USER_SEARCH_FILTER`, disabled or expired (Active Directory), or locked (OpenLDAP ppolicy's administrative lock, `pwdAccountLockedTime: 000001010000Z`; 389 DS / FreeIPA `nsAccountLock`) loses their sessions and tokens and their LDAP group roles, and People shows the account as `not found since …` until the entry comes back. People shows what each account's last recheck found, and a recheck runs when the session or token is used: a leaver who never comes back stays shown as linked until you click **Check linked accounts**, so click it before an offboarding audit or before reading the **Not found / needs relink** count. While the directory can't be reached, access stays as it was: linked accounts keep theirs, and accounts already `not found` stay refused. Changing a leaver's password doesn't end their sessions. Delete the entry, or move it out of `LDAP_USER_SEARCH_BASE` (or out of what `LDAP_USER_SEARCH_FILTER` matches); on OpenLDAP with the ppolicy overlay loaded, its administrative lock works too (without the overlay, `pwdAccountLockedTime` is an undefined attribute). A ppolicy lockout after failed passwords (a timestamp in `pwdAccountLockedTime`) doesn't end sessions or mark the account not found, even under `pwdLockoutDuration: 0`, so lock leavers with the administrative lock or delete their entry. Rechecks may take up to 5 × `LDAP_TIMEOUT_MS`. While the directory hangs, a request waits up to 5 seconds for its recheck, then goes ahead with the access it had; once a recheck has found the directory unreachable (a timeout or connection error, not an error about one person's entry), other requests wait at most 1 second until a recheck gets an answer again. Without both `LDAP_BIND_DN` and `LDAP_USER_SEARCH_BASE` (for example only `LDAP_USER_DN_TEMPLATE`), MMGIS can't read the directory between logins (startup warns when only the search base is missing), so changes apply at the next login; remove the person's tokens in Users & Access when offboarding.

## Moving local users to LDAP

1. Keep a local SuperAdmin, leave `AUTH_LOCAL_LOGIN` unset, and use `AUTH_PROVIDERS=["local","ldap"]` during the move, so people who aren't moved yet still see their MMGIS sign-in first. Also set `AUTH_PROVIDER_NEW_ACCOUNTS=false`, so anyone who signs in with LDAP before their relink is refused instead of getting a new, empty account (people new to MMGIS then need an account created and its relink allowed).
2. In Users & Access > People, open each account and click **Allow LDAP relink** (enter the directory username if it differs). Do this in batches you can tell people about: each relink lasts 24 hours. Without `AUTH_PROVIDER_NEW_ACCOUNTS=false`, someone whose directory username differs who signs in with LDAP first gets a new, empty account, which you then have to delete (giving its drawings to their account) before the relink.
3. Ask those people to sign in with LDAP within the day. Their roles, grants, API tokens and drawings stay; their MMGIS password stops working. That includes the direct Viewer grant "Default for new accounts" gave local sign-ups, which LDAP-created accounts don't get and directory groups can't take away; if mission access should come only from directory groups, remove that grant on each account as you relink it. Anyone who tries LDAP before their relink is told to ask an administrator, so tell them in your announcement to keep using their MMGIS password until then; the server log names the account to relink.
4. Accounts with no directory entry (external collaborators, test or shared accounts) can't be relinked: get them a directory entry, delete them, or leave `AUTH_LOCAL_LOGIN` unset so they keep signing in with their MMGIS password.
5. When searching People for `MMGIS account` shows no non-admin rows, you can switch to `["ldap","local"]` and set `AUTH_LOCAL_LOGIN=admins`. Remove `AUTH_PROVIDER_NEW_ACCOUNTS=false` then, so people new to MMGIS get an account at their first LDAP sign-in. "Admin" here means any editing or admin role on any mission (Layer Editor, Mission Admin, Data Admin or SuperAdmin), even where People's Site role says "User". Those accounts keep their MMGIS password and aren't rechecked against the directory, so disabling them there when they leave removes nothing. Relink every one of them except a break-glass SuperAdmin.
6. Rolling back to an MMGIS version without LDAP after this leaves moved people unable to sign in there: a relink retires the account's MMGIS password, and accounts LDAP created never had one. Keep the local SuperAdmin from step 1 so you can still reach Configure, and set new passwords in Users & Access for anyone who needs to sign in on the old version. Moved accounts' API tokens don't work there either: their owners need to create new ones.

## Relinking an account

Open the account in Users & Access > People, enter the person's directory username if it differs from the MMGIS username, and click **Allow LDAP relink**.

- With `LDAP_BIND_DN` set, MMGIS looks the username up before you confirm and shows which entry (DN) it found; check it's the person you expect. Only that entry can claim the account, even if it is renamed before it signs in. With an `LDAP_SUBJECT_ATTRIBUTE` that isn't a permanent ID, such as `cn`, it must also still have that DN, and an entry whose value another entry shares can't sign in at all. Under such a setting a newcomer given a leaver's value signs in to the leaver's account, and a value whose letter case or spacing changed is refused, and that person's sessions and API tokens end at the next recheck, until you allow a relink for each such account (MMGIS can't tell that from a newcomer, since the directory compares it without case). If it really is a newcomer, don't relink: give them a different value in the directory, or delete the leaver's account (giving its drawings to whoever should keep them). With several values (e.g. `mail` and an alias), any of them keeps the link, so reordering them changes nothing. If the entry is renamed at the same time, or another person's entry holds a leaver's value as an alias, the sign-in is refused and the old account's access ends at the next recheck, until you allow a relink or remove the value.
- For 24 hours, that person's next LDAP sign-in takes over the account once and keeps its roles, grants, API tokens and drawings. Everyone signed in to the account is signed out, and its MMGIS password stops working, so the same button moves a local account to LDAP. A local account's API tokens keep working until then; a linked account shown as `not found` has its tokens off until the person signs in. Revoke them as well if someone other than this person used the account.
- Only a SuperAdmin can allow relinks. The last SuperAdmin who signs in with an MMGIS password can't be relinked, counting other SuperAdmins with a pending relink as already moved (keep one for when the directory is down). Making an account a SuperAdmin while its relink is pending cancels the relink at the next claim attempt (that sign-in is refused); allow it again if it should go ahead. The server log records who allowed each relink and when it was used.
- Only wrong passwords count toward the sign-in lockout, so sign-ins refused while waiting for a relink don't lock anyone out. Allowing a relink also clears that person's failed sign-ins. A relink not used within 24 hours expires: the server log says so at that person's next refused sign-in, and you can allow it again.
- If the directory hands a renamed person's old username to someone new, don't relink. MMGIS looks for the old entry anywhere under the directory root (the `dc=` part of `LDAP_USER_SEARCH_BASE`, or the directory's naming context holding it, e.g. `o=corp`), so a leaver moved to a disabled OU still counts: the relink is refused, and the server log says the old entry still exists. The service account needs read access there; the startup settings check warns if it hasn't, and relinks to a different entry are then refused. With `LDAP_SUBJECT_ATTRIBUTE=dn`, where a move changes the subject, a moved leaver isn't found, so check yourself. MMGIS usernames never change (drawings are stored under them), so the newcomer can't have that one: create a local account for them under another username (e.g. `erin2`) and allow its relink with the directory username `erin`. Their next sign-in takes it over.

## Moving to a new directory or changing LDAP_SUBJECT_ATTRIBUTE

From the switch until each person's relink is allowed and used, nobody already on LDAP can sign in: their MMGIS passwords no longer work, so listing `local` first doesn't help them. Each relink takes about five actions (click **Not found / needs relink** in People to list them, then open the account, click **Allow LDAP relink**, check the DN, confirm and close it), so plan a window (roughly half an hour for 60 people, plus opening each account again if you remove the default Viewer grant, as in step 3 of "Moving local users to LDAP") and tell people beforehand. People who were allowed a relink stay in that list as `pending` until they sign in, so it is also the list of who to chase. While the directory is down, each signed-in person's first request waits up to `LDAP_TIMEOUT_MS`, and LDAP sign-ins show "Signing in…" for about as long before saying the directory is unavailable. If the new directory was built from scratch, restore its group memberships before relinking, or people's directory-group roles don't come back at their sign-in.

1. Click **Check linked accounts** in People before the switch, so people who already left are marked `not found` with an earlier date than everyone the switch affects. Keep a local SuperAdmin, and list `local` first in `AUTH_PROVIDERS`, so people who never moved to LDAP still see their MMGIS sign-in. Set `AUTH_PROVIDER_NEW_ACCOUNTS=false` until the relinks are done: otherwise anyone whose directory username changed who signs in before their relink gets a new, empty account, which you then have to delete (giving its drawings to their account). Newcomers can't sign in meanwhile.
2. Make the switch. Change `LDAP_SUBJECT_ATTRIBUTE` on every MMGIS process sharing the database at once: stop them all, change it, then start them.
3. Click **Check linked accounts** in People. It asks the directory about every linked account at once, so the affected ones are marked without waiting for each person to sign in. If it says some accounts couldn't be checked, the directory settings (URL, CA or service account) are wrong or the directory is down; fix that and check again.
4. Allow relinks, only now: a relink pinned to an entry in the old directory can't be claimed from the new one. Start with admins, then API token owners (ask them to sign in right away, since their tokens stay off until they do), then everyone else.
5. Click **Check linked accounts** again. It flags relinks allowed before the directory changed; People says so on the account (and the server log names it). Cancel those and allow them again.
6. Once every relink is used, remove `AUTH_PROVIDER_NEW_ACCOUNTS=false` and restart.

If:

- **You changed `LDAP_SUBJECT_ATTRIBUTE`:** People marks those accounts `linked under an old subject setting` rather than `not found`, and their relink confirmation shows the leaver warning only if the entry was already missing before the change. If their subject value is the same under both settings (e.g. `uid` to `cn`), the relink pins the same entry again.
- **You moved to a new directory:** every account shows `not found`, so the leaver warning appears on every relink. Its date tells them apart: accounts not found since before the switch (step 1) had already left, and their usernames may now be someone else's. Check each one against your list of who is moving.
- **Processes ran with two settings at once:** each logs an error, and neither clears the accounts or relinks the other flags for its setting; rechecks still end access for people who left the directory. After a coordinated change this lasts until the old setting has gone unused for 3 minutes.

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
| "Your <name> entry can't be used with MMGIS", and the log says the entry "shares its" subject value | Another entry under `LDAP_USER_SEARCH_BASE` has the same `LDAP_SUBJECT_ATTRIBUTE` value, so MMGIS can't tell them apart; at rechecks its sessions and API tokens end, and the account shows as not found (the server log says it no longer has the account). Remove the duplicate value, or use a permanent ID such as `entryUUID`. |
| 409 "can't be used with MMGIS yet", and the log says the relink "is pinned to" one DN but the person "signs in from" another | With an `LDAP_SUBJECT_ATTRIBUTE` that isn't a permanent ID, the relink waits for the entry the admin was shown. If this is the same person after a rename, cancel the relink and allow it again; otherwise leave it, since it still works for the pinned entry until it expires. |
| "MMGIS can't read all of your <name> groups" for one person | They're in more groups than the directory returns to the service account. MMGIS pages group results 500 at a time, but OpenLDAP still caps the total at the hard size limit: raise it for the service account (`olcLimits: dn.exact="<service DN>" size.prtotal=unlimited size.hard=unlimited`), or narrow `LDAP_GROUP_SEARCH_FILTER` to the groups MMGIS maps. Until then that person can't sign in, and at their next recheck their existing sessions and API tokens lose the roles their LDAP groups gave (the log says MMGIS "couldn't read the groups of" them); roles granted to them directly stay. |
| "Invalid <name> username or password" and the log says "found a different entry" | With both `LDAP_USER_DN_TEMPLATE` and `LDAP_USER_SEARCH_BASE`, the search must find the entry the password was checked against (same DN, or for a `{{username}}@domain` template the same `userPrincipalName`). Make the template and `LDAP_USER_SEARCH_FILTER` use the same attribute, e.g. `(userPrincipalName={{username}}@corp.example.org)`. |
| "Invalid <name> username or password" and the log says "is, or shares its name with, LDAP_BIND_DN, the service account" | Someone tried to sign in as the service account. It is refused without its password being tried, so wrong passwords sent there can't lock it. This holds whether `LDAP_BIND_DN` and `LDAP_USER_DN_TEMPLATE` give its DN, its UPN or `DOMAIN\name`; MMGIS reads its other names from the directory once the service account has signed in. An `LDAP_BIND_DN` that isn't an entry, such as OpenLDAP's rootDN `cn=admin,dc=…`, has no other names, so only that DN is refused. Narrow `LDAP_USER_SEARCH_FILTER` (e.g. `(objectCategory=person)` plus a group) if service accounts shouldn't be found at all. |
| "Invalid <name> username or password" for everyone | The server log says why each login was refused. Check `LDAP_USER_SEARCH_BASE`/`LDAP_USER_SEARCH_FILTER` (or `LDAP_USER_DN_TEMPLATE`) and that the service account may read people. |
| "Invalid <name> username or password" for `CORP\alice` or `alice@corp...` | Set `LDAP_USERNAME_DOMAIN=CORP`, and use a `LDAP_USER_SEARCH_FILTER` that also matches `userPrincipalName` (see the Active Directory example). |
| Groups don't apply | The group's external name must be the directory group's DN (or its `LDAP_GROUP_NAME_ATTRIBUTE` value). The login line in the server log lists the groups the directory reported; if it says `none`, check whether your directory has `memberOf`, or set `LDAP_GROUP_SEARCH_BASE`. |

To try it locally, `plugins/core/auth/Ldap/tests/openldap/start.sh` starts an OpenLDAP container with test users; `plugins/core/auth/Ldap/tests/ldap-provider.spec.js` shows the matching settings.
