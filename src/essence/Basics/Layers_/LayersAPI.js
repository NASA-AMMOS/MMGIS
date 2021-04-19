import * as d3 from 'd3'
import $ from 'jquery'
import L_ from './Layers_'
import Map_, { allLayersLoaded, allLayersLoadedNoCutoff } from '../Map_/Map_'
const json_data = require('./Waypoints.geojson');

console.log = function() {}


let L = window.L

/*
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

var counter = 0;

setTimeout(() => {
    setInterval(() => {
        LayersAPI.run(counter)
        counter += 1;
        if (counter > 400) {
            counter = 0;
        }
    }, 40)
}, 2000)
*/


/*
function updateVectorLayer(name, data, add) {
    console.log("----- updateVectorLayer -----") 
    // Remove the original layer
    L_.Map_.map.removeLayer(L_.layersGroup[name]);
    L_.Map_.allLayersLoadedPassed = false;

    // Add the new data 
    add(data)
    allLayersLoadedNoCutoff()

    // Toggle the visibility
    if (L_.toggledArray[name]) {
        L_.toggledArray[name] = false 
        console.log("L_.toggledArray[layerName] ", L_.toggledArray[name])

        L_.toggleLayer(L_.layersNamed[name])
        console.log("L_.layersNamed", L_.layersNamed)
        console.log("L_.toggledArray", L_.toggledArray)
    }
}
*/

var LayersAPI = {
    env: function () {
            console.log("L_.layersNamed", L_.layersNamed)
            console.log("L_.toggledArray", L_.toggledArray)
    },
    clear: function (layerName) {
        console.log("----- clear -----")
        //const layerName = "Waypoints";
        L_.layersGroup[layerName].clearLayers();
    },
    updateVectorLayer: function (layerName, inputData, keepN) {
        //const layerName = "Waypoints";

        // Find the correct layer data
        var layerObj = [];
        for (var i = L_.layersData.length - 1; i >= 0; i--) {
            if (L_.layersData[i].name === layerName) {
                layerObj = L_.layersData[i];
                break;
            }
        }

        const updateLayer = L_.layersGroup[layerObj.name]

        // Add new data
        updateLayer.addData(inputData);

        if (keepN && keepN > -1) {
            var layers = updateLayer.getLayers();
            while (layers.length > keepN) {
                updateLayer.removeLayer(layers[0])
                layers = updateLayer.getLayers();
            }
        }
    },
    updateVectorLayer: function (layerName, inputData, keepN) {
        //const layerName = "Waypoints";

        // Find the correct layer data
        var layerObj = [];
        for (var i = L_.layersData.length - 1; i >= 0; i--) {
            if (L_.layersData[i].name === layerName) {
                layerObj = L_.layersData[i];
                break;
            }
        }

        const updateLayer = L_.layersGroup[layerObj.name]

        var data = inputData;
        var existinglayers = updateLayer.getLayers();
        if (inputData.type === 'Feature' && existinglayers.length > 0) {
            var new_coord = inputData.geometry.coordinates;
            var prev_coord = existinglayers[existinglayers.length - 1].feature.geometry.coordinates
            console.log("prev_coord", prev_coord)
            data = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "MultiLineString",
                            "coordinates": [[
                                new_coord,
                                prev_coord,
                            ]],
                        },
                        "properties": {},
                    },
                    {...inputData},
                ]
            }
/*
            for(var i in geojson.features){
                var pointJson = geojson.features[i];
                var coord = pointJson.geometry.coordinates;
                L.marker([coord[1],coord[0]]).addTo(map);
                lineCoordinate.push([coord[1],coord[0]]);
            }
            L.polyline(lineCoordinate, {color: 'red'}).addTo(map);
*/

        }


        console.log("data", JSON.stringify(data))

        // Add new data
        updateLayer.addData(inputData);

        // Keep last N data points
        if (keepN && keepN > -1) {
            var layers = updateLayer.getLayers();
            while (layers.length > keepN) {
                updateLayer.removeLayer(layers[0])
                layers = updateLayer.getLayers();
            }
        }
    },
};

window.LayersAPI = LayersAPI;

export default LayersAPI




