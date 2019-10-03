//The bottom left text that describes to the user the basic mmgis state

define(['jquery', 'd3', 'Formulae_'], function($, d3, F_) {
    var Description = {
        descMission: null,
        descSite: null,
        descPoint: null,
        init: function(mission, site, Map_) {
            var descCont = d3
                .select('body')
                .append('div')
                .attr('class', 'mainDescription')
                .style('display', 'none') //!!!!!!!!!!!!!!!!!!!!!1
                .style('position', 'absolute')
                .style('bottom', '4px')
                .style('left', '12px')
                .style('margin', '0')
                .style('z-index', '20')
            this.descMission = descCont
                .append('div')
                .attr('id', 'mainDescMission')
                .style('position', 'absolute')
                .style('bottom', '8px')
                .style('color', '#EEE')
                .style('font-size', '42px')
                .style('font-weight', 'bold')
                .style('margin', '0')
                .style('opacity', '0.6')
                .style('cursor', 'default')
                .style('text-align', 'center')
                .html(mission)
            var missionWidth = $('#mainDescMission').width() + 3
            this.descSite = descCont
                .append('p')
                .attr('id', 'mainDescSite')
                .style('position', 'absolute')
                .style('bottom', '17px')
                .style('left', missionWidth + 'px')
                .style('color', '#CCC')
                .style('font-weight', 'bold')
                .style('cursor', 'pointer')
                .style('margin', '0')
            this.descPoint = descCont
                .append('p')
                .attr('id', 'mainDescPoint')
                .style('white-space', 'nowrap')
                .style('position', 'absolute')
                .style('bottom', '0px')
                .style('left', missionWidth + 'px')
                .style('color', '#CCC')
                .style('font-weight', 'bold')
                .style('cursor', 'pointer')
                .style('margin', '0')

            Description.descPoint.on('click', function() {
                if (
                    Map_.activeLayer.feature.geometry.coordinates[1] &&
                    Map_.activeLayer.feature.geometry.coordinates[0]
                )
                    if (
                        !isNaN(
                            Map_.activeLayer.feature.geometry.coordinates[1]
                        ) &&
                        !isNaN(Map_.activeLayer.feature.geometry.coordinates[0])
                    )
                        Map_.map.setView(
                            [
                                Map_.activeLayer.feature.geometry
                                    .coordinates[1],
                                Map_.activeLayer.feature.geometry
                                    .coordinates[0],
                            ],
                            21
                        )
            })
        },
        updateSite: function(site) {
            if (site != null) {
                Description.descSite.html(site)
            }
        },
        updatePoint: function(activeLayer) {
            if (activeLayer != null && activeLayer.hasOwnProperty('options')) {
                var keyAsName
                if (activeLayer.hasOwnProperty('useKeyAsName')) {
                    keyAsName =
                        activeLayer.feature.properties[activeLayer.useKeyAsName]
                } else {
                    keyAsName = activeLayer.feature.properties[0]
                }
                Description.descPoint.html(
                    activeLayer.options.layerName + ': ' + keyAsName
                )
            }
        },
    }

    return Description
})
