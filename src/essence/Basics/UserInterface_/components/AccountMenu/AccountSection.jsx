import React, { useEffect, useState } from 'react'
import ApiTokensRow from '../ApiTokens/ApiTokensRow'
import { avatarColor } from './avatarColor'
import styles from './AccountMenu.module.css'

export default function AccountSection({ onClose }) {
    const [Login, setLogin] = useState(null)
    const [, setUpdate] = useState(0)

    useEffect(() => {
        let active = true
        import('../Login/Login').then((m) => {
            if (active) setLogin(m.default)
        })
        const update = () => setUpdate((n) => n + 1)
        document.addEventListener('mmgis:loginchange', update)
        document.addEventListener('mmgis:accountprovider', update)
        return () => {
            active = false
            document.removeEventListener('mmgis:loginchange', update)
            document.removeEventListener('mmgis:accountprovider', update)
        }
    }, [])

    if (!Login) return null

    const loggedIn = Login.loggedIn === true
    const hasLogin = window.mmgisglobal.SITE_ACCESS !== 'public'
    if (!loggedIn && !hasLogin) return null

    const name = loggedIn ? String(Login.username || '') : ''
    const via = loggedIn ? Login.signedInWith() : null
    const detail = !loggedIn
        ? 'Not signed in to MMGIS'
        : via
          ? `Signed in with ${via.title}`
          : 'Signed in to MMGIS'

    return (
        <div className={`${styles.section} ${styles.mmgis}`}>
            <div className={styles.label}>MMGIS</div>
            <div className={styles.account}>
                <div
                    className={`${styles.avatar} ${loggedIn ? '' : styles.guest}`}
                    style={loggedIn ? { background: avatarColor(name) } : {}}
                >
                    {loggedIn ? (
                        <>
                            {name.charAt(0).toUpperCase()}
                            {via && (
                                <span
                                    className={styles.providerBadge}
                                    aria-hidden="true"
                                >
                                    <i className={`mdi mdi-${via.icon}`} />
                                </span>
                            )}
                        </>
                    ) : (
                        <i className="mdi mdi-account mdi-18px" />
                    )}
                </div>
                <div className={styles.text}>
                    <div className={styles.user}>{loggedIn ? name : 'Guest'}</div>
                    <div className={styles.detail}>{detail}</div>
                </div>
                {loggedIn ? (
                    <button
                        id="accountMenuSignOut"
                        className={styles.action}
                        onClick={() => {
                            onClose()
                            Login.logout()
                        }}
                    >
                        Sign out
                    </button>
                ) : (
                    <button
                        id="accountMenuSignIn"
                        className={`${styles.action} ${styles.primary}`}
                        onClick={() => {
                            onClose()
                            if (!Login.loggedIn) {
                                const button =
                                    document.getElementById('loginoutButton')
                                if (button) button.click()
                            }
                        }}
                    >
                        Sign in
                    </button>
                )}
            </div>
            {loggedIn && <ApiTokensRow onClose={onClose} />}
        </div>
    )
}
