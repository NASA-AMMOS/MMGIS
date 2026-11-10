import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import AccountSection from './AccountSection'
import ServicesSection from './ServicesSection'
import styles from './AccountMenu.module.css'

export default function AccountMenu({ anchor, onClose }) {
    const menuRef = useRef(null)
    const [position] = useState(() => {
        const rect = anchor.getBoundingClientRect()
        return {
            top: rect.bottom + 6,
            right: Math.max(8, window.innerWidth - rect.right),
        }
    })

    useEffect(() => {
        const onClick = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return
            if (anchor && anchor.contains(e.target)) return
            onClose()
        }
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('click', onClick, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('click', onClick, true)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [anchor, onClose])

    return ReactDOM.createPortal(
        <div
            id="accountMenu"
            ref={menuRef}
            className={styles.accountMenu}
            style={position}
        >
            {window.mmgisglobal.SITE_ACCESS !== 'public' && (
                <AccountSection onClose={onClose} />
            )}
            <ServicesSection onClose={onClose} />
        </div>,
        document.body
    )
}
