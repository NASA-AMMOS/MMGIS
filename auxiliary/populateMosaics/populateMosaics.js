// node populateMosaics.js [input json] [mosaic parameters csv] [url prefix] [output json]
// [input json] is a geojson where each feature has the properties "sol", "site" and "pos"
// [mosaic parameters csv] has the following header: mos_name,rows,columns,azmin,azmax,elmin,elmax,elzero
// [url prefix]
// [output json] writes the mosaic features[i].properties.images
//
// use npm to install csv-parser

const csv = require("csv-parser");
const fs = require("fs");

const input = process.argv[2];
const parameters = process.argv[3];
const prefix = process.argv[4];
const output = process.argv[5];

let csvrows = {};

fs.createReadStream(parameters)
  .pipe(csv())
  .on("data", (row) => {
    const sol = parseInt(row.mos_name.substr(7, 4));
    const site = parseInt(row.mos_name.substr(15, 3));
    const pos = parseInt(row.mos_name.substr(24, 4));
    const id = sol + "_" + site + "_" + pos;

    csvrows[id] = row;
  })
  .on("end", () => {
    let geojson = JSON.parse(fs.readFileSync(input, "utf8"));

    geojson.features.forEach((element) => {
      const p = element.properties;

      const sol = parseInt(p.sol);
      const site = parseInt(p.site);
      const pos = parseInt(p.pos);
      const id = sol + "_" + site + "_" + pos;

      p.images = p.images || [];

      if (csvrows[id]) {
        const c = csvrows[id];
        // delete the existing image with same url if any
        p.images = p.images.filter((v) => v.name != c.mos_name);
        p.images.push({
          name: c.mos_name,
          isPanoramic: true,
          url: prefix + c.mos_name + ".jpg",
          rows: c.rows,
          columns: c.columns,
          azmin: c.azmin,
          azmax: c.azmax,
          elmin: c.elmin,
          elmax: c.elmax,
          elzero: c.elzero,
        });
      }
    });
    fs.writeFile(output, JSON.stringify(geojson), "utf8", () => {
      console.log("Successfully populated mosaic images into " + output + "!");
    });
  });
