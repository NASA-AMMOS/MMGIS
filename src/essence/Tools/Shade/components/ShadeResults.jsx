import React, { useRef } from 'react'
import useShadeStore from '../store'

export default function ShadeResults({ elmId }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const azCanvasRef = useRef(null)
    const elCanvasRef = useRef(null)

    const raeResults = el?.raeResults
    const hasValues = raeResults && (raeResults.az || raeResults.el)

    if (!hasValues) return null

    return (
        <div className="vstResults">
            <div id={`shadeTool_indicators_${elmId}`}>
                <div>
                    <canvas id={`shadeTool_az_${elmId}`} ref={azCanvasRef} />
                    <div id={`shadeTool_azValue_${elmId}`}>Az: {raeResults?.az || '--'}</div>
                </div>
                <div>
                    <canvas id={`shadeTool_el_${elmId}`} ref={elCanvasRef} />
                    <div id={`shadeTool_elValue_${elmId}`}>El: {raeResults?.el || '--'}</div>
                </div>
            </div>
        </div>
    )
}
