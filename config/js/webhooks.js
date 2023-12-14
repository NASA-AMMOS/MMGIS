var webhooksCounter = 0;
var cardEditors = {};

var Webhooks = {
  geojson: null,
  init: function () {
    // prettier-ignore
    var markup = [
        "<div class='webhooks'>",
            "<div class='title'>Webhooks</div>",
            "<div class='row' id='webhooksParent'/>",
            "<div class='row' id='addNewWebhook'>",
              "<a class='btn waves-effect col s3 push-s9' style='color: black; background: white;'>Add Webhook<i class='mdi mdi-plus mdi-24px' style='float: right; margin-top: 1px;'></i></a>",
            "</div>",
            "<div class='row'>",
                "<a class='btn waves-effect waves-light light-green darken-3 col s1 push-s9' id='saveWebhookChanges' style='text-align: left; padding: 0; padding-left: 10px; line-height: 37px; width: 220px; border-radius: 0px; position: fixed; bottom: 10px; right: 10px; z-index: 21; background: #1565C0 !important;'>",
                    "Save Changes",
                    "<i class='mdi mdi-content-save mdi-24px' style='position: absolute; right: 7px; margin-top: -2px;'></i>",
                "</a>",
            "</div>",
        "</div>"
    ].join('\n');

    $(".container_webhooks").html(markup);

    $(".webhooks select").material_select();

    //Add webhook button
    $("#addNewWebhook > a").on("click", function () {
      makeWebhookCard();
      refreshWebhooks();
    });

    //Save changes button
    $("#saveWebhookChanges").on("click", saveWebhookChanges);

    Webhooks.refreshNames();
  },
  make: function () {
    $(".container_webhooks").css({
      opacity: 1,
      pointerEvents: "inherit",
      display: "block",
    });
    Keys.destroy();
    Datasets.destroy();
    Geodatasets.destroy();
    $("#missions li.active").removeClass("active");
    $(".container").css({
      display: "none",
    });
  },
  destroy: function () {
    $(".container_webhooks").css({
      opacity: 0,
      pointerEvents: "none",
      display: "none",
    });
    $(".container").css({
      display: "block",
    });
  },
  refreshNames: function () {
    $.ajax({
      type: calls.webhooks_entries.type,
      url: calls.webhooks_entries.url,
      data: {},
      success: function (data) {
        if (data.status == "success") {
          if (data.body && data.body.entries && data.body.entries.length > 0) {
            var config = JSON.parse(data.body.entries[0].config);
            var webhooks = config.webhooks;
            for (let i = 0; i < webhooks.length; i++) {
              makeWebhookCard(webhooks[i]);
            }
            refreshWebhooks();
          }
        }
      },
    });
  },
};

