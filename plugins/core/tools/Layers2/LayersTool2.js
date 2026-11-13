import React from 'react'
import { createRoot } from 'react-dom/client'
import L_ from '@basics/Layers_/Layers_'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import LayersTool2App from './components/LayersTool2'
import * as store from './store'
import { flatten, layerOrder, replay } from './ordering'

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
                .map((item) =>
                    item.split('-').map((value) => Number.parseInt(value, 10))
                )
                .filter(
                    (item) =>
                        item.length === 3 && item.every(Number.isFinite)
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
            ({ key, name, type, depth }) => ({ key, name, type, depth })
        )
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
            .orderingHistory.map((entry) => `${entry[0]}-${entry[1]}-${entry[2]}`)
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
    },
    syncLayer(layerName) {
        if (!layerName) return
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
