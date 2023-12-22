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
    if (object && object.hasOwnProperty(keyArray[i]))
      object = object[keyArray[i]] || notSetValue;
    else return notSetValue != null ? notSetValue : null;
  }
  return object;
};
export const setIn = (obj, keyArray, value) => {
  if (keyArray == null || keyArray === []) return null;
  let object = obj;
  for (let i = 0; i < keyArray.length - 1; i++) {
    if (object.hasOwnProperty(keyArray[i])) object = object[keyArray[i]];
    else return null;
  }
  object[keyArray[keyArray.length - 1]] = value;
};
