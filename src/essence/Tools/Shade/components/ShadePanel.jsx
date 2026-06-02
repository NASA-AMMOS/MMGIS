import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import useShadeStore from '../store'
import ShadeElement from './ShadeElement'
import ShadeTool from '../ShadeTool'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import ToolController_ from '../../../Basics/ToolController_/ToolController_'
import { Button, IconButton, InputWithUnit } from '../../../../design-system/components'

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

    const handleNew = useCallback(() => {
        const newId = addElement()
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
            <div className="vstHeader">
                <div className="vstHeaderTop">
                    <div className="vstHeaderLeft">
                        <div className="vstTitle">Shade</div>
                        <span
                            dangerouslySetInnerHTML={{
                                __html: Help.getComponent(helpKey),
                            }}
                        />
                    </div>
                    <IconButton
                        size="sm"
                        onClick={() => ToolController_.closeActiveTool()}
                        title="Close"
                        className="vstClose"
                    >
                        <i className="mdi mdi-close mdi-18px" />
                    </IconButton>
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

            {/* Time section — UTC start/end times + step size */}
            <div className="vstTime">
                <div className="vstOptionRow">
                    <div className="vstOptionLabel vstTimeLabel">
                        <i className="mdi mdi-clock-outline mdi-14px" /> Start
                    </div>
                    <input
                        type="text"
                        className="vstSweepInput"
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        value={sweepStart}
                        onChange={(e) => setSweepField('sweepStart', e.target.value)}
                    />
                </div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel vstTimeLabel">
                        <i className="mdi mdi-clock-outline mdi-14px" /> End
                    </div>
                    <input
                        type="text"
                        className="vstSweepInput"
                        placeholder="YYYY-MM-DDTHH:MM:SSZ"
                        value={sweepEnd}
                        onChange={(e) => setSweepField('sweepEnd', e.target.value)}
                    />
                </div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel vstTimeLabel">Step Size</div>
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
                        className="vstSweepField"
                    />
                </div>
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
