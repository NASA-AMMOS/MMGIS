import $ from 'jquery'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Viewer_ from '../../Basics/Viewer_/Viewer_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Description from '../../Ancillary/Description'
import TimeControl from '../../Basics/TimeControl_/TimeControl'
import Modal from '../../Ancillary/Modal'
import HTML2Canvas from 'html2canvas'
import gifshot from 'gifshot'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

import './AnimationTool.css'

//Add the tool markup
// prettier-ignore
const markup = [
    "<div id='animationTool'>",
        "<div id='animationToolContent'>",
            "<div id='animationToolSteps'>",
                "<div class='animation-step active' data-step='1'>",
                    "<div class='step-number'>1</div>",
                    "<div class='step-title'>Select Area</div>",
                "</div>",
                "<div class='animation-step' data-step='2'>",
                    "<div class='step-number'>2</div>",
                    "<div class='step-title'>Set Time Range</div>",
                "</div>",
                "<div class='animation-step' data-step='3'>",
                    "<div class='step-number'>3</div>",
                    "<div class='step-title'>Configure Playback</div>",
                "</div>",
                "<div class='animation-step' data-step='4'>",
                    "<div class='step-number'>4</div>",
                    "<div class='step-title'>Export</div>",
                "</div>",
            "</div>",
            "<div id='animationToolPanels'>",
                "<div id='animationPanel1' class='animation-panel active'>",
                    "<div class='panel-content'>",
                        "<h4>Select Animation Area</h4>",
                        "<p>Choose a bounding box area for your animation.</p>",
                        "<div class='bbox-controls'>",
                            "<div class='bbox-input-group'>",
                                "<label>North:</label>",
                                "<input type='number' id='bboxNorth' step='0.000001' placeholder='90.0'>",
                            "</div>",
                            "<div class='bbox-input-group'>",
                                "<label>South:</label>",
                                "<input type='number' id='bboxSouth' step='0.000001' placeholder='-90.0'>",
                            "</div>",
                            "<div class='bbox-input-group'>",
                                "<label>East:</label>",
                                "<input type='number' id='bboxEast' step='0.000001' placeholder='180.0'>",
                            "</div>",
                            "<div class='bbox-input-group'>",
                                "<label>West:</label>",
                                "<input type='number' id='bboxWest' step='0.000001' placeholder='-180.0'>",
                            "</div>",
                            "<div class='bbox-map-controls'>",
                                "<button class='map-control-button' id='resetValues'>Reset Values</button>",
                                "<button class='map-control-button' id='useCurrentView'>Use Current View</button>",
                                "<button class='map-control-button' id='drawBoundingBox'>Draw on Map</button>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='animationPanel2' class='animation-panel'>",
                    "<div class='panel-content'>",
                        "<h4>Set Time Range</h4>",
                        "<p>Define the time period for your animation.</p>",
                        "<div class='time-controls'>",
                            "<div class='time-input-group'>",
                                "<label>Start Date:</label>",
                                "<input type='datetime-local' id='timeStart' required>",
                            "</div>",
                            "<div class='time-input-group'>",
                                "<label>End Date:</label>",
                                "<input type='datetime-local' id='timeEnd' required>",
                            "</div>",
                            "<div class='step-selector'>",
                                "<label>Step:</label>",
                                "<input type='number' id='timeStep' min='0' max='99' step='0.5' value='1' style='width: 60px; padding: 4px; margin-right: 10px;'>",
                            "</div>",
                            "<div class='interval-selector'>",
                                "<label>Time Interval:</label>",
                                "<div style='display: flex; align-items: center; gap: 10px;'>",
                                    "<select id='timeInterval'>",
                                        "<option value='second'>Second</option>",
                                        "<option value='minute'>Minute</option>",
                                        "<option value='hour'>Hour</option>",
                                        "<option value='day' selected>Day</option>",
                                        "<option value='week'>Week</option>",
                                        "<option value='month'>Month</option>",
                                        "<option value='year'>Year</option>",
                                        "<option value='decade'>Decade</option>",
                                        "<option value='century'>Century</option>",
                                    "</select>",
                                "</div>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='animationPanel3' class='animation-panel'>",
                    "<div class='panel-content'>",
                        "<h4>Animation Settings</h4>",
                        "<div class='control-group'>",
                            "<label>One Frame:</label>",
                            "<div class='slider-container'>",
                                "<input type='range' id='frameRateSlider' min='0.05' max='10' step='0.01' value='2'>",
                                "<span class='slider-value' id='frameRateValue'>Every 0.5s</span>",
                            "</div>",
                        "</div>",
                        "<div class='control-group'>",
                            "<label>Play Direction:</label>",
                            "<div class='radio-group'>",
                                "<label class='radio-option'>",
                                    "<input type='radio' name='playDirection' value='forward' checked>",
                                    "<span>Forward</span>",
                                "</label>",
                                "<label class='radio-option'>",
                                    "<input type='radio' name='playDirection' value='backward'>",
                                    "<span>Backward</span>",
                                "</label>",
                            "</div>",
                        "</div>",
                        "<div class='control-group'>",
                            "<div class='checkbox-group'>",
                                "<input type='checkbox' id='loopAnimation'>",
                                "<label for='loopAnimation'>Loop Animation</label>",
                            "</div>",
                        "</div>",
                        "<div class='control-group'>",
                            "<label for='exportTitle'>Title (optional):</label>",
                            "<input type='text' id='exportTitle' placeholder='Enter animation title' style='width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ccc; border-radius: 4px;'>",
                        "</div>",
                        "<div class='control-group'>",
                            "<div class='checkbox-group'>",
                                "<input type='checkbox' id='showTimeStep'>",
                                "<label for='showTimeStep'>Include Time Step</label>",
                            "</div>",
                        "</div>",
                        "<div class='control-group'>",
                            "<div class='checkbox-group'>",
                                "<input type='checkbox' id='showScaleBar'>",
                                "<label for='showScaleBar'>Include Scale Bar</label>",
                            "</div>",
                        "</div>",
                        "<div class='control-group'>",
                            "<label>Layer Refresh Rate:</label>",
                            "<div class='slider-container'>",
                                "<input type='range' id='layerRefreshRateSlider' min='100' max='60000' step='100' value='500'>",
                                "<span class='slider-value' id='layerRefreshRateValue'>0.5s</span>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='animationPanel4' class='animation-panel'>",
                    "<div class='panel-content'>",
                        "<h4>Export Animation</h4>",
                        "<p>Choose your preferred export format.</p>",
                        "<div class='export-options'>",
                            "<div class='export-option'>",
                                "<div class='export-option-info'>",
                                    "<h4>GIF Animation</h4>",
                                    "<p>Animated GIF file suitable for web sharing</p>",
                                "</div>",
                                "<button class='export-button' id='export-gif'>Export GIF</button>",
                            "</div>",
                            "<div class='export-option'>",
                                "<div class='export-option-info'>",
                                    "<h4>MP4 Video</h4>",
                                    "<p>High-quality MP4 video file</p>",
                                "</div>",
                                "<button class='export-button' id='export-mp4'>Export MP4</button>",
                            "</div>",
                            "<div class='export-option'>",
                                "<div class='export-option-info'>",
                                    "<h4>Image Sequence</h4>",
                                    "<p>Individual PNG frames</p>",
                                "</div>",
                                "<button class='export-button' id='export-sequence'>Export Images</button>",
                            "</div>",
                        "</div>",
                    "</div>",
                "</div>",
            "</div>",
            "<div id='animationToolFooter'>",
                "<button id='animationPrevStep' class='btn btn-secondary' disabled>Previous</button>",
                "<button id='animationNextStep' class='btn btn-primary'>Next</button>",
                "<button id='animationReset' class='btn btn-outline-secondary'>Reset</button>",
            "</div>",
        "</div>",
    "</div>"
].join('\n');

const AnimationTool = {
    height: 0,
    width: 400,
    MMGISInterface: null,
    
    // Animation state
    currentStep: 1,
    boundingBox: null,
    timeRange: null,
    animationSettings: {
        frameRate: 2,
        timeInterval: 'day',
        loop: false,
        playDirection: 'forward',
        title: '',
        showTimeStep: false,
        showScaleBar: false,
        layerRefreshRate: 500 // Delay after updating time to wait for layers to update (in milliseconds)
    },
    cachedImages: [],
    isPlaying: false,
    currentFrame: 0,
    isDrawing: false,
    drawingLayer: null,
    drawRectangle: null,
    instructionsControl: null,
    screenRect: null,
    offscreenMap: null,
    offscreenContainer: null,
    tempRectangle: null,
    drawingStartPoint: null,
    drawingHandlers: null,
    originalCursor: null,
    
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    
    getUrlString: function () {
        return ''
    },
}

