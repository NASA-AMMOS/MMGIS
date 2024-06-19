import { render } from 'react-dom'
import React, { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useResizeDetector } from 'react-resize-detector'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Setting worker path to worker bundle.
pdfjs.GlobalWorkerOptions.workerSrc = '/public/workers/pdf.worker.min.js'

const ReactPDF = (props) => {
    const { pdfPath } = props
    const [numPages, setNumPages] = useState()
    const [pageNumber, setPageNumber] = useState(1)
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5]
    const [zoom, setZoom] = useState(3)

    const { width, height, ref } = useResizeDetector({
        handleHeight: false,
        refreshMode: 'debounce',
        refreshRate: 1000,
    })

    useEffect(() => {
        setZoom(3)
    }, [pdfPath])

    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages)
    }
    const bcr = document
        .getElementById('pdfViewerWrapper')
        .getBoundingClientRect()
    const pageWidth = bcr ? bcr.width - 40 : null
    return (
        <div ref={ref}>
            <Document file={pdfPath} onLoadSuccess={onDocumentLoadSuccess}>
                <Page
                    pageNumber={pageNumber}
                    scale={zoomLevels[zoom]}
                    width={pageWidth}
                    onRenderSuccess={() => {
                        const container =
                            document.getElementById('pdfViewerWrapper')
                        const isOverflowing =
                            container.scrollWidth > container.clientWidth
                        const doc = document.getElementsByClassName(
                            'react-pdf__Document'
                        )[0]
                        if (doc)
                            doc.style.justifyContent = isOverflowing
                                ? 'start'
                                : 'center'
                    }}
                />
            </Document>
            <div
                style={{
                    position: 'fixed',
                    top: '40px',
                    left: bcr ? `${bcr.left + 6}px` : '46px',
                    display: 'flex',
                    height: '30px',
                    justifyContent: 'center',
                    zIndex: 999999,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                    }}
                >
                    <div
                        className='pdfViewer-toolbarButton pdfViewer-pageUp'
                        title='Previous Page'
                        id='pdfViewer-previous'
                        onClick={() => {
                            setPageNumber(Math.max(1, pageNumber - 1))
                        }}
                        style={{
                            width: '30px',
                            height: '30px',
                            background: 'var(--color-a)',
                            marginRight: '5px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            userSelect: 'none',
                            lineHeight: '30px',
                            fontSize: '22px',
                        }}
                    >
                        <span className='mdi mdi-arrow-left'></span>
                    </div>
                    <div
                        style={{
                            height: '30px',
                            background: 'var(--color-a)',
                            display: 'flex',
                            marginRight: '5px',
                            borderRadius: '3px',
                        }}
                    >
                        <input
                            type='number'
                            id='pdfViewer-pageNumber'
                            className='pdfViewer-toolbarField pdfViewer-pageNumber'
                            value={pageNumber}
                            onChange={(e) => {
                                setPageNumber(
                                    Math.max(
                                        1,
                                        Math.min(numPages, e.target.val())
                                    )
                                )
                            }}
                            step={1}
                            min={1}
                            style={{
                                width: '38px',
                                height: '30px',
                                borderRadius: '3px',
                                padding: '0px 4px',
                                lineHeight: '30px',
                                color: 'var(--color-a7)',
                                background: 'var(--color-a1)',
                                textAlign: 'right',
                                outline: 'none',
                                border: 'none',
                                fontSize: '16px',
                                userSelect: 'none',
                            }}
                        />
                        <div
                            style={{
                                height: '30px',
                                lineHeight: '30px',
                                color: 'var(--color-a7)',
                                fontSize: '16px',
                                padding: '0px 6px 0px 4px',
                                userSelect: 'none',
                            }}
                        >{`/ ${numPages || '--'}`}</div>
                    </div>
                    <div
                        className='pdfViewer-toolbarButton pdfViewer-pageDown'
                        title='Next Page'
                        id='pdfViewer-next'
                        onClick={() => {
                            setPageNumber(Math.min(numPages, pageNumber + 1))
                        }}
                        style={{
                            width: '30px',
                            height: '30px',
                            background: 'var(--color-a)',
                            marginRight: '5px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            userSelect: 'none',
                            lineHeight: '30px',
                            fontSize: '22px',
                        }}
                    >
                        <span className='mdi mdi-arrow-right'></span>
                    </div>
                    <div
                        className='pdfViewer-toolbarButton pdfViewer-zoomOut'
                        title='Zoom Out'
                        id='pdfViewer-zoomOut'
                        onClick={() => {
                            setZoom(Math.max(0, zoom - 1))
                        }}
                        style={{
                            width: '30px',
                            height: '30px',
                            background: 'var(--color-a)',
                            marginRight: '5px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            userSelect: 'none',
                            lineHeight: '30px',
                            fontSize: '22px',
                        }}
                    >
                        <span className='mdi mdi-magnify-minus-outline'></span>
                    </div>
                    <div
                        className='pdfViewer-toolbarButton pdfViewer-zoomIn'
                        title='Zoom In'
                        id='pdfViewer-zoomIn'
                        onClick={() => {
                            setZoom(Math.min(zoomLevels.length - 1, zoom + 1))
                        }}
                        style={{
                            width: '30px',
                            height: '30px',
                            background: 'var(--color-a)',
                            marginRight: '5px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            textAlign: 'center',
                            userSelect: 'none',
                            lineHeight: '30px',
                            fontSize: '22px',
                        }}
                    >
                        <span className='mdi mdi-magnify-plus-outline'></span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function (options) {
    options = options || {}

    async function changePDF(pdfPath, canvasId) {
        render(
            <ReactPDF pdfPath={pdfPath} />,
            document.getElementById('pdfViewerWrapper')
        )
    }

    return {
        changePDF: changePDF,
    }
}
