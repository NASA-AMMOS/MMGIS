import React, { useCallback } from 'react'
import ShadeTool from '../ShadeTool'
import { Button } from '../../../../design-system/components'

export default function ExportBar({ elmId }) {
    const handlePNG = useCallback(() => ShadeTool.exportPNG(elmId), [elmId])
    const handleCSV = useCallback(() => ShadeTool.exportCSV(), [])
    const handleGeoJSON = useCallback(
        () => ShadeTool.exportGeoJSON(elmId),
        [elmId]
    )
    const handleReport = useCallback(
        () => ShadeTool.exportReport(elmId),
        [elmId]
    )

    return (
        <div className="vstExportBar">
            <Button
                variant="ghost"
                size="sm"
                onClick={handlePNG}
                title="Export shade map as PNG"
            >
                <i className="mdi mdi-image mdi-12px" /> PNG
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleCSV}
                title="Export sweep results as CSV"
            >
                <i className="mdi mdi-file-delimited mdi-12px" /> CSV
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleGeoJSON}
                title="Export shade map as GeoJSON"
            >
                <i className="mdi mdi-map mdi-12px" /> GeoJSON
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleReport}
                title="Export report as JSON"
            >
                <i className="mdi mdi-code-json mdi-12px" /> Report
            </Button>
        </div>
    )
}
