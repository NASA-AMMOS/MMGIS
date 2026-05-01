# API Overview

MMGIS exposes REST and WebSocket APIs for data access and real-time collaboration.

## Backend API Endpoints

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/login` | User login |
| POST | `/api/users/signup` | User registration |
| GET | `/api/users/logged_in` | Check login status |
| POST | `/api/users/logout` | User logout |

### Draw Tool

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/draw/add` | Add a feature |
| POST | `/api/draw/edit` | Edit a feature |
| POST | `/api/draw/remove` | Remove a feature |
| POST | `/api/draw/undo` | Undo last action |
| POST | `/api/draw/merge` | Merge features |
| POST | `/api/draw/split` | Split a feature |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/getfiles` | List files |
| POST | `/api/files/getfile` | Get single file |
| POST | `/api/files/make` | Create file |
| POST | `/api/files/remove` | Delete file |
| POST | `/api/files/change` | Modify file |
| POST | `/api/files/publish` | Publish file |
| POST | `/api/files/gethistory` | Get file history |

### Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/utils/getbands` | Get raster bands |
| POST | `/api/utils/getprofile` | Get elevation profile |
| GET | `/api/utils/queryTilesetTimes` | Query time-enabled tileset |

### Geo/Datasets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/datasets/get` | Get dataset |
| POST | `/api/geodatasets/get` | Get geodataset |
| POST | `/api/geodatasets/search` | Spatial search geodataset |

### URL Shortener

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shortener/shorten` | Create short link |
| POST | `/api/shortener/expand` | Expand short link |

## Configure REST API

Admin-only endpoints under `/api/configure/*`. Restricted to Site Admins (session permission "111" or "110").

Whitelisted read-only endpoints (accessible to all):
- `GET /api/configure/get`
- `GET /api/configure/missions`
- `GET /api/geodatasets/get`
- `GET /api/geodatasets/search`

All other `/api/configure/*` endpoints require admin authentication, even when `AUTH=off`.

See `docs/pages/APIs/Configure/Configure_REST_API.md` for the full reference.

## JavaScript API

MMGIS exposes a client-side JavaScript API (`mmgisAPI`) for programmatic interaction:
- Layer control
- Map navigation
- Tool activation
- Event handling
- Deep linking

See `docs/pages/APIs/JavaScript/` for the full API documentation.

## Adjacent Service Endpoints

When enabled, adjacent services are proxied through MMGIS:

| Endpoint | Service |
|----------|---------|
| `/stac` | STAC Catalogs |
| `/tipg` | TiPG Vector Tiles |
| `/titiler` | TiTiler Dynamic Tiles |
| `/titilerpgstac` | TiTiler-PgSTAC Mosaicking |
| `/veloserver` | Veloserver Velocity Data |

Write endpoints on adjacent services are locked behind MMGIS authentication.
