---
layout: page
title: Site Access & Roles
permalink: /migration/auth-access
parent: Migration
has_children: false
nav_order: 1
---

# Site access, roles and tokens

This release replaces `AUTH` and the `users.permission` string with explicit site-access settings and named role bindings.

## 1. Replace `AUTH`

MMGIS no longer starts while `AUTH` is set, and it requires `SITE_ACCESS`. Replace `AUTH` in your `.env` (or container environment):

| Old | New |
| --- | --- |
| `AUTH=off` | `SITE_ACCESS=public` `AUTH_PROVIDERS=["local"]` |
| `AUTH=none` | `SITE_ACCESS=optional` `AUTH_PROVIDERS=["local"]` |
| `AUTH=local` | `SITE_ACCESS=required` `AUTH_PROVIDERS=["local"]` |
| `AUTH=csso` | `SITE_ACCESS=required` `AUTH_PROVIDERS=["csso","local"]` |

- `public`: anyone can view; end users don't log in. Admins still log in at `/configure`.
- `optional`: anyone can view; users may log in (e.g. to save Draw files).
- `required`: everything requires login.

`ldap`, `earthdata`, `keycloak` and `cognito` are reserved provider names and are not implemented yet.

### What to expect for each previous setup

Compared request by request against the previous release on the same upgraded database:

- **`AUTH=off` → `public`**: visitors browse every mission without logging in, as before. Admins still log in at `/configure`. Draw stays unavailable, as before, because public sites have no end-user accounts.
- **`AUTH=none` → `optional`**: guests browse as before, and logged-in users keep their mission access and Draw.
- **`AUTH=local` → `required`**: logins, mission lists and `missions_viewing` limits behave as before. API calls from someone who isn't logged in now get a JSON `403` instead of an empty result or the login page.
- **`AUTH=csso` → `required` + `["csso","local"]`**:
  - The proxy's `X-Sub`, `X-Groups` and `X-Session` headers are read as before.
  - `CSSO_GROUPS` still gates the map and `/configure`, and `CSSO_LEAD_GROUP` still maps to the lead group.
  - On upgrade, every CSSO user can view every mission, as before.
  - Admins still log in to `/configure` with their local MMGIS account. Set `AUTH_LOCAL_LOGIN=admins` so only accounts with an admin role can log in locally. This needs `local` in `AUTH_PROVIDERS`; with `["csso"]` alone, password logins are refused and the site has no way to sign in as an administrator.
  - Requests that reach MMGIS without the CSSO headers (i.e. not through the proxy) are now refused. Scripts that called MMGIS directly need a long-term token.
  - `CSSO_PROXY_SECRET` is optional. Leave it unset to keep the previous behavior. Set it only after your proxy adds a matching `X-MMGIS-Proxy-Secret` header to every request; otherwise every CSSO user is treated as logged out.

On every kind of site:

- Mission admins no longer see the Accounts page; see section 3.
- Any logged-in user can create read-only long-term tokens.
- Long-term tokens can't open the `/configure` page; they are for API calls.

## 2. Preview and import existing accounts

Run against a copy of your database first:

```bash
npm run auth:migrate -- --dry-run   # prints the role bindings it would create; writes nothing
npm run auth:migrate                # imports them (runs once per database)
```

The import never changes usernames or password hashes, so every existing account logs in exactly as before. It maps:

| Legacy | New role binding |
| --- | --- |
| `permission=111` | `superadmin` (global) |
| `permission=110` + `missions_managing` | `mission_admin` on each listed mission |
| `missions_viewing` list | `viewer` on each listed mission |
| `missions_viewing` unset | `viewer` (global) |

On a brand-new site with no accounts, creating the first account on `/configure` now asks for a one-time setup code printed in the server log (see `SETUP_CODE`). Existing sites already have accounts and are unaffected.

The server also runs the import once on first start if it hasn't run. It never runs again, so later grant changes are never undone; set `SITE_ACCESS` correctly before that first start (the server warns if it later differs from the value used at import). Unknown mission names are reported and skipped. Accounts whose legacy `permission` could not log in before (`000`, `010`, ...) get no viewer access.

