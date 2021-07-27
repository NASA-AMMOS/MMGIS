//So that each layer bar will always have a unique id
var grandLayerCounter = 0;
var mission = "";
//The active mission filepath
var missionPath = "";
var tData;
var editors;
var layerEditors;
var usingCustomProjection;
var availableKinds = [];

var dataOfLastUsedLayerSlot = {};

setInterval(function () {
  mmgisglobal.lastInteraction = Date.now();
}, 60000 * 5);
//$( 'body' ).on( 'mousemove', function() { mmgisglobal.lastInteraction = Date.now(); } );

$(document).ready(function () {
  initialize();
});

function initialize() {
  $(".logout").on("click", function () {
    $.ajax({
      type: calls.logout.type,
      url: calls.logout.url,
      data: {},
      success: function (data) {
        window.location = "/";
      },
    });
  });
  //initialize new mission button
  $("#new_mission").on("click", function () {
    $("#missions li").removeClass("active");
    $("#new_mission").css({ "background-color": "#1565C0" });
    $(".container #existing_mission_cont").css({ display: "none" });
    $(".container #new_mission_cont").css({ display: "inherit" });
    $("ul.tabs#missions .indicator").css({ "box-shadow": "none" });
    $("ul.tabs .indicator").css({ "background-color": "transparent" });
  });
  $("#make_mission").on("click", addMission);

  $("body").attr("class", "mmgisScrollbar");

  $("#upload_config_input").on("change", function (evt) {
    var files = evt.target.files; // FileList object
    // use the 1st file from the list
    var f = files[0];
    var reader = new FileReader();
    // Closure to capture the file information.

    reader.onload = (function (file) {
      return function (e) {
        let config;
        try {
          config = JSON.parse(e.target.result);
        } catch (e) {
          Materialize.toast(
            "<span id='toast_failure80'>Bad JSON.</span>",
            4000
          );
          $("#toast_failure80").parent().css("background-color", "#a11717");
          return;
        }
        if (
          config.hasOwnProperty("msv") &&
          config.hasOwnProperty("layers") &&
          config.hasOwnProperty("tools")
        )
          saveConfig(config);
        else {
          Materialize.toast(
            "<span id='toast_failure81'>Bad config.</span>",
            4000
          );
          $("#toast_failure81").parent().css("background-color", "#a11717");
        }
      };
    })(f);

    // Read in the image file as a data URL.
    reader.readAsText(f);
  });

  //Initial keys
  $("#manage_keys").on("click", function () {
    Keys.make();
  });
  //Initial manage datasets
  $("#manage_datasets").on("click", function () {
    Datasets.make();
  });
  //Initial manage geodatasets
  $("#manage_geodatasets").on("click", function () {
    Geodatasets.make();
  });

  $.ajax({
    type: calls.missions.type,
    url: calls.missions.url,
    data: {},
    success: function (data) {
      if (data.status == "success") {
        var mData = data.missions;
        for (var i = 0; i < mData.length; i++) {
          $("#missions").append("<li class='tab'><a>" + mData[i] + "</a></li>");
        }
        getConfigConfig();
      } else {
        Materialize.toast(
          "<span id='toast_failure8'>Error loading available mission.</span>",
          500000
        );
        $("#toast_failure8").parent().css("background-color", "#a11717");
      }
    },
  });

  function getConfigConfig() {
    $.ajax({
      type: calls.getToolConfig.type,
      url: calls.getToolConfig.url,
      data: {},
      success: function (ccData) {
        tData = Object.keys(ccData).map(function (key) {
          return ccData[key];
        });

        //Populate available Kinds
        let kinds = tData.filter((t) => t.name === "Kinds");
        if (kinds[0]) {
          availableKinds = kinds[0].kinds;
          //then remove Kinds
          tData = tData.filter((t) => t.name !== "Kinds");
        }

        editors = {};
        layerEditors = {};

        for (var i = 0; i < tData.length; i++) {
          // prettier-ignore
          $( "#tab_tools_rows" ).append(
              "<li class='row' style='margin-bottom: 0px; margin-top: 10px;'>" +
                "<div id='t" + tData[i].name + "check' class='input-field col s3'>" +
                  "<input type='checkbox' class='filled-in checkbox-color' id='tools_" + tData[i].name + "'/>" +
                  "<label for='tools_" + tData[i].name + "' style='color: black;'>" + tData[i].name + "</label>" +
                "</div>" +
                "<div class='col s6' style='margin-top: 28px; text-align: center; background-color: rgba(0,0,0,0.06); position: relative; padding: 0;'>" +
                  "<a id='t" + tData[i].name + "_info' class='waves-effect waves-light modal-trigger' href='#info_modal' style='color: #111; width: 100%;'>" + tData[i].description + "</a>" +
                  "<i class='mdi mdi-information mdi-18px' style='position: absolute; right: 2px; top: -2px; color: #444;'></i>" +
                "</div>" +
                "<div id='t" + tData[i].name + "icon' class='input-field col s2 push-s1' style='position: relative;'>" +
                  "<input id='t" + tData[i].name + "_icon' type='text' class='validate' value='" + tData[i].defaultIcon + "' style='margin-bottom: 2px;'>" +
                  "<label for='t" + tData[i].name + "_icon'>Icon</label>" +
                  "<i class='mdi mdi-" + tData[i].defaultIcon + " mdi-18px' style='background: white; padding: 0px 5px; position: absolute; right: 12px; top: 10px; color: #000;'></i>" +
                "</div>" +
              "</li>"
            );
          $("#t" + tData[i].name + "_info").on(
            "click",
            (function (name, descriptionFull) {
              return function () {
                if (descriptionFull == "")
                  descriptionFull = { title: "No further description." };
                $("#info_modal div.modal-content h4").html(name);
                $("#info_modal div.modal-content #info_title").html(
                  descriptionFull.title
                );
                $("#info_modal div.modal-content #info_example").html(
                  JSON.stringify(descriptionFull.example, null, 4) || ""
                );
              };
            })(tData[i].name, tData[i].descriptionFull)
          );

          $("#t" + tData[i].name + "_icon").on("input", function () {
            var newIcon = $(this).val().replace(/ /g, "_");
            $(this)
              .parent()
              .find("i")
              .attr("class", "mdi mdi-" + newIcon + " mdi-18px");
          });

          if (tData[i].hasVars) {
            $("#tab_tools_rows").append(
              "<textarea id='t" +
                tData[i].name +
                "_var' style='height: auto;'></textarea>"
            );
            var codeeditor = CodeMirror.fromTextArea(
              document.getElementById("t" + tData[i].name + "_var"),
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
            editors[tData[i].name] = codeeditor;
          }
        }

        //Make materialize initialize tabs
        $("ul.tabs#missions").tabs();

        $("ul.tabs#missions .indicator").css({ display: "none" });

        $("#missions li").on("click", function () {
          layerEditors = {};

          Keys.destroy();
          Datasets.destroy();
          Geodatasets.destroy();

          $("#missions li").removeClass("active");
          $(this).addClass("active");

          $("ul.tabs#missions .indicator").css({ display: "inherit" });
          //$('ul.tabs#missions .indicator' ).css({'box-shadow': 'inset 0px -12px 12px -12px #222'});
          //First clear all previous mission stuffes
          $("#modal_divs").empty();
          $("#tab_layers_rows").empty();

          $("#new_mission").css({
            "background-color": "rgba(255,255,255,0.12)",
          });
          $(".container #existing_mission_cont").css({ display: "inherit" });
          $(".container #new_mission_cont").css({ display: "none" });
          $("ul.tabs .indicator").css({ "background-color": "#1565C0" });

          mission = $(this).find("a").html();
          missionPath = calls.missionPath + mission + "/config.json";

          $.ajax({
            type: calls.get.type,
            url: calls.get.url,
            data: {
              mission: mission,
              full: true,
            },
            success: function (data) {
              if (data.status == "success") {
                var cData = data.config;

                //overall
                $("#overall_mission_name").text(mission);

                //initial
                $("#tab_initial #imission").val(cData.msv.mission);
                $("#tab_initial #isite").val(cData.msv.site);
                $("#tab_initial #idb").prop(
                  "checked",
                  cData.msv.masterdb || false
                );
                $("#tab_initial #ilat").val(cData.msv.view[0]);
                $("#tab_initial #ilon").val(cData.msv.view[1]);
                $("#tab_initial #izoom").val(cData.msv.view[2]);
                $("#tab_initial #iradMaj").val(cData.msv.radius.major);
                $("#tab_initial #iradMin").val(cData.msv.radius.minor);
                $("#tab_initial #imapScale").val(cData.msv.mapscale);

                //projection
                usingCustomProjection = false;
                if (cData.projection && cData.projection.custom == true)
                  usingCustomProjection = true;
                projectionToggleCustom(usingCustomProjection);
                $("#tab_projection #projection_epsg").val(
                  cData.projection ? cData.projection.epsg : ""
                );
                $("#tab_projection #projection_proj").val(
                  cData.projection ? cData.projection.proj : ""
                );
                if (cData.projection)
                  $(
                    "#tab_projection #projection_globeProj option[value='" +
                      cData.projection.globeproj +
                      "']"
                  ).prop("selected", true);
                $("#tab_projection #projection_xmlPath").val(
                  cData.projection ? cData.projection.xmlpath : ""
                );
                $("#tab_projection #projection_boundsMinX").val(
                  cData.projection ? cData.projection.bounds[0] : ""
                );
                $("#tab_projection #projection_boundsMinY").val(
                  cData.projection ? cData.projection.bounds[1] : ""
                );
                $("#tab_projection #projection_boundsMaxX").val(
                  cData.projection ? cData.projection.bounds[2] : ""
                );
                $("#tab_projection #projection_boundsMaxY").val(
                  cData.projection ? cData.projection.bounds[3] : ""
                );
                $("#tab_projection #projection_originX").val(
                  cData.projection ? cData.projection.origin[0] : ""
                );
                $("#tab_projection #projection_originY").val(
                  cData.projection ? cData.projection.origin[1] : ""
                );
                $("#tab_projection #projection_resZ").val(
                  cData.projection ? cData.projection.reszoomlevel : ""
                );
                $("#tab_projection #projection_res").val(
                  cData.projection ? cData.projection.resunitsperpixel : ""
                );

                $("#tab_projection #projection_populateFromXml").off(
                  "click",
                  projectionPopulateFromXML
                );
                $("#tab_projection #projection_toggleCustom").off(
                  "click",
                  projectionToggleCustom
                );
                $("#tab_projection #projection_populateFromXml").on(
                  "click",
                  projectionPopulateFromXML
                );
                $("#tab_projection #projection_toggleCustom").on(
                  "click",
                  projectionToggleCustom
                );
                //look
                $("#tab_look #look_pagename").val("MMGIS");
                if (cData.look && cData.look.pagename) {
                  $("#tab_look #look_pagename").val(cData.look.pagename);
                }
                $("#tab_look input").prop("checked", false);
                if (cData.look && cData.look.minimalist == true) {
                  $("#tab_look #look_minimalist").prop("checked", true);
                }
                if (cData.look && cData.look.zoomcontrol == true) {
                  $("#tab_look #look_zoomcontrol").prop("checked", true);
                }
                if (cData.look && cData.look.graticule == true) {
                  $("#tab_look #look_graticule").prop("checked", true);
                }
                //look coords
                if (
                  cData.look &&
                  (cData.look.coordll == true || cData.look.coordll == null)
                )
                  $("#tab_look #look_coordll").prop("checked", true);
                if (
                  cData.look &&
                  (cData.look.coorden == true || cData.look.coorden == null)
                )
                  $("#tab_look #look_coorden").prop("checked", true);
                if (
                  cData.look &&
                  (cData.look.coordrxy == true || cData.look.coordrxy == null)
                )
                  $("#tab_look #look_coordrxy").prop("checked", true);
                if (cData.look && cData.look.coordsite == true)
                  $("#tab_look #look_coordsite").prop("checked", true);
                if (cData.look && cData.look.coordelev == true)
                  $("#tab_look #look_coordelev").prop("checked", true);
                $("#tab_look #look_coordelevurl").val(
                  cData.look ? cData.look.coordelevurl : ""
                );
                //look colors
                $("#tab_look #look_primarycolor").val(
                  cData.look ? cData.look.primarycolor : ""
                );
                $("#tab_look #look_seconadrycolor").val(
                  cData.look ? cData.look.secondarycolor : ""
                );
                $("#tab_look #look_tertiarycolor").val(
                  cData.look ? cData.look.tertiarycolor : ""
                );
                $("#tab_look #look_accentcolor").val(
                  cData.look ? cData.look.accentcolor : ""
                );
                $("#tab_look #look_bodycolor").val(
                  cData.look ? cData.look.bodycolor : ""
                );
                $("#tab_look #look_topbarcolor").val(
                  cData.look ? cData.look.topbarcolor : ""
                );
                $("#tab_look #look_toolbarcolor").val(
                  cData.look ? cData.look.toolbarcolor : ""
                );
                $("#tab_look #look_mapcolor").val(
                  cData.look ? cData.look.mapcolor : ""
                );
                $("#tab_look #look_highlightcolor").val(
                  cData.look ? cData.look.highlightcolor : ""
                );

                if (
                  cData.look &&
                  (cData.look.copylink == true || cData.look.copylink == null)
                ) {
                  $("#tab_look #look_copylink").prop("checked", true);
                }
                if (
                  cData.look &&
                  (cData.look.screenshot == true ||
                    cData.look.screenshot == null)
                ) {
                  $("#tab_look #look_screenshot").prop("checked", true);
                }
                if (
                  cData.look &&
                  (cData.look.fullscreen == true ||
                    cData.look.fullscreen == null)
                ) {
                  $("#tab_look #look_fullscreen").prop("checked", true);
                }
                if (
                  cData.look &&
                  (cData.look.help == true || cData.look.help == null)
                ) {
                  $("#tab_look #look_help").prop("checked", true);
                }
                $("#tab_look #look_logourl").val(
                  cData.look ? cData.look.logourl : ""
                );
                $("#tab_look #look_helpurl").val(
                  cData.look ? cData.look.helpurl : ""
                );

                //panels
                $("#tab_panels input").prop("checked", false);
                for (var i = 0; i < cData.panels.length; i++) {
                  $("#tab_panels #panels_" + cData.panels[i]).prop(
                    "checked",
                    true
                  );
                }

                //time
                if (typeof cData.time != "undefined") {
                  $("#tab_time #time_enabled").prop(
                    "checked",
                    cData.time.enabled ? true : false
                  );
                  $("#tab_time #time_visible").prop(
                    "checked",
                    cData.time.visible ? true : false
                  );
                }
                $("#tab_time #time_format").val(
                  cData.time ? cData.time.format : "%Y-%m-%dT%H:%M:%SZ"
                );

                //tools
                //uncheck all tools
                $("#tab_tools").find(":checkbox").prop("checked", false);
                //clear all editors
                for (var e in editors) {
                  editors[e].setValue("");
                }
                //now populate it
                for (var i = 0; i < cData.tools.length; i++) {
                  $("#tab_tools #tools_" + cData.tools[i].name).prop(
                    "checked",
                    true
                  );
                  $("#t" + cData.tools[i].name + "_icon").val(
                    cData.tools[i].icon
                  );
                  $("#t" + cData.tools[i].name + "_icon")
                    .parent()
                    .find("i")
                    .attr(
                      "class",
                      "mdi mdi-" + cData.tools[i].icon + " mdi-18px"
                    );
                  if (editors.hasOwnProperty(cData.tools[i].name)) {
                    if (cData.tools[i].hasOwnProperty("variables")) {
                      editors[cData.tools[i].name].setValue(
                        JSON.stringify(cData.tools[i].variables, null, 4)
                      );
                    }
                  }
                }

                //layers
                expandLayers(cData.layers, 0);

                refresh();
                //Reclick active tab to get indicator to show properly
                $("#existing_mission_cont .tabs .active").click();

                //Get versions=============
                $.ajax({
                  type: calls.versions.type,
                  url: calls.versions.url,
                  data: {
                    mission: mission,
                  },
                  success: function (data) {
                    if (data.status == "success") {
                      populateVersions(data.versions);
                    }
                  },
                });
              } else {
                Materialize.toast(
                  "<span id='toast_failure8'>Failure loading " +
                    mission +
                    "'s configuration.</span>",
                  4000
                );
                $("#toast_failure8")
                  .parent()
                  .css("background-color", "#a11717");
              }
            },
          });
        });
      },
      error: function (jqXHR, textStatus, error) {
        console.warn("Error getting tools configurations.");
      },
    });
  }

  //Add layer button
  $("#add_new_layer").on("click", function () {
    var madeUpData = { name: "New Layer", type: "header", visibility: "false" };
    makeLayerBarAndModal(madeUpData, 0);
    refresh();
  });

  //Clone Button and Modal
  $("#clone_mission").on("click", function () {
    //Clear passwords
    $("#cloneName").val("");
    $("#clonePassword").val("");

    Materialize.updateTextFields();

    $("#clone_modal div.modal-content h4").html(
      "Clone Mission: <span style='text-decoration: underline;'>" +
        mission +
        "</span>"
    );
    setTimeout(function () {
      $(".lean-overlay").css({
        transition: "background-color 0.5s",
        "background-color": "#1565c0",
      });
    }, 150);
  });
  $("#clone_modal #clone_mission_clone").on("click", function () {
    let cName = $("#cloneName").val();
    let hasPaths = $("#clonePaths").prop("checked");

    $.ajax({
      type: calls.clone.type,
      url: calls.clone.url,
      data: {
        existingMission: mission,
        cloneMission: cName,
        hasPaths: hasPaths,
      },
      success: function (data) {
        if (data.status == "success") {
          Materialize.toast(
            "<span id='toast_success_clone'>Mission Clone Successful.</span>",
            3000
          );
          $("#toast_success_clone").parent().css("background-color", "#1565C0");
          Materialize.toast(
            "<span id='toast_success_cloner'>Page will now reload...</span>",
            3000
          );
          $("#toast_success_cloner")
            .parent()
            .css("background-color", "#1565C0");
          setTimeout(function () {
            location.reload();
          }, 3000);
        } else {
          Materialize.toast(
            "<span id='toast_bad_clone'>" + data.message + "</span>",
            5000
          );
          $("#toast_bad_clone").parent().css("background-color", "#a11717");
        }
      },
    });

    //Clear again
    $("#cloneName").val("");
  });

  //Delete Button and Modal
  $("#delete_mission").on("click", function () {
    //Clear passwords
    $("#deleteMissionName").val("");

    Materialize.updateTextFields();

    $("#delete_modal div.modal-content h4").html(
      "Delete Mission: <span style='text-decoration: underline;'>" +
        mission +
        "</span>"
    );
    setTimeout(function () {
      $(".lean-overlay").css({
        transition: "background-color 0.5s",
        "background-color": "red",
      });
    }, 150);
  });
  $("#delete_modal #delete_mission_delete").on("click", function () {
    var name = $("#deleteMissionName").val();

    if (name != mission) {
      Materialize.toast(
        "<span id='toast_delete_failure2'>Confirmation mission name didn't match.</span>",
        7000
      );
      $("#toast_delete_failure2").parent().css("background-color", "#a11717");
      return;
    }

    $.ajax({
      type: calls.destroy.type,
      url: calls.destroy.url,
      data: {
        mission: mission,
      },
      success: function (data) {
        if (data.status == "success") {
          Materialize.toast(
            "<span id='toast_success4'>Mission Removal Successful.</span>",
            4000
          );
          $("#toast_success4").parent().css("background-color", "#1565C0");
          Materialize.toast(
            "<span id='toast_success5'>Page will now reload...</span>",
            4000
          );
          $("#toast_success5").parent().css("background-color", "#1565C0");
          setTimeout(function () {
            location.reload();
          }, 4000);
        } else {
          Materialize.toast(
            "<span id='toast_delete_failure'>" + data["message"] + "</span>",
            7000
          );
          $("#toast_delete_failure")
            .parent()
            .css("background-color", "#a11717");
        }
      },
    });

    $("#deleteMissionName").val("");
  });

  //Save changes button
  $("#save_changes").on("click", save);
}

function refresh() {
  //Make materialize update modals
  $(".modal-trigger").leanModal();
  Materialize.updateTextFields();
  $("select").material_select();

  //Make layers data match modal and layer bar styles
  $("#modal_divs").mmgisLinkModalsToLayers();

  //Make them sortable
  $("#tab_layers_rows").sortable();

  //Make them horizontally sortable
  $("#tab_layers_rows").materializeDraggable();
}

//Depth-first iteration through the json layers that sets our variables
function expandLayers(d, level) {
  for (var i = 0; i < d.length; i++) {
    makeLayerBarAndModal(d[i], level);

    var dNext = getSublayers(d[i]);
    if (dNext != 0) expandLayers(dNext, level + 1);
  }
}
function getSublayers(d) {
  if (d.hasOwnProperty("sublayers")) return d.sublayers;
  else return 0;
}

function makeLayerBarAndModal(d, level) {
  //name for classes/ids
  var n = grandLayerCounter; //d.name.replace(/ /g,"_");
  d.__level = level;
  dataOfLastUsedLayerSlot[n] = JSON.parse(JSON.stringify(d));
  grandLayerCounter++;

  //Which form elements to hide ( based on display property )
  // prettier-ignore
  var nameEl = "block", kindEl = "block", typeEl = "block", urlEl = "block", demtileurlEl = "block", demparserEl = "block", controlledEl = "block", legendEl = "block",
      visEl = "block", viscutEl = "block", initOpacEl = "block", togwheadEl = "block", minzEl = "block",
      tileformatEl = "block",
    visEl = "block",
    viscutEl = "block",
    togwheadEl = "block",
    minzEl = "block",
    modelLonEl = "block",
    modelLatEl = "block",
    modelElevEl = "block",
    modelRotXEl = "block",
    modelRotYEl = "block",
    modelRotZEl = "block",
    modelScaleEl = "block",
    maxnzEl = "block",
    maxzEl = "block",
    strcolEl = "block",
    filcolEl = "block",
    weightEl = "block",
    opacityEl = "block",
    radiusEl = "block",
    variableEl = "block",
    xmlEl = "block",
    bbEl = "block",
    vtLayerEl = "block",
    vtIdEl = "block",
    vtKeyEl = "block",
    vtLayerSetStylesEl = "block",
    timeEl = "block",
    timeTypeEl = "block",
    timeFormatEl = "block",
    timeRefreshEl = "none",
    timeIncrementEl = "none";

  // prettier-ignore
  switch( d.type ) {
    case "header":
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "none"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "none"; legendEl = "none";
        visEl = "block"; viscutEl = "none"; initOpacEl = "none"; togwheadEl = "none"; minzEl = "none";
        tileformatEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxnzEl = "none"; maxzEl = "none"; strcolEl = "none"; filcolEl = "none";
        weightEl = "none"; opacityEl = "none"; radiusEl = "none"; variableEl = "none";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = "none"; timeTypeEl = "none"; timeFormatEl = "none"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break;
    case "tile":
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "block"; demtileurlEl = "block"; demparserEl = "block"; controlledEl = "none"; legendEl = "block";
        visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "block";
        tileformatEl = "block";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxnzEl = "block"; maxzEl = "block"; strcolEl = "none"; filcolEl = "none";
        weightEl = "none"; opacityEl = "none"; radiusEl = "none"; variableEl = "none";
        xmlEl = "block"; bbEl = "block"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = "block"; timeTypeEl = "block"; timeFormatEl = "block"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break;
    case "vectortile":
        nameEl = "block"; kindEl = "block"; typeEl = "block"; urlEl = "block"; demtileurlEl = "block"; demparserEl = "block"; controlledEl = "none"; legendEl = "block";
        visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "block";
        tileformatEl = "block";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxnzEl = "block"; maxzEl = "block"; strcolEl = "none"; filcolEl = "none";
        weightEl = "none"; opacityEl = "none"; radiusEl = "none"; variableEl = "block";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "block"; vtIdEl = "block"; vtKeyEl = "block"; vtLayerSetStylesEl = "block";
        timeEl = "block"; timeTypeEl = "block"; timeFormatEl = "block"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break;
    case "data":
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "none"; demtileurlEl = "block"; demparserEl = "block"; controlledEl = "none"; legendEl = "block";
        visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "block";
        tileformatEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxnzEl = "block"; maxzEl = "block"; strcolEl = "none"; filcolEl = "none";
        weightEl = "none"; opacityEl = "none"; radiusEl = "none"; variableEl = "block";
        xmlEl = "block"; bbEl = "block"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none"; 
        timeEl = "block"; timeTypeEl = "block"; timeFormatEl = "block"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break;
    case "point":
        nameEl = "block"; kindEl = "block"; typeEl = "block"; urlEl = "block"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "none"; legendEl = "block";
        visEl = "block"; viscutEl = "block"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "none";
        tileformatEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxnzEl = "none"; maxzEl = "none"; strcolEl = "block"; filcolEl = "block";
        weightEl = "block"; opacityEl = "block"; radiusEl = "block"; variableEl = "block";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none"; 
        timeEl = "block"; timeTypeEl = "block"; timeFormatEl = "block"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break;
    case "vector":
        nameEl = "block"; kindEl = "block"; typeEl = "block"; urlEl = "block"; controlledEl = "block"; demtileurlEl = "none";  demparserEl = "none"; legendEl = "block";
        visEl = "block"; viscutEl = "block"; initOpacEl = "block"; togwheadEl = "none"; minzEl = "none";
        tileformatEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxnzEl = "none"; maxzEl = "none"; strcolEl = "block"; filcolEl = "block";
        weightEl = "block"; opacityEl = "block"; radiusEl = "block"; variableEl = "block";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = "block"; timeTypeEl = "block"; timeFormatEl = "block"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break;
    case "model":
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "block"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "none"; legendEl = "none";
        visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "none"; minzEl = "none";
        tileformatEl = "none";
        modelLonEl = "block"; modelLatEl = "block"; modelElevEl = "block";
        modelRotXEl = "block"; modelRotYEl = "block"; modelRotZEl = "block"; modelScaleEl = "block";
        maxnzEl = "none"; maxzEl = "none"; strcolEl = "none"; filcolEl = "none";
        weightEl = "none"; opacityEl = "none"; radiusEl = "none"; variableEl = "none";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = "block"; timeTypeEl = "block"; timeFormatEl = "block"; timeRefreshEl = "none"; timeIncrementEl = "none";
      break; 
    default:
      console.warn(`Unknown layer type: ${d.type}`)
  }

  var barColor;
  var headerSel = "",
    tileSel = "",
    vectortileSel = "",
    dataSel = "",
    pointSel = "",
    vectorSel = "",
    modelSel = "";

  switch (d.type) {
    case "header":
      barColor = "#505050";
      headerSel = "selected";
      break;
    case "tile":
      barColor = "rgb(119, 15, 189)";
      tileSel = "selected";
      break;
    case "vectortile":
      barColor = "#bd0f8e";
      vectortileSel = "selected";
      break;
    case "data":
      barColor = "rgb(189, 15, 50)";
      dataSel = "selected";
      break;
    case "point":
      barColor = "#892f45";
      pointSel = "selected";
      break;
    case "vector":
      barColor = "rgb(15, 119, 189)";
      vectorSel = "selected";
      break;
    case "model":
      barColor = "rgb(189, 189, 15)";
      modelSel = "selected";
      break;
    default:
      console.warn(`Unknown layer type: ${d.type}`);
  }

  var tileformatTMSSel = "",
    tileformatWMTSSel = "",
    tileformatWMSSel = "";
  switch (d.tileformat) {
    case "wmts":
      tileformatWMTSSel = "selected";
      break;
    case "wms":
      tileformatWMSSel = "selected";
      break;
    default:
      tileformatTMSSel = "selected";
      break;
  }

  if (d.tileformat == null && d.tms != null && d.tms === false) {
    tileformatTMSSel = "";
    tileformatWMTSSel = "selected";
  }

  var demparserRGBASel = "",
    demparserTifSel = "";
  switch (d.demparser) {
    case "rgba":
      demparserRGBASel = "selected";
      break;
    case "tif":
      demparserTifSel = "selected";
      break;
    default:
      demparserRGBASel = "selected";
      break;
  }

  var visTrueSel = "",
    visFalseSel = "";
  var visIcon = "inherit";
  switch (d.visibility) {
    case true:
    case "true":
      visTrueSel = "selected";
      break;
    case false:
    case "false":
      visFalseSel = "selected";
      visIcon = "none";
      break;
    default:
  }

  var timeTrueSel = "",
    timeFalseSel = "";
  var timeIcon = "inherit";
  if (typeof d.time != "undefined") {
    switch (d.time.enabled) {
      case true:
      case "true":
        timeTrueSel = "selected";
        break;
      case false:
      case "false":
        timeFalseSel = "selected";
        timeIcon = "none";
        break;
      default:
    }
  } else {
    timeFalseSel = "selected";
  }

  var timeGlobalSel = "",
    timeIndividualSel = "";
  if (typeof d.time != "undefined") {
    switch (d.time.type) {
      case "global":
        timeGlobalSel = "selected";
        break;
      case "individual":
        timeIndividualSel = "selected";
        break;
      default:
    }
  } else {
    timeGlobalSel = "selected";
  }

  var togwheadTrueSel = "",
    togwheadFalseSel = "";
  if (d.hasOwnProperty("togglesWithHeader")) {
    switch (d.togglesWithHeader) {
      case true:
      case "true":
        togwheadTrueSel = "selected";
        break;
      case false:
      case "false":
        togwheadFalseSel = "selected";
        break;
      default:
    }
  } else togwheadTrueSel = "selected";

  var dStyle = {};
  if (d.hasOwnProperty("style")) dStyle = d.style;
  if (!d.hasOwnProperty("position"))
    d.position = { longitude: 0, latitude: 0, elevation: 0 };
  if (!d.hasOwnProperty("rotation")) d.rotation = { x: 0, y: 0, z: 0 };
  if (!d.hasOwnProperty("scale")) d.scale = 1;

  //Build Kinds
  let kindsOptions = [];
  if (availableKinds) {
    for (let i = 0; i < availableKinds.length; i++) {
      let k = availableKinds[i];
      let ks = toTitleCase(k.replace(/_/g, " "));

      // prettier-ignore
      kindsOptions.push(
        "<option value='" + k + "' " +
          (d.kind == k ? "selected" : "") +
          ">" + ks + "</option>"
      );
    }
  }
  //Probably not the best way to do this but oh well

  // prettier-ignore
  $( "#tab_layers #tab_layers_rows" ).append(
    "<li class='row'>" +
      "<a id='layers_rows_" + n + "' class='btn waves-effect waves-light modal-trigger col s" + ( 10 - level ) + " push-s" + ( 1 + level ) + "' style='background-color:" + barColor + ";' href='#layers_" + n + "'>" +
        "<p class='left-align' style='margin: 0;'><span class='l_title'>" + d.name + "</span>" +
        "<i class='mdi mdi-eye mdi-24px l_icon' style='float: right; margin-top: 1px; display: " + visIcon + "'></i></p>" +
      "</a>" +
    "</li>");

  // prettier-ignore
  $( "#modal_divs" ).append(
    "<div id='layers_" + n + "' class='modal mmgisScrollbar' modalId='" + n + "'>" +
      "<div class='modal-content' style='padding-bottom: 0; margin-bottom: " + ((d.type === 'header') ? '200px' : '0') + ";'>" +
        "<div class='modal-title'>" +
          "<h4 id='modal_name'>" + d.name + "</h4>" +
          "<div class='clone'><i class='mdi mdi-content-duplicate mdi-24px' title='Clone Layer'></i></div>" +
        "</div>" +
        "<p>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='nameEl' class='input-field col s" + (kindEl == 'none' ? 8 : 6) + " push-s1' style='display: " + nameEl + "'>" +
              "<input id='Name" + n + "' type='text' class='validate' value='" + unescape(d.name) + "'>" +
              "<label for='Name" + n + "'>Layer Name</label>" +
            "</div>" +
            "<div id='kindEl' class='input-field col s2 push-s1' style='display: " + kindEl + "'>" +
              "<select>" +
                "<option value='none' " + (d.kind == 'none' || d.kind == null ? 'selected' : '') + ">None</option>" +
                kindsOptions.join('') +
              "</select>" +
              "<label>Kind of Layer</label>" +
            "</div>" +
            "<div id='typeEl' class='input-field col s2 push-s1' style='display: " + typeEl + "'>" +
              "<select>" +
                "<optgroup label='Pseudo Layers'>" +
                  "<option value='header' " + headerSel + ">Header</option>" +
                "</optgroup>" +
                "<optgroup label='Layers'>" +
                  "<option value='tile' " + tileSel + ">Tile</option>" +
                  "<option value='vectortile' " + vectortileSel + ">Vector Tile</option>" +
                  "<option value='data' " + dataSel + ">Data</option>" +
                  //"<option value='point' " + pointSel + ">Point</option>" +
                  "<option value='vector' " + vectorSel + ">Vector</option>" +
                  "<option value='model' " + modelSel + ">Model</option>" +
                "</optgroup>" +
              "</select>" +
              "<label>Layer Type</label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='urlEl' class='input-field col s8 push-s1' style='display: " + urlEl + "'>" +
              "<input id='Url" + n + "' type='text' class='validate' value='" + d.url + "'>" +
              "<label for='Url" + n + "'>URL</label>" +
            "</div>" +
            "<div id='tileformatEl' class='input-field col s2 push-s1' style='display: " + tileformatEl + "'>" +
              "<select>" +
                "<option value='tms' " + tileformatTMSSel + ">TMS</option>" +
                "<option value='wmts' " + tileformatWMTSSel + ">WMTS</option>" +
                "<option value='wms' " + tileformatWMSSel + ">WMS</option>" +
              "</select>" +
              "<label style='cursor: default;' title='TMS and WMTS: Append \"/{z}/{x}/{y}.png\" to URL\n\nWMS: After service, append \"?layer=<your_layer_name><,another_if_you _want>\" to the URL\nTo override WMS parameters append \"&<wms_param>=<value>\" again to the URL after the layers list.\n\nAll brackets included, quotes are not and <> require custom input.'>Tile Format <i class='mdi mdi-information mdi-14px'></i></label>" +
            "</div>" +
            "<div id='controlledEl' class='input-field col s3 push-s1' style='display: " + controlledEl + "'>" +
              "<input id='Controlled" + n + "' type='checkbox' class='filled-in checkbox-color'" +  (d.controlled ? 'checked' : '') + "/>" +
              "<label for='Controlled" + n + "' style='color: black;'>" + "Controlled" + "</label>" +
            "</div>" +
          "</div>" +

          //Model Position
          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='modelLonEl' class='input-field col s3 push-s1' style='display: " + modelLonEl + "'>" +
              "<input id='Longitude" + n + "' type='text' class='validate' value='" + d.position.longitude + "'>" +
              "<label for='Longitude" + n + "'>Longitude</label>" +
            "</div>" +
            "<div id='modelLatEl' class='input-field col s3 push-s1' style='display: " + modelLatEl + "'>" +
              "<input id='Latitude" + n + "' type='text' class='validate' value='" + d.position.latitude + "'>" +
              "<label for='Latitude" + n + "'>Latitude</label>" +
            "</div>" +
            "<div id='modelElevEl' class='input-field col s4 push-s1' style='display: " + modelElevEl + "'>" +
              "<input id='Elevation" + n + "' type='text' class='validate' value='" + d.position.elevation + "'>" +
              "<label for='Elevation" + n + "'>Elevation (meters)</label>" +
            "</div>" +
          "</div>" +
          //Model Rotation
          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='modelRotXEl' class='input-field col s4 push-s1' style='display: " + modelRotXEl + "'>" +
              "<input id='RotationX" + n + "' type='text' class='validate' value='" + d.rotation.x + "'>" +
              "<label for='RotationX" + n + "'>Rotation X (radians)</label>" +
            "</div>" +
            "<div id='modelRotYEl' class='input-field col s3 push-s1' style='display: " + modelRotYEl + "'>" +
              "<input id='RotationY" + n + "' type='text' class='validate' value='" + d.rotation.y + "'>" +
              "<label for='RotationY" + n + "'>Rotation Y</label>" +
            "</div>" +
            "<div id='modelRotZEl' class='input-field col s3 push-s1' style='display: " + modelRotZEl + "'>" +
              "<input id='RotationZ" + n + "' type='text' class='validate' value='" + d.rotation.z + "'>" +
              "<label for='RotationZ" + n + "'>Rotation Z</label>" +
            "</div>" +
          "</div>" +
          //Model Scale
          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='modelScaleEl' class='input-field col s3 push-s1' style='display: " + modelScaleEl + "'>" +
              "<input id='Scale" + n + "' type='text' class='validate' value='" + d.scale + "'>" +
              "<label for='Scale" + n + "'>Scale</label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='demtileurlEl' class='input-field col s8 push-s1' style='display: " + demtileurlEl + "'>" +
              "<input id='DemTileUrl" + n + "' type='text' class='validate' value='" + d.demtileurl + "'>" +
              "<label for='DemTileUrl" + n + "'>DEM Tile URL</label>" +
            "</div>" +
            "<div id='demparserEl' class='input-field col s2 push-s1' style='display: " + demparserEl + "'>" +
              "<select>" +
                "<option value='' " + demparserRGBASel + ">RGBA</option>" +
                "<option value='tif' " + demparserTifSel + ">Tif</option>" +
              "</select>" +
              "<label style='cursor: default;' title='Method to parse DEM tiles. RGBA is the default'>DEM Parser <i class='mdi mdi-information mdi-14px'></i></label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='legendEl' class='input-field col s10 push-s1' style='display: " + legendEl + "'>" +
              "<input id='Legend" + n + "' type='text' class='validate' value='" + d.legend + "'>" +
              "<label for='Legend" + n + "'>Legend URL</label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='togwheadEl' class='input-field col s2 push-s1' style='display: " + /*togwheadEl*/ 'none' + "'>" +
              "<select>" +
                "<option value='true' " + togwheadTrueSel + ">True</option>" +
                "<option value='false' " + togwheadFalseSel + ">False</option>" +
              "</select>" +
              "<label>Toggles with Header</label>" +
            "</div>" +
            "<div id='minzEl' class='input-field col s2 push-s1' style='display: " + minzEl + "'>" +
              "<input id='Minz" + n + "' type='text' class='validate' value='" + d.minZoom + "'>" +
              "<label for='Minz" + n + "'>Minimum Zoom</label>" +
            "</div>" +
            "<div id='maxnzEl' class='input-field col s2 push-s1' style='display: " + maxnzEl + "'>" +
              "<input id='Maxnz" + n + "' type='text' class='validate' value='" + d.maxNativeZoom + "'>" +
              "<label for='Maxnz" + n + "'>Maximum Native Zoom</label>" +
            "</div>" +
            "<div id='maxzEl' class='input-field col s2 push-s1' style='display: " + maxzEl + "'>" +
              "<input id='Maxz" + n + "' type='text' class='validate' value='" + d.maxZoom + "'>" +
              "<label for='Maxz" + n + "'>Maximum Zoom</label>" +
            "</div>" +
            "<div id='visEl' class='input-field col s2 push-s1' style='display: " + visEl + "'>" +
              "<select>" +
                "<option value='true' " + visTrueSel + ">True</option>" +
                "<option value='false' " + visFalseSel + ">False</option>" +
              "</select>" +
              "<label>Initial Visibility</label>" +
            "</div>" +
            "<div id='viscutEl' class='input-field col s2 push-s1' style='display: " + viscutEl + "'>" +
              "<input id='Visibilitycutoff" + n + "' type='text' class='validate' value='" + d.visibilitycutoff + "'>" +
              "<label for='Visibilitycutoff" + n + "'>Visibility Cutoff</label>" +
            "</div>" +
            "<div id='initOpacEl' class='input-field col s2 push-s1' style='display: " + initOpacEl + "'>" +
              "<input id='InitialOpacity" + n + "' type='text' class='validate' value='" + ( d.initialOpacity == null ? 1 : d.initialOpacity ) + "'>" +
              "<label for='InitialOpacity" + n + "'>Initial Opacity [0 - 1]</label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='bbEl' class='input-field col s10 push-s1' style='display: " + bbEl + "'>" +
              "<input id='bb" + n + "' type='text' class='validate' value='" + d.boundingBox + "'>" +
              "<label for='bb" + n + "'>Bounding Box [minx, miny, maxx, maxy]</label>" +
            "</div>" +
          "</div>" +

          // Time options
          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='timeEl' class='input-field col s2 push-s1' style='display: " + timeEl + "'>" +
              "<select>" +
                "<option value='true' " + timeTrueSel + ">True</option>" +
                "<option value='false' " + timeFalseSel + ">False</option>" +
              "</select>" +
              "<label>Time Enabled</label>" +
            "</div>" +
            "<div id='timeTypeEl' class='input-field col s2 push-s1' style='display: " + timeTypeEl + "'>" +
              "<select>" +
                "<option value='global' " + timeGlobalSel + ">Global</option>" +
                "<option value='individual' " + timeIndividualSel + ">Individual</option>" +
              "</select>" +
              "<label>Time Type</label>" +
            "</div>" +
            "<div id='timeFormatEl' class='input-field col s5 push-s1' style='display: " + timeFormatEl + "'>" +
              "<input id='TimeFormat" + n + "' type='text' class='validate' value='" + ((typeof d.time != "undefined") ? d.time.format : "%Y-%m-%dT%H:%M:%SZ") + "'>" +
              "<label for='TimeFormat" + n + "'>Time Format</label>" +
            "</div>" +
            "<div id='timeRefreshEl' class='input-field col s2 push-s1' style='display: " + timeRefreshEl + "'>" +
              "<input id='TimeRefresh" + n + "' type='text' class='validate' value='" + ((typeof d.time != "undefined") ? d.time.refresh : "") + "'>" +
              "<label for='TimeRefresh" + n + "'>Time Refresh</label>" +
            "</div>" +
            "<div id='timeIncrementEl' class='input-field col s2 push-s1' style='display: " + timeIncrementEl + "'>" +
              "<input id='TimeIncrement" + n + "' type='text' class='validate' value='" + ((typeof d.time != "undefined") ? d.time.increment : "") + "'>" +
              "<label for='TimeIncrement" + n + "'>Time Increment</label>" +
            "</div>" +
          "</div>" +

          //Vector tile options
          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='vtIdEl' class='input-field col s5 push-s1' style='display: " + vtIdEl + "'>" +
              "<input id='vtId" + n + "' type='text' class='validate' value='" + dStyle.vtId + "'>" +
              "<label for='vtId" + n + "'>Vector Tile Feature Unique Id Key</label>" +
            "</div>" +
            "<div id='vtKeyEl' class='input-field col s5 push-s1' style='display: " + vtKeyEl + "'>" +
              "<input id='vtKey" + n + "' type='text' class='validate' value='" + dStyle.vtKey + "'>" +
              "<label for='vtKey" + n + "'>Use Key as Name</label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='vtLayerEl' class='input-field col s10 push-s1' style='display: " + vtLayerEl + "'>" +
              "<span>Vector Tile Stylings:</span>" +
              "<textarea id='t" + n + "_var'></textarea>" +
            "</div>" +
          "</div>" +

          //Style
          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='strcolEl' class='input-field col s2 push-s1' style='display: " + strcolEl + "'>" +
              "<input id='Strcol" + n + "' type='text' class='validate' value='" + dStyle.color + "'>" +
              "<label for='Strcol" + n + "'>Stroke Color</label>" +
            "</div>" +
            "<div id='filcolEl' class='input-field col s2 push-s1' style='display: " + filcolEl + "'>" +
              "<input id='Filcol" + n + "' type='text' class='validate' value='" + dStyle.fillColor + "'>" +
              "<label for='Filcol" + n + "'>Fill Color</label>" +
            "</div>" +
            "<div id='weightEl' class='input-field col s2 push-s1' style='display: " + weightEl + "'>" +
              "<input id='Weight" + n + "' type='text' class='validate' value='" + dStyle.weight + "'>" +
              "<label for='Weight" + n + "'>Stroke Weight</label>" +
            "</div>" +
            "<div id='opacityEl' class='input-field col s2 push-s1' style='display: " + opacityEl + "'>" +
              "<input id='Opacity" + n + "' type='text' class='validate' value='" + dStyle.fillOpacity + "'>" +
              "<label for='Opacity" + n + "'>Fill Opacity</label>" +
            "</div>" +
            "<div id='radiusEl' class='input-field col s2 push-s1' style='display: " + radiusEl + "'>" +
              "<input id='Radius" + n + "' type='text' class='validate' value='" + ( d.radius || "" ) + "'>" +
              "<label for='Radius" + n + "'>Radius</label>" +
            "</div>" +
          "</div>" +

          "<div class='row' style='margin-bottom: 0px;'>" +
            "<div id='variableEl' class='input-field col s10 push-s1' style='display: " + variableEl + "'>" +
              "<span>Raw Variables:</span>" + 
              "<textarea id='Variable" + n + "'></textarea>" +
            "</div>" +
          "</div>" +

        "</p>" +
      "</div>" +

      "<div class='modal-footer' style='background-color: " + barColor + "; display: flex; justify-content: space-between;'>" +
        "<a id='delete_layer' href='#!' class='modal-action modal-close waves-effect waves-red btn-flat left' style='color: white;'>Delete</a>" +
        "<div id='xmlEl' class='waves-effect btn-flat left' style='color: #111; background: #fafafa; display:" + xmlEl + ";' onclick='tilelayerPopulateFromXML(" + n + ")'>Populate from XML</div>" +
        "<div id='layerSetVariableEl' class='waves-effect btn-flat left' style='color: #111; background: #fafafa; display:" + variableEl + "; text-align: center;' onclick='layerPopulateVariable(" + n + ",\"" + d.type + "\")'>Set default Variables</div>" +
        "<div id='vtLayerSetStylesEl' class='waves-effect btn-flat left' style='color: #111; background: #fafafa; display:" + vtLayerSetStylesEl + "; text-align: center;' onclick='vtlayerPopulateStyle(" + n + ")'>Setup Styles with Layer Names from metadata.json</div>" +
        "<a href='#!' class='modal-action modal-close waves-effect waves-green btn-flat' style='color: white;'>Done</a>" +
      "</div>" +
    "</div>"
  );

  if (layerEditors[n]) layerEditors[n].setValue("");
  layerEditors[n] = CodeMirror.fromTextArea(
    document.getElementById("t" + n + "_var"),
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
  if (dStyle.vtLayer)
    layerEditors[n].setValue(JSON.stringify(dStyle.vtLayer, null, 4));

  if (layerEditors["Variable" + n]) layerEditors["Variable" + n].setValue("");
  layerEditors["Variable" + n] = CodeMirror.fromTextArea(
    document.getElementById("Variable" + n),
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
  if (d.variables)
    layerEditors["Variable" + n].setValue(JSON.stringify(d.variables, null, 4));
}

//Extend jQuery functionality to allow for an x-axis draggable that snaps with
// materialize rows // offs to avoid duplicates
$.fn.extend({
  mmgisLinkModalsToLayers: function () {
    $(this)
      .children(".modal")
      .each(function () {
        //Link Name
        $(this)
          .find("#nameEl")
          .off("change", mmgisLinkModalsToLayersNameChange);
        $(this).find("#nameEl").on("change", mmgisLinkModalsToLayersNameChange);

        //Link Type with color and available fields
        $(this)
          .find("#typeEl")
          .off("change", mmgisLinkModalsToLayersTypeChange);
        $(this).find("#typeEl").on("change", mmgisLinkModalsToLayersTypeChange);

        //Link visibility with icon
        $(this).find("#visEl").off("change", mmgisLinkModalsToLayersVisChange);
        $(this).find("#visEl").on("change", mmgisLinkModalsToLayersVisChange);

        //Link time with icon
        // $(this).find("#timeEl").off("change", mmgisLinkModalsToLayersTimeChange);
        // $(this).find("#timeEl").on("change", mmgisLinkModalsToLayersTimeChange);

        //Make delete delete
        $(this)
          .find("#delete_layer")
          .off("click", mmgisLinkModalsToLayersDeleteClick);
        $(this)
          .find("#delete_layer")
          .on("click", mmgisLinkModalsToLayersDeleteClick);

        $(this).find(".clone").off("click", mmgisLinkModalsToLayersCloneClick);
        $(this).find(".clone").on("click", mmgisLinkModalsToLayersCloneClick);
      });
  },
  materializeDraggable: function () {
    $(this)
      .children("li")
      .each(function () {
        $(this).children("a").off("mouseup", materializeDraggableMouseUp);
        $(this).children("a").on("mouseup", materializeDraggableMouseUp);
      });
  },
});

function mmgisLinkModalsToLayersNameChange(e) {
  var mainThis = $(this).parent().parent().parent();
  var mainId = mainThis.attr("id");
  mainId = mainId.substring(mainId.indexOf("_") + 1);
  //Change modal title name
  mainThis.find("#modal_name").html($(this).children("input").val());
  //Change layer bar name
  $("#layers_rows_" + mainId + " .l_title").html(
    $(this).children("input").val()
  );
}
function mmgisLinkModalsToLayersTypeChange(e) {
  var mainThis = $(this).parent().parent().parent();
  var mainId = mainThis.attr("id");
  mainId = mainId.substring(mainId.indexOf("_") + 1);

  var barColor = "#000"; //default black

  // prettier-ignore
  var nameEl = "block", kindEl = "block", typeEl = "block", urlEl = "block", demtileurlEl = "block", demparserEl = "block", controlledEl = "none", legendEl = "block",
      tileformatEl = "block", visEl = "block", viscutEl = "block", initOpacEl = "block", togwheadEl = "block", minzEl = "block",
      modelLonEl = "block", modelLatEl = "block", modelElevEl = "block",
      modelRotXEl = "block", modelRotYEl = "block", modelRotZEl = "block", modelScaleEl = "block",
      maxnzEl = "block", maxzEl = "block", strcolEl = "block", filcolEl = "block",
      weightEl = "block", opacityEl = "block", radiusEl = "block", variableEl = "block",
      vtLayerEl = "none", vtIdEl = "none", vtKeyEl = "none", vtLayerSetStylesEl = "none",
      timeEl = 'block', timeTypeEl = 'block', timeFormatEl = 'block', timeRefreshEl = 'none', timeIncrementEl = 'none';
  //Kind of a repeat of above =\

  // prettier-ignore
  switch( $( this ).find( "select option:selected" ).val().toLowerCase() ) {
    case "header": barColor = "#505050";
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "none"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "none"; legendEl = "none";
        tileformatEl = "none"; visEl = "block"; viscutEl = "none"; initOpacEl = "none"; togwheadEl = "none"; minzEl = "none"; maxnzEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxzEl = "none"; strcolEl = "none"; filcolEl = "none"; weightEl = "none";
        opacityEl = "none"; radiusEl = "none"; variableEl = "none";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none"; 
        timeEl = 'none'; timeTypeEl = 'none'; timeFormatEl = 'none'; timeRefreshEl = 'none'; timeIncrementEl = 'none';
      break;
    case "tile": barColor = "rgb(119, 15, 189)";
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "block"; demtileurlEl = "block"; demparserEl = "block"; controlledEl = "none"; legendEl = "block";
        tileformatEl = "block"; visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "block"; maxnzEl = "block";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxzEl = "block"; strcolEl = "none"; filcolEl = "none"; weightEl = "none";
        opacityEl = "none"; radiusEl = "none"; variableEl = "none";
        xmlEl = "block"; bbEl = "block"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = 'block'; timeTypeEl = 'block'; timeFormatEl = 'block'; timeRefreshEl = 'none'; timeIncrementEl = 'none';
      break;
    case "vectortile": barColor = "#bd0f8e";
        nameEl = "block"; kindEl = "block"; typeEl = "block"; urlEl = "block"; demtileurlEl = "block"; demparserEl = "block"; controlledEl = "none"; legendEl = "block";
        tileformatEl = "block"; visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "block"; maxnzEl = "block";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxzEl = "block"; strcolEl = "none"; filcolEl = "none"; weightEl = "none";
        opacityEl = "none"; radiusEl = "none"; variableEl = "block";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "block"; vtIdEl = "block"; vtKeyEl = "block"; vtLayerSetStylesEl = "block";  
        timeEl = 'block'; timeTypeEl = 'block'; timeFormatEl = 'block'; timeRefreshEl = 'none'; timeIncrementEl = 'none';
      break;
    case "data": barColor = "rgb(189, 15, 50)";
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "none"; demtileurlEl = "block"; demparserEl = "block"; controlledEl = "none"; legendEl = "block";
        tileformatEl = "none"; visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "block"; maxnzEl = "block";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxzEl = "block"; strcolEl = "none"; filcolEl = "none"; weightEl = "none";
        opacityEl = "none"; radiusEl = "none"; variableEl = "block";
        xmlEl = "block"; bbEl = "block"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = 'block'; timeTypeEl = 'block'; timeFormatEl = 'block'; timeRefreshEl = 'none'; timeIncrementEl = 'none';  
      break;
    case "point": barColor = "#892f45";
        nameEl = "block"; kindEl = "block"; typeEl = "block"; urlEl = "block"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "none"; legendEl = "block";
        tileformatEl = "none"; visEl = "block"; viscutEl = "block"; initOpacEl = "block"; togwheadEl = "block"; minzEl = "none"; maxnzEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxzEl = "none"; strcolEl = "block"; filcolEl = "block"; weightEl = "block";
        opacityEl = "block"; radiusEl = "block"; variableEl = "block";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = 'block'; timeTypeEl = 'block'; timeFormatEl = 'block'; timeRefreshEl = 'none'; timeIncrementEl = 'none';
      break;
    case "vector": barColor = "rgb(15, 119, 189)";
        nameEl = "block"; kindEl = "block"; typeEl = "block"; urlEl = "block"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "block"; legendEl = "block";
        tileformatEl = "none"; visEl = "block"; viscutEl = "block"; initOpacEl = "block"; togwheadEl = "none"; minzEl = "none"; maxnzEl = "none";
        modelLonEl = "none"; modelLatEl = "none"; modelElevEl = "none";
        modelRotXEl = "none"; modelRotYEl = "none"; modelRotZEl = "none"; modelScaleEl = "none";
        maxzEl = "none"; strcolEl = "block"; filcolEl = "block"; weightEl = "block";
        opacityEl = "block"; radiusEl = "block"; variableEl = "block";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = 'block'; timeTypeEl = 'block'; timeFormatEl = 'block'; timeRefreshEl = 'none'; timeIncrementEl = 'none';
      break;
    case "model": barColor = "rgb(189, 189, 15)";
        nameEl = "block"; kindEl = "none"; typeEl = "block"; urlEl = "block"; demtileurlEl = "none"; demparserEl = "none"; controlledEl = "none"; legendEl = "none";
        tileformatEl = "none"; visEl = "block"; viscutEl = "none"; initOpacEl = "block"; togwheadEl = "none"; minzEl = "none"; maxnzEl = "none"; 
        modelLonEl = "block"; modelLatEl = "block"; modelElevEl = "block";
        modelRotXEl = "block"; modelRotYEl = "block"; modelRotZEl = "block"; modelScaleEl = "block";
        maxzEl = "none"; strcolEl = "none"; filcolEl = "none"; weightEl = "none";
        opacityEl = "none"; radiusEl = "none"; variableEl = "none";
        xmlEl = "none"; bbEl = "none"; vtLayerEl = "none"; vtIdEl = "none"; vtKeyEl = "none"; vtLayerSetStylesEl = "none";
        timeEl = 'block'; timeTypeEl = 'block'; timeFormatEl = 'block'; timeRefreshEl = 'none'; timeIncrementEl = 'none';
      break;
    default:
      console.warn(`Unknown selected layer type`)
  }

  //Set modal bottom color
  mainThis.find(".modal-footer").css("background-color", barColor);
  //Set layer bar color
  $("#layers_rows_" + mainId).css("background-color", barColor);
  //Set available fields to display
  mainThis.find("#nameEl").css("display", nameEl);
  mainThis.find("#typeEl").css("display", typeEl);
  mainThis.find("#kindEl").css("display", kindEl);
  if (kindEl == "none")
    mainThis.find("#nameEl").removeClass("s6").addClass("s8");
  else mainThis.find("#nameEl").removeClass("s8").addClass("s6");
  mainThis.find("#urlEl").css("display", urlEl);
  mainThis.find("#demtileurlEl").css("display", demtileurlEl);
  mainThis.find("#demparserEl").css("display", demparserEl);
  mainThis.find("#controlledEl").css("display", controlledEl);
  mainThis.find("#legendEl").css("display", legendEl);
  mainThis.find("#tileformatEl").css("display", tileformatEl);
  mainThis.find("#visEl").css("display", visEl);
  mainThis.find("#viscutEl").css("display", viscutEl);
  mainThis.find("#initOpacEl").css("display", initOpacEl);
  //mainThis.find("#togwheadEl").css("display", togwheadEl);
  mainThis.find("#minzEl").css("display", minzEl);
  mainThis.find("#maxnzEl").css("display", maxnzEl);
  mainThis.find("#maxzEl").css("display", maxzEl);
  mainThis.find("#modelLonEl").css("display", modelLonEl);
  mainThis.find("#modelLatEl").css("display", modelLatEl);
  mainThis.find("#modelElevEl").css("display", modelElevEl);
  mainThis.find("#modelRotXEl").css("display", modelRotXEl);
  mainThis.find("#modelRotYEl").css("display", modelRotYEl);
  mainThis.find("#modelRotZEl").css("display", modelRotZEl);
  mainThis.find("#modelScaleEl").css("display", modelScaleEl);
  mainThis.find("#strcolEl").css("display", strcolEl);
  mainThis.find("#filcolEl").css("display", filcolEl);
  mainThis.find("#weightEl").css("display", weightEl);
  mainThis.find("#opacityEl").css("display", opacityEl);
  mainThis.find("#radiusEl").css("display", radiusEl);
  mainThis.find("#variableEl").css("display", variableEl);
  mainThis.find("#xmlEl").css("display", xmlEl);
  mainThis.find("#bbEl").css("display", bbEl);
  mainThis.find("#vtLayerEl").css("display", vtLayerEl);
  mainThis.find("#vtIdEl").css("display", vtIdEl);
  mainThis.find("#vtKeyEl").css("display", vtKeyEl);
  mainThis.find("#vtLayerSetStylesEl").css("display", vtLayerSetStylesEl);
  mainThis.find("#timeEl").css("display", timeEl);
  mainThis.find("#timeTypeEl").css("display", timeTypeEl);
  mainThis.find("#timeFormatEl").css("display", timeFormatEl);
  mainThis.find("#timeRefreshEl").css("display", timeRefreshEl);
  mainThis.find("#timeIncrementEl").css("display", timeIncrementEl);
}
function mmgisLinkModalsToLayersVisChange(e) {
  var mainThis = $(this).parent().parent().parent();
  var mainId = mainThis.attr("id");
  mainId = mainId.substring(mainId.indexOf("_") + 1);

  if ($(this).find("select option:selected").text().toLowerCase() == "true") {
    $("#layers_rows_" + mainId + " .l_icon").css({ display: "inherit" });
  } else {
    $("#layers_rows_" + mainId + " .l_icon").css({ display: "none" });
  }
}
function mmgisLinkModalsToLayersDeleteClick(e) {
  var mainThis = $(this).parent().parent();
  var mainId = mainThis.attr("id");
  mainId = mainId.substring(mainId.indexOf("_") + 1);

  $("#layers_rows_" + mainId)
    .parent()
    .remove();
  mainThis.remove();
  $(".lean-overlay").remove();
}

function mmgisLinkModalsToLayersCloneClick(e) {
  var mainThis = $(this).parent().parent().parent();
  var mainId = mainThis.attr("id");
  mainId = mainId.substring(mainId.indexOf("_") + 1);
  makeLayerBarAndModal(
    dataOfLastUsedLayerSlot[mainId],
    dataOfLastUsedLayerSlot[mainId].__level
  );

  refresh();
}

function materializeDraggableMouseUp(e) {
  //Find out where the left edge of the bar lands relative to the layer tab
  //12 because materialize uses a 12 col system
  //console.log( $(this).parent().parent().width() )
  var colWidth = ($(this).parent().parent().width() - 304) / 12;

  var layerBarLoc =
    $(this).offset().left - 150 - $(this).parent().parent().offset().left;
  var bestColumn = parseInt(layerBarLoc / colWidth);
  if (bestColumn < 1) bestColumn = 1;
  if (bestColumn > 10) bestColumn = 10;

  var classString = $(this).attr("class").split(" ");
  var classS = classString[classString.length - 2];
  var classPush = classString[classString.length - 1];
  $(this).removeClass(classS);
  $(this).addClass("s" + (11 - bestColumn));
  $(this).removeClass(classPush);
  $(this).addClass("push-s" + bestColumn);
}

//Save Changes
//Reconstructs JSON from html (doesn't modify the initial json directly)
function save() {
  if (missionPath.length > 0) {
    var json = {
      msv: {},
      projection: {},
      look: {},
      panels: [],
      tools: [],
      layers: [],
      time: {},
    };
    var prevIndentations = [];
    var prevLayerObjects = [];

    //Validity checks
    var isInvalidData = false;
    var isNonHeader = false;
    var arrayOfName = []; //names must be unique

    //Initial
    json.msv["mission"] = $("#tab_initial_rows #imission").val();
    json.msv["site"] = $("#tab_initial_rows #isite").val();
    json.msv["masterdb"] = $("#tab_initial #idb").prop("checked");
    json.msv["view"] = [
      $("#tab_initial_rows #ilat").val(),
      $("#tab_initial_rows #ilon").val(),
      $("#tab_initial_rows #izoom").val(),
    ];
    json.msv["radius"] = {};
    json.msv["radius"]["major"] = $("#tab_initial_rows #iradMaj").val();
    json.msv["radius"]["minor"] = $("#tab_initial_rows #iradMin").val();
    json.msv["mapscale"] = $("#tab_initial_rows #imapScale").val();
    //Projection
    json.projection["custom"] = usingCustomProjection;
    json.projection["epsg"] = $("#tab_projection #projection_epsg").val();
    json.projection["proj"] = $("#tab_projection #projection_proj").val();
    json.projection["globeproj"] = $(
      "#tab_projection #projection_globeProj"
    ).val();
    json.projection["xmlpath"] = $("#tab_projection #projection_xmlPath").val();
    json.projection["bounds"] = [
      $("#tab_projection #projection_boundsMinX").val(),
      $("#tab_projection #projection_boundsMinY").val(),
      $("#tab_projection #projection_boundsMaxX").val(),
      $("#tab_projection #projection_boundsMaxY").val(),
    ];
    json.projection["origin"] = [
      $("#tab_projection #projection_originX").val(),
      $("#tab_projection #projection_originY").val(),
    ];
    json.projection["reszoomlevel"] = $(
      "#tab_projection #projection_resZ"
    ).val();
    json.projection["resunitsperpixel"] = $(
      "#tab_projection #projection_res"
    ).val();
    //Look
    json.look["pagename"] = $("#tab_look #look_pagename").val();
    json.look["minimalist"] = $("#tab_look #look_minimalist").prop("checked");
    json.look["zoomcontrol"] = $("#tab_look #look_zoomcontrol").prop("checked");
    json.look["graticule"] = $("#tab_look #look_graticule").prop("checked");
    //look coords
    json.look["coordll"] = $("#tab_look #look_coordll").prop("checked");
    json.look["coorden"] = $("#tab_look #look_coorden").prop("checked");
    json.look["coordrxy"] = $("#tab_look #look_coordrxy").prop("checked");
    json.look["coordsite"] = $("#tab_look #look_coordsite").prop("checked");
    json.look["coordelev"] = $("#tab_look #look_coordelev").prop("checked");
    json.look["coordelevurl"] = $("#tab_look #look_coordelevurl").val();
    //look colors
    json.look["primarycolor"] = $("#tab_look #look_primarycolor").val();
    json.look["secondarycolor"] = $("#tab_look #look_secondarycolor").val();
    json.look["tertiarycolor"] = $("#tab_look #look_tertiarycolor").val();
    json.look["accentcolor"] = $("#tab_look #look_accentcolor").val();
    json.look["bodycolor"] = $("#tab_look #look_bodycolor").val();
    json.look["topbarcolor"] = $("#tab_look #look_topbarcolor").val();
    json.look["toolbarcolor"] = $("#tab_look #look_toolbarcolor").val();
    json.look["mapcolor"] = $("#tab_look #look_mapcolor").val();
    json.look["highlightcolor"] = $("#tab_look #look_highlightcolor").val();

    json.look["copylink"] = $("#tab_look #look_copylink").prop("checked");
    json.look["screenshot"] = $("#tab_look #look_screenshot").prop("checked");
    json.look["fullscreen"] = $("#tab_look #look_fullscreen").prop("checked");
    json.look["help"] = $("#tab_look #look_help").prop("checked");
    json.look["logourl"] = $("#tab_look #look_logourl").val();
    json.look["helpurl"] = $("#tab_look #look_helpurl").val();

    //Panels
    if ($("#tab_panels #panels_viewer").prop("checked"))
      json.panels.push("viewer");
    if ($("#tab_panels #panels_map").prop("checked")) json.panels.push("map");
    if ($("#tab_panels #panels_globe").prop("checked"))
      json.panels.push("globe");
    //Time
    if ($("#tab_time #time_enabled").prop("checked")) {
      json.time.enabled = true;
    } else {
      json.time.enabled = false;
    }
    if ($("#tab_time #time_visible").prop("checked")) {
      json.time.visible = true;
    } else {
      json.time.visible = false;
    }
    json.time.format = $("#tab_time #time_format").val();
    //Tools
    for (var i = 0; i < tData.length; i++) {
      if ($("#tab_tools #tools_" + tData[i].name).prop("checked")) {
        var toolsjson = { name: "", icon: "", js: "" };
        toolsjson.name = tData[i].name;
        toolsjson.icon = $("#t" + tData[i].name + "icon input").val();
        toolsjson.js = tData[i].name + "Tool";
        if (editors.hasOwnProperty(tData[i].name)) {
          var editorVal = editors[tData[i].name].getValue();
          if (editorVal.length > 0) {
            var editorText = editors[tData[i].name].getValue();
            if (editorText.indexOf("'") > -1) {
              Materialize.toast(
                "<span id='toast_warninget1'>Error: " +
                  tData[i].name +
                  " tool json contains single quotes. Single quotes are not valid json.</span>",
                5000
              );
              $("#toast_warninget1")
                .parent()
                .css("background-color", "#a11717");
              return;
            }
            toolsjson["variables"] = JSON.parse(
              editors[tData[i].name].getValue()
            );
          }
        }
        json.tools.push(toolsjson);
      }
    }
    //Layers
    //Iterate over actual layer rows and not modals (which is where the data is)
    // because modals aren't ordered.
    $("#tab_layers_rows")
      .children("li")
      .each(function () {
        var layerObject = {};
        //Get layer row identation
        var layerRow = $(this).find("a");
        var indentation = layerRow.attr("class").split(" ");
        indentation = indentation[indentation.length - 1];
        indentation = parseInt(indentation.substring(6));
        //Find corresponding modal
        var modal = $($(this).find("a").attr("href"));

        var modalId = modal.attr("modalId");
        var modalName = modal.find("#nameEl input").val();
        var modalKind = modal
          .find("#kindEl select option:selected")
          .val()
          .toLowerCase();
        var modalType = modal
          .find("#typeEl select option:selected")
          .val()
          .toLowerCase();
        var modalUrl = modal.find("#urlEl input").val();
        var modaldemtileUrl = modal.find("#demtileurlEl input").val();
        var modaldemparser = modal
          .find("#demparserEl select option:selected")
          .val()
          .toLowerCase();
        var modalControlledEl = modal
          .find("#controlledEl input")
          .is(":checked");
        var modalLegend = modal.find("#legendEl input").val();
        var modalTileFormat = modal
          .find("#tileformatEl select option:selected")
          .text()
          .toLowerCase();
        var modalVis = modal
          .find("#visEl select option:selected")
          .text()
          .toLowerCase();
        if (modalVis == "true") modalVis = true;
        else modalVis = false;
        var modalViscut = parseInt(modal.find("#viscutEl input").val());
        var modalInitOpac = parseFloat(modal.find("#initOpacEl input").val());
        var modalTogwhead = modal
          .find("#togwheadEl select option:selected")
          .text()
          .toLowerCase();
        if (modalTogwhead == "true") modalTogwhead = true;
        else modalTogwhead = false;
        var modalMinz = parseInt(modal.find("#minzEl input").val());
        var modalMaxnz = parseInt(modal.find("#maxnzEl input").val());
        var modalMaxz = parseInt(modal.find("#maxzEl input").val());
        var modalModelLon = parseFloat(modal.find("#modelLonEl input").val());
        var modalModelLat = parseFloat(modal.find("#modelLatEl input").val());
        var modalModelElev = parseFloat(modal.find("#modelElevEl input").val());
        var modalModelRotX = parseFloat(modal.find("#modelRotXEl input").val());
        var modalModelRotY = parseFloat(modal.find("#modelRotYEl input").val());
        var modalModelRotZ = parseFloat(modal.find("#modelRotZEl input").val());
        var modalModelScale = parseFloat(
          modal.find("#modelScaleEl input").val()
        );
        var styleName = modalName.replace(/ /g, "").toLowerCase();
        var styleStrcol = modal.find("#strcolEl input").val();
        var styleFilcol = modal.find("#filcolEl input").val();
        var styleWeight = parseInt(modal.find("#weightEl input").val());
        var styleOpacity = parseFloat(modal.find("#opacityEl input").val());
        var styleRadius = parseInt(modal.find("#radiusEl input").val());
        var modalVariable = layerEditors["Variable" + modalId]
          ? layerEditors["Variable" + modalId].getValue() || "{}"
          : "{}";
        var modalBB = modal.find("#bbEl input").val();
        var modalVtLayer =
          modalType == "vectortile" && layerEditors[modalId]
            ? JSON.parse(layerEditors[modalId].getValue() || "{}")
            : {};
        var modalVtId = modal.find("#vtIdEl input").val();
        var modalVtKey = modal.find("#vtKeyEl input").val();
        var modalTime = modal
          .find("#timeEl select option:selected")
          .text()
          .toLowerCase();
        if (modalTime == "true") modalTime = true;
        else modalTime = false;
        var modalTimeType = modal
          .find("#timeTypeEl select option:selected")
          .text()
          .toLowerCase();
        var modalTimeFormat = modal.find("#timeFormatEl input").val();

        layerObject.name = modalName;
        if (
          modalType == "vectortile" ||
          modalType == "vector" ||
          modalType == "point"
        ) {
          layerObject.kind = modalKind;
        }
        layerObject.type = modalType;
        if (modalUrl != "undefined") layerObject.url = modalUrl;
        if (modalUrl == "undefined" && modalControlledEl) layerObject.url = "";
        if (modaldemtileUrl != "undefined")
          layerObject.demtileurl = modaldemtileUrl;
        if (modaldemparser != "undefined")
          layerObject.demparser = modaldemparser;
        if (modalControlledEl != "undefined")
          layerObject.controlled = modalControlledEl;
        if (modalLegend != "undefined" && modalLegend != "")
          layerObject.legend = modalLegend;
        if (modalTileFormat != "undefined")
          layerObject.tileformat = modalTileFormat;
        if (modalType != "header") layerObject.visibility = modalVis;
        if (!isNaN(modalViscut)) layerObject.visibilitycutoff = modalViscut;
        if (!isNaN(modalInitOpac)) layerObject.initialOpacity = modalInitOpac;
        if (modalType != "header")
          layerObject.togglesWithHeader = modalTogwhead;
        if (!isNaN(modalMinz)) layerObject.minZoom = modalMinz;
        if (!isNaN(modalMaxnz)) layerObject.maxNativeZoom = modalMaxnz;
        if (!isNaN(modalMaxz)) layerObject.maxZoom = modalMaxz;
        if (typeof modalBB === "string") {
          modalBB = modalBB.replace(/[\[\]']+/g, "");
          modalBB = modalBB.split(",").map(Number);
          if (modalBB.length === 4) layerObject.boundingBox = modalBB;
        }
        if (modalType == "model") {
          layerObject.position = {};
          layerObject.position.longitude = !isNaN(modalModelLon)
            ? modalModelLon
            : 0;
          layerObject.position.latitude = !isNaN(modalModelLat)
            ? modalModelLat
            : 0;
          layerObject.position.elevation = !isNaN(modalModelElev)
            ? modalModelElev
            : 0;
          layerObject.rotation = {};
          layerObject.rotation.x = !isNaN(modalModelRotX) ? modalModelRotX : 0;
          layerObject.rotation.y = !isNaN(modalModelRotY) ? modalModelRotY : 0;
          layerObject.rotation.z = !isNaN(modalModelRotZ) ? modalModelRotZ : 0;
          layerObject.scale = !isNaN(modalModelScale) ? modalModelScale : 1;
        }
        if (
          modalType == "point" ||
          modalType == "vector" ||
          modalType == "vectortile" ||
          modalType == "data"
        ) {
          layerObject.style = {
            className: styleName,
            color: styleStrcol,
            fillColor: styleFilcol,
            weight: styleWeight,
            fillOpacity: styleOpacity,
            opacity: 1,
          };
          if (modalVariable != "undefined") {
            try {
              layerObject.variables = JSON.parse(modalVariable);
            } catch (e) {
              Materialize.toast(
                "<span id='toast_warningovparse1'>WARNING: Skipping badly formed raw variable JSON - " +
                  modalName +
                  "</span>",
                5000
              );
              $("#toast_warningovparse1")
                .parent()
                .css("background-color", "#a11717");
            }
          }
          layerObject.radius = 1;
          if (
            styleRadius != "" &&
            styleRadius != undefined &&
            !isNaN(styleRadius)
          ) {
            layerObject.radius = styleRadius;
          }
        }
        if (modalType == "vectortile") {
          layerObject.style = {};
          layerObject.style.color =
            styleStrcol == "undefined" ? null : styleStrcol || null;
          layerObject.style.fillColor =
            styleFilcol == "undefined" ? null : styleFilcol || null;
          layerObject.style.weight =
            styleWeight == "undefined" ? null : styleWeight || null;
          layerObject.style.fillOpacity =
            styleOpacity == "undefined" ? null : styleOpacity || null;
          layerObject.style.opacity = 1;
          layerObject.style.vtLayer =
            modalVtLayer == "undefined" ? null : modalVtLayer || {};
          layerObject.style.vtId =
            modalVtId == "undefined" ? null : modalVtId || null;
          layerObject.style.vtKey =
            modalVtKey == "undefined" ? null : modalVtKey || null;

          layerObject.radius = 1;
          if (
            styleRadius != "" &&
            styleRadius != undefined &&
            !isNaN(styleRadius)
          ) {
            layerObject.radius = styleRadius;
          }
        }

        // time properties
        layerObject.time = {};
        layerObject.time.enabled = modalTime; // static or timed
        layerObject.time.type = modalTimeType; // 'global or individual'
        layerObject.time.isRelative = true; // absolute or relative
        layerObject.time.current = new Date().toISOString().split(".")[0] + "Z"; // initial time
        layerObject.time.start = ""; // initial start
        layerObject.time.end = ""; // initial end
        layerObject.time.format = modalTimeFormat; // time string format
        layerObject.time.refresh = "1 hours"; // refresh when the layer becomes stale
        layerObject.time.increment = "5 minutes"; // time bar steps

        if (!validName(modalName)) {
          isInvalidData = true;
          Materialize.toast(
            "<span id='toast_warningov1'>WARNING: Invalid layer name - " +
              modalName +
              "</span>",
            5000
          );
          $("#toast_warningov1").parent().css("background-color", "#a11717");
        }

        //Check if data is properly filled out
        switch (modalType) {
          case "header":
            if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningh1'>WARNING: header with no name.</span>",
                5000
              );
              $("#toast_warningh1").parent().css("background-color", "#a11717");
            }
            break;
          case "tile":
            if (modalName == "undefined") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt1'>WARNING: tile with undefined name.</span>",
                5000
              );
              $("#toast_warningt1").parent().css("background-color", "#a11717");
            } else if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt2'>WARNING: tile with no name.</span>",
                5000
              );
              $("#toast_warningt2").parent().css("background-color", "#a11717");
            }
            if (modalUrl == "undefined" || modalUrl == "") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt3'>WARNING: " +
                  modalName +
                  " has undefined url.</span>",
                5000
              );
              $("#toast_warningt3").parent().css("background-color", "#a11717");
            }
            if (isNaN(modalMinz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt4'>WARNING: " +
                  modalName +
                  " has undefined minz.</span>",
                5000
              );
              $("#toast_warningt4").parent().css("background-color", "#a11717");
            } else if (modalMinz < 0) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt5'>WARNING: " +
                  modalName +
                  " has minz under 0.</span>",
                5000
              );
              $("#toast_warningt5").parent().css("background-color", "#a11717");
            }
            if (isNaN(modalMaxnz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt6'>WARNING: " +
                  modalName +
                  " has undefined maxnz.</span>",
                5000
              );
              $("#toast_warningt6").parent().css("background-color", "#a11717");
            }
            if (isNaN(modalMaxz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt7'>WARNING: " +
                  modalName +
                  " has undefined maxz.</span>",
                5000
              );
              $("#toast_warningt7").parent().css("background-color", "#a11717");
            }
            if (
              !isNaN(modalMinz) &&
              !isNaN(modalMaxnz) &&
              !isNaN(modalMaxz) &&
              modalMinz > modalMaxnz
            ) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt8'>WARNING: " +
                  modalName +
                  " has minz larger than maxnz.</span>",
                5000
              );
              $("#toast_warningt8").parent().css("background-color", "#a11717");
            }
            break;
          case "vectortile":
            if (modalName == "undefined") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningtv1'>WARNING: vector tile with undefined name.</span>",
                5000
              );
              $("#toast_warningvt1")
                .parent()
                .css("background-color", "#a11717");
            } else if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt2'>WARNING: vector tile with no name.</span>",
                5000
              );
              $("#toast_warningvt2")
                .parent()
                .css("background-color", "#a11717");
            }
            if (modalUrl == "undefined" || modalUrl == "") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt3'>WARNING: " +
                  modalName +
                  " has undefined url.</span>",
                5000
              );
              $("#toast_warningvt3")
                .parent()
                .css("background-color", "#a11717");
            }
            if (isNaN(modalMinz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt4'>WARNING: " +
                  modalName +
                  " has undefined minz.</span>",
                5000
              );
              $("#toast_warningvt4")
                .parent()
                .css("background-color", "#a11717");
            } else if (modalMinz < 0) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt5'>WARNING: " +
                  modalName +
                  " has minz under 0.</span>",
                5000
              );
              $("#toast_warningvt5")
                .parent()
                .css("background-color", "#a11717");
            }
            if (isNaN(modalMaxnz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt6'>WARNING: " +
                  modalName +
                  " has undefined maxnz.</span>",
                5000
              );
              $("#toast_warningvt6")
                .parent()
                .css("background-color", "#a11717");
            }
            if (isNaN(modalMaxz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt7'>WARNING: " +
                  modalName +
                  " has undefined maxz.</span>",
                5000
              );
              $("#toast_warningvt7")
                .parent()
                .css("background-color", "#a11717");
            }
            if (
              !isNaN(modalMinz) &&
              !isNaN(modalMaxnz) &&
              !isNaN(modalMaxz) &&
              modalMinz > modalMaxnz
            ) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningvt8'>WARNING: " +
                  modalName +
                  " has minz larger than maxnz.</span>",
                5000
              );
              $("#toast_warningvt8")
                .parent()
                .css("background-color", "#a11717");
            }
            break;
          case "data":
            if (modalName == "undefined") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt1'>WARNING: data with undefined name.</span>",
                5000
              );
              $("#toast_warningt1").parent().css("background-color", "#a11717");
            } else if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt2'>WARNING: data with no name.</span>",
                5000
              );
              $("#toast_warningdt2")
                .parent()
                .css("background-color", "#a11717");
            }
            if (isNaN(modalMinz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt4'>WARNING: " +
                  modalName +
                  " has undefined minz.</span>",
                5000
              );
              $("#toast_warningdt4")
                .parent()
                .css("background-color", "#a11717");
            } else if (modalMinz < 0) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt5'>WARNING: " +
                  modalName +
                  " has minz under 0.</span>",
                5000
              );
              $("#toast_warningdt5")
                .parent()
                .css("background-color", "#a11717");
            }
            if (isNaN(modalMaxnz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt6'>WARNING: " +
                  modalName +
                  " has undefined maxnz.</span>",
                5000
              );
              $("#toast_warningdt6")
                .parent()
                .css("background-color", "#a11717");
            }
            if (isNaN(modalMaxz)) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt7'>WARNING: " +
                  modalName +
                  " has undefined maxz.</span>",
                5000
              );
              $("#toast_warningdt7")
                .parent()
                .css("background-color", "#a11717");
            }
            if (
              !isNaN(modalMinz) &&
              !isNaN(modalMaxnz) &&
              !isNaN(modalMaxz) &&
              modalMinz > modalMaxnz
            ) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningt8'>WARNING: " +
                  modalName +
                  " has minz larger than maxnz.</span>",
                5000
              );
              $("#toast_warningdt8")
                .parent()
                .css("background-color", "#a11717");
            }
            break;
          case "point":
            if (modalName == "undefined") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningp1'>WARNING: point with undefined name.</span>",
                5000
              );
              $("#toast_warningp1").parent().css("background-color", "#a11717");
            } else if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningp2'>WARNING: point with no name.</span>",
                5000
              );
              $("#toast_warningp2").parent().css("background-color", "#a11717");
            }
            if (modalUrl == "undefined" || modalUrl == "") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningp3'>WARNING: " +
                  modalName +
                  " has undefined url.</span>",
                5000
              );
              $("#toast_warningp3").parent().css("background-color", "#a11717");
            }
            break;
          case "vector":
            if (modalName == "undefined") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningv1'>WARNING: vector with undefined name.</span>",
                5000
              );
              $("#toast_warningv1").parent().css("background-color", "#a11717");
            } else if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningv2'>WARNING: vector with no name.</span>",
                5000
              );
              $("#toast_warningv2").parent().css("background-color", "#a11717");
            }
            if (
              (modalUrl == "undefined" || modalUrl == "") &&
              !modalControlledEl
            ) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningv3'>WARNING: " +
                  modalName +
                  " has undefined url.</span>",
                5000
              );
              $("#toast_warningv3").parent().css("background-color", "#a11717");
            }
            break;
          case "model":
            if (modalName == "undefined") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningm1'>WARNING: model with undefined name.</span>",
                5000
              );
              $("#toast_warningm1").parent().css("background-color", "#a11717");
            } else if (modalName.length < 1) {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningv2'>WARNING: model with no name.</span>",
                5000
              );
              $("#toast_warningm2").parent().css("background-color", "#a11717");
            }
            if (modalUrl == "undefined" || modalUrl == "") {
              isInvalidData = true;
              Materialize.toast(
                "<span id='toast_warningm3'>WARNING: " +
                  modalName +
                  " has undefined url.</span>",
                5000
              );
              $("#toast_warningm3").parent().css("background-color", "#a11717");
            }
            if (
              isNaN(modalModelLon) ||
              isNaN(modalModelLat) ||
              isNaN(modalModelElev)
            ) {
              Materialize.toast(
                "<span id='toast_warningm4'>WARNING: " +
                  modalName +
                  " has invalid Lon, Lat, or Elev. Defaulting to 0.</span>",
                5000
              );
              $("#toast_warningm4").parent().css("background-color", "#aeae09");
            }
            if (
              isNaN(modalModelRotX) ||
              isNaN(modalModelRotY) ||
              isNaN(modalModelRotZ)
            ) {
              Materialize.toast(
                "<span id='toast_warningm5'>WARNING: " +
                  modalName +
                  " has invalid Rotation X, Y or Z. Defaulting to 0.</span>",
                5000
              );
              $("#toast_warningm5").parent().css("background-color", "#aeae09");
            }
            if (isNaN(modalModelScale)) {
              Materialize.toast(
                "<span id='toast_warningm6'>WARNING: " +
                  modalName +
                  " has invalid Scale. Defaulting to 0.</span>",
                5000
              );
              $("#toast_warningm6").parent().css("background-color", "#aeae09");
            }
            break;
          default:
            console.warn(`Unknown modal type: ${modalType}`);
        }

        //This is now the proper spelling and 'broke' is the misspelling
        var breaked = false;
        for (var i = prevIndentations.length - 1; i >= 0; i--) {
          if (indentation > prevIndentations[i]) {
            if (!prevLayerObjects[i].hasOwnProperty("sublayers")) {
              prevLayerObjects[i].sublayers = [];
            }
            prevLayerObjects[i].sublayers.push(layerObject);

            //Some validity checking
            if (prevLayerObjects[i].type != "header") {
              isNonHeader = true;
              console.warn(
                "WARNING! NON-HEADER has sublayers: " +
                  prevLayerObjects[i].name +
                  " holds " +
                  layerObject.name
              );
            }

            breaked = true;
            break;
          }
        }

        if (!breaked || prevIndentations.length == 0) {
          json.layers.push(layerObject);
        }

        prevIndentations.push(indentation);
        prevLayerObjects.push(layerObject);
      });
    if (isNonHeader) {
      Materialize.toast(
        "<span id='toast_warning'>WARNING: non-header(s).</span>",
        5000
      );
      $("#toast_warning").parent().css("background-color", "#a11717");
    }

    let duplicatedNames = getDuplicatedNames(json);
    if (duplicatedNames.length > 0) {
      Materialize.toast(
        `<span id='toast_warningdupn1'>ERROR: Layer names must be unique: ${duplicatedNames.join(
          ", "
        )}</span>`,
        5000
      );
      $("#toast_warningdupn1").parent().css("background-color", "#a11717");
      isInvalidData = true;
    }

    //SAVE HERE
    if (!isInvalidData && !isNonHeader) {
      saveConfig(json);
    } else {
      Materialize.toast("<span id='toast_failure'>Save Failed.</span>", 5000);
      $("#toast_failure").parent().css("background-color", "#a11717");
    }
  } else {
    Materialize.toast(
      "<span id='toast_warning'>No mission selected.</span>",
      5000
    );
    $("#toast_warning").parent().css("background-color", "#aeae09");
  }
}

