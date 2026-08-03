import MapRenderer from '../../Map_/MapRenderer'
import ToolController_ from '../../ToolController_/ToolController_'
import LayerInterface from '../interface/LayerInterface'
import LayerTypeRegistry from '../registry/LayerTypeRegistry'

export function reorderLayers(L_, newLayersOrdered) {
    // Check that newLayersOrdered is valid
    let isValid = true
    if (newLayersOrdered.length === L_._layersOrdered.length) {
        L_._layersOrdered.forEach((l) => {
            if (!newLayersOrdered.includes(l)) isValid = false
        })
    } else isValid = false

    if (!isValid) {
        console.warn(
            "reorderLayers: newLayersOrdered is not consistent, won't run."
        )
        return
    }

    L_._layersOrdered = newLayersOrdered

    if (L_.Map_) L_.Map_.orderedBringToFront(true)

    if (L_.Globe_) L_.Globe_.litho.orderLayers(L_._layersOrdered)
}

export function removeLayerHelper(L_, updateLayer, removedLayers, layersGeoJSON) {
    // If we remove a layer but its properties are displayed in the InfoTool
    // and description (i.e. it was clicked), clear the InfoTool and description
    const infoTool = ToolController_.getTool('InfoTool')
    removedLayers.forEach((removedLayer) => {
        if (infoTool.currentLayer === removedLayer) {
            L_.clearVectorLayerInfo()
        }

        // Remove the layer
        updateLayer.removeLayer(removedLayer)
    })

    L_.clearGeoJSONData(updateLayer)
    L_.syncSublayerData(updateLayer._layerName)
    L_.addGeoJSONData(updateLayer, layersGeoJSON)
}

//Takes in a config layer object
// Not just for globe
export async function globeLithoLayerHelper(L_, s, onlyClear) {
    if (L_.Globe_) {
        // Only toggle the layer to reset if the layer is toggled on,
        // because if the layer is toggled off, it is not on the globe
        if (L_.layers.on[s.name]) {
            // turn off
            await L_.toggleLayerHelper(s, true, true, true)
            // Toggle the layer so its drawn in the globe
            // turn on
            if (!onlyClear) await L_.toggleLayerHelper(s, false, true, true)
        }
    }
}

export async function resetConfig(L_, data) {
    // Save so we can make sure we reproduce the same layer settings after parsing the config
    const toggledArray = { ...L_.layers.on }

    // Reset for now
    L_.layers.on = {}

    // Reset as these are appended to by parseConfig
    L_._layersOrdered = []
    L_.layers.dataFlat = []
    L_._layersLoaded = []

    await L_.parseConfig(data)

    // Set back
    L_.layers.on = { ...L_.layers.on, ...toggledArray }
}

// Dynamically add a new layer or update a layer (used by WebSocket)
export async function modifyLayer(L_, data, layerName, type) {
    layerName = L_.asLayerUUID(layerName)

    const newLayersOrdered = [...L_._layersOrdered]
    const index = L_._layersOrdered.findIndex((name) => name === layerName)
    newLayersOrdered.splice(index, 1)

    if (type === 'updateLayer' && layerName in L_.layers.data) {
        // Update layer
        await L_.TimeControl_.reloadLayer(layerName, true, true)
    } else if (type === 'addLayer') {
        await L_.addLayerToLayersData(layerName)
    } else if (type === 'removeLayer') {
        await L_.removeLayerFromLayersData(layerName)
    }

    if (ToolController_.activeToolName === 'LayersTool') {
        const layersTool = ToolController_.getTool('LayersTool')
        if (layersTool.destroy && layersTool.make) {
            layersTool.destroy()
            layersTool.make()
        }
    }
}

export async function addLayerToLayersData(L_, layerName) {
    if (L_.layers.data[layerName]) {
        // Recursively going through the new layer to get all of its sub layers
        const layersOrdered = L_.expandLayersToArray([
            L_.layers.data[layerName],
        ])

        if (!layersOrdered.includes(layerName)) {
            // If the new layer is a header, we need to add it to the list of layers
            layersOrdered.push(layerName)
        }
        layersOrdered.reverse()

        for (let i = 0; i < layersOrdered.length; i++) {
            // Add layer
            await L_.Map_.makeLayer(L_.layers.data[layersOrdered[i]])
            L_.addVisible(L_.Map_, [layersOrdered[i]])
        }
    }
}

