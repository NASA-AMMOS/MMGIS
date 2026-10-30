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
| `AUTH=csso` | `SITE_ACCESS=required` `AUTH_PROVIDERS=["proxy","local"]` `PROXY_TRUST=network` (or `PROXY_SECRET`) |

- `public`: anyone can view; end users don't log in. Admins still log in at `/configure`.
- `optional`: anyone can view; users may log in (e.g. to save Draw files).
- `required`: everything requires login.

Other providers (LDAP, OIDC, and so on) can be added as plugins; see [Writing an Auth Provider](/MMGIS/contributing/auth-providers).

### What to expect for each previous setup

Compared request by request against the previous release on the same upgraded database:

- **`AUTH=off` → `public`**: visitors browse every mission without logging in, as before. Admins still log in at `/configure`. Draw stays unavailable, as before, because public sites have no end-user accounts.
- **`AUTH=none` → `optional`**: guests browse as before, and logged-in users keep their mission access and Draw.
- **`AUTH=local` → `required`**: logins, mission lists and `missions_viewing` limits behave as before. API calls from someone who isn't logged in now get a JSON `403` instead of an empty result or the login page.
- **`AUTH=csso` → `required` + `["proxy","local"]`**: the `csso` provider is now called `proxy`, and its ENVs were renamed (`CSSO_GROUPS` → `PROXY_GROUPS`, `CSSO_LEAD_GROUP` → `PROXY_LEAD_GROUP`, `CSSO_PROXY_SECRET` → `PROXY_SECRET`). MMGIS refuses to start while an old name is set.
  - The proxy's `X-Sub`, `X-Groups` and `X-Session` headers are read as before (the names can now be changed with `PROXY_USER_HEADER`, `PROXY_GROUPS_HEADER` and `PROXY_SESSION_HEADER`).
  - The proxy must now prove the headers came from it. By default (`PROXY_TRUST=secret`) it sends `PROXY_SECRET` in an `X-MMGIS-Proxy-Secret` header, and MMGIS refuses to start without `PROXY_SECRET`. `PROXY_TRUST=network` trusts the headers on every request, as `AUTH=csso` did; `PROXY_TRUST=ips` trusts requests from `PROXY_TRUSTED_IPS`.
  - `PROXY_GROUPS` still gates the map and `/configure`, and `PROXY_LEAD_GROUP` still maps to the lead group.
  - On upgrade, every proxy user can view every mission, as before.
  - Draw files belong to a plain username, as before. A proxy user and a local account with the same username share the same Draw files. Give local accounts names that don't match anyone's proxy username unless they are the same person.
  - Admins still log in to `/configure` with their local MMGIS account. Set `AUTH_LOCAL_LOGIN=admins` so only accounts with an admin role can log in locally. This needs `local` in `AUTH_PROVIDERS`; with `["proxy"]` alone, password logins are refused and the site has no way to sign in as an administrator.
  - Requests that reach MMGIS without the proxy headers (i.e. not through the proxy) are now refused. Scripts that called MMGIS directly need a long-term token.

On every kind of site:

- Mission admins no longer see the Users & Access page; see section 3.
- Any logged-in local account can create long-term tokens through the API (`POST /api/longtermtoken/generate`). A token is read-only unless the account has an editing role or asks for a capability it already holds, such as `draw.use`. Only admins who can open Configure get the API Tokens page; there's no token UI for other users. Proxy users can't create tokens.
- Long-term tokens can't open the `/configure` page; they are for API calls.

### Upgrading an `AUTH=csso` site with env changes only

No code or proxy changes are needed.

1. In `.env` (or the container environment), replace `AUTH` and rename the CSSO settings:

   ```bash
   # remove
   AUTH=csso
   CSSO_GROUPS=[...]
   CSSO_LEAD_GROUP=...
   CSSO_PROXY_SECRET=...        # if you had set it
   # add
   SITE_ACCESS=required
   AUTH_PROVIDERS=["proxy","local"]
   PROXY_GROUPS=[...]           # the old CSSO_GROUPS value
   PROXY_LEAD_GROUP=...         # the old CSSO_LEAD_GROUP value
   PROXY_TRUST=network          # trust the headers on every request, as AUTH=csso did
   # optional
   AUTH_LOCAL_LOGIN=admins      # only accounts with an admin role may log in with a password
   ```

   Instead of `PROXY_TRUST=network`, prefer `PROXY_SECRET=...` (the default `PROXY_TRUST=secret`) once the proxy adds that value in an `X-MMGIS-Proxy-Secret` header to every request, or `PROXY_TRUST=ips` with `PROXY_TRUSTED_IPS` set to the proxy's addresses. The header names, `/ssostatus` and `/ssologoutredirect` keep their CSSO defaults.

   MMGIS refuses to start while `AUTH` or an old `CSSO_*` name is still set, or while `PROXY_TRUST=secret` has no `PROXY_SECRET`, and the error names the fix.