function addMission() {
  var missionname = $("#tab_new_mission_rows #nmmission").val();

  if (missionname.length > 0) {
    if (!/^[\w\d\s-]+$/.test(missionname)) {
      Materialize.toast(
        "<span id='toast_failure6'>Don't use special characters in the mission name.</span>",
        5000
      );
      $("#toast_failure6").parent().css("background-color", "#a11717");
      return;
    }

    const makedir = $("#new_mission_makedir").prop("checked");

    $.ajax({
      type: calls.add.type,
      url: calls.add.url,
      data: {
        mission: missionname,
        makedir: makedir,
      },
      success: function (data) {
        if (data.status == "success") {
          Materialize.toast(
            "<span id='toast_success1'>Mission: " +
              missionname +
              " Created. Page will now reload...</span>",
            4000
          );
          $("#toast_success1").parent().css("background-color", "#1565C0");
          setTimeout(function () {
            location.reload();
          }, 4000);
        } else {
          Materialize.toast(
            "<span id='toast_failure7'>" + data["message"] + "</span>",
            5000
          );
          $("#toast_failure7").parent().css("background-color", "#a11717");
        }
      },
    });
  } else {
    Materialize.toast(
      "<span id='toast_failure4'>Please enter a new mission name.</span>",
      5000
    );
    $("#toast_failure4").parent().css("background-color", "#a11717");
  }
}