export async function removeLayerFromLayersData(L_, layerName) {
    if (L_.layers.data[layerName]) {
        // Recursively going through the removed layer to get all of its sub layers
        const layersOrdered = L_.expandLayersToArray([
            L_.layers.data[layerName],
        ])

        if (!layersOrdered.includes(layerName)) {
            // If the new layer is a header, we need to add it to the list of layers
            layersOrdered.push(layerName)
        }

        for (let i = 0; i < layersOrdered.length; i++) {
            const layerUUID = layersOrdered[i]

            // If the layer is visible, we need to remove it,
            // otherwise do nothing since its already removed from the map
            if (layerUUID in L_.layers.on && L_.layers.on[layerUUID]) {
                // Toggle it to remove it
                await L_.toggleLayer(L_.layers.data[layerUUID])
            }

            const display_name = L_.layers.data[layerUUID].display_name
            if (L_.layers.nameToUUID[display_name]) {
                const index =
                    L_.layers.nameToUUID[display_name].indexOf(layerUUID)
                if (index > -1) {
                    L_.layers.nameToUUID[display_name].splice(index, 1)
                }
                if (L_.layers.nameToUUID[display_name].length < 1) {
                    delete L_.layers.nameToUUID[display_name]
                }
            }

            // Let the type's map plugin release its own resources
            // (destroy) before the layer leaves the registry. The map
            // removal itself already happened via toggleLayer above.
            LayerInterface.runSync(
                LayerTypeRegistry.get(L_.layers.data[layerUUID]?.type)?.map,
                'destroy',
                [
                    L_.layers.data[layerUUID],
                    { ...MapRenderer.context(), name: layerUUID },
                ]
            )

            delete L_.layers.layer[layerUUID]
            delete L_.layers.data[layerUUID]
            delete L_.layers.on[layerUUID]
            delete L_.layers.attachments[layerUUID]
            delete L_.layers.opacity[layerUUID]
        }
    }
}

export function expandLayersToArray(L_, layer) {
    // Recursively going through the removed layer to get all of its sub layers
    const layersOrdered = []
    expandLayers(layer, 0, null)

    function expandLayers(d, level, prevName) {
        //Iterate over each layer
        for (let i = 0; i < d.length; i++) {
            //Check if it's not structural (a header) and thus an actual layer with data
            if (!LayerTypeRegistry.isStructural(d[i].type)) {
                //Create parsed layers ordered
                layersOrdered.push(d[i].name)
            }

            //Get the current layers sublayers (returns 0 if none)
            var dNext = getSublayers(d[i])
            //If they are sublayers, call this function again and move up a level
            if (dNext != 0) {
                expandLayers(dNext, level + 1, d[i].name)
            }
        }
    }
    //Get the current layers sublayers (returns 0 if none)
    function getSublayers(d) {
        //If object d has a sublayers property, return it
        if (d.hasOwnProperty('sublayers')) {
            return d.sublayers
        }
        //Otherwise return 0
        return 0
    }

    return layersOrdered
}

export async function updateLayersHelper(L_, layerQueueList) {
    if (layerQueueList.length > 0) {
        // If we have a few changes waiting in the queue, we only need to parse the config once
        // as the last item in the queue should have the latest data
        const lastLayer = layerQueueList[layerQueueList.length - 1]
        await L_.resetConfig(lastLayer.data)

        while (layerQueueList.length > 0) {
            const firstLayer = layerQueueList.shift()
            const { data, newLayerName, type } = firstLayer

            await L_.modifyLayer(data, newLayerName, type)
        }

        if (L_.Map_) L_.Map_.orderedBringToFront(true)

        // If the user rearranged the layers with the LayersTool, reset the ordering history
        if (
            ToolController_.toolModules['LayersTool'] &&
            ToolController_.toolModules['LayersTool'].orderingHistory
                .length > 0
        ) {
            ToolController_.toolModules['LayersTool'].orderingHistory = []
        }

        // Update the LayersTool in the ToolController if it is active
        if (ToolController_.activeToolName === 'LayersTool') {
            ToolController_.activeTool.destroy()
            ToolController_.activeTool.make()
        }
    }
}

// Automatically update a single layer (i.e. add/update/remove) from WebSocket update
export async function autoUpdateLayer(L_, data, newLayerName, type) {
    await L_.updateLayersHelper([{ data, newLayerName, type }])
}

// Updates everything waiting in the queue from WebSocket updates
export async function updateQueueLayers(L_) {
    await L_.updateLayersHelper(L_.addLayerQueue)
}
