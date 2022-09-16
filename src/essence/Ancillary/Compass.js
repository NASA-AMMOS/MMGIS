// Compass sets up a directional compass for the leafet map
import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
import Map_ from '../Basics/Map_/Map_'

var Compass = {
    CompassSVG: null,
    ScaleBox: null,
    init: function (scaleBox) {
        //Reset the scale bars at the end of the user's zooms or pans
        Map_.map.on('zoomend', Compass.update)
        Map_.map.on('moveend', Compass.update)
        // Update at first to so it's initially visible
        Compass.update()
    },
    refresh: function () {
        Compass.update()
    },
    remove: function () {
        Map_.map.off('zoomend', Compass.update)
        Map_.map.off('moveend', Compass.update)
    },
    update: function () {
        const mapRect = document.getElementById('map').getBoundingClientRect()

        // Find center of map
        const wOffset = mapRect.width / 2
        const hOffset = mapRect.height / 2

        //Find coordinates at map center and at another point one pixel below the center
        const centerLatLong = Map_.map.containerPointToLatLng([
            wOffset,
            hOffset,
        ])
        const pixelBelowCenterLatLong = Map_.map.containerPointToLatLng([
            wOffset,
            hOffset + 1,
        ])

        const bearing = F_.bearingBetweenTwoLatLngs(
            pixelBelowCenterLatLong.lat,
            pixelBelowCenterLatLong.lng,
            centerLatLong.lat,
            centerLatLong.lng
        )

        $('#mmgis-map-compass').remove()
        // prettier-ignore
        $('.leaflet-bottom.leaflet-left').append(
            [
                `<div id='mmgis-map-compass'>`,
                    `<div class='spin' style='transform: rotateZ(${bearing}deg)'>`,
                        `<div class='north'></div>`,
                        `<div class='south'></div>`,
                    `</div>`,
                `</div>`
            ].join('\n')
        )
    },
}

function setCompassOLD() {
    d3.select('#scale_axis_xL').remove()
    d3.select('#scale_axis_xS').remove()

    var barLength = 250

    let mapRect = document.getElementById('map').getBoundingClientRect()
    //Find center of map
    var wOffset = mapRect.width / 2
    var hOffset = mapRect.height / 2

    //Find coordinates at map center and at another point a bit right of
    // the center. L and S are for large and small as it take two distances
    // to have a staged scale bar like: 0 20  50
    var leftLatLong = Map_.map.containerPointToLatLng([wOffset, hOffset])
    var rightLatLongL = Map_.map.containerPointToLatLng([
        wOffset + barLength,
        hOffset,
    ])
    var rightLatLongS = Map_.map.containerPointToLatLng([
        wOffset + barLength / 4,
        hOffset,
    ])

    //Create appropriate scales by measuring distance between above points
    var distL
    var distS
    distL = F_.lngLatDistBetween(
        leftLatLong['lng'],
        leftLatLong['lat'],
        rightLatLongL['lng'],
        rightLatLongL['lat']
    )
    distS = F_.lngLatDistBetween(
        leftLatLong['lng'],
        leftLatLong['lat'],
        rightLatLongS['lng'],
        rightLatLongS['lat']
    )

    var XScaleL = d3.scaleLinear().domain([0, distL]).range([0, barLength])
    var XScaleS = d3
        .scaleLinear()
        .domain([0, distS])
        .range([0, barLength / 4])

    var xAxisLarge = d3
        .axisBottom()
        .scale(XScaleL)
        .tickSize(8)
        .ticks(2)
        .tickFormat(function (d) {
            if (d == 0) return d
            if (d < 1) return d * 100 + 'cm'
            if (d > 1000) return d / 1000 + 'km'
            return d + 'm'
        })
    var xAxisSmall = d3
        .axisBottom()
        .scale(XScaleS)
        .tickSize(8)
        .ticks(1)
        .tickFormat(function (d) {
            if (d == 0) return d
            if (d < 1) return d * 100 + 'cm'
            if (d > 1000) return d / 1000 + 'km'
            return d + 'm'
        })

    Compass.CompassSVG = d3.select('#Compass')

    var axisGroupXL = Compass.CompassSVG.append('g')
        .attr('id', 'scale_axis_xL')
        .style('fill', '#DCDCDC')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('position', 'absolute')
        .attr('transform', 'translate(12, 8)')
    var axisGroupXS = Compass.CompassSVG.append('g')
        .attr('id', 'scale_axis_xS')
        .style('fill', '#DCDCDC')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .attr('transform', 'translate(12, 8)')

    axisGroupXL.call(xAxisLarge)
    axisGroupXS.call(xAxisSmall)

    d3.select('#scale_axis_xL path').remove()
    d3.select('#scale_axis_xS path').remove()

    var bw = d3.scaleLinear().domain([0, 1]).range(['#161616', '#DCDCDC'])
    var prevX = 0
    d3.selectAll('#scale_axis_xL .tick').each(function (d, i) {
        if (i != 0) {
            var x = d3.select(this).attr('transform')
            x = x.replace('translate(', '')
            x = x.split(',')[0]
            if (x < barLength - 10) {
                d3.select('#scale_axis_xL')
                    .append('line')
                    .attr('x1', prevX)
                    .attr('y1', 0)
                    .attr('x2', x)
                    .attr('y2', 0)
                    .style('stroke', bw((i + 1) % 2))
                    .style('stroke-width', '14px')
                d3.select('#scale_axis_xL')
                    .append('line')
                    .attr('x1', prevX)
                    .attr('y1', 0)
                    .attr('x2', x)
                    .attr('y2', 0)
                    .style('stroke', bw(i % 2))
                    .style('stroke-width', '10px')
                prevX = x
            } else d3.select(this).remove()
        }
        d3.select(this).select('line').remove()

        d3.select(this)
            .select('text')
            .style('fill', '#fff')
            .style('stroke', '#000000')
            .style('stroke-width', '3px')
            .style('paint-order', 'stroke')
    })

    prevX = 0
    d3.selectAll('#scale_axis_xS .tick').each(function (d, i) {
        var x = d3.select(this).attr('transform')
        x = x.replace('translate(', '')
        x = x.split(',')[0]
        if (i != 0) {
            d3.select('#scale_axis_xS')
                .append('line')
                .attr('x1', prevX)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', 0)
                .style('stroke', bw(i % 2))
                .style('stroke-width', '14px')
            d3.select('#scale_axis_xS')
                .append('line')
                .attr('x1', prevX)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', 0)
                .style('stroke', bw((i + 1) % 2))
                .style('stroke-width', '10px')
        }
        prevX = x

        d3.select(this).select('line').remove()

        d3.select(this)
            .select('text')
            .style('fill', '#fff')
            .style('stroke', '#000000')
            .style('stroke-width', '3px')
            .style('paint-order', 'stroke')
    })

    //d3.select('#scale_axis_xS .tick').style('opacity', '0')
}

export default Compass
