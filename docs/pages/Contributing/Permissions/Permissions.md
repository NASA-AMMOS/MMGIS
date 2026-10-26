---
layout: page
title: Backend Permissions
permalink: /contributing/permissions
parent: Contributing
nav_order: 2
---

# Backend Permissions (`s.authorize`)

##### Contents

- [In one sentence](#in-one-sentence)
- [Quick start for a backend plugin](#quick-start-for-a-backend-plugin)
- [How a request is decided](#how-a-request-is-decided)
- [Capabilities](#capabilities)
- [Resolvers](#resolvers)
- [Variants and options](#variants-and-options)
- [Checks inside a handler](#checks-inside-a-handler)
- [Examples](#examples)
- [What startup enforces](#what-startup-enforces)
- [Gotchas](#gotchas)
- [Where the code lives](#where-the-code-lives)

---

## In one sentence

`s.authorize(capability, resolver)` is Express middleware: you name the **capability** a route needs and, with a **resolver**, **where in the request** the target mission or layer is; it works out **who is calling** (token, session, CSSO user or guest) and what they hold, then lets the request continue or answers 403.

```javascript
router.post(
  "/updateLayer",
  s.authorize("mission.layer.edit", s.resolvers.layer("body.mission", "body.layerUUID")),
  handler
);
```

Every API route must declare its permission this way (or with `authorize.public` / `authorize.inHandler`). Do not use `s.ensureAdmin` or `s.stopGuests` in new code; they remain only for older plugins.

## Quick start for a backend plugin

```javascript
// plugins/<container>/backend/Notes/plugin.js
const router = require("./routes/notes");

let setup = {
  onceInit: (s) => {
    router.init(s);
    s.app.use(
      s.ROOT_PATH + "/api/notes",
      s.ensureUser({ forbid: true }), // site gate: 403 for guests when sign-in is required
      s.checkHeadersCodeInjection,
      s.setContentType,
      s.registerRouter("/api/notes", router) // records each route's declaration
    );
  },
};
module.exports = setup;
```

```javascript
// plugins/<container>/backend/Notes/routes/notes.js
const express = require("express");
const router = express.Router();

router.init = (s) => {
  const { authorize, resolvers, missionNamesWith } = s;

  // Read the notes of one mission: GET /api/notes/:mission
  router.get("/:mission", authorize("mission.view", resolvers.mission("params.mission")), handler);

  // Change a note on a layer: needs layer edit on that layer (or a parent folder / the mission)
  router.post(
    "/save",
    authorize("mission.layer.edit", resolvers.layer("body.mission", "body.layerUUID")),
    handler
  );

  // A list across missions: gate on site.view, then filter
  router.get("/", authorize.inHandler("site.view", "lists only viewable missions"), async (req, res) => {
    const viewable = await missionNamesWith(req, "mission.view"); // null = every mission
    const rows = await Note.findAll();
    res.send(viewable == null ? rows : rows.filter((r) => viewable.includes(r.mission)));
  });
};

module.exports = router;
```

Core plugins (`plugins/core/backend/*`) can `require("../../../../../API/permissions/authorize")` directly instead of taking them from `s`.

## How a request is decided

1. **Who is calling** (`ensurePrincipal`, cached on `req.principal`):
   - An `Authorization: Bearer <token>` header always wins over the session. A bad token, or a token sent inside another user's session, becomes `invalid_token` and never falls back to the session or guest access.
   - Otherwise the signed-in session user, then a CSSO identity, then an anonymous guest.
   - The caller carries its role bindings: its own grants, its groups' grants and the audience grants (Everyone / Logged-in users).
2. **`invalid_token` is refused** with `Unauthorized Token!`: HTTP 401 from the `s.ensureUser` site gate in front of the router, or 403 from `authorize` itself.
3. **What is being acted on**: the resolver turns the request into a resource.
   - `undefined` — no resource; a site-wide check.
   - `null` — not found; **403 for everyone, SuperAdmin included**.
   - an object, or an array of objects that must all pass.
4. **The decision** (`policy.can`):
   - Guests get nothing on `SITE_ACCESS=required` sites.
   - A token must include the capability in its scopes, and a mission-limited token only reaches its missions (plus read-only site-wide routes).
   - A mission capability with no mission in the resource needs a **site-wide** grant.
   - Baseline capabilities need no grant: everyone has `site.view`; signed-in users also have `draw.use`, the data read capabilities and `tokens.create`.
   - Otherwise a grant must cover a scope from the resource upwards: layer → parent folders → mission → site-wide. Any layer grant also lets the caller view that mission.
5. **Allowed**: `req.access = { capability, resource }`, then `next()`. **Denied**: a warning is logged and the response is 403 `Unauthorized`.

## Capabilities

Use an existing capability; an unknown name throws when the route is defined. The list is `CAPABILITIES` in `API/permissions/policy.js`:

| Capability | Scoped to a mission | Meaning |
|---|---|---|
| `site.view` | | View the main site |
| `mission.view` | yes | View a mission and its files |
| `mission.layer.edit` | yes | Edit layers (a layer or folder and its children) |
| `mission.config.edit` | yes | Edit a mission's whole configuration |
| `mission.create` | | Create or clone missions |
| `mission.manage` | yes | Rename or delete missions |
| `accounts.manage`, `groups.manage`, `options.manage`, `webhooks.manage` | | Site administration |
| `broadcast.send` | | Broadcast messages to clients |
| `tokens.create`, `tokens.manage` | | Long-term tokens |
| `draw.use` | | Draw files and features |
| `data.geodatasets.read` / `.write`, `data.datasets.read` / `.write`, `data.stac.read` / `.write` | | Data APIs |

Which roles hold which capability is in Configure → Access Help, and `ROLE_CAPS` in `policy.js`.

## Resolvers

A *pick* is a dotted path into the request (`"body.mission"`, `"query.mission"`, `"params.mission"`) or a function `(req) => value`.

| Resolver | Resource | Use for |
|---|---|---|
| `resolvers.mission(pick)` | the mission (stable UUID looked up by name) | mission-level routes |
| `resolvers.layer(missionPick, layerPick)` | the mission plus the layer's chain of parent folders | single-layer edits; lets folder-level Layer Editors pass |
| `resolvers.layers(missionPick, layersPick)` | one entry per layer; every one must pass | bulk layer edits |
| your own `async (req) => resource \| null \| undefined` | anything | records that belong to a mission |

A resolver that can't find its target must return `null` so the request is refused.

## Variants and options

- `authorize(cap, resolver, { or: ["otherCap"] })` — passes if any of the capabilities is granted.
- `authorize.public("reason")` — no check, but the route is declared (login, health check).
- `authorize.inHandler(cap, "reason")` — gate on `cap`, then the handler filters or checks further.

## Checks inside a handler

- `await s.can(req, cap, resource)` — yes/no for an extra condition.
- `await s.missionNamesWith(req, cap)` — mission names the caller may use with `cap` (`null` = all). Use it so lists never name missions the caller can't view.

## Examples

```javascript
const { authorize, resolvers, can } = s;

// Site-wide capability, no resource
router.get("/collections", authorize("data.stac.read"), handler);

// Mission from the body or the query string
const missionFromReq = resolvers.mission((req) => (req.body && req.body.mission) || req.query.mission);
router.post("/destroy", authorize("mission.manage", missionFromReq), handler);

// Several layers; every one must be editable
router.post("/bulkStyle",
  authorize("mission.layer.edit", resolvers.layers("body.mission", "body.layerUUIDs")), handler);

// Either of two capabilities
router.post("/import",
  authorize("data.geodatasets.write", undefined, { or: ["mission.config.edit"] }), handler);

// Custom resolver: the mission a stored record belongs to
const noteMission = async (req) => {
  const note = await Note.findByPk(req.params.id);
  return note ? resolvers.mission(() => note.mission)(req) : null;
};
router.delete("/:id", authorize("mission.config.edit", noteMission), handler);

// Extra condition inside the handler
router.post("/save",
  authorize("mission.layer.edit", resolvers.layer("body.mission", "body.layerUUID")),
  async (req, res) => {
    if (req.body.moveTo && !(await can(req, "mission.config.edit", req.access.resource)))
      return res.status(403).send({ status: "failure", message: "Moving a layer needs mission configuration permission." });
    // ...
  });

// Declared but open
router.get("/healthcheck", authorize.public("health check"), handler);
```

How some calls come out:

| Caller | Route | Result |
|---|---|---|
| Read-only token | `mission.layer.edit` | 403: the scope lacks the capability, whatever its creator holds |
| Token limited to Mission A | `resolvers.mission` → Mission B | 403 |
| Token limited to Mission A | `data.stac.read` (site-wide read) | allowed if its creator has it |
| SuperAdmin | mission name that doesn't exist | 403 (resolver returned `null`) |
| User with a grant only on Mission A | `authorize("mission.view")` with no resolver | 403: only a site-wide grant satisfies it. Add a resolver, or use `inHandler` + `missionNamesWith` |
| Guest on a `required` site | any `authorize` route | 403 |

## What startup enforces

- Routers wrapped in `s.registerRouter(prefix, router)` are recorded with each route's declaration.
- A **core** route without a declaration stops the server at startup.
- A route of a plugin outside `plugins/core` without a declaration only logs a warning; it is then protected by the site login gate alone.

## Gotchas

- Resolve the mission from the request each time; don't capture it in a closure.
- With an `Authorization` header present, the token decides, not the session.
- Grant changes apply on the caller's next request.
- `mission.*` capabilities without a mission resolver require a site-wide grant.

## Where the code lives

| File | What |
|---|---|
| `API/permissions/authorize.js` | `authorize`, `resolvers`, `can`, `missionNamesWith`, route registry |
| `API/permissions/policy.js` | capabilities, roles, `can()` decision |
| `API/permissions/principal.js` | who is calling (token, session, CSSO, guest) |
| `scripts/server.js` | the `s` object passed to plugins, startup route check |
| `tests/unit/permissions-policy.spec.js`, `tests/unit/permissions-pluginRoutes.spec.js` | examples of expected behaviour |
