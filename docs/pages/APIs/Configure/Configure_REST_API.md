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

Gets a list of all configured missions. _Auth token not needed._

| Parameter |   Type    | Required | Default |                                 Description                                 |
| :-------: | :-------: | :------: | :-----: | :-------------------------------------------------------------------------: |
| **full**  | _boolean_ |  false   |   N/A   | If true, returns versions and configuration objects alongside mission names |

#### Example

`curl -X GET http://localhost:8889/api/configure/missions`

```javascript
=> {status: "success", missions: ["Mission1", "Mission2"]}
```

`curl -X GET http://localhost:8889/api/configure/missions?full=true`

```javascript
=> {
  status: "success",
  missions: [
    {
      mission: "name", version: 99, config: {}
    },
    ...
  ]
}
```

---

### GET /versions

Gets a list of available versions of a mission's configuration object.

#### Example

`curl -X GET -H "Authorization:Bearer <token>" http://localhost:8889/api/configure/versions?mission=Test`

---

### GET /get

Gets a mission's configuration object. _Auth token not needed._

|  Parameter  |   Type    | Required | Default |              Description              |
| :---------: | :-------: | :------: | :-----: | :-----------------------------------: |
| **mission** | _string_  |   true   |   N/A   |             Mission name              |
| **version** | _number_  |  false   | latest  |       Version of configuration        |
|  **full**   | _boolean_ |  false   |  false  | Return additional metadata and status |

#### Example

`curl -X GET http://localhost:8889/api/configure/get?mission=Test`

---

### POST /validate

Validates a configuration object and performs no other action.

| Parameter  |   Type   | Required | Default |        Description        |
| :--------: | :------: | :------: | :-----: | :-----------------------: |
| **config** | _object_ |  false   |   N/A   | Full configuration object |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"config":{}}' http://localhost:8889/api/configure/validate`

---

### POST /upsert

Sets a mission's configuration object. Only complete configuration objects are acceptable and it must pass the internal validation of this endpoint to successfully be upserted. _If an easier-to-use method is desired for updated a mission's configuration object, see the other endpoints below._

|  Parameter  |   Type   | Required | Default |                        Description                        |
| :---------: | :------: | :------: | :-----: | :-------------------------------------------------------: |
| **mission** | _string_ |   true   |   N/A   |                       Mission name                        |
| **config**  | _object_ |  false   |   N/A   |                 Full configuration object                 |
| **version** | _number_ |  false   |   N/A   | Set a configuration version number to rollback to instead |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"mission":"Test", "config":{}}' http://localhost:8889/api/configure/upsert`

---

### POST /addLayer

Adds a single layer to a mission's configuration object. A wrapping helper to `upsert`.

|       Parameter       |        Type         | Required | Default |                                                                  Description                                                                  |
| :-------------------: | :-----------------: | :------: | :-----: | :-------------------------------------------------------------------------------------------------------------------------------------------: |
|      **mission**      |      _string_       |   true   |   N/A   |                                                                 Mission name                                                                  |
|       **layer**       | _object_ or _array_ |   true   |   N/A   | Full new layer configuration object or array of full new layer configuration objects. See browser console-network tab responses for examples. |
|  **placement.path**   |      _string_       |  false   |   ''    |              A path to a header in 'layers' to place the new layer. A simple path ('sublayers' are added). Defaults to no group               |
|  **placement.index**  |      _number_       |  false   |   end   |                       Index in 'layers' (or path) to place the new layer. Out of range placement indices are best fit.                        |
| **forceClientUpdate** |      _boolean_      |  false   |  false  |                                                        Push the change out to clients.                                                        |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"mission":"Test", "layer":{"name":"", "type":""}}' http://localhost:8889/api/configure/addLayer`

---

### POST /updateLayer

Updates a single layer. Specified layer values are deep merged and overwrite existing values. Layers can be renamed and repositioned.

|       Parameter       |   Type    | Required | Default |                                                    Description                                                     |
| :-------------------: | :-------: | :------: | :-----: | :----------------------------------------------------------------------------------------------------------------: |
|      **mission**      | _string_  |   true   |   N/A   |                                                    Mission name                                                    |
|     **layerUUID**     | _string_  |   true   |   N/A   |                                                  Layer to update                                                   |
|       **layer**       | _object_  |   true   |   N/A   |           A partial layer configuration object. See browser console-network tab responses for examples.            |
|  **placement.path**   | _string_  |  false   |   ''    | A path to a header in 'layers' to place the new layer. A simple path ('sublayers' are added). Defaults to no group |
|  **placement.index**  | _number_  |  false   |   end   |          Index in 'layers' (or path) to place the new layer. Out of range placement indices are best fit.          |
| **forceClientUpdate** | _boolean_ |  false   |  false  |                                          Push the change out to clients.                                           |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"mission":"Test", "layerUUID":"uuid", "layer":{}}' http://localhost:8889/api/configure/updateLayer`

---

### POST /removeLayer

Removes a single layer from the configuration object.

|       Parameter       |        Type         | Required | Default |                           Description                            |
| :-------------------: | :-----------------: | :------: | :-----: | :--------------------------------------------------------------: |
|      **mission**      |      _string_       |   true   |   N/A   |                           Mission name                           |
|     **layerUUID**     | _string_ or _array_ |   true   |   N/A   | Layer to remove as string or array of layers as string to remove |
| **forceClientUpdate** |      _boolean_      |  false   |  false  |                 Push the change out to clients.                  |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"mission":"Test", "layerUUID":"name"}' http://localhost:8889/api/configure/removeLayer`

---

### POST /updateInitialView

Updates the initial latitude, longitude, zoom of the map when users first arrive to the site.

|   Parameter   |   Type   | Required | Default  |           Description           |
| :-----------: | :------: | :------: | :------: | :-----------------------------: |
|  **mission**  | _string_ |   true   |   N/A    |          Mission name           |
| **latitude**  | _number_ |  false   | existing | Map latitude center coordinate  |
| **longitude** | _number_ |  false   | existing | Map Longitude center coordinate |
|   **zoom**    | _number_ |  false   | existing |         Map zoom level          |

#### Example

`curl -X POST -H "Authorization:Bearer <token>" -H "Content-Type: application/json" -d '{"mission":"Test", "zoom":12}' http://localhost:8889/api/configure/updateInitialView`

---

### Discouraged

While `/add`, `/clone` and `/destroy` (for adding and removing missions) are also available configuration endpoints, it's recommended that these be done manually.
