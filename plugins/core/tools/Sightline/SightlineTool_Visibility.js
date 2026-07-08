import useSightlineStore from './store'

let _isDragging = false

const SightlineTool_Visibility = {
    onMouseDown(e, opts) {
        _isDragging = true
        SightlineTool_Visibility._scrubFromX(e, opts)
    },

    onMouseMove(e, opts) {
        if (_isDragging) {
            SightlineTool_Visibility._scrubFromX(e, opts)
        }
    },

    onMouseUp() {
        _isDragging = false
    },

    onMouseLeave() {
        _isDragging = false
    },

    _scrubFromX(e, opts) {
        const wrap = document.getElementById('sightlineVisibilityWrap')
        if (!wrap) return
        const store = useSightlineStore.getState()
        const { included: elms } = _getFilteredVisibilityElms(store, opts.activeElmId)
        if (elms.length === 0) return
        const frameCount = elms[0].ed.results.length
        if (frameCount === 0) return

        const rect = wrap.getBoundingClientRect()
        const firstBar = wrap.querySelector('.sightlineVisBar')
        if (!firstBar) return
        const barLeft = firstBar.getBoundingClientRect().left - rect.left
        const barAreaW = firstBar.getBoundingClientRect().width
        const mouseX = e.clientX - rect.left - barLeft
        if (barAreaW <= 0) return

        const frac = mouseX / barAreaW
        if (frac < 0 || frac > 1) return
        const frameIndex = Math.round(frac * (frameCount - 1))
        if (opts.onScrub) opts.onScrub(Math.max(0, Math.min(frameIndex, frameCount - 1)))
    },

    draw(elmId) {
        const wrap = document.getElementById('sightlineVisibilityWrap')
        if (!wrap) return

        const store = useSightlineStore.getState()
        const { included: elms, excludedCount } = _getFilteredVisibilityElms(store, elmId)
        if (elms.length === 0) return

        const playIndex = store.sweepPlayIndex
        const samplingRate = store.sweepVisSamplingRate || 1

        SightlineTool_Visibility._updateExcludedInfo(excludedCount)

        wrap.innerHTML = ''

        const refResults = elms[0].ed.results
        // Coarse sweep frame count drives the playback slider position.
        const coarseCount = refResults.length
        // Fine (dedicated-ray) series drives the bars and time labels.
        const refSeries = _getVisSeries(elms[0].ed, samplingRate)
        const frameCount = refSeries.length
        if (frameCount === 0 || coarseCount === 0) return

        elms.forEach(({ id, el, ed }) => {
            const sources = store.getSelectedSources(id)
            const srcName = sources?.[0]?.name || el.name || 'Source'
            const rawColor = el.color
            const brightness = rawColor.r + rawColor.g + rawColor.b
            const color = brightness < 100
                ? { r: Math.min(rawColor.r + 120, 255), g: Math.min(rawColor.g + 120, 255), b: Math.min(rawColor.b + 120, 255) }
                : rawColor
            const colorStr = `rgb(${color.r},${color.g},${color.b})`
            const visibleColor = `rgba(${Math.min(color.r + 40, 255)},${Math.min(color.g + 40, 255)},${Math.min(color.b + 40, 255)},0.85)`
            const visBg = getComputedStyle(document.documentElement).getPropertyValue('--color-a').trim() || '#1d1f20'
            const visIsLight = (() => {
                const c = visBg.replace('#', '')
                if (c.length === 6) {
                    const r = parseInt(c.substring(0, 2), 16)
                    const g = parseInt(c.substring(2, 4), 16)
                    const b = parseInt(c.substring(4, 6), 16)
                    return (r + g + b) / 3 > 128
                }
                return false
            })()
            const occludedColor = visIsLight ? 'rgba(240,240,240,0.7)' : 'rgba(60,60,60,0.5)'

            const series = _getVisSeries(ed, samplingRate)
            const segments = []
            for (let i = 0; i < series.length; i++) {
                segments.push(!!series[i].visible)
            }

            const row = document.createElement('div')
            row.className = 'sightlineVisRow'

            const label = document.createElement('div')
            label.className = 'sightlineVisLabel'
            label.style.color = colorStr
            label.innerHTML = `${srcName} <span class="sightlineVisLabelSuffix">Visibility</span>`
            label.title = srcName + ' Visibility'
            row.appendChild(label)

            const bar = document.createElement('div')
            bar.className = 'sightlineVisBar'

            const runs = []
            let runStart = 0
            for (let i = 1; i <= segments.length; i++) {
                if (i < segments.length && segments[i] === segments[runStart]) continue
                runs.push({ start: runStart, end: i, visible: segments[runStart] })
                runStart = i
            }

            for (let ri = 0; ri < runs.length; ri++) {
                const run = runs[ri]
                const span = document.createElement('div')
                span.className = 'sightlineVisSegment'
                const pctStart = (run.start / segments.length) * 100
                const pctWidth = ((run.end - run.start) / segments.length) * 100
                span.style.left = pctStart + '%'
                span.style.width = pctWidth + '%'

                const thisColor = run.visible ? visibleColor : occludedColor
                span.style.background = thisColor
                bar.appendChild(span)
            }

            row.appendChild(bar)
            wrap.appendChild(row)
        })

        // Red time slider — position by the coarse playback frame index
        if (playIndex >= 0 && playIndex < coarseCount) {
            let slider = document.getElementById('sightlineVisSlider')
            if (!slider) {
                slider = document.createElement('div')
                slider.id = 'sightlineVisSlider'
                slider.className = 'sightlineVisSlider'
            }
            const firstBar = wrap.querySelector('.sightlineVisBar')
            if (firstBar) {
                const wrapRect = wrap.getBoundingClientRect()
                const barRect = firstBar.getBoundingClientRect()
                const barLeft = barRect.left - wrapRect.left
                const barWidth = barRect.width
                const frac = coarseCount > 1 ? playIndex / (coarseCount - 1) : 0.5
                const px = barLeft + frac * barWidth
                slider.style.left = px + 'px'
            }
            wrap.appendChild(slider)
        }

        // Time labels
        const timeContainer = document.getElementById('sightlineVisTimeLabels')
        const firstBarEl = wrap.querySelector('.sightlineVisBar')
        if (timeContainer && firstBarEl) {
            const wrapRect = wrap.getBoundingClientRect()
            const barLeftOffset = firstBarEl.getBoundingClientRect().left - wrapRect.left
            timeContainer.style.marginLeft = barLeftOffset + 'px'
        }
        SightlineTool_Visibility._drawTimeLabels(refSeries)
    },

    _drawTimeLabels(results) {
        const container = document.getElementById('sightlineVisTimeLabels')
        if (!container || !results || results.length === 0) return
        container.innerHTML = ''

        const years = new Set()
        for (const r of results) {
            if (r.time) {
                try { years.add(new Date(r.time).getUTCFullYear()) } catch {}
            }
        }
        const omitYear = years.size <= 1

        const rect = container.getBoundingClientRect()
        const labelW = 90
        const numTicks = Math.min(Math.max(2, Math.floor(rect.width / labelW)), results.length)
        const last = results.length - 1

        for (let t = 0; t < numTicks; t++) {
            const frameIdx = numTicks > 1 ? Math.round((t / (numTicks - 1)) * last) : 0
            const pct = last > 0 ? (frameIdx / last) * 100 : 0
            const time = results[frameIdx]?.time
            if (!time) continue
            const tick = document.createElement('div')
            tick.className = 'sightlineVisTimeTick'
            tick.style.left = pct + '%'
            tick.innerHTML = `<div class="sightlineVisTimeTickLine"></div><div class="sightlineVisTimeTickText">${_formatSmartTimeLabel(time, omitYear)}</div>`
            container.appendChild(tick)
        }
    },

    _updateExcludedInfo(excludedCount) {
        const el = document.getElementById('sightlineGraphExcludedInfo')
        if (!el) return
        if (excludedCount > 0) {
            el.innerHTML = `<i class="mdi mdi-information-outline"></i> ${excludedCount} sightline map${excludedCount > 1 ? 's' : ''} excluded (different center or time range)`
            el.style.display = ''
        } else {
            el.style.display = 'none'
        }
    },
}

