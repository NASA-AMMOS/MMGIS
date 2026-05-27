import React, { useRef, useEffect } from 'react'
import useShadeStore, { buildSourcesList } from '../store'

export default function ShadeResults({ elmId }) {
    const el = useShadeStore((s) => s.elements[elmId])
    const updateElement = useShadeStore((s) => s.updateElement)
    const vars = useShadeStore((s) => s.vars)
    const azCanvasRef = useRef(null)
    const elCanvasRef = useRef(null)

    const raeResults = el?.raeResults
    const sourcesList = buildSourcesList(vars)
    const hasCustom = (el?.selectedSourceIndices || []).some((i) => {
        const src = sourcesList[i]
        return src && src.value === false
    })

    return (
        <div id="shadeTool_results">
            <div id="shadeTool_results_title">Results</div>
            <div id="shadeTool_results_outputs">
                <ul>
                    <li>
                        <div>Azimuth</div>
                        <div id="shadeTool_results_outputs_az">
                            {raeResults?.az || '--'}
                        </div>
                        {hasCustom && (
                            <div
                                className="flexbetween"
                                id="shadeTool_results_outputs_az_input_wrap"
                            >
                                <input
                                    id="shadeTool_results_outputs_az_input"
                                    type="number"
                                    min="0"
                                    max="360"
                                    value={isNaN(el.customAz) ? '' : el.customAz}
                                    onChange={(e) =>
                                        updateElement(elmId, {
                                            customAz: parseFloat(
                                                e.target.value
                                            ),
                                        })
                                    }
                                />
                                <div className="vstUnit smallFont">&deg;</div>
                            </div>
                        )}
                    </li>
                    <li>
                        <div>Elevation</div>
                        <div id="shadeTool_results_outputs_el">
                            {raeResults?.el || '--'}
                        </div>
                        {hasCustom && (
                            <div
                                className="flexbetween"
                                id="shadeTool_results_outputs_el_input_wrap"
                            >
                                <input
                                    id="shadeTool_results_outputs_el_input"
                                    type="number"
                                    min="-90"
                                    max="90"
                                    value={isNaN(el.customEl) ? '' : el.customEl}
                                    onChange={(e) =>
                                        updateElement(elmId, {
                                            customEl: parseFloat(
                                                e.target.value
                                            ),
                                        })
                                    }
                                />
                                <div className="vstUnit smallFont">&deg;</div>
                            </div>
                        )}
                    </li>
                    <li>
                        <div>Range</div>
                        <div id="shadeTool_results_outputs_range">
                            {raeResults?.range || '--'}
                        </div>
                        {hasCustom && (
                            <div
                                className="flexbetween"
                                id="shadeTool_results_outputs_range_input_wrap"
                            >
                                <input
                                    id="shadeTool_results_outputs_range_input"
                                    type="number"
                                    disabled
                                    value={
                                        isNaN(el.customRange)
                                            ? ''
                                            : el.customRange
                                    }
                                />
                                <div className="vstUnit smallFont">km</div>
                            </div>
                        )}
                    </li>
                </ul>
            </div>
            <div id="shadeTool_indicators">
                <div>
                    <div>Azimuth</div>
                    <canvas id="shadeTool_az" ref={azCanvasRef} />
                    <div id="shadeTool_azValue" />
                </div>
                <div>
                    <div>Elevation</div>
                    <canvas id="shadeTool_el" ref={elCanvasRef} />
                    <div id="shadeTool_elValue" />
                </div>
            </div>
        </div>
    )
}
