import React, { useCallback, useMemo } from 'react'
import useUIStore from '../../store/uiStore'
import { toolConfigs } from '../../../../../pre/tools'

import styles from './SeparatedTools.module.css'

function SeparatedTools() {
    const separatedToolsList = useUIStore((s) => s.separatedToolsList)
    const activeSeparatedTools = useUIStore((s) => s.activeSeparatedTools)

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
        const toolModuleName = tool.name + 'Tool'
        const tM = ToolController_.toolModules[toolModuleName]
        if (tM && tM.made) {
            tM.destroy()
            ToolController_.activeSeparatedTools =
                ToolController_.activeSeparatedTools.filter(
                    (a) => a !== toolModuleName
                )
            useUIStore.getState().removeActiveSeparatedTool(toolModuleName)
            document.dispatchEvent(
                new CustomEvent('toggleSeparatedTool', {
                    detail: { toggledToolName: tool.js, visible: false },
                })
            )
        }
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

                const panelClasses = [
                    styles.panel,
                    isActive ? styles.panelVisible : styles.panelHidden,
                    isCustom ? styles.panelCustom : '',
                ]
                    .filter(Boolean)
                    .join(' ')

                return (
                    <div
                        key={tool.name}
                        id={`toolPanelSeparated_${tool.name}`}
                        className={panelClasses}
                        style={
                            isCustom
                                ? undefined
                                : {
                                      width: toolWidth + 'px',
                                  }
                        }
                    >
                        {!isCustom && (
                            <div className={styles.header}>
                                <span className={styles.headerTitle}>
                                    {tool.name}
                                </span>
                                <div
                                    className={styles.headerClose}
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
