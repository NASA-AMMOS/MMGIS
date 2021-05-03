// TimeControl sets up a div that displays the time controller
import * as d3 from 'd3'
import * as moment from 'moment'
import L_ from '../Basics/Layers_/Layers_'

var TimeControl = {
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
            .text('Now: ')
        timeUI.append('label')
            .attr('id', 'currentTime')
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
            .attr('id', 'startTime')
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
            .attr('id', 'endTime')
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
        timeUI.append('input')
            .attr('id', 'isRelativeTime')
            .attr('type', 'checkbox')
        timeUI.append('label')
            .attr('id', 'useRelativeTime')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-align', 'center')
            .style(
                'text-shadow',
                '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
            )
            .text(' Use relative time')
            timeUI.append('span')
            .style( 'padding', '38px')
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
            .style( 'padding', '34px')
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

        // d3.select('#startTimeInput').property('value', '2021-01-01T00:00:00Z')
        // d3.select('#endTimeInput').property('value', '2021-01-01T23:59:59Z')
        d3.select('#startTimeInput').on("change", timeInputChange)
        d3.select('#endTimeInput').on("change", timeInputChange)
        d3.select('#startRelativeTimeInput').property('value', '00:10:00')
        d3.select('#endRelativeTimeInput').property('value', '00:30:00')
        d3.select('#startRelativeTimeInput').on("change", timeInputChange)
        d3.select('#endRelativeTimeInput').on("change", timeInputChange)

        updateTime()
    },
    clear: function () {},
    toggleTimeUI: function (isOn) {
        d3.select("#timeUI").style('visibility', function() {
            return (isOn === true) ? "visible" : "hidden";
        })
        return isOn       
    },
    setTime: function(startTime, endTime, isRelative) {
        d3.select("#isRelativeTime").property('checked', isRelative)
        if (isRelative == true) {
            d3.select('#startRelativeTimeInput').property('value', startTime)
            d3.select('#endRelativeTimeInput').property('value', endTime)

            var start = parseTime(startTime)
            var end = parseTime(endTime)
            var startTimeM = new moment(new Date()).subtract(start, 'seconds')
            var endTimeM = new moment(new Date()).add(end, 'seconds')
    
            d3.select('#startTimeInput').property('value', startTimeM.toISOString().split('.')[0]+'Z')
            d3.select('#endTimeInput').property('value', endTimeM.toISOString().split('.')[0]+'Z')
        } else {
            var startTimeD = new Date(startTime)
            var endTimeD = new Date(endTime)
            d3.select('#startTimeInput').property('value', startTimeD.toISOString().split('.')[0]+'Z')
            d3.select('#endTimeInput').property('value', endTimeD.toISOString().split('.')[0]+'Z')           
        }
        return true
    },
    setLayerTime: function(layerName, endTime, startTime, isRelative) {

    },
    setDrawingTime: function(fileId, endTime) {

    }
}

function updateTime() {
    var now = new Date()
    d3.select('#currentTime').text(now.toISOString())

    if (d3.select("#isRelativeTime").property('checked') == true) {
        var start = parseTime(d3.select('#startRelativeTimeInput').property('value'))
        var end = parseTime(d3.select('#endRelativeTimeInput').property('value'))
        var startTime = new moment(new Date()).subtract(start, 'seconds')
        var endTime = new moment(new Date()).add(end, 'seconds')

        d3.select('#startTimeInput').property('value', startTime.toISOString().split('.')[0]+'Z')
        d3.select('#endTimeInput').property('value', endTime.toISOString().split('.')[0]+'Z')
    }

    setTimeout(updateTime, 100)
}

function timeInputChange(e) {
    // console.log('Time control has been changed')
}

function parseTime( t ) {
    var s = t.split(':');
    var seconds = (+s[0]) * 60 * 60 + (+s[1]) * 60 + (+s[2]);
    return seconds
 }

export default TimeControl
