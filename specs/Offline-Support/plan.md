# Offline Support (PWA / Mobile Field Workflow) - Technical Plan

**Spec Reference**: [spec.md](./spec.md)
**Status**: 📋 Draft (for discussion)
**Created**: 2026-05-05
**Last Updated**: 2026-05-05

## Technical Context

MMGIS is a desktop-first SPA on a CRA-derived webpack 5 setup. The codebase already has the right hooks for offline work:

- **`src/serviceWorker.js`** is CRA boilerplate currently `unregister()`-ed at `src/index.js:80` — a clean slate to replace with a Workbox-driven SW.
- **`src/essence/Basics/Layers_/leaflet-tilelayer-middleware.js`** is the canonical tile-request shaping point and the natural place to integrate cache-aware tile loading.
- **`src/pre/calls.js`** is a single chokepoint for nearly every mutating API call.
- **Draw features** already carry server-issued v4 UUIDs in `properties.uuid` (e.g., `API/Backend/Draw/routes/draw.js:732`), and the `/edit` route already accepts `addIfNotFound` and `reassignUUID` flags — adjacent prior art for the new client-supplied identity and conflict fields.
- **Mobile detection** (`src/essence/Basics/UserInterface_/UserInterface_.js:2-6`) and a mobile CSS file are already in place.
- **No existing GPS feature** — Phase 4 is greenfield.

### Related Systems
- Service Worker / browser caches (`Cache API`, `IndexedDB`, `navigator.storage`)
- Leaflet 2D map and tile pipeline
- Cesium 3D engine (Phase 2 tile cache only addresses 2D layers in initial scope)
- Draw tool (collaborative vector editing)
- Express API for Draw mutations and configuration
- Reference Mission used as integration sandbox

### Dependencies (new)
- `workbox-webpack-plugin` (build-time SW injection)
- `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`, `workbox-background-sync`

### Existing Dependencies Reused
- Leaflet, `leaflet.draw` (already imported in `src/index.js`)
- Turf.js (Douglas-Peucker simplification)
- `crypto.randomUUID()` (with `uuid` package fallback)
- `mmgisglobal.ROOT_PATH` pattern from `src/pre/calls.js:184-188`

### Technology Stack
- Service Worker generated via Workbox `InjectManifest` (we own the SW source).
- Tile cache in Cache API; metadata + queues + GPS raw points in IndexedDB.
- No new server framework — additive Express route changes only.

## Constitution Check

Evaluating against `.specify/memory/constitution.md`:

### I. Documentation-First Development
**Compliance**: ✅
**Notes**: This spec + plan exist before any code. Each phase will gain `tasks.md` before implementation.

### II. Clear Requirements
**Compliance**: ✅
**Notes**: 16 functional + 7 non-functional requirements with acceptance criteria. 4 user scenarios with measurable outcomes.

### III. Incremental Delivery
**Compliance**: ✅
**Notes**: Four independently shippable phases, each behind its own server-side feature flag.

### IV. Quality Standards
**Compliance**: ✅ (target)
**Notes**: ESLint clean; ≥80% unit-test coverage on new pure modules (`cacheKey.js`, `SyncQueue.js`, `GpsRecorder.js`); Playwright suite for user-visible behaviors per phase; Lighthouse CI for PWA score.

### V. Node.js & Web-Mapping Best Practices
**Compliance**: ✅
**Notes**: Async/await throughout; proper error handling on SW message ports and IDB transactions; Leaflet for 2D, no Cesium changes; GeoJSON LineString for GPS save.

### VI. Geospatial Data Integrity
**Compliance**: ✅
**Notes**: Cached tiles are byte-identical to upstream (no transcoding). GPS points stored raw; decimation is reversible (raw retained until save/discard). CRS unchanged — XYZ tiles use existing layer projection.

### VII. Real-time Collaboration Safety
**Compliance**: ⚠️ (intentional narrow exception)
**Notes**: One user offline at a time per file. Conflicts are surfaced via server-wins + manual review (NOT silently merged), preserving the integrity guarantee.

## Architecture & Design

### High-Level Architecture

