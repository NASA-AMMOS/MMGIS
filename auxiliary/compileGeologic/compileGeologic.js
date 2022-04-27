const fs = require("fs");
const path = require("path");
const wd = "../../public/images/geologic/";

const outputName = `./geologic.json`;
let outputJSON = {
  geologic: {},
};
compileGeologic();

function compileGeologic() {
  let items = [];
  // Look at all the files and folders in the current working dir
  try {
    items = fs.readdirSync(wd, { withFileTypes: true });
  } catch (err) {
    console.log("WARN", err);
  }

  for (let i = 0; i < items.length; i++) {
    let isDir = false;
    try {
      isDir = items[i].isDirectory();
    } catch (err) {
      console.log("ERROR", err);
      return;
    }

    if (isDir) {
      // If it's a directory
      processDirectory(items[i]);
    }
  }

  writeOutput();
}

// Now looks at all directories and then calls processSubdirectory on it
function processDirectory(item) {
  outputJSON.geologic[item.name] = {
    groups: [],
  };

  let directoryItems = [];
  try {
    directoryItems = fs.readdirSync(`${wd}/${item.name}`, {
      withFileTypes: true,
    });
  } catch (err) {
    console.log("WARN", err);
  }

  for (let i = 0; i < directoryItems.length; i++) {
    let isDir = false;
    try {
      isDir = directoryItems[i].isDirectory();
    } catch (err) {
      console.log("ERROR", err);
      return;
    }

    if (isDir) {
      processSubdirectory(item, directoryItems[i]);
    }
  }
}

function processSubdirectory(item1, item2) {
  let definitions = {};

  let subdirectoryItems = [];
  try {
    subdirectoryItems = fs.readdirSync(`${wd}/${item1.name}/${item2.name}`, {
      withFileTypes: true,
    });
  } catch (err) {
    console.log("WARN", err);
  }

  for (let i = 0; i < subdirectoryItems.length; i++) {
    const ext = path.extname(subdirectoryItems[i].name);
    const name = subdirectoryItems[i].name.replace(ext, "");

    if (
      !subdirectoryItems[i].isDirectory() &&
      ext &&
      (ext.toLowerCase() === ".png" || ext.toLowerCase() === ".svg")
    ) {
      let code;
      let color;

      if (name.includes("-")) {
        code = name.split("-")[0];
        color = name.split("-")[1];
      } else {
        code = name;
      }

      if (color == null) color = false;

      if (definitions[code] == null) {
        definitions[code] = {
          description: "",
          colors: [color],
        };
      } else {
        definitions[code].colors.push(color);
      }
    }
  }

  let data = {
    title: item2.name.split(".")[0],
    category: item2.name.split(".")[1],
    baseUrl: `/images/geologic/${item1.name}/${item2.name}/{tag}.svg`,
    definitions: definitions,
  };

  outputJSON.geologic[item1.name].groups.push(data);
}

function writeOutput() {
  try {
    fs.writeFileSync(outputName, JSON.stringify(outputJSON, null, 2));
    console.log("SUCCESS", `Successfully wrote ${outputName}`);
  } catch (err) {
    console.log("ERROR", err);
  }
}
