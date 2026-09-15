import $ from 'jquery'
import L_ from '@basics/Layers_/Layers_'
import Modal from '@basics/UserInterface_/components/Modal/Modal'
import marked from '@essence/services/Markdown'
import { safeHTML, safeLinkUrl } from '@essence/services/Sanitize'
import F_ from '@basics/Formulae_/Formulae_'

import './LayerInfoModal.css'

const LayerInfo = {
    converter: marked,
    open: function (layerName) {
        const layer = L_.layers.data[layerName]

        if (layer == null) return

        let numberOfFeatures = ''
        if (layer.type === 'vector')
            try {
                numberOfFeatures = ` (${
                    L_.layers.layer[layerName].getLayers().length
                } Features)`
            } catch (e) {}

        let type = layer.type
        if (type === 'tile') type = 'raster'

        let attribution = ''
        if (layer.attribution != null && layer.attribution !== '') {
            const text = F_.escapeHtml(layer.attribution)
            const link = safeLinkUrl(layer.attributionLink)
            attribution = link
                ? `<a href='${F_.escapeHtml(link)}' target='_blank' rel='noopener noreferrer'>${text}</a>`
                : text
        }

        // prettier-ignore
        Modal.set(
            [
                `<div id='LayerInfoModal'>`,
                    `<div id='LayerInfoModalTitle' style='background: var(--color-${layer.type});'>`,
                        `<div><i class='mdi mdi-information-outline mdi-18px'></i><div>Information</div></div>`,
                        `<div id='LayerInfoModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                    `</div>`,
                    `<div id='LayerInfoModalContent'>`,
                        `<div id='LayerInfoModalInnerTitle'>${F_.escapeHtml(layer.display_name || '')}</div>`,
                        `<div id='LayerInfoModalInnerSubtitle'>${type}<span>${numberOfFeatures}</span></div>`,

                            layer.tags && layer.tags.length > 0 ? 
                                [
                                    `<div id='LayerInfoModalTags'>`,
                                        `<div id='LayerInfoModalTagsContent'>`,
                                            layer.tags.map((tag) => {
                                                if( typeof tag === 'string' && tag.length > 0) {
                                                    let catname, tagname
                                                    if( tag.indexOf(':') > -1)
                                                        [catname, ...tagname] = tag.split(":");
                                                    else tagname = tag

                                                    return [
                                                        `<div class='LayerInfoModalTag'>`,
                                                            catname != null ? `<div class='LayerInfoModalTagCat'>${catname}</div>` : '',
                                                            `<div class='LayerInfoModalTagName'>${tagname}</div>`,
                                                        `</div>`
                                                    ].join('\n')
                                                }
                                            }).join('\n'),
                                        `</div>`,
                                    `</div>`
                                ].join('\n') : '',
                        
                        `<div id='LayerInfoModalDescription'>`,
                            `<div id='LayerInfoModalDescriptionContent'>`,
                                layer.description ? safeHTML(LayerInfo.converter.parse(layer.description)) : `<div class='LayerInfoModalNone'>No Description</div>`,
                            `</div>`,
                        `</div>`,
                        `<div id='LayerInfoModalFooter'>`,
                            `<div id='LayerInfoModalAttribution'>${attribution ? `(c) ${attribution}` : ''}</div>`,
                            `<div id='LayerInfoModalInnerUUID'>${layer.uuid}</div>`,
                        `</div>`,
                    `</div>`,
                `</div>`
            ].join('\n'),
            function () {
                $('#LayerInfoModalClose').on('click', function () {
                    Modal.remove()
                })
            }       
        )
    },
}

export default LayerInfo
