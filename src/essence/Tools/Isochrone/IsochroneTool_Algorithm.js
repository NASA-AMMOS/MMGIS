
import Map_ from "../../Basics/Map_/Map_";
const _X = 1, _Y = 0;

//px contains array indices [y, x]
const getPx = (arr, px) => arr[px[_Y]][px[_X]];
const setPx = (arr, px, val) => arr[px[_Y]][px[_X]] = val;

const h_getParentIndex = i => Math.ceil(i / 2) - 1;
const h_getChildIndex = i => i * 2 + 1;

class PxHeap {
    constructor(valueArr, indexArr) {
        this.contents = [];
        this.valueArr = valueArr;
        this.indexArr = indexArr;
    }

    compare(i, j) {
        const iVal = this.contents[i];
        const jVal = this.contents[j];
        return getPx(this.valueArr, iVal) > getPx(this.valueArr, jVal);
    }

    swap(i, j) {
        const iVal = this.contents[i];
        const jVal = this.contents[j];
        setPx(this.indexArr, iVal, j);
        setPx(this.indexArr, jVal, i);
        this.contents[i] = jVal;
        this.contents[j] = iVal;
    }

    bubbleUp(index) {
        let parentIndex = h_getParentIndex(index);
        while(parentIndex >= 0 && this.compare(parentIndex, index)) {
            this.swap(index, parentIndex);
            index = parentIndex;
            parentIndex = h_getParentIndex(index);
        }
    }

    bubbleDown() {
        let index = 0, childIndex = 1;
        let swapped = true;
        const length = this.contents.length;
        while(swapped && childIndex < length) {
            swapped = false;
            if(childIndex !== length - 1 && this.compare(childIndex, childIndex + 1))
                childIndex++;
            if(this.compare(index, childIndex)) {
                this.swap(index, childIndex);
                swapped = true;
                index = childIndex;
                childIndex = h_getChildIndex(index);
            }
        }
    }

    insert(px) {
        let index = this.contents.length;
        this.contents.push(px);
        setPx(this.indexArr, px, index);
        this.bubbleUp(index);
    }

    remove() {
        const result = this.contents[0];
        setPx(this.indexArr, result, -1);
        const lastPx = this.contents.pop();
        if(this.contents.length > 0) {
            this.contents[0] = lastPx;
            setPx(this.indexArr, lastPx, 0);
            this.bubbleDown();
        }
        return result;
    }
}

function createDataArray(width, height, fillWith = null, type = Array) {
    let resultArr = [];
    for(let y = 0; y < height; y++) {
        resultArr.push(new type(width).fill(fillWith));
    }
    return resultArr;
}

function pxToLatLng(px, tileBounds, zoom) {
    const point = tileBounds.min
        .multiplyBy(256)
        .add([px[_X] + 0.5, px[_Y] + 0.5]);
    return Map_.map.unproject(point, zoom);
}

//Clockwise from the right
function moveToBacklink(move) {
    return [
        [ 0,  4,  0,  6,  0],
        [ 2,  3,  5,  7,  8],
        [ 0,  1,  0,  9,  0],
        [16, 15, 13, 11, 10],
        [ 0, 14,  0, 12,  0]
    ][move[_Y] + 2][move[_X] + 2];
}

const queenMoves = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1], [1, 0], [1, 1]
];

const knightMoves = [
    ...queenMoves,
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2], [1, 2],
    [2, -1], [2, 1]
];

export default function generateIsochrone(
    startPx, //L.Point
    bounds, //L.Bounds
    costFunction,
    zoom,
    maxCost = Infinity,
    knightsMove = true
) {
    const moves = knightsMove ? knightMoves : queenMoves;

    const width = (bounds.max.x - bounds.min.x) * 256;
    const height = (bounds.max.y - bounds.min.y) * 256;

    //Set up dijkstra's
    let costArr = createDataArray(width, height, Infinity, Float32Array);
    let linkArr = createDataArray(width, height, 0, Uint8Array);
    let indexArr = createDataArray(width, height, -2, Int32Array);
        //-2: px is unvisited; -1: px has been removed
    
    let heap = new PxHeap(costArr, indexArr);

    costArr[startPx.y][startPx.x] = 0;
    heap.insert([startPx.y, startPx.x]);

    //Do dijkstra's to it
    while(heap.contents.length > 0) {
        const cPx = heap.remove(); //current pixel
        const cCost = getPx(costArr, cPx);
        const cLatLng = pxToLatLng(cPx, bounds, zoom);
        for(const m of moves) {
            const tPx = [cPx[_Y] + m[_Y], cPx[_X] + m[_X]]; //target pixel
            if(tPx[_Y] < 0 || tPx[_X] < 0 || tPx[_Y] >= height || tPx[_X] >= width)
                continue;
            
            const tPxIndex = getPx(indexArr, tPx);
            if(tPxIndex === -1) continue;

            const tLatLng = pxToLatLng(tPx, bounds, zoom);
            const cost = costFunction(cPx, cLatLng, tPx, tLatLng) + cCost;
            if(cost > maxCost || !isFinite(cost)) continue;
            
            if(tPxIndex === -2) {
                setPx(costArr, tPx, cost);
                setPx(linkArr, tPx, moveToBacklink(m));
                heap.insert(tPx);
            } else if(cost < getPx(costArr, tPx)) {
                setPx(costArr, tPx, cost);
                setPx(linkArr, tPx, moveToBacklink(m));
                heap.bubbleUp(tPxIndex);
            }
        }
    }
    return {cost: costArr, backlink: linkArr};
}
