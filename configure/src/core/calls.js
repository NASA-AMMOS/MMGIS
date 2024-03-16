const domain = "http://localhost:8888/";

const c = {
  missionPath: "Missions/",
  logout: {
    type: "POST",
    url: "api/users/logout",
  },
  getToolConfig: {
    type: "GET",
    url: "config/pre/toolConfigs.json",
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
  versions: {
    type: "GET",
    url: "api/configure/versions",
  },
  geodatasets_recreate: {
    type: "POST",
    url: "api/geodatasets/recreate",
  },
  geodatasets_entries: {
    type: "POST",
    url: "api/geodatasets/entries",
  },
  geodatasets_get: {
    type: "GET",
    url: "api/geodatasets/get",
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
    type: "GET",
    url: "api/datasets/get",
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
};

function api(call, data, success, error) {
  if (c[call] == null) {
    console.warn("Unknown api call: " + call);
    if (typeof error === "function") error({ message: "Unknown API call." });
    return;
  }

  fetch(
    `${domain}${c[call].url}${
      c[call].type === "GET"
        ? data != null
          ? `?${new URLSearchParams(data)}`
          : ""
        : ""
    }`,
    {
      method: c[call].type,
      data: JSON.stringify(data),
      credentials: "include",
    }
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
