const fs = require("fs");

const path = require("path");
const html2pug = require("html2pug");

// Make a pug copy of index.html too
let htmlStr = fs.readFileSync(
  path.join(__dirname, "..", "build/index.html"),
  "utf8"
);
fs.writeFileSync(
  path.join(__dirname, "..", "build/index.pug"),
  html2pug(htmlStr, {})
);