function interfaceWithMMGIS() {
    const self = this
    
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }
    
    // Initialize the tool UI
    const toolPanel = $('#toolPanel')
    toolPanel.css('background', 'var(--color-k)')
    toolPanel.empty()

    const tools = $('<div>').css('height', '100%').html(markup)
    toolPanel.append(tools)
    
    // Update export options visibility based on config
    updateExportOptionsVisibility()
    
    // Initialize components
    initializeComponents()
    setupEventHandlers()
    
    function updateExportOptionsVisibility() {
        // Get config variables
        const toolVars = L_.getToolVars('animation') || {}
        
        // Show/hide export options based on config
        const showGIF = toolVars.animationGIF !== false
        const showMP4 = toolVars.animationMP4 === true
        const showPNG = toolVars.animationPNG === true
        
        // Find the export-option divs and show/hide them
        const exportOptions = $('.export-option')
        
        exportOptions.each(function() {
            const $option = $(this)
            const $button = $option.find('.export-button')
            
            // Check which export option this is based on the button ID
            if ($button.attr('id') === 'export-gif') {
                $option.toggle(showGIF)
            } else if ($button.attr('id') === 'export-mp4') {
                $option.toggle(showMP4)
            } else if ($button.attr('id') === 'export-sequence') {
                $option.toggle(showPNG)
            }
        })
    }
    
    function initializeComponents() {
        // Sync with TimeControl if available
        if (TimeControl && TimeControl.enabled) {
            syncWithTimeControl()
        } else {
            // Fallback to default dates if TimeControl is not available
            const now = new Date()
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            
            const formatDate = (date) => {
                return date.toISOString().slice(0, 16)
            }
            
            $('#timeStart').val(formatDate(oneWeekAgo))
            $('#timeEnd').val(formatDate(now))
        }
        
        // Subscribe to TimeControl changes
        if (TimeControl && TimeControl.subscribe) {
            TimeControl.subscribe('animationTool', onTimeControlChange)
        }
        
        // Set default Step to 3 (Day) and sync with TimeUI
        if (TimeControl && TimeControl.timeUI) {
            TimeControl.timeUI.stepIndex = 3
            // Set Rate Input to 1 (default multiplier)
            updateTimeUIRateInput(1)
            if (TimeControl.timeUI._refreshIntervals) {
                TimeControl.timeUI._refreshIntervals()
            }
        }
        
        // Initial sync with TimeUI animation controls
        syncWithTimeUIAnimation()
        
        // Set up periodic sync to catch TimeUI changes
        setupTimeUISync()
        
        // Initialize layer refresh rate slider
        $('#layerRefreshRateSlider').val(AnimationTool.animationSettings.layerRefreshRate)
        const initialSeconds = (AnimationTool.animationSettings.layerRefreshRate / 1000).toFixed(1)
        $('#layerRefreshRateValue').text(initialSeconds + 's')
    }
    
    function syncWithTimeControl() {
        if (!TimeControl || !TimeControl.enabled) return
        
        const formatDate = (dateString) => {
            if (!dateString) return ''
            // Convert ISO string to datetime-local format
            return new Date(dateString).toISOString().slice(0, 16)
        }
        
        // Get current TimeControl values
        let startTime = TimeControl.startTime
        let endTime = TimeControl.endTime
        
        // Check if TimeUI is in Range mode or Point mode
        if (TimeControl.timeUI && TimeControl.timeUI.modes) {
            const isRangeMode = TimeControl.timeUI.modes[TimeControl.timeUI.modeIndex] === 'Range'
            
            if (isRangeMode) {
                // In Range mode, use start and end times
                startTime = TimeControl.startTime
                endTime = TimeControl.endTime
            } else {
                // In Point mode, use current time for both start and end
                const currentTime = TimeControl.currentTime || TimeControl.endTime
                startTime = currentTime
                endTime = currentTime
            }
        }
        
        // Set the values in the form
        $('#timeStart').val(formatDate(startTime))
        $('#timeEnd').val(formatDate(endTime))
        
        // Update the internal time range
        updateTimeRange()
    }
    
    function onTimeControlChange(timeData) {
        // Update Animation Tool when TimeControl changes
        syncWithTimeControl()
        // Also sync animation controls
        syncWithTimeUIAnimation()
    }
    
    // Update TimeUI Rate Input directly from Animation Tool Step input
    function updateTimeUIFromStep(stepValue) {
        if (!TimeControl || !TimeControl.timeUI) return
        
        // Update TimeUI Rate Input (the multiplier)
        updateTimeUIRateInput(stepValue)
    }
    
    // Update TimeUI Rate Input (the number input next to Step dropdown)
    function updateTimeUIRateInput(rateValue) {
        const rateInput = $('#mmgisTimeUIRateInput')
        if (rateInput.length && rateInput.val() !== rateValue.toString()) {
            rateInput.val(rateValue)
        }
    }
    
    // Get current TimeUI Rate Input value
    function getTimeUIRateInputValue() {
        const rateInput = $('#mmgisTimeUIRateInput')
        return rateInput.length ? parseFloat(rateInput.val() || 1) : 1
    }
    
    function fpsToEverySeconds(fps) {
        // Convert FPS to "Every X seconds" format for display
        const seconds = 1 / fps
        if (seconds < 1) {
            return `Every ${seconds.toFixed(1)}s`
        } else if (seconds === Math.floor(seconds)) {
            return `Every ${seconds}s`
        } else {
            return `Every ${seconds.toFixed(1)}s`
        }
    }
    
    function showModalAlert(message, title = 'Animation Tool') {
        const modalHtml = `
            <div class='modal-content'>
                <h3>${title}</h3>
                <p>${message}</p>
                <div class='modal-buttons'>
                    <button class='btn btn-primary' id='modalOkButton'>OK</button>
                </div>
            </div>
        `
        
        Modal.set(modalHtml, function(modalId) {
            // Set up event handler for OK button
            $('#modalOkButton').on('click', function() {
                Modal.remove()
            })
        })
    }
    
    // Set up periodic synchronization to catch TimeUI changes
    function setupTimeUISync() {
        if (!TimeControl || !TimeControl.timeUI) return
        
        // Store previous values to detect changes
        let lastStepIndex = TimeControl.timeUI.stepIndex
        let lastIntervalIndex = TimeControl.timeUI.intervalIndex
        let lastRateInputValue = getTimeUIRateInputValue()
        
        // Check for changes every 500ms
        const syncInterval = setInterval(() => {
            if (!TimeControl || !TimeControl.timeUI) {
                clearInterval(syncInterval)
                return
            }
            
            const currentStepIndex = TimeControl.timeUI.stepIndex
            const currentIntervalIndex = TimeControl.timeUI.intervalIndex
            const currentRateInputValue = getTimeUIRateInputValue()
            
            // Check if Step changed
            if (currentStepIndex !== lastStepIndex) {
                syncWithTimeUIAnimation()
                lastStepIndex = currentStepIndex
            }
            
            // Check if Every (interval) changed
            if (currentIntervalIndex !== lastIntervalIndex) {
                syncWithTimeUIAnimation()
                lastIntervalIndex = currentIntervalIndex
            }
            
            // Check if Rate Input changed
            if (Math.abs(currentRateInputValue - lastRateInputValue) > 0.01) {
                syncWithTimeUIAnimation()
                lastRateInputValue = currentRateInputValue
            }
        }, 500)
        
        // Store interval ID for cleanup
        AnimationTool.timeUISyncInterval = syncInterval
    }
    
    // Synchronize Animation Tool with TimeUI animation controls
    function syncWithTimeUIAnimation() {
        if (!TimeControl || !TimeControl.timeUI) return
        
        const timeUI = TimeControl.timeUI
        
        // Map TimeUI Step to Animation Tool Time Interval
        // TimeUI Step indices correspond to: second, minute, hour, day, week, month, year, decade, century
        // Update Step input (multiplier) - sync with Rate Input
        const currentRateInput = getTimeUIRateInputValue()
        $('#timeStep').val(currentRateInput)
        
        // Update Time Interval - use TimeUI Step index directly
        // TimeUI Step indices: 0=second, 1=minute, 2=hour, 3=day, 4=week, 5=month, 6=year, 7=decade, 8=century
        const timeIntervalValues = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade', 'century']
        const newTimeInterval = timeIntervalValues[timeUI.stepIndex] || 'day'
        
        if (newTimeInterval !== AnimationTool.animationSettings.timeInterval) {
            AnimationTool.animationSettings.timeInterval = newTimeInterval
            $('#timeInterval').val(newTimeInterval)
        }
        
        // Map TimeUI Every (interval) to Animation Tool FPS
        // Correct mathematical relationship: FPS = 1/seconds
        const fpsMapping = {
            0: 10,   // .1 seconds = 10 FPS
            1: 4,    // .25 seconds = 4 FPS
            2: 2,    // 0.5 seconds = 2 FPS
            3: 1,    // 1 second = 1 FPS
            4: 0.5,  // 2 seconds = 0.5 FPS
            5: 0.25, // 4 seconds = 0.25 FPS
            6: 0.167,// 6 seconds = 0.167 FPS (1/6)
            7: 0.125,// 8 seconds = 0.125 FPS (1/8)
            8: 0.1,  // 10 seconds = 0.1 FPS (1/10)
            9: 0.067,// 15 seconds = 0.067 FPS (1/15)
            10: 0.05 // 20 seconds = 0.05 FPS (1/20)
        }
        
        // Update FPS
        const newFPS = fpsMapping[timeUI.intervalIndex] || 2
        if (Math.abs(newFPS - AnimationTool.animationSettings.frameRate) > 0.01) {
            AnimationTool.animationSettings.frameRate = newFPS
            $('#frameRateSlider').val(newFPS)
            $('#frameRateValue').text(fpsToEverySeconds(newFPS))
        }
    }
    
    // Synchronize TimeUI animation controls with Animation Tool
    function syncTimeUIFromAnimation() {
        if (!TimeControl || !TimeControl.timeUI) return
        
        const timeUI = TimeControl.timeUI
        
        // Map Animation Tool Time Interval to TimeUI Step
        const timeIntervalToStep = {
            'second': 0,   // second → Step 0
            'minute': 1,   // minute → Step 1
            'hour': 2,     // hour → Step 2
            'day': 3,      // day → Step 3
            'week': 4,     // week → Step 4
            'month': 5,    // month → Step 5
            'year': 6,     // year → Step 6
            'decade': 7,   // decade → Step 7
            'century': 8   // century → Step 8
        }
        
        // Map Animation Tool FPS to TimeUI Every (interval)
        const fpsToIntervalMapping = {
            10: 0,    // 10 FPS = .1 seconds
            4: 1,     // 4 FPS = .25 seconds
            2: 2,     // 2 FPS = 0.5 seconds
            1: 3,     // 1 FPS = 1 second
            0.5: 4,   // 0.5 FPS = 2 seconds
            0.25: 5,  // 0.25 FPS = 4 seconds
            0.167: 6, // 0.167 FPS = 6 seconds
            0.125: 7, // 0.125 FPS = 8 seconds
            0.1: 8,   // 0.1 FPS = 10 seconds
            0.067: 9, // 0.067 FPS = 15 seconds
            0.05: 10  // 0.05 FPS = 20 seconds
        }
        
        // Update TimeUI Step
        const newStepIndex = timeIntervalToStep[AnimationTool.animationSettings.timeInterval] || 3
        if (newStepIndex !== timeUI.stepIndex) {
            timeUI.stepIndex = newStepIndex
            // Update the dropdown UI
            if (timeUI._refreshIntervals) {
                timeUI._refreshIntervals()
            }
        }
        
        // Update TimeUI Every (interval)
        const newIntervalIndex = fpsToIntervalMapping[AnimationTool.animationSettings.frameRate] || 2
        if (newIntervalIndex !== timeUI.intervalIndex) {
            timeUI.intervalIndex = newIntervalIndex
            // Update the dropdown UI
            if (timeUI._refreshIntervals) {
                timeUI._refreshIntervals()
            }
            if (timeUI._refreshLiveProgress) {
                timeUI._refreshLiveProgress()
            }
        }
    }
    
    function setupEventHandlers() {
        // Step navigation
        $('#animationNextStep').on('click', () => {
            if (AnimationTool.currentStep < 4) {
                AnimationTool.currentStep++
                updateStepDisplay()
            }
        })
        
        $('#animationPrevStep').on('click', () => {
            if (AnimationTool.currentStep > 1) {
                AnimationTool.currentStep--
                updateStepDisplay()
            }
        })
        
        // Step click navigation
        $('.animation-step').on('click', function() {
            const step = parseInt($(this).data('step'))
            if (step <= AnimationTool.currentStep || validateStep(step - 1)) {
                AnimationTool.currentStep = step
                updateStepDisplay()
            }
        })
        
        // Reset button
        $('#animationReset').on('click', () => {
            resetAnimation()
        })
        
        
        // Bounding box controls
        $('#bboxNorth, #bboxSouth, #bboxEast, #bboxWest').on('input', () => {
            updateBoundingBoxFromInputs()
        })
        
        $('#drawBoundingBox').on('click', () => {
            startDrawing()
        })
        
        $('#useCurrentView').on('click', () => {
            useCurrentView()
        })
        
        $('#resetValues').on('click', () => {
            useDefaultExtents()
        })
        
        // Time controls
        $('#timeStart, #timeEnd').on('change', () => {
            updateTimeRange()
        })
        
        $('#timeStep').on('change', () => {
            const stepValue = parseInt($('#timeStep').val())
            if (stepValue >= 0 && stepValue <= 8) {
                updateTimeUIFromStep(stepValue)
            }
        })
        
        $('#timeInterval').on('change', () => {
            AnimationTool.animationSettings.timeInterval = $('#timeInterval').val()
            syncTimeUIFromAnimation()
        })
        
         // Animation controls
         $('#frameRateSlider').on('input', (e) => {
             const value = parseFloat(e.target.value)
             
             $('#frameRateValue').text(fpsToEverySeconds(value))
             AnimationTool.animationSettings.frameRate = value
             syncTimeUIFromAnimation()
         })
        
        $('input[name="playDirection"]').on('change', (e) => {
            AnimationTool.animationSettings.playDirection = e.target.value
        })
        
        $('#loopAnimation').on('change', (e) => {
            AnimationTool.animationSettings.loop = e.target.checked
        })
        
        // Title input
        $('#exportTitle').on('input', (e) => {
            AnimationTool.animationSettings.title = e.target.value.trim()
        })
        
        // Show time step checkbox
        $('#showTimeStep').on('change', (e) => {
            AnimationTool.animationSettings.showTimeStep = e.target.checked
        })
        
        // Show scale bar checkbox
        $('#showScaleBar').on('change', (e) => {
            AnimationTool.animationSettings.showScaleBar = e.target.checked
        })
        
        // Layer refresh rate slider
        $('#layerRefreshRateSlider').on('input', (e) => {
            const value = parseInt(e.target.value)
            AnimationTool.animationSettings.layerRefreshRate = value
            const seconds = (value / 1000).toFixed(1)
            $('#layerRefreshRateValue').text(seconds + 's')
        })
        
        // Export controls
        $('#export-gif').on('click', () => {
            startExport('gif')
        })
        
        $('#export-sequence').on('click', () => {
            startExport('sequence')
        })
        
        $('#export-mp4').on('click', () => {
            startExport('mp4')
        })
        
        // Projection-aware event listeners
        // Update screen rectangle when map projection changes
        Map_.map.on('projectionchange', () => {
            if (AnimationTool.boundingBox) {
                updateScreenRectFromBoundingBox()
            }
        })
        
        // Update screen rectangle when map view changes (zoom, pan)
        Map_.map.on('moveend zoomend', () => {
            if (AnimationTool.boundingBox) {
                updateScreenRectFromBoundingBox()
            }
        })
    }
    
    function updateStepDisplay() {
        // Update step indicators
        $('.animation-step').removeClass('active')
        $(`.animation-step[data-step="${AnimationTool.currentStep}"]`).addClass('active')
        
        // Update panels
        $('.animation-panel').removeClass('active')
        $(`#animationPanel${AnimationTool.currentStep}`).addClass('active')
        
        // Update navigation buttons
        $('#animationPrevStep').prop('disabled', AnimationTool.currentStep === 1)
        $('#animationNextStep').prop('disabled', AnimationTool.currentStep === 4)
    }
    
    function validateStep(step) {
        switch(step) {
            case 0:
                return true
            case 1:
                return AnimationTool.boundingBox !== null
            case 2:
                return AnimationTool.boundingBox !== null && AnimationTool.timeRange !== null
            case 3:
                return AnimationTool.boundingBox !== null && AnimationTool.timeRange !== null
            default:
                return false
        }
    }
    
    function updateBoundingBoxFromInputs() {
        const north = parseFloat($('#bboxNorth').val())
        const south = parseFloat($('#bboxSouth').val())
        const east = parseFloat($('#bboxEast').val())
        const west = parseFloat($('#bboxWest').val())
        
        if (!isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west)) {
            if (validateBoundingBox({ north, south, east, west })) {
                AnimationTool.boundingBox = { north, south, east, west }
                $('#resetValues').prop('disabled', false)
                // Update screen rectangle from the bounding box
                updateScreenRectFromBoundingBox()
            }
        }
    }
    
    function validateBoundingBox(bbox) {
        return bbox.north > bbox.south && 
               bbox.east > bbox.west &&
               bbox.north <= 90 && bbox.south >= -90 &&
               bbox.east <= 180 && bbox.west >= -180
    }
    
    function startDrawing() {
        if (AnimationTool.isDrawing) return
        
        // Enable drawing mode on the map
        enableDrawingMode()
    }
    
    function enableDrawingMode() {
        // Clear any existing drawing
        if (AnimationTool.drawingLayer) {
            Map_.map.removeLayer(AnimationTool.drawingLayer)
        }
        
        // Create a new layer for drawing
        AnimationTool.drawingLayer = L.layerGroup().addTo(Map_.map)
        
        // Create a temporary rectangle polygon for drawing
        AnimationTool.tempRectangle = null
        AnimationTool.drawingStartPoint = null
        
        // Use custom screen-space rectangle drawing
        setupCustomRectangleDrawing()
        
        // Add drawing instructions
        showDrawingInstructions('Click once to set the first corner, then click again to set the opposite corner.')
        
        // Update button text
        $('#drawBoundingBox').text('Drawing...').prop('disabled', true)
        AnimationTool.isDrawing = true
    }
    
    function setupCustomRectangleDrawing() {
        const map = Map_.map
        
        // Store original cursor
        AnimationTool.originalCursor = map.getContainer().style.cursor || ''
        
        // Change cursor to indicate drawing mode
        map.getContainer().style.cursor = 'crosshair'
        
        // Track if we've started drawing (first click)
        let hasStarted = false
        
        // Click handler - start drawing or complete drawing
        const onClick = (e) => {
            // Only handle left click
            if (e.originalEvent.button !== 0) return
            
            L.DomEvent.stop(e)
            
            // Get container point from the mouse event
            const containerPoint = e.containerPoint
            
            if (!hasStarted) {
                // First click - start drawing
                hasStarted = true
                AnimationTool.drawingStartPoint = containerPoint
                
                // Clear any existing temporary rectangle
                if (AnimationTool.tempRectangle) {
                    AnimationTool.drawingLayer.removeLayer(AnimationTool.tempRectangle)
                }
                
                // Create initial rectangle (will be a single point initially)
                const startLatLng = map.containerPointToLatLng(containerPoint)
                AnimationTool.tempRectangle = L.polygon([
                    [startLatLng.lat, startLatLng.lng],
                    [startLatLng.lat, startLatLng.lng],
                    [startLatLng.lat, startLatLng.lng],
                    [startLatLng.lat, startLatLng.lng]
                ], {
                    color: '#ff6b6b',
                    weight: 3,
                    fillOpacity: 0.2,
                    fillColor: '#ff6b6b'
                }).addTo(AnimationTool.drawingLayer)
            } else {
                // Second click - complete drawing
                if (!AnimationTool.drawingStartPoint || !AnimationTool.tempRectangle) return
                
                // Get final container points
                const startPoint = AnimationTool.drawingStartPoint
                const endPoint = containerPoint
                
                // Calculate final screen rectangle bounds
                const minX = Math.min(startPoint.x, endPoint.x)
                const maxX = Math.max(startPoint.x, endPoint.x)
                const minY = Math.min(startPoint.y, endPoint.y)
                const maxY = Math.max(startPoint.y, endPoint.y)
                
                // Ensure minimum size
                if (Math.abs(maxX - minX) < 5 || Math.abs(maxY - minY) < 5) {
                    return // Too small, don't complete
                }
                
                // Store screen rectangle for animation
                AnimationTool.screenRect = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                }
                
                // Convert four screen corners to geographic coordinates
                const topLeft = map.containerPointToLatLng({ x: minX, y: minY })
                const topRight = map.containerPointToLatLng({ x: maxX, y: minY })
                const bottomRight = map.containerPointToLatLng({ x: maxX, y: maxY })
                const bottomLeft = map.containerPointToLatLng({ x: minX, y: maxY })
                
                // Update the polygon one more time to ensure it's correct
                AnimationTool.tempRectangle.setLatLngs([
                    [topLeft.lat, topLeft.lng],
                    [topRight.lat, topRight.lng],
                    [bottomRight.lat, bottomRight.lng],
                    [bottomLeft.lat, bottomLeft.lng]
                ])
                
                // Get the actual bounds of the displayed polygon
                // This ensures the bounding box matches exactly what's drawn
                const polygonBounds = AnimationTool.tempRectangle.getBounds()
                
                const bbox = {
                    north: polygonBounds.getNorth(),
                    south: polygonBounds.getSouth(),
                    east: polygonBounds.getEast(),
                    west: polygonBounds.getWest()
                }
                
                // Store bounding box
                AnimationTool.boundingBox = bbox
                
                // Update input fields
                $('#bboxNorth').val(bbox.north)
                $('#bboxSouth').val(bbox.south)
                $('#bboxEast').val(bbox.east)
                $('#bboxWest').val(bbox.west)
                $('#resetValues').prop('disabled', false)
                
                // The tempRectangle is already correct and displayed
                // No need to recreate it - just clear the temp reference
                AnimationTool.tempRectangle = null
                
                // Clean up event listeners
                cleanupCustomRectangleDrawing()
                
                // Disable drawing mode
                disableDrawingMode()
            }
        }
        
        // Mouse move handler - update rectangle while moving mouse
        const onMouseMove = (e) => {
            if (!hasStarted || !AnimationTool.drawingStartPoint || !AnimationTool.tempRectangle) return
            
            // Get current container point
            const currentContainerPoint = e.containerPoint
            
            // Calculate screen rectangle bounds
            const minX = Math.min(AnimationTool.drawingStartPoint.x, currentContainerPoint.x)
            const maxX = Math.max(AnimationTool.drawingStartPoint.x, currentContainerPoint.x)
            const minY = Math.min(AnimationTool.drawingStartPoint.y, currentContainerPoint.y)
            const maxY = Math.max(AnimationTool.drawingStartPoint.y, currentContainerPoint.y)
            
            // Convert four screen corners to geographic coordinates
            const topLeft = map.containerPointToLatLng({ x: minX, y: minY })
            const topRight = map.containerPointToLatLng({ x: maxX, y: minY })
            const bottomRight = map.containerPointToLatLng({ x: maxX, y: maxY })
            const bottomLeft = map.containerPointToLatLng({ x: minX, y: maxY })
            
            // Update the polygon to be a screen-aligned rectangle
            AnimationTool.tempRectangle.setLatLngs([
                [topLeft.lat, topLeft.lng],
                [topRight.lat, topRight.lng],
                [bottomRight.lat, bottomRight.lng],
                [bottomLeft.lat, bottomLeft.lng]
            ])
        }
        
        // Escape key handler - cancel drawing
        const onEscape = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                L.DomEvent.stop(e)
                
                // Remove temporary rectangle
                if (AnimationTool.tempRectangle) {
                    AnimationTool.drawingLayer.removeLayer(AnimationTool.tempRectangle)
                    AnimationTool.tempRectangle = null
                }
                
                // Clean up
                cleanupCustomRectangleDrawing()
                disableDrawingMode()
            }
        }
        
        // Store event handlers for cleanup
        AnimationTool.drawingHandlers = {
            click: onClick,
            mousemove: onMouseMove,
            keydown: onEscape
        }
        
        // Attach event listeners
        map.on('click', onClick)
        map.on('mousemove', onMouseMove)
        document.addEventListener('keydown', onEscape)
        
        // Note: Don't disable dragging - let users pan the map between clicks
    }
    
    function cleanupCustomRectangleDrawing() {
        const map = Map_.map
        
        // Restore original cursor
        if (AnimationTool.originalCursor !== null && AnimationTool.originalCursor !== undefined) {
            map.getContainer().style.cursor = AnimationTool.originalCursor
            AnimationTool.originalCursor = null
        }
        
        // Remove event listeners
        if (AnimationTool.drawingHandlers) {
            map.off('click', AnimationTool.drawingHandlers.click)
            map.off('mousemove', AnimationTool.drawingHandlers.mousemove)
            document.removeEventListener('keydown', AnimationTool.drawingHandlers.keydown)
            AnimationTool.drawingHandlers = null
        }
        
        // Clear drawing state
        AnimationTool.drawingStartPoint = null
    }
    
    function disableDrawingMode() {
        AnimationTool.isDrawing = false
        
        // Clean up custom drawing handlers if still active
        if (AnimationTool.drawingHandlers) {
            cleanupCustomRectangleDrawing()
        }
        
        // Hide instructions
        hideDrawingInstructions()
        
        // Reset button
        $('#drawBoundingBox').text('Draw on Map').prop('disabled', false)
    }
    
    function showDrawingInstructions(message = 'Click and drag to draw a rectangle. Press ESC to cancel.') {
        // Create instructions overlay
        AnimationTool.instructionsControl = L.control({ position: 'topright' })
        
        AnimationTool.instructionsControl.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'drawing-instructions')
            div.innerHTML = `
                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid #ff6b6b;">
                    <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 8px;">
                        <i class="mdi mdi-draw" style="margin-right: 5px;"></i>
                        Drawing Mode Active
                    </div>
                    <div style="color: #333; font-size: 14px;">
                        ${message}
                    </div>
                    <div style="color: #666; font-size: 12px; margin-top: 8px;">
                        Press ESC to cancel
                    </div>
                </div>
            `
            return div
        }
        
        AnimationTool.instructionsControl.addTo(Map_.map)
    }
    
    function hideDrawingInstructions() {
        if (AnimationTool.instructionsControl) {
            Map_.map.removeControl(AnimationTool.instructionsControl)
            AnimationTool.instructionsControl = null
        }
    }
    
    function useCurrentView() {
        try {
            // Get current map bounds
            const bounds = Map_.map.getBounds()

            // Convert ALL FOUR CORNERS from geographic to screen coordinates
            // This handles non-Mercator projections correctly
            const nw = bounds.getNorthWest()
            const ne = bounds.getNorthEast()
            const se = bounds.getSouthEast()
            const sw = bounds.getSouthWest()

            const nwScreen = Map_.map.latLngToContainerPoint(nw)
            const neScreen = Map_.map.latLngToContainerPoint(ne)
            const seScreen = Map_.map.latLngToContainerPoint(se)
            const swScreen = Map_.map.latLngToContainerPoint(sw)

            // Find bounding rectangle that contains all four corners
            const minX = Math.min(nwScreen.x, neScreen.x, seScreen.x, swScreen.x)
            const maxX = Math.max(nwScreen.x, neScreen.x, seScreen.x, swScreen.x)
            const minY = Math.min(nwScreen.y, neScreen.y, seScreen.y, swScreen.y)
            const maxY = Math.max(nwScreen.y, neScreen.y, seScreen.y, swScreen.y)

            // Create a proper screen rectangle
            const screenRect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            }

            // Store the screen rectangle for animation purposes
            AnimationTool.screenRect = screenRect

            // Convert to geographic coordinates for form display
            const bbox = {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            }

            setBoundingBox(bbox)
        } catch (err) {
            console.error('Error in useCurrentView:', err)
        }
    }
    
    function setBoundingBox(bbox) {
        AnimationTool.boundingBox = bbox
        
        // Update screen rectangle from the bounding box
        updateScreenRectFromBoundingBox()
        
        // Update input fields
        $('#bboxNorth').val(bbox.north)
        $('#bboxSouth').val(bbox.south)
        $('#bboxEast').val(bbox.east)
        $('#bboxWest').val(bbox.west)
        
        $('#resetValues').prop('disabled', false)
    }
    
    function useDefaultExtents() {
        AnimationTool.boundingBox = null
        AnimationTool.screenRect = null
        
        // Clear input fields
        $('#bboxNorth, #bboxSouth, #bboxEast, #bboxWest').val('')
        
        // Clear drawing layer
        if (AnimationTool.drawingLayer) {
            Map_.map.removeLayer(AnimationTool.drawingLayer)
            AnimationTool.drawingLayer = null
        }
        
        $('#resetValues').prop('disabled', true)
    }
    
    function updateScreenRectFromBoundingBox() {
        if (!AnimationTool.boundingBox) return

        try {
            const bbox = AnimationTool.boundingBox

            // Convert ALL FOUR CORNERS from geographic to screen coordinates
            // This handles non-Mercator projections correctly (e.g., polar stereographic)
            const nw = L.latLng(bbox.north, bbox.west)
            const ne = L.latLng(bbox.north, bbox.east)
            const se = L.latLng(bbox.south, bbox.east)
            const sw = L.latLng(bbox.south, bbox.west)

            const nwScreen = Map_.map.latLngToContainerPoint(nw)
            const neScreen = Map_.map.latLngToContainerPoint(ne)
            const seScreen = Map_.map.latLngToContainerPoint(se)
            const swScreen = Map_.map.latLngToContainerPoint(sw)

            // Find bounding rectangle that contains all four corners
            const minX = Math.min(nwScreen.x, neScreen.x, seScreen.x, swScreen.x)
            const maxX = Math.max(nwScreen.x, neScreen.x, seScreen.x, swScreen.x)
            const minY = Math.min(nwScreen.y, neScreen.y, seScreen.y, swScreen.y)
            const maxY = Math.max(nwScreen.y, neScreen.y, seScreen.y, swScreen.y)

            // Create a proper screen rectangle
            AnimationTool.screenRect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            }

            // Update visual rectangle on map if it exists
            updateVisualRectangle()
        } catch (err) {
            console.error('Error updating screen rect from bounding box:', err)
        }
    }
    
    // Helper function to update the visual rectangle on the map to keep it screen-aligned
    function updateVisualRectangle() {
        if (!AnimationTool.screenRect || !AnimationTool.drawingLayer) return
        
        // Clear existing polygons in drawing layer
        AnimationTool.drawingLayer.clearLayers()
        
        // Get screen rectangle coordinates
        const { x: minX, y: minY, width, height } = AnimationTool.screenRect
        const maxX = minX + width
        const maxY = minY + height
        
        // Convert the four screen-aligned corners to geographic coordinates
        const topLeft = Map_.map.containerPointToLatLng({ x: minX, y: minY })
        const topRight = Map_.map.containerPointToLatLng({ x: maxX, y: minY })
        const bottomRight = Map_.map.containerPointToLatLng({ x: maxX, y: maxY })
        const bottomLeft = Map_.map.containerPointToLatLng({ x: minX, y: maxY })
        
        // Create a polygon from the four corners to maintain screen-aligned rectangle
        L.polygon([
            [topLeft.lat, topLeft.lng],
            [topRight.lat, topRight.lng],
            [bottomRight.lat, bottomRight.lng],
            [bottomLeft.lat, bottomLeft.lng]
        ], {
            color: '#ff6b6b',
            weight: 3,
            fillOpacity: 0.2,
            fillColor: '#ff6b6b'
        }).addTo(AnimationTool.drawingLayer)
    }
    
    function getScreenRectForAnimation() {
        // Return the current screen rectangle for animation purposes
        // This ensures the animation always uses screen coordinates regardless of projection
        return AnimationTool.screenRect
    }
    
    
    function updateTimeRange() {
        const startDate = $('#timeStart').val()
        const endDate = $('#timeEnd').val()
        
        if (startDate && endDate) {
            const start = new Date(startDate)
            const end = new Date(endDate)
            
            if (start < end) {
                AnimationTool.timeRange = {
                    startDate: startDate,
                    endDate: endDate,
                    start: start,
                    end: end,
                    interval: AnimationTool.animationSettings.timeInterval
                }
                
                // Update TimeControl if available
                updateTimeControlFromAnimation()
            }
        } else {
            console.log('Missing start or end date')
        }
    }
    
    function updateTimeControlFromAnimation() {
        if (!TimeControl || !TimeControl.enabled || !AnimationTool.timeRange) return
        
        const { startDate, endDate } = AnimationTool.timeRange
        
        // Convert datetime-local format to ISO string
        const startTimeISO = new Date(startDate).toISOString().split('.')[0] + 'Z'
        const endTimeISO = new Date(endDate).toISOString().split('.')[0] + 'Z'
        
        // Update TimeControl without triggering layer updates
        if (TimeControl.timeInputChange) {
            TimeControl.timeInputChange(startTimeISO, endTimeISO, endTimeISO, true)
        }
    }
    
    
    function startExport(format) {
        
        if (!AnimationTool.boundingBox) {
            showModalAlert('Please complete Step 1 (Select Area) before exporting.')
            return
        }
        
        if (!AnimationTool.timeRange) {
            showModalAlert('Please complete Step 2 (Set Time Range) before exporting.')
            return
        }
        
        const button = $(`#export-${format}`)
        const originalText = button.text()
        button.text('Exporting...').prop('disabled', true)
        
        // Generate animation frames
        generateAnimationFrames().then(frames => {
            if (frames.length === 0) {
                button.text(originalText).prop('disabled', false)
                showModalAlert('No frames generated. Please check your time range and settings.')
                return
            }
            
            switch (format) {
                case 'gif':
                    exportAsGIF(frames, button, originalText)
                    break
                case 'mp4':
                    exportAsMP4(frames, button, originalText)
                    break
                case 'sequence':
                    exportAsSequence(frames, button, originalText)
                    break
            }
        }).catch(error => {
            console.error('Export error:', error)
            button.text(originalText).prop('disabled', false)
            showModalAlert('Export failed: ' + error.message)
        })
    }
    
    function generateAnimationFrames() {
        return new Promise((resolve, reject) => {
            // Track if drawing layer was visible so we can restore it
            let drawingLayerWasVisible = false
            
            try {
                // Store original TimeUI state before starting export
                storeOriginalTimeUIState()
                
                const frames = []
                const { startDate, endDate } = AnimationTool.timeRange
                const interval = AnimationTool.animationSettings.timeInterval
                const frameRate = AnimationTool.animationSettings.frameRate
                
                // Calculate time steps
                const start = new Date(startDate)
                const end = new Date(endDate)
                const timeSteps = calculateTimeSteps(start, end, interval)
                
                // Generate frames
                let currentStep = 0
                const generateFrame = () => {
                    if (currentStep >= timeSteps.length) {
                        // Restore original TimeUI state after export completion
                        restoreOriginalTimeUIState()
                        // Restore the drawing layer if it was visible
                        if (drawingLayerWasVisible && AnimationTool.drawingLayer) {
                            AnimationTool.drawingLayer.addTo(Map_.map)
                        }
                        resolve(frames)
                        return
                    }
                    
                    // Hide the drawing layer (red bounding box) right before capturing the first frame
                    if (currentStep === 0 && AnimationTool.drawingLayer && Map_.map.hasLayer(AnimationTool.drawingLayer)) {
                        drawingLayerWasVisible = true
                        Map_.map.removeLayer(AnimationTool.drawingLayer)
                    }
                    
                    const timeStep = timeSteps[currentStep]
                    
                    captureMapFrame(timeStep).then(frameData => {
                        frames.push({
                            data: frameData,
                            timestamp: timeStep,
                            index: currentStep
                        })
                        currentStep++
                        setTimeout(generateFrame, 100) // Small delay to prevent UI blocking
                    }).catch(error => {
                        console.error('Error capturing frame', currentStep + 1, ':', error)
                        // Restore original TimeUI state on error
                        restoreOriginalTimeUIState()
                        // Restore the drawing layer if it was visible
                        if (drawingLayerWasVisible && AnimationTool.drawingLayer) {
                            AnimationTool.drawingLayer.addTo(Map_.map)
                            console.log('Restored drawing layer after error')
                        }
                        reject(error)
                    })
                }
                
                generateFrame()
            } catch (error) {
                console.error('Error generating animation frames:', error)
                // Restore original TimeUI state on error
                restoreOriginalTimeUIState()
                // Restore the drawing layer if it was visible (use closure variable)
                // Note: drawingLayerWasVisible might not be set if error occurs early
                // so we check if drawing layer exists and isn't on map
                if (drawingLayerWasVisible && AnimationTool.drawingLayer) {
                    AnimationTool.drawingLayer.addTo(Map_.map)
                    console.log('Restored drawing layer after early error')
                }
                reject(error)
            }
        })
    }
    
    function calculateTimeSteps(start, end, interval) {
        const steps = []
        const current = new Date(start)
        
        while (current <= end) {
            steps.push(new Date(current))
            
            switch (interval) {
                case 'hour':
                    current.setHours(current.getHours() + 1)
                    break
                case 'day':
                    current.setDate(current.getDate() + 1)
                    break
                case 'week':
                    current.setDate(current.getDate() + 7)
                    break
                case 'month':
                    current.setMonth(current.getMonth() + 1)
                    break
                case 'year':
                    current.setFullYear(current.getFullYear() + 1)
                    break
            }
        }
        
        return steps
    }
    
    // Store original TimeUI state for restoration
    let originalTimeUIState = null
    
    // Helper function to store original TimeUI state
    function storeOriginalTimeUIState() {
        if (TimeControl && TimeControl.enabled) {
            originalTimeUIState = {
                startTime: TimeControl.startTime,
                endTime: TimeControl.endTime,
                currentTime: TimeControl.currentTime
            }
        }
    }
    
    // Helper function to restore original TimeUI state
    function restoreOriginalTimeUIState() {
        if (TimeControl && TimeControl.enabled && originalTimeUIState) {
            if (TimeControl.timeInputChange) {
                TimeControl.timeInputChange(
                    originalTimeUIState.startTime,
                    originalTimeUIState.endTime,
                    originalTimeUIState.currentTime,
                    false // Don't skip update - restore the UI
                )
            }
            
            // Clear the stored state
            originalTimeUIState = null
        }
    }
    
    // Helper function to update time for time-enabled layers
    function updateTimeForFrame(timestamp) {
        return new Promise((resolve) => {
            // Format timestamp for MMGIS time control
            const timeString = timestamp.toISOString().split('.')[0] + 'Z'
            
            // Update TimeControl with the current frame time as the active time (End Time)
            if (TimeControl && TimeControl.timeInputChange) {
                // Preserve the original start time, but update the end time (which is the active time)
                const startTime = TimeControl.startTime || timeString
                const endTime = timeString // This is the active time for the current frame
                
                TimeControl.timeInputChange(
                    startTime,
                    endTime, // End Time is the Active Time in TimeUI
                    timeString, // Current time matches the end time
                    false // Don't skip update - we want layers to reload with new time
                )
            }
            
            // Also update TimeUI directly if available
            if (TimeControl && TimeControl.timeUI && TimeControl.timeUI.updateTimes) {
                // Convert timestamp to milliseconds for TimeUI
                const timestampMs = timestamp.getTime()
                // Update TimeUI with the timestamp as the end time (active time)
                TimeControl.timeUI.updateTimes(null, timestampMs, null)
            }
            
            // Wait for layers to update using configured delay
            setTimeout(resolve, AnimationTool.animationSettings.layerRefreshRate)
        })
    }
    
    // Helper function to hide UI elements during capture (similar to BottomBar.js)
    function hideUIElementsForCapture() {
        const hiddenElements = {}
        const showScaleBar = AnimationTool.animationSettings.showScaleBar
        
        // Hide UI elements that shouldn't appear in animation frames
        const elementsToHide = [
            '#mmgis-map-compass',
            '.leaflet-control-zoom',
            '#topBarScreenshotLoading',
            '#toolbar',
            '#viewerToolBar',
            '#_lithosphere_controls'
        ]
        
        // Conditionally hide mapToolBar and scale factor control based on showScaleBar setting
        if (!showScaleBar) {
            elementsToHide.push('#mapToolBar')
            elementsToHide.push('.leaflet-control-scalefactor')
        } else {
            // Keep mapToolBar visible but hide other elements in it (except scale bar)
            elementsToHide.push('.leaflet-control-scalefactor')
        }
        
        elementsToHide.forEach(selector => {
            const element = document.querySelector(selector)
            if (element) {
                hiddenElements[selector] = element.style.display
                element.style.display = 'none'
            }
        })
        
        // Handle scale bar visibility - ensure it's visible when option is enabled
        const scaleBar = document.querySelector('#scaleBar')
        const scaleBarBounds = document.querySelector('#scaleBarBounds')
        const mapToolBar = document.querySelector('#mapToolBar')
        
        if (showScaleBar && scaleBar) {
            // Store original states
            hiddenElements['#scaleBar_marginTop'] = scaleBar.style.marginTop || ''
            hiddenElements['#scaleBar_display'] = scaleBar.style.display || ''
            hiddenElements['#scaleBar_visibility'] = scaleBar.style.visibility || ''
            
            if (scaleBarBounds) {
                hiddenElements['#scaleBarBounds_display'] = scaleBarBounds.style.display || ''
                hiddenElements['#scaleBarBounds_visibility'] = scaleBarBounds.style.visibility || ''
                // Ensure scale bar bounds container is visible
                scaleBarBounds.style.display = 'block'
                scaleBarBounds.style.visibility = 'visible'
            }
            
            // Ensure scale bar SVG is visible
            scaleBar.style.display = 'block'
            scaleBar.style.visibility = 'visible'
            scaleBar.style.marginTop = '0px'
            
            // Keep mapToolBar visible for the scale bar, but hide other elements in it
            if (mapToolBar) {
                hiddenElements['#mapToolBar_display'] = mapToolBar.style.display || ''
                hiddenElements['#mapToolBar_visibility'] = mapToolBar.style.visibility || ''
                mapToolBar.style.display = 'block'
                mapToolBar.style.visibility = 'visible'
                
                // Hide other children of mapToolBar except scaleBarBounds
                const toolBarChildren = mapToolBar.childNodes
                toolBarChildren.forEach(child => {
                    if (child.nodeType === 1) { // Element node
                        const originalDisplay = child.style.display || ''
                        const originalVisibility = child.style.visibility || ''
                        if (child.id && child.id !== 'scaleBarBounds') {
                            hiddenElements[`#mapToolBar_${child.id}_display`] = originalDisplay
                            hiddenElements[`#mapToolBar_${child.id}_visibility`] = originalVisibility
                            child.style.display = 'none'
                        }
                    }
                })
            }
        } else if (scaleBar) {
            // Hide scale bar if option is not enabled
            hiddenElements['#scaleBar_marginTop'] = scaleBar.style.marginTop || ''
            hiddenElements['#scaleBar_display'] = scaleBar.style.display || ''
            if (scaleBarBounds) {
                hiddenElements['#scaleBarBounds_display'] = scaleBarBounds.style.display || ''
            }
            if (scaleBarBounds) {
                scaleBarBounds.style.display = 'none'
            }
            scaleBar.style.display = 'none'
        }
        
        return hiddenElements
    }
    
    // Helper function to restore UI elements after capture
    function restoreUIElements(hiddenElements) {
        Object.keys(hiddenElements).forEach(selector => {
            // Skip scale bar and mapToolBar special properties
            if (selector.startsWith('#scaleBar_') || 
                selector.startsWith('#scaleBarBounds_') ||
                selector.startsWith('#mapToolBar_')) {
                return
            }
            
            const element = document.querySelector(selector)
            if (element) {
                const storedValue = hiddenElements[selector]
                if (storedValue !== undefined && storedValue !== null) {
                    element.style.display = storedValue
                }
            }
        })
        
        // Restore scale bar and its containers
        const scaleBar = document.querySelector('#scaleBar')
        const scaleBarBounds = document.querySelector('#scaleBarBounds')
        const mapToolBar = document.querySelector('#mapToolBar')
        
        if (scaleBar) {
            if (hiddenElements['#scaleBar_display'] !== undefined) {
                scaleBar.style.display = hiddenElements['#scaleBar_display'] || ''
            }
            if (hiddenElements['#scaleBar_visibility'] !== undefined) {
                scaleBar.style.visibility = hiddenElements['#scaleBar_visibility'] || ''
            }
            if (hiddenElements['#scaleBar_marginTop'] !== undefined) {
                scaleBar.style.marginTop = hiddenElements['#scaleBar_marginTop'] || '5px'
            } else {
                scaleBar.style.marginTop = '5px'
            }
        }
        
        if (scaleBarBounds) {
            if (hiddenElements['#scaleBarBounds_display'] !== undefined) {
                scaleBarBounds.style.display = hiddenElements['#scaleBarBounds_display'] || ''
            }
            if (hiddenElements['#scaleBarBounds_visibility'] !== undefined) {
                scaleBarBounds.style.visibility = hiddenElements['#scaleBarBounds_visibility'] || ''
            }
        }
        
        if (mapToolBar) {
            if (hiddenElements['#mapToolBar_display'] !== undefined) {
                mapToolBar.style.display = hiddenElements['#mapToolBar_display'] || ''
            }
            if (hiddenElements['#mapToolBar_visibility'] !== undefined) {
                mapToolBar.style.visibility = hiddenElements['#mapToolBar_visibility'] || ''
            }
            
            // Restore other children of mapToolBar
            Object.keys(hiddenElements).forEach(selector => {
                if (selector.startsWith('#mapToolBar_') && selector.endsWith('_display')) {
                    const childId = selector.replace('#mapToolBar_', '').replace('_display', '')
                    const child = document.getElementById(childId)
                    if (child) {
                        child.style.display = hiddenElements[selector] || ''
                    }
                }
            })
        }
    }
    
    // Helper function to draw text with white stroke (border) and black fill
    function drawTextWithBorder(ctx, text, x, y, fontSize = 24) {
        ctx.font = `bold ${fontSize}px Arial, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        
        // Draw white stroke (border) - multiple strokes for thicker border
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        
        // Draw stroke multiple times for thicker border
        for (let i = 0; i < 3; i++) {
            ctx.strokeText(text, x, y)
        }
        
        // Draw black fill
        ctx.fillStyle = 'black'
        ctx.fillText(text, x, y)
    }
    
    // Helper function to add text overlays (title and time step) to canvas
    function addTextOverlays(canvas, timestamp) {
        const settings = AnimationTool.animationSettings
        const hasTitle = settings.title && settings.title.trim() !== ''
        const hasTimeStep = settings.showTimeStep
        
        // If no overlays needed, return canvas as-is
        if (!hasTitle && !hasTimeStep) {
            return canvas
        }
        
        // Create a new canvas to draw overlays (to avoid mutating original)
        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = canvas.width
        outputCanvas.height = canvas.height
        const ctx = outputCanvas.getContext('2d')
        
        // Draw the original canvas
        ctx.drawImage(canvas, 0, 0)
        
        const padding = 10
        const fontSize = Math.max(48, Math.min(72, canvas.width / 40 * 3)) // Responsive font size (3x larger)
        const lineSpacing = fontSize * 0.2 // Space between title and time step (20% of font size)
        
        let currentY = padding
        
        // Draw title in top left corner
        if (hasTitle) {
            const titleText = settings.title.trim()
            drawTextWithBorder(ctx, titleText, padding, currentY, fontSize)
            currentY += fontSize + lineSpacing // Move down for time step
        }
        
        // Draw time step just below the title (or at top if no title)
        if (hasTimeStep) {
            // Format timestamp for display
            const timeStepText = formatTimestampForDisplay(timestamp)
            drawTextWithBorder(ctx, timeStepText, padding, currentY, fontSize)
        }
        
        return outputCanvas
    }
    
    // Helper function to format timestamp for display
    function formatTimestampForDisplay(timestamp) {
        const date = new Date(timestamp)
        
        // Format as: YYYY-MM-DD HH:MM:SS
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    
    // Helper function to crop canvas to specific rectangle
    function cropCanvasToRect(sourceCanvas, rect) {
        const croppedCanvas = document.createElement('canvas')
        const ctx = croppedCanvas.getContext('2d')
        
        croppedCanvas.width = rect.width
        croppedCanvas.height = rect.height
        
        ctx.drawImage(
            sourceCanvas,
            rect.x, rect.y, rect.width, rect.height,
            0, 0, rect.width, rect.height
        )
        
        return croppedCanvas
    }
    
    function ensureEvenDimensions(sourceCanvas) {
        const width = sourceCanvas.width
        const height = sourceCanvas.height
        
        // Check if dimensions are already even
        if (width % 2 === 0 && height % 2 === 0) {
            return sourceCanvas
        }
        
        // Create new canvas with even dimensions
        const evenCanvas = document.createElement('canvas')
        const ctx = evenCanvas.getContext('2d')
        
        // Round down to nearest even number
        evenCanvas.width = width - (width % 2)
        evenCanvas.height = height - (height % 2)
        
        // Draw the source canvas onto the even-sized canvas
        ctx.drawImage(sourceCanvas, 0, 0, evenCanvas.width, evenCanvas.height)
        
        return evenCanvas
    }
    
    function captureMapFrame(timestamp) {
        return new Promise(async (resolve, reject) => {
            try {
                // Update time for time-enabled layers
                await updateTimeForFrame(timestamp)
                
                // Use html2canvas to capture the map area
                const mapContainer = document.querySelector('#mapScreen')
                if (!mapContainer) {
                    reject(new Error('Map container not found'))
                    return
                }
                
                // Temporarily hide UI elements for clean capture (similar to BottomBar.js)
                // Note: drawing layer is already hidden at export level in generateAnimationFrames
                const hiddenElements = hideUIElementsForCapture()
                
                // Capture the map with HTML2Canvas
                const canvas = await HTML2Canvas(mapContainer, {
                    allowTaint: true,
                    useCORS: true,
                    logging: false,
                    scrollX: -window.scrollX,
                    scrollY: -window.scrollY,
                    windowWidth: mapContainer.offsetWidth,
                    windowHeight: mapContainer.offsetHeight,
                    onclone: function (clonedDoc) {
                        // Fix SVG layer positioning issues (from BottomBar.js)
                        const originalSVG = document.body.querySelectorAll('svg.leaflet-zoom-animated')
                        const copySVG = clonedDoc.body.querySelectorAll('svg.leaflet-zoom-animated')
                        copySVG.forEach((copyEle, i) => {
                            const attribute = originalSVG.item(i)?.getAttribute('style')
                            if (attribute) {
                                const parentElement = copyEle.parentElement
                                parentElement.removeChild(copyEle)
                                const temp = document.createElement('div')
                                temp.appendChild(copyEle)
                                parentElement.appendChild(temp)
                                temp.setAttribute('style', attribute)
                                copyEle.removeAttribute('style')
                            }
                        })
                        
                        // Fix tile layer z-indices
                        const originalZ = document.body.querySelectorAll('.leaflet-tile-pane > div.leaflet-layer')
                        const copyZ = clonedDoc.body.querySelectorAll('.leaflet-tile-pane > div.leaflet-layer')
                        copyZ.forEach((copyEle, i) => {
                            const attribute = originalZ.item(i)?.getAttribute('style')
                            if (attribute) {
                                copyEle.setAttribute('style', attribute)
                            }
                        })
                    }
                })
                
                // Restore UI elements
                restoreUIElements(hiddenElements)
                
                // Note: drawing layer restoration is handled at export level in generateAnimationFrames
                
                // Crop to the animation area if boundingBox is defined
                let finalCanvas = canvas
                if (AnimationTool.boundingBox) {
                    try {
                        // Reconstruct LatLngBounds from stored bounding box
                        const bbox = AnimationTool.boundingBox

                        // FIX FOR NON-MERCATOR PROJECTIONS:
                        // Convert ALL FOUR CORNERS from geographic to screen coordinates.
                        // In non-Mercator projections (e.g., polar stereographic), a geographic
                        // rectangle becomes a trapezoid in screen space. Converting only NW/SE
                        // corners results in warped output because NE/SW corners may be significantly
                        // offset from where they would be in a screen-aligned rectangle.
                        const nw = L.latLng(bbox.north, bbox.west)
                        const ne = L.latLng(bbox.north, bbox.east)
                        const se = L.latLng(bbox.south, bbox.east)
                        const sw = L.latLng(bbox.south, bbox.west)

                        // Convert each corner to screen coordinates (relative to map container)
                        const nwScreen = Map_.map.latLngToContainerPoint(nw)
                        const neScreen = Map_.map.latLngToContainerPoint(ne)
                        const seScreen = Map_.map.latLngToContainerPoint(se)
                        const swScreen = Map_.map.latLngToContainerPoint(sw)

                        // Find bounding rectangle that contains all four corners
                        // This ensures the captured area includes the entire geographic bounding box
                        // even when it's trapezoidal in screen space
                        const containerMinX = Math.min(nwScreen.x, neScreen.x, seScreen.x, swScreen.x)
                        const containerMaxX = Math.max(nwScreen.x, neScreen.x, seScreen.x, swScreen.x)
                        const containerMinY = Math.min(nwScreen.y, neScreen.y, seScreen.y, swScreen.y)
                        const containerMaxY = Math.max(nwScreen.y, neScreen.y, seScreen.y, swScreen.y)

                        // Get actual container dimensions
                        const containerWidth = mapContainer.offsetWidth
                        const containerHeight = mapContainer.offsetHeight

                        // Get canvas dimensions
                        const canvasWidth = canvas.width
                        const canvasHeight = canvas.height

                        // Calculate scale factors between container and canvas
                        // HTML2Canvas may scale the output differently, so we need to account for this
                        const scaleX = canvasWidth / containerWidth
                        const scaleY = canvasHeight / containerHeight

                        // Scale the container point coordinates to canvas coordinates
                        const canvasMinX = containerMinX * scaleX
                        const canvasMaxX = containerMaxX * scaleX
                        const canvasMinY = containerMinY * scaleY
                        const canvasMaxY = containerMaxY * scaleY

                        // Ensure coordinates are within canvas bounds
                        const minX = Math.max(0, canvasMinX)
                        const minY = Math.max(0, canvasMinY)
                        const maxX = Math.min(canvasWidth, canvasMaxX)
                        const maxY = Math.min(canvasHeight, canvasMaxY)

                        const currentScreenRect = {
                            x: minX,
                            y: minY,
                            width: maxX - minX,
                            height: maxY - minY
                        }

                        // Ensure we have valid dimensions
                        if (currentScreenRect.width > 0 && currentScreenRect.height > 0) {
                            finalCanvas = cropCanvasToRect(canvas, currentScreenRect)
                        } else {
                            console.warn('Invalid screen rect dimensions, using full canvas')
                        }
                    } catch (err) {
                        console.error('Error converting bounding box coordinates:', err)
                        console.warn('Falling back to full canvas capture')
                        // finalCanvas already set to full canvas above
                    }
                }
                
                // Add text overlays (title and time step) if configured
                finalCanvas = addTextOverlays(finalCanvas, timestamp)
                
                // Ensure dimensions are even for H.264 encoding compatibility
                finalCanvas = ensureEvenDimensions(finalCanvas)
                
                resolve(finalCanvas.toDataURL('image/png'))
            } catch (error) {
                reject(error)
            }
        })
    }
    
    function exportAsGIF(frames, button, originalText) {
        try {
            createGIFWithGifshot(frames, button, originalText)
        } catch (error) {
            console.error('GIF export error:', error)
            button.text(originalText).prop('disabled', false)
            showModalAlert('GIF export failed: ' + error.message)
        }
    }
    
    function createGIFWithGifshot(frames, button, originalText) {
        try {
            // Convert frames to images for gifshot
            const images = []
            let loadedCount = 0
            
            frames.forEach((frameData, index) => {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                
                img.onload = () => {
                    images[index] = img
                    loadedCount++
                    
                    if (loadedCount === frames.length) {
                        // Create GIF using gifshot
                        const frameInterval = 1 / AnimationTool.animationSettings.frameRate // Convert FPS to seconds per frame
                        
                        gifshot.createGIF({
                            images: images,
                            gifWidth: AnimationTool.screenRect?.width || 800,
                            gifHeight: AnimationTool.screenRect?.height || 600,
                            interval: frameInterval, // Use user's selected frame rate
                            numFrames: images.length,
                            frameDuration: frameInterval, // Duration of each frame
                            fontWeight: 'normal',
                            fontSize: '16px',
                            fontFamily: 'sans-serif',
                            fontColor: '#ffffff',
                            textAlign: 'center',
                            textBaseline: 'bottom',
                            sampleInterval: 10,
                            numWorkers: 2
                        }, function(obj) {
                            if (!obj.error) {
                                // Convert base64 to blob and download
                                const byteCharacters = atob(obj.image.split(',')[1])
                                const byteNumbers = new Array(byteCharacters.length)
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                                }
                                const byteArray = new Uint8Array(byteNumbers)
                                const blob = new Blob([byteArray], { type: 'image/gif' })
                                
                                const url = URL.createObjectURL(blob)
                                const filename = generateFilename('animation', 'gif')
                                downloadFile(url, filename, 'image/gif')
                                button.text(originalText).prop('disabled', false)
                                showModalAlert('Animated GIF exported successfully!')
                            } else {
                                console.error('Gifshot error:', obj.error)
                                // Simple fallback - download first frame as PNG
                                downloadFile(frames[0].data, 'animation_frame.png', 'image/png')
                                button.text(originalText).prop('disabled', false)
                                showModalAlert('GIF creation failed. First frame exported as PNG.')
                            }
                        })
                    }
                }
                
                img.onerror = (error) => {
                    console.error('Error loading frame', index, ':', error)
                    // Simple fallback on any error
                    downloadFile(frames[0].data, 'animation_frame.png', 'image/png')
                    button.text(originalText).prop('disabled', false)
                    showModalAlert('GIF creation failed. First frame exported as PNG.')
                }
                
                img.src = frameData.data
            })
            
        } catch (error) {
            console.error('Gifshot GIF creation failed:', error)
            downloadFile(frames[0].data, 'animation_frame.png', 'image/png')
            button.text(originalText).prop('disabled', false)
            showModalAlert('GIF creation failed. First frame exported as PNG.')
        }
    }
    
    function exportAsMP4(frames, button, originalText) {
        try {
            // Use ffmpeg.wasm
            exportMP4WithFFmpeg(frames, button, originalText)
            
            // Validate frames first
            if (!frames || frames.length === 0) {
                throw new Error('No frames available for GIF creation')
            }
            
            // Check if frames have valid data
            const invalidFrames = frames.filter(frame => !frame.data || !frame.data.startsWith('data:image'))
            if (invalidFrames.length > 0) {
                console.error('Invalid frames found:', invalidFrames.length)
                throw new Error('Some frames have invalid data')
            }
            
            // Test GIF library first with a simple test
            try {
                const testGif = new GIF({
                    workers: 0,
                    quality: 10,
                    width: 100,
                    height: 100,
                    debug: true
                })
            } catch (testError) {
                console.error('GIF library test failed:', testError)
                throw new Error('GIF library not working properly: ' + testError.message)
            }
            
            // Create GIF using gif.js with conservative settings
            const gifOptions = {
                workers: 0, // Disable workers to avoid worker script issues
                quality: 10,
                width: AnimationTool.screenRect?.width || 800,
                height: AnimationTool.screenRect?.height || 600,
                debug: true // Enable debug mode
            }
            
            const gif = new GIF(gifOptions)
            
            // Add timeout to detect if GIF creation is stuck
            let progressTimeout = null
            let lastProgress = 0
            let renderStarted = false
            
            // Add progress callback
            gif.on('progress', (progress) => {
                button.text(`Creating GIF... ${Math.round(progress * 100)}%`)
                
                // Clear previous timeout
                if (progressTimeout) {
                    clearTimeout(progressTimeout)
                }
                
                // Set timeout if progress doesn't change
                if (progress > lastProgress) {
                    lastProgress = progress
                    progressTimeout = setTimeout(() => {
                        console.warn('GIF creation appears stuck, falling back...')
                        createSimpleGIF(frames, button, originalText)
                    }, 30000) // 30 second timeout
                }
            })
            
            // Add error callback
            gif.on('error', (error) => {
                console.error('GIF creation error:', error)
                if (progressTimeout) clearTimeout(progressTimeout)
                createSimpleGIF(frames, button, originalText)
            })
            
            // Add finished callback
            gif.on('finished', (blob) => {
                if (progressTimeout) clearTimeout(progressTimeout)
                
                if (blob.size === 0) {
                    console.error('GIF blob is empty!')
                    createSimpleGIF(frames, button, originalText)
                    return
                }
                const url = URL.createObjectURL(blob)
                const filename = generateFilename('animation', 'gif')
                downloadFile(url, filename, 'image/gif')
                button.text(originalText).prop('disabled', false)
                showModalAlert('GIF animation exported successfully!')
            })
            
            // Add frames sequentially
            let framesAdded = 0
            let framesFailed = 0
            
            frames.forEach((frameData, index) => {
                const img = new Image()
                img.crossOrigin = 'anonymous' // Handle CORS
                
                img.onload = () => {
                    try {
                        const delay = 1000 / AnimationTool.animationSettings.frameRate
                        
                        gif.addFrame(img, { delay: delay })
                        framesAdded++
                        
                        // Start rendering after all frames are added
                        if (framesAdded === frames.length) {
                            try {
                                renderStarted = true
                                gif.render()
                                
                                // Set a longer timeout for render completion (no progress callback timeout)
                                progressTimeout = setTimeout(() => {
                                    if (!renderStarted) {
                                        console.warn('GIF render appears stuck, falling back...')
                                        createSimpleGIF(frames, button, originalText)
                                    } else {
                                        // Extend timeout for large GIFs
                                        progressTimeout = setTimeout(() => {
                                            console.warn('GIF render timeout exceeded, falling back...')
                                            createSimpleGIF(frames, button, originalText)
                                        }, 60000) // 60 second timeout for render completion
                                    }
                                }, 15000) // 15 second initial timeout
                            } catch (renderError) {
                                console.error('Error calling gif.render():', renderError)
                                if (progressTimeout) clearTimeout(progressTimeout)
                                createSimpleGIF(frames, button, originalText)
                            }
                        }
                    } catch (error) {
                        console.error('Error adding frame', index + 1, ':', error)
                        console.error('Error details:', error.message, error.stack)
                        framesFailed++
                        
                        if (progressTimeout) clearTimeout(progressTimeout)
                        createSimpleGIF(frames, button, originalText)
                    }
                }
                
                img.onerror = (error) => {
                    console.error('Error loading frame', index, error)
                    console.error('Image load error details:', error.message)
                    framesFailed++
                    
                    if (progressTimeout) clearTimeout(progressTimeout)
                    createSimpleGIF(frames, button, originalText)
                }
                
                img.src = frameData.data
            })
            
        } catch (error) {
            console.error('GIF creation with workers failed:', error)
            createSimpleGIF(frames, button, originalText)
        }
    }
    
    function createSimpleGIF(frames, button, originalText) {
        try {
            // Final fallback: Create a simple animated GIF using canvas
            if (frames.length === 1) {
                // Single frame - download as PNG
                downloadFile(frames[0].data, 'animation_frame.png', 'image/png')
                button.text(originalText).prop('disabled', false)
                showModalAlert('Single frame exported as PNG')
                return
            }
            
            // Multiple frames - create a simple animated GIF using canvas
            
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            const frameWidth = AnimationTool.screenRect?.width || 800
            const frameHeight = AnimationTool.screenRect?.height || 600
            
            canvas.width = frameWidth
            canvas.height = frameHeight
            
            let currentFrame = 0
            
            // Create a simple animation by cycling through frames
            const animate = () => {
                if (currentFrame >= frames.length) {
                    currentFrame = 0
                }
                
                const img = new Image()
                img.crossOrigin = 'anonymous'
                
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    ctx.drawImage(img, 0, 0, frameWidth, frameHeight)
                    
                    currentFrame++
                    
                    if (currentFrame < frames.length) {
                        setTimeout(animate, 1000) // 1 second delay
                    } else {
                        // Animation complete, export final frame
                        canvas.toBlob((blob) => {
                            const url = URL.createObjectURL(blob)
                            downloadFile(url, 'animation_final_frame.png', 'image/png')
                            button.text(originalText).prop('disabled', false)
                            showModalAlert('Animation frames exported as PNG (GIF creation unavailable)')
                        }, 'image/png')
                    }
                }
                
                img.onerror = () => {
                    console.error('Error loading frame', currentFrame)
                    currentFrame++
                    if (currentFrame < frames.length) {
                        setTimeout(animate, 1000)
                    } else {
                        button.text(originalText).prop('disabled', false)
                        showModalAlert('Animation export failed')
                    }
                }
                
                img.src = frames[currentFrame].data
            }
            
            animate()
            
        } catch (error) {
            console.error('Simple GIF creation failed:', error)
            button.text(originalText).prop('disabled', false)
            showModalAlert('GIF export completely failed: ' + error.message)
        }
    }
    
    function createCanvasBasedGIF(frames, button, originalText) {
        try {
            console.log('Attempting canvas-based GIF creation...')
            
            // Since gif.js is not working, provide multiple export options
            console.log('Providing multiple export options since GIF creation is not available...')
            
            if (frames.length === 1) {
                // Single frame - just download as PNG
                console.log('Single frame detected, downloading as PNG...')
                downloadFile(frames[0].data, 'animation_frame.png', 'image/png')
                button.text(originalText).prop('disabled', false)
                showModalAlert('Single frame exported as PNG (GIF creation not available)')
                return
            }
            
            // Multiple frames - offer different export options
            console.log('Multiple frames detected, creating export options...')
            
            // Option 1: Create a sprite sheet
            createSpriteSheet(frames, button, originalText)
            
            // Option 2: Download individual frames
            downloadIndividualFrames(frames, button, originalText)
            
        } catch (error) {
            console.error('Canvas-based GIF creation failed:', error)
            // Final fallback - just download the first frame
            const firstFrame = frames[0]
            if (firstFrame) {
                downloadFile(firstFrame.data, 'animation_frame.png', 'image/png')
                button.text(originalText).prop('disabled', false)
                showModalAlert('First frame exported as PNG (all GIF methods failed)')
            } else {
                button.text(originalText).prop('disabled', false)
                showModalAlert('GIF export completely failed: ' + error.message)
            }
        }
    }
    
    function createSpriteSheet(frames, button, originalText) {
        try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            // Calculate sprite sheet dimensions
            const frameWidth = AnimationTool.screenRect?.width || 800
            const frameHeight = AnimationTool.screenRect?.height || 600
            const framesPerRow = Math.ceil(Math.sqrt(frames.length))
            const rows = Math.ceil(frames.length / framesPerRow)
            
            canvas.width = frameWidth * framesPerRow
            canvas.height = frameHeight * rows
            
            let framesLoaded = 0
            
            frames.forEach((frameData, index) => {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                
                img.onload = () => {
                    // Calculate position in sprite sheet
                    const row = Math.floor(index / framesPerRow)
                    const col = index % framesPerRow
                    const x = col * frameWidth
                    const y = row * frameHeight
                    
                    // Draw frame onto canvas
                    ctx.drawImage(img, x, y, frameWidth, frameHeight)
                    
                    framesLoaded++
                    
                    if (framesLoaded === frames.length) {
                        // Export sprite sheet as PNG
                        canvas.toBlob((blob) => {
                            const url = URL.createObjectURL(blob)
                            downloadFile(url, 'animation_spritesheet.png', 'image/png')
                        }, 'image/png')
                    }
                }
                
                img.onerror = (error) => {
                    console.error('Error loading frame', index, 'for sprite sheet:', error)
                    framesLoaded++
                    
                    if (framesLoaded === frames.length) {
                        // Still try to export what we have
                        canvas.toBlob((blob) => {
                            const url = URL.createObjectURL(blob)
                            downloadFile(url, 'animation_spritesheet_partial.png', 'image/png')
                        }, 'image/png')
                    }
                }
                
                img.src = frameData.data
            })
            
        } catch (error) {
            console.error('Sprite sheet creation failed:', error)
        }
    }
    
    function downloadIndividualFrames(frames, button, originalText) {
        try {
            // Download each frame as a separate PNG file
            frames.forEach((frameData, index) => {
                const filename = `animation_frame_${String(index + 1).padStart(3, '0')}.png`
                downloadFile(frameData.data, filename, 'image/png')
            })
            
            // Show completion message
            setTimeout(() => {
                button.text(originalText).prop('disabled', false)
                showModalAlert(`Animation exported as ${frames.length} individual PNG frames and 1 sprite sheet.\n\nTo create a GIF:\n1. Use online tools like ezgif.com\n2. Use image editing software\n3. Use command line tools like ImageMagick`)
            }, 1000)
            
        } catch (error) {
            console.error('Individual frame download failed:', error)
            button.text(originalText).prop('disabled', false)
            showModalAlert('Frame export failed: ' + error.message)
        }
    }
    
    function exportAsMP4(frames, button, originalText) {
        try {
            // Use ffmpeg.wasm
            exportMP4WithFFmpeg(frames, button, originalText)
        } catch (error) {
            console.error('MP4 export error:', error)
            button.text(originalText).prop('disabled', false)
            showModalAlert('MP4 export failed: ' + error.message)
        }
    }
    
    async function exportMP4WithFFmpeg(frames, button, originalText) {
        try {
            const ffmpeg = new FFmpeg()
            
            // Show loading message
            button.text('Loading FFmpeg...').prop('disabled', true)
            
            // Add progress callback
            ffmpeg.on('progress', ({ progress }) => {
                button.text(`Creating MP4... ${Math.round(progress * 100)}%`)
            })
            
            await ffmpeg.load()
            
            // Write frame files
            for (let i = 0; i < frames.length; i++) {
                const frameData = frames[i].data
                
                // Convert data URL to Uint8Array
                const response = await fetch(frameData)
                const blob = await response.blob()
                const arrayBuffer = await blob.arrayBuffer()
                const uint8Array = new Uint8Array(arrayBuffer)
                
                const filename = `frame${i.toString().padStart(3, '0')}.png`
                await ffmpeg.writeFile(filename, uint8Array)
            }
            
            // Run FFmpeg command to create MP4
            await ffmpeg.exec([
                '-framerate', AnimationTool.animationSettings.frameRate.toString(),
                '-i', 'frame%03d.png',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-crf', '23',
                '-movflags', '+faststart', // Optimize for web streaming
                'output.mp4'
            ])
            
            // Read the output file
            const data = await ffmpeg.readFile('output.mp4')
            
            if (data.length === 0) {
                throw new Error('Generated MP4 file is empty')
            }
            
            const videoBlob = new Blob([data.buffer], { type: 'video/mp4' })
            const videoUrl = URL.createObjectURL(videoBlob)
            
            const filename = generateFilename('animation', 'mp4')
            downloadFile(videoUrl, filename, 'video/mp4')
            button.text(originalText).prop('disabled', false)
            showModalAlert('MP4 video exported successfully!')
            
        } catch (error) {
            console.error('FFmpeg export error:', error)
            button.text(originalText).prop('disabled', false)
            showModalAlert('MP4 export failed: ' + error.message)
        }
    }
    
    function exportAsSequence(frames, button, originalText) {
        // Export individual frames as PNG files
        const titlePrefix = AnimationTool.animationSettings.title
            ? AnimationTool.animationSettings.title
                .replace(/[^a-zA-Z0-9\s-_]/g, '')
                .replace(/\s+/g, '_')
                .toLowerCase()
                .substring(0, 50) + '_'
            : ''
        
        frames.forEach((frame, index) => {
            const filename = `${titlePrefix}frame_${String(index).padStart(3, '0')}.png`
            downloadFile(frame.data, filename, 'image/png')
        })
        
        button.text(originalText).prop('disabled', false)
        showModalAlert(`${frames.length} frames exported successfully!`)
    }
    
    
    // Helper function to generate filename with optional title
    function generateFilename(baseName, extension) {
        const title = AnimationTool.animationSettings.title
        if (title) {
            // Sanitize title for filename: remove special characters, replace spaces with underscores
            const sanitizedTitle = title
                .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters except spaces, hyphens, underscores
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .toLowerCase()
                .substring(0, 50) // Limit length
            return `${sanitizedTitle}_${baseName}.${extension}`
        }
        return `${baseName}.${extension}`
    }
    
    function downloadFile(data, filename, mimeType) {
        const link = document.createElement('a')
        link.href = data
        link.download = filename
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }
    
    function resetAnimation() {
        AnimationTool.currentStep = 1
        AnimationTool.boundingBox = null
        AnimationTool.timeRange = null
        AnimationTool.cachedImages = []
        AnimationTool.isPlaying = false
        AnimationTool.currentFrame = 0
        AnimationTool.screenRect = null
        
        // Reset animation settings to defaults
        AnimationTool.animationSettings.title = ''
        AnimationTool.animationSettings.showTimeStep = false
        AnimationTool.animationSettings.showScaleBar = false
        AnimationTool.animationSettings.layerRefreshRate = 500
        
        updateStepDisplay()
        
        // Reset form inputs
        $('#bboxNorth, #bboxSouth, #bboxEast, #bboxWest').val('')
        $('#exportTitle').val('')
        $('#showTimeStep').prop('checked', false)
        $('#showScaleBar').prop('checked', false)
        $('#layerRefreshRateSlider').val(500)
        $('#layerRefreshRateValue').text('0.5s')
        $('#resetValues').prop('disabled', true)
        
        // Remove drawing layer (red bounding box)
        if (AnimationTool.drawingLayer) {
            Map_.map.removeLayer(AnimationTool.drawingLayer)
            AnimationTool.drawingLayer = null
        }
        
        // Hide drawing instructions if visible
        hideDrawingInstructions()
    }
    
    function separateFromMMGIS() {
        // Clean up event handlers
        $('#animationNextStep, #animationPrevStep, #animationReset').off()
        $('.animation-step').off()
        $('#bboxNorth, #bboxSouth, #bboxEast, #bboxWest').off()
        $('#drawBoundingBox, #useCurrentView, #resetValues').off()
        $('#timeStart, #timeEnd, #timeInterval, #timeStep').off()
        $('#frameRateSlider, input[name="playDirection"], #loopAnimation, #showTimeStep, #showScaleBar').off()
        $('#exportTitle').off()
        $('#layerRefreshRateSlider').off()
        $('#export-gif, #export-sequence, #export-mp4').off()
        
        // Unsubscribe from TimeControl
        if (TimeControl && TimeControl.unsubscribe) {
            TimeControl.unsubscribe('animationTool')
        }
        
        // Clear TimeUI sync interval
        if (AnimationTool.timeUISyncInterval) {
            clearInterval(AnimationTool.timeUISyncInterval)
            AnimationTool.timeUISyncInterval = null
        }
        
        // Clean up drawing
        if (AnimationTool.isDrawing) {
            disableDrawingMode()
        }
        
        // Clean up drawing layer
        if (AnimationTool.drawingLayer) {
            Map_.map.removeLayer(AnimationTool.drawingLayer)
            AnimationTool.drawingLayer = null
        }
        
        // Clean up custom drawing handlers
        if (AnimationTool.drawingHandlers) {
            cleanupCustomRectangleDrawing()
        }
        
        // Clean up temporary drawing state
        AnimationTool.tempRectangle = null
        AnimationTool.drawingStartPoint = null
        AnimationTool.originalCursor = null
        
        // Clean up instructions
        hideDrawingInstructions()
        
        // Clean up offscreen elements
        if (AnimationTool.offscreenContainer) {
            document.body.removeChild(AnimationTool.offscreenContainer)
            AnimationTool.offscreenContainer = null
        }
        
        if (AnimationTool.offscreenMap) {
            AnimationTool.offscreenMap.remove()
            AnimationTool.offscreenMap = null
        }
        
        // Clear cached images
        AnimationTool.cachedImages = []
    }
}

export default AnimationTool
