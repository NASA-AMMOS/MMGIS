import React, { forwardRef } from 'react'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import styles from './Slider.module.css'

const Slider = forwardRef(function Slider(
    { value, onValueChange, min = 0, max = 1, step = 0.01, className, ...props },
    ref
) {
    return (
        <BaseSlider.Root
            ref={ref}
            value={value}
            onValueChange={onValueChange}
            min={min}
            max={max}
            step={step}
            className={`${styles.root} ${className || ''}`}
            {...props}
        >
            <BaseSlider.Control className={styles.control}>
                <BaseSlider.Track className={styles.track}>
                    <BaseSlider.Indicator className={styles.indicator} />
                    <BaseSlider.Thumb className={styles.thumb} />
                </BaseSlider.Track>
            </BaseSlider.Control>
        </BaseSlider.Root>
    )
})

export default Slider
