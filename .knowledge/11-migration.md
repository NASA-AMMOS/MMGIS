# Migration Guide

## v3 to v4

Major changes in MMGIS v4:

- New layer types and configuration options
- Updated database schema with migration support
- Adjacent server integration (STAC, TiTiler, TiPG, Veloserver)
- Enhanced time controls and temporal layer support
- Plugin system for custom tools, backends, and components

See `docs/pages/Migration/v3-to-v4/v3-to-v4.md` for the complete migration guide.

## Database Migrations

Schema migrations are handled automatically via `up()` functions in model files. These run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on server startup.

Model files with migrations:
- `API/Backend/Draw/models/userfiles.js`
- `API/Backend/Users/models/user.js`
- `API/Backend/Geodatasets/models/geodatasets.js`

**Note**: Some async migrations may not be awaited, creating race conditions. Always run migrations before depending on new columns.
