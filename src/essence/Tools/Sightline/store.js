import { create } from 'zustand'

export const MULTI_SOURCE_COLORS = [
    { r: 255, g: 180, b: 40 },
    { r: 230, g: 75, b: 75 },
    { r: 80, g: 140, b: 255 },
    { r: 80, g: 210, b: 80 },
    { r: 255, g: 120, b: 200 },
    { r: 170, g: 100, b: 255 },
    { r: 50, g: 210, b: 210 },
    { r: 255, g: 160, b: 60 },
    { r: 180, g: 220, b: 80 },
    { r: 255, g: 210, b: 100 },
]

export function buildSourcesList(vars) {
    const list = []
    if (vars?.sources?.length > 0) {
        vars.sources.forEach((s) => list.push(s))
    }
    list.push({ name: 'Custom', value: false })
    return list
}

function makeDefaultElement(id, vars) {
    const color = MULTI_SOURCE_COLORS[id % MULTI_SOURCE_COLORS.length]
    return {
        id,
        name: `Sightline ${id}`,
        on: true,
        expanded: false,
        dataIndex: 0,
        color: { ...color },
        opacity: 0.5,
        resolution: 1,
        height: vars?.defaultHeight || 0,
        observer: vars?.observers?.[0]?.value || null,
        sourceIndex: 0,
        customAz: NaN,
        customEl: NaN,
        customRange: NaN,
        loading: false,
        loadingProgress: 0,
        regenerating: false,
        changed: true,
        lastError: false,
        sightlineMode: 'static',
        sweepProgress: '',
        raeResults: null,
        allResults: null,
    }
}

const useSightlineStore = create((set, get) => ({
    vars: null,
    activeElmId: 0,
    elements: {},
    elmCount: 0,
    firstOpen: true,
    utcTime: '',
    rawTime: '',
    lastConvertedMs: '000',
    indicatorLastDragPoint: null,

    canvases: {},
    tags: {},
    shedMarkers: {},
    lastData: null,
    lastResultGrid: null,
    lastOptions: null,

    // Sweep state — shared options
    sweepStart: '',
    sweepEnd: '',
    sweepStep: 60,
    sweepPlaying: false,
    sweepPlayIndex: 0,
    sweepPlaySpeed: 500,
    sweepProgress: '',
    sweepProgressPct: 0,
    sweepCurrentElm: 0,
    sweepTotalElms: 0,
    sweepViewMode: 'composite',
    hoverFrac: null,
    sweepStale: false,
    sweepCardOrder: [],
    sweepDiscrete: false,
    sweepFitToData: true,

    // Per-element sweep data: { [elmId]: { results, grids, heatmap, opacity, colorRamp, discrete, atlas, lastData, lastOptions } }
    sweepElData: {},

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
                resolution:
                    initObj.resolution != null
                        ? initObj.resolution
                        : el.resolution,
                height: initObj.height != null ? initObj.height : el.height,
                sourceIndex:
                    initObj.sourceIndex != null
                        ? initObj.sourceIndex
                        : el.sourceIndex,
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

    toggleAll: () =>
        set((state) => {
            const allOn = Object.values(state.elements).every((e) => e.on)
            const next = {}
            for (const id in state.elements) {
                next[id] = { ...state.elements[id], on: !allOn }
            }
            return { elements: next }
        }),

    setSweepField: (field, value) => set({ [field]: value }),

    _defaultSweepEl: () => ({ results: null, grids: null, heatmap: null, opacity: 1.0, colorRamp: 'sightline', discrete: false, atlas: null, lastData: null, lastOptions: null, minFrac: 0, maxFrac: 1, colorStops: null }),
    getSweepElData: (elmId) => {
        return get().sweepElData[elmId] || null
    },
    setSweepElField: (elmId, field, value) =>
        set((state) => ({
            sweepElData: {
                ...state.sweepElData,
                [elmId]: {
                    ...(state.sweepElData[elmId] || get()._defaultSweepEl()),
                    [field]: value,
                },
            },
        })),
    initSweepElData: (elmId) =>
        set((state) => ({
            sweepElData: {
                ...state.sweepElData,
                [elmId]: state.sweepElData[elmId] || get()._defaultSweepEl(),
            },
        })),
    hasSweepData: () => {
        const sd = get().sweepElData
        return Object.keys(sd).some((id) => sd[id]?.heatmap != null)
    },
    getSweepFrameCount: () => {
        const sd = get().sweepElData
        for (const id in sd) {
            if (sd[id]?.grids?.length > 0) return sd[id].grids.length
        }
        return 0
    },

    setSweepCardOrder: (order) => set({ sweepCardOrder: order }),
    elementOrder: [],
    setElementOrder: (order) => set({ elementOrder: order }),

    getSelectedSources: (elmId) => {
        const { elements, vars } = get()
        const el = elements[elmId]
        if (!el) return []
        const sourcesList = buildSourcesList(vars)
        const src = sourcesList[el.sourceIndex]
        if (!src) return []
        return [
            {
                ...src,
                index: el.sourceIndex,
                color: el.color,
                opacity: el.opacity,
            },
        ]
    },

    getSightlineOptions: (elmId) => {
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
            resolution: el.resolution,
            invert: 0,
            target: targets.length > 0 ? targets[0].value : 'false',
            targets,
            compositeMode: 'or',
            targetHeight: parseFloat(el.height) || 0,
            observer: el.observer,
            height: el.height,
            time: state.rawTime,
        }
    },
}))

export default useSightlineStore
