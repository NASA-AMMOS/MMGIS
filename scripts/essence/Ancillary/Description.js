//The bottom left text that describes to the user the basic mmgis state

define(['jquery', 'd3', 'Formulae_'], function($, d3, F_) {
    var Description = {
        descCont: null,
        descMission: null,
        descSite: null,
        descPoint: null,
        L_: null,
        init: function(mission, site, Map_, L_) {
            this.L_ = L_
            this.Map_ = Map_
            this.descCont = d3.select(
                '#main-container > #topBar .mainDescription'
            )
            this.descInfoCont = d3.select('#main-container > #topBar .mainInfo')
            /*
            this.descMission = descCont
                .append('div')
                .attr('id', 'mainDescMission')
                .style('line-height', '32px')
                .style('padding-left', '8px')
                .style('color', '#EEE')
                .style('font-size', '22px')
                .style('margin', '0')
                .style('cursor', 'default')
                .style('text-align', 'center')
                .style('cursor', 'pointer')
                .html(mission)
            var missionWidth = $('#mainDescMission').width() + 3
            */

            this.descSite = this.descCont
                .append('p')
                .attr('id', 'mainDescSite')
                .style('display', 'none') //!!!!!!!!!!!!
                .style('line-height', '29px')
                .style('color', '#CCC')
                .style('font-size', '16px')
                .style('font-weight', 'bold')
                .style('cursor', 'pointer')
                .style('margin', '0')

            this.descPoint = this.descCont
                .append('p')
                .attr('id', 'mainDescPoint')
                .style('display', 'flex')
                .style('white-space', 'nowrap')
                .style('line-height', '29px')
                .style('font-size', '14px')
                .style('color', 'var(--color-mw2)')
                .style('font-weight', 'bold')
                .style('cursor', 'pointer')
                .style('margin', '0')

            this.descPointInner = this.descPoint
                .append('div')
                .attr('id', 'mainDescPointInner')
                .style('display', 'flex')
                .style('white-space', 'nowrap')
                .style('line-height', '29px')
                .style('font-size', '14px')
                .style('color', 'var(--color-mw2)')
                .style('font-weight', 'bold')
                .style('cursor', 'pointer')
                .style('margin', '0')
            this.descPointLinks = this.descPoint
                .append('div')
                .attr('id', 'mainDescPointLinks')
                .style('display', 'flex')
                .style('white-space', 'nowrap')
                .style('line-height', '29px')
                .style('font-size', '14px')
                .style('color', '#AAA')
                .style('font-weight', 'bold')
                .style('cursor', 'pointer')
                .style('margin', '0')

            Description.descPointInner.on('click', function() {
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
                            Map_.mapScaleZoom || Map_.map.getZoom()
                        )
            })
        },
        updateInfo() {
            let infos = []

            for (let layer in this.L_.layersNamed) {
                let l = this.L_.layersNamed[layer]
                if (
                    l.hasOwnProperty('variables') &&
                    l.variables.hasOwnProperty('info') &&
                    l.variables.info.hasOwnProperty('length')
                ) {
                    let layers = this.L_.layersGroup[layer]._layers
                    let newInfo = ''
                    for (let i = 0; i < l.variables.info.length; i++) {
                        let which =
                            l.variables.info[i].which != null &&
                            !isNaN(l.variables.info[i].which)
                                ? Math.max(
                                      Math.min(
                                          which,
                                          Object.keys(layers).length - 1
                                      ),
                                      0
                                  )
                                : Object.keys(layers).length - 1
                        let feature = layers[Object.keys(layers)[which]].feature
                        let infoText = F_.bracketReplace(
                            l.variables.info[i].value,
                            feature.properties
                        )
                        let lat = !isNaN(feature.geometry.coordinates[1])
                            ? feature.geometry.coordinates[1]
                            : null
                        let lng = !isNaN(feature.geometry.coordinates[0])
                            ? feature.geometry.coordinates[0]
                            : null

                        newInfo += '<div lat="' + lat + '" lng="' + lng + '">'
                        if (l.variables.info[i].icon)
                            newInfo +=
                                "<i class='mdi mdi-" +
                                l.variables.info[i].icon +
                                " mdi-18px'></i>"
                        newInfo += '<div>' + infoText + '</div></div>'
                    }
                    if (newInfo.length > 0) infos.push(newInfo)
                }
            }
            this.descInfoCont.html(infos.join('\n'))

            this.descInfoCont.style('display', 'flex')
            $('#main-container > #topBar .mainInfo').animate(
                {
                    opacity: 1,
                },
                80
            )

            d3.select('#main-container > #topBar .mainInfo > div').on(
                'click',
                function() {
                    let lat = d3.select(this).attr('lat')
                    let lng = d3.select(this).attr('lng')

                    if (lat != null && lng != null) {
                        Description.Map_.map.setView(
                            [lat, lng],
                            Description.Map_.mapScaleZoom ||
                                Description.Map_.map.getZoom()
                        )
                    }
                }
            )
        },
        updateSite: function(site) {
            if (site != null) {
                Description.descSite.html(site)
            }
        },
        updatePoint: function(activeLayer) {
            this.descCont.style('display', 'flex')
            $('#main-container > #topBar .mainDescription').animate(
                {
                    opacity: 1,
                },
                80
            )
            if (activeLayer != null && activeLayer.hasOwnProperty('options')) {
                var keyAsName
                var links = "<span style='padding-left: 4px;'></span>"

                if (
                    this.L_.layersNamed[activeLayer.options.layerName] &&
                    this.L_.layersNamed[activeLayer.options.layerName].variables
                ) {
                    let v = this.L_.layersNamed[activeLayer.options.layerName]
                        .variables
                    if (v.links) {
                        links = ''
                        for (let i = 0; i < v.links.length; i++) {
                            links +=
                                "<a href='" +
                                F_.bracketReplace(
                                    v.links[i].link,
                                    activeLayer.feature.properties
                                ) +
                                "' target='" +
                                F_.cleanString(v.links[i].name) +
                                "'>" +
                                v.links[i].name +
                                "<i class='mdi mdi-open-in-new mdi-12px'></i>" +
                                '</a>'
                        }
                    }
                }

                let key =
                    activeLayer.useKeyAsName ||
                    Object.keys(activeLayer.feature.properties)[0]
                keyAsName =
                    activeLayer.feature.properties[key] +
                    ' <div style="font-size: 12px; padding: 0px 3px; opacity: 0.8;">(' +
                    key +
                    ')</div>'

                Description.descPointInner.html(
                    activeLayer.options.layerName + ': ' + keyAsName
                )
                Description.descPointLinks.html(links)
            }
        },
    }

    return Description
})
