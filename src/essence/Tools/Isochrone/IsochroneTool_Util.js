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

/*
interface tileBounds {
    min: L.Point;
    max: L.Point;
    width: number;
    height: number;
}
*/

export function projectTileBounds(bounds, zoom) {
    const min = Map_.map
        .project(bounds.getNorthWest(), zoom)
        .divideBy(256)
        .floor();
    const max = Map_.map
        .project(bounds.getSouthEast(), zoom)
        .divideBy(256)
        .ceil();
    const width = max.x - min.x;
    const height = max.y - min.y;
    return {min, max, width, height};
}

export function unprojectTileBounds(tileBounds, zoom) {
    const min = Map_.map.unproject(tileBounds.min.multiplyBy(256), zoom);
    const max = Map_.map.unproject(tileBounds.max.multiplyBy(256), zoom);
    return window.L.latLngBounds(min, max);
}

//Clockwise from the right
export function moveToBacklink(move) {
    return [
        [ 0,  4,  0,  6,  0],
        [ 2,  3,  5,  7,  8],
        [ 0,  1,  0,  9,  0],
        [16, 15, 13, 11, 10],
        [ 0, 14,  0, 12,  0]
    ][move[_Y] + 2][move[_X] + 2];
}

export function backlinkToMove(link) {
    return [
        [0, 1],
        [1, 2],
        [1, 1],
        [2, 1],
        [1, 0],
        [2, -1],
        [1, -1],
        [1, -2],
        [0, -1],
        [-1, -2],
        [-1, -1],
        [-2, -1],
        [-1, 0],
        [-2, 1],
        [-1, 1],
        [-1, 2]
    ][link - 1];
}