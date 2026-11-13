import F_ from '@basics/Formulae_/Formulae_'

let state = {
    expanded: {},
    muted: {},
    search: '',
    onlyVisible: false,
    onlyFiltered: false,
    openLayer: null,
    orderingHistory: [],
    layerVersion: 0,
    focusedRow: null,
    sectionState: {},
    resetTokens: {},
    previewVersions: {},
}

const listeners = new Set()

function emit() {
    listeners.forEach((listener) => listener())
}

export function getState() {
    return state
}

export function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function dispatchHeaderStateChange(name, onState) {
    const headerId = `header_${F_.escapeHtml(name)}`.split('_')[1]
    document.dispatchEvent(
        new CustomEvent('layersToolHeaderStateChange', {
            detail: { header_id: headerId, onState },
        })
    )
}

export function updateState(update) {
    state = { ...state, ...(typeof update === 'function' ? update(state) : update) }
    emit()
    return state
}

export function setExpanded(name, expanded) {
    updateState((current) => ({
        expanded: { ...current.expanded, [name]: expanded },
    }))
}

export function setLayerSectionState(layerName, sectionId, value) {
    updateState((current) => ({
        sectionState: {
            ...current.sectionState,
            [layerName]: {
                ...current.sectionState[layerName],
                [sectionId]: value,
            },
        },
    }))
}

export function resetLayerSection(layerName, sectionId) {
    updateState((current) => ({
        sectionState: {
            ...current.sectionState,
            [layerName]: {
                ...current.sectionState[layerName],
                [sectionId]: undefined,
            },
        },
        resetTokens: {
            ...current.resetTokens,
            [layerName]: {
                ...current.resetTokens[layerName],
                [sectionId]: (current.resetTokens[layerName]?.[sectionId] || 0) + 1,
            },
        },
    }))
}

export function resetAllLayerSections(layerName) {
    updateState((current) => {
        const sectionIds = new Set([
            ...Object.keys(current.sectionState[layerName] || {}),
            ...Object.keys(current.resetTokens[layerName] || {}),
        ])
        const tokens = { ...(current.resetTokens[layerName] || {}) }
        sectionIds.forEach((sectionId) => {
            tokens[sectionId] = (tokens[sectionId] || 0) + 1
        })
        return {
            sectionState: { ...current.sectionState, [layerName]: {} },
            resetTokens: { ...current.resetTokens, [layerName]: tokens },
        }
    })
}

export function bumpLayerPreview(layerName) {
    if (!layerName) return
    updateState((current) => ({
        previewVersions: {
            ...current.previewVersions,
            [layerName]: (current.previewVersions[layerName] || 0) + 1,
        },
    }))
}

export function addOrderingHistory(entry) {
    updateState((current) => ({
        orderingHistory: [...current.orderingHistory, entry],
    }))
}

export function resetOrderingHistory() {
    updateState({ orderingHistory: [] })
}
