# Infrastructure and CI/CD

## GitHub Actions

MMGIS uses GitHub Actions for continuous integration. Key CI checks:

| Check | Description |
|-------|-------------|
| `test (local)` | Run tests with `AUTH=local` |
| `test (off)` | Run tests with `AUTH=off` |
| `secret-detection` | Scan for leaked secrets |
| `generate-tags` | Generate version tags |
| `bump-version` | Bump version number |

> **Note**: `build-arm64` and `build-amd64` Docker image build failures are pre-existing and not your responsibility.

## Docker Deployment

### Building

```bash
docker build -t mmgis .
```

### Running

```bash
docker-compose up -d
```

### docker-compose Services

The `docker-compose.sample.yml` defines:
- **mmgis**: Main application
- **db**: PostgreSQL with PostGIS
- **stac**: STAC catalog (optional)
- **titiler**: Dynamic tile serving (optional)
- **titiler-pgstac**: TiTiler mosaicking (optional)
- **veloserver**: Velocity data (optional)

### Production

```bash
npm run build                    # Build frontend
npm run start:prod              # Start production server
npm run start:prod-docker       # Start in Docker
```

### Monitoring

```bash
docker-compose logs -f mmgis    # View logs
docker-compose ps               # Check service status
docker-compose down             # Stop services
```

## Environment Modes

| `NODE_ENV` | Behavior |
|------------|----------|
| `development` | Hot-reloading via webpack-dev-server on PORT+1, configure/docs links on landing page |
| `production` | Static file serving, requires `npm run build` first |

## Mission Data Storage

Mission data is stored in the `Missions/` directory:
- Each mission has its own subdirectory
- Contains JSON config, layer data, uploaded files
- In Docker, mount this directory as a volume for persistence

## Blueprints

`/blueprints/Missions/Reference-Mission/` is the source blueprint for the demo mission. Site Admins can create a working Reference Mission from this blueprint via the Configure page.

```bash
FORCE_CONFIG_PATH=Missions/Reference-Mission/config.reference-mission.json npm start
```
