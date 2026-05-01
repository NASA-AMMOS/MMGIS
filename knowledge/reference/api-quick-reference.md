# API Quick Reference

## REST Endpoints

### Users (`/api/users/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/login` | — | User login |
| POST | `/api/users/signup` | — | User registration |
| POST | `/api/users/first_signup` | — | First admin signup (empty DB only) |
| GET | `/api/users/logged_in` | — | Check login status |
| POST | `/api/users/logout` | Session | User logout |

### Configure (`/api/configure/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/configure/get` | Public | Get mission config |
| GET | `/api/configure/missions` | Public | List missions |
| POST | `/api/configure/add` | Admin | Create mission |
| POST | `/api/configure/save` | Admin | Save mission config |
| POST | `/api/configure/remove` | Admin | Delete mission |

### Draw (`/api/draw/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/draw/add` | Session | Add feature |
| POST | `/api/draw/edit` | Session | Edit feature |
| POST | `/api/draw/remove` | Session | Remove feature |
| POST | `/api/draw/undo` | Session | Undo action |
| POST | `/api/draw/merge` | Session | Merge features |
| POST | `/api/draw/split` | Session | Split feature |

### Files (`/api/files/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/files/getfiles` | Session | List files |
| POST | `/api/files/getfile` | Session | Get file |
| POST | `/api/files/make` | Session | Create file |
| POST | `/api/files/remove` | Session | Delete file |
| POST | `/api/files/restore` | Session | Restore file |
| POST | `/api/files/change` | Session | Modify file |
| POST | `/api/files/modifykeyword` | Session | Modify keyword |
| GET | `/api/files/compile` | Session | Compile file |
| POST | `/api/files/publish` | Lead | Publish file |
| POST | `/api/files/gethistory` | Session | Get file history |

### Datasets (`/api/datasets/`, `/api/geodatasets/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/datasets/get` | Public | Get dataset |
| POST | `/api/geodatasets/get` | Public | Get geodataset |
| POST | `/api/geodatasets/search` | Public | Spatial search |

### Utilities (`/api/utils/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/utils/getbands` | Session | Get raster bands |
| POST | `/api/utils/getprofile` | Session | Get elevation profile |
| GET | `/api/utils/queryTilesetTimes` | Session | Query tileset times |

### URL Shortener (`/api/shortener/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/shortener/shorten` | Session | Create short link |
| POST | `/api/shortener/expand` | — | Expand short link |

## Adjacent Service Proxies

| Path | Service | Write Auth |
|------|---------|-----------|
| `/stac` | STAC Catalogs | Yes |
| `/tipg` | TiPG Vectors | Yes |
| `/titiler` | TiTiler Tiles | No |
| `/titilerpgstac` | TiTiler-PgSTAC | No |
| `/veloserver` | Veloserver | No |

## WebSocket

WebSocket endpoint connects at `ws://{host}{ROOT_PATH}/`.

Message format:
```json
{
  "type": "draw|config|...",
  "room": "mission_name",
  "payload": {}
}
```

Authentication required. Invalid sessions are rejected.
