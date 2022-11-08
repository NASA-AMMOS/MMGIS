//Modal is a just a simple modal with a fullscreen backdrop

/*use like:
  Modal.set( html[string], onAdd[callback] );
  Modal.remove() programmatically removes it.
*/
import $ from 'jquery'
import * as d3 from 'd3'
import * as moment from 'moment'
import F_ from '../Basics/Formulae_/Formulae_'

import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'

import './TimeUI.css'

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
                        `<div id="mmgisTimeUITimelineInner"></div>`,
                        `<div id='mmgisTimeUITimelineSlider' class='svelteSlider'></div>`,
                    `</div>`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIEndWrapper">`,
                        `<span>End Time</span>`,
                        `<input id="mmgisTimeUIEnd"/>`,
                    `</div>`,
                `</div>`,
                `<div id="mmgisTimeUIActionsRight">`,
                    `<div id="mmgisTimeUINow" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-clock-end mdi-24px'></i>`,
                    `</div>`,
                    /*
                    `<div id="mmgisTimeUIHelp" class="mmgisTimeUIButton">`,
                    `</div>`,
                    */
                `</div>`,
                `<div id="mmgisTimeUICurrentWrapper">`,
                    `<div>Current Time</div>`,
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
            //promptTimeOnDateChange: true,
            promptTimeOnDateChangeTransitionDelay: 200,
            localization: {
                format: 'MMM dd, yyyy - HH:mm:ss T',
            },
        }

        const startElm = document.getElementById('mmgisTimeUIStart')
        TimeUI.startTempus = new TempusDominus(startElm, {
            ...options,
            ...{ useCurrent: false },
        })

        const endElm = document.getElementById('mmgisTimeUIEnd')
        TimeUI.endTempus = new TempusDominus(endElm, options)

        // Don't let end date be before start date
        TimeUI.startTempus.subscribe(Namespace.events.change, (e) => {
            TimeUI.setStartTime(
                new Date(
                    Date.UTC(
                        e.date.getFullYear(),
                        e.date.getMonth(),
                        e.date.getDate(),
                        e.date.getHours(),
                        e.date.getMinutes(),
                        e.date.getSeconds()
                    )
                ).toISOString()
            )
            TimeUI.endTempus.updateOptions({
                restrictions: {
                    minDate: e.date,
                },
            })
            TimeUI._remakeTimeSlider()
        })
        // Don't let start date be after end date
        TimeUI.endTempus.subscribe(Namespace.events.change, (e) => {
            TimeUI.setEndTime(
                new Date(
                    Date.UTC(
                        e.date.getFullYear(),
                        e.date.getMonth(),
                        e.date.getDate(),
                        e.date.getHours(),
                        e.date.getMinutes(),
                        e.date.getSeconds()
                    )
                ).toISOString()
            )
            TimeUI.startTempus.updateOptions({
                restrictions: {
                    maxDate: e.date,
                },
            })
            TimeUI._remakeTimeSlider()
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

        // Start 1 month ago
        const startDate = new Date()
        startDate.setUTCMonth(startDate.getUTCMonth() - 1)
        const parsedStart = TimeUI.startTempus.dates.parseInput(startDate)
        TimeUI.startTempus.dates.setValue(parsedStart)
        TimeUI._startTimestamp = Date.parse(startDate)

        $('#mmgisTimeUINow').on('click', TimeUI.toggleTimeNow)

        TimeUI.loopTime = setInterval(TimeUI._setCurrentTime, 1000)

        setTimeout(() => {
            TimeUI._remakeTimeSlider()
            TimeUI._setCurrentTime(true)
        }, 2000)
    },
    toggleTimeNow(force) {
        if ((!TimeUI.now && typeof force != 'boolean') || force === true) {
            $('#mmgisTimeUIEnd').css('pointer-events', 'none')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'not-allowed')
            $('#mmgisTimeUINow')
                .css('background', 'var(--color-c2)')
                .css('color', 'white')
            TimeUI.now = true
        } else {
            $('#mmgisTimeUIEnd').css('pointer-events', 'inherit')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'inherit')
            $('#mmgisTimeUINow')
                .css('background', 'unset')
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
                    return moment(v).format('MM/DD/yyyy, HH:mm:ss A')
                },
            },
        })

        $('#mmgisTimeUICurrentTime').text(
            moment(TimeUI.getCurrentTimestamp()).format(
                'MM/DD/yyyy, HH:mm:ss A'
            )
        )

        TimeUI.timeSlider.$on('start', (e) => {
            TimeUI.toggleTimeNow(false)
        })
        TimeUI.timeSlider.$on('change', (e) => {
            $('#mmgisTimeUICurrentTime').text(
                moment(e.detail.value).format('MM/DD/yyyy, HH:mm:ss A')
            )
        })
        TimeUI.timeSlider.$on('stop', (e) => {
            TimeUI._timeSliderTimestamp = e.detail.value
            TimeUI.change()
        })
    },
    _setCurrentTime(force) {
        if (TimeUI.now === true || force === true) {
            const parsedNow = TimeUI.endTempus.dates.parseInput(new Date())
            TimeUI.endTempus.dates.setValue(parsedNow)
        }
    },
    setStartTime(ISOString) {
        const timestamp = Date.parse(ISOString)
        TimeUI._startTimestamp = timestamp
        TimeUI._drawTimeLine()

        TimeUI.change()
    },
    getCurrentTimestamp() {
        let currentTimestamp = TimeUI._timeSliderTimestamp
        if (currentTimestamp == null) currentTimestamp = TimeUI._endTimestamp
        else if (
            currentTimestamp < TimeUI._startTimestamp ||
            currentTimestamp > TimeUI._endTimestamp
        )
            currentTimestamp = TimeUI._endTimestamp

        return currentTimestamp
    },
    setEndTime(ISOString) {
        const timestamp = Date.parse(ISOString)
        TimeUI._endTimestamp = timestamp
        TimeUI._drawTimeLine()

        TimeUI.change()
    },
    change() {
        if (
            typeof TimeUI.timeChange === 'function' &&
            TimeUI._startTimestamp &&
            TimeUI._endTimestamp
        )
            TimeUI.timeChange(
                new Date(TimeUI._startTimestamp).toISOString(),
                new Date(TimeUI.getCurrentTimestamp()).toISOString()
            )
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
