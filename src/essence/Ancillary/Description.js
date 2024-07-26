//The bottom left text that describes to the user the basic mmgis state
import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Basics/Formulae_/Formulae_'
import Dropy from '../../external/Dropy/dropy'
import calls from '../../pre/calls'

import tippy from 'tippy.js'

import './Description.css'

const Description = {
    inited: false,
    waitingOnUpdate: false,
    descCont: null,
    descMission: null,
    descPoint: null,
    tippyDesc: null,
    tippyMenu: null,
    tippyPrevious: null,
    tippyNext: null,
    L_: null,
    _infoAlreadyGone: false,
    init: function (mission, site, Map_, L_) {
        this.L_ = L_
        this.Map_ = Map_
        this.descCont = d3.select('.mainDescription').attr('title', '')
        this.descInfoCont = d3.select('.mainInfo')
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

        // prettier-ignore
        const navMarkup = [
            `<div id="mainDescNavBar">`,
                `<div id="mainDescNavBarMenu" title="">`,
                    `<i class='mdi mdi-dots-vertical mdi-18px'></i>`,
                `</div>`,
                `<div id="mainDescNavBarPrevious" title="">`,
                    `<i class='mdi mdi-chevron-left mdi-24px'></i>`,
                `</div>`,
                `<div id="mainDescNavBarNext" title="">`,
                    `<i class='mdi mdi-chevron-right mdi-24px'></i>`,
                `</div>`,
            `</div>`
        ].join('\n')

        // prettier-ignore
        const navPopoverMarkup = [
            `<div id="mainDescNavPopover">`,
                `<div id="mainDescNavPopoverTitle">Feature Navigation</div>`,
                `<div id="mainDescNavPopoverField">`,
                    `<div id="mainDescNavPopoverFieldField" class="ui dropdown short"></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverExtent">`,
                    `<div>Current Extent</div>`,
                    `<div class="mmgis-checkbox"><input type="checkbox" ${false ? 'checked ' : ''}id="checkbox_dp1" value='topbar'/><label for="checkbox_dp1"></label></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverPanTo">`,
                    `<div>Pan To</div>`,
                    `<div class="mmgis-checkbox"><input type="checkbox" ${false ? 'checked ' : ''}id="checkbox_dp2" value='topbar'/><label for="checkbox_dp2"></label></div>`,
                `</div>`,
                `<div id="mainDescNavPopoverBottom">`,
                    `<div id="mainDescNavPopoverBottomFirst">`,
                        `<i class='mdi mdi-page-first mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mainDescNavPopoverBottomPrevious">`,
                        `<i class='mdi mdi-chevron-left mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mainDescNavPopoverBottomNext">`,
                        `<i class='mdi mdi-chevron-right mdi-24px'></i>`,
                    `</div>`,
                    `<div id="mainDescNavPopoverBottomLast">`,
                        `<i class='mdi mdi-page-last mdi-24px'></i>`,
                    `</div>`,
                `</div>`,
            `</div>`,
        ].join('\n')
        this.descNav = this.descCont
            .append('div')
            .attr('id', 'mainDescNav')
            .html(navMarkup)

        d3.select('body')
            .append('div')
            .attr('id', 'mainDescNavPopover_global')
            .html(navPopoverMarkup)

        $('#mainDescNavPopoverFieldField').html(
            Dropy.construct(['0', '1'], 'Field')
        )
        Dropy.init($('#mainDescNavPopoverFieldField'), function (idx, a, b) {
            console.log(idx, a, b)
        })

        $(`#mainDescNavBarMenu`).on('click', () => {
            const pop = $(`#mainDescNavPopover`)
            const willOpen = pop.css('display') === 'none'
            pop.css({
                display: willOpen ? 'block' : 'none',
            })
            $(`#mainDescNavBarMenu`).css({
                background: willOpen ? 'var(--color-c)' : 'var(--color-a)',
            })
            if (willOpen) {
                const bcr = $(`#mainDescNavBarMenu`)
                    .get(0)
                    .getBoundingClientRect()
                pop.css({
                    position: 'fixed',
                    left: bcr.left,
                    right: bcr.right,
                    top: bcr.top + 30,
                })
            }
        })

        $(`#mainDescNavBarPrevious`).on('click', () => {
            if (L_.activeFeature)
                L_.selectFeature(
                    L_.activeFeature.layerName,
                    L_.activeFeature.feature,
                    -1
                )
        })
        $(`#mainDescNavBarNext`).on('click', () => {
            if (L_.activeFeature)
                L_.selectFeature(
                    L_.activeFeature.layerName,
                    L_.activeFeature.feature,
                    1
                )
        })

        this.descPoint = this.descCont.append('p').attr('id', 'mainDescPoint')

        this.descPointInner = this.descPoint
            .append('div')
            .attr('id', 'mainDescPointInner')
            .attr('tabindex', 300)
            .style('display', 'flex')
            .style('white-space', 'nowrap')
            .style('line-height', '29px')
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
            .style('overflow', 'hidden')

        Description.descPointInner.on('click', function () {
            if (typeof Map_.activeLayer.getBounds === 'function')
                Map_.map.fitBounds(Map_.activeLayer.getBounds())
            else if (Map_.activeLayer._latlng)
                Map_.map.panTo(Map_.activeLayer._latlng)
        })

        this.inited = true
        if (this.waitingOnUpdate) this.updateInfo()

        $(window).on('resize', () => {
            $('#mainDescPointLinks > dl.dropy').removeClass('open')
            $(`#mainDescPointLinks_global`).empty()
        })
    },
    updateInfo(force, forceFeature, skipRequery) {
        if (force !== true) {
            this.waitingOnUpdate = false
            if (!this.inited) {
                this.waitingOnUpdate = true
                return
            }
        }

        this.descInfoCont.html('')

        let infos = []

        for (let layer in this.L_.layers.data) {
            let l = this.L_.layers.data[layer]
            if (
                this.L_.layers.on[layer] === true &&
                this.L_.layers.layer[layer] &&
                l.hasOwnProperty('variables') &&
                l.variables.hasOwnProperty('info') &&
                l.variables.info.hasOwnProperty('length')
            ) {
                let layers = this.L_.layers.layer[layer]._layers

                if (
                    Object.keys(layers).length === 0 &&
                    this.L_.layers.data[layer].variables.dynamicExtent
                ) {
                    let geodatasetName = this.L_.layers.data[layer].url
                    if (
                        skipRequery !== true &&
                        geodatasetName.indexOf('geodatasets:') === 0
                    ) {
                        geodatasetName = geodatasetName.replace(
                            'geodatasets:',
                            ''
                        )

                        calls.api(
                            'geodatasets_search',
                            {
                                layer: geodatasetName,
                                last: true,
                            },
                            function (d) {
                                Description.updateInfo(
                                    false,
                                    d?.body?.[0],
                                    true
                                )
                            },
                            function (d) {}
                        )
                        return
                    }
                }
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
                    let feature =
                        forceFeature ||
                        layers[Object.keys(layers)[which]]?.feature
                    if (feature == null) {
                        continue
                    }

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

                    newInfo +=
                        '<div lat="' +
                        lat +
                        '" lng="' +
                        lng +
                        '" tabindex="' +
                        (301 + i) +
                        '">'
                    if (l.variables.info[i].icon)
                        newInfo +=
                            "<i class='mdi mdi-" +
                            l.variables.info[i].icon +
                            " mdi-18px'></i>"
                    newInfo += '<div>' + infoText + '</div></div>'

                    // Go initially
                    if (Description._infoAlreadyGone == false) {
                        if (l.variables.info[i].go == true) {
                            if (lat != null && lng != null) {
                                Description.Map_.map.setView(
                                    [lat, lng],
                                    Description.Map_.mapScaleZoom ||
                                        Description.Map_.map.getZoom()
                                )
                            }
                            Description._infoAlreadyGone = true
                        }
                    }
                }
                if (newInfo.length > 0) infos.push(newInfo)
            }
        }
        this.descInfoCont.html(infos.join('\n'))

        this.descInfoCont.style('display', 'flex')
        $('.mainInfo').animate(
            {
                opacity: 1,
            },
            80
        )

        d3.select('.mainInfo > div').on('click', function () {
            let lat = d3.select(this).attr('lat')
            let lng = d3.select(this).attr('lng')

            if (lat != null && lng != null && lat != 'null' && lng != 'null') {
                Description.Map_.map.setView(
                    [lat, lng],
                    Description.Map_.mapScaleZoom ||
                        Description.Map_.map.getZoom()
                )
            }
        })
        Description._infoAlreadyGone = true
    },
    updatePoint: function (activeLayer) {
        if (
            activeLayer == null ||
            Description.L_.layers.data[activeLayer.options.layerName] == null
        )
            return

        this.descCont.style('display', 'flex')
        $('.mainDescription').animate(
            {
                opacity: 1,
            },
            80
        )
        if (
            activeLayer != null &&
            activeLayer.feature &&
            activeLayer.hasOwnProperty('options')
        ) {
            var keyAsName
            const links = []

            if (
                this.L_.layers.data[activeLayer.options.layerName] &&
                this.L_.layers.data[activeLayer.options.layerName].variables
            ) {
                let v =
                    this.L_.layers.data[activeLayer.options.layerName].variables

                if (v.links) {
                    for (let i = 0; i < v.links.length; i++) {
                        const link = F_.bracketReplace(
                            v.links[i].link,
                            activeLayer.feature.properties,
                            v.links[i].replace
                        )
                        if (link != null && link != '')
                            links.push({
                                name: `<span style='display: flex; justify-content: space-between;'>${v.links[i].name}<i class='mdi mdi-open-in-new mdi-14px' style='margin-left: 4px; margin-top: 1px;'></i></span>`,
                                link: link,
                                target: F_.cleanString(v.links[i].name),
                            })
                    }
                }
            }

            let key = activeLayer.useKeyAsName || 'name'

            if (
                !(
                    typeof activeLayer.feature.properties[key] === 'string' ||
                    typeof activeLayer.feature.properties[key] === 'number'
                )
            ) {
                const propKeys = Object.keys(activeLayer.feature.properties)
                for (let i = 0; i < propKeys.length; i++) {
                    if (
                        typeof activeLayer.feature.properties[propKeys[i]] ===
                            'string' ||
                        typeof activeLayer.feature.properties[propKeys[i]] ===
                            'number'
                    ) {
                        key = propKeys[i]
                        break
                    }
                }
            }

            keyAsName =
                ` <div style="max-width: 180px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${activeLayer.feature.properties[key]}</div>` +
                ' <div class="mainDescPointInnerType" style="font-size: 11px; padding: 0px 3px; opacity: 0.8;">(' +
                key +
                ')</div>'

            Description.descPointInner.html(
                Description.L_.layers.data[activeLayer.options.layerName]
                    .display_name +
                    ': ' +
                    keyAsName
            )

            $('#mainDescPointLinks_global').remove()
            const globalConstruct = Dropy.construct(
                links.map((l) => l.name),
                `<i class='mdi mdi-link mdi-18px'></i>`,
                null,
                {
                    openUp: false,
                    dark: true,
                }
            )
            $('#mainDescPointLinks').html(globalConstruct)
            Dropy.init(
                $('#mainDescPointLinks'),
                function (idx) {
                    if (links[idx] && links[idx].link)
                        window.open(
                            links[idx].link,
                            links[idx].target || '_blank'
                        )
                },
                null,
                null,
                { dontChange: true, globalConstruct }
            )

            if (Description.tippyDesc && Description.tippyDesc[0])
                Description.tippyDesc[0].setContent(
                    activeLayer.feature.properties[key]
                )
            else
                Description.tippyDesc = tippy('#mainDescPointInner', {
                    content: activeLayer.feature.properties[key],
                    placement: 'bottom',
                    theme: 'blue',
                })

            if (Description.tippyMenu == null)
                Description.tippyMenu = tippy('#mainDescNavBarMenu', {
                    content: 'Feature Navigation',
                    placement: 'bottom',
                    theme: 'blue',
                })
            if (Description.tippyPrevious == null)
                Description.tippyPrevious = tippy('#mainDescNavBarPrevious', {
                    content: 'Previous Feature',
                    placement: 'left',
                    theme: 'blue',
                })
            if (Description.tippyNext == null)
                Description.tippyNext = tippy('#mainDescNavBarNext', {
                    content: 'Next Feature',
                    placement: 'right',
                    theme: 'blue',
                })
        }
    },
    clearDescription: function () {
        // Clear the description
        $('#mainDescPointInner').empty()
        $('#mainDescPointLinks').empty()

        // Reset the style
        this.descCont.attr('style', null)
    },
}

export default Description
