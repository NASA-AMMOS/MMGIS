const fs = require("fs");

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
    let removedUUIDs = [];
    depthTraversal(layers, 0, []);
    function depthTraversal(node, depth, path) {
      for (var i = 0; i < node.length; i++) {
        const ret = onLayer(node[i], path, i);
        if (ret === "remove") {
          const removed = node.splice(i, 1);
          if (removed.length > 0) {
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
    const UUIDs = [];
    Utils.traverseLayers(layers, (layer) => {
      UUIDs.push({ name: layer.name, uuid: layer.uuid });
      return;
    });
    return UUIDs;
  },
  // From https://javascript.plainenglish.io/4-ways-to-compare-objects-in-javascript-97fe9b2a949c
  isEqual(obj1, obj2, isSimple) {
    if (isSimple) {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    } else {
      let props1 = Object.getOwnPropertyNames(obj1);
      let props2 = Object.getOwnPropertyNames(obj2);
      if (props1.length != props2.length) {
        return false;
      }
      for (let i = 0; i < props1.length; i++) {
        let prop = props1[i];
        let bothAreObjects =
          typeof obj1[prop] === "object" && typeof obj2[prop] === "object";
        if (
          (!bothAreObjects && obj1[prop] !== obj2[prop]) ||
          (bothAreObjects && !Utils.isEqual(obj1[prop], obj2[prop]))
        ) {
          return false;
        }
      }
      return true;
    }
  },
  isDocker() {
    let isDockerCached;

    function hasDockerEnv() {
      try {
        fs.statSync("/.dockerenv");
        return true;
      } catch {
        return false;
      }
    }

    function hasDockerCGroup() {
      try {
        return fs.readFileSync("/proc/self/cgroup", "utf8").includes("docker");
      } catch {
        return false;
      }
    }

    // TODO: Use `??=` when targeting Node.js 16.
    if (isDockerCached === undefined) {
      isDockerCached = hasDockerEnv() || hasDockerCGroup();
    }

    return isDockerCached;
  },
  forceAlphaNumUnder: function (str) {
    if (typeof str === "string") {
      return str
        .replace(/[`~!@#$%^&*|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, "")
        .replace(/[^ -~]+/g, "");
    } else if (typeof str === "number") {
      return str;
    } else if (Array.isArray(str)) {
      return str
        .join(",")
        .replace(/[`~!@#$%^&*|+\-=?;:'".<>\{\}\[\]\\\/]/gi, "")
        .replace(/[^ -~]+/g, "")
        .split(",");
    } else {
      return "";
    }
  },
};

module.exports = Utils;
