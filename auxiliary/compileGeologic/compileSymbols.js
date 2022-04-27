const fs = require("fs");
const csv = require("csvtojson");

const csvFilePath = "./symbols.csv";
const outputName = "./symbols.json";

csv()
  .fromFile(csvFilePath)
  .then((jsonRows) => {
    const intermediate = {};
    jsonRows.forEach((r) => {
      if (intermediate[r.category_name] == null)
        intermediate[r.category_name] = {
          title: `FGDC ${r.category_reference}`,
          category: r.category_name,
          definitions: {},
        };

      intermediate[r.category_name].definitions[r.reference] = {
        description: r.description,
        style: {
          symbol: {
            set: r.set,
            key: r.key === "double-quote" ? `"` : r.key,
          },
        },
      };
    });

    const final = {
      symbols: {
        groups: [],
      },
    };
    Object.keys(intermediate).forEach((g) => {
      final.symbols.groups.push(intermediate[g]);
    });

    writeOutput(final);
  });

function writeOutput(json) {
  try {
    fs.writeFileSync(outputName, JSON.stringify(json, null, 2));
    console.log("SUCCESS", `Successfully wrote ${outputName}`);
  } catch (err) {
    console.log("ERROR", err);
  }
}
