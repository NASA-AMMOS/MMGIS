import React, { useEffect, useCallback } from 'react'
import useShadeStore from '../store'
import ShadeElement from './ShadeElement'
import SweepSection from './SweepSection'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'

const helpKey = 'ShadeToolNew'

export default function ShadePanel({ onTimeChange }) {
    const vars = useShadeStore((s) => s.vars)
    const elements = useShadeStore((s) => s.elements)
    const activeElmId = useShadeStore((s) => s.activeElmId)
    const utcTime = useShadeStore((s) => s.utcTime)

    const addElement = useShadeStore((s) => s.addElement)

    const handleNew = useCallback(() => {
        addElement()
    }, [addElement])

    useEffect(() => {
        Help.finalize(helpKey)
    }, [])

    if (!TimeControl.enabled) {
        return (
            <div id="shadeTool" className="shadeToolNew">
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translateX(-50%) translateY(-50%)',
                        textAlign: 'center',
                        color: 'var(--color-h)',
                    }}
                >
                    The Shade Tool requires that Time be enabled by the
                    administrators.
                </div>
            </div>
        )
    }

    const elementIds = Object.keys(elements).sort(
        (a, b) => parseInt(a) - parseInt(b)
    )

    return (
        <div id="shadeTool" className="shadeToolNew">
            <div id="vstHeader">
                <div>
                    <div>
                        <div id="vstTitle">Shade</div>
                        <span
                            dangerouslySetInnerHTML={{
                                __html: Help.getComponent(helpKey),
                            }}
                        />
                    </div>
                </div>
                <div className="vstOptionTime">
                    <div className="flexbetween">
                        <div className="vstClockIcon">
                            <i className="mdi mdi-clock-outline mdi-18px" />
                        </div>
                        <input type="text" value={utcTime} readOnly />
                    </div>
                </div>
            </div>
            <div id="vstContent">
                <ul id="vstShades">
                    {elementIds.map((id) => (
                        <ShadeElement
                            key={id}
                            elmId={parseInt(id)}
                            isActive={parseInt(id) === activeElmId}
                        />
                    ))}
                </ul>
                <SweepSection />
            </div>
        </div>
    )
}
