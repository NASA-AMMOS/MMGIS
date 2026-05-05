# Offline Support (PWA / Mobile Field Workflow) - Specification

**Status**: 📋 Draft (for discussion)
**Created**: 2026-05-05
**Last Updated**: 2026-05-05

## Overview

MMGIS today is a desktop-first single-page app. Field users on iPad/phone can authenticate and use the app while online, but cannot install it, lose all map content the moment connectivity drops, and have no durable buffer for in-flight Draw mutations. There is no GPS path capture today.

This feature adds **single-shift (1–2 day) offline support** for a small AOI:

1. Install MMGIS as a PWA on iOS / Android / desktop.
2. Pre-cache map tiles for a chosen viewport so the map renders offline.
3. Capture form-driven Draw observations offline; sync when connectivity returns.
4. Record a GPS path live and save it as a LineString feature (online or offline).

Delivery is split into **four independently-shippable phases**. Phase 1 (PWA shell) is the foundation. Phase 2 (tile cache), Phase 3 (data sync), and Phase 4 (GPS path) each layer on Phase 1 but are independent of each other.

**Configure app (`configure/`) is explicitly out of scope** — only the main MMGIS app becomes a PWA.

## User Scenarios

### P1 - Field User Installs MMGIS and Survives Connectivity Loss

**As a** field scientist on a mission deployment
**I want to** install MMGIS to my home screen and have the app shell continue to function during brief connectivity gaps
**So that** I am not blocked when network drops mid-task

**Acceptance Criteria**:
- [ ] App is installable from iOS Safari, Android Chrome, and desktop Chrome via the standard browser install affordance.
- [ ] Installed app launches from home screen with custom icon, splash, and `display: standalone`.
- [ ] When offline, opening the installed app loads the shell (no blank page, no browser error chrome).
- [ ] Online/offline status is visible in the UI at all times.
- [ ] On iOS (where `beforeinstallprompt` does not fire), an "Add to Home Screen" instructional modal is available.
- [ ] App update flow is non-destructive (user is prompted to refresh; in-flight work is not auto-killed).

**User Flow**:
1. User opens MMGIS in mobile Safari / Chrome.
2. User taps the in-app "Install" affordance (or follows instructional modal on iOS).
3. App installs to home screen.
4. User launches the app, signs in, uses it as normal.
5. Connectivity drops mid-session — UI surfaces an "Offline" pill; shell remains usable.
6. Connectivity returns — pill flips to "Online".

### P2 - Field User Pre-Caches an AOI for Offline Map Rendering

**As a** field user about to leave network coverage
**I want to** select an area of interest and a zoom range and download those tiles to my device
**So that** the map renders correctly while I'm in the field

**Acceptance Criteria**:
- [ ] User can select an AOI by drawing a rectangle or by using the current viewport.
- [ ] User can choose a zoom range (default: current zoom .. current zoom + 2).
- [ ] User can choose which active layers to include (tile / vectortile / COG / STAC mosaic layers visible on the map).
- [ ] Pre-flight estimate of total bytes is shown before download begins, expressed both absolutely and as a percentage of available device storage.
- [ ] Download progress is visible (tiles fetched / total / bytes / failures) and cancellable.
- [ ] After download, panning and zooming within the AOI renders cached tiles offline; outside the AOI shows a transparent placeholder.
- [ ] Cached regions appear in a "Cached Regions" panel showing name, size, age, and a delete button.
- [ ] Storage usage is bounded — by default, a single region is capped at 50% of remaining device quota to leave room for Draw + GPS data.

**User Flow**:
1. User opens the Offline tool.
2. User pans / zooms to the AOI and chooses "Use current viewport" (or draws a rectangle).
3. User picks a zoom range and the layers to include.
4. User reviews the size estimate, names the region, taps "Download".
5. Progress UI updates as tiles are fetched.
6. User goes offline; map continues to render within the AOI.
7. User returns from the field and deletes the region from the Cached Regions panel.

### P3 - Field User Captures Observations Offline and Syncs Later

**As a** field user collecting observations
**I want to** add, edit, and delete Draw features (with form data) while offline, and have them sync automatically when I reconnect
**So that** I do not lose work due to connectivity gaps and do not need to retype data