function _formatSmartTimeLabel(timeStr, omitYear) {
    if (!timeStr) return ''
    try {
        const d = new Date(timeStr)
        if (isNaN(d.getTime())) return timeStr
        const mon = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
        const day = d.getUTCDate()
        const hr = String(d.getUTCHours()).padStart(2, '0')
        const min = String(d.getUTCMinutes()).padStart(2, '0')
        if (omitYear) {
            return `${mon} ${day} ${hr}:${min}`
        }
        return `${mon} ${day}, ${d.getUTCFullYear()} ${hr}:${min}`
    } catch {
        return timeStr
    }
}

// Return the visibility series ({time, visible}[]) to plot for an element.
// Prefers the dedicated native-resolution ray series (ed.visResults) at the
// current sampling rate; falls back to the coarse grid-derived centerVisible
// when the dedicated series isn't available yet.
function _getVisSeries(ed, samplingRate) {
    const results = ed?.results || []
    const vr = ed?.visResults
    if (vr && vr.samples && vr.samples.length > 0 &&
        vr.samplingRate === (samplingRate || 1) &&
        vr.baseStart === results[0]?.time &&
        vr.baseCount === results.length) {
        return vr.samples
    }
    return results.map((r) => ({ time: r.time, visible: !!r.centerVisible }))
}

function _getFilteredVisibilityElms(store, primaryElmId) {
    const primaryEd = store.sweepElData[primaryElmId]
    const primaryEl = store.elements[primaryElmId]
    const included = []
    let excludedCount = 0

    if (!primaryEd?.results || primaryEd.results.length === 0 || !primaryEl) {
        return { included, excludedCount }
    }

    const primaryCenter = primaryEd.sweepCenter
    const primaryStart = primaryEd.results[0]?.time
    const primaryStep = primaryEd.results.length > 1 ? primaryEd.results[1]?.time : null
    const primaryLen = primaryEd.results.length

    const allIds = store.elementOrder?.length > 0
        ? store.elementOrder
        : Object.keys(store.elements).map(Number)

    for (const id of allIds) {
        const numId = typeof id === 'number' ? id : parseInt(id)
        const el = store.elements[numId]
        const ed = store.sweepElData[numId]
        if (!el || !ed?.results || ed.results.length === 0) continue

        if (numId === primaryElmId) {
            included.push({ id: numId, el, ed })
            continue
        }

        if (primaryCenter && ed.sweepCenter) {
            if (Math.abs(primaryCenter.lat - ed.sweepCenter.lat) > 0.0001 ||
                Math.abs(primaryCenter.lng - ed.sweepCenter.lng) > 0.0001) {
                excludedCount++
                continue
            }
        }

        const otherStart = ed.results[0]?.time
        const otherStep = ed.results.length > 1 ? ed.results[1]?.time : null
        if (primaryStart !== otherStart || primaryStep !== otherStep || ed.results.length !== primaryLen) {
            excludedCount++
            continue
        }

        included.push({ id: numId, el, ed })
    }

    return { included, excludedCount }
}

export default SightlineTool_Visibility
