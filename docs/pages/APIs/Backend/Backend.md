---
layout: page
title: Backend API
permalink: /apis/backend
has_children: false
nav_order: 4
parent: APIs
---

An incomplete list of supported backend endpoints. See more in [Configure REST API](/MMGIS/apis/configure).

## Users Endpoints

### POST /api/users/login

### POST /api/users/signup

---

### GET /api/users/logged_in

Checks whether a user is currently logged in to the current client's session. Uses cookie token.

#### Parameters

_NONE_

#### Returns

##### If logged in _(200)_:

```javascript
{
    status: "success",
    message: `'{user}' is logged in to this session.`,
    body: {
        loggedIn: true,
        user: `{user}`
    }
}
```

##### If **not** logged in _(200)_:

```javascript
{
    status: "failure",
    message: `No user is logged in to this session.`,
    body: {
        loggedIn: false,
        user: null
    }
}
```

---

### POST /api/users/logout

## Utility Endpoints

### POST /api/utils/getbands

### POST /api/utils/getprofile

### GET /api/utils/queryTilesetTimes

## Draw Endpoints

### POST /api/draw/add

### POST /api/draw/edit

### POST /api/draw/remove

### POST /api/draw/undo

### POST /api/draw/merge

### POST /api/draw/split

## Files Endpoints

### POST /api/files/getfiles

### POST /api/files/getfile

### POST /api/files/make

### POST /api/files/remove

### POST /api/files/restore

### POST /api/files/change

### POST /api/files/modifykeyword

### GET /api/files/compile

### POST /api/files/publish

### POST /api/files/gethistory

## URL Shortener Endpoints

### POST /api/shortener/shorten

### POST /api/shortener/expand

## Geo/Datasets Endpoints

### POST /api/datasets/get

### POST /api/geodatasets/get

### POST /api/geodatasets/search
