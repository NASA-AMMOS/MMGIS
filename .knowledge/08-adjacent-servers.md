# Adjacent Servers

MMGIS v4.0.0+ supports adjacent services that are proxied through the main MMGIS server:

| Service | Purpose | Port | URL |
|---------|---------|------|-----|
| [stac-fastapi](https://github.com/stac-utils/stac-fastapi) | STAC Catalogs | 8881 | `/stac` |
| [tipg](https://github.com/developmentseed/tipg) | TiPG Vector Tiles | 8882 | `/tipg` |
| [titiler](https://github.com/developmentseed/titiler) | Dynamic Tile Serving | 8883 | `/titiler` |
| [titiler-pgstac](https://github.com/stac-utils/titiler-pgstac) | TiTiler Mosaicking | 8884 | `/titilerpgstac` |
| [veloserver](https://github.com/NASA-AMMOS/Veloserver) | Velocity/Wind Data | 8104 | `/veloserver` |

All services are proxied through MMGIS. Write endpoints are locked behind authentication.

## Setup

### With Docker

Fill out `POSTGRES_*` environment variables in `docker-compose.yml`. Unused services can be removed.

### Without Docker

1. Requires Python >=3.10 to <3.13
2. Install dependencies: `python -m pip install -r python-requirements.txt`
3. Copy `.env.example` to `.env` in each adjacent server directory under `/adjacent-servers/`
4. Set `PROJ_LIB` to your proj installation

### Enable in MMGIS

Set these ENVs in `.env`:

```bash
WITH_STAC=true
WITH_TIPG=true
WITH_TITILER=true
WITH_TITILER_PGSTAC=true
WITH_VELOSERVER=true
```

## TiTiler SSRF Protection

The TiTiler proxy accepts a `?url=` parameter. Without validation, this can be exploited for SSRF attacks.

**Mitigation**: Configure `TITILER_ALLOWED_URL_PATTERNS` with trusted URL patterns.

Recommended for production:
```bash
TITILER_ALLOWED_URL_PATTERNS='["^https://(?!.*\\.\\.)(?!.*\\x00).*$", "^/Missions/(?!.*\\.\\.).*$"]'
```

This requires HTTPS for remote URLs and allows local `/Missions` directory files while blocking path traversal.

## Custom Adjacent Servers

Add custom proxy endpoints without modifying core code:

```bash
ADJACENT_SERVER_CUSTOM_0=["true", "route_name", "service_name", "port"]
```
