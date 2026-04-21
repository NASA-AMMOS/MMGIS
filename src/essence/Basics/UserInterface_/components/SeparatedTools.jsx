import React, { useCallback, useState } from 'react'
import useUIStore from '../store/uiStore'

/**
 * SeparatedTools renders floating tool buttons over the map area.
 * These are tools with `separatedTool: true` in their config (e.g. Legend).
 * They appear in three containers (left, center, right) based on
 * the tool's `variables.justification` setting.
 *
 * Replaces the jQuery DOM construction in ToolController_.init() lines 47-194.
 */

function SeparatedToolButton({ tool, index, onToggle, isActive }) {
    const defaultColor = 'var(--color-f)'

    return (
        <div
            id={'toolSeparated_' + tool.name}
            style={{
                position: 'relative',
                borderRadius: '3px',
                background: 'var(--color-a)',
                marginBottom: '5px',
            }}
        >
            <div
                id={'toolContentSeparated_' + tool.name}
                style={{
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    borderRadius: '3px',
                    background: 'var(--color-a)',
                    transform:
                        tool.variables?.justification === 'right'
                            ? 'translateX(calc(-100% + 30px))'
                            : 'unset',
                }}
            ></div>
            <div
                id={'toolButtonSeparated_' + tool.name}
                className={'toolButtonSep' + (isActive ? ' active' : '')}
                tabIndex={index + 1}
                style={{
                    position: 'relative',
                    width: '30px',
                    height: '30px',
                    display: 'inline-block',
                    textAlign: 'center',
                    lineHeight: '30px',
                    verticalAlign: 'middle',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in',
                    color: defaultColor,
                }}
                onClick={() => onToggle(tool, index)}
            >
                <i
                    id={tool.name + 'Tool'}
                    className={'mdi mdi-' + tool.icon + ' mdi-18px'}
                    style={{ cursor: 'pointer' }}
                />
            </div>
        </div>
    )
}

function SeparatedTools() {
    const toolsList = useUIStore((s) => s.toolsList)
    const toolsLoaded = useUIStore((s) => s.toolsLoaded)
    const [activeSepTools, setActiveSepTools] = useState({})

    const handleToggle = useCallback((tool, index) => {
        const ToolController_ =
            require('../../ToolController_/ToolController_').default
        const toolModuleName = tool.name + 'Tool'
        const tM = ToolController_.toolModules[toolModuleName]

        if (!tM) return

        if (tM.made === false) {
            tM.make('toolContentSeparated_' + tool.name)
            ToolController_.activeSeparatedTools.push(toolModuleName)
            setActiveSepTools((prev) => ({ ...prev, [tool.name]: true }))
            // jQuery compat: add active class
            const btn = document.getElementById(
                'toolButtonSeparated_' + tool.name
            )
            if (btn) btn.classList.add('active')
        } else {
            tM.destroy()
            ToolController_.activeSeparatedTools =
                ToolController_.activeSeparatedTools.filter(
                    (a) => a !== toolModuleName
                )
            setActiveSepTools((prev) => ({ ...prev, [tool.name]: false }))
            // jQuery compat: remove active class
            const btn = document.getElementById(
                'toolButtonSeparated_' + tool.name
            )
            if (btn) btn.classList.remove('active')
        }

        // Dispatch toggleSeparatedTool event (matches jQuery behavior)
        document.dispatchEvent(
            new CustomEvent('toggleSeparatedTool', {
                detail: {
                    toggledToolName: tool.js,
                    visible: tM.made,
                },
            })
        )
    }, [])

    if (!toolsLoaded) return null

    // Separate tools into left, center (default), and right groups
    const separatedTools = toolsList.filter((t) => t.separatedTool)

    // Legend should always be last
    const nonLegend = separatedTools.filter((t) => t.name !== 'Legend')
    const legend = separatedTools.filter((t) => t.name === 'Legend')
    const orderedTools = [...nonLegend, ...legend]

    const leftTools = orderedTools.filter(
        (t) => t.variables?.justification === 'left'
    )
    const rightTools = orderedTools.filter(
        (t) => t.variables?.justification === 'right'
    )
    const centerTools = orderedTools.filter(
        (t) =>
            t.variables?.justification !== 'left' &&
            t.variables?.justification !== 'right'
    )

    // Determine right position based on zoom control config
    // (matches jQuery: L_.configData.look.zoomcontrol ? '40px' : '5px')
    let rightPosition = '5px'
    try {
        const L_ = require('../../Layers_/Layers_').default
        if (L_.configData.look && L_.configData.look.zoomcontrol) {
            rightPosition = '40px'
        }
    } catch (e) {
        // L_ not available yet
    }

    const containerBase = {
        position: 'absolute',
        top: '40px',
        zIndex: 1004,
    }

    // Set viewerToolBar padding if any separated tools exist
    if (orderedTools.length > 0) {
        const vtb = document.getElementById('viewerToolBar')
        if (vtb) vtb.style.paddingLeft = '36px'
    }

    return (
        <>
            {leftTools.length > 0 && (
                <div
                    id="toolcontroller_sepdiv_left"
                    style={{ ...containerBase, left: '5px' }}
                >
                    {leftTools.map((tool) => {
                        const realIndex = toolsList.indexOf(tool)
                        return (
                            <SeparatedToolButton
                                key={tool.name}
                                tool={tool}
                                index={realIndex}
                                isActive={!!activeSepTools[tool.name]}
                                onToggle={handleToggle}
                            />
                        )
                    })}
                </div>
            )}
            {centerTools.length > 0 && (
                <div
                    id="toolcontroller_sepdiv"
                    style={{ ...containerBase, left: '5px' }}
                >
                    {centerTools.map((tool) => {
                        const realIndex = toolsList.indexOf(tool)
                        return (
                            <SeparatedToolButton
                                key={tool.name}
                                tool={tool}
                                index={realIndex}
                                isActive={!!activeSepTools[tool.name]}
                                onToggle={handleToggle}
                            />
                        )
                    })}
                </div>
            )}
            {rightTools.length > 0 && (
                <div
                    id="toolcontroller_sepdiv_right"
                    style={{ ...containerBase, right: rightPosition }}
                >
                    {rightTools.map((tool) => {
                        const realIndex = toolsList.indexOf(tool)
                        return (
                            <SeparatedToolButton
                                key={tool.name}
                                tool={tool}
                                index={realIndex}
                                isActive={!!activeSepTools[tool.name]}
                                onToggle={handleToggle}
                            />
                        )
                    })}
                </div>
            )}
        </>
    )
}

export default SeparatedTools
