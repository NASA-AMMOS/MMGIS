// TimeControl sets up a div that displays the time controller
import * as d3 from 'd3'
import * as moment from 'moment'
import L_ from '../Basics/Layers_/Layers_'
import Map_ from '../Basics/Map_/Map_'

// Can be either hh:mm:ss or just seconds
const relativeTimeFormat = new RegExp(/((?:-?\d*):(?:[0-5]\d):(?:[0-5]\d))|(?:\d*)/)

var TimeControl = {
    isRelative: true,
    currentTime: new Date().toISOString().split('.')[0]+'Z',
    timeOffset: '01:00:00',
    startTime: new Date().toISOString().split('.')[0]+'Z',
    endTime: new Date().toISOString().split('.')[0]+'Z',
    relativeStartTime: '01:00:00',
    relativeEndTime: '00:00:00',
    init: function () {

        if (L_.configData.time[0] == 'enabled') {
            console.log('Time controller enabled')
        } else {
            return
        }

        var timeUI = d3
            .select('body')
            .append('div')
            .attr('id', 'timeUI')
            .attr('class', 'center aligned ui padded grid')
            .style( 'background', 'rgba(0, 0, 0, 0.15)' )
            .style( 'height', '40px')
            .style( 'width', '550px')
            .style('position', 'absolute')
            .style('bottom', '0px')
            .style('right', '450px')
            .style('margin', '0')
            .style('z-index', '20')
        timeUI.append('label')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text('')
        timeUI.append('label')
            .attr('id', 'currentTimeLabel')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
        timeUI.append('span')
            .style( 'padding', '10px')
        timeUI.append('label')
            .attr('id', 'startTimeLabel')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text('Start: ')
        timeUI.append('input')
            .attr('id', 'startTimeInput')
            .style( 'width', '130px')
            .style('font-size', '12px')
        timeUI.append('span')
            .style( 'padding', '10px')
        timeUI.append('label')
            .attr('id', 'endTimeLabel')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text('End: ')
        timeUI.append('input')
            .attr('id', 'endTimeInput')
            .style( 'width', '130px')
            .style('font-size', '12px')

        timeUI.append('br')
        timeUI.append('label')
            .attr('id', 'offsetTime')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text('Offset: ')
        timeUI.append('input')
            .attr('id', 'offsetTimeInput')
            .style( 'width', '75px')
            .style('font-size', '12px')
        timeUI.append('span')
            .style( 'padding', '15px')
        timeUI.append('input')
            .attr('id', 'isRelativeTime')
            .attr('type', 'checkbox')
            .property('checked', this.isRelative);
        timeUI.append('label')
            .attr('id', 'useRelativeTime')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text(' Relative time')
        timeUI.append('span')
            .style( 'padding', '11px')
        timeUI.append('label')
            .attr('id', 'startRelativeTime')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text('Start: - ')
        timeUI.append('input')
            .attr('id', 'startRelativeTimeInput')
            .style( 'width', '75px')
            .style('font-size', '12px')
        timeUI.append('span')
            .style( 'padding', '10px')
        timeUI.append('label')
            .attr('id', 'endRelativeTime')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text('End: + ')
        timeUI.append('input')
            .attr('id', 'endRelativeTimeInput')
            .style( 'width', '75px')
            .style('font-size', '12px')

        d3.select('#startTimeInput').property('value', this.startTime)
        d3.select('#endTimeInput').property('value', this.endTime)
        d3.select('#offsetTimeInput').property('value', this.timeOffset)
        d3.select('#startRelativeTimeInput').property('value', this.relativeStartTime)
        d3.select('#endRelativeTimeInput').property('value', this.relativeEndTime)

        d3.select('#offsetTimeInput').on("change", timeInputChange)
        d3.select('#startTimeInput').on("change", timeInputChange)
        d3.select('#endTimeInput').on("change", timeInputChange)
        d3.select('#startRelativeTimeInput').on("change", timeInputChange)
        d3.select('#endRelativeTimeInput').on("change", timeInputChange)

        updateTime()
    },
    toggleTimeUI: function (isOn) {
        d3.select("#timeUI").style('visibility', function() {
            return (isOn === true) ? "visible" : "hidden";
        })
        return isOn       
    },
    setTime: function(startTime, endTime, isRelative, timeOffset='00:00:00') {

        var now = new Date()
        var offset = 0
        if(relativeTimeFormat.test(timeOffset)) {
            offset = parseTime(timeOffset)
        } else {
            // assume seconds otherwise
            offset = parseInt(timeOffset)
        }
        d3.select('#offsetTimeInput').property('value', timeOffset)
        var currentTime = new moment(now).add(offset, 'seconds')
        d3.select('#currentTimeLabel').text(currentTime.toISOString())
        TimeControl.currentTime = currentTime.toDate().toISOString().split('.')[0]+'Z'

        d3.select("#isRelativeTime").property('checked', isRelative)
        if (isRelative == true) {
            d3.select('#startRelativeTimeInput').property('value', startTime)
            d3.select('#endRelativeTimeInput').property('value', endTime)

            var start = parseTime(startTime)
            var end = parseTime(endTime)
            var startTimeM = new moment(currentTime).subtract(start, 'seconds')
            var endTimeM = new moment(currentTime).add(end, 'seconds')
    
            d3.select('#startTimeInput').property('value', startTimeM.toISOString().split('.')[0]+'Z')
            d3.select('#endTimeInput').property('value', endTimeM.toISOString().split('.')[0]+'Z')
        } else {
            var startTimeD = new Date(startTime)
            var endTimeD = new Date(endTime)
            d3.select('#startTimeInput').property('value', startTimeD.toISOString().split('.')[0]+'Z')
            d3.select('#endTimeInput').property('value', endTimeD.toISOString().split('.')[0]+'Z')           
        }
        TimeControl.startTime = d3.select('#startTimeInput').property('value')
        TimeControl.endTime = d3.select('#endTimeInput').property('value')
        TimeControl.updateLayersTime()
        return true
    },
    setLayerTime: function(layer, startTime, endTime) {
        if (typeof layer == 'string') {
            L_.configData.layers.forEach(function (l) {
                if (l.name == layer) {
                    layer = l
                }
            })
        }
        if (layer.time.enabled == true) {
            layer.time.start = startTime
            layer.time.end = endTime
            d3.select('.starttime.' + layer.name.replace(/\s/g,'')).text(layer.time.start)
            d3.select('.endtime.' + layer.name.replace(/\s/g,'')).text(layer.time.end)
        }
        return true
    },
    getTime: function() {
        return TimeControl.currentTime
    },
    getStartTime: function() {
        return TimeControl.startTime
    },
    getEndTime: function() {
        return TimeControl.endTime
    },
    getLayerStartTime: function(layer) {
        if (typeof layer == 'string') {
            L_.configData.layers.forEach(function (l) {
                if (l.name == layer) {
                    layer = l
                }
            })
        }
        return layer.time.start
    },
    getLayerEndTime: function(layer) {
        if (typeof layer == 'string') {
            L_.configData.layers.forEach(function (l) {
                if (l.name == layer) {
                    layer = l
                }
            })
        }
        return layer.time.end
    },
    reloadLayer: function(layer) {
        // reload layer
        if (typeof layer == 'string') {
            L_.configData.layers.forEach(function (l) {
                if (l.name == layer) {
                    layer = l
                }
            })
        }
        console.log('Reloading ' + layer.name)
        if (layer.time.enabled == true) {
            layer.time.current = TimeControl.currentTime // keeps track of when layer was refreshed
            if (layer.type == 'tile') {
                if (typeof L_.layersGroup[layer.name].wmsParams !== 'undefined') {
                    L_.layersGroup[layer.name].wmsParams.TIME = layer.time.end
                }
                L_.layersGroup[layer.name].options.time = layer.time.end
                L_.toggleLayer(layer)
                L_.toggleLayer(layer)
            } else {
                // replace start/endtime keywords
                layer.url = layer.url
                .replace('{starttime}', layer.time.start)
                .replace('{endtime}', layer.time.end)
                // refresh map
                Map_.refreshLayer(layer)
                // put start/endtime keywords back
                layer.url = layer.url
                .replace(layer.time.start, '{starttime}')
                .replace(layer.time.end, '{endtime}')
            }
        }

        return true
    },
    reloadTimeLayers: function() {
        // refresh time enabled layers
        var reloadedLayers = []
        L_.configData.layers.forEach(function (layer) {
            if (layer.time.enabled == true) {
                TimeControl.reloadLayer(layer)
                reloadedLayers.push(layer.name)
            }
        })
        return reloadedLayers
    },
    updateLayersTime: function() {
        var updatedLayers = []
        L_.configData.layers.forEach(function (layer) {
            if (layer.time.enabled == true && layer.time.type == 'global') {
                layer.time.start = TimeControl.startTime
                layer.time.end = TimeControl.endTime
                d3.select('.starttime.' + layer.name.replace(/\s/g,'')).text(layer.time.start)
                d3.select('.endtime.' + layer.name.replace(/\s/g,'')).text(layer.time.end)
                updatedLayers.push(layer.name)
            }
        })
        return updatedLayers
    },
    setLayerTimeStatus: function(layer, color) {
        if (typeof layer == 'string') {
            L_.configData.layers.forEach(function (l) {
                if (l.name == layer) {
                    layer = l
                }
            })
        }
        layer.time.status = color
        d3.select('#timesettings' + layer.name.replace(/\s/g,'')).style('color', layer.time.status)
        return true
    },
    setLayersTimeStatus: function(color) {
        var updatedLayers = []
        L_.configData.layers.forEach(function (layer) {
            if (layer.time.enabled == true && layer.time.type == 'global') {
                TimeControl.setLayerTimeStatus(layer, color)
                updatedLayers.push(layer.name)
            }
        })
        return updatedLayers
    },
}

