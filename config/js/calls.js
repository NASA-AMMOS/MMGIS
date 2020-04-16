//Assumes mmgisglobal set
var calls = {};

if (mmgisglobal.SERVER == "apache") {
  calls = {
    configconfigPath: "configconfig.json",
    missionPath: "../Missions/",
    verify: {
      type: "POST",
      url: "php/verify.php"
    },
    write_json: {
      type: "POST",
      url: "php/write_json.php",
      pathprefix: "../"
    },
    make_mission: {
      type: "POST",
      url: "php/make_mission.php"
    },
    delete_mission: {
      type: "POST",
      url: "php/delete_mission.php"
    },
    clone_mission: {
      type: "POST",
      url: "php/clone.php"
    },
    rename_mission: {
      type: "POST",
      url: "php/rename_mission.php"
    }
  };
} else if (mmgisglobal.SERVER == "node") {
  calls = {
    configconfigPath:
      mmgisglobal.CONFIGCONFIG_PATH || "config/configconfig.json",
    missionPath: "Missions/",
    logout: {
      type: "POST",
      url: "api/users/logout"
    },
    verify: {
      type: "POST",
      url: "api/config/verify"
    },
    getToolConfig: {
      type: "GET",
      url: "api/tools/get"
    },
    write_json: {
      type: "POST",
      url: "api/config/write_json",
      pathprefix: ""
    },
    make_mission: {
      type: "POST",
      url: "api/config/make_mission"
    },
    delete_mission: {
      type: "POST",
      url: "api/config/delete_mission"
    },
    clone_mission: {
      type: "POST",
      url: "api/config/clone_mission"
    },
    rename_mission: {
      type: "POST",
      url: "api/config/rename_mission"
    },
    get: {
      type: "GET",
      url: "api/configure/get"
    },
    add: {
      type: "POST",
      url: "api/configure/add"
    },
    upsert: {
      type: "POST",
      url: "api/configure/upsert"
    },
    clone: {
      type: "POST",
      url: "api/configure/clone"
    },
    rename: {
      type: "POST",
      url: "api/configure/rename"
    },
    destroy: {
      type: "POST",
      url: "api/configure/destroy"
    },
    missions: {
      type: "POST",
      url: "api/configure/missions"
    },
    versions: {
      type: "POST",
      url: "api/configure/versions"
    },
    geodatasets_recreate: {
      type: "POST",
      url: "api/geodatasets/recreate"
    },
    geodatasets_entries: {
      type: "POST",
      url: "api/geodatasets/entries"
    },
    geodatasets_get: {
      type: "GET",
      url: "api/geodatasets/get"
    },
    datasets_recreate: {
      type: "POST",
      url: "api/datasets/recreate"
    },
    datasets_entries: {
      type: "POST",
      url: "api/datasets/entries"
    },
    datasets_get: {
      type: "GET",
      url: "api/datasets/get"
    },
    longtermtoken_generate: {
      type: "POST",
      url: "api/longtermtoken/generate"
    }
  };
} else {
  console.warn("Unknown SERVER: " + mmgisglobal.SERVER);
}
