const logger = require("../../../logger");
const fetch = require("node-fetch");

const filesutils = require("../../Draw/routes/filesutils.js");
const getfile = filesutils.getfile;

const webhookutils = require("../../Webhooks/routes/webhookutils.js");
const webhookEntries = webhookutils.entries;

const INJECT_REGEX = /{(.*?)}/;

// Save the webhook config to local memory
var webhooksConfig;

function getWebhooks() {
  var res = {};
  res.send = function (payload) {
    if (payload.status == "success") {
      if (payload?.body?.entries && payload.body.entries.length > 0) {
        var config = JSON.parse(payload.body.entries[0].config);
        webhooksConfig = config.webhooks;
      }
    } else {
      logger(
        "error",
        "Unable to get webhook entries",
        "TriggerWebhooks",
        null,
        "Unable to get webhook entries"
      );
    }
  };

  webhookEntries({}, res);
}

function triggerWebhooks(action, payload) {
  if (action === "getConfiguration") {
    getWebhooks();
  }

  if (!webhooksConfig) {
    return;
  }

  webhooksConfig.forEach((wh) => {
    switch (wh.action) {
      case "DrawFileChange":
        if (action === "drawFileChange") {
          drawFileUpdate(wh, payload);
        }
        break;
      case "DrawFileAdd":
        if (action === "drawFileAdd") {
          drawFileUpdate(wh, payload);
        }
        break;
      case "DrawFileDelete":
        if (action === "drawFileDelete") {
          drawFileDelete(wh, payload);
        }
        break;
      default:
        break;
    }
  });
}

function drawFileUpdate(webhook, payload) {
  var file_id = payload.id;
  var data = {
    body: {
      id: payload.id,
      quick_published: false,
      published: false,
    },
    user: payload.res.req.user,
    session: {
      user: payload.res.req.user,
    },
  };

  const response = {};
  response.send = function (res) {
    const webhookHeader = JSON.parse(webhook.header);
    const webhookBody = JSON.parse(webhook.body);

    const file = res.body?.file?.[0] || {};
    const injectableVariables = getInjectableVariables("draw", file, res);

    // Build the body
    buildBody(webhookBody, injectableVariables);

    // Build the url
    const url = buildUrl(webhook.url, injectableVariables);

    // Push to the remote webhook
    pushToRemote(url, webhook.type, webhookHeader, webhookBody);
  };

  getfile(data, response);
}

function drawFileDelete(webhook, payload) {
  const file_id = payload.id;
  const data = {
    body: {
      id: payload.id,
      quick_published: false,
      published: false,
    },
    user: payload.res.req.user,
    session: {
      user: payload.res.req.user,
    },
  };

  const response = {};
  response.send = function (res) {
    const webhookHeader = JSON.parse(webhook.header);
    const webhookBody = JSON.parse(webhook.body);

    const file = res.body?.file?.[0] || {};
    const injectableVariables = getInjectableVariables("draw", file, res);

    // Build the body
    buildBody(webhookBody, injectableVariables);

    // Build the url
    const url = buildUrl(webhook.url, injectableVariables);

    // Push to the remote webhook
    pushToRemote(url, webhook.type, webhookHeader, webhookBody);
  };

  getfile(data, response);
}

function getInjectableVariables(type, file, res) {
  const injectableVariables = {};
  switch (type) {
    case "draw":
      const injectableNames = [
        "id",
        "file_owner",
        "file_owner_group",
        "file_name",
        "file_description",
        "is_master",
        "intent",
        "public",
        "hidden",
        "template",
        "publicity_type",
        "public_editors",
        "created_on",
        "updated_on",
      ];
      injectableNames.forEach((name) => {
        injectableVariables[name] = file[name];
      });

      const geojson = res.body.geojson;

      injectableVariables.geojson = geojson;
      injectableVariables.file_id = injectableVariables.id;

      if (typeof injectableVariables.file_description === "string") {
        injectableVariables.raw_file_description =
          injectableVariables.file_description;
        const tags =
          injectableVariables.file_description.match(/~#([^\s])+/g) || [];
        const uniqueTags = [...tags];
        // remove '#'s
        injectableVariables.tags = uniqueTags.map((t) => t.substring(2)) || [];

        const folders =
          injectableVariables.file_description.match(/~@([^\s])+/g) || [];
        const uniqueFolders = [...folders];
        // remove '@'s
        injectableVariables.folders =
          uniqueFolders.map((t) => t.substring(2)) || [];

        const efolders =
          injectableVariables.file_description.match(/~\^([^\s])+/g) || [];
        const uniqueEFolders = [...efolders];
        // remove '^'s
        injectableVariables.efolders =
          uniqueEFolders.map((t) => t.substring(2)) || [];

        injectableVariables.file_description =
          injectableVariables.file_description
            .replaceAll(/~#\w+/g, "")
            .replaceAll(/~@\w+/g, "")
            .replaceAll(/~\^\w+/g, "")
            .trimStart()
            .trimEnd();
      }
      break;
    default:
      break;
  }
  return injectableVariables;
}

function buildBody(webhookBody, injectableVariables) {
  // Fill in the body
  for (var i in webhookBody) {
    var match = INJECT_REGEX.exec(webhookBody[i]);
    // Match for curly braces. If the value contains no curly braces, assume the value is hardcoded so leave the value as is
    if (match) {
      var variable = match[1];
      if (!injectableVariables.hasOwnProperty(variable)) {
        logger(
          "error",
          "The variable '" + variable + "' is not an injectable variable",
          "Webhooks",
          null,
          "The variable '" + variable + "' is not an injectable variable"
        );
      }
      webhookBody[i] = injectableVariables[variable];
    }
  }
}

function buildUrl(url, injectableVariables) {
  var updatedUrl = url;
  var match;
  while (null !== (match = INJECT_REGEX.exec(updatedUrl))) {
    var variable = match[1];
    if (!injectableVariables.hasOwnProperty(variable)) {
      logger(
        "error",
        "The variable '" + variable + "' is not an injectable variable",
        "Webhooks",
        null,
        "The variable '" + variable + "' is not an injectable variable"
      );
    }

    // Stringify if the injectable variable is an object
    var newVariable = injectableVariables[variable];
    if (typeof newVariable === "object" && newVariable !== null) {
      newVariable = JSON.stringify(newVariable);
    }

    updatedUrl = updatedUrl.replace(match[0], newVariable);
  }
  return updatedUrl;
}

function pushToRemote(url, type, header, body) {
  fetch(url, {
    method: type,
    headers: header,
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok) {
        return res.text().then((text) => {
          throw new Error(text);
        });
      } else {
        return res.json();
      }
    })
    .then((json) => {
      if (json.status == "success") {
        logger("info", "Successful webhook call to " + url, "TriggerWebhooks");
      }
    })
    .catch(function (err) {
      logger(
        "error",
        "Failed webhook call to " + url,
        "TriggerWebhooks",
        null,
        err
      );
      return null;
    });
}

module.exports = triggerWebhooks;
