
import Map_ from "../../Basics/Map_/Map_";

/*
Runs Dijkstra's Algorithm on a given subsection of the map

Dijkstra's Algorithm operates on a weighted graph, and finds the lowest-weight path between a given
starting vertex and all other vertices. 

In this implementation, values in a 2D array (representing pixels of a raster) are treated as
vertices of the graph and are considered to be implicitly connected to their immediate neighbors.
A cost function is run between connected pixels to determine edge weights. The result of the
algorithm is returned as two arrays: a cost array which stores the minimum cost of reaching every
pixel, and a backlink array whose values encode which of a pixel's neighbors is its parent in the
shortest-path tree. Informally, the backlink saves the final "step" in the path from the start to 
that pixel. The backlink array may thus be followed recursively to reconstruct the shortest path
from any given pixel back to the starting point.

Note that connecting pixels in this way limits directions of movement, and thus the final shape
will be biased towards these directions (see queenMoves and knightMoves, below).
*/

//Indexes of X and Y values within px coordinate tuples
const X = 1, Y = 0;

//px contains array indexes [y, x]
const getPx = (arr, px) => arr[px[Y]][px[X]];
const setPx = (arr, px, val) => arr[px[Y]][px[X]] = val;

//Helpers to get array indexes of parent and child elements within an implicitly-structured heap
const h_getParentIndex = i => Math.ceil(i / 2) - 1;
const h_getChildIndex = i => i * 2 + 1;

function pxToLatLng(px, tileBounds, zoom) {
    const point = tileBounds.min
        .multiplyBy(256)
        .add([px[X] + 0.5, px[Y] + 0.5]);
    return Map_.map.unproject(point, zoom);
}

/** Min-heap priority queue for pixels of the cost array */
class PxHeap {
    /** 
     * Create a new min-heap for pixels of the analyzed area.
     * @param {Float32Array[]} valueArr 2D array storing the values of each pixel for the purposes of sorting
     * @param {Int32Array[]} indexArr 2D array storing the index of each pixel within this heap, to eliminate the need for searching
     */
    constructor(valueArr, indexArr) {
        this.contents = [];
        this.valueArr = valueArr;
        this.indexArr = indexArr;
    }

    /**
     * Compare the cost of the pixels at indexes `i` and `j`.
     * Return `true` if `i > j`, `false` otherwise.
     */
    compare(i, j) {
        const iVal = this.contents[i];
        const jVal = this.contents[j];
        return getPx(this.valueArr, iVal) > getPx(this.valueArr, jVal);
    }

    /** Swap the pixels at indexes `i` and `j` */
    swap(i, j) {
        const iVal = this.contents[i];
        const jVal = this.contents[j];
        setPx(this.indexArr, iVal, j);
        setPx(this.indexArr, jVal, i);
        this.contents[i] = jVal;
        this.contents[j] = iVal;
    }

    /** Move the pixel at `index` up to a correct position within the heap */
    bubbleUp(index) {
        let parentIndex = h_getParentIndex(index);
        while (parentIndex >= 0 && this.compare(parentIndex, index)) {
            this.swap(index, parentIndex);
            index = parentIndex;
            parentIndex = h_getParentIndex(index);
        }
    }

    /** Move the pixel at the head of the heap down to a correct position within the heap */
    bubbleDown() {
        let index = 0, childIndex = 1;
        let swapped = true;
        const length = this.contents.length;
        while (swapped && childIndex < length) {
            swapped = false;
            if (childIndex !== length - 1 && this.compare(childIndex, childIndex + 1)) {
                childIndex++;
            }
            if (this.compare(index, childIndex)) {
                this.swap(index, childIndex);
                swapped = true;
                index = childIndex;
                childIndex = h_getChildIndex(index);
            }
        }
    }

    /** Insert a pixel coordinate tuple into the heap */
    insert(px) {
        let index = this.contents.length;
        this.contents.push(px);
        setPx(this.indexArr, px, index);
        this.bubbleUp(index);
    }

    /** Remove the pixel coordinate tuple with the lowest cost from the heap */
    remove() {
        const result = this.contents[0];
        setPx(this.indexArr, result, -1); //Mark pixel as removed
        const lastPx = this.contents.pop();
        if (this.contents.length > 0) {
            this.contents[0] = lastPx;
            setPx(this.indexArr, lastPx, 0);
            this.bubbleDown();
        }
        return result;
    }
}

