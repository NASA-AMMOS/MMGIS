import React, { useRef, useState, useEffect, useCallback, forwardRef } from 'react'
import styles from './Tabs.module.css'

const Tabs = forwardRef(function Tabs(
    { value, onValueChange, tabs, size = 'md', className, children, ...props },
    ref
) {
    const containerRef = useRef(null)
    const [indicator, setIndicator] = useState({ left: 0, width: 0 })

    const updateIndicator = useCallback(() => {
        const container = containerRef.current
        if (!container) return
        const active = container.querySelector(`[data-tab-active="true"]`)
        if (active) {
            setIndicator({
                left: active.offsetLeft,
                width: active.offsetWidth,
            })
        }
    }, [])

    useEffect(() => {
        updateIndicator()
    }, [value, updateIndicator])

    useEffect(() => {
        window.addEventListener('resize', updateIndicator)
        return () => window.removeEventListener('resize', updateIndicator)
    }, [updateIndicator])

    const activeIndex = tabs.findIndex((t) => t.value === value)

    return (
        <div
            ref={ref}
            className={`${styles.tabs} ${styles[size] || ''} ${className || ''}`}
            {...props}
        >
            <div className={styles.tabBar} ref={containerRef}>
                {tabs.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={value === tab.value}
                        data-tab-active={value === tab.value ? 'true' : 'false'}
                        className={`${styles.tab} ${value === tab.value ? styles.active : ''}`}
                        onClick={() => onValueChange(tab.value)}
                    >
                        {tab.icon && <i className={`mdi ${tab.icon} mdi-14px`} />}
                        {tab.label}
                    </button>
                ))}
                <div
                    className={styles.indicator}
                    style={{
                        transform: `translateX(${indicator.left}px)`,
                        width: `${indicator.width}px`,
                    }}
                />
            </div>
            <div className={styles.panels}>
                <div
                    className={styles.panelTrack}
                    style={{
                        transform: `translateX(${-activeIndex * 100}%)`,
                    }}
                >
                    {tabs.map((tab, i) => (
                        <div
                            key={tab.value}
                            className={styles.panel}
                            role="tabpanel"
                            aria-hidden={value !== tab.value}
                        >
                            {children?.[i] ?? null}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})

export default Tabs
