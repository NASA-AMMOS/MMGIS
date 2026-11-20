import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useUIStore from '../../store/uiStore'
import { toolConfigs } from '../../../../../pre/tools'

import {
    clampPlacement,
    isFloating,
    loadPlacements,
    maxHeightAt,
    normalizePlacement,
    savePlacements,
} from './panelPlacement'

import styles from './SeparatedTools.module.css'

/** Fired on window when a panel has been resized, so its tool can redraw. */
export const PANEL_RESIZED_EVENT = 'mmgis-separated-tool-resized'

// How far the pointer travels before a press on a header becomes a drag.
const DRAG_THRESHOLD = 4

// The area panels float over: what the row of panels is positioned in.
function floatArea() {
    const container = document.getElementById('toolcontroller_sep_content')
    const parent = container?.offsetParent || document.documentElement
    return parent.getBoundingClientRect()
}

function SeparatedTools() {
    const separatedToolsList = useUIStore((s) => s.separatedToolsList)
    const activeSeparatedTools = useUIStore((s) => s.activeSeparatedTools)
    const isMobile = useUIStore((s) => s.isMobile)

    // Where each panel has been dragged or resized to, by tool name. A panel
    // with no x/y is still in the row it starts in.
    const [placements, setPlacements] = useState(() => loadPlacements())
    // Tool names, back to front: a panel pressed last is drawn on top.
    const [order, setOrder] = useState([])
    const panelRefs = useRef({})
    const drag = useRef(null)

    const updatePlacement = useCallback((name, change) => {
        setPlacements((current) => {
            const next = Object.assign({}, current)
            const placement =
                change == null
                    ? null
                    : normalizePlacement(
                          Object.assign({}, current[name], change)
                      )
            if (placement == null) delete next[name]
            else next[name] = placement
            savePlacements(next)
            return next
        })
    }, [])

    const bringToFront = useCallback((name) => {
        setOrder((current) =>
            current[current.length - 1] === name
                ? current
                : current.filter((n) => n !== name).concat(name)
        )
    }, [])

    // A press on the header starts a drag once the pointer has travelled. The
    // header keeps the pointer for the whole drag, so the map under it never
    // sees the movement.
    const onHeaderPointerDown = useCallback((e, name) => {
        if (e.button !== 0 || e.target.closest('[data-no-drag]')) return
        const el = panelRefs.current[name]
        if (el == null) return
        const rect = el.getBoundingClientRect()
        drag.current = {
            name,
            startX: e.clientX,
            startY: e.clientY,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            moved: false,
            at: null,
        }
        e.currentTarget.setPointerCapture?.(e.pointerId)
    }, [])

    const onHeaderPointerMove = useCallback((e) => {
        const d = drag.current
        if (d == null) return
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
        d.moved = true
        const area = floatArea()
        d.at = clampPlacement(
            { x: d.left + dx, y: d.top + dy, w: d.width },
            area
        )
        // Written straight to the element while dragging; the state catches
        // up when the drag ends.
        const el = panelRefs.current[d.name]
        if (el == null) return
        el.style.position = 'fixed'
        el.style.left = `${d.at.x}px`
        el.style.top = `${d.at.y}px`
        el.style.width = `${d.at.w}px`
        el.style.maxHeight = `${maxHeightAt(d.at, area)}px`
    }, [])

    const onHeaderPointerUp = useCallback(
        (e) => {
            const d = drag.current
            drag.current = null
            e.currentTarget.releasePointerCapture?.(e.pointerId)
            if (d == null || !d.moved || d.at == null) return
            updatePlacement(d.name, d.at)
        },
        [updatePlacement]
    )

    // The browser's own resize handle writes the new size onto the element;
    // it is picked up when the pointer is let go.
    const onPanelPointerUp = useCallback(
        (name) => {
            const el = panelRefs.current[name]
            if (el == null || drag.current != null) return
            const w = parseFloat(el.style.width)
            const h = parseFloat(el.style.height)
            const placement = placements[name] || {}
            const rendered = panelRefs.current[`${name}:width`]
            const change = {}
            if (isFinite(w) && Math.round(w) !== (placement.w ?? rendered))
                change.w = w
            if (isFinite(h) && Math.round(h) !== placement.h) change.h = h
            if (Object.keys(change).length === 0) return
            updatePlacement(name, change)
            window.dispatchEvent(
                new CustomEvent(PANEL_RESIZED_EVENT, { detail: { tool: name } })
            )
        },
        [placements, updatePlacement]
    )

    // A smaller window can leave a panel outside it.
    useEffect(() => {
        const onResize = () =>
            setPlacements((current) => {
                const area = floatArea()
                const next = {}
                Object.keys(current).forEach((name) => {
                    next[name] = clampPlacement(
                        current[name],
                        area,
                        panelRefs.current[name]?.getBoundingClientRect().width
                    )
                })
                return next
            })
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    // Sort: Legend first, then the rest in original order
    const sortedTools = useMemo(() => {
        if (!separatedToolsList || separatedToolsList.length === 0) return []
        const legend = separatedToolsList.filter((t) => t.name === 'Legend')
        const rest = separatedToolsList.filter((t) => t.name !== 'Legend')
        return [...legend, ...rest]
    }, [separatedToolsList])

    const handleClose = useCallback((tool) => {
        const ToolController_ =
            require('../../../ToolController_/ToolController_').default
        ToolController_.closeTool(tool.name)
    }, [])

    if (!sortedTools.length) return null

    return (
        <div id="toolcontroller_sep_content" className={styles.container}>
            {sortedTools.map((tool) => {
                // "custom" tools render chrome-less and manage their own DOM.
                const isCustom =
                    toolConfigs[tool.name]?.separatedTool === 'custom'
                const toolModuleName = tool.name + 'Tool'
                const isActive = activeSeparatedTools.includes(toolModuleName)
                const ToolController_ =
                    require('../../../ToolController_/ToolController_').default
                const tM = ToolController_.toolModules[toolModuleName]
                const toolWidth = tM ? tM.width || 200 : 200

                // Dragging and resizing are for a desktop's floating panels;
                // on mobile a tool is a bottom sheet with its own handling.
                const movable = !isCustom && !isMobile
                const placement = movable ? placements[tool.name] : null
                const floating = isFloating(placement)
                panelRefs.current[`${tool.name}:width`] = toolWidth
                const panelStyle = { width: (placement?.w ?? toolWidth) + 'px' }
                if (placement?.h != null) panelStyle.height = placement.h + 'px'
                if (floating) {
                    panelStyle.position = 'fixed'
                    panelStyle.left = placement.x + 'px'
                    panelStyle.top = placement.y + 'px'
                    panelStyle.maxHeight =
                        maxHeightAt(placement, floatArea()) + 'px'
                }
                if (movable)
                    panelStyle.zIndex = order.indexOf(tool.name) + 1

                const panelClasses = [
                    styles.panel,
                    isActive ? styles.panelVisible : styles.panelHidden,
                    isCustom ? styles.panelCustom : '',
                    movable ? styles.panelMovable : '',
                ]
                    .filter(Boolean)
                    .join(' ')

                return (
                    <div
                        key={tool.name}
                        id={`toolPanelSeparated_${tool.name}`}
                        className={panelClasses}
                        ref={(el) => {
                            panelRefs.current[tool.name] = el
                        }}
                        style={isCustom ? undefined : panelStyle}
                        onPointerDown={
                            movable ? () => bringToFront(tool.name) : undefined
                        }
                        onPointerUp={
                            movable
                                ? () => onPanelPointerUp(tool.name)
                                : undefined
                        }
                    >
                        {!isCustom && (
                            <div
                                className={
                                    movable
                                        ? `${styles.header} ${styles.headerMovable}`
                                        : styles.header
                                }
                                title={
                                    movable
                                        ? 'Drag to move. Double-click to put back.'
                                        : undefined
                                }
                                onPointerDown={
                                    movable
                                        ? (e) =>
                                              onHeaderPointerDown(e, tool.name)
                                        : undefined
                                }
                                onPointerMove={
                                    movable ? onHeaderPointerMove : undefined
                                }
                                onPointerUp={
                                    movable ? onHeaderPointerUp : undefined
                                }
                                onPointerCancel={
                                    movable ? onHeaderPointerUp : undefined
                                }
                                onDoubleClick={
                                    movable
                                        ? (e) => {
                                              if (
                                                  e.target.closest(
                                                      '[data-no-drag]'
                                                  )
                                              )
                                                  return
                                              updatePlacement(tool.name, null)
                                              window.dispatchEvent(
                                                  new CustomEvent(
                                                      PANEL_RESIZED_EVENT,
                                                      {
                                                          detail: {
                                                              tool: tool.name,
                                                          },
                                                      }
                                                  )
                                              )
                                          }
                                        : undefined
                                }
                            >
                                <span className={styles.headerTitle}>
                                    {tool.name}
                                </span>
                                <div
                                    className={styles.headerClose}
                                    data-no-drag
                                    title="Close"
                                    onClick={() => handleClose(tool)}
                                >
                                    <i
                                        className="mdi mdi-close"
                                        style={{ fontSize: '14px' }}
                                    />
                                </div>
                            </div>
                        )}
                        <div
                            id={`toolContentSeparated_${tool.name}`}
                            className={styles.content}
                        />
                    </div>
                )
            })}
        </div>
    )
}

export default SeparatedTools
