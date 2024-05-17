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
      object = object[keyArray[i]] || notSetValue;
    } else return notSetValue != null ? notSetValue : null;
  }
  return object;
};
export const setIn = (obj, keyArray, value) => {
  if (keyArray == null || keyArray.length === 0) return null;
  let object = obj;
  for (let i = 0; i < keyArray.length - 1; i++) {
    if (object.hasOwnProperty(keyArray[i])) object = object[keyArray[i]];
    else return null;
  }
  object[keyArray[keyArray.length - 1]] = value;
};
export const traverseLayers = (layers, onLayer) => {
  depthTraversal(layers, 0, []);
  function depthTraversal(node, depth, path) {
    for (var i = 0; i < node.length; i++) {
      const ret = onLayer(node[i], path, i);

      if (ret === "remove") {
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
      setIn(configuration.tools[i], keyArray, value);
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