```
                         ┌──────────────────────────────────────┐
                         │   MMGIS Browser Tab (Main App)       │
                         │                                      │
                         │  ┌──────────────────────────────┐    │
                         │  │ src/essence/offline/         │    │
                         │  │  - OfflineStatus             │    │
                         │  │  - InstallPrompt             │    │
                         │  │  - TileCacheManager          │    │
                         │  │  - cacheKey  (shared w/ SW)  │────┼──┐
                         │  │  - SyncQueue                 │    │  │
                         │  │  - ConflictTray              │    │  │
                         │  │  - GpsRecorder               │    │  │
                         │  │  - idb (schema versions)     │    │  │
                         │  └──────────────┬───────────────┘    │  │
                         │                 │                    │  │
                         │  ┌──────────────▼───────────────┐    │  │
                         │  │ src/pre/calls.js (api wrap)  │    │  │
                         │  └──────────────┬───────────────┘    │  │
                         │                 │ fetch / xhr        │  │
                         └─────────────────┼────────────────────┘  │
                                           │                       │
                         ┌─────────────────▼────────────────────┐  │
                         │ Service Worker (src/sw/)             │◀─┘
                         │  - Workbox routes                    │
                         │  - Tile NetworkFirst→CacheFirst      │
                         │  - App shell precache                │
                         │  - StaleWhileRevalidate (read-only)  │
                         │  - NetworkOnly for write paths       │
                         └─────────────────┬────────────────────┘
                                           │ network
                         ┌─────────────────▼────────────────────┐
                         │  Express API                         │
                         │   /api/draw/{add,edit,remove,...}    │
                         │     ＋ correlation_uuid               │
                         │     ＋ baseline_extant_start          │
                         └──────────────────────────────────────┘
```

### Component Breakdown (cumulative across phases)

**`src/sw/service-worker.js`** *(new)*
- Workbox-injected SW. Defines precache (`self.__WB_MANIFEST`), runtime caches.
- Tile route: `CacheFirst` against `mmgis-tiles-v1`, `NetworkFirst` only when missing AND online.
- Read-side: `StaleWhileRevalidate` for `api/configure/get`, `api/configure/missions`, etc., with user-id-prefixed namespace.
- Write paths: `NetworkOnly` (denylist) — SW never queues; client owns the queue.
- Versioned cache namespace `mmgis-shell-v{version}`.

**`src/sw/registration.js`** *(new)*
- Replaces `src/serviceWorker.js`.
- Handles `register`, `updatefound`/`waiting`, opt-in `skipWaiting`, online/offline event bus.

**`src/essence/offline/OfflineStatus.js`** *(new)* — UI pill bound to SW event bus.
**`src/essence/offline/InstallPrompt.js`** *(new)* — `beforeinstallprompt` listener; iOS instructional fallback.

**`src/essence/offline/cacheKey.js`** *(new)*
- URL canonicalization shared verbatim by SW and client.
- Normalizes COG / TiTiler param order so `?url=X&bidx=1` and `?bidx=1&url=X` share a cache key.
- Strips known-volatile params (cache-busters, signed-URL nonces).

**`src/essence/offline/TileCacheManager.js`** *(new)*
- Pure JS module owning region creation: Leaflet bounds + `{minZoom, maxZoom}` + tile-layer list → ordered tile list.
- Bounded concurrency pool (~6).
- Stores in Cache API namespace `mmgis-tiles-v1`.
- Sidecar `tileMeta` IDB store for size accounting (Cache API has none).
- `navigator.storage.estimate()` quota enforcement.
- Manual delete by region.

**`src/essence/Tools/Offline/OfflineTool.js`** *(new)* (`.css`, `config.json`)
- New tool plugin. Mirrors `src/essence/Tools/Measure/MeasureTool.js`.
- Region selector (rectangle on map via `leaflet.draw` or "current viewport").
- Zoom-range slider (default `currentZoom..currentZoom+2`).
- Layer multi-select.
- Progress UI; cached regions list with size, age, delete.

**`src/essence/offline/SyncQueue.js`** *(new)*
- IDB store `mmgisSyncQueue` rows: `{queueId (auto), correlationUuid, endpoint, method, payload, createdAt, attempts, lastError, status}`.
- Statuses: `pending` | `in_flight` | `conflict` | `done`.
- API: `enqueue`, `drain`, `peekConflicts`, `discardConflict`, `replayConflict`.
- FIFO across all endpoints (cross-feature ordering matters).
- Resolved conflicts go to **head of FIFO**, not tail.

**`src/essence/offline/ConflictTray.js`** *(new)*
- Sidebar surface in Draw tool.
- Side-by-side diff (queued payload vs. server-current state, fetched on demand).
- Discard / Force-replay-with-fresh-baseline.

**`src/essence/Tools/GPSPath/GPSPathTool.js`** *(new)* (`.css`, `config.json`)
- Tool plugin (`MeasureTool.js` shape).
- Start / Stop / Pause / Discard buttons.
- Target Draw file selector (defaults to mission-configured "GPS Tracks").
- Live stats: duration, distance, accuracy, point count.
- Wake-lock acquisition (`navigator.wakeLock.request('screen')`); banner when unsupported (iOS).