function saveConfig(json) {
  $.ajax({
    type: calls.upsert.type,
    url: calls.upsert.url,
    data: {
      mission: mission,
      config: JSON.stringify(json),
    },
    success: function (data) {
      if (data.status == "success") {
        Materialize.toast(
          "<span id='toast_success'>Save Successful.</span>",
          1600
        );
        $("#toast_success").parent().css("background-color", "#1565C0");
        /*
        Materialize.toast( "<span id='toast_success3'>Page will now reload...</span>" , 4000);
        $( "#toast_success3" ).parent().css("background-color", "#1565C0");
        setTimeout( function() { location.reload(); }, 4000 );
        */
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

function projectionPopulateFromXML() {
  var xmlPath = "../" + $("#tab_projection #projection_xmlPath").val();
  $.ajax({
    type: "GET",
    url: xmlPath,
    dataType: "xml",
    success: function (xml) {
      try {
        $("#tab_projection #projection_boundsMinX").val(
          $(xml).find("BoundingBox")[0].attributes["minx"].value
        );
        $("#tab_projection #projection_boundsMinY").val(
          $(xml).find("BoundingBox")[0].attributes["miny"].value
        );
        $("#tab_projection #projection_boundsMaxX").val(
          $(xml).find("BoundingBox")[0].attributes["maxx"].value
        );
        $("#tab_projection #projection_boundsMaxY").val(
          $(xml).find("BoundingBox")[0].attributes["maxy"].value
        );
        $("#tab_projection #projection_originX").val(
          $(xml).find("Origin")[0].attributes["x"].value
        );
        $("#tab_projection #projection_originY").val(
          $(xml).find("Origin")[0].attributes["y"].value
        );
        $("#tab_projection #projection_resZ").val(
          $(xml).find("TileSet")[0].attributes["order"].value
        );
        $("#tab_projection #projection_res").val(
          $(xml).find("TileSet")[0].attributes["units-per-pixel"].value
        );
      } catch (e) {
        // prettier-ignore
        console.warn( 'XML missing one or more of the following:\n' +
                      '    BoundingBox <minx> <miny> <maxx> <maxy>\n' + 
                      '    Origin      <x> <y>\n' + 
                      '    TileSet     <units-per-pixel> <order>' );
      }
      Materialize.updateTextFields();
    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      Materialize.toast(
        "<span id='toast_failure_populateXML'>Failed to Populate From XML</span>",
        5000
      );
      $("#toast_failure_populateXML")
        .parent()
        .css("background-color", "#a11717");
    },
  });
}
function projectionToggleCustom(force) {
  if (typeof force === "boolean") usingCustomProjection = force;
  else usingCustomProjection = !usingCustomProjection;

  if (usingCustomProjection) {
    $("#tab_projection #projection_toggleCustom").switchClass(
      "red",
      "light-green"
    );
    $("#tab_projection #projection_toggleCustom i").switchClass(
      "mdi-close",
      "mdi-check"
    );
    $("#tab_projection #projection_toggleCustom span").text(
      "Using CUSTOM Projection"
    );
  } else {
    $("#tab_projection #projection_toggleCustom").switchClass(
      "light-green",
      "red"
    );
    $("#tab_projection #projection_toggleCustom i").switchClass(
      "mdi-check",
      "mdi-close"
    );
    $("#tab_projection #projection_toggleCustom span").text(
      "Using DEFAULT Projection"
    );
  }
}

function tilelayerPopulateFromXML(modalId) {
  var xmlPath = $("#Url" + modalId).val();
  xmlPath = xmlPath.replace("{z}/{x}/{y}.png", "tilemapresource.xml");
  xmlPath = missionPath.replace("config.json", "") + xmlPath;
  $.ajax({
    type: "GET",
    url: xmlPath,
    dataType: "xml",
    success: function (xml) {
      try {
        var tLen = $(xml).find("TileSet").length;
        var minzValue = $(xml).find("TileSet")[0].attributes["order"].value;
        var maxnzValue =
          $(xml).find("TileSet")[tLen - 1].attributes["order"].value;
        var bbValue =
          $(xml).find("BoundingBox")[0].attributes["minx"].value +
          "," +
          $(xml).find("BoundingBox")[0].attributes["miny"].value +
          "," +
          $(xml).find("BoundingBox")[0].attributes["maxx"].value +
          "," +
          $(xml).find("BoundingBox")[0].attributes["maxy"].value;

        $("#Minz" + modalId).val(minzValue);
        $("#Maxnz" + modalId).val(maxnzValue);
        $("#bb" + modalId).val(bbValue);
      } catch (e) {
        console.warn(
          "XML missing one or more of the following:\n" +
            "    BoundingBox <minx> <miny> <maxx> <maxy>\n" +
            "    TileSet     <units-per-pixel> <order>"
        );
      }
      Materialize.updateTextFields();
    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      Materialize.toast(
        "<span id='toast_failure_populateXMLtilelayer'>Failed to Populate From " +
          xmlPath +
          "</span>",
        5000
      );
      $("#toast_failure_populateXMLtilelayer")
        .parent()
        .css("background-color", "#a11717");
    },
  });
}

function layerPopulateVariable(modalId, layerType) {
  modalId = "Variable" + modalId;
  if (layerEditors[modalId]) {
    var currentLayerVars = JSON.parse(layerEditors[modalId].getValue() || "{}");

    if (layerType == "data") {
      currentLayerVars = currentLayerVars.shader
        ? { shader: currentLayerVars.shader }
        : {
            shader: {
              type: "colorize",
              units: "m",
              editable: true,
              ramps: [["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"]],
            },
          };
    } else {
      currentLayerVars.useKeyAsName = currentLayerVars.useKeyAsName || "prop";
      currentLayerVars.datasetLinks = currentLayerVars.datasetLinks || [
        {
          prop: "{prop}",
          dataset: "{dataset}",
          column: "{column}",
          type: "{none || images}",
        },
      ];

      currentLayerVars.links = currentLayerVars.links || [
        {
          name: "example",
          link: "url/?param={prop}",
        },
      ];

      currentLayerVars.info = currentLayerVars.info || [
        {
          which: "last",
          icon: "material design icon",
          value: "Prop: {prop}",
        },
      ];
      currentLayerVars.markerIcon = currentLayerVars.markerIcon || {
        iconUrl: "pathToMainIconImage.png",
        shadowUrl: "(opt)pathToShadowImage.png",
        iconSize: [38, 95], // size of the icon
        shadowSize: [50, 64], // size of the shadow
        iconAnchor: [22, 94], // point of the icon which will correspond to marker's location
        shadowAnchor: [4, 62], // the same for the shadow
      };
      currentLayerVars.search =
        currentLayerVars.search || "(prop1) round(prop2.1) rmunder(prop_3)";
    }
    layerEditors[modalId].setValue(JSON.stringify(currentLayerVars, null, 4));
  }
}
function vtlayerPopulateStyle(modalId) {
  var metadatajsonPath = $("#Url" + modalId).val();
  metadatajsonPath = metadatajsonPath.replace(
    "{z}/{x}/{y}.pbf",
    "metadata.json"
  );
  metadatajsonPath = missionPath.replace("config.json", "") + metadatajsonPath;
  $.ajax({
    type: "GET",
    url: metadatajsonPath,
    dataType: "json",
    success: function (json) {
      var layers = JSON.parse(json.json).vector_layers;

      var newLayerStyles = {};
      for (var i = 0; i < layers.length; i++) {
        newLayerStyles[layers[i].id] = {
          color: "#FFFFFF",
          fill: true,
          fillColor: "rgb(0, 125, 200)",
          fillOpacity: 0.5,
          opacity: 1,
          radius: 4,
          weight: 2,
        };
      }
      if (layerEditors[modalId]) {
        var currentLayerStyles = layerEditors[modalId].getValue();
        if (currentLayerStyles)
          try {
            currentLayerStyles = JSON.parse(currentLayerStyles);
          } catch (e) {
            Materialize.toast(
              "<span id='toast_failure_populatemetajsonvtlayer1'>Current styles are not valid JSON.</span>",
              5000
            );
            $("#toast_failure_populatemetajsonvtlayer1")
              .parent()
              .css("background-color", "#a11717");
            return;
          }
        else currentLayerStyles = {};

        if (typeof currentLayerStyles === "string") currentLayerStyles = {};

        var newLayerStyleKeys = Object.keys(newLayerStyles);
        for (var i = 0; i < newLayerStyleKeys.length; i++) {
          if (currentLayerStyles[newLayerStyleKeys[i]] == null) {
            currentLayerStyles[newLayerStyleKeys[i]] =
              newLayerStyles[newLayerStyleKeys[i]];
          }
        }

        layerEditors[modalId].setValue(
          JSON.stringify(currentLayerStyles, null, 4)
        );
      }
    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      Materialize.toast(
        "<span id='toast_failure_populatemetajsonvtlayer'>Failed to Populate From " +
          metadatajsonPath +
          "</span>",
        5000
      );
      $("#toast_failure_populatemetajsonvtlayer")
        .parent()
        .css("background-color", "#a11717");
    },
  });
}

function populateVersions(versions) {
  $("#tab_overall_versions").empty();
  for (var i = versions.length - 1; i >= 0; i--) {
    var latest = "";
    if (i == versions.length - 1)
      latest = "<div class='version_latest'>current</div>";

    // prettier-ignore
    var li = [
      "<li style='display: flex; justify-content: space-between;'>",
        "<div style='display: flex;'>v" + 
          "<div style='font-weight: bold; font-size: 18px; line-height: 22px;'>" + versions[i].version + "</div>",
          latest,
        "</div>",
        "<div style='display: flex;'>",
          "<div style='font-size: 12px; color: #555; line-height: 22px;'>" + versions[i].createdAt.split('.')[0] + "</div>",
          "<div class='version_set' mission='" + versions[i].mission + "' version='" + versions[i].version + "'>SET</div>",
          "<div class='version_download' mission='" + versions[i].mission + "' version='" + versions[i].version + "'><i class='mdi mdi-download mdi-18px'></i></div>",
        "</div>",
      "</li>"
    ].join('\n')
    $("#tab_overall_versions").append(li);
  }

  $(".version_set").on("click", function () {
    $.ajax({
      type: calls.upsert.type,
      url: calls.upsert.url,
      data: {
        mission: $(this).attr("mission"),
        version: $(this).attr("version"),
      },
      success: function (data) {
        if (data.status == "success") {
          Materialize.toast(
            "<span id='toast_success'>Save Successful.</span>",
            4000
          );
          $("#toast_success").parent().css("background-color", "#1565C0");
          Materialize.toast(
            "<span id='toast_success3'>Page will now reload...</span>",
            4000
          );
          $("#toast_success3").parent().css("background-color", "#1565C0");
          setTimeout(function () {
            location.reload();
          }, 4000);
        } else {
          Materialize.toast(
            "<span id='toast_failure8'>" + data["message"] + "</span>",
            5000
          );
          $("#toast_failure8").parent().css("background-color", "#a11717");
        }
      },
    });
  });

  $(".version_download").on("click", function () {
    let downloadMission = $(this).attr("mission");
    let downloadVersion = $(this).attr("version");

    $.ajax({
      type: calls.get.type,
      url: calls.get.url,
      data: {
        mission: downloadMission,
        version: downloadVersion,
        full: true,
      },
      success: function (data) {
        if (data.status == "success") {
          downloadObject(
            data.config,
            downloadMission + "_v" + downloadVersion + "_config",
            ".json",
            true
          );
          Materialize.toast(
            "<span id='toast_success'>Download Successful.</span>",
            4000
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
  });
}

function downloadObject(exportObj, exportName, exportExt, prettify) {
  var strung;
  if (exportExt && exportExt == ".geojson") {
    //pretty print geojson
    let features = [];
    for (var i = 0; i < exportObj.features.length; i++)
      features.push(JSON.stringify(exportObj.features[i]));
    features = "[\n" + features.join(",\n") + "\n]";
    exportObj.features = "__FEATURES_PLACEHOLDER__";
    strung = JSON.stringify(exportObj, null, 2);
    strung = strung.replace('"__FEATURES_PLACEHOLDER__"', features);
  } else if (prettify) strung = JSON.stringify(exportObj, null, 2);
  else strung = JSON.stringify(exportObj);
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(strung);
  var downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    exportName + (exportExt || ".json")
  );
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function validName(name) {
  if (
    name.length > 0 &&
    name.length ==
      name.replace(/[`~!@#$%^&*|+\=?;:'",.<>\{\}\[\]\\\/]/gi, "").length &&
    /^\d+$/.test(name[0]) == false
  ) {
    try {
      $("." + name.replace(/\s/g, "").toLowerCase());
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function getDuplicatedNames(json) {
  let allNames = [];

  depthTraversal(json.layers, 0);

  function depthTraversal(node, depth) {
    for (var i = 0; i < node.length; i++) {
      allNames.push(node[i].name);
      //Add other feature information while we're at it
      if (node[i].sublayers != null && node[i].sublayers.length > 0) {
        depthTraversal(node[i].sublayers, depth + 1);
      }
    }
  }

  let unique = [];
  let duplicated = [];
  allNames.forEach((name) => {
    if (!unique.includes(name)) unique.push(name);
    else duplicated.push(name);
  });

  return duplicated;
}
