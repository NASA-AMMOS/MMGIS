import React, { useCallback } from 'react'
import SightlineTool from '../SightlineTool'
import { Button } from '../../../../design-system/components'

export default function ExportMenu({ elmId }) {
    const handlePNG = useCallback(() => SightlineTool.exportPNG(elmId), [elmId])
    const handleCSV = useCallback(() => SightlineTool.exportCSV(elmId), [elmId])
    const handleGeoJSON = useCallback(
        () => SightlineTool.exportGeoJSON(elmId),
        [elmId]
    )
    const handleReport = useCallback(
        () => SightlineTool.exportReport(elmId),
        [elmId]
    )

    return (
        <div className="vstExportMenu">
            <Button
                variant="ghost"
                size="sm"
                onClick={handlePNG}
                title="Export sightline map as PNG"
            >
                <i className="mdi mdi-image mdi-12px" /> PNG
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleCSV}
                title="Export results as CSV"
            >
                <i className="mdi mdi-file-delimited mdi-12px" /> CSV
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleGeoJSON}
                title="Export sightline map as GeoJSON"
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
