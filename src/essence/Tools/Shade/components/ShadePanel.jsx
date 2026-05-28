import React, { useEffect, useCallback, useMemo } from 'react'
import useShadeStore from '../store'
import ShadeElement from './ShadeElement'
import SweepSection from './SweepSection'
import ShadeTool from '../ShadeTool'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import ToolController_ from '../../../Basics/ToolController_/ToolController_'
import { Button, IconButton } from '../../../../design-system/components'

const helpKey = 'ShadeTool'

export default function ShadePanel() {
    const vars = useShadeStore((s) => s.vars)
    const elements = useShadeStore((s) => s.elements)
    const utcTime = useShadeStore((s) => s.utcTime)
    const addElement = useShadeStore((s) => s.addElement)

    useEffect(() => {
        Help.finalize(helpKey)
    }, [])

    const handleNew = useCallback(() => {
        const newId = addElement()
        setTimeout(() => ShadeTool.shade(null, newId), 0)
    }, [addElement])

    const elementIds = useMemo(
        () =>
            Object.keys(elements).sort(
                (a, b) => parseInt(a) - parseInt(b)
            ),
        [elements]
    )


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
                <div className="vstTime">
                    <div className="vstClockIcon">
                        <i className="mdi mdi-clock-outline mdi-14px" />
                    </div>
                    <span>{utcTime}</span>
                </div>
            </div>
            <div className="vstContent">
                {elementIds.map((id) => (
                    <ShadeElement key={id} elmId={parseInt(id)} />
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
            <SweepSection />
        </div>
    )
}
