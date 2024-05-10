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