**`src/essence/offline/GpsRecorder.js`** *(new)*
- Wraps `navigator.geolocation.watchPosition({enableHighAccuracy: true, maximumAge: 0, timeout: 30000})`.
- Streams `{lat, lon, alt, accuracy, heading, speed, timestamp}` into IDB store `gpsTracks` keyed by `trackId`.
- Page Visibility API: pauses ingestion when `document.hidden`.
- On save: Douglas-Peucker via Turf.js, configurable epsilon (default ~2m); raw retained.

**`src/essence/offline/idb.js`** *(new)*
- Centralized IDB schema versions: `mmgisSyncQueue` v1, `tileMeta` v1, `gpsTracks` v1, `mmgisOfflineEvents` v1.
- Coordinated version bumps; clear-error on mismatch rather than silent drop.

### Data Flow

**Tile pre-cache (Phase 2)**:
```
User → OfflineTool → TileCacheManager → fetch tiles in pool →
  → Cache API (mmgis-tiles-v1) + tileMeta IDB → "Region cached" UI
Render path (offline):
  Leaflet getTileUrl → SW intercept → cacheKey() → caches.match() → tile
```

**Mutation sync (Phase 3)**:
```
DrawTool action → calls.api('draw_add', ...) →
  online?  → fetch → response → UI confirm
  offline? → SyncQueue.enqueue (IDB) → optimistic UI ("pending" badge)
window.online → SyncQueue.drain →
  fetch each → 200 OK: status=done; 401: pause + re-auth modal;
  409: status=conflict (move to tray); 5xx: backoff retry
```

**GPS capture (Phase 4)**:
```
watchPosition tick → GpsRecorder → gpsTracks IDB + live polyline
Stop & Save → simplify (Turf) + compute metadata →
  calls.api('draw_add', LineString, correlation_uuid) → Phase-3 path
```

### Database Changes

**No schema migrations**. All changes are additive at the API layer.

`API/Backend/Draw/routes/draw.js`:
1. `/add` accepts optional `correlation_uuid` in body. Before insert, look up existing row with same `correlation_uuid` in the file. If found, return existing id/uuid as success (replay-safe).
2. `/add` does **not** overwrite `req.body.properties.uuid` when set (currently unconditional `newFeature.properties.uuid = uuidv4()` at line 732).
3. `/edit` accepts optional `baseline_extant_start` timestamp. If current row's `extant_start > baseline_extant_start`, return 409 with current server state.

Existing `extant_start` / `extant_end` columns are sufficient for conflict detection — no new columns.

## API Contracts

### Modified: `POST /api/draw/add`

**New request fields (optional)**:
```json
{
  "...existing fields...": "...",
  "correlation_uuid": "client-generated v4 UUID for idempotency",
  "feature": {
    "properties": {
      "uuid": "client-generated v4 UUID — server preserves when set"
    }
  }
}
```

**Response (200, replay)**: when `correlation_uuid` matches an existing row, returns the existing row's id/uuid as if it were a fresh insert.

**Response (200, new)**: same shape as today.

### Modified: `POST /api/draw/edit`

**New request field (optional)**:
```json
{
  "...existing fields...": "...",
  "baseline_extant_start": "ISO-8601 timestamp of the row's extant_start when the client took its baseline"
}
```

**Response (409)**:
```json
{
  "error": "conflict",
  "server_state": { "...current row payload..." }
}
```

### New: `GET /api/configure/get`, `/api/configure/missions` (cache-side only)

No API change. SW caches with `StaleWhileRevalidate` and user-id-prefixed namespace.

## Phased Implementation

Each phase below maps to the spec's user scenarios P1–P4 respectively.

---

### Phase 1 — PWA Shell (P1)

**Deliverable**: Installable PWA with Workbox SW that precaches the app shell, runtime-caches static assets and select read-only API calls, surfaces online/offline state, and exposes an event bus for later phases.

