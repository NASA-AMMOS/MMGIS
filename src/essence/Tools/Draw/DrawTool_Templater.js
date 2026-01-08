import $ from 'jquery'

import F_ from '../../Basics/Formulae_/Formulae_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Map_ from '../../Basics/Map_/Map_'
import Dropy from '../../../external/Dropy/dropy'
import TimeControl from '../../Basics/TimeControl_/TimeControl'
import calls from '../../../pre/calls'

import * as moment from 'moment'
import { TempusDominus, Namespace } from '@eonasdan/tempus-dominus'
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.css'
import tippy from 'tippy.js'
import Sortable from 'sortablejs'

import './DrawTool_Templater.css'

const DrawTool_Templater = {
    renderTemplate: function (containerId, templateObj, properties) {
        if (templateObj == null) return null
        properties = properties || {}
        const template = JSON.parse(JSON.stringify(templateObj.template))

        let hasStartTime, hasEndTime
        // prettier-ignore
        const markup = [
            "<ul id='drawToolTemplater'>",
            template.map((t, idx) => {

                if( properties[t.field] != null)  {
                    t._default = t.default
                    t.default = properties[t.field]
                }
                if( hasStartTime == null && t.isStart)
                    hasStartTime = t
                if( hasEndTime == null && t.isEnd )
                    hasEndTime = t
                // prettier-ignore
                switch(t.type) {
                    case 'checkbox':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<div class="mmgis-checkbox small"><input type="checkbox" ${t.default === true ? 'checked ' : ''}id="templater-checkbox-${idx}"/><label for="templater-checkbox-${idx}"></label></div>`,
                            `</li>`
                        ].join('\n')
                    case 'number':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<input type='number' placeholder="Enter Number" autocomplete="off"
                                    ${t.default != null && typeof t.default === 'number' ? ` value='${t.default}'` : ''}
                                    ${t.min != null && typeof t.min === 'number' ? ` min='${t.min}'` : ''}
                                    ${t.max != null && typeof t.max === 'number' ? ` max='${t.max}'` : ''}
                                    ${t.step != null && typeof t.step === 'number' ? ` step='${t.step}'` : ''}
                                    />`,
                            `</li>`
                        ].join('\n')
                    case 'text':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<input type='text' placeholder="Enter Text" autocomplete="off"
                                    ${t.default != null ? ` value='${t.default}'` : ''}
                                    ${t.minLength != null && typeof t.min === 'number' ? ` minLength='${t.minLength}'` : ''}
                                    ${t.maxLength != null && typeof t.max === 'number' ? ` maxLength='${t.maxLength}'` : ''}
                                    />`,
                            `</li>`
                        ].join('\n')
                    case 'textarea':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<textarea>${t.default != null ? t.default : ''}</textarea>`,
                            `</li>`
                        ].join('\n')
                    case 'range':
                    case 'slider':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplaterrange'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<span>${t.default != null && typeof t.default === 'number' ? t.default : 'N/A'}</span>`,
                                `<input type='range' class='slider2'
                                    ${t.default != null && typeof t.default === 'number' ? ` value='${t.default}'` : ''}
                                    ${t.min != null && typeof t.min === 'number' ? ` min='${t.min}'` : ''}
                                    ${t.max != null && typeof t.max === 'number' ? ` max='${t.max}'` : ''}
                                    ${t.step != null && typeof t.step === 'number' ? ` step='${t.step}'` : ''}
                                    />`,
                            `</li>`
                        ].join('\n')
                    case 'dropdown':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<div id='drawToolFileModalTemplateDropdown_${idx}' class='ui dropdown short'></div>`,
                            `</li>`
                        ].join('\n')
                    case 'date':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<input id='drawToolFileModalTemplateDate_${idx}' placeholder='${t.format || 'YYYY-MM-DDTHH:mm:ss'}' autocomplete='off'></input>`,
                            `</li>`
                        ].join('\n')
                    case 'incrementer':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplater${t.type}'>`,
                                `<div title='${t.field}'>${t.field}:</div>`,
                                `<input type='text' placeholder="${t.default != null ? ` value='${t.default}'` : ''}" autocomplete="off"
                                    ${t.default != null ? ` value='${t.default}'` : ''}
                                    />`,
                            `</li>`
                        ].join('\n')
                    case 'point':
                        return [
                            `<li id='drawToolTemplater_${idx}' class='drawToolTemplaterpoint'>`,
                                `<div class='drawToolTemplaterpointHeaderWrapper'>`,    
                                    `<div title='${t.field}'>${t.field}:</div>`,
                                    `<button class='drawToolTemplaterPointAddBtn' data-field-idx='${idx}'>`,
                                        `<i class='mdi mdi-map-marker-plus mdi-14px'></i> Add Point`,
                                    `</button>`,
                                `</div>`,
                                `<div class='drawToolTemplaterPointContainer'>`,
                                    `<ul class='drawToolTemplaterPointList' id='drawToolTemplaterPointList_${idx}'></ul>`,
                                `</div>`,
                            `</li>`
                        ].join('\n')
                    default:
                        return null
                }
            }).join('\n'),
            hasStartTime || hasEndTime ? [
                `<li id='drawToolTemplater_setTime'>`,
                    `<div id='drawToolTemplater_setTimeStart' class="${hasStartTime && hasStartTime.default.length > 0 ? 'active' : ''}"><i class='mdi mdi-clock mdi-18px'></i><div>Use Start Time</div></div>`,
                    `<div id='drawToolTemplater_setTimeEnd' class="${hasEndTime && hasEndTime.default.length > 0 ? 'active' : ''}"><div>Use End Time</div><i class='mdi mdi-clock-outline mdi-18px'></i></div>`,
                `</li>`].join('\n') : null,
            "</ul>"
        ].join('\n')

        $(`#${containerId}`).append(markup)

        const helperStates = {}
        let startTime, endTime
        // Attach events
        template.forEach((t, idx) => {
            if (startTime == null && t.isStart) startTime = t.field
            if (endTime == null && t.isEnd) endTime = t.field

            switch (t.type) {
                case 'range':
                case 'slider':
                    $(`#drawToolTemplater_${idx} input`).on('input', () => {
                        $(`#drawToolTemplater_${idx} span`).text(
                            `${$(`#drawToolTemplater_${idx} input`).val()}`
                        )
                    })
                    break
                case 'dropdown':
                    helperStates[idx] = Math.max(
                        (t.items || []).indexOf(t.default),
                        0
                    )
                    $(`#drawToolFileModalTemplateDropdown_${idx}`).html(
                        Dropy.construct(
                            t.items || [],
                            t.field,
                            helperStates[idx],
                            {
                                openUp: false,
                                dark: true,
                            }
                        )
                    )
                    Dropy.init(
                        $(`#drawToolFileModalTemplateDropdown_${idx}`),
                        function (idx2) {
                            helperStates[idx] = idx2
                        }
                    )
                    break
                case 'date':
                    const startElm = document.getElementById(
                        `drawToolFileModalTemplateDate_${idx}`
                    )
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
                                today: true,
                                clear: true,
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
                    const dateTempus = new TempusDominus(startElm, options)
                    dateTempus.dates.formatInput = (date) => {
                        return moment
                            .utc(DrawTool_Templater.removeOffset(date))
                            .format(t.format || 'YYYY-MM-DDTHH:mm:ss')
                    }
                    if (t.default != null && t.default != '') {
                        let def = t.default
                        let d
                        if (def === 'NOW') d = new Date().getTime()
                        else if (def === 'STARTTIME')
                            d = DrawTool_Templater.addOffset(
                                new Date(TimeControl.getStartTime()).getTime()
                            )
                        else if (def === 'ENDTIME')
                            d = DrawTool_Templater.addOffset(
                                new Date(TimeControl.getEndTime()).getTime()
                            )
                        else {
                            d = new moment(
                                def,
                                t.format || 'YYYY-MM-DDTHH:mm:ss'
                            )
                                .utc()
                                .valueOf()
                        }
                        const parsed = dateTempus.dates.parseInput(new Date(d))
                        dateTempus.dates.setValue(parsed)
                    }
                    break
                case 'point':
                    // Initialize from existing data
                    const existingPoints = properties[t.field] || []
                    helperStates[idx] = existingPoints

                    // Render initial point list
                    DrawTool_Templater.renderPointList(
                        idx,
                        existingPoints,
                        helperStates,
                        t
                    )

                    // Capture parent feature info for this field
                    const parentUUID =
                        properties.uuid ||
                        properties._?.id?.toString() ||
                        'unknown'
                    const parentName = properties.name || 'Unnamed Feature'

                    // Add Pt button click handler
                    $(
                        `#drawToolTemplater_${idx} .drawToolTemplaterPointAddBtn`
                    ).on('click', (e) => {
                        e.preventDefault()
                        e.stopPropagation()

                        // Check if max points already reached
                        const maxPoints = t.maxPoints || 0
                        const currentCount = helperStates[idx]
                            ? helperStates[idx].length
                            : 0
                        if (maxPoints > 0 && currentCount >= maxPoints) {
                            CursorInfo.update(
                                `Maximum of ${maxPoints} points reached. Delete a point to add more.`,
                                4000,
                                true,
                                { x: 305, y: 6 },
                                '#e9ff26',
                                'black'
                            )
                            return
                        }

                        DrawTool_Templater.startAddingPoint(
                            idx,
                            t.field,
                            t,
                            parentUUID,
                            parentName,
                            helperStates
                        )
                    })

                    // Render existing temporary markers
                    existingPoints.forEach((point) => {
                        DrawTool_Templater.renderPointMarker(point, parentName)
                    })
                    break
                default:
                    break
            }
        })

        $(`#drawToolTemplater_setTimeStart`).on('click', () => {
            // Force UTC by adding 'Z' if not present
            let startTimeValue = properties[startTime]
            if (
                typeof startTimeValue === 'string' &&
                startTimeValue.indexOf('T') !== -1 &&
                !startTimeValue.endsWith('Z')
            ) {
                startTimeValue += 'Z'
            }
            const newStartTime = new Date(startTimeValue).getTime()
            const currentEndTime = L_.TimeControl_.getEndTime()

            // Convert both to timestamps for proper comparison
            const newStartTimeMs =
                typeof newStartTime === 'number'
                    ? newStartTime
                    : new Date(newStartTime).getTime()
            const currentEndTimeMs =
                typeof currentEndTime === 'number'
                    ? currentEndTime
                    : new Date(currentEndTime).getTime()

            // Check if new start time would be later than current end time
            if (newStartTimeMs > currentEndTimeMs) {
                // Set end time to 1 day after start time
                const oneDayMs = 24 * 60 * 60 * 1000
                const newEndTime = newStartTimeMs + oneDayMs
                L_.TimeControl_.setTime(newStartTime, newEndTime)

                // Show warning to user
                CursorInfo.update(
                    `Start time is later than end time. End time has been set to 1 day after start time.`,
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
            } else {
                // Normal case: just set the start time
                L_.TimeControl_.setTime(newStartTime, currentEndTime)
            }

            L_.TimeControl_.timeUI.fitWindowToTime()
        })
        $(`#drawToolTemplater_setTimeEnd`).on('click', () => {
            // Force UTC by adding 'Z' if not present
            let endTimeValue = properties[endTime]
            if (
                typeof endTimeValue === 'string' &&
                endTimeValue.indexOf('T') !== -1 &&
                !endTimeValue.endsWith('Z')
            ) {
                endTimeValue += 'Z'
            }
            const newEndTime = new Date(endTimeValue).getTime()
            const currentStartTime = L_.TimeControl_.getStartTime()

            // Convert both to timestamps for proper comparison
            const newEndTimeMs =
                typeof newEndTime === 'number'
                    ? newEndTime
                    : new Date(newEndTime).getTime()
            const currentStartTimeMs =
                typeof currentStartTime === 'number'
                    ? currentStartTime
                    : new Date(currentStartTime).getTime()

            // Check if new end time would be earlier than current start time
            if (newEndTimeMs < currentStartTimeMs) {
                // Set start time to 1 day before end time
                const oneDayMs = 24 * 60 * 60 * 1000
                const newStartTime = newEndTimeMs - oneDayMs
                L_.TimeControl_.setTime(newStartTime, newEndTime)

                // Show warning to user
                CursorInfo.update(
                    `End time is earlier than start time. Start time has been set to 1 day before end time.`,
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
            } else {
                // Normal case: just set the end time
                L_.TimeControl_.setTime(currentStartTime, newEndTime)
            }

            L_.TimeControl_.timeUI.fitWindowToTime()
        })

        return {
            getValues: (layer, existingProperties, onlyIfChanged) => {
                const values = {}
                const invalids = {}

                template.forEach((t, idx) => {
                    switch (t.type) {
                        case 'checkbox':
                            values[t.field] = $(
                                `#${containerId} #drawToolTemplater_${idx} input`
                            ).prop('checked')

                            break
                        case 'number':
                            values[t.field] = parseFloat(
                                $(
                                    `#${containerId} #drawToolTemplater_${idx} input`
                                ).val()
                            )
                            if (isNaN(values[t.field])) values[t.field] = null

                            if (
                                t.min != null &&
                                t.min != '' &&
                                values[t.field] < t.min
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' must be >= ${t.min}`
                            if (
                                t.max != null &&
                                t.max != '' &&
                                values[t.field] > t.max
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' must be <= ${t.max}`
                            if (
                                t.step != null &&
                                t.step != '' &&
                                values[t.field] / t.step !=
                                    parseInt(values[t.field] / t.step)
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' must be a multiple of ${t.step}`

                            break
                        case 'text':
                            values[t.field] = $(
                                `#${containerId} #drawToolTemplater_${idx} input`
                            ).val()
                            if (
                                t.minLength != null &&
                                t.minLength != '' &&
                                values[t.field].length < t.minLength
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' must be >= ${t.minLength} characters`

                            if (
                                t.maxLength != null &&
                                t.maxLength != '' &&
                                values[t.field] != null &&
                                values[t.field].length > t.maxLength
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' must be <= ${t.maxLength} characters`

                            if (
                                t.regex != null &&
                                t.regex != '' &&
                                values[t.field] != null
                            ) {
                                try {
                                    if (
                                        values[t.field].match(
                                            new RegExp(t.regex)
                                        ) == null
                                    )
                                        invalids[
                                            t.field
                                        ] = `'${t.field}' does not match regex: ${t.regex}`
                                } catch (error) {
                                    // regex no good
                                }
                            }

                            break
                        case 'textarea':
                            values[t.field] = $(
                                `#${containerId} #drawToolTemplater_${idx} textarea`
                            ).val()
                            if (
                                t.required === true &&
                                (values[t.field] == null ||
                                    values[t.field] == '')
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' cannot be empty`
                            if (
                                t.maxLength != null &&
                                t.maxLength != '' &&
                                values[t.field] != null &&
                                values[t.field].length > t.maxLength
                            )
                                invalids[
                                    t.field
                                ] = `'${t.field}' must be <= ${t.maxLength} characters`
                            break
                        case 'range':
                        case 'slider':
                            values[t.field] = parseFloat(
                                $(
                                    `#${containerId} #drawToolTemplater_${idx} input`
                                ).val()
                            )
                            if (isNaN(values[t.field])) values[t.field] = null
                            break
                        case 'dropdown':
                            values[t.field] = t.items[helperStates[idx]]
                            break
                        case 'date':
                            values[t.field] = $(
                                `#${containerId} #drawToolFileModalTemplateDate_${idx}`
                            ).val()
                            if (values[t.field] === 'Invalid Date')
                                values[t.field] = null
                            break
                        case 'incrementer':
                            values[t.field] = $(
                                `#${containerId} #drawToolTemplater_${idx} input`
                            ).val()

                            const nextIncrement =
                                DrawTool_Templater._validateIncrement(
                                    values[t.field],
                                    t,
                                    layer,
                                    existingProperties
                                )

                            if (nextIncrement.error != null)
                                invalids[t.field] = nextIncrement.error
                            else values[t.field] = nextIncrement.newValue

                            break
                        case 'point':
                            values[t.field] = helperStates[idx] || []
                            break
                        default:
                            break
                    }

                    if (
                        t.required === true &&
                        (values[t.field] == null ||
                            values[t.field] == '' ||
                            (t.type === 'number' && isNaN(values[t.field])))
                    ) {
                        invalids[t.field] = `'${t.field}' is a required field`
                    }
                })
                let hadInvalid = false
                let bestMessage
                template.forEach((t, idx) => {
                    if (invalids[t.field] != null) {
                        hadInvalid = true
                        bestMessage = invalids[t.field]
                        switch (t.type) {
                            case 'textarea':
                                $(
                                    `#${containerId} #drawToolTemplater_${idx} textarea`
                                ).css('border-bottom', '2px solid red')
                                break
                            default:
                                $(
                                    `#${containerId} #drawToolTemplater_${idx} input`
                                ).css('border-bottom', '2px solid red')
                        }
                    } else {
                        switch (t.type) {
                            case 'textarea':
                                $(
                                    `#${containerId} #drawToolTemplater_${idx} textarea`
                                ).css('border-bottom', 'none')
                                break
                            default:
                                $(
                                    `#${containerId} #drawToolTemplater_${idx} input`
                                ).css('border-bottom', 'none')
                        }
                    }
                })
                if (hadInvalid) {
                    CursorInfo.update(
                        `This feature has invalid form values: ${bestMessage}`,
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    return false
                } else {
                    if (onlyIfChanged === true) {
                        const changedValues = {}
                        Object.keys(values).forEach((k) => {
                            if (
                                !existingProperties.hasOwnProperty(k) ||
                                values[k] !== existingProperties[k]
                            )
                                changedValues[k] = values[k]
                        })
                        return changedValues
                    } else return values
                }
            },
        }
    },
    /**
     * Delete a point from the list and map
     * @param {number} fieldIdx - Index of the field in helperStates
     * @param {number} pointIdx - Index of the point to delete
     * @param {object} helperStates - Reference to helperStates object
     * @param {object} fieldConfig - Template field configuration
     */
    deletePoint: function (fieldIdx, pointIdx, helperStates, fieldConfig) {
        // Get the point before removing it
        const point = helperStates[fieldIdx][pointIdx]

        // Remove from helperStates array
        helperStates[fieldIdx].splice(pointIdx, 1)

        // Remove marker from map
        DrawTool_Templater.removePointMarker(point)

        // Re-render point list
        DrawTool_Templater.renderPointList(
            fieldIdx,
            helperStates[fieldIdx],
            helperStates,
            fieldConfig
        )
    },
    // Color palette for point markers
    _pointColors: [
        '#ff0000', // Red
        '#ff8800', // Orange
        '#ffff00', // Yellow
        '#00ff00', // Green
        '#00ffff', // Cyan
        '#0088ff', // Blue
        '#8800ff', // Purple
        '#ff00ff', // Magenta
        '#ffffff', // White
        '#888888', // Gray
        '#000000', // Black
        '#8b4513', // Brown
    ],
    // Helper function to render point list in UI
    renderPointList: function (fieldIdx, points, helperStates, fieldConfig) {
        const listEl = $(`#drawToolTemplaterPointList_${fieldIdx}`)
        listEl.empty()

        if (!points || points.length === 0) {
            listEl.append('<li class="empty">No points added</li>')
            // Still need to update button state even when no points
            const maxPoints = fieldConfig?.maxPoints || 0
            const addBtn = $(
                `#drawToolTemplater_${fieldIdx} .drawToolTemplaterPointAddBtn`
            )
            if (maxPoints > 0 && points && points.length >= maxPoints) {
                addBtn
                    .addClass('at-max')
                    .attr('title', `Maximum of ${maxPoints} points reached`)
            } else {
                addBtn.removeClass('at-max').attr('title', 'Add a new point')
            }
            return
        }

        // Check if we should use dropdown for names
        const defaultName = fieldConfig?.defaultName || ''
        const hasNameOptions = defaultName.indexOf(',') !== -1
        const nameOptions = hasNameOptions
            ? defaultName.split(',').map((s) => s.trim())
            : []

        points.forEach((point, i) => {
            // Build the name field - either input or dropdown container
            let nameField
            if (hasNameOptions) {
                nameField = `<div class='drawToolTemplaterPointNameDropdown' id='drawToolTemplaterPointNameDropdown_${fieldIdx}_${i}' data-point-idx='${i}'></div>`
            } else {
                nameField = `<input class='drawToolTemplaterPointNameInput' type='text' value='${F_.sanitize(
                    point.name
                )}' data-point-idx='${i}' />`
            }

            const li = $(`
                <li class='drawToolTemplaterPointItem' data-point-idx='${i}'>
                    <div class='drawToolTemplaterPointColor' style='background: ${
                        point.color
                    }' data-point-idx='${i}' title='Click to change color'></div>
                    ${nameField}
                    <div class='drawToolTemplaterPointActions'>
                        <div class='drawToolTemplaterPointDelete' data-point-idx='${i}' title='Delete'>
                            <i class='mdi mdi-delete mdi-14px'></i>
                        </div>
                    </div>
                    <div class='drawToolTemplaterPointColorPicker' data-point-idx='${i}' style='display: none;'>
                        ${DrawTool_Templater._pointColors
                            .map(
                                (color) =>
                                    `<div class='drawToolTemplaterPointColorOption ${
                                        color === point.color ? 'active' : ''
                                    }'
                                 style='background: ${color}'
                                 data-color='${color}'
                                 data-point-idx='${i}'></div>`
                            )
                            .join('')}
                    </div>
                </li>
            `)

            // Attach name handler - either input or dropdown
            if (hasNameOptions) {
                // Extract the number from this point's current name
                const pointNumberMatch = point.name.match(/\d+/)
                const pointNumber = pointNumberMatch ? parseInt(pointNumberMatch[0]) : (i + 1)

                // Apply # replacement to all name options using the actual point number
                const processedNameOptions = nameOptions.map((opt) =>
                    opt.replace('#', pointNumber)
                )

                // Initialize dropdown
                const currentNameIdx = processedNameOptions.indexOf(point.name)
                const selectedIdx = currentNameIdx >= 0 ? currentNameIdx : 0

                li.find('.drawToolTemplaterPointNameDropdown').html(
                    Dropy.construct(
                        processedNameOptions,
                        'Point Name',
                        selectedIdx,
                        {
                            openUp: false,
                            dark: true,
                        }
                    )
                )
                Dropy.init(
                    li.find('.drawToolTemplaterPointNameDropdown'),
                    function (idx) {
                        const newName = processedNameOptions[idx]
                        helperStates[fieldIdx][i].name = newName
                        // Update marker popup if it exists
                        const marker =
                            DrawTool_Templater._tempPointMarkers[
                                helperStates[fieldIdx][i].id
                            ]
                        if (marker) {
                            const parentName =
                                helperStates[fieldIdx][i].parentName ||
                                'Unnamed Feature'
                            const popupContent = `
                                <div style="font-size: 13px;">
                                    <strong>${F_.sanitize(newName)}</strong><br>
                                    <em>Parent: ${F_.sanitize(parentName)}</em>
                                </div>
                            `
                            marker.setPopupContent(popupContent)
                        }
                    }
                )
            } else {
                // Attach text input handler
                li.find('.drawToolTemplaterPointNameInput').on(
                    'change',
                    function () {
                        const pointIdx = $(this).data('point-idx')
                        const newName = $(this).val()
                        helperStates[fieldIdx][pointIdx].name = newName
                        // Update marker popup if it exists
                        const marker =
                            DrawTool_Templater._tempPointMarkers[
                                helperStates[fieldIdx][pointIdx].id
                            ]
                        if (marker) {
                            const parentName =
                                helperStates[fieldIdx][pointIdx].parentName ||
                                'Unnamed Feature'
                            const popupContent = `
                            <div style="font-size: 13px;">
                                <strong>${F_.sanitize(newName)}</strong><br>
                                <em>Parent: ${F_.sanitize(parentName)}</em>
                            </div>
                        `
                            marker.setPopupContent(popupContent)
                        }
                    }
                )
            }

            // Attach color badge click handler to toggle color picker
            li.find('.drawToolTemplaterPointColor').on('click', function () {
                const pointIdx = $(this).data('point-idx')
                $(
                    `#drawToolTemplaterPointList_${fieldIdx} .drawToolTemplaterPointColorPicker`
                )
                    .not(`[data-point-idx="${pointIdx}"]`)
                    .hide()
                li.find('.drawToolTemplaterPointColorPicker').toggle()
            })

            // Attach color option handlers
            li.find('.drawToolTemplaterPointColorOption').on(
                'click',
                function () {
                    const pointIdx = $(this).data('point-idx')
                    const newColor = $(this).data('color')

                    // Update point color in helperStates
                    helperStates[fieldIdx][pointIdx].color = newColor

                    // Update color badge immediately
                    li.find('.drawToolTemplaterPointColor').css(
                        'background-color',
                        newColor
                    )

                    // Update active state
                    li.find('.drawToolTemplaterPointColorOption').removeClass(
                        'active'
                    )
                    $(this).addClass('active')

                    // Update marker fill color if it exists (stroke stays black)
                    const point = helperStates[fieldIdx][pointIdx]
                    const marker =
                        DrawTool_Templater._tempPointMarkers[point.id]
                    if (marker) {
                        marker.setStyle({
                            fillColor: newColor,
                        })
                    }

                    // Hide color picker
                    li.find('.drawToolTemplaterPointColorPicker').hide()
                }
            )

            // Attach delete button handler
            li.find('.drawToolTemplaterPointDelete').on('click', function () {
                const pointIdx = $(this).data('point-idx')
                DrawTool_Templater.deletePoint(
                    fieldIdx,
                    pointIdx,
                    helperStates,
                    fieldConfig
                )
            })

            listEl.append(li)
        })

        // Check if max points reached and add visual indicator to Add Pt button
        const maxPoints = fieldConfig?.maxPoints || 0
        const addBtn = $(
            `#drawToolTemplater_${fieldIdx} .drawToolTemplaterPointAddBtn`
        )
        if (maxPoints > 0 && points.length >= maxPoints) {
            addBtn
                .addClass('at-max')
                .attr('title', `Maximum of ${maxPoints} points reached`)
        } else {
            addBtn.removeClass('at-max').attr('title', 'Add a new point')
        }
    },
    // Module-level state for point-adding mode
    _addingPointState: null,
    _tempPointMarkers: {},
    /**
     * Start point-adding mode for a specific field
     * @param {number} fieldIdx - Index of the field in helperStates
     * @param {string} fieldName - Name of the point field
     * @param {object} fieldConfig - Template configuration for this field
     * @param {string} parentUUID - UUID of the parent feature
     * @param {string} parentName - Name of the parent feature
     * @param {object} helperStates - Reference to helperStates object from renderTemplate
     */
    startAddingPoint: function (
        fieldIdx,
        fieldName,
        fieldConfig,
        parentUUID,
        parentName,
        helperStates
    ) {
        // Check if already in point-adding mode
        if (DrawTool_Templater._addingPointState != null) {
            CursorInfo.update(
                'Already adding a point. Press ESC to cancel current operation.',
                3000,
                true,
                { x: 305, y: 6 },
                '#e9ff26',
                'black'
            )
            return
        }

        // Validate parent UUID
        if (!parentUUID || parentUUID === 'unknown') {
            console.error('Cannot add point: no parent feature UUID')
            CursorInfo.update(
                'Error: Cannot add point to this feature',
                3000,
                true,
                { x: 305, y: 6 },
                '#ff0000',
                'white'
            )
            return
        }

        // Initialize state
        DrawTool_Templater._addingPointState = {
            fieldIdx: fieldIdx,
            fieldName: fieldName,
            fieldConfig: fieldConfig,
            parentUUID: parentUUID,
            parentName: parentName,
            helperStates: helperStates,
            drawingHandler: null,
        }

        // Create L.Draw.CircleMarker handler
        const drawOptions = {
            stroke: true,
            color: 'black', // Stroke is always black
            weight: 2,
            opacity: 1,
            fill: true,
            fillColor: fieldConfig.defaultColor || '#ff0000',
            fillOpacity: 0.8,
            radius: 6,
        }

        DrawTool_Templater._addingPointState.drawingHandler =
            new L.Draw.CircleMarker(Map_.map, drawOptions)

        // Enable drawing
        DrawTool_Templater._addingPointState.drawingHandler.enable()

        // Listen for draw:created event (provides the layer with coordinates)
        Map_.map.on('draw:created', DrawTool_Templater._onPointPlacedHandler)

        // Listen for ESC key
        $(document).on('keydown.addpoint', DrawTool_Templater._onEscKeyHandler)

        // Show user feedback
        CursorInfo.update(
            'Click map to place point. Press ESC to cancel.',
            null,
            true,
            { x: 305, y: 6 },
            '#08aeea',
            'black'
        )

        // Add active class to button
        $(
            `#drawToolTemplater_${fieldIdx} .drawToolTemplaterPointAddBtn`
        ).addClass('active')
    },
    /**
     * Handler for draw:drawstop event (bound to preserve context)
     */
    _onPointPlacedHandler: function (e) {
        DrawTool_Templater.onPointPlaced(e)
    },
    /**
     * Handler for ESC key (bound to preserve context)
     */
    _onEscKeyHandler: function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            DrawTool_Templater.endAddingPoint(false)
        }
    },
    /**
     * Called when user clicks map to place a point
     * @param {object} e - Leaflet draw:created event
     */
    onPointPlaced: function (e) {
        const state = DrawTool_Templater._addingPointState
        if (!state) return

        // Extract coordinates from the created layer
        const latlng = e.layer.getLatLng()
        if (!latlng) {
            console.error('No coordinates captured')
            DrawTool_Templater.endAddingPoint(false)
            return
        }

        // Generate point name from template pattern
        const existingPoints = state.helperStates[state.fieldIdx] || []
        const namePattern = state.fieldConfig.defaultName || 'Point #'

        // Find next available number by looking at existing point names
        const findNextAvailableNumber = (pattern, existingPoints) => {
            // Extract all numbers from existing point names matching this pattern
            const usedNumbers = existingPoints
                .map(p => {
                    // Extract number from point name by replacing the pattern
                    const match = p.name.match(/\d+/)
                    return match ? parseInt(match[0]) : null
                })
                .filter(n => n !== null)

            // Find the smallest unused number starting from 1
            let nextNum = 1
            while (usedNumbers.includes(nextNum)) {
                nextNum++
            }
            return nextNum
        }

        const nextNumber = findNextAvailableNumber(namePattern, existingPoints)

        let pointName
        // Check if we have comma-separated options (dropdown will be shown in list)
        if (namePattern.indexOf(',') !== -1) {
            const nameOptions = namePattern.split(',').map((s) => s.trim())
            // Default to first option with # replacement if present
            pointName = nameOptions[0].replace('#', nextNumber)
        } else {
            // Use pattern with # replacement
            pointName = namePattern.replace('#', nextNumber)
        }

        // Generate unique point ID (include field index to avoid collisions across multiple point fields)
        const parentUUID = state.parentUUID
        const pointId = `${parentUUID}-${state.fieldIdx}-${nextNumber}`

        // Check max points limit BEFORE adding
        if (!state.helperStates[state.fieldIdx]) {
            state.helperStates[state.fieldIdx] = []
        }

        const maxPoints = state.fieldConfig.maxPoints || 0
        if (
            maxPoints > 0 &&
            state.helperStates[state.fieldIdx].length >= maxPoints
        ) {
            CursorInfo.update(
                `Maximum of ${maxPoints} points reached.`,
                3000,
                true,
                { x: 305, y: 6 },
                '#e9ff26',
                'black'
            )
            // End point-adding mode since max is reached
            DrawTool_Templater.endAddingPoint(false)
            return
        }

        // Get default color
        const color = state.fieldConfig.defaultColor || '#ff0000'

        // Create point object
        const point = {
            id: pointId,
            name: pointName || defaultName,
            color: color,
            coords: [latlng.lng, latlng.lat],
        }

        // Add to helperStates
        state.helperStates[state.fieldIdx].push(point)

        // Render temporary marker
        DrawTool_Templater.renderPointMarker(point, state.parentName)

        // Update point list UI
        DrawTool_Templater.renderPointList(
            state.fieldIdx,
            state.helperStates[state.fieldIdx],
            state.helperStates,
            state.fieldConfig
        )

        // End point-adding mode after each point (user must click "Add Pt" again for next point)
        DrawTool_Templater.endAddingPoint(true)
    },
    /**
     * End point-adding mode and cleanup
     * @param {boolean} success - Whether points were successfully added
     */
    endAddingPoint: function (success) {
        const state = DrawTool_Templater._addingPointState
        if (!state) return

        // Disable drawing handler
        if (state.drawingHandler) {
            state.drawingHandler.disable()
        }

        // Remove event listeners
        Map_.map.off('draw:created', DrawTool_Templater._onPointPlacedHandler)
        $(document).off('keydown.addpoint')

        // Clear CursorInfo
        CursorInfo.update('', 0, true)

        // Remove active class from button
        $(
            `#drawToolTemplater_${state.fieldIdx} .drawToolTemplaterPointAddBtn`
        ).removeClass('active')

        // Clear state
        DrawTool_Templater._addingPointState = null
    },
    /**
     * Render temporary marker for a point during editing
     * @param {object} point - Point object with id, name, color, coords
     * @param {string} parentName - Name of parent feature for popup
     */
    renderPointMarker: function (point, parentName) {
        // Ensure point marker pane exists with high z-index (above all other layers)
        if (!Map_.map.getPane('drawToolPoints')) {
            Map_.map.createPane('drawToolPoints')
            Map_.map.getPane('drawToolPoints').style.zIndex = 650
        }

        // Create circle marker in the high z-index pane
        const marker = L.circleMarker([point.coords[1], point.coords[0]], {
            radius: 6,
            weight: 2,
            color: 'black', // Stroke is always black
            fillColor: point.color,
            fillOpacity: 0.8,
            pane: 'drawToolPoints',
        })

        // Bind popup
        const popupContent = `
            <div style="font-size: 13px;">
                <strong>${F_.sanitize(point.name)}</strong><br>
                <em>Parent: ${F_.sanitize(parentName || 'Unnamed Feature')}</em>
            </div>
        `
        marker.bindPopup(popupContent)

        // Add to map
        marker.addTo(Map_.map)

        // Store reference
        DrawTool_Templater._tempPointMarkers[point.id] = marker
    },
    /**
     * Remove temporary marker for a point
     * @param {object} point - Point object with id
     */
    removePointMarker: function (point) {
        const marker = DrawTool_Templater._tempPointMarkers[point.id]
        if (marker) {
            Map_.rmNotNull(marker)
            delete DrawTool_Templater._tempPointMarkers[point.id]
        }
    },
    /**
     * Remove point markers for a specific feature
     * @param {string} featureUUID - The UUID of the feature whose points should be removed
     */
    cleanupPointMarkersForFeature: function (featureUUID) {
        if (!featureUUID) return

        // Find and remove all point markers that belong to this feature
        Object.keys(DrawTool_Templater._tempPointMarkers).forEach((pointId) => {
            // Point IDs are formatted as: featureUUID-fieldIdx-pointCount
            if (pointId.startsWith(featureUUID + '-')) {
                const marker = DrawTool_Templater._tempPointMarkers[pointId]
                if (marker) {
                    Map_.rmNotNull(marker)
                }
                delete DrawTool_Templater._tempPointMarkers[pointId]
            }
        })

        // If we're currently adding a point for this feature, cancel it
        if (
            DrawTool_Templater._addingPointState &&
            DrawTool_Templater._addingPointState.parentUUID === featureUUID
        ) {
            DrawTool_Templater.endAddingPoint(false)
        }
    },
    /**
     * Remove all temporary point markers from the map
     * Called when Edit Panel closes or layer is toggled off
     */
    cleanupAllPointMarkers: function () {
        Object.keys(DrawTool_Templater._tempPointMarkers).forEach((pointId) => {
            const marker = DrawTool_Templater._tempPointMarkers[pointId]
            if (marker) {
                Map_.rmNotNull(marker)
            }
        })
        DrawTool_Templater._tempPointMarkers = {}

        // Also end point-adding mode if active
        if (DrawTool_Templater._addingPointState != null) {
            DrawTool_Templater.endAddingPoint(false)
        }
    },
    addOffset(timestamp) {
        const date = new Date(timestamp)
        const addedOffset = new Date(
            date.getTime() + date.getTimezoneOffset() * 60000
        )
        return addedOffset
    },
    removeOffset(timestamp) {
        const date = new Date(timestamp)
        const removedOffset = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        )
        return removedOffset
    },

    /**
     *
     * @param {*} value
     * @param {*} t
     * @param {*} layer
     * @returns {newValue: Number, error: String}
     */
    _validateIncrement(value, t, layer, existingProperties) {
        const response = {
            newValue: value,
            error: null,
        }

        let usedValues = []
        const split = (t._default || t.default).split('#')
        const start = split[0]
        const end = split[1]

        for (var i = 0; i < layer.length; i++) {
            if (layer[i] == null) continue
            let geojson =
                layer[i].feature ||
                layer[i]._layers[Object.keys(layer[i]._layers)[0]].feature
            if (geojson?.properties?.[t.field] != null) {
                let featuresVal = geojson?.properties?.[t.field]

                featuresVal = featuresVal.replace(start, '').replace(end, '')

                if (featuresVal !== '#') {
                    featuresVal = parseInt(featuresVal)
                    usedValues.push(featuresVal)
                }
            }
        }

        if ((response.newValue || '').indexOf('#') !== -1) {
            // Actually increment the incrementer for the first time
            let bestVal = 0
            usedValues.sort(function (a, b) {
                return a - b
            })
            usedValues = [...new Set(usedValues)] // makes it unique
            usedValues.forEach((v) => {
                if (bestVal === v) bestVal++
            })
            response.newValue = response.newValue.replace('#', bestVal)
        } else if (existingProperties) {
            let numVal = response.newValue.replace(start, '').replace(end, '')
            if (numVal != '#') {
                numVal = parseInt(numVal)
                if (existingProperties[t.field] === response.newValue) {
                    // In case of a resave, make sure the id exists only once
                    let count = 0
                    usedValues.forEach((v) => {
                        if (numVal === v) count++
                    })
                    if (count > 1)
                        response.error = `Incrementing field: '${t.field}' is not unique`
                } else {
                    // In case a manual change, make sure the id is unique
                    if (usedValues.indexOf(numVal) !== -1)
                        response.error = `Incrementing field: '${t.field}' is not unique`
                }
            }
        }

        // Check that the field still matches the surrounding string
        const incRegex = new RegExp(`^${start}\\d+${end}$`)
        if (incRegex.test(response.newValue) == false) {
            response.error = `Incrementing field: '${t.field}' must follow syntax: '${start}{#}${end}'`
        }

        return response
    },
    _templateInDesignIdx: 0,
    _templateInDesign: {},
    _TEMPLATE_TYPES: [
        'checkbox',
        'date',
        'dropdown',
        'incrementer',
        'number',
        'point',
        'slider',
        'text',
        'textarea',
    ],
    _DATE_FORMATS: [
        'YYYY-MM-DDTHH:mm:ss',
        'MMMM Do YYYY',
        'YYYY-MM-DD',
        'MMMM Do YYYY, h:mm:ss a',
        'HH:mm:ss',
        'h:mm:ss a',
    ],
    renderDesignTemplate: function (
        containerId,
        templateObj,
        isNew,
        featureToMakeTemplateFrom
    ) {
        $(`#${containerId} #drawToolTemplaterDesign`).remove()

        if (featureToMakeTemplateFrom && featureToMakeTemplateFrom.properties) {
            isNew = true
            const featureTemplate = {
                name: '',
                template: [],
            }

            Object.keys(featureToMakeTemplateFrom.properties).forEach(
                (propKey) => {
                    const newTemplateItem = {
                        field: propKey,
                    }
                    const v = featureToMakeTemplateFrom.properties[propKey]
                    switch (typeof v) {
                        case 'boolean':
                            newTemplateItem.type = 'checkbox'
                            break
                        case 'number':
                            newTemplateItem.type = 'number'
                            newTemplateItem.min = ''
                            newTemplateItem.max = ''
                            newTemplateItem.step = ''
                            break
                        case 'string':
                            newTemplateItem.type = 'text'
                            newTemplateItem.minLength = ''
                            newTemplateItem.maxLength = ''
                            newTemplateItem.regex = ''
                            break
                        default:
                            break
                    }
                    if (newTemplateItem.type != null)
                        featureTemplate.template.push(newTemplateItem)
                }
            )
            templateObj = featureTemplate
        }

        const isReadOnly = templateObj?.name != null && isNew !== true

        DrawTool_Templater._templateInDesignIdx = 0
        DrawTool_Templater._templateInDesign = []
        // prettier-ignore
        const markup = [
            `<div id='drawToolTemplaterDesign' class='${isReadOnly ? 'drawToolTemplaterIsReadOnly' : ''}'>`,
                "<div id='drawToolTemplaterDesignHeading'>",
                    `<div id='drawToolTemplaterDesignHeadingName'>`,
                        `<div>${isReadOnly ? `Template: ${templateObj?.name}` : 'New Template'}</div>`,
                        `<input id='drawToolTemplaterDesignHeadingNameInput' placeholder='Enter a Template Name' type='text' value='${templateObj?.name || ''}'></input>`,
                    "</div>",
                    "<div id='drawToolTemplaterDesignHeadingCancel' class='drawToolButton1'><i class='mdi mdi-close mdi-18px'></i></div>",
                "</div>",
                "<div id='drawToolTemplaterDesignContentWrapper'>",
                "<ul id='drawToolTemplaterDesignContent'></ul>",
                    "<div id='drawToolTemplaterDesignHeadingAdd' class='drawToolButton1'><div>Add Field</div><div><i class='mdi mdi-plus mdi-18px'></div></i></div>",
                "</div>",
            "</div>"
        ].join('\n')

        $(`#${containerId}`).append(markup)

        tippy('#drawToolTemplaterDesignHeadingCancel', {
            content: `Remove New Template`,
            placement: 'right',
            theme: 'red',
        })

        $(`#drawToolTemplaterDesignHeadingCancel`).on('click', (e) => {
            $(`#${containerId} #drawToolTemplaterDesign`).remove()
            e.stopPropagation()
        })

        // Options is the inner template configuration object for the component
        const add = (options) => {
            options = options || {}
            const idx = DrawTool_Templater._templateInDesignIdx
            DrawTool_Templater._templateInDesign[idx] = {}
            // prettier-ignore
            const liMarkup = [
                `<li class='drawToolTemplaterLi' id='drawToolTemplaterLi_${idx}'>`,
                    "<div class='drawToolTemplaterLiHead'>",
                        "<div class='drawToolTemplaterLiField'>",
                            `<div class='drawToolTemplaterLiIdx'><i class="mdi mdi-drag-vertical mdi-18px"></i></div>`,
                            `<input id='drawToolTemplaterLiFieldInput_${idx}' placeholder='Field Name' type='text' value='${options.field || ''}'></input>`,
                        "</div>",
                        "<div class='drawToolTemplaterLiType'>",
                            `<div id='drawToolTemplaterLiTypeDropdown_${idx}' class='ui dropdown short'></div>`,
                        "</div>",
                        `<div class='drawToolTemplaterDesignHeadingRemove' id='drawToolTemplaterDesignHeadingRemove_${idx}' class='drawToolButton1'><i class='mdi mdi-close mdi-18px'></i></div>`,
                    "</div>",
                    `<div id='drawToolTemplaterLiBody_${idx}' class='drawToolTemplaterLiBody'>`,
                    "</div>",
                "</li>"
            ].join('\n')

            $(`#drawToolTemplaterDesignContent`).append(liMarkup)

            $(`#drawToolTemplaterLiFieldInput_${idx}`).focus()

            $(`#drawToolTemplaterDesignHeadingRemove_${idx}`).on(
                'click',
                (e) => {
                    $(`#drawToolTemplaterLi_${idx}`).remove()
                    e.stopPropagation()
                }
            )

            const setType = (idx2, opts) => {
                opts = opts || {}
                DrawTool_Templater._templateInDesign[idx].type =
                    DrawTool_Templater._TEMPLATE_TYPES[idx2]

                const type = DrawTool_Templater._templateInDesign[idx].type
                let typeMarkup = []
                switch (type) {
                    case 'checkbox':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                "<div>",
                                    `<div>Default: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.default === true ? 'checked ' : ''}id="design-checkbox-checkbox-${idx}"/><label for="design-checkbox-checkbox-${idx}"></label></div>`,
                                "</div>",
                            "</div>",  
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedGeodataset'>`,
                                    `<div>Intersect Layer: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedGeodataset' class='dropdown' style='width: 200px;'>`,
                                        `<option value="">OFF</option>`,
                                        L_.getListOfUsedGeoDatasets().map((d) => `<option value="${d.geodataset}" ${opts.intersectedGeodataset === d.geodataset ? 'selected' : ''}>${d.display_name} (${d.geodataset})</option>`).join('\n'),
                                    `</select>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedProp'>`,
                                    `<div>and default to the value of: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_intersectedProp' placeholder='path.to.property' type='text' value='${opts.intersectedProp != null ? opts.intersectedProp : ''}' style='width: 120px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedConflict'>`,
                                    `<div>If Multiple Intersect: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedConflict' class='dropdown' style='width: 180px;'>`,
                                        `<option value="default" ${opts.intersectedConflict === 'default' ? 'selected': ''}>Set as Default</option>`,
                                        `<option value="null" ${opts.intersectedConflict === 'null' ? 'selected': ''}>Set as Null</option>`,
                                        `<option value="first" ${opts.intersectedConflict === 'first' ? 'selected': ''}>Use First Intersection</option>`,
                                        `<option value="last" ${opts.intersectedConflict === 'last' ? 'selected': ''}>Use Last Intersection</option>`,
                                    `</select>`,
                                "</div>",
                            `</div>`
                        ]
                        break
                    case 'dropdown':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div>Default: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' placeholder='Default' type='text' value='${opts.default != null ? opts.default : ''}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_values'>`,
                                    `<div>Values: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}' placeholder='Comma,separated,values,first,is,default' type='text' value='${(opts.items != null && Array.isArray(opts.items)) ? opts.items.join(',') : ''}'></input>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    case 'number':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div>Default: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' placeholder='Default' type='number' value='${opts.default != null ? opts.default : ''}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_min'>`,
                                    `<div>Min: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_min' type='number' value='${opts.min != null ? opts.min : '0'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_max'>`,
                                    `<div>Max: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_max' type='number' value='${opts.max != null ? opts.max : '100'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_step'>`,
                                    `<div>Step: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_step' type='number' value='${opts.step != null ? opts.step : '1'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_required'>`,
                                    `<div title='Required'>Req: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.required === true ? 'checked ' : ''}id="design-number-checkbox-${idx}"/><label for="design-number-checkbox-${idx}"></label></div>`,
                                "</div>",
                            "</div>",  
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedGeodataset'>`,
                                    `<div>Intersect Layer: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedGeodataset' class='dropdown' style='width: 200px;'>`,
                                        `<option value="">OFF</option>`,
                                        L_.getListOfUsedGeoDatasets().map((d) => `<option value="${d.geodataset}" ${opts.intersectedGeodataset === d.geodataset ? 'selected' : ''}>${d.display_name} (${d.geodataset})</option>`).join('\n'),
                                    `</select>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedProp'>`,
                                    `<div>and default to the value of: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_intersectedProp' placeholder='path.to.property' type='text' value='${opts.intersectedProp != null ? opts.intersectedProp : ''}' style='width: 120px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedConflict'>`,
                                    `<div>If Multiple Intersect: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedConflict' class='dropdown' style='width: 180px;'>`,
                                        `<option value="default" ${opts.intersectedConflict === 'default' ? 'selected': ''}>Set as Default</option>`,
                                        `<option value="null" ${opts.intersectedConflict === 'null' ? 'selected': ''}>Set as Null</option>`,
                                        `<option value="first" ${opts.intersectedConflict === 'first' ? 'selected': ''}>Use First Intersection</option>`,
                                        `<option value="last" ${opts.intersectedConflict === 'last' ? 'selected': ''}>Use Last Intersection</option>`,
                                    `</select>`,
                                "</div>",
                            `</div>`
                        ]
                        break
                    case 'range':
                    case 'slider':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div>Default: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' type='number' value='${opts.default != null ? opts.default : '0'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_min'>`,
                                    `<div>Min: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_min' type='number' value='${opts.min != null ? opts.min : '0'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_max'>`,
                                    `<div>Max: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_max' type='number' value='${opts.max != null ? opts.max : '100'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_step'>`,
                                    `<div>Step: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_step' type='number' value='${opts.step != null ? opts.step : '1'}'></input>`,
                                "</div>",
                            "</div>",  
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedGeodataset'>`,
                                    `<div>Intersect Layer: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedGeodataset' class='dropdown' style='width: 200px;'>`,
                                        `<option value="">OFF</option>`,
                                        L_.getListOfUsedGeoDatasets().map((d) => `<option value="${d.geodataset}" ${opts.intersectedGeodataset === d.geodataset ? 'selected' : ''}>${d.display_name} (${d.geodataset})</option>`).join('\n'),
                                    `</select>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedProp'>`,
                                    `<div>and default to the value of: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_intersectedProp' placeholder='path.to.property' type='text' value='${opts.intersectedProp != null ? opts.intersectedProp : ''}' style='width: 120px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedConflict'>`,
                                    `<div>If Multiple Intersect: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedConflict' class='dropdown' style='width: 180px;'>`,
                                        `<option value="default" ${opts.intersectedConflict === 'default' ? 'selected': ''}>Set as Default</option>`,
                                        `<option value="null" ${opts.intersectedConflict === 'null' ? 'selected': ''}>Set as Null</option>`,
                                        `<option value="first" ${opts.intersectedConflict === 'first' ? 'selected': ''}>Use First Intersection</option>`,
                                        `<option value="last" ${opts.intersectedConflict === 'last' ? 'selected': ''}>Use Last Intersection</option>`,
                                    `</select>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    case 'text':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div>Default: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' placeholder='Default' type='text' value='${opts.default != null ? opts.default : ''}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_min'>`,
                                    `<div title='Min # of Characters'>Min: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_min' type='number' value='${opts.minLength != null ? opts.minLength : '0'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_max'>`,
                                    `<div title='Max # of Characters'>Max: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_max' type='number' value='${opts.maxLength != null ? opts.maxLength : '100'}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_regex'>`,
                                    `<div>Regex: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_regex' type='text' value='${opts.regex != null ? opts.regex : ''}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_required'>`,
                                    `<div title='Required'>Req: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.required === true ? 'checked ' : ''}id="design-number-checkbox-${idx}"/><label for="design-number-checkbox-${idx}"></label></div>`,
                                "</div>",
                            `</div>`,  
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedGeodataset'>`,
                                    `<div>Intersect Layer: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedGeodataset' class='dropdown' style='width: 200px;'>`,
                                        `<option value="">OFF</option>`,
                                        L_.getListOfUsedGeoDatasets().map((d) => `<option value="${d.geodataset}" ${opts.intersectedGeodataset === d.geodataset ? 'selected' : ''}>${d.display_name} (${d.geodataset})</option>`).join('\n'),
                                    `</select>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedProp'>`,
                                    `<div>and default to the value of: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_intersectedProp' placeholder='path.to.property' type='text' value='${opts.intersectedProp != null ? opts.intersectedProp : ''}' style='width: 120px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedConflict'>`,
                                    `<div>If Multiple Intersect: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedConflict' class='dropdown' style='width: 180px;'>`,
                                        `<option value="default" ${opts.intersectedConflict === 'default' ? 'selected': ''}>Set as Default</option>`,
                                        `<option value="null" ${opts.intersectedConflict === 'null' ? 'selected': ''}>Set as Null</option>`,
                                        `<option value="first" ${opts.intersectedConflict === 'first' ? 'selected': ''}>Use First Intersection</option>`,
                                        `<option value="last" ${opts.intersectedConflict === 'last' ? 'selected': ''}>Use Last Intersection</option>`,
                                        `<option value="array" ${opts.intersectedConflict === 'array' ? 'selected': ''}>Comma-Separate All Intersections</option>`,
                                    `</select>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    case 'textarea':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div>Default: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' placeholder='Default' type='text' value='${opts.default != null ? opts.default : ''}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_max'>`,
                                    `<div>Max length: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_max' type='number' value='${opts.maxLength != null ? opts.maxLength : ''}''></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_required'>`,
                                    `<div title='Required'>Req: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.required === true ? 'checked ' : ''}id="design-textarea-checkbox-${idx}"/><label for="design-textarea-checkbox-${idx}"></label></div>`,
                                "</div>",
                            "</div>",  
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedGeodataset'>`,
                                    `<div>Intersect Layer: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedGeodataset' class='dropdown' style='width: 200px;'>`,
                                        `<option value="">OFF</option>`,
                                        L_.getListOfUsedGeoDatasets().map((d) => `<option value="${d.geodataset}" ${opts.intersectedGeodataset === d.geodataset ? 'selected' : ''}>${d.display_name} (${d.geodataset})</option>`).join('\n'),
                                    `</select>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedProp'>`,
                                    `<div>and default to the value of: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_intersectedProp' placeholder='path.to.property' type='text' value='${opts.intersectedProp != null ? opts.intersectedProp : ''}' style='width: 120px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedConflict'>`,
                                    `<div>If Multiple Intersect: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedConflict' class='dropdown' style='width: 180px;'>`,
                                        `<option value="default" ${opts.intersectedConflict === 'default' ? 'selected': ''}>Set as Default</option>`,
                                        `<option value="null" ${opts.intersectedConflict === 'null' ? 'selected': ''}>Set as Null</option>`,
                                        `<option value="first" ${opts.intersectedConflict === 'first' ? 'selected': ''}>Use First Intersection</option>`,
                                        `<option value="last" ${opts.intersectedConflict === 'last' ? 'selected': ''}>Use Last Intersection</option>`,
                                        `<option value="array" ${opts.intersectedConflict === 'array' ? 'selected': ''}>Comma-Separate All Intersections</option>`,
                                    `</select>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    case 'date':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div title='Use "NOW", "STARTTIME" and "ENDTIME" for dynamic defaults.'>Default: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' placeholder='Default' type='text' value='${opts.default != null ? opts.default : ''}'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_format'>`,
                                    `<div>Format: </div>`,
                                    `<div id='drawToolTemplaterLiBody_${idx}_format' class='drawToolTemplaterLiBodyDropdown_format ui dropdown short' value='${opts.format != null ? opts.format : DrawTool_Templater._DATE_FORMATS[0]}'></div>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_isStart'>`,
                                    `<div title="Use this field as the feature's Start Time">S<i class='mdi mdi-clock-out mdi-18px'></i>: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.isStart === true ? 'checked ' : ''}id="design-date-checkbox-${idx}-start"/><label for="design-date-checkbox-${idx}-start"></label></div>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_isEnd'>`,
                                    `<div title="Use this field as the feature's End Time">E<i class='mdi mdi-clock-in mdi-18px'></i>: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.isEnd === true ? 'checked ' : ''}id="design-date-checkbox-${idx}-end"/><label for="design-date-checkbox-${idx}-end"></label></div>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_required'>`,
                                    `<div title='Required'>Req: </div>`,
                                    `<div class="mmgis-checkbox"><input type="checkbox" ${opts.required === true ? 'checked ' : ''}id="design-date-checkbox-${idx}"/><label for="design-date-checkbox-${idx}"></label></div>`,
                                "</div>",
                            "</div>",  
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedGeodataset'>`,
                                    `<div>Intersect Layer: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedGeodataset' class='dropdown' style='width: 200px;'>`,
                                        `<option value="">OFF</option>`,
                                        L_.getListOfUsedGeoDatasets().map((d) => `<option value="${d.geodataset}" ${opts.intersectedGeodataset === d.geodataset ? 'selected' : ''}>${d.display_name} (${d.geodataset})</option>`).join('\n'),
                                    `</select>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedProp'>`,
                                    `<div>and default to the value of: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_intersectedProp' placeholder='path.to.property' type='text' value='${opts.intersectedProp != null ? opts.intersectedProp : ''}' style='width: 120px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_intersectedConflict'>`,
                                    `<div>If Multiple Intersect: </div>`,
                                    `<select id='drawToolTemplaterLiBody_${idx}_intersectedConflict' class='dropdown' style='width: 180px;'>`,
                                        `<option value="default" ${opts.intersectedConflict === 'default' ? 'selected': ''}>Set as Default</option>`,
                                        `<option value="null" ${opts.intersectedConflict === 'null' ? 'selected': ''}>Set as Null</option>`,
                                        `<option value="first" ${opts.intersectedConflict === 'first' ? 'selected': ''}>Use First Intersection</option>`,
                                        `<option value="last" ${opts.intersectedConflict === 'last' ? 'selected': ''}>Use Last Intersection</option>`,
                                    `</select>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    case 'incrementer':
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_default'>`,
                                    `<div>Value with single '#' to place incrementing number: </div>`,
                                    `<input id='drawToolTemplaterLiFieldInput_${idx}_default' placeholder='ID-#' type='text' value='${opts.default != null ? opts.default : ''}'></input>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    case 'point':
                        const currentColor = opts.defaultColor || '#ff0000'
                        // prettier-ignore
                        typeMarkup = [
                            `<div class='drawToolTemplaterLiBody_${type}'>`,
                                `<div class='drawToolTemplaterLiBody_${type}_defaultName'>`,
                                    `<div title='Single name or comma-separated list. Use # for auto-incrementing number (e.g., "Point #" or "A#, B#, C#")'>Default Name: </div>`,
                                    `<input title='Single name or comma-separated list. Use # for auto-incrementing number (e.g., "Point #" or "A#, B#, C#")' id='drawToolTemplaterLiFieldInput_${idx}_defaultName' placeholder='Point #' type='text' value='${opts.defaultName != null ? opts.defaultName : 'Point #'}' style='width: 240px;'></input>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_defaultColor'>`,
                                    `<div>Default Color: </div>`,
                                    `<div class='drawToolTemplaterColorSelector' id='drawToolTemplaterColorSelector_${idx}'>`,
                                        DrawTool_Templater._pointColors.map(color =>
                                            `<div class='drawToolTemplaterColorOption ${color === currentColor ? 'active' : ''}'
                                                 style='background: ${color}'
                                                 data-color='${color}'
                                                 data-idx='${idx}'></div>`
                                        ).join(''),
                                    `</div>`,
                                "</div>",
                                `<div class='drawToolTemplaterLiBody_${type}_maxPoints'>`,
                                    `<div title='Maximum number of points. 0 or empty = unlimited'>Max Points: </div>`,
                                    `<input title='Maximum number of points. 0 or empty = unlimited' id='drawToolTemplaterLiFieldInput_${idx}_maxPoints' type='number' min='0' value='${opts.maxPoints != null ? opts.maxPoints : 0}' style='width: 80px;'></input>`,
                                "</div>",
                            "</div>"
                        ]
                        break
                    default:
                        break
                }

                // Add html
                $(`#drawToolTemplaterLiBody_${idx}`).html(typeMarkup.join('\n'))

                // Init color selector for point type
                if (type === 'point') {
                    $(
                        `#drawToolTemplaterColorSelector_${idx} .drawToolTemplaterColorOption`
                    ).on('click', function () {
                        $(
                            `#drawToolTemplaterColorSelector_${idx} .drawToolTemplaterColorOption`
                        ).removeClass('active')
                        $(this).addClass('active')
                    })
                }

                // Init dropdowns
                const f =
                    opts.format != null
                        ? opts.format
                        : DrawTool_Templater._DATE_FORMATS[0]
                const initialFormatIndex = Math.max(
                    DrawTool_Templater._DATE_FORMATS.indexOf(f),
                    0
                )
                $(`#drawToolTemplaterLiBody_${idx}_format`).html(
                    Dropy.construct(
                        DrawTool_Templater._DATE_FORMATS,
                        'Formats',
                        initialFormatIndex,
                        {
                            openUp: false,
                            dark: true,
                        }
                    )
                )
                Dropy.init(
                    $(`#drawToolTemplaterLiBody_${idx}_format`),
                    (idx2) => {
                        $(`#drawToolTemplaterLiBody_${idx}_format`).attr(
                            'value',
                            DrawTool_Templater._DATE_FORMATS[idx2]
                        )
                    }
                )
            }

            let initialType = options.type || 'checkbox'
            if (initialType === 'range') initialType = 'slider'

            let initialTypeIdx =
                DrawTool_Templater._TEMPLATE_TYPES.indexOf(initialType)
            $(`#drawToolTemplaterLiTypeDropdown_${idx}`).html(
                Dropy.construct(
                    DrawTool_Templater._TEMPLATE_TYPES,
                    'Types',
                    initialTypeIdx,
                    {
                        openUp: false,
                        dark: true,
                    }
                )
            )
            Dropy.init($(`#drawToolTemplaterLiTypeDropdown_${idx}`), (idx2) => {
                setType(idx2)
            })
            setType(initialTypeIdx, options)

            DrawTool_Templater._templateInDesignIdx++
        }

        $(`#drawToolTemplaterDesignHeadingAdd`).on('click', () => {
            add()
        })

        if (
            isReadOnly ||
            featureToMakeTemplateFrom != null ||
            Array.isArray(templateObj.template)
        ) {
            if (Array.isArray(templateObj.template))
                templateObj.template.forEach((t) => {
                    add(t)
                })
        }

        const listToSort = document.getElementById(
            'drawToolTemplaterDesignContent'
        )
        Sortable.create(listToSort, {
            animation: 150,
            easing: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
            handle: '.drawToolTemplaterLiIdx',
            onStart: () => {},
            onChange: () => {},
            onEnd: () => {},
        })
    },
    getDesignedTemplate: function (containerId, reservedTemplates) {
        // For if no template is being designed
        if (!$(`#${containerId}`).length) {
            return true
        }

        reservedTemplates = reservedTemplates || {}
        const reservedTemplatesNames = ['NONE'].concat(
            Object.keys(reservedTemplates)
        )

        const name = $(
            `#${containerId} #drawToolTemplaterDesignHeadingNameInput`
        ).val()

        const items = []
        const invalids = {}
        $(`#${containerId} #drawToolTemplaterDesignContent > li`).each(
            function () {
                const item = {}
                item.field = $(this)
                    .find('.drawToolTemplaterLiField > input')
                    .val()
                item.type = $(this)
                    .find(
                        '.drawToolTemplaterLiType .dropy__content li > a.selected'
                    )
                    .text()
                switch (item.type) {
                    case 'checkbox':
                        item.default = $(this)
                            .find('.drawToolTemplaterLiBody_checkbox input')
                            .prop('checked')
                        item.intersectedGeodataset = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_checkbox_intersectedGeodataset select'
                            )
                            .val()
                        item.intersectedProp = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_checkbox_intersectedProp input'
                            )
                            .val()
                        item.intersectedConflict = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_checkbox_intersectedConflict select'
                            )
                            .val()
                        break
                    case 'dropdown':
                        item.default = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_dropdown_default input'
                            )
                            .val()
                        item.items = (
                            $(this)
                                .find(
                                    '.drawToolTemplaterLiBody_dropdown_values input'
                                )
                                .val() || ''
                        ).split(',')
                        break
                    case 'number':
                        item.default = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_number_default input'
                            )
                            .val()
                        if (item.default != '')
                            item.default = parseFloat(item.default)
                        item.min = $(this)
                            .find('.drawToolTemplaterLiBody_number_min input')
                            .val()
                        if (item.min != '') item.min = parseFloat(item.min)
                        item.max = $(this)
                            .find('.drawToolTemplaterLiBody_number_max input')
                            .val()
                        if (item.max != '') item.max = parseFloat(item.max)
                        item.step = $(this)
                            .find('.drawToolTemplaterLiBody_number_step input')
                            .val()
                        if (item.step != '') item.step = parseFloat(item.step)
                        item.required = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_number_required input'
                            )
                            .prop('checked')
                        item.intersectedGeodataset = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_number_intersectedGeodataset select'
                            )
                            .val()
                        item.intersectedProp = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_number_intersectedProp input'
                            )
                            .val()
                        item.intersectedConflict = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_number_intersectedConflict select'
                            )
                            .val()
                        break
                    case 'slider':
                        item.default = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_slider_default input'
                            )
                            .val()
                        if (item.default != '')
                            item.default = parseFloat(item.default)
                        item.min = $(this)
                            .find('.drawToolTemplaterLiBody_slider_min input')
                            .val()
                        if (item.min != '') item.min = parseFloat(item.min)
                        item.max = $(this)
                            .find('.drawToolTemplaterLiBody_slider_max input')
                            .val()
                        if (item.max != '') item.max = parseFloat(item.max)
                        item.step = $(this)
                            .find('.drawToolTemplaterLiBody_slider_step input')
                            .val()
                        if (item.step != '') item.step = parseFloat(item.step)
                        item.intersectedGeodataset = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_slider_intersectedGeodataset select'
                            )
                            .val()
                        item.intersectedProp = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_slider_intersectedProp input'
                            )
                            .val()
                        item.intersectedConflict = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_slider_intersectedConflict select'
                            )
                            .val()
                        break
                    case 'text':
                        item.default = $(this)
                            .find('.drawToolTemplaterLiBody_text_default input')
                            .val()
                        item.minLength = $(this)
                            .find('.drawToolTemplaterLiBody_text_min input')
                            .val()
                        if (item.minLength != '')
                            item.minLength = parseFloat(item.minLength)
                        item.maxLength = $(this)
                            .find('.drawToolTemplaterLiBody_text_max input')
                            .val()
                        if (item.maxLength != '')
                            item.maxLength = parseFloat(item.maxLength)
                        item.regex = $(this)
                            .find('.drawToolTemplaterLiBody_text_regex input')
                            .val()
                        item.required = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_text_required input'
                            )
                            .prop('checked')
                        item.intersectedGeodataset = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_text_intersectedGeodataset select'
                            )
                            .val()
                        item.intersectedProp = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_text_intersectedProp input'
                            )
                            .val()
                        item.intersectedConflict = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_text_intersectedConflict select'
                            )
                            .val()
                        break
                    case 'textarea':
                        item.default = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_textarea_default input'
                            )
                            .val()
                        item.maxLength = $(this)
                            .find('.drawToolTemplaterLiBody_textarea_max input')
                            .val()
                        if (item.maxLength != '')
                            item.maxLength = parseFloat(item.maxLength)
                        item.required = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_textarea_required input'
                            )
                            .prop('checked')
                        item.intersectedGeodataset = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_textarea_intersectedGeodataset select'
                            )
                            .val()
                        item.intersectedProp = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_textarea_intersectedProp input'
                            )
                            .val()
                        item.intersectedConflict = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_textarea_intersectedConflict select'
                            )
                            .val()
                        break
                    case 'date':
                        item.default = $(this)
                            .find('.drawToolTemplaterLiBody_date_default input')
                            .val()
                        item.format = $(this)
                            .find('.drawToolTemplaterLiBodyDropdown_format')
                            .attr('value')
                        item.isStart = $(this)
                            .find('.drawToolTemplaterLiBody_date_isStart input')
                            .prop('checked')
                        item.isEnd = $(this)
                            .find('.drawToolTemplaterLiBody_date_isEnd input')
                            .prop('checked')
                        item.required = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_date_required input'
                            )
                            .prop('checked')
                        item.intersectedGeodataset = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_date_intersectedGeodataset select'
                            )
                            .val()
                        item.intersectedProp = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_date_intersectedProp input'
                            )
                            .val()
                        item.intersectedConflict = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_date_intersectedConflict select'
                            )
                            .val()
                        break
                    case 'incrementer':
                        item.default = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_incrementer_default input'
                            )
                            .val()

                        if (
                            ((item.default || '').match(/#/g) || []).length != 1
                        ) {
                            invalids[
                                item.field
                            ] = `'${item.field}' must contain exactly one '#' symbol`
                        }
                        break
                    case 'point':
                        item.default = []
                        item.defaultName =
                            $(this)
                                .find(
                                    '.drawToolTemplaterLiBody_point_defaultName input'
                                )
                                .val() || 'Point #'
                        item.defaultColor =
                            $(this)
                                .find(
                                    '.drawToolTemplaterColorSelector .drawToolTemplaterColorOption.active'
                                )
                                .data('color') || '#ff0000'
                        item.maxPoints = $(this)
                            .find(
                                '.drawToolTemplaterLiBody_point_maxPoints input'
                            )
                            .val()
                        if (item.maxPoints != '')
                            item.maxPoints = parseInt(item.maxPoints)
                        break
                    default:
                        break
                }
                items.push(item)
            }
        )

        const template = {
            name: name,
            template: items || [],
        }
        if (template.template.length === 0) {
            return true
        }
        // Validate
        if (template.name == null || template.name == '') {
            CursorInfo.update(
                `Please enter a template name`,
                6000,
                true,
                { x: 305, y: 6 },
                '#e9ff26',
                'black'
            )
            return false
        }
        if (reservedTemplatesNames.includes(template.name)) {
            if (
                !DrawTool_Templater.areTemplatesEqual(
                    reservedTemplates[template.name],
                    template.template
                )
            ) {
                CursorInfo.update(
                    `Use a different template name. A template by the name '${template.name}' already exists.`,
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
                return false
            }
        }

        // Only allow one of each:
        let hasADateStartTime = false
        let hasADateEndTime = false

        for (let i = 0; i < template.template.length; i++) {
            const t = template.template[i]
            if (t.field == null || t.field == '') {
                CursorInfo.update(
                    `Template cannot contain empty 'Field Names'`,
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
                return false
            }
            if (t.field == 'uuid') {
                CursorInfo.update(
                    `Template cannot contain the field name 'uuid'`,
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
                return false
            }
            if (t.type === 'date') {
                if (t.isStart && t.isEnd) {
                    CursorInfo.update(
                        `Template cannot use same date field as Start Time and End Time.`,
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    return false
                } else if (t.isStart) {
                    if (hasADateStartTime === false) hasADateStartTime = true
                    else {
                        CursorInfo.update(
                            `Template cannot use multiple date fields as Start Times.`,
                            6000,
                            true,
                            { x: 305, y: 6 },
                            '#e9ff26',
                            'black'
                        )
                        return false
                    }
                } else if (t.isEnd) {
                    if (hasADateEndTime === false) hasADateEndTime = true
                    else {
                        CursorInfo.update(
                            `Template cannot use multiple date fields as End Times.`,
                            6000,
                            true,
                            { x: 305, y: 6 },
                            '#e9ff26',
                            'black'
                        )
                        return false
                    }
                }
            }
            if (t.regex != null) {
                try {
                    new RegExp(t.regex)
                } catch (error) {
                    // no good
                    CursorInfo.update(
                        `Template cannot contain invalid regex: ${t.regex}`,
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    return false
                }
            }
            if (invalids[t.field] != null) {
                CursorInfo.update(
                    `Template field: ${invalids[t.field]}`,
                    6000,
                    true,
                    { x: 305, y: 6 },
                    '#e9ff26',
                    'black'
                )
                return false
            }
        }
        return template
    },
    areTemplatesEqual: function (t1, t2) {
        if (t1.length !== t2.length) return false

        for (let i = 0; i < t1.length; i++) {
            const tA = t1[i]
            const tB = t2[i]

            let keys = Object.keys(tA)

            for (let k = 0; k < keys.length; k++) {
                const key = keys[k]
                if (tA[key] !== tB[key]) {
                    if (key === 'required') {
                        if (tA[key] === true || tB[key] === true) {
                            return false
                        }
                    } else {
                        if (
                            (tA[key] == null && tB[key] == '') ||
                            (tA[key] == '' && tB[key] == null)
                        ) {
                            // Okay if null vs ''
                        } else {
                            if (
                                Array.isArray(tA[key]) &&
                                Array.isArray(tB[key]) &&
                                JSON.stringify(tA[key]) ===
                                    JSON.stringify(tB[key])
                            ) {
                            } else return false
                        }
                    }
                }
            }

            // And do the reverse (in case tB has more keys than tA)
            keys = Object.keys(tB)

            for (let k = 0; k < keys.length; k++) {
                const key = keys[k]
                if (tA[key] !== tB[key]) {
                    if (key === 'required') {
                        if (tA[key] === true || tB[key] === true) {
                            return false
                        }
                    } else {
                        if (
                            (tA[key] == null && tB[key] == '') ||
                            (tA[key] == '' && tB[key] == null)
                        ) {
                            // Okay if null vs ''
                        } else {
                            if (
                                Array.isArray(tA[key]) &&
                                Array.isArray(tB[key]) &&
                                JSON.stringify(tA[key]) ===
                                    JSON.stringify(tB[key])
                            ) {
                            } else return false
                        }
                    }
                }
            }
        }
        return true
    },
    getTemplateDefaults: async function (
        template,
        layer,
        toAdd,
        recomputeOnly = false
    ) {
        return new Promise(async (resolve, reject) => {
            let defaultHasBeenSet = false
            const intersectedGeodatasets = {}
            const defaultProps = {}
            for (let i = 0; i < template.length; i++) {
                let t = template[i]
                defaultHasBeenSet = false
                if (
                    t.field != null &&
                    t.intersectedGeodataset != null &&
                    t.intersectedGeodataset != '' &&
                    t.intersectedProp != null &&
                    t.intersectedProp != ''
                ) {
                    let body = {
                        layer: t.intersectedGeodataset,
                        intersect: toAdd.geometry,
                        limit: 10,
                    }

                    // time
                    if (L_.TimeControl_.enabled === true) {
                        body.starttime = L_.TimeControl_.startTime
                        body.endtime = L_.TimeControl_.endTime
                    }

                    let intersectResult =
                        intersectedGeodatasets[t.intersectedGeodataset] != null
                            ? intersectedGeodatasets[t.intersectedGeodataset]
                            : await new Promise(async (resolve, reject) => {
                                  calls.api(
                                      'geodatasets_intersect',
                                      body,
                                      (data) => {
                                          resolve(data)
                                      },
                                      function (data) {
                                          console.error(data)
                                          resolve(false)
                                      }
                                  )
                              })
                    intersectedGeodatasets[t.intersectedGeodataset] =
                        intersectResult

                    let f = t.field
                    if (f != null && intersectResult) {
                        switch (t.intersectedConflict) {
                            case 'null':
                                if (
                                    intersectResult?.body?.features?.length ===
                                    0
                                ) {
                                    defaultProps[f] = null
                                    defaultHasBeenSet = true
                                } else if (
                                    intersectResult?.body?.features?.length > 1
                                ) {
                                    defaultProps[f] = null
                                    defaultHasBeenSet = true
                                }
                                break
                            case 'first':
                                if (
                                    intersectResult?.body?.features?.length ===
                                    0
                                ) {
                                    defaultProps[f] = null
                                } else {
                                    defaultProps[f] = F_.getIn(
                                        intersectResult?.body?.features[0]
                                            .properties,
                                        t.intersectedProp.split('.'),
                                        null
                                    )
                                    defaultHasBeenSet = true
                                }
                                break
                            case 'last':
                                if (
                                    intersectResult?.body?.features?.length ===
                                    0
                                ) {
                                    defaultProps[f] = null
                                } else {
                                    defaultProps[f] = F_.getIn(
                                        intersectResult?.body?.features[
                                            intersectResult?.body?.features
                                                ?.length - 1
                                        ].properties,
                                        t.intersectedProp.split('.'),
                                        null
                                    )
                                    defaultHasBeenSet = true
                                }
                                break
                            case 'array':
                                if (
                                    intersectResult?.body?.features?.length ===
                                    0
                                ) {
                                    defaultProps[f] = null
                                    defaultHasBeenSet = true
                                } else if (
                                    intersectResult?.body?.features?.length > 0
                                ) {
                                    const arrayVal = []
                                    intersectResult?.body?.features.forEach(
                                        (feature) => {
                                            arrayVal.push(
                                                F_.getIn(
                                                    feature.properties,
                                                    t.intersectedProp.split(
                                                        '.'
                                                    ),
                                                    null
                                                )
                                            )
                                        }
                                    )
                                    defaultProps[f] = arrayVal.join(',')
                                    defaultHasBeenSet = true
                                }
                                break
                            default:
                                defaultProps[f] = null
                                break
                        }

                        if (!defaultHasBeenSet) {
                            if (intersectResult?.body?.features?.[0] != null) {
                                defaultProps[f] = F_.getIn(
                                    intersectResult.body.features[0].properties,
                                    t.intersectedProp.split('.'),
                                    null
                                )
                                defaultHasBeenSet = true
                            }
                        }
                    }
                    if (
                        t.intersectedConflict != 'null' &&
                        defaultProps[f] == null
                    )
                        defaultHasBeenSet = false

                    if (
                        t.intersectedConflict != null &&
                        intersectResult?.body?.features?.length != 1
                    ) {
                        if (intersectResult?.body?.features?.length === 0)
                            CursorInfo.update(
                                `No intersected feature for templating. Using fallbacks.`,
                                5000,
                                true,
                                null,
                                '#e9ff26',
                                'black',
                                null,
                                null,
                                null,
                                5000
                            )
                        else
                            CursorInfo.update(
                                `Multiple intersected features for templating. Using fallbacks.`,
                                5000,
                                true,
                                null,
                                '#08aeea',
                                'black',
                                null,
                                null,
                                null,
                                5000
                            )
                    }
                }

                if (
                    t.field != null &&
                    t.default != null &&
                    t.default != '' &&
                    defaultHasBeenSet === false
                ) {
                    let f = t.field
                    let v = t.default
                    let overrideRecomputeOnlyHere = false
                    switch (t.type) {
                        case 'incrementer':
                            if (recomputeOnly != true) {
                                const nextIncrement =
                                    DrawTool_Templater._validateIncrement(
                                        t.default,
                                        t,
                                        layer
                                    )
                                v = nextIncrement.newValue
                            }
                            break
                        case 'date':
                            if (v === 'NOW') {
                                v = moment
                                    .utc(new Date().getTime())
                                    .format(t.format || 'YYYY-MM-DDTHH:mm:ss')
                                overrideRecomputeOnlyHere = true
                            } else if (v === 'STARTTIME') {
                                v = moment
                                    .utc(TimeControl.getStartTime())
                                    .format(t.format || 'YYYY-MM-DDTHH:mm:ss')
                                overrideRecomputeOnlyHere = true
                            } else if (v === 'ENDTIME') {
                                v = moment
                                    .utc(TimeControl.getEndTime())
                                    .format(t.format || 'YYYY-MM-DDTHH:mm:ss')
                                overrideRecomputeOnlyHere = true
                            }
                            break
                        case 'point':
                            defaultProps[f] = t.default || []
                            break
                        default:
                    }
                    if (
                        recomputeOnly != true ||
                        overrideRecomputeOnlyHere === true
                    ) {
                        defaultProps[f] = v
                    }
                }

                // Last check to cast all non-bool checkbox values to bools
                if (recomputeOnly != true) {
                    if (
                        t.field != null &&
                        t.type === 'checkbox' &&
                        typeof defaultProps[t.field] !== 'boolean'
                    )
                        defaultProps[t.field] = Boolean(defaultProps[t.field])
                    else if (
                        t.field != null &&
                        t.type === 'number' &&
                        t.min != null &&
                        t.max != null &&
                        !isNaN(parseFloat(defaultProps[t.field])) &&
                        (parseFloat(defaultProps[t.field]) > t.max ||
                            parseFloat(defaultProps[t.field]) < t.min)
                    )
                        defaultProps[t.field] = Math.min(
                            Math.max(parseFloat(defaultProps[t.field]), t.min),
                            t.max
                        )
                    else if (
                        t.field != null &&
                        t.type === 'slider' &&
                        t.min != null &&
                        t.max != null &&
                        !isNaN(parseFloat(defaultProps[t.field])) &&
                        (parseFloat(defaultProps[t.field]) > t.max ||
                            parseFloat(defaultProps[t.field]) < t.min)
                    )
                        defaultProps[t.field] = Math.min(
                            Math.max(parseFloat(defaultProps[t.field]), t.min),
                            t.max
                        )
                }
            }
            resolve(defaultProps)
        })
    },
}

export default DrawTool_Templater
