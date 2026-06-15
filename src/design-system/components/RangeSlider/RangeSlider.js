import './RangeSlider.css'

/**
 * A dual-handle range slider with optional logarithmic scale.
 *
 * Usage:
 *   const slider = new RangeSlider({
 *       container: document.getElementById('myContainer'),
 *       min: 1,
 *       max: 250000,
 *       defaultMin: 1,
 *       defaultMax: 250000,
 *       scale: 'log',                 // 'linear' | 'log'
 *       label: 'Distance:',
 *       formatValue: (m) => m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(0)}km`,
 *       minGapFactor: 2,              // min handle stays < max / factor
 *       onChange: ({ min, max }) => {},
 *   })
 *
 *   slider.getValues()  // { min, max }
 *   slider.setValues(min, max)
 *   slider.destroy()
 */
class RangeSlider {
    constructor(options) {
        this._opts = Object.assign(
            {
                min: 0,
                max: 100,
                defaultMin: 0,
                defaultMax: 100,
                scale: 'linear',
                label: null,
                formatValue: (v) => String(v),
                minGapFactor: 2,
                onChange: null,
            },
            options
        )

        this._valueMin = this._opts.defaultMin
        this._valueMax = this._opts.defaultMax
        this._dragging = null

        this._onMove = this._onMove.bind(this)
        this._onUp = this._onUp.bind(this)

        this._build()
        this._updatePositions()
    }

    _build() {
        const o = this._opts
        const wrap = document.createElement('div')
        wrap.className = 'ds-range-slider-wrap'

        if (o.label) {
            const lbl = document.createElement('span')
            lbl.className = 'ds-range-slider-label'
            lbl.textContent = o.label
            this._labelEl = lbl
            wrap.appendChild(lbl)
        }

        const minLbl = document.createElement('span')
        minLbl.className = 'ds-range-slider-value'
        wrap.appendChild(minLbl)
        this._minLabelEl = minLbl

        const track = document.createElement('div')
        track.className = 'ds-range-slider-track'

        const fill = document.createElement('div')
        fill.className = 'ds-range-slider-fill'
        track.appendChild(fill)
        this._fillEl = fill

        const minH = document.createElement('div')
        minH.className = 'ds-range-slider-handle'
        minH.dataset.handle = 'min'
        track.appendChild(minH)
        this._minHandleEl = minH

        const maxH = document.createElement('div')
        maxH.className = 'ds-range-slider-handle'
        maxH.dataset.handle = 'max'
        track.appendChild(maxH)
        this._maxHandleEl = maxH

        wrap.appendChild(track)
        this._trackEl = track

        const maxLbl = document.createElement('span')
        maxLbl.className = 'ds-range-slider-value'
        wrap.appendChild(maxLbl)
        this._maxLabelEl = maxLbl

        this._wrapEl = wrap

        minH.addEventListener('mousedown', (e) => this._onDown(e))
        maxH.addEventListener('mousedown', (e) => this._onDown(e))

        if (o.container) {
            o.container.appendChild(wrap)
        }
    }

    // --- Scale conversion ---
    _valueToFrac(val) {
        if (this._opts.scale === 'log') {
            const logMin = Math.log(Math.max(this._opts.min, 1e-10))
            const logMax = Math.log(Math.max(this._opts.max, 1e-10))
            return (Math.log(Math.max(val, 1e-10)) - logMin) / (logMax - logMin)
        }
        return (val - this._opts.min) / (this._opts.max - this._opts.min)
    }

    _fracToValue(frac) {
        if (this._opts.scale === 'log') {
            const logMin = Math.log(Math.max(this._opts.min, 1e-10))
            const logMax = Math.log(Math.max(this._opts.max, 1e-10))
            return Math.exp(logMin + frac * (logMax - logMin))
        }
        return this._opts.min + frac * (this._opts.max - this._opts.min)
    }

    _updatePositions() {
        const minFrac = this._valueToFrac(this._valueMin)
        const maxFrac = this._valueToFrac(this._valueMax)
        this._minHandleEl.style.left = minFrac * 100 + '%'
        this._maxHandleEl.style.left = maxFrac * 100 + '%'
        this._fillEl.style.left = minFrac * 100 + '%'
        this._fillEl.style.width = (maxFrac - minFrac) * 100 + '%'
        this._minLabelEl.textContent = this._opts.formatValue(this._valueMin)
        this._maxLabelEl.textContent = this._opts.formatValue(this._valueMax)
    }

    // --- Drag events ---
    _onDown(e) {
        this._dragging = e.target.dataset.handle
        document.addEventListener('mousemove', this._onMove)
        document.addEventListener('mouseup', this._onUp)
        e.preventDefault()
    }

    _onMove(e) {
        if (!this._dragging) return
        const rect = this._trackEl.getBoundingClientRect()
        let frac = (e.clientX - rect.left) / rect.width
        frac = Math.max(0, Math.min(1, frac))
        const val = this._fracToValue(frac)

        if (this._dragging === 'min') {
            this._valueMin = Math.min(val, this._valueMax / this._opts.minGapFactor)
        } else {
            this._valueMax = Math.max(val, this._valueMin * this._opts.minGapFactor)
        }
        this._updatePositions()
    }

    _onUp() {
        if (!this._dragging) return
        this._dragging = null
        document.removeEventListener('mousemove', this._onMove)
        document.removeEventListener('mouseup', this._onUp)
        if (this._opts.onChange) {
            this._opts.onChange({ min: this._valueMin, max: this._valueMax })
        }
    }

    // --- Public API ---
    getValues() {
        return { min: this._valueMin, max: this._valueMax }
    }

    setValues(min, max) {
        this._valueMin = min
        this._valueMax = max
        this._updatePositions()
    }

    getElement() {
        return this._wrapEl
    }

    getLabelElement() {
        return this._labelEl || null
    }

    destroy() {
        document.removeEventListener('mousemove', this._onMove)
        document.removeEventListener('mouseup', this._onUp)
        if (this._wrapEl && this._wrapEl.parentNode) {
            this._wrapEl.parentNode.removeChild(this._wrapEl)
        }
    }
}

export default RangeSlider