**Files to Create / Modify**:
- *Create* `src/sw/service-worker.js`, `src/sw/registration.js`.
- *Create* `src/essence/offline/OfflineStatus.js`, `src/essence/offline/InstallPrompt.js`.
- *Modify* `public/manifest.json` — replace CRA boilerplate. Real `name`, `short_name="MMGIS"`, `id="/"`, `start_url="./?source=pwa"`, `scope="./"`, `display="standalone"`, `display_override`, `theme_color`, `background_color`, multi-resolution icons (192/256/384/512 + maskable), iOS `apple-touch-icon` set, `screenshots[]`.
- *Modify* `public/index.html` — `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable">`, status-bar style, `apple-mobile-web-app-title`, `<link rel="manifest">` resolved against `mmgisglobal.ROOT_PATH`.
- *Modify* `src/index.js:80` — remove `serviceWorker.unregister()`; call new `registration.register({ onUpdate, onSuccess })`.
- *Modify* `configuration/webpack.config.js` — add `workbox-webpack-plugin`'s `InjectManifest` (not `GenerateSW`). Production-only by default; gate dev with `WORKBOX_DEV=true`.
- *Modify* `package.json` — add Workbox deps.
- *Modify* `configure/public/index.html` — explicitly do NOT register a SW; ensure Workbox `exclude` rule prevents precaching.

**Key Decisions**:
- **`InjectManifest` over `GenerateSW`** — Phase 2 tile cache and Phase 3 queue-replay logic require a custom SW we own.
- **Dynamic SW scope from `mmgisglobal.ROOT_PATH`** — MMGIS can be served from a sub-path; an incorrect scope makes the SW silently inactive.
- **Don't precache the templated `index.html`** — it's server-rendered with auth/user/permissions. Use `NetworkFirst` with 3s timeout; fall back to a precached `offline.html` shell.
- **Skip-waiting opt-in** — show "New version ready, refresh" toast rather than auto-activating; in-flight Draw or GPS work would be lost on a forced reload.

**Reuse**: `mmgisglobal.ROOT_PATH` pattern from `src/pre/calls.js:184-188`; mobile UA detect from `UserInterface_.js:4`; existing top-bar slot for status pill.

**Risks**:
- iOS Safari `beforeinstallprompt` does not fire — manual instructional modal required.
- iOS standalone resets storage every ~7 days of non-use — document; show "last sync" warning when older than 5d.
- Cookie-based `withCredentials` SW interception can break in cross-origin reverse-proxy setups — flag for ops.
- Sub-path deployments require dynamic scope — test on `/mmgis/` route.
- Configure-app coexistence — verify Workbox exclude rule on a deployed `/configure`.

**Verification**:
- Manual: install on iPad Safari, Android Chrome, desktop Chrome; force offline (DevTools), reload, shell renders with "Offline" pill.
- Manual: deploy to `/mmgis/` sub-path; SW registers correctly.
- Automated: Playwright test loads app, asserts SW `activated`, goes offline, reloads, asserts shell renders.
- Lighthouse CI step for PWA score (≥ 90).

---

### Phase 2 — Offline Tile Cache (P2)

**Deliverable**: User pans/zooms to AOI, taps "Make available offline," and MMGIS computes the {z,x,y} tile set for currently-visible tile layers across a chosen zoom range, fetches them, and stores them so they render seamlessly with no network. A "Cached Regions" panel lists regions with size, age, and delete actions.

**Files to Create / Modify**:
- *Create* `src/essence/offline/TileCacheManager.js`, `src/essence/offline/cacheKey.js`.
- *Create* `src/essence/Tools/Offline/OfflineTool.js` (`.css`, `config.json`).
- *Modify* `src/essence/Basics/Layers_/leaflet-tilelayer-middleware.js` — extend `colorFilterExtension.getTileUrl` so that when the layer is in "offline" mode and SW isn't controlling (e.g., dev), `_loadTile` consults `caches.match()` directly. Defense-in-depth fallback when SW is uninstalled or stale.
- *Modify* `src/sw/service-worker.js` — Workbox route matching tile URL patterns (XYZ/TMS/MVT/TiTiler proxied paths). `CacheFirst` against `mmgis-tiles-v1`, `NetworkFirst` only when missing AND online. Match logic uses `cacheKey.js`.
- *Modify* `src/essence/Basics/Map_/Map_.js` (~1272–1452) — add `Map_.getActiveTileLayers()` returning layer descriptors `{id, urlTemplate, options, type}` for `TileCacheManager`. No layer construction changes.

**Key Decisions**:
- **Cache API for tiles, IDB for metadata.** Cache API handles opaque cross-origin responses cleanly and matches the SW's natural primitive. IDB carries byte accounting and region grouping.
- **User-driven, not predictive.** "Make available offline" is a button. No auto-eviction beyond manual delete; stale regions get a badge but are not auto-purged.
- **Cache-key canonicalization is the load-bearing piece.** TiTiler URLs carry `?url=&bidx=&rescale=&colormap_name=&expression=` and order/encoding can drift. One canonicalizer between SW and client is the only way they agree.
- **iPad quota is the binding constraint.** Pre-flight estimate samples 5 tiles, projects total bytes, shows percentage of `navigator.storage.estimate()`'s available budget. Cap regions at 50% of remaining to leave room for Draw + GPS.
- **No MBTiles/PMTiles import.** Out of scope.

