import React, { useEffect, useCallback, useMemo, useState } from 'react'
import useShadeStore from '../store'
import ShadeElement from './ShadeElement'
import SweepSection from './SweepSection'
import ShadeTool from '../ShadeTool'
import Help from '../../../Basics/UserInterface_/components/Help/Help'
import TimeControl from '../../../Basics/TimeControl_/TimeControl'
import ToolController_ from '../../../Basics/ToolController_/ToolController_'
import { Button, IconButton, Tabs } from '../../../../design-system/components'

const helpKey = 'ShadeTool'

const SHADE_TABS = [
    { value: 'shademaps', label: 'Shademaps', icon: 'mdi-layers-outline' },
    { value: 'sweep', label: 'Sweep', icon: 'mdi-timelapse' },
]

export default function ShadePanel() {
    const vars = useShadeStore((s) => s.vars)
    const elements = useShadeStore((s) => s.elements)
    const utcTime = useShadeStore((s) => s.utcTime)
    const addElement = useShadeStore((s) => s.addElement)
    const [activeTab, setActiveTab] = useState('shademaps')

    useEffect(() => {
        Help.finalize(helpKey)
    }, [])

    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab)
        if (tab === 'shademaps') {
            ShadeTool.showShademapLayers()
        } else if (tab === 'sweep') {
            ShadeTool.showSweepLayers()
        }
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
            <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                tabs={SHADE_TABS}
                className="vstTabs"
            >
                {/* Shademaps tab */}
                <div>
                    <div className="vstTime">
                        <div className="vstClockIcon">
                            <i className="mdi mdi-clock-outline mdi-14px" />
                        </div>
                        <span>{utcTime}</span>
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
                </div>
                {/* Sweep tab */}
                <SweepSection />
            </Tabs>
        </div>
    )
}
