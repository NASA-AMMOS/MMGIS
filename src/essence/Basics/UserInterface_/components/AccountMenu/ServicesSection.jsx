import React, { useEffect, useState } from 'react'
import Connections_ from '../../../Connections_/Connections_'
import styles from './AccountMenu.module.css'

export default function ServicesSection() {
    const [services, setServices] = useState(Connections_.menuServices())

    useEffect(() => {
        const update = () => setServices(Connections_.menuServices())
        Connections_.on('change', update)
        return () => Connections_.off('change', update)
    }, [])

    if (!services.length) return null

    return (
        <div className={styles.section}>
            <div className={styles.label}>Services</div>
            {services.map((service) => {
                const used = Connections_.toolsUsing(service)
                let detail = ''
                let action = null
                if (!service.configured) detail = 'Not set up on this site'
                else if (service.connected) {
                    detail = service.account
                        ? `Connected as ${service.account}`
                        : 'Connected'
                    if (service.storage === 'session')
                        detail += ' · this browser session'
                    action = (
                        <button
                            className={styles.action}
                            onClick={() => Connections_.disconnect(service.id)}
                        >
                            Disconnect
                        </button>
                    )
                } else if (service.canConnect) {
                    detail = used.length
                        ? `Needed by ${used.join(', ')}`
                        : 'Not connected'
                    action = (
                        <button
                            className={`${styles.action} ${styles.primary}`}
                            onClick={() => Connections_.connect(service.id)}
                        >
                            Connect
                        </button>
                    )
                } else {
                    detail = 'Sign in to MMGIS first'
                }

                return (
                    <div
                        key={service.id}
                        className={`${styles.row} ${service.connected ? styles.connected : ''} ${!service.canConnect && !service.connected ? styles.unavailable : ''}`}
                    >
                        <span className={styles.dot} />
                        <div className={styles.text}>
                            <div className={styles.name}>{service.label}</div>
                            <div className={styles.detail}>{detail}</div>
                        </div>
                        {action}
                    </div>
                )
            })}
        </div>
    )
}