function updateTime() {
    // Continuously update global time clock and UI elements
    var now = new Date()
    var offset = 0
    var offsetTime = d3.select('#offsetTimeInput').property('value')
    if(relativeTimeFormat.test(offsetTime)) {
        offset = parseTime(offsetTime)
    }
    var currentTime = new moment(now).add(offset, 'seconds')
    d3.select('#currentTimeLabel').text(currentTime.toISOString())
    TimeControl.currentTime = currentTime.toDate().toISOString().split('.')[0]+'Z'

    if (d3.select("#isRelativeTime").property('checked') == true) {
        var start = parseTime(d3.select('#startRelativeTimeInput').property('value'))
        var end = parseTime(d3.select('#endRelativeTimeInput').property('value'))
        var startTime = new moment(currentTime).subtract(start, 'seconds')
        var endTime = new moment(currentTime).add(end, 'seconds')

        TimeControl.startTime = startTime.toDate().toISOString().split('.')[0]+'Z'
        TimeControl.endTime = endTime.toDate().toISOString().split('.')[0]+'Z'

        d3.select('#startTimeInput').property('value', startTime.toISOString().split('.')[0]+'Z')
        d3.select('#endTimeInput').property('value', endTime.toISOString().split('.')[0]+'Z')
    }
    setTimeout(updateTime, 100)
}

