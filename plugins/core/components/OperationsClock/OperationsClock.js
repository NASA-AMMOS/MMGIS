/**
 * OperationsClock - Configurable interval-based time control
 *
 * Provides a flexible multi-button interface for time range selection:
 * - Past interval buttons (configurable count 0-10)
 * - [today] - Current day button with custom date picker
 * - Future interval buttons (configurable count 0-10)
 *
 * Features:
 * - Configurable interval buttons with custom counts
 * - Custom date selection via date picker
 * - Button tooltips showing exact date ranges
 * - Mobile responsive with dropdown mode
 * - Fixed bottom-center position, always visible
 * - Interfaces with TimeControl
 */

import TimeControl from '@basics/TimeControl_/TimeControl'
import L_ from '@basics/Layers_/Layers_'
import tippy from 'tippy.js'
import { TempusDominus, Namespace, DateTime } from '@eonasdan/tempus-dominus'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'
import './OperationsClock.css'

const OperationsClock = {
    // Component state
    state: {
        activeOffset: 0, // -N to +N (day interval mode)
        selectedToday: null, // Date object or null (null = real today)
        liveInterval: null,
        tippyInstances: [], // Store tippy instances for cleanup
        toolbarObserver: null, // Mobile toolbar position observer
        datePickerInstance: null, // TempusDominus instance
        effectiveToday: null, // The computed "today" based on config
    },

    // Configuration variables
    config: {
        pastUnit: 'week', // Used for -1 button label
        futureUnit: 'week', // Used for +1 button label
        pastInterval: 0,
        futureInterval: 0,
        liveRefreshInterval: 3600, // 1 hour - for updating tooltip dates
        useInitialStartTime: false, // Use Initial Start Time as "today"
    },

    /**
     * Initialize the component
     * @param {Object} vars - Configuration variables from Configure page
     */
    init: function (vars) {
        this.config.pastUnit = vars?.pastUnit || 'week'
        this.config.futureUnit = vars?.futureUnit || 'week'
        this.config.liveRefreshInterval = vars?.liveRefreshInterval || 3600
        this.config.useInitialStartTime = vars?.useInitialStartTime || false

        const pastInterval = vars?.pastInterval ?? 0
        const futureInterval = vars?.futureInterval ?? 0

        this.config.pastInterval = pastInterval
        this.config.futureInterval = futureInterval

        this.calculateEffectiveToday()

        this.createUI()

        if (TimeControl.subscribe) {
            TimeControl.subscribe('operationsClock', (timeData) => {
                this.onTimeChange(timeData)
            })
        }

        this.startLiveUpdates()
        this.setDayOffset(0) // Always start on today

        if (L_ && L_.UserInterface_ && L_.UserInterface_.isMobile === true) {
            this.setupMobilePositioning()
        }
    },


    /**
     * Format date as M/D/YYYY
     * @param {Date} date - Date object
     * @returns {string} Formatted date string (e.g., "1/26/2026")
     */
    formatDateSimple: function (date) {
        return (
            date.getMonth() +
            1 +
            '/' +
            date.getDate() +
            '/' +
            date.getFullYear()
        )
    },

    /**
     * Format time as HH:MM:SS AM/PM
     * @param {Date} date - Date object
     * @returns {string} Formatted time string (e.g., "8:02:47 PM")
     */
    formatTimeSimple: function (date) {
        let hours = date.getHours()
        const minutes = date.getMinutes()
        const seconds = date.getSeconds()
        const ampm = hours >= 12 ? 'PM' : 'AM'

        hours = hours % 12
        hours = hours ? hours : 12 // 0 should be 12

        return (
            hours +
            ':' +
            String(minutes).padStart(2, '0') +
            ':' +
            String(seconds).padStart(2, '0') +
            ' ' +
            ampm
        )
    },

    /**
     * Format date and time together
     * @param {Date} date - Date object
     * @returns {string} Formatted date and time (e.g., "1/26/2026 8:02:47 PM")
     */
    formatDateTime: function (date) {
        return this.formatDateSimple(date) // + ' ' + this.formatTimeSimple(date)
    },

    /**
     * Format date for display beneath today button
     * @param {Date} date - Date object
     * @returns {string} Formatted date (e.g., "Jan 26, 2026")
     */
    formatDateForDisplay: function (date) {
        const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ]
        return (
            months[date.getMonth()] +
            ' ' +
            date.getDate() +
            ', ' +
            date.getFullYear()
        )
    },

    /**
     * Get human-readable label for time unit
     * @param {string} unit - Time unit (e.g., "1week", "2day", "3hour")
     * @returns {string} Human-readable label (e.g., "1 week", "2 days", "3 hours")
     */
    getUnitLabel: function (unit) {
        // Try to parse number and unit (e.g., "2week" -> "2 weeks")
        const match = unit.match(/^(\d+)(hour|hr|day|week|month)s?$/)

        if (match) {
            const number = parseInt(match[1])
            let unitType = match[2]

            // Normalize unit names
            if (unitType === 'hr') unitType = 'hour'

            // Pluralize if needed
            const pluralUnit = number === 1 ? unitType : unitType + 's'

            return `${number} ${pluralUnit}`
        }

        // Fallback to legacy format map
        const labelMap = {
            '1hr': '1 hour',
            '6hr': '6 hours',
            '12hr': '12 hours',
            '24hr': '1 day',
            '3days': '3 days',
            '1week': '1 week',
            '2weeks': '2 weeks',
            '1month': '1 month',
        }

        return labelMap[unit] || '1 day'
    },

    /**
     * Parse a date string that may contain relative time offset
     * Format: "2024-03-04T14:05:00Z + 86400" or "2024-03-04T14:05:00Z - 3600"
     * Based on TimeUI.getDateAdditionalSeconds logic
     * @param {string} dateString - Date string possibly with " + N" or " - N" suffix
     * @returns {Object} { dateString, additionalSeconds }
     */
    parseRelativeTimeFormat: function (dateString) {
        let baseDateString = dateString
        let additionalSeconds = 0

        if (typeof dateString === 'string') {
            const indexPlus = dateString.indexOf(' + ')
            const indexMinus = dateString.indexOf(' - ')

            if (indexPlus > -1 || indexMinus > -1) {
                const opMult = indexMinus > indexPlus ? -1 : 1
                const dateSplit = dateString.split(` ${opMult === 1 ? '+' : '-'} `)
                baseDateString = dateSplit[0]
                additionalSeconds = parseInt(dateSplit[1]) || 0
                additionalSeconds = isNaN(additionalSeconds) ? 0 : additionalSeconds * opMult
            }
        }

        return { dateString: baseDateString, additionalSeconds }
    },

    /**
     * Calculate the effective "today" date based on configuration
     * If useInitialStartTime is enabled and TimeControl has an Initial Start Time,
     * use that as "today". Otherwise, use actual current date.
     */
    calculateEffectiveToday: function () {
        this.state.effectiveToday = null

        if (!this.config.useInitialStartTime) {
            return
        }

        // Check if TimeControl is enabled
        if (!L_?.configData?.time?.enabled) {
            console.info(
                '[OperationsClock] useInitialStartTime is enabled but TimeControl is not enabled. Using current date as today.'
            )
            return
        }

        // Check if Initial Start Time is configured
        if (!L_.configData?.time?.initialstart) {
            console.warn(
                '[OperationsClock] useInitialStartTime is enabled but no Initial Start Time is configured. Using current date as today.'
            )
            return
        }

        let initialStartTime = null

        try {
            // Parse the initial start time (handles relative formats like " + 86400")
            const { dateString, additionalSeconds } = this.parseRelativeTimeFormat(
                L_.configData.time.initialstart
            )

            const dateStaged = new Date(dateString)

            if (dateStaged.toString() === 'Invalid Date') {
                throw new Error(`Invalid date format: ${dateString}`)
            }

            // Apply additional seconds if present
            dateStaged.setSeconds(dateStaged.getSeconds() + additionalSeconds)
            initialStartTime = dateStaged
        } catch (err) {
            console.warn(
                '[OperationsClock] Failed to parse Initial Start Time:',
                err.message
            )
            return
        }

        // Normalize to midnight local time
        this.state.effectiveToday = new Date(
            initialStartTime.getFullYear(),
            initialStartTime.getMonth(),
            initialStartTime.getDate(),
            0,
            0,
            0
        )

        console.info(
            `[OperationsClock] Using Initial Start Time as today: ${this.formatDateForDisplay(
                this.state.effectiveToday
            )}`
        )
    },

    /**
     * Get the selected "today" date (custom, effective, or real)
     * Priority:
     * 1. User-selected custom date (via date picker)
     * 2. Effective today (Initial Start Time if configured)
     * 3. Actual current date
     * @returns {Date} The date to use as "today"
     */
    getSelectedToday: function () {
        // Priority 1: User has selected a custom date via date picker
        if (this.state.selectedToday) {
            return new Date(this.state.selectedToday)
        }

        // Priority 2: Use effective today (Initial Start Time) if configured
        if (this.state.effectiveToday) {
            return new Date(this.state.effectiveToday)
        }

        // Priority 3: Use actual current date
        return new Date()
    },

    /**
     * Get date range for a day offset from selected today
     * @param {number} offset - Interval offset (-3 to +3, etc.)
     * @returns {Object} {start: Date, end: Date}
     */
    getOffsetRange: function (offset) {
        const baseDate = this.getSelectedToday()

        if (offset === 0) {
            // Today only - single day
            const start = new Date(
                baseDate.getFullYear(),
                baseDate.getMonth(),
                baseDate.getDate(),
                0,
                0,
                0
            )
            const end = new Date(
                baseDate.getFullYear(),
                baseDate.getMonth(),
                baseDate.getDate(),
                23,
                59,
                59
            )
            return { start, end }
        }

        // Determine which unit to use based on offset direction
        const unit = offset < 0 ? this.config.pastUnit : this.config.futureUnit

        // Convert unit to days multiplier
        const unitToDays = {
            day: 1,
            week: 7,
            month: 30,
            year: 365,
        }

        const multiplier = unitToDays[unit] || 1

        // Calculate start day: offset tells us where to position the range
        const startDay = baseDate.getDate() + offset * multiplier

        // Calculate end day: range duration is always 1 unit
        const endDay = startDay + multiplier - 1

        const start = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            startDay,
            0,
            0,
            0
        )

        const end = new Date(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            endDay,
            23,
            59,
            59
        )

        return { start, end }
    },

    /**
     * Update the date display beneath the today button
     */
    updateDateDisplay: function () {
        const dateDiv = document.querySelector('.clock-today-date')
        const todayBtn = document.querySelector('.clock-btn-today span')
        if (!dateDiv) return

        const displayDate = this.getSelectedToday()
        const isUsingEffectiveToday = this.state.effectiveToday && !this.state.selectedToday
        const isUsingCustomDate = this.state.selectedToday

        if (isUsingCustomDate) {
            // User selected a custom date via date picker
            if (todayBtn) {
                todayBtn.textContent = this.formatDateForDisplay(displayDate)
            }

            dateDiv.textContent = 'Back to Today'
            dateDiv.classList.add('custom-date')
            dateDiv.style.display = 'block'
            dateDiv.style.cursor = 'pointer'
            dateDiv.title = this.state.effectiveToday
                ? 'Click to return to Initial Start Time'
                : 'Click to return to current date'
        } else if (isUsingEffectiveToday) {
            // Using Initial Start Time as today - hide the date display
            if (todayBtn) {
                todayBtn.textContent = this.formatDateForDisplay(displayDate)
            }

            // Hide the date display element when using effective today
            dateDiv.style.display = 'none'
            dateDiv.classList.remove('custom-date')
        } else {
            // Normal state: using actual current date
            if (todayBtn) {
                todayBtn.textContent = 'today'
            }

            dateDiv.textContent = this.formatDateForDisplay(displayDate)
            dateDiv.classList.remove('custom-date')
            dateDiv.style.display = 'block'
            dateDiv.style.cursor = 'default'
            dateDiv.title = ''
        }
    },

    /**
     * Get today's date range (midnight to midnight)
     * Uses selected today if custom date is set
     * @returns {Object} {start: Date, end: Date}
     */
    getTodayRange: function () {
        const now = this.getSelectedToday()
        const start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0
        )
        const end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59
        )
        return { start, end }
    },


    /**
     * Create and inject the UI
     */
    createUI: function () {
        // Remove existing instance if any
        const existing = document.getElementById('operationsClock')
        if (existing) {
            existing.remove()
        }

        // Create UI HTML
        const clockDiv = document.createElement('div')
        clockDiv.id = 'operationsClock'
        clockDiv.className = 'operationsClockComponent'

        this.createDayIntervalUI(clockDiv)

        // Check for mobile and add class for positioning
        if (L_ && L_.UserInterface_ && L_.UserInterface_.isMobile === true) {
            clockDiv.classList.add('operationsClockComponent-mobile')
        }

        // Inject into DOM
        document.body.appendChild(clockDiv)

        // Attach event handlers
        this.attachEventHandlers()

        // Create Tippy tooltips
        this.createTooltips()

        // Create date picker
        this.createDatePicker()
    },


    /**
     * Create day interval UI (desktop/mobile)
     * @param {HTMLElement} container - Container element
     */
    createDayIntervalUI: function (container) {
        const isMobile = L_?.UserInterface_?.isMobile === true
        const useDropdown = isMobile && true

        if (useDropdown) {
            this.createMobileDropdownUI(container)
        } else {
            this.createDesktopButtonUI(container)
        }
    },

    /**
     * Create desktop button UI with dynamic intervals
     * @param {HTMLElement} container - Container element
     */
    createDesktopButtonUI: function (container) {
        const pastButtons = []
        const futureButtons = []

        // Get unit labels for -1 and +1
        const pastUnitLabel = this.config.pastUnit || 'day'
        const forecastUnitLabel = this.config.futureUnit || 'day'

        // Generate past interval buttons
        for (let i = this.config.pastInterval; i > 0; i--) {
            // Add unit label to -1 button
            const label = i === 1 ? `1 ${pastUnitLabel}` : `${i}`
            pastButtons.push(`
                <button class="clock-btn clock-btn-interval" data-offset="${-i}">
                    - ${label}
                </button>
            `)
        }

        // Generate future interval buttons
        for (let i = 1; i <= this.config.futureInterval; i++) {
            // Add unit label to +1 button
            const label = i === 1 ? `1 ${forecastUnitLabel}` : `${i}`
            futureButtons.push(`
                <button class="clock-btn clock-btn-interval" data-offset="${i}">
                    + ${label}
                </button>
            `)
        }

        // Calendar icon for today button
        const calendarIcon = `
            <svg class="clock-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/>
                <line x1="9" y1="2" x2="9" y2="6" stroke="currentColor" stroke-width="2"/>
                <line x1="15" y1="2" x2="15" y2="6" stroke="currentColor" stroke-width="2"/>
            </svg>
        `

        container.innerHTML = `
            <div class="clock-button-group">
                ${pastButtons.join('')}
                <div class="clock-today-wrapper">
                    <button class="clock-btn clock-btn-today active">
                        ${calendarIcon}
                        <span>today</span>
                    </button>
                    <div class="clock-today-date">${this.formatDateForDisplay(this.getSelectedToday())}</div>
                </div>
                ${futureButtons.join('')}
            </div>
        `
    },

    /**
     * Create mobile dropdown UI
     * @param {HTMLElement} container - Container element
     */
    createMobileDropdownUI: function (container) {
        const pastOptions = []
        const futureOptions = []

        // Get unit labels
        const pastUnitLabel = this.config.pastUnit || 'day'
        const forecastUnitLabel = this.config.futureUnit || 'day'

        // Past options (0 to -N)
        pastOptions.push('<option value="0">Today</option>')
        for (let i = 1; i <= this.config.pastInterval; i++) {
            const label = i === 1 ? `1 ${pastUnitLabel} ago` : `${i} days ago`
            pastOptions.push(`<option value="${-i}">-${i} (${label})</option>`)
        }

        // Future options (0 to +N)
        futureOptions.push('<option value="0">Today</option>')
        for (let i = 1; i <= this.config.futureInterval; i++) {
            const label =
                i === 1 ? `1 ${forecastUnitLabel} ahead` : `${i} days ahead`
            futureOptions.push(`<option value="${i}">+${i} (${label})</option>`)
        }

        // Calendar icon for today section
        const calendarIcon = `
            <svg class="clock-icon-large" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/>
                <line x1="9" y1="2" x2="9" y2="6" stroke="currentColor" stroke-width="2"/>
                <line x1="15" y1="2" x2="15" y2="6" stroke="currentColor" stroke-width="2"/>
            </svg>
        `

        container.innerHTML = `
            <div class="clock-mobile-group">
                ${
                    this.config.pastInterval > 0
                        ? `<div class="clock-mobile-row">
                    <label>Past Days:</label>
                    <select class="clock-select clock-select-past">
                        ${pastOptions.join('')}
                    </select>
                </div>`
                        : ''
                }

                <div class="clock-mobile-row clock-today-section">
                    ${calendarIcon}
                    <div>
                        <div class="clock-today-label">Today</div>
                        <div class="clock-today-date">${this.formatDateForDisplay(this.getSelectedToday())}</div>
                    </div>
                </div>

                ${
                    this.config.futureInterval > 0
                        ? `<div class="clock-mobile-row">
                    <label>Future Days:</label>
                    <select class="clock-select clock-select-future">
                        ${futureOptions.join('')}
                    </select>
                </div>`
                        : ''
                }
            </div>
        `
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers: function () {
        // Add "back to today" click handler
        const dateDisplay = document.querySelector('.clock-today-date')
        if (dateDisplay) {
            dateDisplay.addEventListener('click', () => {
                // Only reset if custom date is selected
                if (this.state.selectedToday) {
                    this.resetToToday()
                }
            })
        }

        const isMobile = L_?.UserInterface_?.isMobile === true
        const useDropdown = isMobile && true

        if (useDropdown) {
            // Dropdown handlers
            const pastSelect = document.querySelector('.clock-select-past')
            const futureSelect = document.querySelector('.clock-select-future')
            const todaySection = document.querySelector('.clock-today-section')

            if (pastSelect) {
                pastSelect.addEventListener('change', (e) => {
                    this.setDayOffset(parseInt(e.target.value))
                })
            }

            if (futureSelect) {
                futureSelect.addEventListener('change', (e) => {
                    this.setDayOffset(parseInt(e.target.value))
                })
            }

            if (todaySection) {
                todaySection.addEventListener('click', (e) => {
                    // Prevent handling clicks outside the section
                    if (!todaySection.contains(e.target)) return

                    // If Today is already active, open date picker
                    // Otherwise, select Today first
                    if (this.state.activeOffset === 0) {
                        // Today is active - open date picker using TempusDominus API
                        if (this.state.datePickerInstance) {
                            this.state.datePickerInstance.show()
                        }
                    } else {
                        // Another offset is active - select Today
                        this.setDayOffset(0)
                    }
                })
            }
        } else {
            // Button handlers
            const intervalBtns = document.querySelectorAll(
                '.clock-btn-interval'
            )
            const todayBtn = document.querySelector('.clock-btn-today')

            intervalBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const offset = parseInt(btn.dataset.offset)
                    this.setDayOffset(offset)
                })
            })

            if (todayBtn) {
                todayBtn.addEventListener('click', (e) => {
                    // Prevent handling clicks outside the button
                    if (!todayBtn.contains(e.target)) return

                    // If Today is already active, open date picker
                    // Otherwise, select Today first
                    if (this.state.activeOffset === 0) {
                        // Today is active - open date picker using TempusDominus API
                        if (this.state.datePickerInstance) {
                            this.state.datePickerInstance.show()
                        }
                    } else {
                        // Another offset is active - select Today
                        this.setDayOffset(0)
                    }
                })
            }
        }
    },


    /**
     * Set day offset (day interval mode)
     * @param {number} offset - Day offset (-N to +N)
     */
    setDayOffset: function (offset) {
        // Update active offset
        this.state.activeOffset = offset

        // Get time range for this offset
        const range = this.getOffsetRange(offset)

        // Update active button styling
        this.setActiveButtonOffset(offset)

        // Update TimeControl
        if (TimeControl?.setTime && TimeControl.timeUI) {
            TimeControl.setTime(
                TimeControl.timeUI.removeOffset(range.start.getTime()),
                TimeControl.timeUI.removeOffset(range.end.getTime()),
                false, // absolute times
                '00:00:00'
            )
        }
    },

    /**
     * Set active button for day interval mode
     * @param {number} offset - Day offset
     */
    setActiveButtonOffset: function (offset) {
        const clockDiv = document.getElementById('operationsClock')
        if (!clockDiv) return

        const isMobile = L_?.UserInterface_?.isMobile === true
        const useDropdown = isMobile && true

        if (useDropdown) {
            // Update dropdown selections
            const pastSelect = clockDiv.querySelector('.clock-select-past')
            const futureSelect = clockDiv.querySelector('.clock-select-future')

            if (offset <= 0 && pastSelect) {
                pastSelect.value = offset
                if (futureSelect) futureSelect.value = 0
            } else if (offset > 0 && futureSelect) {
                futureSelect.value = offset
                if (pastSelect) pastSelect.value = 0
            }
        } else {
            // Remove active from all buttons
            clockDiv.querySelectorAll('.clock-btn').forEach((btn) => {
                btn.classList.remove('active')
            })

            // Add active to selected button
            if (offset === 0) {
                clockDiv
                    .querySelector('.clock-btn-today')
                    ?.classList.add('active')
            } else {
                const btn = clockDiv.querySelector(`[data-offset="${offset}"]`)
                btn?.classList.add('active')
            }
        }
    },

    /**
     * Create Tippy tooltips for buttons
     */
    createTooltips: function () {
        const isMobile = L_?.UserInterface_?.isMobile === true
        const useDropdown = isMobile && true

        // Don't create tooltips on mobile dropdowns
        if (useDropdown) return

        const clockDiv = document.getElementById('operationsClock')
        if (!clockDiv) return

        // Destroy existing tooltips
        this.state.tippyInstances.forEach((instance) => instance.destroy())
        this.state.tippyInstances = []

        // Create tooltips for all interval buttons
        const intervalBtns = clockDiv.querySelectorAll('.clock-btn-interval')

        intervalBtns.forEach((btn) => {
            const offset = parseInt(btn.dataset.offset)
            const range = this.getOffsetRange(offset)

            const instance = tippy(btn, {
                content: `${this.formatDateTime(range.start)} → ${this.formatDateTime(range.end)}`,
                allowHTML: true,
                placement: 'top',
                theme: 'mmgis',
            })

            this.state.tippyInstances.push(instance)
        })
    },


    /**
     * Update tooltip content with current date ranges and today's date display
     */
    updateTooltips: function () {
        // Update date display
        this.updateDateDisplay()

        const isMobile = L_?.UserInterface_?.isMobile === true
        const useDropdown = isMobile && true

        if (useDropdown) return

        // Update tooltip content for all interval buttons
        const intervalBtns = document.querySelectorAll('.clock-btn-interval')

        intervalBtns.forEach((btn, index) => {
            const offset = parseInt(btn.dataset.offset)
            const range = this.getOffsetRange(offset)

            if (this.state.tippyInstances[index]) {
                this.state.tippyInstances[index].setContent(
                    `${this.formatDateTime(range.start)} → ${this.formatDateTime(range.end)}`
                )
            }
        })
    },


    /**
     * Create and initialize date picker for TODAY button
     */
    createDatePicker: function () {
        const todayBtn = document.querySelector('.clock-btn-today')
        if (!todayBtn) return

        // Create hidden input for TempusDominus
        // Note: Input must be clickable and properly sized for TempusDominus to work
        // We overlay it on the button invisibly so clicks go through to TempusDominus
        const input = document.createElement('input')
        input.type = 'text'
        input.id = 'operationsClockDatePicker'
        input.style.position = 'absolute'
        input.style.top = '0'
        input.style.left = '0'
        input.style.width = '100%'
        input.style.height = '100%'
        input.style.opacity = '0'
        input.style.cursor = 'pointer'
        input.style.border = 'none'
        input.style.background = 'transparent'
        todayBtn.style.position = 'relative' // Ensure button is positioned for absolute child
        todayBtn.appendChild(input)

        const options = {
            display: {
                viewMode: 'calendar',
                components: {
                    decades: false,
                    year: true,
                    month: true,
                    date: true,
                    hours: false,
                    minutes: false,
                    seconds: false,
                },
                buttons: {
                    today: true,
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
                placement: 'top',
            },
            useCurrent: false,
            //promptTimeOnDateChange: true,
            promptTimeOnDateChangeTransitionDelay: 200,
        }

        // Initialize TempusDominus with date-only picker
        this.state.datePickerInstance = new TempusDominus(input, options)

        // Add custom class to the picker widget when it shows
        this.state.datePickerInstance.subscribe(Namespace.events.show, () => {
            const widget = document.querySelector('.tempus-dominus-widget')
            if (
                widget &&
                !widget.classList.contains('operations-clock-picker')
            ) {
                widget.classList.add('operations-clock-picker')
            }

            // If using effective today (Initial Start Time), open calendar to that date
            if (this.state.effectiveToday && !this.state.selectedToday) {
                this.state.datePickerInstance.viewDate = new DateTime(this.state.effectiveToday)
            }
        })

        // Subscribe to change events using TempusDominus subscribe API
        this.state.datePickerInstance.subscribe(
            Namespace.events.change,
            (e) => {
                if (e.date) {
                    this.onDateSelected(e.date)
                }
            }
        )
    },

    /**
     * Handle date selection from date picker
     * @param {Date} date - Selected date from picker
     */
    onDateSelected: function (date) {
        // Store selected date (normalized to midnight)
        this.state.selectedToday = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0
        )

        // Update UI
        this.updateDateDisplay()
        this.updateTooltips()

        // Refresh whatever offset is currently active
        this.setDayOffset(this.state.activeOffset)

        // Close picker
        if (this.state.datePickerInstance) {
            this.state.datePickerInstance.hide()
        }
    },

    /**
     * Reset to actual current date
     */
    resetToToday: function () {
        // Clear custom date
        this.state.selectedToday = null

        // Clear the date picker selection and reset view to effective today or current date
        if (this.state.datePickerInstance) {
            this.state.datePickerInstance.dates.clear()

            // Reset view date to effective today (if configured) or current date
            const resetDate = this.state.effectiveToday || new Date()
            this.state.datePickerInstance.viewDate = new DateTime(resetDate)
        }

        // Update UI
        this.updateDateDisplay()
        this.updateTooltips()

        // Refresh the time range if currently viewing today
        if (this.state.activeOffset === 0) {
            this.setDayOffset(0)
        }
    },


    /**
     * Start live updates interval (for updating tooltips)
     */
    startLiveUpdates: function () {
        // Clear any existing interval
        if (this.state.liveInterval) {
            clearInterval(this.state.liveInterval)
        }

        // Start new interval to update tooltips
        const intervalMs = this.config.liveRefreshInterval * 1000
        this.state.liveInterval = setInterval(() => {
            this.updateTooltips()
        }, intervalMs)
    },

    /**
     * Setup mobile positioning that follows toolbar
     */
    setupMobilePositioning: function () {
        // Watch for changes to toolbar position and mirror it with an offset
        const updatePosition = () => {
            const toolbar = document.getElementById('toolbar')
            const clockDiv = document.getElementById('operationsClock')

            if (toolbar && clockDiv) {
                const toolbarBottom = parseInt(toolbar.style.bottom) || 0
                clockDiv.style.bottom = toolbarBottom + 60 + 'px'
            }
        }

        // Use MutationObserver to watch for style changes on toolbar
        const toolbar = document.getElementById('toolbar')
        if (toolbar) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (
                        mutation.type === 'attributes' &&
                        mutation.attributeName === 'style'
                    ) {
                        updatePosition()
                    }
                })
            })

            observer.observe(toolbar, {
                attributes: true,
                attributeFilter: ['style'],
            })

            // Store observer for cleanup
            this.state.toolbarObserver = observer

            // Set initial position
            updatePosition()
        }
    },

    /**
     * Handle time changes from TimeControl
     * @param {Object} timeData - Time data from TimeControl
     */
    onTimeChange: function (timeData) {
        // Update tooltips when time changes from other sources
        this.updateTooltips()
    },

    /**
     * Cleanup resources
     */
    cleanup: function () {
        // Clear live update interval
        if (this.state.liveInterval) {
            clearInterval(this.state.liveInterval)
            this.state.liveInterval = null
        }

        // Destroy Tippy instances
        this.state.tippyInstances.forEach((instance) => instance.destroy())
        this.state.tippyInstances = []

        // Destroy date picker
        if (this.state.datePickerInstance) {
            this.state.datePickerInstance.dispose()
            this.state.datePickerInstance = null
        }

        // Disconnect toolbar observer (mobile)
        if (this.state.toolbarObserver) {
            this.state.toolbarObserver.disconnect()
            this.state.toolbarObserver = null
        }

        // Unsubscribe from TimeControl
        if (TimeControl && TimeControl.unsubscribe) {
            TimeControl.unsubscribe('operationsClock')
        }

        // Remove UI element
        const clockDiv = document.getElementById('operationsClock')
        if (clockDiv) {
            clockDiv.remove()
        }
    },
}

// Export the component
export default OperationsClock