**Reuse**: `leaflet-tilelayer-middleware.js` (existing tile interception point); `leaflet.draw` (already in `src/index.js`) for AOI rectangle; `MeasureTool.js` shape for tool plugin lifecycle; mission `config.json` `data.layers[]` schema for layer enumeration.

**Risks**:
- Cross-origin opaque responses charged ~7MB each on Safari historically — warn on cross-origin layers; recommend MMGIS proxy.
- iPadOS quota is small for non-installed PWAs; installation unlocks the larger budget — document.
- Vector tile renderers need style JSON; ensure styles are precached or included in region downloads.
- TiTiler dynamic params (`cogMin/cogMax/colormap`) — cache only currently-rendered styling; warn on style change while offline.
- STAC mosaic params (`items_limit`/`scan_limit`/`time_limit`) need canonicalizer normalization.

**Verification**:
- Manual: cache viewport over Reference-Mission AOI at z10–14 with 2 layers; go offline; pan/zoom within AOI renders; outside AOI shows transparent placeholder.
- Manual: storage estimate matches actual usage within 10%.
- Automated: unit tests for `cacheKey.js` covering TiTiler, MVT, WMS variants. Playwright test for download/delete flow.
- Reference Mission: add a "Sample Field AOI" preset region in `blueprints/Missions/Reference-Mission/config.reference-mission.json`.

---

### Phase 3 — Offline Data Sync (P3)

**Deliverable**: While offline, a user can add/edit/delete Draw features and submit form data; mutations are queued durably. On reconnect, the queue drains in order. Server-rejected items land in a "Sync Conflicts" tray for manual resolve/discard. Feature creation uses **client-generated UUIDs** so optimistic UI never has to renumber a feature on confirmation.

**Files to Create / Modify**:
- *Create* `src/essence/offline/SyncQueue.js`, `src/essence/offline/ConflictTray.js`.
- *Modify* `src/pre/calls.js` — wrap `$.ajax` in `api()`:
  - GETs pass through (SW handles caching).
  - POSTs to mutation endpoints (`draw_add`, `draw_edit`, `draw_remove`, `draw_undo`, `draw_merge`, `draw_split`): if `navigator.onLine === false` OR a recent network error to that endpoint, enqueue with `correlationUuid`, return synthesized optimistic success, emit `mmgis:queued` event.
  - On reconnect (`window.online`), call `SyncQueue.drain()`.
  - 401 during drain: pause queue, fire re-auth modal, do NOT discard items.
  - 409 during drain: move to conflict tray with server payload attached.
  - Other 4xx: conflict tray. 5xx: exponential backoff (cap 5 min, max 10 attempts).
- *Modify* `src/essence/Tools/Draw/DrawTool_Drawing.js`, `src/essence/Tools/Draw/DrawTool_Editing.js` — pass explicit client-generated `properties.uuid` and a new `correlation_uuid` field to `calls.api('draw_add', ...)`.
- *Modify* `API/Backend/Draw/routes/draw.js`:
  1. **Idempotency**: accept optional `correlation_uuid` on `/add`. Before insert, check if a feature with that `correlation_uuid` already exists in the file; if yes, return existing row's id/uuid as success.
  2. **Client UUID**: when `req.body.properties.uuid` is set, do NOT overwrite at line 732.
  3. **Conflict detection on /edit**: accept `baseline_extant_start`. If current row's `extant_start > baseline_extant_start`, return 409 with current server state.
- *Modify* `src/essence/Tools/Draw/DrawTool_Templater.js` — render features with queued mutations using a dashed outline + "pending sync" badge.
- *Modify* toolbar (locate via `UserInterfaceBridge`) — add sync-status indicator: green (synced), amber (queued, online, draining), red (queued, offline), purple (conflicts).

**Key Decisions**:
- **Server-wins. Always.** Conflict tray is the only path back. No automatic merge.
- **Don't depend on Background Sync API.** iOS Safari doesn't implement it. Replay is foreground-only on `window.online`. Use Background Sync as best-effort secondary trigger on Chromium.
- **Client-generated UUIDs are the keystone.** Without them, optimistic UI must reconcile a server-assigned id later, complicating Phase 4's GPS append-during-tracking flow. Server already round-trips `uuid` in responses; this is a small additive change.
- **Single FIFO across all endpoints.** Cross-feature ordering matters (an `/edit` of a queued `/add` must run after the add). FIFO + idempotency keys handle this; per-feature subqueues unnecessary.
- **No Workbox `BackgroundSync` plugin for the queue.** It replays opaquely and gives no hook for 409 → conflict tray routing. We own the queue.
- **SW does NOT intercept mutating POSTs.** `NetworkOnly` for `/api/draw/*` and other write paths. Queue lives in JS; SW intercepting would duplicate logic.