**Acceptance Criteria**:
- [ ] While offline, all Draw mutations (add / edit / delete / undo / merge / split) appear to succeed with optimistic UI feedback.
- [ ] Features created offline display a visual "pending sync" treatment (e.g., dashed outline + badge) until confirmed.
- [ ] The pending queue persists across page reloads and app restarts.
- [ ] On reconnect, the queue drains in FIFO order automatically; visible status indicator shows progress.
- [ ] Server-rejected items (conflicts, validation errors) land in a "Sync Conflicts" tray for manual review.
- [ ] In the Conflicts tray, the user can see a side-by-side diff of their queued payload vs. current server state and choose **Discard** or **Force replay with fresh baseline**.
- [ ] If the auth session has expired by the time the queue drains, the user is prompted to re-authenticate; queue is paused (not dropped) and resumes after re-auth.
- [ ] Conflict resolution is **server-wins** by default — no automatic merge.
- [ ] Form attachments (photos / files) survive offline persistence without exhausting storage quota.

**User Flow**:
1. User opens the Draw tool while online; selects a Draw file with a form template.
2. User loses connectivity; user adds 3 features, edits 1, deletes 1.
3. Sync indicator shows "queued, offline" (red); features display with "pending" styling.
4. User force-quits and reopens the app — queued mutations persist.
5. Connectivity returns; sync indicator flips to "queued, online, draining" (amber); queue drains.
6. One feature is rejected because another user edited it in the interim — it appears in the Conflicts tray.
7. User opens the tray, reviews the diff, chooses Discard.
8. Indicator returns to green ("synced").

### P4 - Field User Captures a GPS Path

**As a** field user walking a transect
**I want to** record my GPS path live and save it as a LineString feature with metadata
**So that** I have a durable, georeferenced record of where I went

**Acceptance Criteria**:
- [ ] User can Start, Pause, Resume, Stop & Save, and Discard a track from the GPS Path tool.
- [ ] A live polyline grows on the map as the user moves.
- [ ] On Stop & Save, a LineString feature is written to a configured Draw file with auto-computed metadata: `start_ts`, `end_ts`, `distance_m`, `point_count`, `accuracy_avg_m`, `device_label`.
- [ ] If saved while offline, the save routes through the Phase 3 sync queue (not lost).
- [ ] Track is decimated on save (Douglas-Peucker, configurable epsilon, default ~2m); raw points retained in local storage for forensic export.
- [ ] If the user kills / crashes the tab mid-track, on next open the user is prompted: "Resume previous track from {time}? (Save / Discard)".
- [ ] On iOS where wake-lock is unsupported, a banner advises the user to disable device sleep.
- [ ] When the tab is backgrounded, ingestion is paused and a visible "paused" notice is shown — points captured while backgrounded are never silently claimed.
- [ ] First few points or any with `accuracy > 50m` are dropped by default to suppress initial-fix drift (configurable).

**User Flow**:
1. User opens the GPS Path tool, selects target Draw file (defaults to mission-configured "GPS Tracks").
2. User taps Start; permission prompt accepted; wake-lock acquired (where supported).
3. Live polyline draws on the map; live stats update (duration, distance, accuracy, point count).
4. User backgrounds the tab briefly to take a photo — "paused" notice appears; track resumes on return.
5. User taps Stop & Save; LineString feature is written to the Draw file.
6. If offline, save queues; on reconnect, it drains and the feature appears for collaborators.

## Requirements

### Functional Requirements

**FR-001**: PWA installability across iOS Safari, Android Chrome, and desktop Chrome / Edge.
- **Priority**: P1
- **User Scenarios**: P1
- **Acceptance Criteria**: Standard browser install flow succeeds; installed app launches standalone with custom icon; iOS instructional fallback present.

**FR-002**: Service Worker app-shell precaching with non-destructive update flow.
- **Priority**: P1
- **User Scenarios**: P1
- **Acceptance Criteria**: Cold-cache-miss reload of installed app renders shell offline; update prompts user; in-flight Draw / GPS work is not killed by SW activation.

**FR-003**: Online / offline status indicator in the UI.
- **Priority**: P1
- **User Scenarios**: P1, P3
- **Acceptance Criteria**: Visible status pill in the existing top bar; flips on `online`/`offline` events.

**FR-004**: User-driven AOI tile pre-caching (XYZ, MVT, COG/TiTiler, STAC mosaic).
- **Priority**: P2
- **User Scenarios**: P2
- **Acceptance Criteria**: Region selector (rectangle or current viewport), zoom range, layer multi-select, pre-flight byte estimate, progress UI, cancel.

