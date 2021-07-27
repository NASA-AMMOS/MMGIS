import Map_ from "../../Basics/Map_/Map_";
import F_ from "../../Basics/Formulae_/Formulae_";

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
        .add([px[_X] + 0.5, px[_Y] + 0.5]);
    return Map_.map.unproject(point, zoom);
}

export function createTileBounds(start, radius, zoom) {
    //TODO: this function could use improvement (are the loops necessary?)
    const startPoint = Map_.map.project(start, zoom);
    const startTile = startPoint.divideBy(256);
    let min = startTile.floor().multiplyBy(256);
    let max = startTile.ceil().multiplyBy(256);

    const isWithinBounds = (ptX, ptY) => {
        const ptLatLng = Map_.map.unproject([ptX, ptY], zoom);
        const dist = F_.lngLatDistBetween(
            start.lng,
            start.lat,
            ptLatLng.lng,
            ptLatLng.lat
        );
        return dist < radius;
    }

    while(isWithinBounds(min.x, startPoint.y))
        min.x -= 256;
    while(isWithinBounds(startPoint.x, min.y))
        min.y -= 256;
    while(isWithinBounds(max.x, startPoint.y))
        max.x += 256;
    while(isWithinBounds(startPoint.x, max.y))
        max.y += 256;
    
    min = min.divideBy(256);
    max = max.divideBy(256);

    return window.L.bounds(min, max);
}

//USE WITH CAUTION - LatLngBounds are not to be trusted with polar maps
export function projectTileBounds(bounds, zoom) {
    const min = Map_.map
        .project(bounds.getNorthWest(), zoom)
        .divideBy(256)
        .floor();
    const max = Map_.map
        .project(bounds.getSouthEast(), zoom)
        .divideBy(256)
        .ceil();
    return window.L.bounds(min, max);
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

export const Timer = {
    times: {},
    start: function(name) {
        this.times[name] = Date.now();
    },
    stop: function(name) {
        if(this.times[name]) {
            const duration = Date.now() - this.times[name];
            console.log(`${name} finished in ${duration / 1000} seconds`);
            this.times[name] = null;
        } else {
            console.log(`Attempt to stop ${name} timer that was never started or already stopped!`);
        }
    }
}