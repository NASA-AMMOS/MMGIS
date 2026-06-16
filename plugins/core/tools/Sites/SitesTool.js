import $ from 'jquery'
import F_ from '../../../../src/essence/Basics/Formulae_/Formulae_'
import L_ from '../../../../src/essence/Basics/Layers_/Layers_'
import TC_ from '../../../../src/essence/Basics/ToolController_/ToolController_'
import Globe_ from '../../../../src/essence/Basics/Globe_/Globe_'
import Help from '../../../../src/essence/Basics/UserInterface_/components/Help/Help'

const helpKey = 'SitesTool'

var SitesTool = {
    height: 0,
    width: 140,
    vars: null,
    sitesVar: null,
    initialize: function () {
        this.vars = L_.getToolVars('sites')
        this.sitesVar = this.vars.sites

        if (L_.UserInterface_.isMobile === true) {
            this.width = 'full'
            this.height = 500
        }

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
        const divID = L_.UserInterface_.isMobile === true ?  '#tools' : '#toolPanel'

        const toolsContainer = $(divID)
        toolsContainer.css({
            'background': 'var(--color-k)',
            'box-shadow': 'inset 2px 0px 10px 0px rgba(0,0,0,0.2)'
        })

        toolsContainer.empty()

        const headerDiv = $('<div>')
            .addClass('mmgisToolHeader')
            .html(
                '<div><div>' +
                    '<div class="mmgisToolTitle">Sites</div>' +
                    Help.getComponent(helpKey) +
                '</div></div>'
            )
        toolsContainer.append(headerDiv)

        Help.finalize(helpKey)

        const tools = $('<div>')
            .attr('id', 'SitesTool')
            .attr('class', 'mmgisScrollbar')
            .css({
                'color': '#cfcfcf',
                'height': '100%',
                'overflow-y': 'auto'
            })
        toolsContainer.append(tools)

        const sitesRadio = $('<div>')
            .attr('class', 'mmgisRadioBar2 sitesRadio')
            .css('width', '100%')
        tools.append(sitesRadio)

        if (this.sitesVar == null) {
            console.warn('Warning: SitesTool found no sites.')
        } else {
            for (var i = 0; i < this.sitesVar.length; i++) {
                var id = this.sitesVar[i].code.replace(/ /g, '_')
                var newestSiteButton = $('<div>')
                    .attr('id', id + '_tool_site')
                    .html(this.sitesVar[i].name)
                sitesRadio.append(newestSiteButton)

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