**FR-005**: Cached Regions management panel.
- **Priority**: P2
- **User Scenarios**: P2
- **Acceptance Criteria**: List of named regions with size, age, delete action.

**FR-006**: SW-based tile fetch interception with shared canonicalization between SW and client.
- **Priority**: P2
- **User Scenarios**: P2
- **Acceptance Criteria**: Cached tiles render offline; cache keys are stable across param ordering / encoding variation; defense-in-depth fallback when SW is missing.

**FR-007**: Durable, ordered offline mutation queue for Draw endpoints.
- **Priority**: P3
- **User Scenarios**: P3
- **Acceptance Criteria**: Queue persists in IndexedDB across reloads; FIFO drain on reconnect; statuses `pending`, `in_flight`, `conflict`, `done`.

**FR-008**: Client-generated UUIDs and idempotent `/draw/add` (via `correlation_uuid`).
- **Priority**: P3
- **User Scenarios**: P3
- **Acceptance Criteria**: Server preserves client-set `properties.uuid`; replays of the same `correlation_uuid` return the existing row's identity (replay-safe).

**FR-009**: Server-wins conflict detection on `/draw/edit` via `baseline_extant_start`.
- **Priority**: P3
- **User Scenarios**: P3
- **Acceptance Criteria**: If current row's `extant_start > baseline_extant_start`, server returns 409 with current state; client moves item to Conflicts tray.

**FR-010**: Sync Conflicts tray with diff, discard, and force-replay.
- **Priority**: P3
- **User Scenarios**: P3
- **Acceptance Criteria**: Tray surfaces all `conflict`-status items; resolved replays go to head of FIFO (not tail); discarded items are removed.

**FR-011**: Auth-aware queue drain (pause on 401, resume after re-auth).
- **Priority**: P3
- **User Scenarios**: P3
- **Acceptance Criteria**: 401 during drain pauses queue, prompts re-auth modal, never discards items; CSRF token refreshed before each drain if applicable.

**FR-012**: GPS Path tool with Start / Pause / Resume / Stop & Save / Discard lifecycle.
- **Priority**: P4
- **User Scenarios**: P4
- **Acceptance Criteria**: Live polyline; live stats; wake-lock on supported platforms; configurable target Draw file.

**FR-013**: Crash-recoverable raw-point storage and on-save Douglas-Peucker decimation.
- **Priority**: P4
- **User Scenarios**: P4
- **Acceptance Criteria**: Raw points retained in IDB until explicit save/discard; saved feature is the decimated LineString with computed metadata; "Resume previous track?" prompt on tool re-open.

**FR-014**: Backgrounded-tab pause with visible UI; never claim points captured while hidden.
- **Priority**: P4
- **User Scenarios**: P4
- **Acceptance Criteria**: Page Visibility API drives pause; "paused" banner is visible; resume on return to foreground.

**FR-015**: Cache and IDB clear on logout.
- **Priority**: P1 (security)
- **User Scenarios**: All
- **Acceptance Criteria**: Logout flow purges SW caches and offline IDB stores; user-id-prefixed cache namespaces ensure no cross-user leakage.

**FR-016**: Per-phase server-side feature flags in `mmgisglobal.options.offline`.
- **Priority**: P1
- **User Scenarios**: All
- **Acceptance Criteria**: `{ pwa, tileCache, syncQueue, gpsTrack }` flags gate module init; operators control rollout.

### Non-Functional Requirements

**NFR-001**: Offline duration target.
- **Category**: Usability
- **Metric**: Single shift, up to 1–2 days, on a small AOI with small data payloads (form submissions + GPS paths).

**NFR-002**: Tile cache storage budget.
- **Category**: Storage
- **Metric**: A single region is capped at 50% of `navigator.storage.estimate()` available budget; pre-flight estimate accurate within 10% of actual.

**NFR-003**: Mutating endpoints are never SW-cached.
- **Category**: Security
- **Metric**: Explicit `NetworkOnly` denylist for `/api/draw/*` and all write paths.

**NFR-004**: Read-side caches include user identity in cache key.
- **Category**: Security
- **Metric**: `mmgis-data-{user}-v1` style namespacing prevents revoked-permission stale data leakage.

**NFR-005**: Sub-path deployments must work.
- **Category**: Compatibility
- **Metric**: SW scope derived from `mmgisglobal.ROOT_PATH`; deploy test passes under `/mmgis/`.

