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
        <div className={`${styles.row} ${styles.tokens}`}>
            <i className={`mdi mdi-key-variant ${styles.tokenIcon}`} />
            <div className={styles.text}>
                <div className={styles.name}>{name}</div>
                <div className={styles.detail}>{detail}</div>
            </div>
            <button
                id="accountMenuTokens"
                className={`${styles.action} ${action === 'Create' ? styles.primary : ''}`}
                onClick={() => {
                    onClose()
                    ApiTokens.open(action === 'Create' ? 'create' : 'manage')
                }}
            >
                {action}
            </button>
        </div>
    )
}