**Reuse**: existing `properties.uuid` field on every feature; `extant_start`/`extant_end` schema for conflict detection; `addIfNotFound` / `reassignUUID` in `/edit` (adjacent prior art); `triggerWebhooks("drawFileChange", ...)` (line 99 in `draw.js`) — fire after queue drain just as if mutations had been online.

**Risks**:
- **Auth session expiry mid-offline** — most common 1–2 day failure mode. Catch 401 explicitly, surface re-auth, don't drop queue.
- **CSRF tokens** may have expired by replay — refresh via `src/pre/RefreshAuth.js` before each drain if applicable.
- **Photo / file attachments** in Draw forms — store as Blob in IDB, not data URLs, to avoid quota explosion. Verify whether `DrawTool_Templater.js` supports attachments today.
- **Out-of-order conflict resolution** — resolved items go to **head of FIFO**, not tail, to preserve original chain.
- **UUID collisions** — require `crypto.randomUUID()`; feature-check, fall back to `uuid` package.
- **IDB schema drift across deployed clients** — centralized version table; clear-error on mismatch rather than silent drop.

**Verification**:
- Manual: offline, draw 3 features, edit 1, delete 1; reload (queue persists); go online; verify drain and server state.
- Manual: while user A is offline, user B edits one of A's features; A reconnects → conflict tray; both Discard and Replay work.
- Manual: offline, server-side-expire session, go online → drain pauses with re-auth modal; resume after re-auth.
- Automated: `tests/` integration coverage per mutation type. Unit tests for `SyncQueue` (FIFO, idempotency replay, conflict transitions). Server-side unit tests for new `/add` `correlation_uuid` and `/edit` `baseline_extant_start`.
- Reference Mission: "Field Observations" Draw file with template using all `DrawTool_Templater.js` field types.

---

### Phase 4 — GPS Path Capture Tool (P4)

**Deliverable**: User opens GPS Path tool, taps "Start," and a live polyline grows on the map as they move. Tap "Stop & Save" emits a LineString feature into a configured Draw file with auto-computed metadata. Offline saves route through Phase 3's sync queue.

**Files to Create / Modify**:
- *Create* `src/essence/Tools/GPSPath/GPSPathTool.js` (`.css`, `config.json`) — follows `MeasureTool.js` `make:`/`destroy:` lifecycle.
- *Create* `src/essence/offline/GpsRecorder.js`.
- *Modify* `src/essence/Basics/Map_/Map_.js` — register a Leaflet polyline for the live track. Subscribe to `GpsRecorder` events for incremental polyline extension. No new layer schema.
- *Reuse* Phase 3 path on save: `calls.api('draw_add', ...)` with client-generated `properties.uuid`, `correlation_uuid`, and the LineString geometry. Offline → queue. Online → immediate.
- *Modify* `blueprints/Missions/Reference-Mission/config.reference-mission.json` — add a "GPS Tracks" Draw file with template covering `start_ts`, `end_ts`, `distance_m`, `point_count`, `accuracy_avg_m`, `device_label`.

**Key Decisions**:
- **Foreground only.** iOS Safari doesn't run JS reliably with screen locked or tab backgrounded. Wake-lock + "keep tab visible" is the user contract.
- **Save as one LineString**, not many points. Compute stats on save; store as properties.
- **Decimation on save.** Douglas-Peucker via Turf.js (already in deps) at configurable epsilon (default ~2m). Always retain raw points in `gpsTracks` IDB for forensic export.
- **Crash recovery.** On tool open, if a `gpsTracks` row is `inProgress`, prompt: "Resume previous track from {time}? (Save / Discard)."
- **Independent of Phases 2 and 3.** Tool can save online without Phase 3; works without Phase 2's tile cache. Shippable on its own once Phase 1 lands.
- **Decoration filtering.** Drop first 1–2 points or any with `accuracy > 50m` by default (configurable) to suppress initial-fix drift.

**Reuse**: `MeasureTool.js` shape for tool plugin; Phase 3 sync queue for offline saves (no new persistence path); `DrawTool_Templater.js` template engine for GPS metadata schema (text/number/date already supported); existing Leaflet polyline rendering; Turf.js for Douglas-Peucker.

