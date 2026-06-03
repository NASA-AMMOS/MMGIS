import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import useShadeStore, { buildSourcesList } from '../store'
import ShadeElement from './ShadeElement'
import ShadeTool from '../ShadeTool'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import TimeUI from '../../../Basics/TimeControl_/TimeUI'
import ToolController_ from '../../../Basics/ToolController_/ToolController_'
import { Button, IconButton, InputWithUnit, Tooltip } from '../../../../design-system/components'

const helpKey = 'ShadeTool'

export default function ShadePanel() {
    const vars = useShadeStore((s) => s.vars)
    const elements = useShadeStore((s) => s.elements)
    const addElement = useShadeStore((s) => s.addElement)
    const elementOrder = useShadeStore((s) => s.elementOrder)
    const setElementOrder = useShadeStore((s) => s.setElementOrder)
    const sweepStart = useShadeStore((s) => s.sweepStart)
    const sweepEnd = useShadeStore((s) => s.sweepEnd)
    const sweepStep = useShadeStore((s) => s.sweepStep)
    const setSweepField = useShadeStore((s) => s.setSweepField)

    const dragItemRef = useRef(null)
    const [dropTargetId, setDropTargetId] = useState(null)

    useEffect(() => {
        Help.finalize(helpKey)
    }, [])

    // Keep sweep start/end times in sync with TimeUI changes
    useEffect(() => {
        const fmtUTC = (s) =>
            s ? s.replace(/\.\d{3}Z$/, 'Z').replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z') : s
        function getTimeUIMode() {
            if (!TimeUI.modes) return 'Range'
            return TimeUI.modes[TimeUI.modeIndex] || 'Range'
        }

        // Sync on mount
        const mode = getTimeUIMode()
        const startTime = TimeControl.getStartTime()
        const endTime = TimeControl.getEndTime()
        const currentTime = TimeControl.getTime()
        if (mode === 'Point') {
            if (currentTime) setSweepField('sweepStart', fmtUTC(currentTime))
        } else {
            if (startTime) setSweepField('sweepStart', fmtUTC(startTime))
            if (endTime) setSweepField('sweepEnd', fmtUTC(endTime))
        }

        // Subscribe for ongoing changes
        TimeControl.subscribe('ShadeTool_TimeSync', (t) => {
            const m = getTimeUIMode()
            if (m === 'Point') {
                if (t.currentTime) setSweepField('sweepStart', fmtUTC(t.currentTime))
            } else {
                if (t.startTime) setSweepField('sweepStart', fmtUTC(t.startTime))
                if (t.endTime) setSweepField('sweepEnd', fmtUTC(t.endTime))
            }
        })

        return () => {
            TimeControl.unsubscribe('ShadeTool_TimeSync')
        }
    }, [setSweepField])

    const handleNew = useCallback(() => {
        // Cycle through non-custom source entities for the new element
        const store = useShadeStore.getState()
        const sources = buildSourcesList(store.vars)
        const nonCustomIndices = sources
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.value !== false && s.value !== 'false')
            .map(({ i }) => i)

        let nextSourceIndex = 0
        if (nonCustomIndices.length > 0) {
            // Find what source indices existing elements already use
            const usedIndices = Object.values(store.elements).map((el) => el.sourceIndex)
            // Pick the next non-custom index that continues the cycle
            const lastUsed = usedIndices.length > 0 ? usedIndices[usedIndices.length - 1] : -1
            const posInCycle = nonCustomIndices.indexOf(lastUsed)
            nextSourceIndex = nonCustomIndices[(posInCycle + 1) % nonCustomIndices.length]
        }

        const newId = addElement(undefined, { sourceIndex: nextSourceIndex })
        setTimeout(() => ShadeTool.shade(null, newId), 0)
    }, [addElement])

    const elementIds = useMemo(() => {
        const allIds = Object.keys(elements).map(Number)
        const ordered = (elementOrder || []).filter((id) => allIds.includes(id))
        allIds.forEach((id) => {
            if (!ordered.includes(id)) ordered.push(id)
        })
        return ordered
    }, [elements, elementOrder])

    // Drag reorder
    const handleElDragStart = useCallback((e, elmId) => {
        dragItemRef.current = elmId
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const handleElDragOver = useCallback((e, targetId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragItemRef.current != null && targetId !== dragItemRef.current) {
            setDropTargetId(targetId)
        }
    }, [])

    const handleElDragEnd = useCallback(() => {
        setDropTargetId(null)
    }, [])

    const handleElDrop = useCallback((e, targetId) => {
        e.preventDefault()
        setDropTargetId(null)
        const draggedId = dragItemRef.current
        if (draggedId == null || draggedId === targetId) return
        const order = [...elementIds]
        const fromIdx = order.indexOf(draggedId)
        const toIdx = order.indexOf(targetId)
        if (fromIdx < 0 || toIdx < 0) return
        order.splice(fromIdx, 1)
        order.splice(toIdx, 0, draggedId)
        setElementOrder(order)
        ShadeTool.reorderShadeLayers(order)
        dragItemRef.current = null
    }, [elementIds, setElementOrder])

    if (!TimeControl.enabled) {
        return (
            <div id="shadeTool">
                <div className="vstTimeDisabled">
                    The Shade Tool requires that Time be enabled by the
                    administrators.
                </div>
            </div>
        )
    }

    return (
        <div id="shadeTool">
            <div className="mmgisToolHeader">
                <div>
                    <div>
                        <div className="mmgisToolTitle">Shade</div>
                        <span
                            dangerouslySetInnerHTML={{
                                __html: Help.getComponent(helpKey),
                            }}
                        />
                    </div>
                    <div>
                        <IconButton
                            size="sm"
                            onClick={() => ToolController_.closeActiveTool()}
                            title="Close Tool"
                        >
                            <i className="mdi mdi-close mdi-18px" />
                        </IconButton>
                    </div>
                </div>
            </div>
            <div className="vstBinaryLegend">
                <div className="vstBinaryLegendItem">
                    <div className="vstBinaryLegendSwatch vstBinaryLegendInShadow" />
                    <span>In Shadow <span className="vstBinaryLegendMuted">Filled</span></span>
                </div>
                <div className="vstBinaryLegendItem">
                    <div className="vstBinaryLegendSwatch vstBinaryLegendNotVisible" />
                    <span>Source Visible <span className="vstBinaryLegendMuted">Empty</span></span>
                </div>
            </div>

            {/* Time section — single row: [start] [step|min] [end] */}
            <div className="vstTime">
                <Tooltip content="Start Time" placement="top">
                    <span className="vstTimeReadonly">
                        {sweepStart ? sweepStart.replace(/:\d{2}Z$/, 'Z').replace(/:\d{2}\.\d+Z$/, 'Z') : 'Start'}
                    </span>
                </Tooltip>
                <Tooltip content="Step size (minutes) — used for playback and composite sweep intervals" placement="top">
                    <span>
                        <InputWithUnit
                            unit="min"
                            type="number"
                            min="1"
                            step="1"
                            value={sweepStep || ''}
                            onChange={(e) => {
                                const v = parseFloat(e.target.value)
                                setSweepField('sweepStep', Number.isFinite(v) ? v : '')
                            }}
                            className="vstSweepField vstTimeStep"
                            placeholder="Step"
                        />
                    </span>
                </Tooltip>
                <Tooltip content="End Time" placement="top">
                    <span className="vstTimeReadonly">
                        {sweepEnd ? sweepEnd.replace(/:\d{2}Z$/, 'Z').replace(/:\d{2}\.\d+Z$/, 'Z') : 'End'}
                    </span>
                </Tooltip>
            </div>

            {/* Element cards */}
            <div className="vstContent">
                {elementIds.map((id) => (
                    <ShadeElement
                        key={id}
                        elmId={id}
                        onDragStart={handleElDragStart}
                        onDragOver={handleElDragOver}
                        onDragEnd={handleElDragEnd}
                        onDrop={handleElDrop}
                        isDropTarget={dropTargetId === id}
                    />
                ))}
                <div className="vstNewBtnWrap">
                    <Button
                        className="vstNewBtn"
                        onClick={handleNew}
                    >
                        <i className="mdi mdi-plus mdi-18px" />
                        New
                    </Button>
                </div>
            </div>

        </div>
    )
}
