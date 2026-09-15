// Attributions collects visible layer attributions for the About modal
// and, when look.showAttributionsOnMap is set, renders them on the map
import $ from 'jquery'
import L from 'leaflet'
import L_ from '../../../Layers_/Layers_'
import { refreshThemeDOM } from '../../../../../design-system/themeApplier'

import './Attributions.css'

var Attributions = {
    visibleAttributions: [],
    expanded: false,
    init: function () {
        Attributions.expanded = false
        Attributions.update()
    },
    refresh: function () {
        Attributions.update()
    },
    remove: function () {
        $('#mmgis-attributions').remove()
        $(document).off('click.mmgisAttributions')
        Attributions.expanded = false
    },
    update: function () {
        // Collect attributions from all visible layers
        const attributions = []
        const seen = new Set()

        if (L_.layers && L_.layers.data) {
            Object.keys(L_.layers.data).forEach((layerName) => {
                const layer = L_.layers.data[layerName]

                if (
                    L_.layers.on[layerName] === true &&
                    layer.attribution != null
                ) {
                    const key = `${layer.attribution}|${
                        layer.attributionLink || ''
                    }`
                    if (!seen.has(key)) {
                        seen.add(key)
                        attributions.push({
                            text: layer.attribution,
                            link: layer.attributionLink || null,
                        })
                    }
                }
            })
        }

        Attributions.visibleAttributions = attributions
        Attributions.render()
    },
    isEnabled: function () {
        return (
            L_.configData &&
            L_.configData.look &&
            L_.configData.look.showAttributionsOnMap === true
        )
    },
    render: function () {
        const attributions = Attributions.visibleAttributions
        if (!Attributions.isEnabled() || attributions.length === 0) {
            Attributions.remove()
            return
        }

        let container = $('#mmgis-attributions')
        if (container.length === 0) {
            container = $('<div>')
                .attr('id', 'mmgis-attributions')
                .append(
                    $('<div>')
                        .attr('id', 'mmgis-attributions-summary')
                        .attr('role', 'button')
                        .attr('tabindex', '0')
                        .attr('aria-haspopup', 'true')
                        .attr('title', 'Map layer attributions')
                )
                .append(
                    $('<div>')
                        .attr('id', 'mmgis-attributions-panel')
                        .append(
                            $('<div>')
                                .attr('id', 'mmgis-attributions-label')
                                .text('Attributions')
                        )
                        .append($('<ul>').attr('id', 'mmgis-attributions-list'))
                )
            $('#map').append(container)

            // Behave like a Leaflet control: keep clicks/wheel off the map
            L.DomEvent.disableClickPropagation(container[0])
            L.DomEvent.disableScrollPropagation(container[0])
            container.on('click', (e) => {
                e.stopPropagation()
            })
            container.find('#mmgis-attributions-summary').on(
                'click keydown',
                (e) => {
                    if (
                        e.type === 'keydown' &&
                        e.key !== 'Enter' &&
                        e.key !== ' '
                    )
                        return
                    e.preventDefault()
                    Attributions.setExpanded(!Attributions.expanded)
                }
            )
            $(document).off('click.mmgisAttributions')
            $(document).on('click.mmgisAttributions', () => {
                Attributions.setExpanded(false)
            })
        }

        const summary = container.find('#mmgis-attributions-summary')
        summary.empty()
        summary.append(
            $('<span>')
                .addClass('mmgis-attributions-first')
                .text(attributions[0].text)
        )
        if (attributions.length > 1) {
            summary.append(
                $('<span>')
                    .addClass('mmgis-attributions-more')
                    .text(`+${attributions.length - 1} more`)
            )
        }
        summary.append(
            $('<i>').addClass('mdi mdi-chevron-down mmgis-attributions-chevron')
        )

        const list = container.find('#mmgis-attributions-list')
        list.empty()
        attributions.forEach((attr) => {
            const li = $('<li>')
            if (attr.link && attr.link.length > 0) {
                li.append(
                    $('<a>')
                        .attr('href', attr.link)
                        .attr('target', '_blank')
                        .attr('rel', 'noopener noreferrer')
                        .text(attr.text)
                )
            } else {
                li.append($('<span>').text(attr.text))
            }
            list.append(li)
        })

        Attributions.setExpanded(Attributions.expanded)
        refreshThemeDOM()
    },
    setExpanded: function (expanded) {
        Attributions.expanded = expanded === true
        const container = $('#mmgis-attributions')
        container.toggleClass('expanded', Attributions.expanded)
        container
            .find('#mmgis-attributions-summary')
            .attr('aria-expanded', Attributions.expanded ? 'true' : 'false')
    },
}

export default Attributions
