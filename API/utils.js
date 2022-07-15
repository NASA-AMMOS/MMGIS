const Utils = {
  getIn: function (obj, keyArray, notSetValue, assumeLayerHierarchy) {
    if (obj == null) return notSetValue != null ? notSetValue : null;
    if (keyArray == null) return notSetValue != null ? notSetValue : null;
    if (typeof keyArray === "string") keyArray = keyArray.split(".");
    let object = Object.assign({}, obj);
    for (let i = 0; i < keyArray.length; i++) {
      if (object && object.hasOwnProperty(keyArray[i]))
        object = object[keyArray[i]];
      else if (
        assumeLayerHierarchy &&
        object &&
        Utils.objectArrayIndexOfKeyWithValue(object, "name", keyArray[i]) >= 0
      )
        object =
          object[
            Utils.objectArrayIndexOfKeyWithValue(object, "name", keyArray[i])
          ];
      else return notSetValue != null ? notSetValue : null;
    }
    return object;
  },
  objectArrayIndexOfKeyWithValue: function (objectArray, key, value) {
    var index = -1;
    for (let i in objectArray) {
      if (objectArray[i]) {
        if (
          objectArray[i].hasOwnProperty(key) &&
          objectArray[i][key] === value
        ) {
          index = i;
          break;
        }
      }
    }
    return index;
  },
  setIn: function (obj, keyArray, value, splice, assumeLayerHierarchy) {
    console.log(keyArray);
    if (keyArray == null || keyArray === []) return false;
    if (typeof keyArray === "string") keyArray = keyArray.split(".");
    let object = obj;
    for (let i = 0; i < keyArray.length - 1; i++) {
      if (object.hasOwnProperty(keyArray[i])) object = object[keyArray[i]];
      else if (
        assumeLayerHierarchy &&
        Utils.objectArrayIndexOfKeyWithValue(object, "name", keyArray[i]) >= 0
      )
        object =
          object[
            Utils.objectArrayIndexOfKeyWithValue(object, "name", keyArray[i])
          ];
      else return false;
    }
    const finalKey = keyArray[keyArray.length - 1];

    if (splice && !isNaN(finalKey) && typeof object.splice === "function")
      object.splice(parseInt(finalKey), 0, value);
    else object[keyArray[keyArray.length - 1]] = value;
    return true;
  },
  traverseLayers: function (layers, onLayer) {
    depthTraversal(layers, 0);
    function depthTraversal(node, depth) {
      for (var i = 0; i < node.length; i++) {
        onLayer(node[i], node.type === "header" ? node : null);
        //Add other feature information while we're at it
        if (node[i].sublayers != null && node[i].sublayers.length > 0) {
          depthTraversal(node[i].sublayers, depth + 1);
        }
      }
    }
  },
};

module.exports = Utils;