**Risks**:
- **HTTPS required** for geolocation — most deployments OK; document for HTTP dev.
- **Permissions UX**: first-time prompt may be dismissed. Provide "Enable location" empty state with re-prompt button.
- **Battery drain**: surface a "Battery saver" mode dropping `enableHighAccuracy=false`.
- **Wake-lock unsupported on iOS Safari** — display tooltip; advise device sleep-disable.
- **Backgrounded tab silently drops points** — visible "paused" UI; never claim points captured while backgrounded.
- **Long tracks blow IDB** — cap raw retention at 50k points or 24h and rotate; saved decimated feature is the durable record.

**Verification**:
- Manual: walk a known route on phone with tool active; live polyline; save; verify LineString matches GPX baseline within accuracy expectations.
- Manual: offline track → save (queues) → reconnect → confirms in Draw file with correct geometry/metadata.
- Manual: backgrounding test — track, switch tabs 30s, return; "paused" was visible; resume works.
- Manual: kill tab mid-track, reopen; "Resume?" prompt; track recoverable.
- Automated: Playwright with `navigator.geolocation` overrides simulating `watchPosition` callbacks; verify resulting LineString and simplification at various epsilons.

---

## Cross-Cutting Concerns

### Auth / sessions while offline
- Cookie sessions are existing (`xhrFields: { withCredentials: true }` at `src/pre/calls.js:190-191`). They survive offline as long as the browser keeps the cookie and the server doesn't rotate the session.
- Three failure modes: (a) cookie expired between offline and online, (b) server restart invalidated session, (c) admin force-logout. All surface as 401 on first replay. Treatment is identical: pause queue, surface re-auth modal, resume on success. **Never embed credentials in the queue.**
- CSRF: confirm whether `src/pre/RefreshAuth.js` issues a token; if so, refresh before each drain.

### Telemetry
- IDB `mmgisOfflineEvents` ring buffer (size 500): `{type, timestamp, detail}` for `sw:install`, `sw:activate`, `tile:cached`, `tile:hit`, `tile:miss`, `queue:enqueue`, `queue:drain_start`, `queue:drain_complete`, `queue:conflict`, `gps:start`, `gps:save`.
- "Download diagnostic log" button in Offline tool.
- Plumb same events through the existing logger when online.

### Feature flagging
- Each phase ships behind a server-side flag in `mmgisglobal`:
  ```
  mmgisglobal.options.offline = {
    pwa: true,
    tileCache: false,
    syncQueue: false,
    gpsTrack: false
  }
  ```
- Module-init checks. Operators set via mission/server config; UI toggles can wait.

### Security review of caching mutating responses
- Mutating endpoints are NEVER cached by the SW. Explicit `NetworkOnly` denylist for `/api/draw/*` and any other write paths.
- Read-side caching of `/api/files/getfile` and `/api/draw` aggregations: short-TTL `StaleWhileRevalidate`. **Include user identity in cache key** (e.g., `mmgis-data-{user}-v1`) so revoked permissions don't surface stale protected data.
- Geodatasets MVT responses: cache by URL only; ACL enforced server-side at fetch time. Acceptable for the 1–2 day window.
- All caches must be cleared on logout — hook the existing logout flow in `src/pre/calls.js:24` to call `caches.keys().then(...delete)` and IDB wipe.

### Versioning & migrations
- Bump SW cache namespace on any breaking change to cache shape or canonicalizer.
- IDB schema versions: `mmgisSyncQueue` v1, `tileMeta` v1, `gpsTracks` v1, `mmgisOfflineEvents` v1 — centralized in `src/essence/offline/idb.js` so version bumps coordinate.

---

## Verification Plan (cumulative)

**Manual device matrix**: iPad Safari (current iPadOS), iPhone Safari, Android Chrome, desktop Chrome, desktop Firefox. Each device exercises: install, offline reload, AOI cache + offline pan, queued draw, queue drain, GPS short walk, conflict provoke + resolve.

**Automated**:
- `tests/offline/` Playwright suite covering each phase's user-visible behaviors.
- Unit tests in `src/essence/offline/__tests__/` for `cacheKey.js`, `SyncQueue.js`, `GpsRecorder.js` (deterministic, no browser).
- Server-side unit tests for new `/add` `correlation_uuid` idempotency and `/edit` `baseline_extant_start` conflict detection.
- Lighthouse CI for PWA score post-Phase-1.

**Reference Mission integration**: each phase adds artifacts to `blueprints/Missions/Reference-Mission/` so a developer can `FORCE_CONFIG_PATH=blueprints/Missions/Reference-Mission/config.reference-mission.json npm start` and exercise the full feature without external services.
- Phase 1: nothing required.
- Phase 2: "Sample Field AOI" preset region.
- Phase 3: "Field Observations" Draw file with full-template coverage.
- Phase 4: "GPS Tracks" Draw file with metadata template.