function makeWebhookCard(data) {
  // prettier-ignore
  $("#webhooksParent").append(
        "<div class='card col s12' id='webhook_card_" + webhooksCounter + "' webhookId='" + webhooksCounter + "'>" +
            "<ul>" +
                "<li class='row'>" +
                    "<div id='webhookActionEl' class='input-field col s3'>" +
                      "<select class id='webhookAction'>" +
                        "<option value='DrawFileAdd' " + (data && data.action && data.action === "DrawFileAdd" ? "selected" : "") + ">DrawFileAdd</option>" +
                        "<option value='DrawFileChange' " + (data && data.action && data.action === "DrawFileChange" ? "selected" : "")+ ">DrawFileChange</option>" +
                        "<option value='DrawFileDelete' " + (data && data.action && data.action === "DrawFileDelete" ? "selected" : "") + ">DrawFileDelete</option>" +
                      "</select>" +
                      "<label for='webhookAction' style='cursor: default;' title='Trigger function for webhook'>Action <i class='mdi mdi-information mdi-14px'></i></label>" +
                    "</div>" +
                    "<div id='webhookTypeEl' class='input-field col s2'>" +
                      "<select class id='webhookType'>" +
                        "<option value='GET'" + (data && data.type && data.type === "GET" ? "selected" : "") + ">GET</option>" +
                        "<option value='POST'" + (data && data.type && data.type  === "POST" ? "selected" : "") + ">POST</option>" +
                        "<option value='PUT'" + (data && data.type && data.type === "PUT" ? "selected" : "") + ">PUT</option>" +
                        "<option value='DELETE'" + (data && data.type && data.type === "DELETE" ? "selected" : "") + ">DELETE</option>" +
                        "<option value='PATCH'" + (data && data.type && data.type === "PATCH" ? "selected" : "") + ">PATCH</option>" +
                      "</select>" +
                      "<label for='webhookType' style='cursor: default;' title='HTTP method to call'>Type <i class='mdi mdi-information mdi-14px'></i></label>" +
                    "</div>" +
                    "<div class='input-field col s7' id='webhookUrlEl'>" +
                        "<input class='validate' id='webhookUrl_" + webhooksCounter + "' type='text'>" +
                        "<label for='webhookUrl'>" +
                            "URL" +
                        "</label>" +
                    "</div>" +
                "</li>" +
                "<li class='row'>" +
                    "<div id='headersEl' class='input-field col s12' style='display: block'>" +
                      "<label for='webhookHeader' style='cursor: default; top: -1.8rem; font-size: 0.8rem;'>Header</label>" +
                      "<textarea class='webhookHeader' id='webhookHeader_" + webhooksCounter + "'></textarea>" +
                    "</div>" +
                "</li>" +
                "<li class='row'>" +
                    "<div id='bodyEl' class='input-field col s12' style='display: block'>" +
                      "<label for='webhookBody' style='cursor: default; top: -1.8rem; font-size: 0.8rem;' title='Uses &#39;{payloadKey}&#39; to inject variables, i.e. { contents: &#39{geojson}&#39 } = { contents: payload.geojson }'>Body <i class='mdi mdi-information mdi-14px'></i></label>" +
                      "<textarea class='webhookBody' id='webhookBody_" + webhooksCounter + "'></textarea>" +
                    "</div>" +
                "</li>" +
                "<li class='row'>" +
                    "<div class='inject-label input-field col s9' id='webhookUrlEl'>" +
                        "<label style='top: 0px; font-size: 14px;'>Valid injectable variables for URL and Body fields: {created_on}, {efolders}, {file_description}, {file_id}, {file_name}, {file_owner}, {file_owner_group}, {folders}, {geojson}, {hidden}, {intent}, {is_master}, {public}, {public_editors}, {publicity_type}, {raw_file_description}, {tags}, {template}, {updated_on}</label>" +
                    "</div>" +
                    "<div class='col s3 push-s1' id='deleteWebhook_" + webhooksCounter +"'>" +
                        "<a class='btn waves-effect' style='color: black; background: white;'>Delete<i class='mdi mdi-delete mdi-24px' style='float: right; margin-top: 1px;'></i></a>" +
                    "</div>" +
                "</li>" +
            "</ul>" +
        "</div>"
    )

  $(".webhooks #webhookUrl_" + webhooksCounter).val(
    data && data.url ? data.url : ""
  );

  cardEditors["webhookHeader_" + webhooksCounter] = CodeMirror.fromTextArea(
    document.getElementById("webhookHeader_" + webhooksCounter),
    {
      path: "js/codemirror/codemirror-5.19.0/",
      mode: "javascript",
      theme: "elegant",
      viewportMargin: Infinity,
      lineNumbers: true,
      autoRefresh: true,
      matchBrackets: true,
    }
  );

  const headerDefault = {
    "Content-Type": "application/json",
  };

  cardEditors["webhookHeader_" + webhooksCounter].setValue(
    JSON.stringify(
      data && data.header ? JSON.parse(data.header) : headerDefault,
      null,
      4
    )
  );

  cardEditors["webhookBody_" + webhooksCounter] = CodeMirror.fromTextArea(
    document.getElementById("webhookBody_" + webhooksCounter),
    {
      path: "js/codemirror/codemirror-5.19.0/",
      mode: "javascript",
      theme: "elegant",
      viewportMargin: Infinity,
      lineNumbers: true,
      autoRefresh: true,
      matchBrackets: true,
    }
  );

  if (data && data.body) {
    cardEditors["webhookBody_" + webhooksCounter].setValue(
      JSON.stringify(JSON.parse(data.body), null, 4)
    );
  }

  //Delete webhook button
  $("#deleteWebhook_" + webhooksCounter).on("click", function () {
    var deleteThis = $(this).parent().parent().parent();
    deleteThis.remove();
  });

  webhooksCounter++;
}

function refreshWebhooks() {
  Materialize.updateTextFields();
  $(".webhooks select").material_select();
}

function saveWebhookChanges() {
  var json = { webhooks: [] };

  $("#webhooksParent")
    .find(".card")
    .each(function () {
      var webhookId = $(this).attr("webhookId");
      var action = $(this).find("#webhookAction").val();
      var type = $(this).find("#webhookType").val();
      var url = $(this)
        .find("#webhookUrl_" + webhookId)
        .val();
      var header = cardEditors["webhookHeader_" + webhookId]
        ? cardEditors["webhookHeader_" + webhookId].getValue() || "{}"
        : "{}";
      var body = cardEditors["webhookBody_" + webhookId]
        ? cardEditors["webhookBody_" + webhookId].getValue() || "{}"
        : "{}";

      json.webhooks.push({
        action,
        type,
        url,
        header,
        body,
      });
    });
  saveWebhookConfig(json);
}

function saveWebhookConfig(json) {
  $.ajax({
    type: calls.webhooks_save.type,
    url: calls.webhooks_save.url,
    data: {
      config: JSON.stringify(json),
    },
    success: function (data) {
      if (data.status == "success") {
        // Update the variable holding the webhooks configuration
        updateWebhookConfig();

        Materialize.toast(
          "<span id='toast_success'>Save Successful.</span>",
          1600
        );
        $("#toast_success").parent().css("background-color", "#1565C0");
      } else {
        Materialize.toast(
          "<span id='toast_failure8'>" + data["message"] + "</span>",
          5000
        );
        $("#toast_failure8").parent().css("background-color", "#a11717");
      }
    },
  });
}

function updateWebhookConfig() {
  $.ajax({
    type: calls.webhooks_config.type,
    url: calls.webhooks_config.url,
    success: function (d) {
      if (d.status == "success") {
        console.log("Updated webhooks config in backend");
      }
    },
  });
}

$(document).ready(function () {
  Webhooks.init();
});
