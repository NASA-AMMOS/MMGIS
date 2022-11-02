//Modal is a just a simple modal with a fullscreen backdrop

/*use like:
  Modal.set( html[string], onAdd[callback] );
  Modal.remove() programmatically removes it.
*/
import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'

import { TempusDominus, extend, Namespace } from '@eonasdan/tempus-dominus'
import customDateFormat from '@eonasdan/tempus-dominus/dist/plugins/customDateFormat'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'

import './TimeUI.css'
extend(customDateFormat)

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
    _startTimestamp: null,
    _endTimestamp: null,
    init: function () {},
    getElement: function () {
        // prettier-ignore
        return [
            `<div id="mmgisTimeUI">`,
                `<div id="mmgisTimeUIMain">`,
                    `<div class="mmgisTimeUIInput">`,
                        `<input id="mmgisTimeUIStart"/>`,
                    `</div>`,
                    `<div id="mmgisTimeUITimeline">`,
                    `</div>`,
                    `<div class="mmgisTimeUIInput">`,
                        `<input id="mmgisTimeUIEnd"/>`,
                    `</div>`,
                `</div>`,
                `<div id="mmgisTimeUIActions">`,
                    `<div id="mmgisTimeUINow">`,
                        `<i class='mdi mdi-clock-end mdi-18px'></i>`,
                    `</div>`,
                    `<div id="mmgisTimeUIPlay">`,
                        `<i class='mdi mdi-play mdi-18px'></i>`,
                    `</div>`,
                    `<div id="mmgisTimeUIStep">`,
                        `<i class='mdi mdi-play mdi-18px'></i>`,
                    `</div>`,
                    `<div id="mmgisTimeUIHelp">`,
                    `</div>`,
                `</div>`,
            `</div>`
        ].join('\n')
    },
    attachEvents: function () {
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
        })

        // Drag timeline to shift time range
        /*
        const timelineElm = $('#mmgisTimeUITimeline')
        timelineElm.on('mousedown', (eDown) => {
            TimeUI._dragXStart = eDown.clientX - $(this).offset().left
            timelineElm.on('mousemove', (eMove) => {

            })
            timelineElm.on('mouseup', (eUp) => {})
        })
        */
    },
    setStartTime(ISOString) {
        const timestamp = Date.parse(ISOString)
        TimeUI._startTimestamp = timestamp
        TimeUI._drawTimeLine()
    },
    setEndTime(ISOString) {
        const timestamp = Date.parse(ISOString)
        TimeUI._endTimestamp = timestamp
        TimeUI._drawTimeLine()
    },
    _drawTimeLine() {
        const timelineElm = $('#mmgisTimeUITimeline')
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
        } else if (dif / MS.hour > 2) {
            unit = 'hour'
        } else if (dif / MS.minute > 2) {
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
