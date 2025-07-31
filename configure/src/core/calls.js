let domain =
  window.mmgisglobal.NODE_ENV === "development"
    ? "http://localhost:8888/"
    : window.mmgisglobal.ROOT_PATH || "";
if (domain.length > 0 && !domain.endsWith("/")) domain += "/";

const c = {
  missionPath: "Missions/",
  logout: {
    type: "POST",
    url: "api/users/logout",
  },
  getToolConfig: {
    type: "GET",
    url: "configure/public/toolConfigs.json",
  },
  get: {
    type: "GET",
    url: "api/configure/get",
  },
  add: {
    type: "POST",
    url: "api/configure/add",
  },
  upsert: {
    type: "POST",
    url: "api/configure/upsert",
  },
  clone: {
    type: "POST",
    url: "api/configure/clone",
  },
  rename: {
    type: "POST",
    url: "api/configure/rename",
  },
  destroy: {
    type: "POST",
    url: "api/configure/destroy",
  },
  missions: {
    type: "GET",
    url: "api/configure/missions",
  },
  user_permissions: {
    type: "GET",
    url: "api/configure/user-permissions",
  },
  versions: {
    type: "GET",
    url: "api/configure/versions",
  },
  get_generaloptions: {
    type: "GET",
    url: "api/configure/getGeneralOptions",
  },
  update_generaloptions: {
    type: "POST",
    url: "api/configure/updateGeneralOptions",
  },
  geodatasets_recreate: {
    type: "POST",
    url: "api/geodatasets/recreate",
  },
  geodatasets_append: {
    type: "POST",
    url: "api/geodatasets/append/:name",
  },
  geodatasets_entries: {
    type: "POST",
    url: "api/geodatasets/entries",
  },
  geodatasets_get: {
    type: "GET",
    url: "api/geodatasets/get",
  },
  geodatasets_remove: {
    type: "DELETE",
    url: "api/geodatasets/remove/:name",
  },
  datasets_recreate: {
    type: "POST",
    url: "api/datasets/recreate",
  },
  datasets_entries: {
    type: "POST",
    url: "api/datasets/entries",
  },
  datasets_get: {
    type: "POST",
    url: "api/datasets/get",
  },
  datasets_download: {
    type: "GET",
    url: "api/datasets/download",
  },
  stac_collections: {
    type: "GET",
    url: "api/stac/collections",
  },
  stac_create_collection: {
    type: "POST",
    url: "stac/collections",
  },
  stac_delete_collection: {
    type: "DELETE",
    url: "stac/collections/:collection",
  },
  stac_collection_items: {
    type: "GET",
    url: "stac/collections/:collection/items",
  },
  stac_delete_item: {
    type: "DELETE",
    url: "stac/collections/:collection/items/:item",
  },
  account_entries: {
    type: "GET",
    url: "api/accounts/entries",
  },
  account_delete_user: {
    type: "DELETE",
    url: "api/accounts/remove/:id",
  },
  account_update_user: {
    type: "POST",
    url: "api/accounts/update",
  },
  account_reset_password_link: {
    type: "POST",
    url: "api/accounts/generateResetPasswordLink",
  },
  user_signup: {
    type: "POST",
    url: "api/users/signup",
  },
  longtermtoken_get: {
    type: "GET",
    url: "api/longtermtoken/get",
  },
  longtermtoken_generate: {
    type: "POST",
    url: "api/longtermtoken/generate",
  },
  longtermtoken_clear: {
    type: "POST",
    url: "api/longtermtoken/clear",
  },
  webhooks_save: {
    type: "POST",
    url: "api/webhooks/save",
  },
  webhooks_entries: {
    type: "GET",
    url: "api/webhooks/entries",
  },
  webhooks_config: {
    type: "POST",
    url: "api/webhooks/config",
  },
  titiler_tileMatrixSets: {
    type: "GET",
    url: "titiler/tileMatrixSets",
  },
  titiler_colormapNames: {
    type: "GET",
    url: "titiler/colorMaps",
  },
};

function api(call, data, success, error) {
  if (c[call] == null) {
    console.warn("Unknown api call: " + call);
    if (typeof error === "function") error({ message: "Unknown API call." });
    return;
  }

  const options = {
    method: c[call].type,
    credentials: "include",
    headers: new Headers({ "content-type": "application/json" }),
  };

  let url = c[call].url;
  if (data?.urlReplacements != null) {
    Object.keys(data.urlReplacements).forEach((r) => {
      url = url.replace(`/:${r}`, `/${data.urlReplacements[r]}`);
    });
    delete data.urlReplacements;
  }
  if (c[call].type === "POST" && data?.forceParams != null) {
    url += `?${new URLSearchParams(data.forceParams)}`;
    delete data.forceParams;
  }

  if (c[call].type === "POST") options.body = JSON.stringify(data);
  else if (c[call].type === "GET") options.data = JSON.stringify(data);

  fetch(
    `${domain}${url}${
      c[call].type === "GET"
        ? data != null
          ? `?${new URLSearchParams(data)}`
          : ""
        : ""
    }`,
    options
  )
    .then((res) => res.json())
    .then((json) => {
      if (
        !json.hasOwnProperty("status") ||
        (json.hasOwnProperty("status") && json.status === "success")
      ) {
        if (typeof success === "function") success(json);
      } else if (typeof error === "function") {
        error(json);
      }
    })
    .catch((err) => {
      console.warn("error", err);
      if (typeof error === "function") error();
    });
}

export const calls = {
  ...c,
  api: api,
};