The legacy columns are kept, so rolling back to the previous image still works. They are only ever lowered to match current grants (for example when a SuperAdmin is demoted or a viewer grant is removed), never raised, so a rollback never gives more access than the grants did. Accounts created on this release have `permission=000` and can't log in on the previous release.

If you roll back, change accounts on the previous release and then upgrade again, the server compares each account's legacy columns with the values it last saw. Access removed there is removed from the matching grants: a SuperAdmin set to `110` or `001` loses SuperAdmin (unless they are the last one), missions taken out of `missions_managing` or `missions_viewing` lose the Mission Admin or Viewer grant, a viewer limited from all missions to a list keeps only those missions, and an account set to `000`/`010` loses its viewer grants. Access added there is not granted, only reported. Accounts created there are imported like the first upgrade, and grants of accounts deleted there are removed. Each change is logged at startup as a warning. Only the account's own grants are changed: access through a group or the Everyone / Logged-in users audiences stays until you change it in Users & Access.

When rolling back, also clear the sessions table (`DELETE FROM session;`) so everyone signs in again. Sessions started before the upgrade still carry the old `permission` value, and the previous release trusts it.

## 3. What changes for each kind of account

- **SuperAdmins**: unchanged. More than one SuperAdmin is supported, and the last one can't be removed or demoted.
- **Mission admins**: can edit the configuration and layers of their missions only. Creating, cloning, renaming or deleting missions, STAC, geodatasets, datasets, accounts, webhooks and site options are now SuperAdmin (or `data_admin` for data) operations.
- **Layer editors (new)**: edit one layer folder and everything inside it, and nothing else in the mission.
  - They make their changes through the per-layer API routes, signed in or with a long-term token: `/api/configure/updateLayer` changes a layer in place, and `/api/configure/removeLayer` removes one. Adding layers with `/api/configure/addLayer` needs mission configuration access.
  - Configure's **Save Changes** button saves the whole configuration through `/api/configure/upsert`, which needs mission configuration access (Mission Admin or SuperAdmin). A layer editor can open the mission in Configure, but Save Changes is refused, so their edits have to be made through the API.
  - Moving a layer to another place in the tree, or changing its UUID, also needs mission configuration access.
- **Viewers**: see only the missions they're granted. `Missions/shared` stays readable by any signed-in user, and by guests who can view at least one mission.

Roles are granted to users, to groups, or to the `authenticated` / `everyone` audiences (`everyone` includes guests). SuperAdmin can only be granted to individual users, and audiences only get Viewer. Grants are made in **Configure → Users & Access**, which also shows each user's effective access and where it comes from.

## 4. Long-term tokens

- Tokens and signed-in sessions of local accounts follow the current login rules on every request. They stop working when `local` is removed from `AUTH_PROVIDERS`, or, with `AUTH_LOCAL_LOGIN=admins`, when the account has no admin role.
  - Under `AUTH_LOCAL_LOGIN=admins`, an account counts as an admin if it holds any editing or managing role: SuperAdmin, Data Admin, Mission Admin, or Layer Editor (even on a single layer folder). Viewer-only accounts are not admins.
  - The check is on the account that created the token, not on the token's scopes. An admin's read-only or single-mission token keeps working; a viewer-only account's tokens stop working.
  - A token can't make an account an admin: its scopes and mission limits only narrow what the account already has. Tokens can't be limited to one layer; that limit comes from the account's Layer Editor grant.
- A password reset revokes all of the account's tokens.
- New tokens are shown once and stored hashed. Existing tokens keep working and are converted to hashed storage on first use.
- Tokens can be read-only or carry the creator's access, optionally limited to some missions, and can expire or be revoked.
- A token never exceeds what its creator can currently do: demoting or deleting the creator narrows or removes it immediately.
- Any signed-in user can create read-only tokens.

## 5. Adjacent servers

TiTiler, TiPG, STAC, titiler-pgstac and Veloserver must only be reachable through MMGIS' proxy routes. Don't publish their ports. See [Adjacent Servers](/MMGIS/setup/adjacent-servers).
