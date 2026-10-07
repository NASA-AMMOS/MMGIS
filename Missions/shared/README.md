# Missions/shared

Data shared across missions (common basemaps, DEMs, catalogs, etc.).

- Not a mission: `shared` is a reserved name and cannot be used as a mission name.
- With `AUTH=local`, files under `/Missions/shared/` are readable by any authenticated user (logged-in session or valid long-term token), regardless of `missions_viewing`. Guests are denied.
- Reference these files from any mission's config, e.g. `../shared/Layers/basemap/{z}/{x}/{y}.png`.
- Contents other than this README are gitignored.
