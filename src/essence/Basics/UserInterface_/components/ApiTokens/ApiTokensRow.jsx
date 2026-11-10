import React, { useEffect, useState } from 'react'
import ApiTokens, { expiryText, isLive, summary } from './ApiTokens'
import styles from '../AccountMenu/AccountMenu.module.css'

export default function ApiTokensRow({ onClose }) {
    const [tokens, setTokens] = useState(undefined)

    useEffect(() => {
        let active = true
        summary()
            .then((data) => {
                if (active) setTokens(data)
            })
            .catch(() => {
                if (active) setTokens(null)
            })
        return () => {
            active = false
        }
    }, [])

    if (!tokens) return null

    const live = tokens.tokens.filter(isLive)
    let name = 'API token'
    let detail
    let action
    if (tokens.limits.unlimited) {
        name = `API tokens (${live.length})`
        detail = 'For scripts and other tools'
        action = live.length ? 'Manage' : 'Create'
    } else if (live.length) {
        detail = `${live[0].name || live[0].token} · ${expiryText(live[0])}`
        action = 'Manage'
    } else {
        detail = tokens.tokens.length
            ? 'Your token expired'
            : 'For scripts and other tools'
        action = 'Create'
    }

    return (
        <button
            type="button"
            id="accountMenuTokens"
            className={`${styles.item} ${styles.buttonItem}`}
            onClick={() => {
                onClose()
                ApiTokens.open(action === 'Create' ? 'create' : 'manage')
            }}
        >
            <span className={styles.leadingIcon}>
                <i className="mdi mdi-key-variant" />
            </span>
            <span className={styles.itemText}>
                <span className={styles.itemTitle}>{name}</span>
                <span className={styles.itemMeta}>{detail}</span>
            </span>
            <i className={`mdi mdi-chevron-right ${styles.chevron}`} />
        </button>
    )
}