function timeInputChange() {
    // Validate time format
    var timeInput = d3.select(this).property('value')
    if(relativeTimeFormat.test(timeInput)) {
        d3.select(this).style('background-color', '#ffffff')
    } else {
        d3.select(this).style('background-color', '#ff0000')
    }

    TimeControl.startTime = d3.select('#startTimeInput').property('value')
    TimeControl.endTime = d3.select('#endTimeInput').property('value')

    // Update layer times and reload
    TimeControl.updateLayersTime()
    TimeControl.reloadTimeLayers()
}

function parseTime( t ) {
    if (t.toString().indexOf(':') == -1) {
        return parseInt(t)
    }
    var s = t.split(':')
    var seconds = (+s[0].replace('-','')) * 60 * 60 + (+s[1]) * 60 + (+s[2])
    if (t.charAt(0) === '-') {
        seconds = seconds * -1
    }
    return seconds
 }

 function formatTimeString( seconds ) {
     // converts seconds to hh:mm:ss
    if (typeof seconds === 'undefined') {
        return '00:00:00'
    }
    var t = Math.abs(seconds)
    var days = Math.floor(t / 86400)
    var dt = new Date(t * 1000)
    var dtString = dt.toISOString().substr(11, 8)
    var s = dtString.split(':')
    var hours = +s[0] + days * 24
    return ((seconds < 0) ? '-' : '') + hours + ':' + s[1] + ':' + s[2]
 }

export default TimeControl
