import React, { useRef, useEffect } from 'react'
import useSightlineStore from '../store'
import SightlineTool from '../SightlineTool'

export default function SightlineResults({ elmId }) {
    const el = useSightlineStore((s) => s.elements[elmId])
    const azCanvasRef = useRef(null)
    const elCanvasRef = useRef(null)

    const raeResults = el?.raeResults
    const hasValues = raeResults && (raeResults.az || raeResults.el)

    // Redraw indicators after mount/update when raeResults change
    useEffect(() => {
        if (!hasValues || !el?.raeRaw) return
        // Small delay to ensure canvas is in DOM after conditional render
        const timer = setTimeout(() => {
            SightlineTool.updateRAEIndicators(el.raeRaw, elmId, el.raeAllResults || [el.raeRaw])
        }, 0)
        return () => clearTimeout(timer)
    }, [hasValues, elmId, el?.raeRaw])

    if (!hasValues) return null

    return (
        <div className="vstResults">
            <div id={`sightlineTool_indicators_${elmId}`}>
                <div>
                    <canvas id={`sightlineTool_az_${elmId}`} ref={azCanvasRef} />
                    <div id={`sightlineTool_azValue_${elmId}`}>Az: {raeResults?.az || '--'}</div>
                </div>
                <div>
                    <canvas id={`sightlineTool_el_${elmId}`} ref={elCanvasRef} />
                    <div id={`sightlineTool_elValue_${elmId}`}>El: {raeResults?.el || '--'}</div>
                </div>
            </div>
        </div>
    )
}
