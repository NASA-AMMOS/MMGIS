import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { utcFormat, utcParse } from 'd3-time-format'
import useSightlineStore, { buildSourcesList } from '../store'
import SightlineElement from './SightlineElement'
import SightlineTool from '../SightlineTool'
import Help from '../../../../../src/essence/Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../../../src/essence/Basics/TimeControl_/TimeControl'
import TimeUI from '../../../../../src/essence/Basics/TimeControl_/TimeUI'
import ToolController_ from '../../../../../src/essence/Basics/ToolController_/ToolController_'
import { Button, IconButton, InputWithUnit, Tooltip } from '../../../../../src/design-system/components'

const helpKey = 'SightlineTool'

export default function SightlinePanel() {
    const vars = useSightlineStore((s) => s.vars)
    const elements = useSightlineStore((s) => s.elements)
    const addElement = useSightlineStore((s) => s.addElement)
    const elementOrder = useSightlineStore((s) => s.elementOrder)
    const setElementOrder = useSightlineStore((s) => s.setElementOrder)
    const sweepStart = useSightlineStore((s) => s.sweepStart)
    const sweepEnd = useSightlineStore((s) => s.sweepEnd)
    const sweepStep = useSightlineStore((s) => s.sweepStep)
    const setSweepField = useSightlineStore((s) => s.setSweepField)

    const dragItemRef = useRef(null)
    const [dropTargetId, setDropTargetId] = useState(null)
    const [dropPosition, setDropPosition] = useState('above')
    const [editableTime, setEditableTime] = useState('')
    const [rawTime, setRawTime] = useState('')

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
        function updateEditableTime(time) {
            if (!time) return
            setRawTime(time)
            setEditableTime(SightlineTool.parseToUTCTime(time, true))
        }

        // Sync on mount
        const mode = getTimeUIMode()
        const startTime = TimeControl.getStartTime()
        const endTime = TimeControl.getEndTime()
        const currentTime = TimeControl.getTime()
        if (mode === 'Point') {
            if (currentTime) setSweepField('sweepStart', fmtUTC(currentTime))
            updateEditableTime(currentTime)
        } else {
            if (startTime) setSweepField('sweepStart', fmtUTC(startTime))
            if (endTime) setSweepField('sweepEnd', fmtUTC(endTime))
            updateEditableTime(endTime)
        }

        // Subscribe for ongoing changes
        TimeControl.subscribe('SightlineTool_TimeSync', (t) => {
            const m = getTimeUIMode()
            if (m === 'Point') {
                if (t.currentTime) setSweepField('sweepStart', fmtUTC(t.currentTime))
                updateEditableTime(t.currentTime)
            } else {
                if (t.startTime) setSweepField('sweepStart', fmtUTC(t.startTime))
                if (t.endTime) setSweepField('sweepEnd', fmtUTC(t.endTime))
                updateEditableTime(t.endTime)
            }
        })

        return () => {
            TimeControl.unsubscribe('SightlineTool_TimeSync')
        }
    }, [setSweepField])

    const handleNew = useCallback(() => {
        // Cycle through non-custom source entities for the new element
        const store = useSightlineStore.getState()
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
        setTimeout(() => SightlineTool.sightline(null, newId), 0)
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
            const rect = e.currentTarget.getBoundingClientRect()
            const midY = rect.top + rect.height / 2
            setDropPosition(e.clientY < midY ? 'above' : 'below')
        }
    }, [])

    const handleElDragEnd = useCallback(() => {
        setDropTargetId(null)
        setDropPosition('above')
    }, [])

    const handleElDrop = useCallback((e, targetId) => {
        e.preventDefault()
        const pos = dropPosition
        setDropTargetId(null)
        setDropPosition('above')
        const draggedId = dragItemRef.current
        if (draggedId == null || draggedId === targetId) return
        const order = [...elementIds]
        const fromIdx = order.indexOf(draggedId)
        let toIdx = order.indexOf(targetId)
        if (fromIdx < 0 || toIdx < 0) return
        order.splice(fromIdx, 1)
        // Recalculate toIdx after removal
        toIdx = order.indexOf(targetId)
        if (pos === 'below') toIdx += 1
        order.splice(toIdx, 0, draggedId)
        setElementOrder(order)
        SightlineTool.reorderSightlineLayers(order)
        dragItemRef.current = null
    }, [elementIds, setElementOrder, dropPosition])

    if (!TimeControl.enabled) {
        return (
            <div id="sightlineTool">
                <div className="vstTimeDisabled">
                    The Shade Tool requires that Time be enabled by the
                    administrators.
                </div>
            </div>
        )
    }

    return (
        <div id="sightlineTool">
            <div className="mmgisToolHeader">
                <div>
                    <div>
                        <div className="mmgisToolTitle">Sightline</div>
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
            {/* Editable current time field — matches old ShadeTool vstOptionTime */}
            <div className="vstOptionTime">
                <div className="flexbetween">
                    <div className="vstClockIcon"><i className="mdi mdi-clock-outline mdi-18px" /></div>
                    <input
                        type="text"
                        value={editableTime}
                        title={rawTime}
                        onChange={(e) => setEditableTime(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                        onBlur={() => {
                            let time = editableTime
                            if (vars?.utcTimeFormat) {
                                const parseTime = utcParse(vars.utcTimeFormat)
                                const parsed = parseTime(time)
                                if (parsed) {
                                    time = parsed.toISOString()
                                } else {
                                    return
                                }
                            } else {
                                if (!time.endsWith('Z')) time += 'Z'
                            }
                            try {
                                new Date(time).toISOString()
                            } catch {
                                return
                            }
                            TimeControl.setTime(TimeControl.getStartTime(), time)
                        }}
                    />
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
                    <SightlineElement
                        key={id}
                        elmId={id}
                        onDragStart={handleElDragStart}
                        onDragOver={handleElDragOver}
                        onDragEnd={handleElDragEnd}
                        onDrop={handleElDrop}
                        isDropTarget={dropTargetId === id}
                        dropPosition={dropTargetId === id ? dropPosition : null}
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
