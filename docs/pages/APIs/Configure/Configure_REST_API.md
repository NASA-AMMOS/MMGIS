---
layout: page
title: Configure REST API
permalink: /apis/configure
parent: APIs
---

# Configure REST API

Enables programmatic control over configuration endpoints.

### Root path: `/api/configure`

#### _Contents_

- [API Tokens](#api-tokens)
- [Endpoints](#endpoints)
  - [GET /missions](#get-missions)
  - [GET /versions](#get-versions)
  - [GET /get](#get-get)
  - [POST /validate](#post-validate)
  - [POST /upsert](#post-upsert)
  - [POST /addLayer](#post-addlayer)
  - [POST /updateLayer](#post-updatelayer)
  - [POST /removeLayer](#post-removelayer)
  - [POST /updateInitialView](#post-updateinitialview)

---

## API Tokens

To use the Configure API through HTTP requests, an API Token must be used for authentication.

1. Login to the configuration page `/configure`
2. Navigate to the "API Tokens" page
3. Set a name and expiration time if desired and click "Generate New Token"
4. Copy the newly generated token (you will not see it in full again)
5. When interacting with the Configure API, use the header `Authorization:Bearer <token>`

---

## Endpoints

### GET /missions

Gets a list of all configured missions.

#### Examples

`curl -X GET http://localhost:8889/api/configure/missions`

---

### GET /versions

Gets a list of available versions of a mission's configuration object.

#### Examples

`curl -X GET http://localhost:8889/api/configure/versions?mission=Test`

---

### GET /get

Gets a mission's configuration object. _Auth token not needed._

|  Parameter  |   Type    | Required | Default |              Description              |
| :---------: | :-------: | :------: | :-----: | :-----------------------------------: |
| **mission** | _string_  |   true   |   N/A   |             Mission name              |
| **version** | _number_  |  false   | latest  |       Version of configuration        |
|  **full**   | _boolean_ |  false   |  false  | Return additional metadata and status |

#### Examples

`curl -X GET http://localhost:8889/api/configure/get?mission=Test`

---

### POST /validate

Validates a configuration object and performs no action if valid.

| Parameter  |   Type   | Required | Default |        Description        |
| :--------: | :------: | :------: | :-----: | :-----------------------: |
| **config** | _object_ |  false   |   N/A   | Full configuration object |

#### Examples

`curl -X POST http://localhost:8889/api/configure/validate`

---

### POST /upsert

Sets a mission's configuration object. Only complete configuration objects are acceptable and it must pass the internal validation of this endpoint to successfully be upserted. _If an easier-to-use method is desired for updated a mission's configuration object, see the other endpoints below._

|  Parameter  |   Type   | Required | Default |                        Description                        |
| :---------: | :------: | :------: | :-----: | :-------------------------------------------------------: |
| **mission** | _string_ |   true   |   N/A   |                       Mission name                        |
| **config**  | _object_ |  false   |   N/A   |                 Full configuration object                 |
| **version** | _number_ |  false   |   N/A   | Set a configuration version number to rollback to instead |

#### Examples

`curl -X POST -H "Authorization:Bearer <token>" http://localhost:8889/api/configure/upsert`

---

### POST /addLayer

Adds a single layer to a mission's configuration object. A wrapping helper to `upsert`.

|      Parameter      |   Type   | Required | Default |                                                    Description                                                     |
| :-----------------: | :------: | :------: | :-----: | :----------------------------------------------------------------------------------------------------------------: |
|     **mission**     | _string_ |   true   |   N/A   |                                                    Mission name                                                    |
|      **layer**      | _object_ |   true   |   N/A   |            Full new layer configuration object. See browser console-network tab responses for examples.            |
| **placement.path**  | _string_ |  false   |   ''    | A path to a header in 'layers' to place the new layer. A simple path ('sublayers' are added). Defaults to no group |
| **placement.index** | _number_ |  false   |   end   |          Index in 'layers' (or path) to place the new layer. Out of range placement indices are best fit.          |
|  **notifyClients**  | _number_ |  false   |  false  |                             Set a configuration version number to rollback to instead                              |

#### Examples

`curl -X POST -H "Authorization:Bearer <token>" http://localhost:8889/api/configure/addLayer`

---

### POST /updateLayer

Adds a single layer to a mission's configuration object. A wrapping helper to `upsert`.

|  Parameter  |   Type   | Required | Default | Description  |
| :---------: | :------: | :------: | :-----: | :----------: |
| **mission** | _string_ |   true   |   N/A   | Mission name |

#### Examples

`curl -X POST -H "Authorization:Bearer <token>" http://localhost:8889/api/configure/updateLayer`

---

### POST /removeLayer

Adds a single layer to a mission's configuration object. A wrapping helper to `upsert`.

|  Parameter  |   Type   | Required | Default | Description  |
| :---------: | :------: | :------: | :-----: | :----------: |
| **mission** | _string_ |   true   |   N/A   | Mission name |

#### Examples

`curl -X POST -H "Authorization:Bearer <token>" http://localhost:8889/api/configure/removeLayer`

---

### POST /updateInitialView

Adds a single layer to a mission's configuration object. A wrapping helper to `upsert`.

|  Parameter  |   Type   | Required | Default | Description  |
| :---------: | :------: | :------: | :-----: | :----------: |
| **mission** | _string_ |   true   |   N/A   | Mission name |

#### Examples

`curl -X POST -H "Authorization:Bearer <token>" http://localhost:8889/api/configure/updateInitialView`

---

### Discouraged

While `/add`, `/clone` and `/destroy` (for adding and removing missions) are also available configuration endpoints, it's recommended that these be done manually.
