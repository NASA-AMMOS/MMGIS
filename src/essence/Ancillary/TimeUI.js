//Modal is a just a simple modal with a fullscreen backdrop

/*use like:
  Modal.set( html[string], onAdd[callback] );
  Modal.remove() programmatically removes it.
*/
import $ from 'jquery'
import * as d3 from 'd3'
import * as moment from 'moment'
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'
import calls from '../../pre/calls'
import tippy from 'tippy.js'

import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'

import './TimeUI.css'

const FORMAT = 'MM/DD/yyyy, hh:mm:ss A'

const MS = {
    year: 31557600000,
    month: 2629800000,
    day: 86400000,
    hour: 3600000,
    minute: 60000,
    second: 1000,
}

const TimeUI = {
    startTempus: null,
    endTempus: null,
    timeSlider: null,
    _startTimestamp: null,
    _endTimestamp: null,
    _timeSliderTimestamp: null,
    now: false,
    intervalIndex: 3,
    intervalKeys: [
        '1s',
        '2s',
        '5s',
        '10s',
        '20s',
        '30s',
        '1m',
        '2m',
        '5m',
        '10m',
    ],
    intervalValues: [
        1000,
        2000,
        5000,
        10000,
        20000,
        30000,
        60000,
        60000 * 2,
        60000 * 5,
        60000 * 10,
    ],
    init: function (timeChange) {
        TimeUI.timeChange = timeChange
        // prettier-ignore
        const markup = [
            `<div id="mmgisTimeUI">`,
                `<div id="mmgisTimeUIMain">`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIStartWrapper">`,
                        `<span>Start Time</span>`,
                        `<input id="mmgisTimeUIStart"/>`,
                    `</div>`,
                    `<div id="mmgisTimeUITimeline">`,
                        `<div id="mmgisTimeUITimelineHisto"></div>`,
                        `<div id="mmgisTimeUITimelineInner"></div>`,
                        `<div id='mmgisTimeUITimelineSlider' class='svelteSlider'></div>`,
                    `</div>`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIEndWrapper">`,
                        `<span>End Time</span>`,
                        `<input id="mmgisTimeUIEnd"/>`,
                    `</div>`,
                `</div>`,
                `<div id="mmgisTimeUIActionsRight">`,
                    `<div id="mmgisTimeUIPlay" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-play mdi-24px'></i>`,
                    `</div>`,
                    `<div class="vertDiv"></div>`,
                    `<div id="mmgisTimeUIInterval" class="mmgisTimeUIButton">`,
                        `<div id='mmgisTimeUIIntervalCycler'>${TimeUI.intervalKeys[TimeUI.intervalIndex]}</div>`,
                    `</div>`,
                `</div>`,
                `<div id="mmgisTimeUICurrentWrapper">`,
                    `<div>Active Time</div>`,
                    `<div id="mmgisTimeUICurrentTime"></div>`,
                `</div>`,
            `</div>`
        ].join('\n')

        d3.select('#splitscreens')
            .append('div')
            .attr('id', 'timeUI')
            .html(markup)

        TimeUI.attachEvents()
    },
    getElement: function () {},
    attachEvents: function (timeChange) {
        const options = {
            display: {
                viewMode: 'months',
                components: {
                    decades: true,
                    year: true,
                    month: true,
                    date: true,
                    hours: true,
                    minutes: true,
                    seconds: true,
                },
                buttons: {
                    today: false,
                    clear: false,
                    close: true,
                },
                theme: 'dark',
                icons: {
                    type: 'icons',
                    time: 'mdi mdi-clock-outline mdi-18px',
                    date: 'mdi mdi-calendar-outline mdi-18px',
                    up: 'mdi mdi-chevron-up mdi-18px',
                    down: 'mdi mdi-chevron-down mdi-18px',
                    previous: 'mdi mdi-chevron-left mdi-18px',
                    next: 'mdi mdi-chevron-right mdi-18px',
                    today: 'mdi mdi-calendar-today mdi-18px',
                    clear: 'mdi mdi-delete mdi-18px',
                    close: 'mdi mdi-check-bold mdi-18px',
                },
            },
            useCurrent: false,
            //promptTimeOnDateChange: true,
            promptTimeOnDateChangeTransitionDelay: 200,
        }

        const startElm = document.getElementById('mmgisTimeUIStart')
        TimeUI.startTempus = new TempusDominus(startElm, options)
        TimeUI.startTempus.dates.formatInput = function (date) {
            return moment(date).format(FORMAT)
        }

        const endElm = document.getElementById('mmgisTimeUIEnd')
        TimeUI.endTempus = new TempusDominus(endElm, options)
        TimeUI.endTempus.dates.formatInput = function (date) {
            return moment(date).format(FORMAT)
        }

        // Don't let end date be before start date
        TimeUI.startTempus.subscribe(Namespace.events.change, (e) => {
            TimeUI.setStartTime(moment.utc(e.date).toISOString())
            TimeUI.endTempus.updateOptions({
                restrictions: {
                    minDate: e.date,
                },
            })
            TimeUI._remakeTimeSlider()
        })
        // Don't let start date be after end date
        TimeUI.endTempus.subscribe(Namespace.events.change, (e) => {
            if (TimeUI._startTimestamp != null) {
                TimeUI.setEndTime(moment.utc(e.date).toISOString())
                TimeUI.startTempus.updateOptions({
                    restrictions: {
                        maxDate: e.date,
                    },
                })
                TimeUI._remakeTimeSlider()
            }
        })

        // Disable Now when picking so that date restrictions don't keep applying and hiding calendar
        TimeUI.startTempus.subscribe(Namespace.events.show, (e) => {
            if (TimeUI.now) {
                TimeUI.now = false
                TimeUI.reNow = true
            }
        })
        TimeUI.startTempus.subscribe(Namespace.events.hide, (e) => {
            if (TimeUI.reNow) {
                TimeUI.now = true
                TimeUI.reNow = false
            }
        })

        // Interval Cycler
        $('#mmgisTimeUIIntervalCycler').on('click', function () {
            TimeUI.intervalIndex++
            if (TimeUI.intervalIndex >= TimeUI.intervalKeys.length)
                TimeUI.intervalIndex = 0
            $('#mmgisTimeUIIntervalCycler').text(
                TimeUI.intervalKeys[TimeUI.intervalIndex]
            )

            clearInterval(TimeUI.loopTime)
            TimeUI.loopTime = setInterval(
                TimeUI._setCurrentTime,
                TimeUI.intervalValues[TimeUI.intervalIndex]
            )
        })

        // tippy
        tippy('#mmgisTimeUIPlay', {
            content: 'Play (Drag slider to End Time for Current Time too)',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIIntervalCycler', {
            content: 'Play Interval',
            placement: 'top',
            theme: 'blue',
        })

        setTimeout(() => {
            let date = new Date()
            const offsetEndDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedEnd = TimeUI.endTempus.dates.parseInput(
                new Date(offsetEndDate)
            )
            TimeUI.endTempus.dates.setValue(parsedEnd)
            // Start 1 month ago
            date.setUTCMonth(date.getUTCMonth() - 1)
            const offsetStartDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedStart = TimeUI.startTempus.dates.parseInput(
                new Date(offsetStartDate)
            )
            TimeUI.startTempus.dates.setValue(parsedStart)

            $('#mmgisTimeUIPlay').on('click', TimeUI.toggleTimeNow)

            TimeUI.loopTime = setInterval(
                TimeUI._setCurrentTime,
                TimeUI.intervalValues[TimeUI.intervalIndex]
            )

            TimeUI._remakeTimeSlider()
            TimeUI._setCurrentTime(true)
        }, 2000)
    },
    toggleTimeNow(force) {
        if ((!TimeUI.now && typeof force != 'boolean') || force === true) {
            $('#mmgisTimeUIEnd').css('pointer-events', 'none')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'not-allowed')
            $('#mmgisTimeUIPlay')
                .css('background', 'var(--color-p4)')
                .css('color', 'white')
            TimeUI.now = true
        } else {
            $('#mmgisTimeUIEnd').css('pointer-events', 'inherit')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'inherit')
            $('#mmgisTimeUIPlay')
                .css('background', '')
                .css('color', 'var(--color-a4)')
            TimeUI.now = false
        }
    },
    _remakeTimeSlider() {
        if (TimeUI.timeSlider) {
            $('#mmgisTimeUITimelineSlider').empty()
            TimeUI.timeSlider = null
        }

        TimeUI.timeSlider = new RangeSliderPips({
            target: document.querySelector('#mmgisTimeUITimelineSlider'),
            props: {
                values: [TimeUI._startTimestamp, TimeUI.getCurrentTimestamp()],
                pips: false,
                min: TimeUI._startTimestamp,
                max: TimeUI._endTimestamp,
                range: true,
                pushy: false,
                float: false,
                springValues: {
                    stiffness: 0.15,
                    damping: 0.5,
                },
                handleFormatter: (v) => {
                    return moment.utc(v).format(FORMAT)
                },
            },
        })

        $('#mmgisTimeUICurrentTime').text(
            moment.utc(TimeUI.getCurrentTimestamp(true)).format(FORMAT)
        )

        TimeUI.timeSlider.$on('start', (e) => {
            TimeUI.toggleTimeNow(false)
        })
        TimeUI.timeSlider.$on('change', (e) => {
            $('#mmgisTimeUICurrentTime').text(
                moment.utc(TimeUI.removeOffset(e.detail.value)).format(FORMAT)
            )
        })
        TimeUI.timeSlider.$on('stop', (e) => {
            TimeUI._timeSliderTimestamp = e.detail.value
            $('#mmgisTimeUICurrentTime').text(
                moment.utc(TimeUI.getCurrentTimestamp(true)).format(FORMAT)
            )
            TimeUI.change()
        })

        if ($('#toggleTimeUI').hasClass('active')) TimeUI._makeHistogram()
    },
    _makeHistogram() {
        const startTimestamp = TimeUI._startTimestamp
        const endTimestamp = TimeUI.getCurrentTimestamp()

        // Don't remake if nothing changes
        if (
            TimeUI.lastHistoStartTimestamp === startTimestamp &&
            TimeUI.lastHistoEndTimestamp === endTimestamp
        )
            return
        else {
            TimeUI.lastHistoStartTimestamp = startTimestamp
            TimeUI.lastHistoEndTimestamp = endTimestamp
        }

        // Find all on, time-enabled, tile layers
        const sparklineLayers = []
        Object.keys(L_.layersNamed).forEach((name) => {
            const l = L_.layersNamed[name]
            if (
                l &&
                l.type === 'tile' &&
                l.time &&
                l.time.enabled === true &&
                L_.toggledArray[name] === true
            ) {
                let layerUrl = l.url
                if (!F_.isUrlAbsolute(layerUrl)) {
                    layerUrl = L_.missionPath + layerUrl
                    if (layerUrl.indexOf('{t}') > -1)
                        sparklineLayers.push({
                            name: name,
                            path: `/${layerUrl}`.replace(/{t}/g, '_time_'),
                        })
                }
            }
        })

        const starttimeISO = new Date(TimeUI._startTimestamp).toISOString()
        const endtimeISO = new Date(endTimestamp).toISOString()

        const NUM_BINS = Math.min(endTimestamp - startTimestamp, 360)
        const bins = new Array(NUM_BINS).fill(0)

        sparklineLayers.forEach((l) => {
            calls.api(
                'query_tileset_times',
                {
                    path: l.path,
                    starttime: starttimeISO,
                    endtime: endtimeISO,
                },
                function (data) {
                    if (data.body && data.body.times) {
                        data.body.times.forEach((time) => {
                            bins[
                                Math.floor(
                                    F_.linearScale(
                                        [startTimestamp, endTimestamp],
                                        [0, NUM_BINS],
                                        new Date(time.t).getTime()
                                    )
                                )
                            ]++
                        })

                        const minmax = F_.getMinMaxOfArray(bins)

                        const histoElm = $('#mmgisTimeUITimelineHisto')
                        histoElm.empty()
                        if (minmax.max > 0)
                            bins.forEach((b) => {
                                histoElm.append(
                                    `<div style="width:${
                                        (1 / NUM_BINS) * 100
                                    }%; margin-top:${
                                        40 - (b / minmax.max) * 40
                                    }px"></div>`
                                )
                            })
                    }
                },
                function (e) {}
            )
        })
    },
    _setCurrentTime(force) {
        if (TimeUI.now === true || force === true) {
            let date = new Date()
            const offsetNowDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedNow = TimeUI.endTempus.dates.parseInput(
                new Date(offsetNowDate)
            )
            TimeUI.endTempus.dates.setValue(parsedNow)
        }
    },
    setStartTime(ISOString) {
        const timestamp = Date.parse(ISOString)
        TimeUI._startTimestamp = timestamp

        TimeUI._drawTimeLine()
        TimeUI.change()
    },
    removeOffset(timestamp) {
        const date = new Date(timestamp)
        const removedOffset = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        )
        return removedOffset
    },
    getCurrentTimestamp(removeOffset) {
        let currentTimestamp = TimeUI._timeSliderTimestamp
        if (currentTimestamp == null) currentTimestamp = TimeUI._endTimestamp
        else if (
            currentTimestamp < TimeUI._startTimestamp ||
            currentTimestamp > TimeUI._endTimestamp
        )
            currentTimestamp = TimeUI._endTimestamp

        if (removeOffset) {
            return TimeUI.removeOffset(currentTimestamp)
        } else return currentTimestamp
    },
    setEndTime(ISOString) {
        const sliderFixedToEnd =
            TimeUI._endTimestamp === TimeUI.getCurrentTimestamp()
        const timestamp = Date.parse(ISOString)
        TimeUI._endTimestamp = timestamp
        TimeUI._drawTimeLine()

        if (sliderFixedToEnd) {
            TimeUI._timeSliderTimestamp = TimeUI._endTimestamp
            TimeUI.change()
        }
    },
    change() {
        if (
            typeof TimeUI.timeChange === 'function' &&
            TimeUI._startTimestamp &&
            TimeUI._endTimestamp
        ) {
            TimeUI.timeChange(
                new Date(
                    TimeUI.removeOffset(TimeUI._startTimestamp)
                ).toISOString(),
                new Date(
                    TimeUI.removeOffset(TimeUI._endTimestamp)
                ).toISOString(),
                new Date(TimeUI.getCurrentTimestamp(true)).toISOString()
            )
        }
    },
    _drawTimeLine() {
        const timelineElm = $('#mmgisTimeUITimelineInner')
        timelineElm.empty()

        const s = TimeUI._startTimestamp
        const e = TimeUI._endTimestamp
        if (e == null || s == null) return

        const dif = e - s

        let unit = null

        if (dif / MS.year > 3) {
            unit = 'year'
        } else if (dif / MS.month > 1) {
            unit = 'month'
        } else if (dif / MS.day > 2) {
            unit = 'day'
        } else if (dif / MS.hour > 1) {
            unit = 'hour'
        } else if (dif / MS.minute > 1) {
            unit = 'minute'
        } else unit = 'second'

        let first = true
        const bigTicks = F_.getTimeStartsBetweenTimestamps(s, e, unit)
        for (let i = 0; i < bigTicks.length; i++) {
            const left = F_.linearScale([s, e], [0, 100], bigTicks[i].ts)
            if (left >= 0 && left <= 100) {
                timelineElm.append(
                    [
                        `<div class="mmgisTimeUITick" style="left: ${left}%">`,
                        `<div class="mmgisTimeUITickBig"></div>`,
                        `<div class="mmgisTimeUITickLabel">${
                            bigTicks[i].label
                        }${first ? `<br/><span>${unit}</span>` : ''}</div`,
                        `</div>`,
                    ].join('\n')
                )
                first = false
            }
        }
    },
}

export default TimeUI
