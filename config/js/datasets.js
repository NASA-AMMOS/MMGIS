var Datasets = {
  csv: null,
  init: function () {
    // prettier-ignore
    var markup = [
        "<div class='datasets'>",
            "<div class='existing'>",
                "<div class='title'>Datasets</div>",
                '<div class="help">Link to them within a layer\'s variables with <span>"datasetLinks": [{"prop": "{geojson_property_to_match}","dataset": "{dataset_name}","column": "{dataset_column_name}"}]</span></div>',
                "<ul class='mmgisScrollbar'>",
                "</ul>",
            "</div>",
            "<div class='recreate'>",
                "<div class='datasetUpload'>",
                    "<div id='datasetUploadButton'>",
                        "<a class='btn waves-effect waves-light'>Upload</a>",
                        "<input title='Upload' type=file accept='.csv'>",
                    "</div>",
                "</div>",
                "<div class='datasetUploadFilename'></div>",
                "<div class='datasetName'>",
                    "<input type='text' placeholder='Dataset Name' value='' />",
                "</div>",
                "<div class='datasetRecreate'>",
                    "<a class='btn waves-effect waves-light'>Re/create</a>",
                "</div>",
            "</div>",
        "</div>"
        ].join('\n');

    $(".container_datasets").html(markup);

    Datasets.refreshNames();

    //Upload
    $(".container_datasets #datasetUploadButton > input").on(
      "change",
      function (evt) {
        var files = evt.target.files; // FileList object

        // use the 1st file from the list
        var f = files[0];
        var ext = Datasets.getExtension(f.name).toLowerCase();

        $(".container_datasets .datasetName input").val(
          f.name
            .split("." + ext)[0]
            .replace(/[`~!@#$%^&*()|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "")
        );

        switch (ext) {
          case "csv":
            /*
          var reader = new FileReader();
          // Closure to capture the file information.
          reader.onload = (function(file) {
            return function(e) {
              $(".container_datasets .datasetUploadFilename").text(file.name);
              Datasets.csv = e.target.result;
            };
          })(f);

          reader.readAsText(f);
          */
            Datasets.f = f;
            $(".container_datasets .datasetUploadFilename").text(
              Datasets.f.name
            );
            break;
          default:
            alert("Only .csv files may be uploaded.");
        }
      }
    );

    //Re/create
    $(".container_datasets .datasetRecreate > a").on("click", function (evt) {
      let name = $(".datasetName input").val();
      if (Datasets.f == null) {
        alert("Please upload a .csv file.");
        return;
      }
      if (name == null) {
        alert("Please enter a name.");
        return;
      }

      const rowsPerChunk = 10000;
      let currentRows = [];
      let header = [];
      let first = true;
      let firstStep = true;
      let cursorSum = 0;
      let cursorStep = null;
      Papa.parse(Datasets.f, {
        step: function (row, parser) {
          if (firstStep) {
            header = row.data;
            firstStep = false;
          } else {
            let r = {};
            for (let i = 0; i < header.length; i++) r[header[i]] = row.data[i];
            currentRows.push(r);

            if (currentRows.length >= rowsPerChunk) {
              cursorStep = cursorStep || row.meta.cursor;
              cursorSum += cursorStep;
              $(".datasetRecreate a")
                .css("pointer-events", "none")
                .text(
                  "Re/creating " +
                    Math.round((cursorSum / Datasets.f.size) * 100) +
                    "%"
                );
              parser.pause();
              $.ajax({
                type: calls.datasets_recreate.type,
                url: calls.datasets_recreate.url,
                data: {
                  name: name,
                  csv: JSON.stringify(currentRows),
                  header: header,
                  mode: first ? "full" : "append",
                },
                success: function (data) {
                  first = false;
                  currentRows = [];
                  parser.resume();
                },
                error: function (err) {
                  currentRows = [];
                  console.log(err);
                },
              });
            }
          }
        },
        complete: function () {
          if (currentRows.length > 0) {
            $.ajax({
              type: calls.datasets_recreate.type,
              url: calls.datasets_recreate.url,
              data: {
                name: name,
                csv: JSON.stringify(currentRows),
                header: header,
                mode: "append",
              },
              success: function (data) {
                Datasets.refreshNames();
                $(".datasetRecreate a")
                  .css("pointer-events", "inherit")
                  .text("Re/create");
              },
              error: function (err) {
                currentRows = [];
                console.log(err);
              },
            });
          } else {
            Datasets.refreshNames();
            $(".datasetRecreate a")
              .css("pointer-events", "inherit")
              .text("Re/create");
          }
        },
      });
    });
  },
  make: function () {
    $(".container_datasets").css({
      opacity: 1,
      pointerEvents: "inherit",
      display: "block",
    });
    Keys.destroy();
    Geodatasets.destroy();
    Webhooks.destroy();
    $("#missions li.active").removeClass("active");
    $(".container").css({
      display: "none",
    });
  },
  destroy: function () {
    $(".container_datasets").css({
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
      type: calls.datasets_entries.type,
      url: calls.datasets_entries.url,
      data: {},
      success: function (data) {
        if (data.status == "success") {
          $(".container_datasets .existing ul").html("");
          let entries = Datasets.sortArrayOfObjectsByKeyValue(
            data.body.entries,
            "updated",
            false
          );
          for (let i = 0; i < entries.length; i++)
            $(".container_datasets .existing ul").append(
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
  Datasets.init();
});
