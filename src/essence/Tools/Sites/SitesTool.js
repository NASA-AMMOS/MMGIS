import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import TC_ from '../../Basics/ToolController_/ToolController_'
import Globe_ from '../../Basics/Globe_/Globe_'

var SitesTool = {
    height: 0,
    width: 140,
    vars: null,
    sitesVar: null,
    initialize: function () {
        this.vars = L_.getToolVars('sites')
        this.sitesVar = this.vars.sites

        //Don't set a default site if custom on layers were passed
        // in the url since setting the site would immediately override
        if (L_.FUTURES.site != null) {
            SitesTool.setSite(
                L_.FUTURES.site,
                L_.FUTURES.mapView,
                true,
                L_.FUTURES.customOn
            )
            L_.FUTURES.site = null
        } else {
            if (this.sitesVar != null)
                SitesTool.setSite(
                    this.sitesVar[0].code,
                    L_.FUTURES.mapView,
                    false,
                    L_.FUTURES.customOn
                )
        }
    },
    make: function () {
        var tools = d3.select('#toolPanel')
        tools
            .style('background', 'var(--color-k)')
            .style('box-shadow', 'inset 2px 0px 10px 0px rgba(0,0,0,0.2)')

        tools.selectAll('*').remove()
        tools
            .append('div')
            .style('height', '40px')
            .style('line-height', '40px')
            .style('font-size', '16px')
            .style('color', 'var(--color-l)')
            .style('background', 'var(--color-a)')
            .style('font-family', 'lato-light')
            .style('text-transform', 'uppercase')
            .style('padding-left', '6px')
            .html('Sites')

        tools = tools
            .append('div')
            .attr('id', 'SitesTool')
            .attr('class', 'mmgisScrollbar')
            .style('color', '#cfcfcf')
            .style('height', '100%')
            .style('overflow-y', 'auto')

        var sitesRadio = tools
            .append('div')
            .attr('class', 'mmgisRadioBar2 sitesRadio')
            .style('width', '100%')

        if (this.sitesVar == null) {
            console.warn('Warning: SitesTool found no sites.')
        } else {
            for (var i = 0; i < this.sitesVar.length; i++) {
                var id = this.sitesVar[i].code.replace(/ /g, '_')
                var newestSiteButton = sitesRadio
                    .append('div')
                    .attr('id', id + '_tool_site')
                    .html(this.sitesVar[i].name)

                if (this.sitesVar[i].code == L_.site) {
                    newestSiteButton.attr('class', 'active')
                }

                $('#' + id + '_tool_site').on(
                    'click',
                    (function (sitesVar) {
                        return function () {
                            $(this).siblings().removeClass('active')
                            $(this).addClass('active')
                            //Update site
                            L_.setSite(
                                sitesVar.code,
                                SitesTool.getViewFromLatLngZoom(sitesVar)
                            )
                            L_.disableAllBut(sitesVar.code)
                            if (TC_.toolModules['LayersTool'])
                                TC_.toolModules['LayersTool'].setHeader(
                                    sitesVar.code
                                )
                        }
                    })(this.sitesVar[i])
                )
            }
        }
    },
    getViewFromLatLngZoom: function (siteVar) {
        return [
            parseFloat(
                siteVar.lat != null
                    ? siteVar.lat
                    : L_.configData.msv.view[0] || 0
            ),
            parseFloat(
                siteVar.lng != null
                    ? siteVar.lng
                    : L_.configData.msv.view[1] || 0
            ),
            parseFloat(
                siteVar.zoom != null
                    ? siteVar.zoom
                    : L_.configData.msv.view[2] || 0
            ),
        ]
    },
    setSite: function (newSiteCode, newView, dontSetGlobe, aggregate) {
        var siteView = newView
        if (siteView == null) {
            for (let s in this.sitesVar) {
                if (this.sitesVar[s].code == newSiteCode) {
                    siteView = SitesTool.getViewFromLatLngZoom(this.sitesVar[s])
                }
            }
        }
        var siteDiv = $('#' + newSiteCode + '_tool_site')
        siteDiv.siblings().removeClass('active')
        siteDiv.addClass('active')
        //Update site
        L_.setSite(newSiteCode, siteView, dontSetGlobe)
        L_.disableAllBut(newSiteCode, aggregate)
        //Update Layers to begin in site directory
        if (TC_.toolModules['LayersTool'])
            TC_.toolModules['LayersTool'].setHeader(newSiteCode)
    },
    destroy: function () {},
}

export default SitesTool
