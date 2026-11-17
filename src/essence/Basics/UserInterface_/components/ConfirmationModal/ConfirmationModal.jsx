/**
 * ConfirmationModal — "Are you sure?" confirmation dialog.
 *
 * Renders a React element through the Modal service using design-system
 * Button components. Keeps the same imperative API:
 *   ConfirmationModal.prompt(message, cb)
 */
import React, { useEffect } from 'react'
import Modal from '../Modal/Modal'
import { Button } from '../../../../../design-system/components'

import styles from './ConfirmationModal.module.css'

const MODAL_ID = 0

function ConfirmationContent({ message, onResult }) {
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && Modal.top() === String(MODAL_ID))
                onResult(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onResult])

    return (
        <div className={styles.root}>
            <div className={styles.title}>
                <div className={styles.titleLeft}>
                    <i className="mdi mdi-help mdi-18px" />
                    <div>Are You Sure</div>
                </div>
            </div>
            <div className={styles.content}>
                <div>{message}</div>
            </div>
            <div className={styles.footer}>
                <Button
                    variant="secondary"
                    className={styles.noBtn}
                    onClick={() => onResult(false)}
                >
                    NO
                </Button>
                <Button
                    variant="primary"
                    className={styles.yesBtn}
                    onClick={() => onResult(true)}
                >
                    YES
                </Button>
            </div>
        </div>
    )
}

const ConfirmationModal = {
    finished: false,
    prompt: function (message, cb) {
        ConfirmationModal.finished = false

        const handleResult = (result) => {
            if (ConfirmationModal.finished) return
            ConfirmationModal.finished = true
            cb(result)
            Modal.remove()
        }

        Modal.set(
            <ConfirmationContent message={message} onResult={handleResult} />,
            null,
            () => {
                if (!ConfirmationModal.finished) {
                    ConfirmationModal.finished = true
                    cb(false)
                }
            },
            MODAL_ID
        )
    },
}

export default ConfirmationModal
