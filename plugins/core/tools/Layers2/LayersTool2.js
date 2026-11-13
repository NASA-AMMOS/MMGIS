import React from 'react'
import { createRoot } from 'react-dom/client'
import L_ from '@basics/Layers_/Layers_'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import LayersTool2App from './components/LayersTool2'
import * as store from './store'
import { applyLiveMove, flatten, layerOrder, replay } from './ordering'
import buildCogLegend from '../../layertypes/Tile/cogLegend'

let root = null
let mountNode = null
let vars = {}

const LayersTool2 = {
    initialize() {
        vars = L_.getToolVars('layers2') || {}
        this.width = vars.width || 350
        this.height = 0
        if (L_.UserInterface_.isMobile === true) {
            this.width = 'full'
            this.heightDetents = [0.4, 0.7, 0.9]
            const map = document.getElementById('map')
            this.height = map
                ? Math.round(map.getBoundingClientRect().height * this.heightDetents[1])
                : 0
        }
    },
    finalize() {
        const urlTools = L_.FUTURES?.tools || []
        const entry = urlTools
            .map((value) => String(value).split('$'))
            .find(([name]) => name === 'LayersTool2')
        if (entry?.[1]) {
            const history = entry[1]
                .split('.')
                .map((item) => {
                    const values = item.split('-')
                    return values.every((value) => /^\d+$/.test(value))
                        ? values.map(Number)
                        : []
                })
                .filter(
                    (item) =>
                        [3, 5].includes(item.length) &&
                        item.every(Number.isSafeInteger)
                )
            store.updateState({ orderingHistory: history })
            if (history.length) {
                const ordered = replay(
                    flatten(L_.configData?.layers),
                    history
                ).flat
                const nextOrder = layerOrder(ordered)
                if (
                    JSON.stringify(nextOrder) !==
                    JSON.stringify(L_._layersOrdered)
                )
                    L_.reorderLayers(nextOrder)
            }
        }
        Filtering.initialize()
    },
    _debugFlat(history = store.getState().orderingHistory) {
        return replay(flatten(L_.configData?.layers), history).flat.map(
            ({ key, name, type, depth, node }) => ({
                key,
                name,
                displayName: node.display_name || name,
                type,
                depth,
            })
        )
    },
    _debugApplyLiveMove(flat, oldIndex, newIndex, expandedMap) {
        const result = applyLiveMove(flat, oldIndex, newIndex, expandedMap)
        return {
            entry: result.entry,
            flat: result.flat.map(
                ({ key, name, type, depth, on, height, childrenon }) => ({
                key,
                name,
                type,
                depth,
                on,
                height,
                childrenon,
                })
            ),
        }
    },
    make(targetId) {
        void targetId
        if (root) return
        const container = document.getElementById(
            L_.UserInterface_.isMobile === true ? 'tools' : 'toolPanel'
        )
        if (!container) return
        container.innerHTML = ''
        mountNode = document.createElement('div')
        mountNode.id = 'layersTool2'
        mountNode.style.width = '100%'
        mountNode.style.height = '100%'
        mountNode.style.display = 'flex'
        mountNode.style.flexDirection = 'column'
        mountNode.style.overflow = 'hidden'
        container.appendChild(mountNode)
        root = createRoot(mountNode)
        root.render(<LayersTool2App vars={vars} />)
    },
    destroy() {
        if (root) root.unmount()
        if (mountNode?.parentNode) mountNode.parentNode.removeChild(mountNode)
        root = null
        mountNode = null
    },
    getUrlString() {
        return store
            .getState()
            .orderingHistory.map((entry) => entry.join('-'))
            .join('.')
    },
    setHeader(header) {
        void header
        return undefined
    },
    toggleHeader(headerId) {
        const name = String(headerId || '').replace(/^header_/, '')
        const flat = replay(
            flatten(L_.configData?.layers),
            store.getState().orderingHistory
        ).flat
        const header = flat.find(
            (entry) => entry.type === 'header' && entry.name === name
        )?.node
        if (!header) return
        const expanded =
            store.getState().expanded[name] ??
            header.expanded ??
            vars.expanded === true
        const onState = !expanded
        store.setExpanded(name, onState)
        store.dispatchHeaderStateChange(name, onState)
    },
    populateCogScale(layerName) {
        const key = L_.asLayerUUID ? L_.asLayerUUID(layerName) : layerName
        const layer = L_.layers?.data?.[key] || L_.layers?.data?.[layerName]
        if (!layer) return
        if (!buildCogLegend(layer)) return
        const old = store.getState().sectionState[layer.name] || {}
        store.updateState({
            sectionState: {
                ...store.getState().sectionState,
                [layer.name]: {
                    ...old,
                    cog: {
                        ...(old.cog || {}),
                        scaleVersion: (old.cog?.scaleVersion || 0) + 1,
                    },
                },
            },
            layerVersion: store.getState().layerVersion + 1,
        })
        store.bumpLayerPreview(layer.name)
    },
    syncLayer(layerName) {
        if (!layerName) return
        store.bumpLayerPreview(layerName)
        store.updateState({ layerVersion: store.getState().layerVersion + 1 })
    },
}

Object.defineProperty(LayersTool2, 'orderingHistory', {
    get() {
        return store.getState().orderingHistory
    },
    set(value) {
        store.updateState({
            orderingHistory: Array.isArray(value) ? value : [],
        })
    },
})

export default LayersTool2
