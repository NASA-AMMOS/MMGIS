import React, { useEffect, useCallback, useMemo } from 'react'
import useShadeStore from '../store'
import ShadeElement from './ShadeElement'
import SweepSection from './SweepSection'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import ToolController_ from '../../../Basics/ToolController_/ToolController_'
import { Button, IconButton, Checkbox } from '../../../../design-system/components'

const helpKey = 'ShadeTool'

export default function ShadePanel() {
    const vars = useShadeStore((s) => s.vars)
    const elements = useShadeStore((s) => s.elements)
    const utcTime = useShadeStore((s) => s.utcTime)
    const addElement = useShadeStore((s) => s.addElement)
    const toggleAll = useShadeStore((s) => s.toggleAll)

    useEffect(() => {
        Help.finalize(helpKey)
    }, [])

    const handleNew = useCallback(() => {
        addElement()
    }, [addElement])

    const elementIds = useMemo(
        () =>
            Object.keys(elements).sort(
                (a, b) => parseInt(a) - parseInt(b)
            ),
        [elements]
    )

    const allOn = useMemo(
        () =>
            elementIds.length > 0 &&
            elementIds.every((id) => elements[id]?.on),
        [elements, elementIds]
    )

    if (!TimeControl.enabled) {
        return (
            <div id="shadeTool" className="shadeToolNew">
                <div className="vstTimeDisabled">
                    The Shade Tool requires that Time be enabled by the
                    administrators.
                </div>
            </div>
        )
    }

    return (
        <div id="shadeTool" className="shadeToolNew">
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
                <div className="vstTime">
                    <div className="vstClockIcon">
                        <i className="mdi mdi-clock-outline mdi-14px" />
                    </div>
                    <span>{utcTime}</span>
                </div>
                <div className="vstSubHeader">
                    <Checkbox
                        checked={allOn}
                        onCheckedChange={toggleAll}
                    >
                        Toggle All
                    </Checkbox>
                    <Button size="md" onClick={handleNew}>
                        <i className="mdi mdi-plus mdi-18px" />
                        New
                    </Button>
                </div>
            </div>
            <div className="vstContent">
                {elementIds.map((id) => (
                    <ShadeElement key={id} elmId={parseInt(id)} />
                ))}
            </div>
            <SweepSection />
        </div>
    )
}
