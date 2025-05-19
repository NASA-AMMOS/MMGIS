// GeoJSON to Newline Delimited GeoJSON
// npm install JSONStream
// node geojson2ndgeojson.js test.geojson

const fs = require("fs");
const readline = require("readline");
const JSONStream = require("JSONStream");

const inputFile = process.argv[2];
if (inputFile == null) {
  console.error("Please provide and input GeoJSON file path.");
  process.exit(1);
}

const outputFile = inputFile
  .replace(".json", ".ndgeojson")
  .replace(".geojson", ".ndgeojson");

const readStream = fs.createReadStream(inputFile, { encoding: "utf8" });
const writeStream = fs.createWriteStream(outputFile, { encoding: "utf8" });

const parser = JSONStream.parse("features.*");

console.log("Processing...");

readStream.pipe(parser);

parser.on("data", (feature) => {
  writeStream.write(JSON.stringify(feature) + "\n");
});

parser.on("end", () => {
  console.log("Processing complete!");
  writeStream.end();
});

parser.on("error", (err) => {
  console.error("Error parsing JSON:", err);
});

writeStream.on("error", (err) => {
  console.error("Error writing to file:", err);
});
