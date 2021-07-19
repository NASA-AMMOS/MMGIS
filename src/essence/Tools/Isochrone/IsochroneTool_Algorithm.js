
import * as D from "./IsochroneTool_Util";
const _X = 1, _Y = 0;

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
        return D.getPx(this.valueArr, iVal) > D.getPx(this.valueArr, jVal);
    }

    swap(i, j) {
        const iVal = this.contents[i];
        const jVal = this.contents[j];
        D.setPx(this.indexArr, iVal, j);
        D.setPx(this.indexArr, jVal, i);
        this.contents[i] = jVal;
        this.contents[j] = iVal;
    }

    isNotEmpty() {
        return this.contents.length > 0;
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
        D.setPx(this.indexArr, px, index);
        this.bubbleUp(index);
    }

    remove() {
        const result = this.contents[0];
        D.setPx(this.indexArr, result, -1);
        const lastPx = this.contents.pop();
        if(this.contents.length > 0) {
            this.contents[0] = lastPx;
            D.setPx(this.indexArr, lastPx, 0);
            this.bubbleDown();
        }
        return result;
    }
}

const queenMoves = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1], [1, 0], [1, 1]
];

const knightMoves = [
    ...queenMoves,
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2], [1, 2],
    [2, -1], [2, 1]
];

function generate(
    start,
    bounds,
    costFunction,
    zoom,
    maxCost = Infinity,
    knightsMove = true
) {
    //console.log("START", start);
    const moves = knightsMove ? knightMoves : queenMoves;

    const width = bounds.width * 256;
    const height = bounds.height * 256;

    //Set up dijkstra's
    let costArr = D.createDataArray(width, height, Infinity);
    let linkArr = D.createDataArray(width, height, 0);
    let indexArr = D.createDataArray(width, height, -2);
        //-2: px is unvisited; -1: px has been removed
    
    let heap = new PxHeap(costArr, indexArr);

    costArr[start.y][start.x] = 0;
    heap.insert([start.y, start.x]);

    //Do dijkstra's to it
    while(heap.isNotEmpty()) {
        const cPx = heap.remove(); //current pixel
        const cCost = D.getPx(costArr, cPx);
        const cLatLng = D.pxToLatLng(cPx, bounds, zoom);
        for(const m of moves) {
            const tPx = [cPx[_Y] + m[_Y], cPx[_X] + m[_X]]; //target pixel
            if(tPx[_Y] < 0 || tPx[_X] < 0
                || tPx[_Y] >= height || tPx[_X] >= width)
                continue;

            const tPxIndex = D.getPx(indexArr, tPx);
            if(tPxIndex === -1) continue;

            const tLatLng = D.pxToLatLng(tPx, bounds, zoom);
            const cost = costFunction(cPx, cLatLng, tPx, tLatLng) + cCost;
            if(cost > maxCost) continue;
            
            if(tPxIndex === -2) {
                D.setPx(costArr, tPx, cost);
                D.setPx(linkArr, tPx, D.moveToBacklink(m));
                heap.insert(tPx);
            } else if(cost < D.getPx(costArr, tPx)) {
                D.setPx(costArr, tPx, cost);
                D.setPx(linkArr, tPx, D.moveToBacklink(m));
                heap.bubbleUp(tPxIndex);
            }
        }
    }
    return {cost: costArr, backlink: linkArr};
}





export {generate};