2. Start MMGIS. The first start imports the existing accounts once (see section 2; a `--dry-run` beforehand is optional):
   - `permission=111` accounts become SuperAdmin.
   - `permission=110` accounts become Mission Admin on the missions in their `missions_managing` list. A `110` account with no listed (or no existing) missions gets no role and can't manage anything in Configure until a SuperAdmin grants one.
   - The Logged-in users audience gets Viewer site-wide, so every proxy user still sees every mission.

3. Check:
   - a proxy user sees the same missions and Draw files as before;
   - a user outside `PROXY_GROUPS` gets the "not allowed" page on the map and `/configure` (an HTTP 200 page, as before; the JSON API is not gated by `PROXY_GROUPS`, before or after);
   - an admin logs in to `/configure` with their local account.

4. To roll back, restore the database backup you took before upgrading (section 2), then the previous image and env. Changes made on this release are lost.

What proxy users and admins will notice:

- **Unchanged:** the `X-Sub`, `X-Groups` and `X-Session` headers, group gating of the map and `/configure` (now `PROXY_GROUPS`), the lead group (now `PROXY_LEAD_GROUP`), every mission visible, Draw files owned by username, Sign out through `/ssologoutredirect`, and local admin logins at `/configure`.
- **Each request must come through the proxy.** The previous release copied `X-Sub` into the MMGIS session, so a later request without the headers still counted as that user. Now identity is read from the headers on every request; anything that reaches MMGIS directly (scripts, health checks behind the proxy) is treated as logged out and needs a long-term token.
- **`X-Groups` is no longer required to identify the user**; `X-Sub` is enough. `PROXY_GROUPS` still decides who gets in. An `X-Groups` value that can't be decoded no longer causes a 500 error; the request is treated as not signed in.
- **API calls without a login** get a JSON `403`.
- **Configure:** Mission Admins no longer see the Users & Access page. Long-term tokens are scoped and can't open `/configure`. Proxy users can't create tokens.
- **Local logins:** with the default `AUTH_LOCAL_LOGIN=all`, any local account can still log in with a password, as before.
- **Startup log:** a warning while `PROXY_TRUST=network`; nothing else changes.
- **New, optional:** proxy groups can be given roles in **Configure → Users & Access** (for example Mission Admin for an LDAP group), so proxy users can manage missions without a local account, and missions can be limited per group.

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
| `missions_viewing` list | `viewer` on each listed mission (only with `SITE_ACCESS=required` and no `proxy`, the only sites where viewing lists applied) |
| `missions_viewing` unset | `viewer` (global), same condition |
| `SITE_ACCESS=public` or `optional` | `everyone` audience: `viewer` (global) |
| `SITE_ACCESS=required` with `proxy` | `authenticated` audience: `viewer` (global) |

The audience grant keeps every mission visible as before. A brand-new site gets it too, so on `public` and `optional` sites guests can see every mission until you remove or narrow it in **Configure → Users & Access**.

On a brand-new site with no accounts, creating the first account on `/configure` now asks for a one-time setup code printed in the server log (see `SETUP_CODE`). Existing sites already have accounts and are unaffected.

The server also runs the import once on first start if it hasn't run. It never runs again, so later grant changes are never undone; set `SITE_ACCESS` correctly before that first start (the server warns if it later differs from the value used at import). Unknown mission names are reported and skipped. Accounts whose legacy `permission` could not log in before (`000`, `010`, ...) get no viewer access.

**Back up the database before upgrading.** After the import, access lives only in the role bindings. The legacy `permission`, `missions_managing` and `missions_viewing` columns stay in the `users` table as they were at the import, but this release never reads or updates them. Downgrading on the same database is therefore not supported: the previous release would read those stale columns, so someone demoted or removed from a mission here would get that access back. To downgrade, restore the backup taken before upgrading and start the previous image.

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
- Any logged-in local account can create tokens. A token is read-only by default and never carries more than the account can do itself.

## 5. Adjacent servers

TiTiler, TiPG, STAC, titiler-pgstac and Veloserver must only be reachable through MMGIS' proxy routes. Don't publish their ports. See [Adjacent Servers](/MMGIS/setup/adjacent-servers).
