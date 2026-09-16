/**
 * Help — renders a help button that opens a markdown help modal.
 *
 * Renders a React element through the Modal service using design-system components.
 * Same imperative API:
 *   Help.getComponent(helpKey) → HTML string for the button
 *   Help.finalize(helpKey)     → binds the click handler
 */
import React, { useState, useEffect } from 'react'
import marked from '@essence/services/Markdown'
import { safeHTML } from '@essence/services/Sanitize'
import Modal from '../Modal/Modal'

import styles from './Help.module.css'

function HelpContent({ helpKey }) {
    const [html, setHtml] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const baseUrl = `${window.location.origin}${(
            window.location.pathname || ''
        ).replace(/\/$/g, '')}/public/helps/${helpKey}.md`

        fetch(baseUrl)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res.text()
            })
            .then((doc) => {
                setHtml(safeHTML(marked.parse(doc)))
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [helpKey])

    return (
        <div className={styles.root}>
            <div className={styles.title}>
                <div className={styles.titleLeft}>
                    <i className="mdi mdi-help-rhombus-outline mdi-18px" />
                    <div>Help</div>
                </div>
                <div
                    className={styles.closeBtn}
                    onClick={() => Modal.remove()}
                >
                    <i className="mdi mdi-close mdi-18px" />
                </div>
            </div>
            <div className={styles.content}>
                {loading ? (
                    <div>Loading...</div>
                ) : html ? (
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                    <div>No help content available.</div>
                )}
            </div>
        </div>
    )
}

const Help = {
    getComponent: function (helpKey) {
        return `<div id='helpModal_${helpKey}' class='mmgisButton5 mmgisHelpButton' title='Help'><i class='mdi mdi-help-rhombus-outline mdi-18px'></i></div>`
    },
    finalize: function (helpKey) {
        const btn = document.getElementById(`helpModal_${helpKey}`)
        if (!btn) return

        btn.addEventListener('click', function () {
            Modal.set(<HelpContent helpKey={helpKey} />)
        })
    },
}

export default Help
