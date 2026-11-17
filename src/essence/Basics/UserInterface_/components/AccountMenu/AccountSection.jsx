import React from 'react'
import ApiTokensRow from '../ApiTokens/ApiTokensRow'
import { avatarColor } from './avatarColor'
import styles from './AccountMenu.module.css'
import useLogin from './useLogin'

export default function AccountSection({ onClose }) {
    const Login = useLogin()

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
    const accent = loggedIn ? avatarColor(name) : 'var(--color-a1-5)'
    const headerBackground = loggedIn
        ? `linear-gradient(180deg, color-mix(in srgb, ${accent} 22%, var(--color-a)), var(--color-a))`
        : 'linear-gradient(180deg, var(--color-a1-5), var(--color-a))'

    return (
        <div className={styles.group}>
            <div
                className={styles.profileHeader}
                style={{ background: headerBackground }}
            >
                <div
                    className={`${styles.avatar} ${loggedIn ? '' : styles.guest}`}
                    style={{
                        background: accent,
                        boxShadow: `0 0 0 1px ${accent}`,
                    }}
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
                <div className={styles.username}>
                    {loggedIn ? name : 'Guest'}
                </div>
                <div className={styles.profileDetail}>{detail}</div>
            </div>
            {loggedIn ? (
                <ApiTokensRow onClose={onClose} />
            ) : (
                <button
                    type="button"
                    id="accountMenuSignIn"
                    className={`${styles.item} ${styles.buttonItem}`}
                    onClick={() => {
                        onClose()
                        if (!Login.loggedIn) {
                            const button =
                                document.getElementById('loginoutButton')
                            if (button) button.click()
                        }
                    }}
                >
                    <span className={styles.leadingIcon}>
                        <i className="mdi mdi-login" />
                    </span>
                    <span className={styles.itemText}>
                        <span className={styles.itemTitle}>Sign in</span>
                    </span>
                </button>
            )}
        </div>
    )
}
