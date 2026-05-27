import { create } from 'zustand'

export const MULTI_SOURCE_COLORS = [
    { r: 0, g: 0, b: 0 },
    { r: 180, g: 40, b: 40 },
    { r: 40, g: 40, b: 180 },
    { r: 40, g: 160, b: 40 },
    { r: 180, g: 120, b: 0 },
    { r: 120, g: 40, b: 180 },
    { r: 0, g: 160, b: 160 },
    { r: 180, g: 0, b: 180 },
]

const DEFAULT_SHED_COLOR = { r: 0, g: 0, b: 0, a: 192 }

function makeDefaultElement(id, vars) {
    const sourcesList = buildSourcesList(vars)
    return {
        id,
        name: `Shade ${id}`,
        on: true,
        dataIndex: 0,
        color: { ...DEFAULT_SHED_COLOR },
        opacity: 0.75,
        includeSunEarth: 'false',
        resolution: 1,
        compositeMode: 'or',
        height: vars?.defaultHeight || 0,
        observer: vars?.observers?.[0]?.value || null,
        selectedSourceIndices: sourcesList.length > 0 ? [0] : [],
        customAz: NaN,
        customEl: NaN,
        customRange: NaN,
        loading: false,
        loadingProgress: 0,
        regenerating: false,
        changed: true,
        raeResults: null,
        allResults: null,
    }
}

export function buildSourcesList(vars) {
    const list = []
    if (vars?.sources?.length > 0) {
        vars.sources.forEach((s) => list.push(s))
    }
    list.push({ name: 'Custom', value: false })
    return list
}

const useShadeStore = create((set, get) => ({
    // Tool-level state
    vars: null,
    activeElmId: 0,
    elements: {},
    elmCount: 0,
    firstOpen: true,
    showTileEdges: false,
    utcTime: '',
    rawTime: '',
    lastConvertedMs: '000',
    indicatorLastDragPoint: null,

    // Map layer references (not serializable, but needed for lifecycle)
    canvases: {},
    tags: {},
    shedMarkers: {},
    lastData: null,
    lastResultGrid: null,
    lastOptions: null,

    // Sweep state
    sweepStart: '',
    sweepEnd: '',
    sweepStep: 60,
    sweepResults: null,
    sweepGrids: null,
    sweepPlaying: false,
    sweepPlayIndex: 0,
    sweepPlaySpeed: 500,
    sweepPlayElmId: null,
    sweepProgress: '',

    // Actions
    setVars: (vars) => set({ vars }),
    setActiveElmId: (id) => set({ activeElmId: id }),

    addElement: (id, initObj) => {
        const { vars, elmCount } = get()
        const effectiveId = id != null ? id : elmCount
        const el = makeDefaultElement(effectiveId, vars)
        if (initObj) {
            Object.assign(el, {
                name: initObj.name || el.name,
                on: initObj.on != null ? initObj.on : el.on,
                dataIndex:
                    initObj.dataIndex != null ? initObj.dataIndex : el.dataIndex,
                color: initObj.color || el.color,
                opacity: initObj.opacity != null ? initObj.opacity : el.opacity,
                includeSunEarth:
                    initObj.includeSunEarth != null
                        ? initObj.includeSunEarth
                        : el.includeSunEarth,
                resolution:
                    initObj.resolution != null
                        ? initObj.resolution
                        : el.resolution,
                height: initObj.height != null ? initObj.height : el.height,
            })
        }
        set((state) => ({
            elements: { ...state.elements, [effectiveId]: el },
            elmCount: Math.max(state.elmCount, effectiveId + 1),
            activeElmId: effectiveId,
        }))
        return effectiveId
    },

    updateElement: (id, patch) =>
        set((state) => ({
            elements: {
                ...state.elements,
                [id]: { ...state.elements[id], ...patch },
            },
        })),

    removeElement: (id) =>
        set((state) => {
            const next = { ...state.elements }
            delete next[id]
            return { elements: next }
        }),

    toggleSourceSelection: (elmId, sourceIndex) =>
        set((state) => {
            const el = state.elements[elmId]
            if (!el) return state
            const sel = [...el.selectedSourceIndices]
            const idx = sel.indexOf(sourceIndex)
            if (idx >= 0) sel.splice(idx, 1)
            else sel.push(sourceIndex)
            return {
                elements: {
                    ...state.elements,
                    [elmId]: {
                        ...el,
                        selectedSourceIndices: sel,
                        changed: true,
                    },
                },
            }
        }),

    setSweepField: (field, value) => set({ [field]: value }),

    // Derived getters (imperative, for algorithm code)
    getSelectedSources: (elmId) => {
        const { elements, vars } = get()
        const el = elements[elmId]
        if (!el) return []
        const sourcesList = buildSourcesList(vars)
        return el.selectedSourceIndices.map((i) => ({
            ...sourcesList[i],
            index: i,
            color: MULTI_SOURCE_COLORS[i % MULTI_SOURCE_COLORS.length],
        }))
    },

    getShadeOptions: (elmId) => {
        const state = get()
        const el = state.elements[elmId]
        if (!el) return null
        const targets = state.getSelectedSources(elmId)
        return {
            name: el.name,
            on: el.on,
            dataIndex: el.dataIndex,
            color: { ...el.color },
            opacity: el.opacity,
            includeSunEarth: el.includeSunEarth,
            resolution: el.resolution,
            invert: 1,
            target:
                targets.length > 0
                    ? targets[0].value
                    : 'false',
            targets,
            compositeMode: el.compositeMode,
            targetHeight: parseFloat(el.height) || 0,
            observer: el.observer,
            height: el.height,
            time: state.rawTime,
        }
    },
}))

export default useShadeStore