---

## Risk Register

| #  | Risk                                                                  | Phase | Likelihood | Impact | Mitigation                                                                                       |
|----|-----------------------------------------------------------------------|-------|------------|--------|--------------------------------------------------------------------------------------------------|
| 1  | iOS Safari standalone storage eviction after ~7d unused               | 1     | Med        | High   | Document; "last sync" warning when older than 5d                                                 |
| 2  | SW scope wrong on sub-path deployments                                | 1     | Med        | High   | Dynamic scope from `mmgisglobal.ROOT_PATH`; deploy test under `/mmgis/`                          |
| 3  | Configure app accidentally precached / offline-broken                 | 1     | Med        | Med    | Explicit Workbox exclude rule; smoke test deploys                                                |
| 4  | Tile cache canonicalization bug → cache misses on every render        | 2     | High       | High   | Shared `cacheKey.js` between SW and client; unit tests for every URL family                      |
| 5  | iPadOS quota smaller than expected for installed PWA                  | 2     | Med        | Med    | Pre-flight estimate; cap region at 50% of available; honest error UI                             |
| 6  | Cross-origin opaque tile responses charge ~7MB each                   | 2     | Low        | High   | Warn on cross-origin; recommend MMGIS proxy                                                      |
| 7  | Auth session expires mid-replay → drain blocked                       | 3     | High       | Med    | Detect 401, pause queue, prompt re-auth, resume                                                  |
| 8  | CSRF token expired by replay                                          | 3     | Med        | Med    | Refresh token at start of each drain                                                             |
| 9  | Server overwrites client UUID at `draw.js:732`                        | 3     | Cert.      | High   | Explicit code change with idempotency tests                                                      |
| 10 | Conflict tray accumulates and no user resolves                        | 3     | Med        | Low    | Surface count in toolbar; daily reminder while items present                                     |
| 11 | Out-of-order conflict resolution corrupts later replays               | 3     | Med        | High   | Resolved items go to head of FIFO, not tail                                                      |
| 12 | GPS drift on first fixes pollutes track                               | 4     | High       | Low    | Drop first 1–2 points + accuracy filter                                                          |
| 13 | Wake-lock missing on iOS → screen sleeps mid-track                    | 4     | Cert.      | Med    | Document; advise device sleep-disable; show banner                                               |
| 14 | Backgrounded tab silently drops points                                | 4     | Cert.      | Med    | Page Visibility pause + visible "paused" UI                                                      |
| 15 | IDB schema version drift between deployed clients                     | All   | Med        | Med    | Centralized version table in `idb.js`; clear-error on mismatch                                   |
| 16 | Caches retain protected data after logout                             | All   | Med        | High   | Hook logout to clear caches + IDB; user-id-prefix cache namespaces                               |
| 17 | Workbox dev-mode caching makes development painful                    | 1     | High       | Low    | Production-only by default; explicit `WORKBOX_DEV=true` opt-in                                   |

---

## Top-of-Stack Critical Files (across phases)
- `configuration/webpack.config.js`
- `src/sw/service-worker.js` *(new)*
- `src/sw/registration.js` *(new)*
- `src/pre/calls.js`
- `API/Backend/Draw/routes/draw.js`
- `src/essence/Basics/Layers_/leaflet-tilelayer-middleware.js`
- `src/essence/Basics/Map_/Map_.js`
- `public/manifest.json`
- `public/index.html`
- `blueprints/Missions/Reference-Mission/config.reference-mission.json`

---

## Discussion Points (for review)

This plan is intentionally surfacing the following for team feedback before any tasks.md / implementation work:

1. **Phase release strategy** — gate all phases behind flags and release each as it's ready, or hold for a single "Offline Support" GA?
2. **Auth model for long-offline windows** — is the existing cookie session adequate, or do we want a refresh-token mechanism specifically for installed PWAs?
3. **Tile-cache scope for 3D / Cesium** — initial scope is 2D Leaflet only. When/if Cesium AOI caching is needed, that's a follow-up.
4. **Attachment handling** — confirm current `DrawTool_Templater.js` attachment support, and the IDB-Blob path before Phase 3 begins.
5. **Cross-origin layer policy** — hard-block in AOI selector or warn-and-allow?
6. **Conflict tray retention policy** — indefinite vs. auto-archive after N days.
7. **Telemetry sink** — local-only ring buffer or pipe to existing logger?
8. **Reference-Mission GPS Tracks template** — final field set ownership.