**NFR-006**: PWA Lighthouse score.
- **Category**: Quality
- **Metric**: Lighthouse PWA score ≥ 90 post-Phase-1, enforced in CI.

**NFR-007**: Configure app coexistence.
- **Category**: Compatibility
- **Metric**: SW does not register on `/configure`; Workbox `exclude` rule prevents precaching of `configure/public/index.html`.

## Scope & Constraints

### In Scope
- Main MMGIS app PWA shell (Phase 1).
- User-driven AOI tile pre-caching (Phase 2).
- Draw mutation sync queue with conflict tray (Phase 3).
- GPS path capture tool (Phase 4).
- Reference Mission updates to exercise each phase end-to-end.

### Out of Scope
- No native iOS / Android shells.
- No mobile UX redesign — Phase 1 just makes existing UI installable and offline-resilient.
- No offline collaboration (one user offline at a time per file).
- No MBTiles / PMTiles import.
- Configure app is **not** made into a PWA.
- No automatic merge of conflicting edits — server-wins, manual review only.

### User-Confirmed Product Decisions
- Offline duration target: single shift, 1–2 days, small AOI, small data payloads.
- Tile bundles: user-driven viewport download.
- Conflicts: **server-wins** with manual conflict tray resolution.
- Plan shape: one phased plan, each phase ships independently.

## Success Criteria

**Definition of Done (per phase)**:
- [ ] All in-phase functional requirements implemented.
- [ ] Acceptance criteria for the phase's user scenario(s) verified manually on the device matrix (iPad Safari, iPhone Safari, Android Chrome, desktop Chrome, desktop Firefox).
- [ ] Automated tests added per phase (Playwright for user-visible behaviors; unit tests for pure modules; server-side tests for new endpoint behaviors).
- [ ] Reference Mission artifact added for the phase (where applicable).
- [ ] Feature flag wired and defaults to **off** at merge.
- [ ] Constitution compliance reviewed.

**Cumulative Metrics**:
- Lighthouse PWA score ≥ 90 after Phase 1.
- AOI cache pre-flight estimate within 10% of actual usage after Phase 2.
- 100% of Draw mutations replay-safe (idempotent on `correlation_uuid`) after Phase 3.
- GPS save round-trip works offline → online with metadata intact after Phase 4.

## Open Questions

These are explicitly raised for discussion. None block starting Phase 1.

1. **Phase ordering and interleaving** — Phases 2/3/4 are independent of each other. Do we want them all to land before any goes GA, or release each behind its flag as it ripens?
2. **Auth strategy across long offline windows** — current cookie sessions may rotate or expire over 1–2 days. Is a longer-lived session acceptable for installed PWAs, or do we want to issue a refresh-token mechanism specifically for offline use?
3. **CSRF refresh path** — does `src/pre/RefreshAuth.js` issue a token that needs refreshing per drain, or is the cookie session the only auth state? (Confirm before Phase 3 implementation.)
4. **Photo / file attachments in Draw forms** — does `DrawTool_Templater.js` currently support attachments? If yes, IDB Blob storage is required; if no, defer to a follow-up.
5. **Telemetry destination** — is the IDB ring-buffer + "Download diagnostic log" enough, or do we want to plumb to an existing logger / Splunk-style destination when online?
6. **Cross-origin tile providers** — Safari's historical 7MB-per-opaque-response charge may make cross-origin pre-caching untenable. Do we hard-block cross-origin layers in the AOI selector or just warn?
7. **Conflict tray retention** — do conflict items persist forever until user resolves, or auto-archive after N days?
8. **Reference-Mission GPS Tracks template** — exact field set TBD with the science / ops stakeholders.
9. **Storage quota messaging** — what's the right UX when iPadOS evicts standalone storage after ~7 days unused? Banner? Pre-emptive nudge after 5 days?
10. **Configure-page coexistence test** — should we add a CI smoke test that hits `/configure` after deploy and confirms no SW registration?

## References

- Source plan: `/Users/jleach/.claude/plans/we-re-running-into-a-cheeky-crayon.md`
- Technical Plan: [plan.md](./plan.md)
- Constitution: `.specify/memory/constitution.md`
- Existing tile interception: `src/essence/Basics/Layers_/leaflet-tilelayer-middleware.js`
- Existing API call chokepoint: `src/pre/calls.js`
- Existing Draw API: `API/Backend/Draw/routes/draw.js`
