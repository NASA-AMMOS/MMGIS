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
    console.log("----- API/utils.js setIn start -----")
    console.log("keyArray", keyArray)

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
    console.log("----- traverseLayers-----")
    let removedUUIDs = [];
    depthTraversal(layers, 0, []);
    function depthTraversal(node, depth, path) {
      for (var i = 0; i < node.length; i++) {
        const ret = onLayer(node[i], path, i);
        // FIXME todo need walk through children of removed node to find their UUIDs
        // still need to use the returned values to make sure we dont add sub layers into the unable to remove list 
        if (ret === "remove") {
          const removed = node.splice(i, 1);
          if (removed.length > 0) {
            removedUUIDs.push({ name: removed[0].name, uuid: removed[0].uuid });

            // Find and store the UUIDs of the sublayers of the removed layer
            const removedSubLayerUUIDs = Utils.findSubLayerUUIDs(removed);
            removedUUIDs = removedUUIDs.concat(removedSubLayerUUIDs);
          }
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

    // Returns array of removed layer UUIDs, including all removed sublayer UUIDs
    return removedUUIDs;
  },
  findSubLayerUUIDs: function (layers) {
    console.log("----- findSubLayerUUIDs -----")
    const UUIDs = [];
    Utils.traverseLayers(layers, (layer) => {
      UUIDs.push({ name: layer.name, uuid: layer.uuid });
      return;
    });
    console.log("UUIDs", UUIDs)
    return UUIDs;
  },
};

module.exports = Utils;
