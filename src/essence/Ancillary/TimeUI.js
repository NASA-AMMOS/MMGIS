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
import Dropy from '../../external/Dropy/dropy'

import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'

import './TimeUI.css'

const FORMAT = 'MM/DD/yyyy, hh:mm:ss A'

const MS = {
    decade: 315576000000,
    year: 31557600000,
    month: 2629800000,
    week: 604800000,
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
    _timelineStartTimestamp: null,
    _timelineEndTimestamp: null,
    now: false,
    numFrames: 24,
    intervalIndex: 6,
    intervalValues: [100, 250, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000],
    intervalNames: [
        '.1s',
        '.25s',
        '0.5s',
        '1s',
        '2s',
        '3s',
        '4s',
        '5s',
        '10s',
        '20s',
    ],
    stepIndex: 3,
    modes: ['Range', 'Point'],
    modeIndex: 0,
    _initialStart: null,
    _initialEnd: null,
    init: function (timeChange) {
        TimeUI.timeChange = timeChange
        // prettier-ignore
        const markup = [
            `<div id="mmgisTimeUI">`,
                `<div id="mmgisTimeUIActionsLeft">`,
                    `<div id='mmgisTimeUIMode'>`,
                        `<div id='mmgisTimeUIModeDropdown' class='ui dropdown short'></div>`,
                    `</div>`,
                    `<div class="vertDiv"></div>`,
                    `<div id="mmgisTimeUIPlay" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-play mdi-24px'></i>`,
                    `</div>`,
                    `<div class="vertDiv"></div>`,
                    `<div id='mmgisTimeUIStep'>`,
                        `<div id='mmgisTimeUIStepDropdown' class='ui dropdown short'></div>`,
                    `</div>`,
                    `<div class="vertDiv"></div>`,
                    `<div id='mmgisTimeUIRate'>`,
                        `<div id='mmgisTimeUIRateDropdown' class='ui dropdown short'></div>`,
                    `</div>`,
                `</div>`,
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
                        `<span>Active Time</span>`,
                        `<input id="mmgisTimeUIEnd"/>`,
                    `</div>`,
                `</div>`,
                `<div id="mmgisTimeUIActionsRight">`,
                    `<div id="mmgisTimeUIPresent" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-clock-end mdi-24px'></i>`,
                    `</div>`,
                `</div>`,
                /*
                `<div id="mmgisTimeUICurrentWrapper">`,
                    `<div>Active Time</div>`,
                    `<div id="mmgisTimeUICurrentTime"></div>`,
                `</div>`,
                */
            `</div>`
        ].join('\n')

        d3.select('#splitscreens')
            .append('div')
            .attr('id', 'timeUI')
            .html(markup)

        TimeUI.attachEvents()

        return TimeUI
    },
    getElement: function () {},
    attachEvents: function (timeChange) {
        // Timeline pan and zoom
        // zoom
        $('#mmgisTimeUITimelineInner').on('mousewheel', function (e) {
            if (TimeUI.play) return
            const x = e.originalEvent.offsetX
            const width = document
                .getElementById('mmgisTimeUITimelineInner')
                .getBoundingClientRect().width
            // As opposed to per-cent
            const perun = x / width
            const direction = e.originalEvent.deltaY > 0 ? 1 : -1
            const AMOUNT = 0.2
            const dif =
                TimeUI._timelineEndTimestamp - TimeUI._timelineStartTimestamp
            const maxChangeAmount = dif * AMOUNT

            const nextStart =
                TimeUI._timelineStartTimestamp -
                0 -
                perun * maxChangeAmount * direction
            const nextEnd =
                TimeUI._timelineEndTimestamp -
                0 +
                (1 - perun) * maxChangeAmount * direction

            TimeUI._drawTimeLine(nextStart, nextEnd)
        })

        // pan
        $('#mmgisTimeUITimelineInner').on('mousedown', function () {
            if (TimeUI.play) {
                TimeUI._timelineDragging = false
                return
            }
            TimeUI._timelineDragging = true
            $('#mmgisTimeUITimelineSlider').css({ pointerEvents: 'none' })
            $('#mmgisTimeUITimelineInner').on('mousemove', TimeUI._timelineDrag)
        })
        $('#mmgisTimeUITimelineInner').on('mouseout', function () {
            if (TimeUI._timelineDragging === true) {
                $('#mmgisTimeUITimelineSlider').css({
                    pointerEvents: 'inherit',
                })
                $('#mmgisTimeUITimelineInner').off(
                    'mousemove',
                    TimeUI._timelineDrag
                )
                TimeUI._timelineDragging = false
            }
        })
        $('#mmgisTimeUITimelineInner').on('mouseup', function () {
            if (TimeUI._timelineDragging === true) {
                $('#mmgisTimeUITimelineSlider').css({
                    pointerEvents: 'inherit',
                })
                $('#mmgisTimeUITimelineInner').off(
                    'mousemove',
                    TimeUI._timelineDrag
                )
                TimeUI._timelineDragging = false
            }
        })

        // Time
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
            if (TimeUI.startTempus.dontChangeAnythingElse !== true) {
                TimeUI.setStartTime(
                    moment.utc(e.date).toISOString(),
                    TimeUI.startTempus.dontChangeNext
                )
                TimeUI.endTempus.updateOptions({
                    restrictions: {
                        minDate: e.date,
                    },
                })
                TimeUI._remakeTimeSlider()
                TimeUI.startTempus.dontChangeNext = false
            }
            TimeUI.startTempus.dontChangeAnythingElse = false
        })
        // Don't let start date be after end date
        TimeUI.endTempus.subscribe(Namespace.events.change, (e) => {
            if (
                TimeUI._startTimestamp != null &&
                TimeUI.endTempus.dontChangeAnythingElse !== true
            ) {
                TimeUI.setEndTime(
                    moment.utc(e.date).toISOString(),
                    TimeUI.endTempus.dontChangeNext
                )
                TimeUI.startTempus.updateOptions({
                    restrictions: {
                        maxDate: e.date,
                    },
                })

                TimeUI._remakeTimeSlider()
                TimeUI.endTempus.dontChangeNext = false
            }
            TimeUI.endTempus.dontChangeAnythingElse = false
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

        // tippy
        tippy('#mmgisTimeUIMode', {
            content: 'Mode',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIPlay', {
            content: 'Play',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIStep', {
            content: 'Step Size',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIRate', {
            content: 'Step Duration',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIPresent', {
            content: 'Present',
            placement: 'top',
            theme: 'blue',
        })

        // Mode dropdown
        $('#mmgisTimeUIModeDropdown').html(
            Dropy.construct(TimeUI.modes, 'Mode', TimeUI.modeIndex, {
                openUp: true,
                dark: true,
            })
        )
        Dropy.init($('#mmgisTimeUIModeDropdown'), function (idx) {
            TimeUI.modeIndex = idx
            if (TimeUI.modes[TimeUI.modeIndex] === 'Point')
                $('#mmgisTimeUIStartWrapper').css({ display: 'none' })
            else $('#mmgisTimeUIStartWrapper').css({ display: 'inherit' })
            TimeUI._remakeTimeSlider(true)
        })
        // Step dropdown
        $('#mmgisTimeUIStepDropdown').html(
            Dropy.construct(
                Object.keys(MS).map((k) => k.capitalizeFirstLetter()),
                'Step',
                TimeUI.stepIndex,
                {
                    openUp: true,
                    dark: true,
                }
            )
        )
        Dropy.init($('#mmgisTimeUIStepDropdown'), function (idx) {
            TimeUI.stepIndex = idx
            TimeUI._refreshIntervals()
        })
        // Rate dropdown
        $('#mmgisTimeUIRateDropdown').html(
            Dropy.construct(
                TimeUI.intervalNames,
                'Rate',
                TimeUI.intervalIndex,
                {
                    openUp: true,
                    dark: true,
                }
            )
        )
        Dropy.init($('#mmgisTimeUIRateDropdown'), function (idx) {
            TimeUI.intervalIndex = idx
            TimeUI._refreshIntervals()
        })

        // Initial end
        if (L_.FUTURES.endTime != null) {
            L_.configData.time.initialend = L_.FUTURES.endTime
        }
        if (
            L_.configData.time.initialend != null &&
            L_.configData.time.initialend != 'now'
        ) {
            const dateStaged = new Date(L_.configData.time.initialend)
            if (dateStaged == 'Invalid Date') {
                TimeUI._initialEnd = new Date()
                console.warn(
                    "Invalid 'Initial End Time' provided. Defaulting to 'now'."
                )
            } else TimeUI._initialEnd = dateStaged
        } else TimeUI._initialEnd = new Date()

        // Initial start
        // Start 1 month ago
        TimeUI._initialStart = new Date(TimeUI._initialEnd)
        if (L_.FUTURES.startTime != null) {
            L_.configData.time.initialstart = L_.FUTURES.startTime
        }
        if (L_.configData.time.initialstart == null)
            TimeUI._initialStart.setUTCMonth(
                TimeUI._initialStart.getUTCMonth() - 1
            )
        else {
            const dateStaged = new Date(L_.configData.time.initialstart)
            if (dateStaged === 'Invalid Date') {
                TimeUI._initialStart.setUTCMonth(
                    TimeUI._initialStart.getUTCMonth() - 1
                )
                console.warn(
                    "Invalid 'Initial Start Time' provided. Defaulting to 1 month before the end time."
                )
            } else if (dateStaged.getTime() > TimeUI._initialEnd.getTime()) {
                TimeUI._initialStart.setUTCMonth(
                    TimeUI._initialStart.getUTCMonth() - 1
                )
                console.warn(
                    "'Initial Start Time' cannot be later than the end time. Defaulting to 1 month before the end time."
                )
            } else TimeUI._initialStart = dateStaged
        }

        // Initialize the time control times, but don't trigger events
        TimeUI.timeChange(
            TimeUI._initialStart.toISOString(),
            TimeUI._initialEnd.toISOString(),
            null,
            true
        )
    },
    fina() {
        let date
        // Initial end
        date = new Date(TimeUI._initialEnd)
        const savedEndDate = new Date(date)

        const offsetEndDate = new Date(
            date.getTime() + date.getTimezoneOffset() * 60000
        )
        const parsedEnd = TimeUI.endTempus.dates.parseInput(
            new Date(offsetEndDate)
        )
        TimeUI.endTempus.dates.setValue(parsedEnd)

        // Initial start
        // Start 1 month ago
        if (L_.configData.time.initialstart == null)
            date.setUTCMonth(date.getUTCMonth() - 1)
        else {
            const dateStaged = new Date(L_.configData.time.initialstart)
            if (dateStaged === 'Invalid Date') {
                date.setUTCMonth(date.getUTCMonth() - 1)
                console.warn(
                    "Invalid 'Initial Start Time' provided. Defaulting to 1 month before the end time."
                )
            } else if (dateStaged.getTime() > savedEndDate.getTime()) {
                date.setUTCMonth(date.getUTCMonth() - 1)
                console.warn(
                    "'Initial Start Time' cannot be later than the end time. Defaulting to 1 month before the end time."
                )
            } else date = dateStaged
        }
        date = new Date(TimeUI._initialStart)

        const offsetStartDate = new Date(
            date.getTime() + date.getTimezoneOffset() * 60000
        )
        const parsedStart = TimeUI.startTempus.dates.parseInput(
            new Date(offsetStartDate)
        )
        TimeUI.startTempus.dates.setValue(parsedStart)

        $('#mmgisTimeUIPlay').on('click', TimeUI.togglePlay)
        $('#mmgisTimeUIPresent').on('click', TimeUI.toggleTimeNow)

        TimeUI._remakeTimeSlider()
        TimeUI._setCurrentTime(true, savedEndDate)
    },
    togglePlay() {
        if (TimeUI.play) {
            $('#mmgisTimeUIPlay')
                .css('background', '')
                .css('color', 'var(--color-a4)')
            TimeUI.play = false
        } else {
            $('#mmgisTimeUIPlay')
                .css('background', 'var(--color-p4)')
                .css('color', 'white')
            TimeUI.play = true
            TimeUI.now = false
            $('#mmgisTimeUIPresent')
                .css('background', '')
                .css('color', 'var(--color-a4)')
            $('#mmgisTimeUIEnd').css('pointer-events', 'inherit')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'inherit')
        }
        TimeUI._refreshIntervals()
    },
    _refreshIntervals() {
        clearInterval(TimeUI.playInterval)
        if (TimeUI.play) {
            TimeUI.playInterval = setInterval(
                TimeUI._loopTime,
                TimeUI.intervalValues[TimeUI.intervalIndex]
            )
        }

        clearInterval(TimeUI.presentTimeInterval)
        if (TimeUI.now) {
            TimeUI.presentTimeInterval = setInterval(
                TimeUI._setCurrentTime,
                TimeUI.intervalValues[TimeUI.intervalIndex]
            )
        }
    },
    _loopTime() {
        const mode = TimeUI.modes[TimeUI.modeIndex]
        const start =
            mode === 'Range'
                ? TimeUI._startTimestamp
                : TimeUI._timelineStartTimestamp

        const end =
            mode === 'Range'
                ? TimeUI._endTimestamp
                : TimeUI._timelineEndTimestamp
        const current = TimeUI.getCurrentTimestamp()

        let next = current + MS[Object.keys(MS)[TimeUI.stepIndex]]
        if (next > end) next = end
        if (current === end) next = start

        TimeUI.setCurrentTime(next)
        TimeUI._remakeTimeSlider(true)
    },
    toggleTimeNow(force) {
        if ((!TimeUI.now && typeof force != 'boolean') || force === true) {
            $('#mmgisTimeUIPresent')
                .css('background', 'var(--color-p4)')
                .css('color', 'white')
            $('#mmgisTimeUIEnd').css('pointer-events', 'none')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'not-allowed')
            TimeUI.now = true
            TimeUI.play = false
            $('#mmgisTimeUIPlay')
                .css('background', '')
                .css('color', 'var(--color-a4)')
        } else {
            clearInterval(TimeUI.presentTimeInterval)
            $('#mmgisTimeUIPresent')
                .css('background', '')
                .css('color', 'var(--color-a4)')
            $('#mmgisTimeUIEnd').css('pointer-events', 'inherit')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'inherit')
            TimeUI.now = false
        }
        TimeUI._refreshIntervals()
    },
    _remakeTimeSlider(ignoreHistogram) {
        const rangeMode =
            TimeUI.modes[TimeUI.modeIndex] === 'Range' ? true : false
        if (TimeUI.timeSlider) {
            $('#mmgisTimeUITimelineSlider').empty()
            TimeUI.timeSlider = null
            if (rangeMode) $('#mmgisTimeUITimelineSlider').addClass('rangeMode')
            else $('#mmgisTimeUITimelineSlider').removeClass('rangeMode')
        }

        TimeUI.timeSlider = new RangeSliderPips({
            target: document.querySelector('#mmgisTimeUITimelineSlider'),
            props: {
                values: rangeMode
                    ? [TimeUI._startTimestamp, TimeUI.getCurrentTimestamp()]
                    : [TimeUI.getCurrentTimestamp()],
                pips: false,
                min: TimeUI._timelineStartTimestamp,
                max: TimeUI._timelineEndTimestamp,
                range: rangeMode,
                pushy: false,
                float: false,
                springValues: {
                    stiffness: 0.15,
                    damping: 0.5,
                },
                handleFormatter: (v) => {
                    return moment.utc(TimeUI.removeOffset(v)).format(FORMAT)
                },
            },
        })

        TimeUI.timeSlider.$on('start', (e) => {
            TimeUI.toggleTimeNow(false)
        })
        TimeUI.timeSlider.$on('change', (e) => {
            let idx = 0
            if (TimeUI.modes[TimeUI.modeIndex] === 'Point') idx -= 1

            const date = new Date(e.detail.value)
            const offsetNowDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            if (e.detail.activeHandle === idx) {
                const parsedNow = TimeUI.startTempus.dates.parseInput(
                    new Date(offsetNowDate)
                )
                TimeUI.startTempus.dontChangeAnythingElse = true
                TimeUI.startTempus.dates.setValue(parsedNow)
            }
            if (e.detail.activeHandle === idx + 1) {
                const parsedNow = TimeUI.endTempus.dates.parseInput(
                    new Date(offsetNowDate)
                )
                TimeUI.endTempus.dontChangeAnythingElse = true
                TimeUI.endTempus.dates.setValue(parsedNow)
            }
        })
        TimeUI.timeSlider.$on('stop', (e) => {
            let idx = 0
            if (TimeUI.modes[TimeUI.modeIndex] === 'Point') idx -= 1
            if (e.detail.activeHandle === idx) {
                const date = new Date(e.detail.value)
                const offsetNowDate = new Date(
                    date.getTime() + date.getTimezoneOffset() * 60000
                )
                TimeUI.setStartTime(offsetNowDate.toISOString(), false, true)
            }
            if (e.detail.activeHandle === idx + 1)
                TimeUI._setCurrentTime(true, new Date(e.detail.value))
        })

        if ($('#toggleTimeUI').hasClass('active') && ignoreHistogram !== true)
            TimeUI._makeHistogram()
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
    _setCurrentTime(force, forceDate, disableChange) {
        if (TimeUI.now === true || force === true) {
            let date = forceDate || new Date()
            const offsetNowDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedNow = TimeUI.endTempus.dates.parseInput(
                new Date(offsetNowDate)
            )

            TimeUI.setCurrentTime(parsedNow, disableChange)
            //TimeUI._remakeTimeSlider(true)
            TimeUI.endTempus.dates.setValue(parsedNow)
        }
    },
    updateTimes(start, end, current) {
        let date

        // Start
        if (start != null) {
            date = new Date(start)
            const offsetStartDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedStart = TimeUI.startTempus.dates.parseInput(
                new Date(offsetStartDate)
            )
            TimeUI.startTempus.dontChangeNext = true
            TimeUI.startTempus.dates.setValue(parsedStart)
        }

        // End
        if (end != null) {
            date = new Date(end)
            const offsetEndDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedEnd = TimeUI.endTempus.dates.parseInput(
                new Date(offsetEndDate)
            )
            TimeUI.endTempus.dontChangeNext = true
            TimeUI.endTempus.dates.setValue(parsedEnd)
        }

        // Current
        if (current != null) {
            TimeUI.setCurrentTime(current, true)
            TimeUI._remakeTimeSlider(true)
        }

        TimeUI.change()
    },
    setStartTime(ISOString, disableChange, dontRedrawTimeline) {
        const timestamp = Date.parse(ISOString)
        TimeUI._startTimestamp = timestamp
        if (TimeUI._timelineStartTimestamp == null)
            TimeUI._timelineStartTimestamp = TimeUI._startTimestamp

        if (dontRedrawTimeline != true) TimeUI._drawTimeLine()
        if (disableChange != true) TimeUI.change()
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
    setEndTime(ISOString, disableChange) {
        const sliderFixedToEnd =
            TimeUI._endTimestamp === TimeUI.getCurrentTimestamp()
        const timestamp = Date.parse(ISOString)
        TimeUI._endTimestamp = timestamp

        if (TimeUI._timelineEndTimestamp == null)
            TimeUI._timelineEndTimestamp = TimeUI._endTimestamp

        TimeUI._drawTimeLine()

        if (sliderFixedToEnd) {
            TimeUI._timeSliderTimestamp = TimeUI._endTimestamp
            if (disableChange != true) TimeUI.change()
        }
    },
    setCurrentTime(ISOString, disableChange, dontRemoveOffset) {
        const timestamp =
            typeof ISOString === 'string' ? Date.parse(ISOString) : ISOString
        TimeUI._timeSliderTimestamp = timestamp
        if (TimeUI.play) {
            const date = new Date(TimeUI._timeSliderTimestamp)
            const offsetNowDate = new Date(
                date.getTime() + date.getTimezoneOffset() * 60000
            )
            const parsedNow = TimeUI.endTempus.dates.parseInput(
                new Date(offsetNowDate)
            )
            TimeUI.endTempus.dontChangeAnythingElse = true
            TimeUI.endTempus.dates.setValue(parsedNow)
        }

        if (disableChange != true) TimeUI.change()
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
    _timelineDrag: function (e) {
        if (TimeUI._timelineDragging === true) {
            const dx = e.originalEvent.movementX
            const width = document
                .getElementById('mmgisTimeUITimelineInner')
                .getBoundingClientRect().width
            const dif =
                TimeUI._timelineEndTimestamp - TimeUI._timelineStartTimestamp

            const nextStart =
                TimeUI._timelineStartTimestamp - 0 - (dif / width) * dx
            const nextEnd =
                TimeUI._timelineEndTimestamp - 0 - (dif / width) * dx

            TimeUI._drawTimeLine(nextStart, nextEnd)
        }
    },
    _drawTimeLine(forceStart, forceEnd) {
        const timelineElm = $('#mmgisTimeUITimelineInner')
        timelineElm.empty()

        let s = forceStart || TimeUI._timelineStartTimestamp
        let e = forceEnd || TimeUI._timelineEndTimestamp

        if (e == null || s == null) return

        s = Math.max(s - 0, 0) // Year 1970
        e = Math.min(e - 0, 3155788800000) // Year 2070

        TimeUI._timelineStartTimestamp = parseInt(s)
        TimeUI._timelineEndTimestamp = parseInt(e)

        const dif = e - s

        let unit = null

        if (dif / MS.decade > 2) {
            unit = 'decade'
        } else if (dif / MS.year > 2) {
            unit = 'year'
        } else if (dif / MS.month > 1) {
            unit = 'month'
        } else if (dif / MS.day > 1.5) {
            unit = 'day'
        } else if (dif / MS.hour > 0.75) {
            unit = 'hour'
        } else if (dif / MS.minute > 0.75) {
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
                        }${first ? `<br/><span>${unit}</span>` : ''}</div>`,
                        `</div>`,
                    ].join('\n')
                )
                first = false
            }
        }

        TimeUI._remakeTimeSlider(true)
    },
}

export default TimeUI
