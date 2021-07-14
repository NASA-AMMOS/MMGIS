import Map_ from "../../Basics/Map_/Map_";

const _X = 1, _Y = 0;

export const getPx = (arr, px) => arr[px[_Y]][px[_X]];
export const setPx = (arr, px, val) => arr[px[_Y]][px[_X]] = val;

export function createDataArray(width, height, fillWith = null) {
    let resultArr = [];
    for(let y = 0; y < height; y++) {
        resultArr.push(Array(width).fill(fillWith));
    }
    return resultArr;
}

export function pxToLatLng(px, tileBounds, zoom) {
    const point = tileBounds.min
        .multiplyBy(256)
        .add([px[_X], px[_Y]]);
    return Map_.map.unproject(point, zoom);
}