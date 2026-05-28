import React, { useRef } from 'react'
import useShadeStore from '../store'

export default function ShadeResults({ elmId }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const azCanvasRef = useRef(null)
    const elCanvasRef = useRef(null)

    const raeResults = el?.raeResults

    return (
        <div className="vstResults">
            <div className="vstResultsOutputs">
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">Azimuth</div>
                    <span className="vstResultValue">
                        {raeResults?.az || '--'}
                    </span>
                </div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">Elevation</div>
                    <span className="vstResultValue">
                        {raeResults?.el || '--'}
                    </span>
                </div>
                <div className="vstOptionRow">
                    <div className="vstOptionLabel">Range</div>
                    <span className="vstResultValue">
                        {raeResults?.range || '--'}
                    </span>
                </div>
            </div>
            <div id={`shadeTool_indicators_${elmId}`}>
                <div>
                    <div>Azimuth</div>
                    <canvas id={`shadeTool_az_${elmId}`} ref={azCanvasRef} />
                    <div id={`shadeTool_azValue_${elmId}`} />
                </div>
                <div>
                    <div>Elevation</div>
                    <canvas id={`shadeTool_el_${elmId}`} ref={elCanvasRef} />
                    <div id={`shadeTool_elValue_${elmId}`} />
                </div>
            </div>
        </div>
    )
}
