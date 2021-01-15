var Keys = {
  token: null,
  init: function() {
    // prettier-ignore
    var markup = [
        "<div class='keys'>",
          "<div id='keys_title'>Keys</div>",
          "<ul>",
            "<li class='keys_generation row'>",
              "<div id='keys_generation_periodEl' class='input-field col s2 push-s5'>",
                "<select class='keys_generation_period'>",
                  "<option value='never' selected=''>Never</option>",
                  "<option value='31557600000'>1 Year</option>",
                  "<option value='2629800000'>1 Month</option>",
                  "<option value='604800000'>1 Week</option>",
                  "<option value='86400000'>1 Day</option>",
                  "<option value='3600000'>1 Hour</option>",
                "</select>",
                "<label for='keys_generation_period'>Expire after</label>",
              "</div>",
            "</li>",
            "<li class='row'>",
              "<div class='keys_generate btn waves-effect waves-light blue darken-3 col s2 push-s5'>Generate Key<i class='mdi mdi-key mdi-18px'></i></div>",
            "</li>",
            "<li id='keys_result' class='row'>",
              "<div id='keys_token_title'>Token</div>",
              "<div id='keys_token' class='mmgisScrollbar'></div>",
              "<div id='keys_token_copy' title='Copy to Clipboard'><i class='mdi mdi-clipboard-text-multiple mdi-24px'></i></div>",
            "</li>",
          "</ul>",
          "<div id='keys_examples'>",
            "<ul>",
              "<li class='row'>",
                "<div class='example_title'>General Usage</div>",
                '<div>Make any configuration API call with the header "Authorization:Bearer <span>&lt;token&gt;</span>" included.</div>',
              "</li>",
              "<li class='row'>",
                "<div class='example_title'>Uploading CSVs</div>",
                '<div>curl -i -X POST -H "Authorization:Bearer <span>&lt;token&gt;</span>" -F "name={dataset_name}" -F "upsert=true" -F "header=[\"File\",\"Target\",\"ShotNumber\",\"Distance(m)\",\"LaserPower\",\"SpectrumTotal\",\"SiO2\",\"TiO2\",\"Al2O3\",\"FeOT\",\"MgO\",\"CaO\",\"Na2O\",\"K2O\",\"Total\",\"SiO2_RMSEP\",\"TiO2_RMSEP\",\"Al2O3_RMSEP\",\"FeOT_RMSEP\",\"MgO_RMSEP\",\"CaO_RMSEP\",\"Na2O_RMSEP\",\"K2O_RMSEP\"]" -F "data=@{path/to.csv};type=text/csv" ' + location.origin + '/api/datasets/upload</div>',
              "</li>",
            "</ul>",
          "</div>",
        "</div>"
        ].join('\n');

    $(".container_keys").html(markup);

    $(".keys select").material_select();

    $(".keys_generate").on("click", function() {
      $.ajax({
        type: calls.longtermtoken_generate.type,
        url: calls.longtermtoken_generate.url,
        data: {
          period: $("select.keys_generation_period").val()
        },
        success: function(data) {
          if (data.status === "success") {
            Keys.token = data.body.token;
            $("#keys_token").text(Keys.token);
            $("#keys_examples span").text(Keys.token);
          }
        },
        error: function(err) {
          Keys.token = null;
          console.log(err);
        }
      });
    });

    $("#keys_token_copy").on("click", function() {
      Keys.copyToClipboard(Keys.token);
    });
  },
  make: function() {
    $(".container_keys").css({
      opacity: 1,
      pointerEvents: "inherit"
    });
    Geodatasets.destroy();
    Datasets.destroy();
    $("#missions li.active").removeClass("active");
  },
  destroy: function() {
    $(".container_keys").css({
      opacity: 0,
      pointerEvents: "none"
    });
  },
  copyToClipboard(text) {
    const el = document.createElement("textarea"); // Create a <textarea> element
    el.value = text; // Set its value to the string that you want copied
    el.setAttribute("readonly", ""); // Make it readonly to be tamper-proof
    el.style.position = "absolute";
    el.style.left = "-9999px"; // Move outside the screen to make it invisible
    document.body.appendChild(el); // Append the <textarea> element to the HTML document
    const selected =
      document.getSelection().rangeCount > 0 // Check if there is any content selected previously
        ? document.getSelection().getRangeAt(0) // Store selection if found
        : false; // Mark as false to know no selection existed before
    el.select(); // Select the <textarea> content
    document.execCommand("copy"); // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el); // Remove the <textarea> element
    if (selected) {
      // If a selection existed before copying
      document.getSelection().removeAllRanges(); // Unselect everything on the HTML document
      document.getSelection().addRange(selected); // Restore the original selection
    }
  }
};

$(document).ready(function() {
  Keys.init();
});
