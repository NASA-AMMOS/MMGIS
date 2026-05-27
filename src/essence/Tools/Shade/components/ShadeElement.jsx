import React, { useCallback } from 'react'
import useShadeStore from '../store'
import SourceList from './SourceList'
import ShadeOptions from './ShadeOptions'
import ShadeResults from './ShadeResults'
import ExportBar from './ExportBar'
import ShadeTool from '../ShadeTool'

export default function ShadeElement({ elmId, isActive }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const setActiveElmId = useShadeStore((s) => s.setActiveElmId)

    const handleGenerate = useCallback(() => {
        if (!el?.changed || el?.regenerating) return
        ShadeTool.shade(null, elmId)
    }, [elmId, el?.changed, el?.regenerating])

    if (!el) return null

    return (
        <li id={'vstId_' + elmId} shadeid={String(elmId)}>
            <div className="vstShadeContents open">
                <div
                    className={'vstLoading' + (el.loading ? ' on' : '')}
                    style={{ width: el.loadingProgress + '%' }}
                />
                <div className="vstOptionHeading">Source</div>
                <SourceList elmId={elmId} />
                <ShadeOptions elmId={elmId} />
                <div className="vstShadeBar">
                    <div
                        className={
                            'vstRegen' +
                            (el.changed ? ' changed' : '') +
                            (el.regenerating ? ' regening' : '')
                        }
                        onClick={handleGenerate}
                    >
                        <div>
                            {el.regenerating
                                ? `Regenerating: ${Math.round(el.loadingProgress)}%`
                                : 'Generate'}
                        </div>
                        <span
                            style={{
                                width: el.regenerating
                                    ? el.loadingProgress + '%'
                                    : '0%',
                            }}
                        />
                    </div>
                </div>
                <ExportBar elmId={elmId} />
            </div>
            <ShadeResults elmId={elmId} />
        </li>
    )
}
