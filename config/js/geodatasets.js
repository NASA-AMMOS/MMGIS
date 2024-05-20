var Geodatasets = {
  geojson: null,
  init: function () {
    // prettier-ignore
    var markup = [
            "<div class='geodatasets'>",
                "<div class='existing'>",
                    "<div class='title'>GeoDatasets</div>",
                    "<div class='help'>Link to them with <span>geodatasets:{name}</span> as the layer URL</div>",
                    "<ul class='mmgisScrollbar'>",
                    "</ul>",
                "</div>",
                "<div class='recreate'>",
                    "<div class='geodatasetUpload'>",
                        "<div id='geodatasetUploadButton'>",
                            "<a class='btn waves-effect waves-light'>Upload</a>",
                            "<input title='Upload' type=file accept='.json, .geojson'>",
                        "</div>",
                    "</div>",
                    "<div class='geodatasetUploadFilename'></div>",
                    "<div class='geodatasetName'>",
                        "<input type='text' placeholder='Geodataset Name' value='' />",
                    "</div>",
                    "<div class='geodatasetStartProp'>",
                        "<input type='text' placeholder='Geodataset properties.path.to.start.time.key' value='' />",
                    "</div>",
                    "<div class='geodatasetEndProp'>",
                        "<input type='text' placeholder='Geodataset properties.path.to.end.time.key' value='' />",
                    "</div>",
                    "<div class='geodatasetRecreate'>",
                        "<a class='btn waves-effect waves-light'>Re/create</a>",
                    "</div>",
                "</div>",
            "</div>"
        ].join('\n');

    $(".container_geodatasets").html(markup);

    Geodatasets.refreshNames();

    //Upload
    $(".container_geodatasets #geodatasetUploadButton > input").on(
      "change",
      function (evt) {
        var files = evt.target.files; // FileList object

        // use the 1st file from the list
        var f = files[0];
        var ext = Geodatasets.getExtension(f.name).toLowerCase();

        $(".container_geodatasets .geodatasetName input").val(
          f.name
            .split("." + ext)[0]
            .replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "")
        );

        switch (ext) {
          case "json":
          case "geojson":
            var reader = new FileReader();
            // Closure to capture the file information.
            reader.onload = (function (file) {
              return function (e) {
                $(".container_geodatasets .geodatasetUploadFilename").text(
                  file.name
                );
                Geodatasets.geojson = e.target.result;
              };
            })(f);

            reader.readAsText(f);
            break;
          default:
            alert("Only .json and .geojson files may be uploaded.");
        }
      }
    );

    //Re/create
    $(".container_geodatasets .geodatasetRecreate > a").on(
      "click",
      function (evt) {
        let name = $(".geodatasetName input").val();
        let startProp = $(".geodatasetStartProp input").val() || null;
        let endProp = $(".geodatasetEndProp input").val() || null;
        if (Geodatasets.geojson == null) {
          alert("Please upload a .geojson file.");
          return;
        }
        if (name == null) {
          alert("Please enter a name.");
          return;
        }

        $.ajax({
          type: calls.geodatasets_recreate.type,
          url: calls.geodatasets_recreate.url,
          data: {
            name: name,
            startProp,
            endProp,
            geojson: Geodatasets.geojson,
          },
          success: function (data) {
            Geodatasets.refreshNames();
            $.ajax({
              type: calls.geodatasets_get.type,
              url: calls.geodatasets_get.url + "?layer=" + name,
              success: function (data) {
                console.log(data);
              },
            });
          },
        });
      }
    );
  },
  make: function () {
    $(".container_geodatasets").css({
      opacity: 1,
      pointerEvents: "inherit",
      display: "block",
    });
    Keys.destroy();
    Datasets.destroy();
    Webhooks.destroy();
    $("#missions li.active").removeClass("active");
    $(".container").css({
      display: "none",
    });
  },
  destroy: function () {
    $(".container_geodatasets").css({
      opacity: 0,
      pointerEvents: "none",
      display: "none",
    });
    $(".container").css({
      display: "block",
    });
  },
  getExtension: function (string) {
    var ex = /(?:\.([^.]+))?$/.exec(string)[1];
    return ex || "";
  },
  sortArrayOfObjectsByKeyValue: function (arr, key, ascending, stringify) {
    if (arr.constructor !== Array) return arr;
    const side = ascending ? 1 : -1;
    let compareKey = function (a, b) {
      if (a[key] < b[key]) return -1 * side;
      if (a[key] > b[key]) return side;
      return 0;
    };
    if (stringify) {
      compareKey = function (a, b) {
        if (JSON.stringify(a[key]) < JSON.stringify(b[key])) return -1 * side;
        if (JSON.stringify(a[key]) > JSON.stringify(b[key])) return side;
        return 0;
      };
    }

    return arr.sort(compareKey);
  },
  refreshNames: function () {
    $.ajax({
      type: calls.geodatasets_entries.type,
      url: calls.geodatasets_entries.url,
      data: {},
      success: function (data) {
        if (data.status == "success") {
          $(".container_geodatasets .existing ul").html("");
          let entries = Geodatasets.sortArrayOfObjectsByKeyValue(
            data.body.entries,
            "updated",
            false
          );
          for (let i = 0; i < entries.length; i++)
            $(".container_geodatasets .existing ul").append(
              "<li><div>" +
                entries[i].name +
                "</div><div>" +
                entries[i].updated +
                "</div></li>"
            );
        }
      },
    });
  },
};

$(document).ready(function () {
  Geodatasets.init();
});
