_With Devin_

# Deficiency Report: Offline Support (PWA) spec.md and plan.md

This report consolidates all deficiencies identified through codebase verification across our full review. Issues are organized by severity and category.

---

## Critical: Factual Errors and Misrepresentations

### 1. `extant_start` / `extant_end` columns do not exist

The plan states: _"Existing `extant_start` / `extant_end` columns are sufficient for conflict detection — no new columns."_

This is **false**. The `user_features` model defines only `file_id`, `level`, `intent`, `properties`, and `geom` — with `timestamps: false`, meaning there are no `createdAt`/`updatedAt` columns either. There are 4 references to `extant_start` in `draw.js` routes, but these are not backed by a persisted column in the Sequelize model. The entire Phase 3 conflict detection strategy (`baseline_extant_start`) is built on a column that doesn't exist in the schema. [7-cite-0](#7-cite-0)

**Impact**: Phase 3's conflict detection design needs to be reworked. Either `extant_start`/`extant_end` columns must be added via a migration, or an alternative conflict detection mechanism (e.g., a version counter or hash) must be used.

### 2. `public/index.html` has no `<link rel="manifest">` — needs adding, not modifying

The plan says to modify the manifest link to resolve against `ROOT_PATH`. There is **no manifest link** in `index.html` at all. It needs to be _added_, not modified. Similarly, there are no `apple-touch-icon`, `apple-mobile-web-app-capable`, or `apple-mobile-web-app-title` meta tags. [7-cite-1](#7-cite-1)

### 3. `RefreshAuth.js` is CSSO-only, not a general CSRF/auth refresh mechanism

The plan's Open Question #3 asks _"does `src/pre/RefreshAuth.js` issue a token that needs refreshing per drain?"_ — implying it might be a general auth refresh mechanism. It is **exclusively a CSSO (SSO) auth refresh** that checks SSO token expiry and refreshes the inactivity timeout. It only activates when `mmgisglobal.AUTH == 'csso'`. For local auth or other auth backends, this file does nothing. The plan's Phase 3 queue drain auth strategy needs to account for the full auth backend matrix (local, CSSO, off), not just CSSO. [7-cite-2](#7-cite-2)

### 4. The `calls.js` `api()` function already exists — plan mischaracterizes the integration

The plan says _"wrap `$.ajax` in `api()`"_ — but `api()` already exists and already wraps `$.ajax`. The plan should say "intercept the existing `api()` function" or "add offline-aware logic to the existing `api()` call path." The existing `api()` function is the sole entry point for all API calls. [7-cite-3](#7-cite-3)

---

## Critical: Missing Technical Considerations

### 5. Mission config is not explicitly pre-cached

The mission config (`GET /api/configure/get?mission=X`) is **the single most critical data dependency** for offline. Without it, the app is a blank shell — no layers, no tools, no UI structure. The plan mentions `StaleWhileRevalidate` for this endpoint, which is insufficient for cold-start offline. If the cache was evicted (iPadOS can evict after ~7 days), the app is dead. The config must be **explicitly pinned** during the Phase 2 AOI download flow. [7-cite-4](#7-cite-4)

### 6. Geodatasets are completely unaddressed

Geodataset-backed vector layers (`url: "geodatasets:layer_name"`) query PostGIS via `/api/geodatasets/get` on every load. There are two modes:

- **Static geodatasets**: fetched once as GeoJSON. Could be SW-cached but the plan doesn't mention `/api/geodatasets/get` in its caching strategy.
- **Dynamic extent geodatasets**: re-query the server on every pan/zoom with viewport bounds. Fundamentally incompatible with offline without pre-fetching the full dataset for the AOI.
- **Geodataset MVT**: served as vector tiles via `/api/geodatasets/get?type=mvt&x={x}&y={y}&z={z}`. Dynamically generated from PostGIS — not addressed by the tile cache.

The plan treats offline as a tiles + Draw mutations problem but ignores this entire data category. [7-cite-5](#7-cite-5)

### 7. Datasets (CSV tabular data) are unaddressed

Dataset links (`variables.datasetLinks`) lazy-load tabular data on feature click via `/api/datasets/get`. Offline, clicking any feature with dataset links will fail silently. The plan doesn't mention datasets at all.

### 8. WebSocket interaction with offline mode is unaddressed

MMGIS has WebSocket support (`ENABLE_MMGIS_WEBSOCKETS`) for real-time collaboration. The spec says _"No offline collaboration (one user offline at a time per file)"_ but neither document addresses:

- What happens to active WebSocket connections when going offline
- Whether the Draw tool's real-time collaboration conflicts with the offline queue
- How to enforce "one user offline at a time per file"
- Whether WebSocket reconnection on network restore could race with the sync queue drain [7-cite-6](#7-cite-6)

### 9. Cesium static assets must be excluded from SW precache

The webpack config copies 4 directories of Cesium assets (Workers, ThirdParty, Assets, Widgets) into the build output. These are large and will bloat the precache manifest if not explicitly excluded in the Workbox `InjectManifest` config. The plan doesn't mention this. [7-cite-7](#7-cite-7)

### 10. Vendored libraries in `src/index.js` inflate precache size

The app imports ~30 vendored libraries (Leaflet plugins, THREE.js, OpenSeadragon, etc.) from `src/external/`. These are bundled into the webpack output and will be part of the precache manifest. The plan doesn't estimate the total precache size or set a budget for the app shell. [7-cite-8](#7-cite-8)

### 11. Server-dependent tools are not addressed for offline degradation

Multiple tools make server-side API calls at runtime and will fail offline with no graceful degradation:

| Tool                   | Server Dependency                                   | Offline Feasibility          |
| ---------------------- | --------------------------------------------------- | ---------------------------- |
| **Measure** (profiles) | `api/utils/getprofile` — server-side GDAL           | Not possible                 |
| **Identifier**         | `api/utils/getbands` — server-side GDAL             | Not possible                 |
| **Shade**              | `api/utils/getbands` + `api/utils/ll2aerll` (SPICE) | Not possible                 |
| **Viewshed**           | Client-side DEM tile fetch via `PNG.load()`         | Possible if DEM tiles cached |
| **Isochrone**          | Client-side DEM/slope tile fetch                    | Possible if tiles cached     |

The plan should document which tools work offline, disable server-dependent tools with clear UI when offline, and optionally include DEM tile URLs in the Phase 2 AOI cache for tools that do client-side DEM processing.

### 12. Client-side DEM tile fetching bypasses Leaflet's tile pipeline

The Viewshed and Isochrone tools fetch DEM tiles via `PNG.load()` — a vendored PNG decoder that makes its own HTTP requests, not through Leaflet's tile layer. The SW tile interception from Phase 2 would need to also match these URLs, and `PNG.load()` would need to be able to find cached responses. This is not addressed. [7-cite-10](#7-cite-10)

### 13. Layer Tool advanced filters have two code paths — one breaks offline

- **`LocalFilterer`**: filters already-loaded GeoJSON client-side. Works offline.
- **`GeodatasetFilterer`**: encodes filters into URL params and triggers a server re-query. Fails offline.
- **`ESFilterer`**: queries Elasticsearch. Fails offline.
- **Draw Tool aggregations**: fetches from server for filter autocomplete. Fails offline.

The plan doesn't document which filter paths work offline or provide graceful degradation for server-dependent filtering.

### 14. WMS tiles use BBOX-based URLs, not z/x/y

WMS tiles construct URLs with bounding-box coordinates, not `{z}/{x}/{y}`. The `TileCacheManager`'s tile enumeration logic can't simply iterate z/x/y for WMS layers. The cache key canonicalizer would need to handle BBOX-based URLs differently. The plan lists WMS as a supported format but doesn't address this structural difference. [7-cite-11](#7-cite-11)

### 15. DEM tiles are 32×32 pixels — 64× more tiles per area

MMGIS supports 32×32 pixel DEM tiles (not just 256×256). If DEM/data layers are included in the AOI selector, the tile count explodes by a factor of 64. The plan doesn't distinguish between standard raster tiles and DEM tiles.

### 16. Sync queue error handling is incomplete

The existing `calls.js` error handler passes **no HTTP status code or response body** to the error callback — just `console.warn('error')`. The Phase 3 interceptor needs to parse the actual XHR response to distinguish 401/409/5xx, but the current error handler doesn't expose this. The interceptor will need to replace the error handler entirely. [7-cite-12](#7-cite-12)

### 17. Network failure recovery has multiple unaddressed edge cases

**After max retries**: The plan says "exponential backoff, max 10 attempts" for 5xx but doesn't define a terminal state. Items would be stuck — not in the conflict tray, not discarded, not retrying.

**Lost responses**: Server processes a request but the network drops before the client receives the 200. The plan adds `correlation_uuid` idempotency for `/add`, but `/edit`, `/remove`, `/merge`, and `/split` have no idempotency mechanism. Replaying these after a lost response could cause duplicates or errors.

**Dependent items**: If item 3 (`/add`) fails with 5xx and item 4 is an `/edit` of that same feature, item 4 will fail because the feature doesn't exist. The plan should pause the entire queue on any non-terminal failure, not just on 401.

**Network flapping**: If the network drops mid-drain, some items may have been sent but their responses lost. The plan doesn't specify whether the drain aborts immediately or continues trying remaining items.

### 18. Configure app needs changes — not just "out of scope"

The plan conflates "the configure app doesn't need to become a PWA" (correct) with "the configure app doesn't need any changes" (incorrect). Required changes include:

- **`config.json` files** for `OfflineTool` and `GPSPathTool` — without these, the tools are invisible in the configure page's Tools tab and admins can't enable or configure them.
- **Feature flag placement** — `mmgisglobal.options.offline` flags need to be settable somewhere (ENV, GeneralOptions, or mission config). The plan doesn't specify which.
- **GPS target Draw file** configuration in the GPSPathTool config.
- **Optional per-layer offline eligibility** fields in layer metaconfigs.

### 19. STAC/COG tile URL canonicalization complexity is understated

The `leaflet-tilelayer-middleware.js` constructs STAC/COG tile URLs with many optional parameters: `datetime`, `exitwhenfull`, `skipcovered`, `rescale`, `colormap_name`, `expression`, `items_limit`, `scan_limit`, `time_limit`, `bidx`, `resampling`. The `cacheKey.js` canonicalizer must handle all of these. The plan mentions this as a risk but doesn't enumerate the full parameter set. [7-cite-13](#7-cite-13)

### 20. COG tile URLs include deployment path — cache key must account for it

COG tiles are constructed with `window.location.origin` and `window.location.pathname` baked in. The cache key must account for the deployment path, and the SW's tile route matching must handle this proxied path pattern.

### 21. Time-dependent tile URLs are not addressed

The tile middleware injects `{time}`, `{starttime}`, `{endtime}`, and `{customtime.N}` into tile URLs. If a user changes the time slider while offline, the tile URLs change and won't match cached entries. The plan doesn't address whether time-dependent tiles should be cached at multiple time steps, or whether the time slider should be locked to the cached time range while offline. [7-cite-14](#7-cite-14)

### 22. TiTiler server load from bulk pre-caching

COG and STAC mosaic tiles are dynamically rendered by TiTiler, which runs with `WEB_CONCURRENCY=1`. Bulk-fetching 750+ tiles through TiTiler with a concurrency pool of 6 could saturate or crash the tile server. The plan mentions the concurrency pool but doesn't address server-side rate limiting or differentiated throttling for TiTiler-routed tiles.

---

## Medium: Minor Reference Errors

### 23. Line number off-by-one for `serviceWorker.unregister()`

The plan says `src/index.js:80`. The actual line is 79. [7-cite-15](#7-cite-15)

### 24. `Map_.js` line reference is misleading

The plan says _"Modify `Map_.js`(~1272–1452) — add`Map*.getActiveTileLayers()`."* Those lines are the `makeTileLayer()` function body. The plan is adding a _new_ method, not modifying code at those lines. [7-cite-16](#7-cite-16)

### 25. `leaflet.draw` is vendored, not an npm package

The plan references `leaflet.draw` as if it's a standard dependency. It's a vendored copy at `src/external/Leaflet/leaflet.draw`. For the AOI rectangle drawing in Phase 2, this works, but the plan should note this to avoid confusion. [7-cite-17](#7-cite-17)

### 26. `manifest.json` references non-existent icons

The current `manifest.json` references `logo192.png` and `logo512.png` which are CRA defaults. The plan says to replace the manifest but doesn't note that MMGIS-branded icons need to be created. [7-cite-18](#7-cite-18)

---

## Medium: Open Questions That Can Be Closed

### 27. Open Question #4 (attachments) can be answered definitively

`DrawTool_Templater.js` does **not** support photo/file attachments. The supported template types are: `checkbox`, `number`, `text`, `textarea`, `range`/`slider`, `dropdown`, `date`, `incrementer`, `point`. No `file`, `image`, or `attachment` type exists. This should be moved from "open question" to "confirmed: not supported, defer to follow-up." [7-cite-19](#7-cite-19)

### 28. Open Question #3 (CSRF refresh) can be partially answered

`RefreshAuth.js` is CSSO-only. For local auth, the session cookie is the only auth state — there is no CSRF token mechanism. The question should be reframed as: "For CSSO deployments, does the SSO token need refreshing before each drain? For local auth, does the session cookie expire during a 1–2 day offline window?" [7-cite-20](#7-cite-20)

---

## Summary Table

| #     | Category                                         | Severity | Phase Affected |
| ----- | ------------------------------------------------ | -------- | -------------- |
| 1     | `extant_start`/`extant_end` don't exist in model | Critical | P3             |
| 2     | No `<link rel="manifest">` in index.html         | Critical | P1             |
| 3     | `RefreshAuth.js` is CSSO-only                    | Critical | P3             |
| 4     | `api()` already exists — mischaracterized        | Medium   | P3             |
| 5     | Mission config not explicitly pre-cached         | Critical | P2             |
| 6     | Geodatasets unaddressed                          | Critical | P2             |
| 7     | Datasets unaddressed                             | Medium   | P2             |
| 8     | WebSocket interaction unaddressed                | Critical | P3             |
| 9     | Cesium assets bloat precache                     | Medium   | P1             |
| 10    | Vendored libraries inflate precache              | Medium   | P1             |
| 11    | Server-dependent tools not degraded              | Critical | P1–P4          |
| 12    | DEM tile fetch bypasses Leaflet pipeline         | Medium   | P2/P4          |
| 13    | Filter paths partially break offline             | Medium   | P2             |
| 14    | WMS tiles use BBOX, not z/x/y                    | Medium   | P2             |
| 15    | 32px DEM tiles explode tile count                | Medium   | P2             |
| 16    | Error handler exposes no HTTP status             | Medium   | P3             |
| 17    | Sync queue recovery edge cases                   | Critical | P3             |
| 18    | Configure app needs tool configs                 | Critical | P1–P4          |
| 19    | STAC/COG URL canonicalization understated        | Medium   | P2             |
| 20    | COG URLs include deployment path                 | Medium   | P2             |
| 21    | Time-dependent tile URLs unaddressed             | Medium   | P2             |
| 22    | TiTiler server load from bulk caching            | Medium   | P2             |
| 23–26 | Minor reference errors                           | Low      | Various        |
| 27–28 | Closeable open questions                         | Low      | P3             |

**Totals**: 8 Critical, 14 Medium, 6 Low across 28 distinct deficiencies.

---

## Recommended Actions Before Implementation

1. **Verify and add `extant_start`/`extant_end`** to the `user_features` Sequelize model via a migration, or redesign conflict detection around a version counter. This is a P3 blocker.
2. **Add an "Offline Data Scope" section** to the plan categorizing every data source (config, geodatasets, datasets, tiles, Draw files) with its offline strategy or explicit "out of scope with graceful degradation."
3. **Add a "Tool Availability Matrix"** documenting which tools work offline, which degrade, and which are disabled.
4. **Close Open Questions #3 and #4** — the answers are in the codebase.
5. **Add Cesium asset exclusion** to Phase 1's Workbox config and estimate total precache size.
6. **Address WebSocket state** during offline periods and on reconnection.
7. **Add idempotency to `/edit`, `/remove`, `/merge`, `/split`** — not just `/add`.
8. **Create `config.json` files** for `OfflineTool` and `GPSPathTool` and decide feature flag placement.
9. **Decide time-dependent tile caching strategy** — lock time slider offline, or cache multiple time steps.
10. **Add server-side throttling** for TiTiler-routed bulk tile requests.

---

# Is a PWA the right choice?

A PWA is a defensible choice for Phases 1–3, but it's the wrong tool for Phase 4 (GPS tracking), and the plan significantly understates how much of MMGIS's value evaporates offline regardless of approach. Here's the full analysis:

## The Core Problem: What Actually Works Offline?

Before evaluating the delivery mechanism, consider what MMGIS can actually do without its server:

| Capability                        | Server Dependency     | Offline?          |
| --------------------------------- | --------------------- | ----------------- |
| View pre-cached raster tiles      | None (if cached)      | Yes               |
| Draw features with form data      | Write queue           | Yes (deferred)    |
| Record GPS path                   | None                  | Yes               |
| Elevation profiles (Measure)      | GDAL on server        | No                |
| Raster value queries (Identifier) | GDAL / TiTiler        | No                |
| Viewshed computation              | Client-side DEM tiles | Maybe (if cached) |
| Shade / sun position              | SPICE on server       | No                |
| Geodataset queries                | PostGIS               | No                |
| Dataset links (on-click)          | Express API           | No                |
| Geodataset filtering              | PostGIS               | No                |
| 3D Globe (Cesium)                 | Terrain server        | No                |
| STAC catalog browsing             | STAC API              | No                |

The offline feature set reduces to: **view a cached map, take notes on it, and record where you walked**. That's a legitimate field workflow, but it's a thin slice of MMGIS. The question is whether the complexity of retrofitting a full PWA onto a 100+ dependency SPA is proportionate to that slice.

## PWA Limitations Specific to MMGIS

### 1. The app shell is too heavy to precache

The `src/index.js` entry point eagerly imports vendored THREE.js (14 modules), OpenSeadragon (3 modules), ~20 Leaflet plugins, jQuery, React 18, and more — all before the app even renders: [8-cite-0](#8-cite-0)

On top of that, webpack copies **four directories** of Cesium static assets (Workers, ThirdParty, Assets, Widgets) into the build output. Cesium's static assets alone are typically 30–50 MB: [8-cite-1](#8-cite-1)

A Workbox `InjectManifest` precache of the full MMGIS shell — JS chunks, CSS, Cesium assets, fonts, images — will likely exceed **60–80 MB**. On iOS, where PWA storage can be evicted after ~7 days of non-use, this is a significant concern. The plan doesn't estimate total precache size anywhere.

### 2. Background GPS tracking doesn't work on iOS

This is the most critical issue. The plan's Phase 4 proposes `navigator.geolocation.watchPosition()` for GPS path capture. On iOS:

- **Screen lock** → `watchPosition` callbacks stop firing
- **App backgrounded** (user switches to another app) → callbacks stop
- **Wake Lock API** → not supported on iOS Safari / WKWebView
- **Page Visibility API** → the plan says "pause + visible 'paused' UI" but this means the GPS track has gaps every time the user checks a text message

The plan's risk register lists this as "Cert. / Med" with mitigation "Document; advise device sleep-disable; show banner." That's not a mitigation — it's telling field scientists they can never lock their screen or switch apps during a multi-hour traverse. For a tool targeting iPad/iPhone field use, this is a fundamental capability gap. [8-cite-2](#8-cite-2)

### 3. iOS Safari PWA storage is unreliable

- `navigator.storage.estimate()` returns inflated/inaccurate values on iOS
- No `navigator.storage.persist()` support in iOS PWAs — storage is always "best effort"
- Standalone PWAs on iOS use WKWebView, which has different storage behavior than Safari tabs
- After ~7 days of non-use, iOS can evict all PWA storage (Cache API + IDB)

For a "1–2 day field shift" use case, the 7-day eviction window is probably fine. But if a user installs the PWA, pre-caches tiles on Monday, and doesn't go to the field until the following Monday, their cache may be gone.

### 4. No Background Sync API on iOS

The plan's Phase 3 sync queue relies on detecting `online` events and draining the queue. On Android, the Background Sync API can drain the queue even when the app isn't open. On iOS, there is no Background Sync — the queue only drains when the user has the app open and in the foreground. This is workable but means the user must manually open the app after returning to connectivity.

## Alternatives

### Option A: Capacitor wrapper

[Capacitor](https://capacitorjs.com/) wraps the existing web app in a native iOS/Android shell. It reuses 99% of the codebase and adds native plugin access:

| Capability             | PWA            | Capacitor                     |
| ---------------------- | -------------- | ----------------------------- |
| Background GPS         | No (iOS)       | Yes (native plugin)           |
| Storage eviction       | Yes (iOS, ~7d) | No (native filesystem)        |
| Background Sync        | No (iOS)       | Yes (native background fetch) |
| App Store distribution | No             | Yes (optional)                |
| `beforeinstallprompt`  | No (iOS)       | N/A (native install)          |
| Wake Lock              | No (iOS)       | Yes (native)                  |
| Build complexity       | Low            | Medium (Xcode/Android Studio) |
| Desktop support        | Yes            | No (separate Electron needed) |

Capacitor solves the GPS problem definitively. The `capacitor-background-geolocation` plugin provides continuous tracking even with the screen locked. Storage is native and not subject to browser eviction.

**Downside**: Requires Xcode and Android Studio in the build pipeline, app store review (or enterprise distribution), and a team member who can troubleshoot native build issues. For a NASA/JPL internal tool, enterprise distribution (no App Store review) is likely available.

### Option B: Lightweight companion PWA

Instead of retrofitting the full MMGIS SPA for offline use, build a **separate, lightweight field data collection PWA** that:

- Has its own minimal UI (map viewer + form + GPS)
- Precaches only what it needs (~2 MB shell, not 60+ MB)
- Syncs collected data back to the main MMGIS instance via API
- Doesn't try to replicate MMGIS's full tool suite offline

This sidesteps the precache size problem, the Cesium asset problem, the tool degradation problem, and the configure-app-needs-updates problem. The GPS limitation on iOS remains, but the app is small enough that Capacitor wrapping is trivial if needed later.

### Option C: PWA for Phases 1–3, defer Phase 4

Accept that GPS tracking in a PWA is foreground-only on iOS. Ship Phases 1–3 as a PWA. For Phase 4, either:

- Accept the foreground-only limitation and document it
- Add Capacitor later specifically for GPS-heavy field deployments
- Build GPS capture as a separate native/Capacitor micro-app

## Recommendation

**A PWA is the right strategy for Phases 1–3 if and only if:**

1. The precache is scoped aggressively (exclude Cesium assets, exclude vendored THREE.js modules, use runtime caching for non-critical chunks)
2. The plan acknowledges that most tools are disabled offline and provides clear degradation UI
3. iOS storage limitations are accepted as a known constraint

**A PWA is the wrong strategy for Phase 4 (GPS tracking) on iOS.** The plan should either:

- Scope Phase 4 to Android-only and desktop (where Wake Lock and background tabs work better)
- Use Capacitor for Phase 4's mobile delivery
- Accept foreground-only GPS and document the limitation honestly (not as "advise device sleep-disable")

**The plan should also seriously consider Option B** — a lightweight companion app for field collection. The full MMGIS SPA was never designed for offline use, and the number of deficiencies identified in our review (28 issues, 8 critical) reflects the fundamental mismatch between "make this desktop GIS app work offline" and "build a field data collection tool." A purpose-built companion app would be simpler, more reliable, and easier to maintain.
