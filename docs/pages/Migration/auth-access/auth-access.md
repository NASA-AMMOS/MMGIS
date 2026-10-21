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
| `AUTH=csso` | `SITE_ACCESS=required` `AUTH_PROVIDERS=["csso"]` |

- `public`: anyone can view; end users don't log in. Admins still log in at `/configure`.
- `optional`: anyone can view; users may log in (e.g. to save Draw files).
- `required`: everything requires login.

`ldap` and `earthdata` are reserved provider names and are not implemented yet.

## 2. Preview and import existing accounts

Run against a copy of your database first:

```bash
npm run auth:migrate -- --dry-run   # prints the role bindings it would create; writes nothing
npm run auth:migrate                # imports them (safe to re-run)
```

The import never changes usernames or password hashes, so every existing account logs in exactly as before. It maps:

| Legacy | New role binding |
| --- | --- |
| `permission=111` | `superadmin` (global) |
| `permission=110` + `missions_managing` | `mission_admin` on each listed mission |
| `missions_viewing` list | `viewer` on each listed mission |
| `missions_viewing` unset | `viewer` (global) |

The server also runs the import once on first start if it hasn't run. Unknown mission names are reported and skipped. The legacy columns are kept, so rolling back to the previous image still works.

## 3. What changes for each kind of account

- **SuperAdmins**: unchanged. More than one SuperAdmin is supported, and the last one can't be removed or demoted.
- **Mission admins**: can edit the configuration and layers of their missions only. Creating, cloning, renaming or deleting missions, STAC, geodatasets, datasets, accounts, webhooks and site options are now SuperAdmin (or `data_admin` for data) operations.
- **Layer editors (new)**: edit one layer folder and its children through the per-layer routes. Saving a whole configuration (`/api/configure/upsert`) or moving layers requires mission configuration access.
- **Viewers**: see only the missions they're granted. `Missions/shared` stays readable by any signed-in user.

Roles are granted to users, to groups, or to the `authenticated` / `everyone` audiences in **Configure → Access**, which also shows each user's effective access and where it comes from.

## 4. Long-term tokens

- New tokens are shown once and stored hashed. Existing tokens keep working and are converted to hashed storage on first use.
- Tokens can be read-only or carry the creator's access, optionally limited to some missions, and can expire or be revoked.
- A token never exceeds what its creator can currently do: demoting or deleting the creator narrows or removes it immediately.
- Any signed-in user can create read-only tokens.

## 5. Adjacent servers

TiTiler, TiPG, STAC, titiler-pgstac and Veloserver must only be reachable through MMGIS' proxy routes. Don't publish their ports. See [Adjacent Servers](/MMGIS/setup/adjacent-servers).
