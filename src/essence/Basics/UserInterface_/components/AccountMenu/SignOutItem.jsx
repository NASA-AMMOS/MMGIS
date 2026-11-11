import React from 'react'
import styles from './AccountMenu.module.css'
import useLogin from './useLogin'

export default function SignOutItem({ onClose }) {
    const Login = useLogin()
    if (!Login || Login.loggedIn !== true) return null

    return (
        <div className={styles.group}>
            <button
                type="button"
                id="accountMenuSignOut"
                className={`${styles.item} ${styles.buttonItem} ${styles.signOutItem}`}
                onClick={() => {
                    onClose()
                    Login.logout()
                }}
            >
                <span className={styles.leadingIcon}>
                    <i className="mdi mdi-logout" />
                </span>
                <span className={styles.itemText}>
                    <span className={styles.itemTitle}>Sign out</span>
                </span>
            </button>
        </div>
    )
}
