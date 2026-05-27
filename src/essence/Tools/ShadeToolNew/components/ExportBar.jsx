import React, { useCallback } from 'react'
import ShadeToolNew from '../ShadeToolNew'

export default function ExportBar({ elmId }) {
    const handlePNG = useCallback(
        () => ShadeToolNew.exportPNG(elmId),
        [elmId]
    )
    const handleCSV = useCallback(() => ShadeToolNew.exportCSV(), [])
    const handleGeoJSON = useCallback(
        () => ShadeToolNew.exportGeoJSON(elmId),
        [elmId]
    )
    const handleReport = useCallback(
        () => ShadeToolNew.exportReport(elmId),
        [elmId]
    )

    return (
        <>
            <div className="vstOptionHeading">Download</div>
            <div className="vstExportBar">
                <div onClick={handlePNG} title="Export shade map as PNG">
                    <i className="mdi mdi-image mdi-14px" /> PNG
                </div>
                <div onClick={handleCSV} title="Export sweep results as CSV">
                    <i className="mdi mdi-file-delimited mdi-14px" /> CSV
                </div>
                <div
                    onClick={handleGeoJSON}
                    title="Export shade map as GeoJSON"
                >
                    <i className="mdi mdi-map mdi-14px" /> GeoJSON
                </div>
                <div onClick={handleReport} title="Export report as JSON">
                    <i className="mdi mdi-code-json mdi-14px" /> Report
                </div>
            </div>
        </>
    )
}
