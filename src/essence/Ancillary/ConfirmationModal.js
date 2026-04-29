/**
 * ConfirmationModal — "Are you sure?" confirmation dialog.
 *
 * Renders a React element through the Modal service using design-system
 * Button components. Keeps the same imperative API:
 *   ConfirmationModal.prompt(message, cb)
 */
import React from 'react'
import Modal from './Modal'
import { Button } from '../../design-system/components'

import styles from './ConfirmationModal.module.css'

function ConfirmationContent({ message, onResult }) {
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
            }
        )
    },
}

export default ConfirmationModal
