import { saveAs } from "file-saver";

// Positive ints only
export const isNumeric = (value) => {
  return /^\d+$/.test(value);
};

export const isUrlAbsolute = (url) => {
  const r = new RegExp("^(?:[a-z]+:)?//", "i");
  return r.test(url);
};

/**
 * Traverses an object with an array of keys
 * @param {*} obj
 * @param {*} keyArray
 */
export const getIn = (obj, keyArray, notSetValue) => {
  if (obj == null) return notSetValue != null ? notSetValue : null;
  if (keyArray == null) return notSetValue != null ? notSetValue : null;
  if (typeof keyArray === "string") keyArray = keyArray.split(".");
  let object = Object.assign({}, obj);
  for (let i = 0; i < keyArray.length; i++) {
    if (object && object.hasOwnProperty(keyArray[i])) {
      if (typeof object === "string") object = [object];
      object = object[keyArray[i]] != null ? object[keyArray[i]] : notSetValue;
    } else return notSetValue != null ? notSetValue : null;
  }
  return object;
};
export const setIn = (obj, keyArray, value, force) => {
  if (keyArray == null || keyArray.length === 0) return null;
  let object = obj;
  for (let i = 0; i < keyArray.length - 1; i++) {
    if (force) {
      // If string but setting a number index at the end of keyArray, turn into array
      if (i === keyArray.length - 2) {
        if (isNumeric(keyArray[i + 1]) && !Array.isArray(object[keyArray[i]]))
          object[keyArray[i]] = Array(object[keyArray[i]]);
      }
      if (!object.hasOwnProperty(keyArray[i]))
        object[keyArray[i]] =
          i === keyArray.length - 2 && isNumeric(keyArray[i + 1]) ? [] : {};
      object = object[keyArray[i]];
    } else {
      if (object.hasOwnProperty(keyArray[i])) object = object[keyArray[i]];
      else return null;
    }
  }
  object[keyArray[keyArray.length - 1]] = value;
};

export const traverseLayers = (layers, onLayer) => {
  depthTraversal(layers, 0, []);
  function depthTraversal(node, depth, path) {
    for (var i = 0; i < node.length; i++) {
      const ret = onLayer(node[i], path, i);
      if (ret && ret.type === "add") {
        if (node[i].type === "header") {
          node[i].sublayers.unshift(ret.layer);
        } else node.splice(i + 1, 0, ret.layer);
      } else if (ret === "remove") {
        node.splice(i, 1);
        i--;
      }
      //Add other feature information while we're at it
      else if (
        node[i] &&
        node[i].sublayers != null &&
        node[i].sublayers.length > 0
      ) {
        depthTraversal(
          node[i].sublayers,
          depth + 1,
          `${path.length > 0 ? path + "." : ""}${node[i].name}`
        );
      }
    }
  }
};
export const insertLayerAfterUUID = (layers, layer, uuid) => {
  traverseLayers(layers, (l, path, index) => {
    if (l.uuid === uuid) {
      return {
        type: "add",
        layer,
      };
    }
  });
};

export const getLayerByUUID = (layers, uuid) => {
  let layer = null;
  if (uuid == null) return layer;

  traverseLayers(layers, (l, path, depth) => {
    if (layer == null && l.uuid === uuid) {
      layer = l;
    }
  });
  return layer;
};

export const getToolFromConfiguration = (toolName, configuration) => {
  for (let i = 0; i < configuration.tools.length; i++) {
    if (configuration.tools[i].name === toolName) return configuration.tools[i];
  }
};
export const updateToolInConfiguration = (
  toolName,
  configuration,
  keyArray,
  value
) => {
  for (let i = 0; i < configuration.tools.length; i++) {
    if (configuration.tools[i].name === toolName) {
      setIn(configuration.tools[i], keyArray, value, true);
    }
  }
};

export const reorderArray = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

export const copyToClipboard = (text) => {
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
};

export const downloadObject = (
  exportObj,
  exportName,
  exportExt,
  downloadType
) => {
  let strung;
  if (typeof exportObj === "string") {
    strung = exportObj;
  } else {
    if (
      exportExt &&
      (exportExt === ".json" || exportExt === ".geojson") &&
      exportObj.features
    ) {
      //pretty print geojson
      let features = [];
      for (let i = 0; i < exportObj.features.length; i++)
        features.push(JSON.stringify(exportObj.features[i]));
      features = "[\n" + features.join(",\n") + "\n]";
      exportObj.features = "__FEATURES_PLACEHOLDER__";
      strung = JSON.stringify(exportObj, null, 2);
      strung = strung.replace('"__FEATURES_PLACEHOLDER__"', features);
    } else strung = JSON.stringify(exportObj, null, 2);
  }
  let fileName = exportName + (exportExt || ".json");

  try {
    // Create a blob of the data
    let fileToSave = new Blob([strung], {
      type: `application/${downloadType || "json"}`,
      name: fileName,
    });
    // Save the file //from FileSaver
    saveAs(fileToSave, fileName);
  } catch (err) {
    //https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser#answer-30800715
    let dataStr =
      `data:text/${downloadType || "json"};charset=utf-8,` +
      encodeURIComponent(strung);
    let downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
};

export const trimString = (string, length) => {
  if (typeof string !== "string") return string;
  return string.length > length
    ? string.substring(0, length).trimEnd() + "..."
    : string;
};