/**
 * Values to return in the backlink array. Direction back to the start ordered ascending clockwise
 * from the right.
 */
const moveToBacklink = [
    [ 0,  4,  0,  6,  0],
    [ 2,  3,  5,  7,  8],
    [ 0,  1,  0,  9,  0],
    [16, 15, 13, 11, 10],
    [ 0, 14,  0, 12,  0]
];

/**
 * Moves from a pixel to its 8 immediate neighbors.
 * A purely distance-based model will produce an octagon with these moves.
 */
const queenMoves = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1], [1, 0], [1, 1]
];

/**
 * In addition to queenMoves, all moves between pixels that a knight could make on a chessboard.
 * This improves accuracy by allowing more angles of movement at the expense of greater running time.
 * A purely distance-based model will produce a 16-sided polygon with these moves.
 */
const knightMoves = [
    ...queenMoves,
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2], [1, 2],
    [2, -1], [2, 1]
];

/**
 * Runs Dijkstra's Algorithm over an array of map data.
 * @param {L.Point} startPx Location of starting pixel, as a Leaflet point
 * @param {L.Bounds} tileBounds Tile bounds of the analyzed area
 * @param {Model} model Model used to calculate cost
 * @param {number} zoom Zoom level of the analyzed data
 * @param {number} maxCost Max cost to analyze out to.
 * @param {boolean} knightsMove Whether to use the knight's move for improved accuracy. Default `true`.
 * @returns An object containing an accumulated cost array and a backlink array.
 */
export default function generateIsochrone(
    startPx,
    tileBounds,
    model,
    zoom,
    maxCost = Infinity,
    knightsMove = true
) {
    const moves = knightsMove ? knightMoves : queenMoves;
    const size = tileBounds.getSize().multiplyBy(256);

    //Set up dijkstra's
    const makeDataArray = (type, fillWith) => {
        let arr = [];
        for (let y = 0; y < size.y; y++) {
            arr.push(new type(size.x).fill(fillWith));
        }
        return arr;
    }
    let costArr = makeDataArray(Float32Array, Infinity);
    let linkArr = makeDataArray(Uint8Array, 0);
    let indexArr = makeDataArray(Int32Array, -2);
        //-2: px is unvisited; -1: px has been removed
    
    let heap = new PxHeap(costArr, indexArr);

    costArr[startPx.y][startPx.x] = 0;
    heap.insert([startPx.y, startPx.x]);

    while (heap.contents.length > 0) {
        const cPx = heap.remove(); //current pixel
        const cCost = getPx(costArr, cPx);
        const cLatLng = pxToLatLng(cPx, tileBounds, zoom);

        for (const m of moves) {
            const tPx = [cPx[Y] + m[Y], cPx[X] + m[X]]; //target pixel

            //Check that target pixel is within bounds
            if (tPx[Y] < 0 || tPx[X] < 0 || tPx[Y] >= size.y || tPx[X] >= size.x)
                continue;
            
            //Check that target pixel hasn't already been visited
            const tPxIndex = getPx(indexArr, tPx);
            if (tPxIndex === -1) continue;

            //Check that target pixel can be reached within cost budget
            const tLatLng = pxToLatLng(tPx, tileBounds, zoom);
            const cost = model.costFunction(cPx, tPx, cLatLng, tLatLng) + cCost;
            if (cost > maxCost || !isFinite(cost)) continue;
            
            if (tPxIndex === -2) { //tPx is unvisited
                setPx(costArr, tPx, cost);
                setPx(linkArr, tPx, moveToBacklink[m[Y] + 2][m[X] + 2]);
                heap.insert(tPx);
            } else if (cost < getPx(costArr, tPx)) { //tPx is visited but this path is better
                setPx(costArr, tPx, cost);
                setPx(linkArr, tPx, moveToBacklink[m[Y] + 2][m[X] + 2]);
                heap.bubbleUp(tPxIndex); //Cost has decreased; pixel's heap position must be updated
            }
        }
    }
    return {cost: costArr, backlink: linkArr};
}
