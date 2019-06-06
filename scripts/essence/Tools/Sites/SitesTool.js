define([
    'Layers_',
    'jquery',
    'd3',
    'Formulae_',
    'Globe_',
    'LayersTool',
    'Description',
], function(L_, $, d3, F_, Globe_, LayersTool, Description) {
    var SitesTool = {
        height: 48,
        vars: null,
        sitesVar: null,
        init: function() {
            this.vars = L_.getToolVars('sites')
            this.sitesVar = this.vars.sites

            //Use url site or first site in list
            if (L_.FUTURES.site != null) {
                SitesTool.setSite(L_.FUTURES.site, L_.FUTURES.mapView, true)
                L_.FUTURES.site = null
            } else {
                if (this.sitesVar != null)
                    SitesTool.setSite(this.sitesVar[0].code, L_.FUTURES.mapView)
            }

            Description.descSite.on('click', function() {
                SitesTool.setSite(L_.site, L_.view)
            })
        },
        make: function() {
            var tools = d3.select('#tools')
            tools.selectAll('*').remove()
            tools = tools
                .append('div')
                .attr('class', 'center aligned middle aligned ui padded grid')
                .style('overflow', 'hidden')
                .style('height', '100%')
            var mainDiv = tools
                .append('div')
                .attr('id', 'sitesTool')
                .attr('class', 'sixteen wide column')
            var sitesRadio = mainDiv
                .append('div')
                .attr('class', 'mmgisRadioBar sitesRadio')

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
                        (function(sitesVar) {
                            return function() {
                                $(this)
                                    .siblings()
                                    .removeClass('active')
                                $(this).addClass('active')
                                //Update site
                                Description.updateSite(sitesVar.code)
                                L_.setSite(sitesVar.code, sitesVar.view)
                                L_.disableAllBut(sitesVar.code)
                                LayersTool.setHeader(sitesVar.code)
                            }
                        })(this.sitesVar[i])
                    )
                }
            }
        },
        setSite: function(newSiteCode, newView, dontSetGlobe) {
            var siteView = newView
            if (siteView == null) {
                for (s in this.sitesVar) {
                    if (this.sitesVar[s].code == newSiteCode) {
                        siteView = this.sitesVar[s].view
                    }
                }
            }
            var siteDiv = $('#' + newSiteCode + '_tool_site')
            siteDiv.siblings().removeClass('active')
            siteDiv.addClass('active')
            //Update site
            Description.updateSite(newSiteCode)
            L_.setSite(newSiteCode, siteView, dontSetGlobe)
            L_.disableAllBut(newSiteCode)
            //Update Layers to begin in site directory
            LayersTool.setHeader(newSiteCode)
        },
        destroy: function() {},
    }

    SitesTool.init()

    return SitesTool
})
