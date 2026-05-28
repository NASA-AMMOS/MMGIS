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
    { r: 100, g: 100, b: 100 },
    { r: 200, g: 160, b: 60 },
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
        name: `Shade ${id}`,
        on: true,
        expanded: false,
        dataIndex: 0,
        color: { ...color },
        opacity: 0.75,
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
        raeResults: null,
        allResults: null,
    }
}

const useShadeStore = create((set, get) => ({
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

    // Sweep state
    sweepStart: '',
    sweepEnd: '',
    sweepStep: 60,
    sweepResults: null,
    sweepGrids: null,
    sweepPlaying: false,
    sweepPlayIndex: 0,
    sweepPlaySpeed: 500,
    sweepProgress: '',
    sweepProgressPct: 0,
    sweepHeatmap: null,
    sweepViewMode: 'composite',
    sweepColorRamp: 'shadow',
    sweepDiscrete: false,

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
            resolution: el.resolution,
            invert: 1,
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

export default useShadeStore
