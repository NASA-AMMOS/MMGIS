//Modal is a just a simple modal with a fullscreen backdrop

/*use like:
  Modal.set( html[string], onAdd[callback] );
  Modal.remove() programmatically removes it.
*/
import $ from 'jquery'
import * as d3 from 'd3'
import * as moment from 'moment'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'
import L_ from '../Basics/Layers_/Layers_'
import calls from '../../pre/calls'
import tippy from 'tippy.js'
import Dropy from '../../external/Dropy/dropy'

import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'

import './TimeUI.css'

const FORMAT = 'MM/DD/yyyy, hh:mm:ss A'

const MS = {
    second: 1000,
    minute: 60000,
    hour: 3600000,
    day: 86400000,
    week: 604800000,
    month: 2629800000,
    year: 31557600000,
    decade: 315576000000,
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
    durationIndex: 0,
    stepWithinBeyondIndex: 0,
    intervalIndex: 6,
    intervalValues: [
        100, 250, 500, 1000, 2000, 4000, 6000, 8000, 10000, 15000, 20000,
    ],
    intervalNames: [
        '.1 seconds',
        '.25 seconds',
        '0.5 seconds',
        '1 second',
        '2 seconds',
        '4 seconds',
        '6 seconds',
        '8 seconds',
        '10 seconds',
        '15 seconds',
    ],
    stepIndex: 3,
    modes: ['Range', 'Point'],
    modeIndex: 0,
    _initialStart: null,
    _initialEnd: null,
    init: function (timeChange, enabled) {
        TimeUI.timeChange = timeChange
        TimeUI.enabled = enabled

        // prettier-ignore
        const markup = [
            `<div id="mmgisTimeUI">`,
                `<div id="mmgisTimeUIActionsLeft">`,
                    `<div id='mmgisTimeUIMode'>`,
                        `<div id='mmgisTimeUIModeDropdown' class='ui dropdown short'></div>`,
                    `</div>`,
                    `<div id="mmgisTimeUIPlayTrigger" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-movie mdi-24px'></i>`,
                    `</div>`,
                    `<div class="vertDiv"></div>`,
                `</div>`,
                `<div id="mmgisTimeUIMain">`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIStartWrapper">`,
                        `<span>Start Time</span>`,
                        `<input id="mmgisTimeUIStart"/>`,
                    `</div>`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIStartWrapperFake">`,
                        `<span>Start Time</span>`,
                        `<input id="mmgisTimeUIStartFake" type="text"/>`,
                    `</div>`,
                    `<div id="mmgisTimeUITimeline">`,
                        `<div id="mmgisTimeUITimelineExtent"></div>`,
                        `<div id="mmgisTimeUITimelinePlayExtent"></div>`,
                        `<div id="mmgisTimeUITimelineHisto"></div>`,
                        `<div id="mmgisTimeUITimelineInner"></div>`,
                        `<div id='mmgisTimeUITimelineSlider' class='svelteSlider'></div>`,
                    `</div>`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIEndWrapper">`,
                        `<span>Active Time</span>`,
                        `<input id="mmgisTimeUIEnd"/>`,
                    `</div>`,
                    `<div class="mmgisTimeUIInput" id="mmgisTimeUIEndWrapperFake">`,
                        `<span>Active Time</span>`,
                        `<input id="mmgisTimeUIEndFake" type="text"/>`,
                    `</div>`,
                `</div>`,
                `<div id="mmgisTimeUIActionsRight">`,
                    `<div id="mmgisTimeUIFitTime" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-calendar-expand-horizontal mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mmgisTimeUIFitWindow" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-calendar-clock mdi-24px'></i>`,
                    `</div>`,
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

        // prettier-ignore
        const playPopoverMarkup = [
            `<div id="timeUIPlayPopover">`,
                `<div id='mmgisTimeUIStepWithinBeyond'>`,
                    `<div>Mode</div>`,
                    `<div id='mmgisTimeUIStepWithinBeyondDropdown' class='ui dropdown short'></div>`,
                `</div>`,
                `<div id='mmgisTimeUIStep'>`,
                    `<div>Step</div>`,
                    `<div style="display: flex;">`,
                        `<input id='mmgisTimeUIRateInput' type="number" min="0" max="99" step="0.5" value="1" default="1" placeholder="1">`,
                        `<div id='mmgisTimeUIStepDropdown' class='ui dropdown short'></div>`,
                    `</div>`,
                `</div>`,
                `<div id='mmgisTimeUIRate'>`,
                    `<div>Every</div>`,
                    `<div id='mmgisTimeUIRateDropdown' class='ui dropdown short'></div>`,
                `</div>`,
                
                `<div id="mmgisTimeUIPopoverBottom">`,
                    `<div id="mmgisTimeUIPlay" class="mmgisTimeUIButton">`,
                        `<i class='mdi mdi-play mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mmgisTimeUIBottomPrevious" class="mmgisTimeUIButton" style="display: none;">`,
                        `<i class='mdi mdi-chevron-left mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mmgisTimeUIBottomNext" class="mmgisTimeUIButton" style="display: none;">`,
                        `<i class='mdi mdi-chevron-right mdi-24px'></i>`,
                    `</div>`,
                `</div>`,
            `</div>`,
        ].join('\n')

        d3.select('#splitscreens')
            .append('div')
            .attr('id', 'timeUI')
            .html(markup)

        d3.select('body')
            .append('div')
            .attr('id', 'timeUIPlayPopover_global')
            .html(playPopoverMarkup)

        TimeUI.attachEvents()

        return TimeUI
    },
    getElement: function () {},
    getDateAdditionalSeconds: function (d) {
        let dateString = d
        let opMult = 1
        let additionalSeconds = 0
        if (typeof dateString === 'string') {
            const indexPlus = dateString.indexOf(' + ')
            const indexMinus = dateString.indexOf(' - ')
            if (indexPlus > -1 || indexMinus > -1) {
                if (indexMinus > indexPlus) opMult = -1
                const initialendSplit = dateString.split(
                    ` ${opMult === 1 ? '+' : '-'} `
                )
                dateString = initialendSplit[0]
                additionalSeconds = parseInt(initialendSplit[1]) || 0
                additionalSeconds = isNaN(additionalSeconds)
                    ? 0
                    : additionalSeconds
            }
            additionalSeconds *= opMult
        }
        return { dateString, additionalSeconds }
    },
    alignPopovers(e) {
        if (e == null) {
            let bcr = $(`#mmgisTimeUIPlayTrigger`)
                .get(0)
                .getBoundingClientRect()
            $(`#timeUIPlayPopover`).css({
                position: 'fixed',
                left: bcr.left,
                right: bcr.right,
                bottom: 40,
            })
        } else {
            setTimeout(() => {
                TimeUI.alignPopovers()
            }, 200)
        }
    },
    attachEvents: function (timeChange) {
        TimeUI._startingModeIndex = TimeUI.modeIndex
        // Set modeIndex to 1/Point if a deeplink had an endtime but no starttime
        if (L_.FUTURES.startTime == null && L_.FUTURES.endTime != null)
            TimeUI._startingModeIndex = 1

        document.addEventListener('toolChange', TimeUI.alignPopovers)

        // Popovers
        $(`#mmgisTimeUIPlayTrigger`).on('click', () => {
            const pop = $(`#timeUIPlayPopover`)
            const willOpen = pop.css('display') === 'none'

            pop.css({
                display: willOpen ? 'block' : 'none',
            })
            $(`#mmgisTimeUIPlayTrigger`).css({
                color: willOpen ? 'var(--color-c)' : 'var(--color-a5)',
            })
            if (willOpen) {
                $('#mmgisTimeUIPlayTrigger > i')
                    .removeClass('mdi-movie')
                    .addClass('mdi-movie-open')
                TimeUI._popoverPlayOpen = true
                TimeUI.alignPopovers()
            } else {
                $('#mmgisTimeUIPlayTrigger > i')
                    .removeClass('mdi-movie-open')
                    .addClass('mdi-movie')
                TimeUI._popoverPlayOpen = false
            }
        })

        // Timeline pan and zoom
        // zoom
        $('#mmgisTimeUITimelineInner').on('wheel', function (e) {
            if (TimeUI.play) return
            const x = e.originalEvent.offsetX
            const width = document
                .getElementById('mmgisTimeUITimelineInner')
                .getBoundingClientRect().width
            // As opposed to per-cent
            const perun = x / width
            const direction = e.originalEvent.deltaY > 0 ? 1 : -1
            const AMOUNT = 0.07
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

            clearTimeout(TimeUI._zoomHistoTimeout)
            $('#mmgisTimeUITimelineHisto').empty()
            TimeUI._zoomHistoTimeout = setTimeout(() => {
                TimeUI._makeHistogram()
            }, 3000)
        })

        // pan
        $('#mmgisTimeUITimelineInner').on('mousedown', function (e) {
            if (TimeUI.play) {
                TimeUI._timelineDragging = false
                return
            }
            TimeUI._timelineDragging = true
            $('#mmgisTimeUITimelineSlider').css({ pointerEvents: 'none' })
            TimeUI._lastDragPageX = e.originalEvent.pageX
            $('body').on('mousemove', TimeUI._timelineDrag)
        })
        $('body').on('mouseup', function () {
            if (TimeUI._timelineDragging === true) {
                $('#mmgisTimeUITimelineSlider').css({
                    pointerEvents: 'inherit',
                })
                $('#mmgisTimeUITimelineInner').off('body', TimeUI._timelineDrag)
                TimeUI._lastDragPageX = 0
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
                    TimeUI.startTempus.dontChangeNext,
                    null,
                    e.oldDate != null
                )
                TimeUI.startTempusSavedLastDate = e.date
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
                    TimeUI.endTempus.dontChangeNext,
                    e.oldDate != null
                )
                TimeUI.endTempusSavedLastDate = e.date

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
        tippy('#mmgisTimeUIPlayTrigger', {
            content: 'Play',
            placement: 'top',
            theme: 'blue',
        })

        tippy('#mmgisTimeUIPlay', {
            content: 'Play / Pause',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIFitTime', {
            content: 'Fit Time to Time-Window',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIFitWindow', {
            content: 'Fit Time-Window to Time',
            placement: 'top',
            theme: 'blue',
        })
        tippy('#mmgisTimeUIPresent', {
            content: 'Present',
            placement: 'top',
            theme: 'blue',
        })

        if (L_.configData.time?.startInPointMode == true) {
            TimeUI.modeIndex = TimeUI.modes.indexOf('Point')
            TimeUI._startingModeIndex = TimeUI.modes.indexOf('Point')
        }
        // Mode dropdown
        $('#mmgisTimeUIModeDropdown').html(
            Dropy.construct(TimeUI.modes, 'Mode', TimeUI._startingModeIndex, {
                openUp: true,
                dark: true,
            })
        )

        Dropy.init($('#mmgisTimeUIModeDropdown'), TimeUI.changeMode)

        // Step WithinBeyond dropdown
        $('#mmgisTimeUIStepWithinBeyondDropdown').html(
            Dropy.construct(
                ['Playback', 'Shift'],
                'Mode',
                TimeUI.stepWithinBeyondIndex,
                {
                    openUp: true,
                    dark: true,
                }
            )
        )
        Dropy.init($('#mmgisTimeUIStepWithinBeyondDropdown'), function (idx) {
            TimeUI.stepWithinBeyondIndex = idx
            if (idx === 0) {
                $('#mmgisTimeUIPlay').css('display', 'block')
                $('#mmgisTimeUIRate').css('display', 'flex')
                $('#mmgisTimeUIBottomPrevious').css('display', 'none')
                $('#mmgisTimeUIBottomNext').css('display', 'none')
            } else if (idx === 1) {
                $('#mmgisTimeUIPlay').css('display', 'none')
                $('#mmgisTimeUIRate').css('display', 'none')
                $('#mmgisTimeUIBottomPrevious').css('display', 'block')
                $('#mmgisTimeUIBottomNext').css('display', 'block')
            }
            TimeUI._refreshIntervals()
        })
        // Step dropdown
        $('#mmgisTimeUIStepDropdown').html(
            Dropy.construct(
                Object.keys(MS).map((k) => `${k.capitalizeFirstLetter()}`),
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

        // Interval Duration dropdown
        $('#mmgisTimeUIIntervalDurationDropdown').html(
            Dropy.construct(
                Object.keys(MS).map((k) => `1 ${k.capitalizeFirstLetter()}`),
                'Step',
                TimeUI.stepIndex,
                {
                    openUp: true,
                    dark: true,
                }
            )
        )
        Dropy.init($('#mmgisTimeUIIntervalDurationDropdown'), function (idx) {
            TimeUI.stepIndex = idx
            TimeUI._refreshIntervals()
        })
        // Interval Step dropdown
        $('#mmgisTimeUIIntervalStepDropdown').html(
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
        Dropy.init($('#mmgisTimeUIIntervalStepDropdown'), function (idx) {
            TimeUI.intervalIndex = idx
            TimeUI._refreshIntervals()
        })

        let dateAddSec = null

        // Initial end
        if (L_.FUTURES.endTime != null) {
            L_.configData.time.initialend = L_.FUTURES.endTime
        }

        // parse formats like "2024-03-04T14:05:00Z + 10000000" for relative times
        dateAddSec = TimeUI.getDateAdditionalSeconds(
            L_.configData.time.initialend
        )
        if (
            L_.configData.time.initialend != null &&
            L_.configData.time.initialend != 'now'
        ) {
            const dateStaged = new Date(dateAddSec.dateString)
            if (dateStaged == 'Invalid Date') {
                TimeUI._initialEnd = new Date()
                console.warn(
                    "Invalid 'Initial End Time' provided. Defaulting to 'now'."
                )
            } else TimeUI._initialEnd = dateStaged
        } else TimeUI._initialEnd = new Date()
        TimeUI._initialEnd.setSeconds(
            TimeUI._initialEnd.getSeconds() + dateAddSec.additionalSeconds
        )

        if (
            L_.configData.time.initialwindowend != null &&
            L_.configData.time.initialwindowend != 'now'
        ) {
            // parse formats like "2024-03-04T14:05:00Z + 10000000" for relative times
            dateAddSec = TimeUI.getDateAdditionalSeconds(
                L_.configData.time.initialwindowend
            )
            const dateStaged = new Date(dateAddSec.dateString)
            if (dateStaged == 'Invalid Date') {
                TimeUI._timelineEndTimestamp = new Date()
                console.warn(
                    "Invalid 'Initial Window End Time' provided. Defaulting to 'now'."
                )
            } else {
                dateStaged.setSeconds(
                    dateStaged.getSeconds() + dateAddSec.additionalSeconds
                )
                TimeUI._timelineEndTimestamp = dateStaged.getTime()
            }
        }

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
            // parse formats like "2024-03-04T14:05:00Z + 10000000" for relative times
            dateAddSec = TimeUI.getDateAdditionalSeconds(
                L_.configData.time.initialstart
            )

            const dateStaged = new Date(dateAddSec.dateString)
            if (dateStaged == 'Invalid Date') {
                TimeUI._initialStart.setUTCMonth(
                    TimeUI._initialStart.getUTCMonth() - 1
                )
                console.warn(
                    "Invalid 'Initial Start Time' provided. Defaulting to 1 month before the end time."
                )
            } else {
                dateStaged.setSeconds(
                    dateStaged.getSeconds() + dateAddSec.additionalSeconds
                )
                if (dateStaged.getTime() > TimeUI._initialEnd.getTime()) {
                    TimeUI._initialStart.setUTCMonth(
                        TimeUI._initialStart.getUTCMonth() - 1
                    )
                    console.warn(
                        "'Initial Start Time' cannot be later than the end time. Defaulting to 1 month before the end time."
                    )
                } else TimeUI._initialStart = dateStaged
            }
        }

        // Initial Timeline window start
        if (L_.configData.time.initialwindowstart != null) {
            // parse formats like "2024-03-04T14:05:00Z + 10000000" for relative times
            dateAddSec = TimeUI.getDateAdditionalSeconds(
                L_.configData.time.initialwindowstart
            )

            const dateStaged = new Date(dateAddSec.dateString)
            if (dateStaged == 'Invalid Date') {
                console.warn("Invalid 'Initial Window Start Time' provided.")
            } else {
                dateStaged.setSeconds(
                    dateStaged.getSeconds() + dateAddSec.additionalSeconds
                )
                if (
                    TimeUI._timelineEndTimestamp == null ||
                    dateStaged.getTime() > TimeUI._timelineEndTimestamp
                ) {
                    console.warn(
                        "'Initial Window Start Time' cannot be later than the Initial Window End Time."
                    )
                } else TimeUI._timelineStartTimestamp = dateStaged.getTime()
            }
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

        const offsetEndDate = TimeUI.addOffset(date.getTime())
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

        const offsetStartDate = TimeUI.addOffset(date.getTime())
        const parsedStart = TimeUI.startTempus.dates.parseInput(
            new Date(offsetStartDate)
        )
        TimeUI.startTempus.dates.setValue(parsedStart)

        $('#mmgisTimeUIPlay').on('click', TimeUI.togglePlay)
        $('#mmgisTimeUIBottomPrevious').on('click', TimeUI.stepPrevious)
        $('#mmgisTimeUIBottomNext').on('click', TimeUI.stepNext)
        $('#mmgisTimeUIFitTime').on('click', TimeUI.fitTimeToWindow)
        $('#mmgisTimeUIFitWindow').on('click', TimeUI.fitWindowToTime)
        $('#mmgisTimeUIPresent').on('click', TimeUI.toggleTimeNow)

        TimeUI._remakeTimeSlider()
        TimeUI._setCurrentTime(true, savedEndDate)

        if (TimeUI.enabled) {
            TimeUI._makeHistogram()
        }

        if (L_.configData.time?.startInPointMode == true)
            TimeUI.changeMode(TimeUI.modes.indexOf('Point'))
        // Set modeIndex to 1/Point if a deeplink had an endtime but no starttime
        else if (TimeUI.modeIndex != TimeUI._startingModeIndex)
            TimeUI.changeMode(TimeUI._startingModeIndex)
    },
    changeMode(idx) {
        TimeUI.modeIndex = idx
        if (TimeUI.modes[TimeUI.modeIndex] === 'Point') {
            $('#mmgisTimeUIStartWrapper').css({ display: 'none' })
            // Remove end date enforcement
            TimeUI.endTempus.updateOptions({
                restrictions: {
                    minDate: new Date(0),
                },
            })
            TimeUI._savedRangeModeStartTime = TimeUI._startTimestamp
            TimeUI.updateTimes(TimeUI.removeOffset(0), null, null)
            $('#mmgisTimeUITimelineExtent').css('opacity', 0)
        } else {
            $('#mmgisTimeUIStartWrapper').css({ display: 'inherit' })
            // Reinforce min date
            TimeUI.endTempus.updateOptions({
                restrictions: {
                    minDate: TimeUI.startTempusSavedLastDate,
                },
            })
            if (TimeUI._savedRangeModeStartTime != null)
                TimeUI.updateTimes(
                    TimeUI.removeOffset(TimeUI._savedRangeModeStartTime),
                    null,
                    null
                )
            if (TimeUI._startTimestamp >= TimeUI._endTimestamp) {
                const offsetStartDate = new Date(TimeUI._endTimestamp)
                const parsedStart = TimeUI.startTempus.dates.parseInput(
                    new Date(offsetStartDate)
                )
                TimeUI.startTempus.dates.setValue(parsedStart)
            }
            $('#mmgisTimeUITimelineExtent').css('opacity', 1)
        }
        TimeUI._remakeTimeSlider(true)
    },
    stepPrevious() {
        TimeUI._loopTime(true)
        if (TimeUI.modes[TimeUI.modeIndex] === 'Range')
            TimeUI.fitWindowToTime(true)
    },
    stepNext() {
        TimeUI._loopTime()
        if (TimeUI.modes[TimeUI.modeIndex] === 'Range')
            TimeUI.fitWindowToTime(true)
    },
    togglePlay(force, butDontActuallyPlay, dontRedrawExtent) {
        const mode = TimeUI.modes[TimeUI.modeIndex]
        if (TimeUI.play || force === false) {
            $('#mmgisTimeUIPlay')
                .css('background', '')
                .css('color', 'var(--color-a5)')
            $('#mmgisTimeUIPlay > i')
                .removeClass('mdi-pause')
                .addClass('mdi-play')

            $('#mmgisTimeUITimelineExtent').css('opacity', 1)
            $('#mmgisTimeUITimelinePlayExtent').css('opacity', 0)
            TimeUI.play = false

            // Don't reposition active time on Stop for Point Mode
            if (mode === 'Point') {
                TimeUI._savedPlayEnd = null
            }

            // But do for Range Mode
            if (TimeUI._savedPlayEnd != null) {
                TimeUI.setCurrentTime(TimeUI._savedPlayEnd)
                TimeUI._remakeTimeSlider(true)
                TimeUI._savedPlayEnd = null
            }
        } else {
            $('#mmgisTimeUIPlay')
                .css('background', 'var(--color-p4)')
                .css('color', 'white')

            $('#mmgisTimeUIPlay > i')
                .removeClass('mdi-play')
                .addClass('mdi-pause')
            TimeUI.play = true
            TimeUI._savedPlayEnd = TimeUI.getCurrentTimestamp()
            TimeUI.now = false

            if (
                (dontRedrawExtent !== true ||
                    $('#mmgisTimeUITimelinePlayExtent').css('opacity') !==
                        '1') &&
                TimeUI.stepWithinBeyondIndex !== 1
            ) {
                $('#mmgisTimeUITimelineExtent').css('opacity', 0)
                if (mode === 'Point') {
                    $('#mmgisTimeUITimelinePlayExtent')
                        .css('opacity', 1)
                        .css('width', `100%`)
                        .css('left', `0px`)
                } else {
                    const timelineBCR = document
                        .getElementById('mmgisTimeUITimeline')
                        .getBoundingClientRect()
                    const left = F_.linearScale(
                        [
                            TimeUI._timelineStartTimestamp,
                            TimeUI._timelineEndTimestamp,
                        ],
                        [0, timelineBCR.width],
                        TimeUI.removeOffset(TimeUI._startTimestamp)
                    )
                    const right = F_.linearScale(
                        [
                            TimeUI._timelineStartTimestamp,
                            TimeUI._timelineEndTimestamp,
                        ],
                        [0, timelineBCR.width],
                        TimeUI.removeOffset(TimeUI._savedPlayEnd)
                    )
                    $('#mmgisTimeUITimelinePlayExtent')
                        .css('opacity', 1)
                        .css(
                            'width',
                            `${((right - left) / timelineBCR.width) * 100}%`
                        )
                        .css('left', `${(left / timelineBCR.width) * 100}%`)
                }
            }

            $('#mmgisTimeUIPresent')
                .css('background', '')
                .css('color', 'var(--color-a4)')
            $('#mmgisTimeUIEnd').css('pointer-events', 'inherit')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'inherit')
        }
        if (butDontActuallyPlay !== true) TimeUI._refreshIntervals()
    },
    _updateExtentIndicator(forceStartTimestamp, forceEndTimestamp) {
        if (TimeUI.play) return

        const mode = TimeUI.modes[TimeUI.modeIndex]

        if (mode === 'Point') {
        } else {
            const timelineBCR = document
                .getElementById('mmgisTimeUITimeline')
                .getBoundingClientRect()
            const left = F_.linearScale(
                [TimeUI._timelineStartTimestamp, TimeUI._timelineEndTimestamp],
                [0, timelineBCR.width],
                TimeUI.removeOffset(
                    forceStartTimestamp != null
                        ? forceStartTimestamp
                        : TimeUI._startTimestamp
                )
            )
            const right = F_.linearScale(
                [TimeUI._timelineStartTimestamp, TimeUI._timelineEndTimestamp],
                [0, timelineBCR.width],
                TimeUI.removeOffset(
                    forceEndTimestamp != null
                        ? forceEndTimestamp
                        : TimeUI._endTimestamp
                )
            )
            $('#mmgisTimeUITimelineExtent')
                .css('opacity', 1)
                .css('width', `${((right - left) / timelineBCR.width) * 100}%`)
                .css('left', `${(left / timelineBCR.width) * 100}%`)
        }
    },
    _refreshIntervals() {
        clearInterval(TimeUI.playInterval)
        if (TimeUI.play) {
            TimeUI._loopTime()
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
    _loopTime(loopBackwards) {
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
        const change =
            (loopBackwards === true ? -1 : 1) *
            (MS[Object.keys(MS)[TimeUI.stepIndex]] *
                parseFloat($('#mmgisTimeUIRateInput').val() || 1))

        let next = current + change

        if (TimeUI.stepWithinBeyondIndex === 0 || mode === 'Point') {
            if (mode === 'Point' && TimeUI.play !== true) {
                // Just push point in time forward
                TimeUI.updateTimes(null, TimeUI.removeOffset(next), next)
            } else {
                // Otherwise, keep within the time window for playback
                if (next > end) next = end
                if (current === end) next = start

                if (mode === 'Range') TimeUI.setCurrentTime(next)
                if (mode === 'Point')
                    TimeUI.setCurrentTime(next, null, null, true)
            }

            TimeUI._remakeTimeSlider(true)
        } else {
            let nextStart = TimeUI._startTimestamp + change
            TimeUI.updateTimes(
                TimeUI.removeOffset(nextStart),
                TimeUI.removeOffset(next),
                null
            )
        }
    },
    fitTimeToWindow() {
        let nextStart
        let nextEnd

        nextStart =
            TimeUI._timelineEndTimestamp != null
                ? TimeUI._timelineStartTimestamp
                : 0
        nextEnd =
            TimeUI._timelineStartTimestamp != null
                ? TimeUI.addOffset(TimeUI._timelineEndTimestamp)
                : 100

        TimeUI.updateTimes(nextStart, nextEnd, nextEnd)
    },
    fitWindowToTime(fitOnlyIfOutOfRange) {
        const rangeMode =
            TimeUI.modes[TimeUI.modeIndex] === 'Range' ? true : false

        let nextStart
        let nextEnd
        if (rangeMode) {
            // Match window edges exactly with time range
            nextStart = TimeUI.removeOffset(TimeUI._startTimestamp)
            nextEnd = TimeUI.removeOffset(TimeUI.getCurrentTimestamp())
        } else {
            // Adjust window such that Point is in its center
            const existingMin =
                TimeUI._timelineEndTimestamp != null
                    ? TimeUI._timelineStartTimestamp
                    : 0
            const existingMax =
                TimeUI._timelineStartTimestamp != null
                    ? TimeUI._timelineEndTimestamp
                    : 100
            const buffer = parseInt((existingMax - existingMin) / 2)

            nextStart = TimeUI.removeOffset(
                TimeUI.getCurrentTimestamp() - buffer
            )
            nextEnd = TimeUI.removeOffset(TimeUI.getCurrentTimestamp() + buffer)
        }
        if (fitOnlyIfOutOfRange === true) {
            if (TimeUI._timelineStartTimestamp < nextStart) {
                nextStart = null
            }
            if (TimeUI._timelineEndTimestamp > nextEnd) {
                nextEnd = null
            }
        }

        TimeUI._drawTimeLine(nextStart, nextEnd)

        clearTimeout(TimeUI._panHistoTimeout)
        $('#mmgisTimeUITimelineHisto').empty()
        TimeUI._makeHistogram()
    },
    toggleTimeNow(force) {
        if ((!TimeUI.now && typeof force != 'boolean') || force === true) {
            $('#mmgisTimeUIPresent')
                .css('background', 'var(--color-p4)')
                .css('color', 'white')
            $('#mmgisTimeUIEnd').css('pointer-events', 'none')
            $('#mmgisTimeUIEndWrapper').css('cursor', 'not-allowed')
            TimeUI.now = true
            TimeUI.togglePlay(false)
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
            TimeUI.timeSlider.$destroy()
            TimeUI.timeSlider = null
            $('#mmgisTimeUITimelineSlider').empty()
            if (rangeMode) $('#mmgisTimeUITimelineSlider').addClass('rangeMode')
            else $('#mmgisTimeUITimelineSlider').removeClass('rangeMode')
        }

        if (
            TimeUI._timelineStartTimestamp == null ||
            TimeUI._timelineEndTimestamp == null
        )
            return

        TimeUI._updateExtentIndicator()

        TimeUI.timeSlider = new RangeSliderPips({
            target: document.querySelector('#mmgisTimeUITimelineSlider'),
            props: {
                values: rangeMode
                    ? [
                          TimeUI.removeOffset(TimeUI._startTimestamp),
                          TimeUI.removeOffset(TimeUI.getCurrentTimestamp()),
                      ]
                    : [TimeUI.removeOffset(TimeUI.getCurrentTimestamp())],
                pips: false,
                min:
                    TimeUI._timelineEndTimestamp != null
                        ? TimeUI._timelineStartTimestamp
                        : 0,
                max:
                    TimeUI._timelineStartTimestamp != null
                        ? TimeUI._timelineEndTimestamp
                        : 100,
                range: rangeMode,
                pushy: false,
                float: false,
                springValues: {
                    stiffness: 0.15,
                    damping: 0.4,
                },
                handleFormatter: (v) => {
                    return moment.utc(TimeUI.removeOffset(v)).format(FORMAT)
                },
            },
        })
        TimeUI.timeSlider.$on('start', (e) => {
            TimeUI.toggleTimeNow(false)
            if (TimeUI.play) {
                TimeUI._savedPlayEnd = null
                TimeUI.togglePlay(false)
            }
            TimeUI._updateExtentIndicator()
        })
        TimeUI.timeSlider.$on('change', (e) => {
            let idx = 0
            if (TimeUI.modes[TimeUI.modeIndex] === 'Point') idx -= 1
            const date = new Date(e.detail.value)
            const offsetNowDate = TimeUI.addOffset(date.getTime())
            if (e.detail.activeHandle === idx) {
                $('#mmgisTimeUIStartWrapperFake').css('display', 'block')
                $('#mmgisTimeUIStartFake').val(
                    moment
                        .utc(TimeUI.removeOffset(offsetNowDate))
                        .format(FORMAT)
                )
                TimeUI._updateExtentIndicator(
                    moment.utc(TimeUI.removeOffset(offsetNowDate))
                )
            }
            if (e.detail.activeHandle === idx + 1) {
                $('#mmgisTimeUIEndWrapperFake').css('display', 'block')
                $('#mmgisTimeUIEndFake').val(
                    moment
                        .utc(TimeUI.removeOffset(offsetNowDate))
                        .format(FORMAT)
                )
                TimeUI._updateExtentIndicator(
                    null,
                    moment.utc(TimeUI.removeOffset(offsetNowDate))
                )
            }
        })
        TimeUI.timeSlider.$on('stop', (e) => {
            $('#mmgisTimeUIStartWrapperFake').css('display', 'none')
            $('#mmgisTimeUIEndWrapperFake').css('display', 'none')

            let idx = 0
            if (TimeUI.modes[TimeUI.modeIndex] === 'Point') idx -= 1

            const date = new Date(e.detail.value)
            const offsetNowDate = TimeUI.addOffset(date.getTime())
            if (e.detail.activeHandle === idx) {
                const parsedNow = TimeUI.startTempus.dates.parseInput(
                    new Date(offsetNowDate)
                )
                TimeUI.startTempus.dates.setValue(parsedNow)
            }
            if (e.detail.activeHandle === idx + 1) {
                const parsedNow = TimeUI.endTempus.dates.parseInput(
                    new Date(offsetNowDate)
                )
                TimeUI.endTempus.dates.setValue(parsedNow)
            }
            TimeUI._updateExtentIndicator()
        })

        if ($('#toggleTimeUI').hasClass('active') && ignoreHistogram !== true)
            TimeUI._makeHistogram()
    },
    _makeHistogram() {
        const startTimestamp = TimeUI.removeOffset(
            TimeUI._timelineStartTimestamp
        )
        const endTimestamp = TimeUI.removeOffset(TimeUI._timelineEndTimestamp)

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
        Object.keys(L_.layers.data).forEach((name) => {
            const l = L_.layers.data[name]
            if (
                l &&
                l.type === 'tile' &&
                l.time &&
                l.time.enabled === true &&
                L_.layers.on[name] === true
            ) {
                let layerUrl = l.url
                if (layerUrl.indexOf('stac-collection:') === 0) {
                    sparklineLayers.push({
                        name: name,
                        stacCollection: layerUrl.replace(
                            'stac-collection:',
                            ''
                        ),
                    })
                } else if (!F_.isUrlAbsolute(layerUrl)) {
                    layerUrl = L_.missionPath + layerUrl
                    if (layerUrl.indexOf('{t}') > -1)
                        sparklineLayers.push({
                            name: name,
                            path: `/${layerUrl}`.replace(/{t}/g, '_time_'),
                        })
                }
            }
        })

        const starttimeISO = new Date(
            TimeUI._timelineStartTimestamp
        ).toISOString()

        const endtimeISO = new Date(TimeUI._timelineEndTimestamp).toISOString()

        const NUM_BINS = Math.max(
            Math.min(endTimestamp - startTimestamp, 255),
            1
        )
        let bins = new Array(NUM_BINS).fill(0)
        let numBins = 0

        sparklineLayers.forEach((l) => {
            calls.api(
                'query_tileset_times',
                l.stacCollection != null
                    ? {
                          stacCollection: l.stacCollection,
                          starttime: starttimeISO,
                          endtime: endtimeISO,
                      }
                    : {
                          path: l.path,
                          starttime: starttimeISO,
                          endtime: endtimeISO,
                      },
                function (data) {
                    if (data.body && data.body.times) {
                        if (l.stacCollection != null) {
                            for (let i = 0; i < NUM_BINS; i++) {
                                bins[i] = Math.floor(
                                    F_.linearScale(
                                        [0, NUM_BINS],
                                        [
                                            TimeUI._timelineStartTimestamp,
                                            TimeUI._timelineEndTimestamp,
                                        ],
                                        i
                                    )
                                )
                            }

                            const nextBins = []
                            let ti = 0
                            for (let bi = 1; bi < bins.length; bi++) {
                                nextBins[bi - 1] = 0
                                while (
                                    data.body.times[ti] &&
                                    new Date(data.body.times[ti].t).getTime() >=
                                        bins[bi - 1] &&
                                    new Date(data.body.times[ti].t).getTime() <
                                        bins[bi]
                                ) {
                                    nextBins[bi - 1] += parseInt(
                                        data.body.times[ti].total
                                    )
                                    ti++
                                }
                            }
                            bins = nextBins
                            numBins = bins.length
                        } else {
                            data.body.times.forEach((time) => {
                                bins[
                                    Math.floor(
                                        F_.linearScale(
                                            [startTimestamp, endTimestamp],
                                            [0, NUM_BINS],
                                            TimeUI.removeOffset(
                                                new Date(time.t).getTime()
                                            )
                                        )
                                    )
                                ]++
                            })
                            numBins = NUM_BINS
                        }

                        const minmax = F_.getMinMaxOfArray(bins)

                        const histoElm = $('#mmgisTimeUITimelineHisto')
                        histoElm.empty()
                        if (minmax.max > 0)
                            bins.forEach((b) => {
                                histoElm.append(
                                    `<div style="width:${
                                        (1 / numBins) * 100
                                    }%; opacity:${
                                        (b > 0 ? 20 : 0) + (b / minmax.max) * 80
                                    }%;"></div>`
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
            const offsetNowDate = TimeUI.addOffset(date.getTime())
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
        let offsetStartDate = null
        let parsedStart = null
        if (start != null) {
            date = new Date(start)
            offsetStartDate = TimeUI.addOffset(date)
            parsedStart = TimeUI.startTempus.dates.parseInput(
                new Date(offsetStartDate)
            )
        }
        // End
        let offsetEndDate = null
        let parsedEnd = null
        if (end != null) {
            date = new Date(end)
            offsetEndDate = TimeUI.addOffset(date)
            parsedEnd = TimeUI.endTempus.dates.parseInput(
                new Date(offsetEndDate)
            )
        }

        if (parsedStart != null && parsedEnd != null) {
            if (offsetStartDate.getTime() > offsetEndDate.getTime()) {
                console.warn(
                    `updateTimes: Cannot set start time after end time. ${parsedStart} > ${parsedEnd}`
                )
                return false
            }
        }

        if (parsedStart != null) {
            TimeUI.endTempus.updateOptions({
                restrictions: {
                    minDate: parsedStart,
                },
            })
        }
        if (parsedEnd != null) {
            TimeUI.startTempus.updateOptions({
                restrictions: {
                    maxDate: parsedEnd,
                },
            })
        }

        if (parsedStart) {
            TimeUI.startTempus.dontChangeNext = true
            TimeUI.startTempus.dates.setValue(parsedStart)
        }
        if (parsedEnd) {
            TimeUI.endTempus.dontChangeNext = true
            TimeUI.endTempus.dates.setValue(parsedEnd)
        }

        // Current
        if (current != null) {
            TimeUI.setCurrentTime(current, true)
            TimeUI._remakeTimeSlider(true)
        }

        TimeUI.change()
        return true
    },
    setStartTime(
        ISOString,
        disableChange,
        dontRedrawTimeline,
        andMatchTimeline
    ) {
        const timestamp = Date.parse(ISOString)
        TimeUI._startTimestamp = timestamp
        if (TimeUI._timelineStartTimestamp == null)
            TimeUI._timelineStartTimestamp = TimeUI.removeOffset(
                TimeUI._startTimestamp
            )

        if (dontRedrawTimeline != true)
            TimeUI._drawTimeLine(
                andMatchTimeline
                    ? TimeUI.removeOffset(TimeUI._startTimestamp)
                    : null
            )
        if (disableChange != true) TimeUI.change()
    },
    addOffset(timestamp) {
        const utcDate = new Date(timestamp)
        return new Date(
            utcDate.getUTCFullYear(),
            utcDate.getUTCMonth(),
            utcDate.getUTCDate(),
            utcDate.getUTCHours(),
            utcDate.getUTCMinutes(),
            utcDate.getUTCSeconds(),
            utcDate.getUTCMilliseconds()
        )
    },
    removeOffset(timestamp) {
        const localDate = new Date(timestamp)
        return new Date(
            Date.UTC(
                localDate.getFullYear(),
                localDate.getMonth(),
                localDate.getDate(),
                localDate.getHours(),
                localDate.getMinutes(),
                localDate.getSeconds(),
                localDate.getMilliseconds()
            )
        )
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
    setEndTime(ISOString, disableChange, andMatchTimeline) {
        const sliderFixedToEnd =
            TimeUI._endTimestamp === TimeUI.getCurrentTimestamp()
        const timestamp = Date.parse(ISOString)
        TimeUI._endTimestamp = timestamp

        if (TimeUI._timelineEndTimestamp == null)
            TimeUI._timelineEndTimestamp = TimeUI.removeOffset(
                TimeUI._endTimestamp
            )

        TimeUI._drawTimeLine(
            null,
            andMatchTimeline ? TimeUI.removeOffset(TimeUI._endTimestamp) : null
        )

        if (sliderFixedToEnd) {
            TimeUI._timeSliderTimestamp = TimeUI._endTimestamp
            if (disableChange != true) TimeUI.change()
        }
    },
    setCurrentTime(
        ISOString,
        disableChange,
        dontRemoveOffset,
        ignoreDontChange
    ) {
        if (typeof ISOString === 'string') {
            TimeUI._timeSliderTimestamp = TimeUI.addOffset(ISOString)
        } else {
            TimeUI._timeSliderTimestamp = ISOString
        }

        if (TimeUI.play) {
            const date = new Date(TimeUI._timeSliderTimestamp)
            const offsetNowDate = new Date(date.getTime())
            const parsedNow = TimeUI.endTempus.dates.parseInput(
                new Date(offsetNowDate)
            )
            if (ignoreDontChange !== true)
                TimeUI.endTempus.dontChangeAnythingElse = true
            TimeUI.endTempus.dates.setValue(parsedNow)
        }

        if (disableChange != true) TimeUI.change()
    },
    change() {
        if (
            typeof TimeUI.timeChange === 'function' &&
            TimeUI._startTimestamp != null &&
            TimeUI._endTimestamp != null
        ) {
            const mode = TimeUI.modes[TimeUI.modeIndex]
            TimeUI.timeChange(
                new Date(
                    mode === 'Range'
                        ? TimeUI.removeOffset(TimeUI._startTimestamp)
                        : 0
                ).toISOString(),
                // use currentTime as endTime if in playmode
                TimeUI.play === true
                    ? new Date(TimeUI.getCurrentTimestamp(true)).toISOString()
                    : new Date(
                          TimeUI.removeOffset(TimeUI._endTimestamp)
                      ).toISOString(),
                new Date(TimeUI.getCurrentTimestamp(true)).toISOString()
            )
        }
    },
    _timelineDrag: function (e) {
        if (TimeUI._timelineDragging === true) {
            const nextPageX = e.originalEvent.pageX
            const dx = nextPageX - TimeUI._lastDragPageX
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

            clearTimeout(TimeUI._panHistoTimeout)
            $('#mmgisTimeUITimelineHisto').empty()
            TimeUI._panHistoTimeout = setTimeout(() => {
                TimeUI._makeHistogram()
            }, 3000)

            TimeUI._lastDragPageX = nextPageX
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
                        `<div class="mmgisTimeUITickLabel" id="mmgisTimeUITickLabel_${i}">${
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
