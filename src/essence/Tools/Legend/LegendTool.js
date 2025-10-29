import $ from 'jquery'
import * as d3 from 'd3'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'

//Add the tool markup if you want to do it this way
var markup = [].join('\n')

var LegendTool = {
    height: 0,
    width: 200,
    activeLayerNames: null,
    MMWebGISInterface: null,
    targetId: null,
    made: false,
    displayOnStart: false,
    justification: 'left',
    initialize: function () {
        //Get tool variables
        this.displayOnStart = L_.getToolVars('legend')['displayOnStart']
        this.justification = L_.getToolVars('legend')['justification']
        this.showHeadersInLegend = L_.getToolVars('legend')['showHeadersInLegend']
        // Justification is now handled by ToolController_ during initialization
    },
    make: function (targetId) {
        this.targetId =
            typeof targetId === 'string'
                ? targetId
                : '__LegendTool_missing_targetId'
        this.MMWebGISInterface = new interfaceWithMMWebGIS()
        this.activeLayerNames = []

        L_.subscribeOnLayerToggle('LegendTool', () => {
            this.MMWebGISInterface = new interfaceWithMMWebGIS()
        })

        this.made = true
    },
    destroy: function () {
        this.MMWebGISInterface.separateFromMMWebGIS()
        this.targetId = null
        L_.unsubscribeOnLayerToggle('LegendTool')
        this.made = false
    },
    refreshLegends: refreshLegends,
    overwriteLegends: overwriteLegends,
}

//
function interfaceWithMMWebGIS() {
    this.separateFromMMWebGIS = function () {
        separateFromMMWebGIS()
    }
    separateFromMMWebGIS()

    LegendTool.tools = drawLegendHeader()

    //Add the markup to tools or do it manually
    //tools.html( markup );

    //Add event functions and whatnot
    //Draw legends
    LegendTool.refreshLegends()
    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMWebGIS() {
        let tools = d3.select(
            LegendTool.targetId ? `#${LegendTool.targetId}` : '#toolPanel'
        )
        tools.style('background', 'var(--color-k)')
        //Clear it
        tools.selectAll('*').remove()
    }
}

function refreshLegends() {
    $('#LegendTool').empty()

    function _refreshLegends(node, parent, depth) {
        let shift = LegendTool.showHeadersInLegend === true ? depth : 0
        for (let i in node) {
            let l = node[i].name
            if (L_.layers.on[l] == true) {
                if (L_.layers.data[l].type != 'header') {
                    if (L_.layers.data[l]?._legend === undefined
                            && ((['image', 'tile'].includes(L_.layers.data[l].type) && L_.layers.data[l].cogTransform)
                            || L_.layers.data[l].type === 'velocity')) {
                        const layersTool = ToolController_.getTool('LayersTool')
                        layersTool.populateCogScale(L_.layers.data[l].name)
                    }

                    // Check if there's a legend URL that points to an image
                    const legendURL = L_.layers.data[l]?.legend
                    if (legendURL && typeof legendURL === 'string') {
                        let isImageUrl = false

                        // First check for file extensions
                        const fileExtension = legendURL.toLowerCase().split('.').pop().split('?')[0] // Remove query params
                        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'tiff', 'tif', 'bmp', 'ico', 'avif']

                        if (imageExtensions.includes(fileExtension)) {
                            isImageUrl = true
                        } else if (['csv'].includes(fileExtension)) {
                            isImageUrl = false
                        } else {
                            // If no file extension and not a csv, check for image MIME types in URL parameters (e.g., WMS GetLegendGraphic)
                            try {
                                const url = new URL(legendURL)
                                const formatParam = url.searchParams.get('FORMAT') || url.searchParams.get('format')

                                if (formatParam) {
                                    const imageMimeTypes = [
                                        'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
                                        'image/svg+xml', 'image/webp', 'image/tiff',
                                        'image/bmp', 'image/ico', 'image/avif'
                                    ]

                                    const decodedFormat = decodeURIComponent(formatParam).toLowerCase()
                                    if (imageMimeTypes.includes(decodedFormat)) {
                                        isImageUrl = true
                                    }
                                }
                            } catch (e) {
                                // URL parsing failed, treat as non-image
                                console.warn('Failed to parse legend URL:', legendURL)
                            }
                        }

                        if (isImageUrl) {
                            // Handle image legend directly
                            drawLegends(
                                LegendTool.tools,
                                legendURL, // Pass the URL string directly
                                l,
                                L_.layers.data[l].display_name,
                                L_.layers.opacity[l],
                                shift
                            )
                            continue; // Skip the CSV processing below
                        }
                    }

                    if (L_.layers.data[l]?._legend != undefined) {
                        drawLegends(
                            LegendTool.tools,
                            L_.layers.data[l]?._legend,
                            l,
                            L_.layers.data[l].display_name,
                            L_.layers.opacity[l],
                            shift
                        )
                    }
                } else if (LegendTool.showHeadersInLegend === true) {
                        const haveLegends = L_.layers.data[l].sublayers
                            .map(i => i.name)
                            .filter(i => {
                                return ((L_.layers.data[i]._legend?.length > 0
                                    || (L_.layers.data[i]?._legend === undefined
                                        && ((['image', 'tile'].includes(L_.layers.data[i].type) && L_.layers.data[i].cogTransform)
                                        || L_.layers.data[i].type === 'velocity'))) && L_.layers.on[i])
                            })

                        if (haveLegends.length > 0) {
                            drawLegends(
                                LegendTool.tools,
                                L_.layers.data[l]?._legend,
                                l,
                                L_.layers.data[l].display_name,
                                L_.layers.opacity[l],
                                shift
                            )
                        }
                    }
            }

            if (node[i].sublayers)
                _refreshLegends(node[i].sublayers, node[i], depth + 1)
        }
    }

    _refreshLegends(L_.configData.layers, {}, 0)
}

// The legends parameter should be an array of objects, where each object must contain
// the following keys: legend, layerUUID, display_name, opacity.
// The value for the legend key should be in the same format as what is stored in the
// layers data under the `_legend` key (i.e. `L_.layers.data[layerName]._legend`).
// layerUUID and display_name should be strings and opacity should be a number between 0 and 1.
function overwriteLegends(legends) {
    if (!Array.isArray(legends)) {
        console.warn('legends parameter must be an array.', legends)
        return
    }

    if (legends.length < 1) {
        console.warn('legends array is empty.', legends)
        return
    }

    var tools = drawLegendHeader()

    for (let l in legends) {
        const { legend, layerUUID, display_name, opacity } = legends[l]
        if (!legend || !layerUUID || !display_name || !opacity) {
            console.warn('Unable to overwrite legends in LegendTool.', legends)
            return
        }
        drawLegends(tools, legend, layerUUID, display_name, opacity)
    }
}

function drawLegendHeader() {
    //MMWebGIS should always have a div with id 'tools'
    let tools = d3.select(
        LegendTool.targetId ? `#${LegendTool.targetId}` : '#toolPanel'
    )
    tools.style('background', 'var(--color-k)')
    //Clear it
    tools.selectAll('*').remove()
    
    // Add CSS to make tooltips appear faster
    if (!document.getElementById('legend-tooltip-styles')) {
        const style = document.createElement('style')
        style.id = 'legend-tooltip-styles'
        style.textContent = `
            [title] {
                transition-delay: 0s !important;
            }
            [title]:hover::after {
                content: attr(title);
                position: absolute;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
                margin-top: -25px;
                margin-left: 10px;
            }
        `
        document.head.appendChild(style)
    }
    tools
        .append('div')
        .style('height', '30px')
        .style('line-height', '30px')
        .style('font-size', '13px')
        .style(
            'padding-right',
            LegendTool.justification === 'right' ? '30px' : '8px'
        )
        .style(
            'padding-left',
            LegendTool.justification === 'right' ? '10px' : '30px'
        )
        .style('color', 'var(--color-l)')
        .style('background', 'var(--color-i)')
        .style('font-family', 'lato-light')
        .style('text-transform', 'uppercase')
        .style('border-top-left-radius', '3px')
        .style('border-top-right-radius', '3px')
        .style('border-bottom', '1px solid var(--color-i)')
        .html('Legend')
    //Add a semantic container
    tools = tools
        .append('div')
        .attr('id', 'LegendTool')
        .style('color', '#dcdcdc')
        .style('height', 'calc(100% - 40px)')
        .style('max-height', 'calc(100vh - 185px)')
        .style('border-bottom-left-radius', '3px')
        .style('border-bottom-right-radius', '3px')
        .style('overflow-y', 'auto')

    return tools
}

function drawLegends(tools, _legend, layerUUID, display_name, opacity, shift) {
    if (tools == null) return

    const layerConfig  = L_.layers.data[layerUUID]

    const isHeader = layerConfig.type === 'header'

    // Orientation of the legend, 'vertical' (default) or 'horizontal'
    const orientation = layerConfig.variables?.legendOrientation || 'vertical'

    // If option to hide layer name in legend is checked in the configuration
    const hideLegendLayerName = layerConfig.variables?.hideLegendLayerName || false

    var c = tools
        .append('div')
        .attr('class', 'mmgisScrollbar')
        .style('width', '100%')
        .style('display', 'inline-block')
        .style('padding-top', '5px')
        .style('padding-right', '12px')
        .style('padding-left', shift > 0 ? `${shift * 16}px` : '')
        .style('border-bottom', isHeader ? '' : '1px solid var(--color-i)')

    c.append('div')
        .attr('class', 'row')
        .append('p')
        .style('font-size', '13px')
        .style('color', 'var(--color-f)')
        .style('margin-bottom', isHeader ? '' : '5px')
        .style('padding-left', '8px')
        .style('font-weight', isHeader ? 'bold' : '')
        .text(hideLegendLayerName ? '' : display_name)

    if (isHeader) return

    let legendEntries = []
    let lastShape = ''

    // Check if _legend is an image URL (string)
    if (typeof _legend === 'string') {
        // Render image directly
        const imageContainer = c
            .append('div')
            .attr('class', 'legend-image-container')
            .style('display', 'flex')
            .style('justify-content', 'center')
            .style('margin', '4px')
            .style('padding', '4px')
            .style('overflow-x', 'hidden')
        imageContainer
            .append('img')
            .attr('src', _legend.startsWith('http') ? _legend : L_.missionPath + _legend)
            .attr('alt', `Legend for ${display_name}`)
            .style('max-width', '300px')
            .style('max-height', '220px')
            .style('height', 'auto')
            .style('background-color', 'white')
            .style('border', '1px solid var(--color-i)')
            .style('border-radius', '3px')
            .style('opacity', opacity)
            .on('load', function() {
                // Set container max-width to image width (capped at 300px)
                const maxImageWidth = Math.min(this.naturalWidth, 300)
                imageContainer
                    .style('max-width', maxImageWidth + 'px')
                    .style('width', 'fit-content')
            })
            .on('error', function() {
                // Handle image load error
                d3.select(this.parentNode)
                    .append('div')
                    .style('color', '#ff6b6b')
                    .style('padding', '8px')
                    .style('text-align', 'center')
                    .style('font-size', '12px')
                    .text('Failed to load legend.')
                d3.select(this).remove()
            })
        
        return // Exit early since we've rendered the image
    }

    for (let d in _legend) {
        // Skip legend entries that should be hidden from the legend
        if (_legend[d].hideFromLegend === true) {
            continue
        }

        var shape = _legend[d].shapeImage && _legend[d].shapeImage.trim()
            ? _legend[d].shapeImage : _legend[d].shapeIcon && _legend[d].shapeIcon.trim()
            ? _legend[d].shapeIcon : _legend[d].shape
        if (shape == 'continuous' || shape == 'discreet') {
            if (lastShape != shape) {
                if (legendEntries.length > 0) {
                    pushScale(legendEntries)
                    legendEntries = []
                }
            }
            legendEntries.push({
                color: _legend[d].color,
                shape: shape,
                value: _legend[d].value,
                propertyValue: _legend[d].propertyValue,
            })
            lastShape = shape
        } else {

            // finalize discreet and continuous
            if (legendEntries.length > 0) {
                pushScale(legendEntries)
                legendEntries = []
            }
            var r = c
                .append('div')
                .attr('class', 'row')
                .style('display', 'flex')
                .style('margin', orientation === 'horizontal' ? '0px 8px 8px 0px' : '0px 0px 8px 9px')
                .style('flex-direction', orientation === 'horizontal' ? 'row' : 'row')

            if (
                shape == 'circle' ||
                shape == 'square' ||
                shape == 'rect'
            ) {
                switch (shape) {
                    case 'circle':
                        r.append('div')
                            .attr('class', layerUUID + '_legendshape')
                            .style('width', '18px')
                            .style('height', '18px')
                            .style('background', _legend[d].color)
                            .style('opacity', opacity)
                            .style('border', `1px solid ${_legend[d].strokecolor}`)
                            .style('border-radius', '50%')
                            .style('position', 'relative')
                            .style('cursor', 'crosshair')
                            .attr('title', _legend[d].value)
                        break
                    case 'square':
                        r.append('div')
                            .attr('class', layerUUID + '_legendshape')
                            .style('width', '18px')
                            .style('height', '18px')
                            .style('background', _legend[d].color)
                            .style('opacity', opacity)
                            .style('border', `1px solid ${_legend[d].strokecolor}`)
                            .style('position', 'relative')
                            .style('cursor', 'crosshair')
                            .attr('title', _legend[d].value)
                        break
                    case 'rect':
                        r.append('div')
                            .attr('class', layerUUID + '_legendshape')
                            .style('width', '18px')
                            .style('height', '8px')
                            .style('margin', '5px 0px 5px 0px')
                            .style('background', _legend[d].color)
                            .style('opacity', opacity)
                            .style('border', `1px solid ${_legend[d].strokecolor}`)
                            .style('position', 'relative')
                            .style('cursor', 'crosshair')
                            .attr('title', _legend[d].value)
                        break
                    default:
                }
            } else if (String(shape).toLowerCase().match(/\.(jpeg|jpg|gif|png|svg|webp)$/) != null) {
                // Image markers   
                r.append('div')
                    .attr('class', layerUUID + '_legendcustom')
                    .style('width', '24px')
                    .style('height', '24px')
                    .style('background', _legend[d].color)
                    .style('opacity', opacity)
                    .style('border', `1px solid ${_legend[d].strokecolor}`)
                    .style('background-image', `url(${shape.startsWith("http") 
                        ? shape : L_.missionPath + shape})`)
                    .style('background-size', 'contain')
                    .style('background-repeat', 'no-repeat')
                    .style('position', 'relative')
                    .style('cursor', 'crosshair')
                    .attr('title', _legend[d].value)
            } else { // try using shape from Material Design Icon (mdi) library    
                const iconContainer = r.append('div')
                    .attr('class', layerUUID + '_legendicon')
                    .style('width', '18px')
                    .style('height', '18px')
                    .style('position', 'relative')
                    .style('cursor', 'crosshair')
                    .attr('title', _legend[d].value)
                
                iconContainer.append('i')
                    .attr('class', 'mdi mdi-18px mdi-' + shape)
                    .style('color', _legend[d].color)
                    .style('opacity', opacity)
                    .style('border', `1px solid ${_legend[d].strokecolor}`)
            }

            r.append('div')
            .style('margin-left', orientation === 'horizontal' ? '8px' : '5px')
            .style('height', '100%')
            .style('line-height', '19px')
            .style('font-size', '14px')
            .style('overflow', 'hidden')
            .style('white-space', 'nowrap')
            .style('max-width', orientation === 'horizontal' ? 'none' : '270px')
            .style('text-overflow', 'ellipsis')
            .attr('title', _legend[d].value)
            .text(_legend[d].value)
        }
    }
    if (legendEntries.length > 0) {
        pushScale(legendEntries)
        legendEntries = []
    }

    function pushScale(legendEntries) {
        var r = c
            .append('div')
            .attr('class', 'row')
            .style('display', 'flex')
            .style('flex-direction', 'column')
            .style('margin', orientation === 'horizontal' ? '8px 0px 8px 0px' : '0px 0px 8px 8px')
            .style('width', '100%') // Ensure full width
            .style('position', 'relative') // Add relative positioning for absolute positioned children

        // Container for gradient and labels
        var legendContainer = r
            .append('div')
            .style('display', 'flex')
            .style('flex-direction', orientation === 'horizontal' ? 'column' : 'row')
            .style('align-items', orientation === 'horizontal' ? 'flex-start' : 'center')
            .style('gap', orientation === 'horizontal' ? '4px' : '8px')
            .style('width', orientation === 'horizontal' ? '320px' : 'auto') // Set to 320px for horizontal legends
            .style('max-width', orientation === 'horizontal' ? '320px' : 'none') // Ensure it doesn't exceed 320px
            .style('padding-left', orientation === 'horizontal' ? '8px' : '0px') // Add left padding to align with vertical legends

        // Calculate gradient width based on container width and number of sections
        const gradientWidth = orientation === 'horizontal' ? '100%' : '19px'
        
        var gradient = legendContainer
            .append('div')
            .style('width', gradientWidth)
            .style('height', orientation === 'horizontal' ? '19px' : (19 * legendEntries.length + 'px'))
            .style('border', '1px solid black')
            .style('flex-shrink', '0')
            .style('position', 'relative')
            .style('cursor', 'crosshair')

        // For horizontal legends, ensure data is in ascending order (min to max)
        // Source data is typically in descending order, so we reverse it for horizontal display
        if (orientation === 'horizontal') {
            legendEntries = [...legendEntries].reverse()
        }

        // Start with all legend entries, reduce labels if needed for horizontal legends
        let visibleLabels = legendEntries

        // Calculate available width per label in horizontal mode
        const containerWidth = orientation === 'horizontal' ? 320 : 'auto'
        let labelWidth = orientation === 'horizontal' ? (containerWidth / visibleLabels.length) : 'auto'
        
        // For horizontal legends, check if we need to reduce labels based on actual text overflow
        if (orientation === 'horizontal') {
            const maxWidth = 320
            
            // Calculate if labels would overflow with current setup
            const maxLabelLength = Math.max(...visibleLabels.map(c => String(c.value).length))
            const estimatedCharWidth = 7
            const estimatedLabelWidth = maxLabelLength * estimatedCharWidth
            const minViableWidth = estimatedLabelWidth * 0.6
            
            // Only reduce labels if the estimated width per label is too small
            if (labelWidth < minViableWidth && visibleLabels.length > 2) {
                const maxLabels = Math.floor(maxWidth / minViableWidth)
                
                if (visibleLabels.length > maxLabels) {
                    // Always keep first and last labels
                    const keepIndices = new Set([0, visibleLabels.length - 1])
                    
                    // Calculate how many intermediate labels we can show
                    const intermediateSlots = Math.max(0, maxLabels - 2)
                    
                    if (intermediateSlots > 0) {
                        // Distribute intermediate labels evenly
                        const step = (visibleLabels.length - 1) / (intermediateSlots + 1)
                        for (let i = 1; i <= intermediateSlots; i++) {
                            const index = Math.round(i * step)
                            if (index > 0 && index < visibleLabels.length - 1) {
                                keepIndices.add(index)
                            }
                        }
                    }
                    
                    // Create new array with only the selected labels
                    visibleLabels = legendEntries.filter((_, index) => keepIndices.has(index))
                    // Recalculate label width with reduced labels
                    labelWidth = containerWidth / visibleLabels.length
                }
            }
        }
        
        const calculateFontSize = () => {
            if (orientation === 'horizontal') {
                const maxLabelLength = Math.max(...visibleLabels.map(c => String(c.value).length))
                const baseSize = 14
                const minSize = 9
                const maxSize = 14
                const averageCharWidth = 7
                const availableWidth = labelWidth * 0.95 // Use more of the available space
                const calculatedSize = (availableWidth / (maxLabelLength * averageCharWidth)) * baseSize
                return Math.min(maxSize, Math.max(minSize, calculatedSize))
            }
            return 14
        }

        const fontSize = calculateFontSize()

        var values = legendContainer
            .append('div')
            .style('display', (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? 'block' : 'flex')
            .style('flex-direction', orientation === 'horizontal' ? 'row' : 'column')
            .style('justify-content', 'flex-start') // Left justify
            .style('width', orientation === 'horizontal' ? '100%' : 'auto')
            .style('height', orientation === 'horizontal' ? 'auto' : (19 * visibleLabels.length + 'px'))
            .style('gap', orientation === 'horizontal' ? '0' : '0')
            .style('position', 'relative')
            .style('padding-left', (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? '8px' : '0px')
            .style('padding-right', (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? '8px' : '0px')
            .style('padding-bottom', (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? '12px' : '0px')

        // Create gradient using all legend entries for accurate color representation
        var gradientArray = []
        for (let i = 0; i < legendEntries.length; i++) {
            if (legendEntries[i].shape == 'continuous') {
                let color = legendEntries[i].color
                if (i === 0)
                    color += ' ' + (1 / legendEntries.length) * 50 + '%'
                else if (i === legendEntries.length - 1)
                    color += ' ' + (100 - (1 / legendEntries.length) * 50) + '%'
                gradientArray.push(color)
            } else {
                gradientArray.push(
                    legendEntries[i].color +
                        ' ' +
                        (i / legendEntries.length) * 100 +
                        '%'
                )
                gradientArray.push(
                    legendEntries[i].color +
                        ' ' +
                        ((i + 1) / legendEntries.length) * 100 +
                        '%'
                )
            }
        }

        // Helper function to detect and extract units from legend values
        const extractUnits = (values) => {
            if (!values || values.length === 0) return { number: '', units: '' }
            
            const firstValue = String(values[0]).trim()
            
            // Find where non-numeric characters start
            const match = firstValue.match(/^([0-9.,\-\s]+)(.*)$/)
            if (match) {
                const number = match[1].trim()
                const units = match[2].trim()
                
                // Verify this pattern works for all values
                const allValuesMatch = values.every(v => {
                    const str = String(v).trim()
                    const valMatch = str.match(/^([0-9.,\-\s]+)(.*)$/)
                    return valMatch && valMatch[2].trim() === units
                })
                
                if (allValuesMatch) {
                    return { number, units }
                }
            }
            
            // No common units found
            return { number: firstValue, units: '' }
        }

        // Add tick marks only for continuous legends
        if (legendEntries.length > 0 && legendEntries[0].shape === 'continuous') {
            for (let i = 0; i < visibleLabels.length; i++) {
                // Calculate position for this tick mark
                // For continuous legends, find the index in legendEntries
                const originalIndex = legendEntries.findIndex(item => 
                    item.value === visibleLabels[i].value && item.color === visibleLabels[i].color)
                let tickPosition
                if (originalIndex !== -1) {
                    tickPosition = originalIndex / (legendEntries.length - 1)
                } else {
                    tickPosition = i / (visibleLabels.length - 1)
                }

                // Create tick mark
                const tickMark = gradient
                    .append('div')
                    .style('position', 'absolute')
                    .style('background', 'white')
                    .style('mix-blend-mode', 'difference')
                    .style('pointer-events', 'none')
                    .style('z-index', '10')

                if (orientation === 'horizontal') {
                    // Horizontal tick marks
                    tickMark
                        .style('width', '1px')
                        .style('height', '3px')
                        .style('left', `${tickPosition * 100}%`)
                        .style('top', '0px')
                        .style('transform', 'translateX(-50%)')
                    
                    // Add a bottom tick mark for better visibility
                    gradient
                        .append('div')
                        .style('position', 'absolute')
                        .style('width', '1px')
                        .style('height', '3px')
                        .style('background', 'white')
                        .style('mix-blend-mode', 'difference')
                        .style('pointer-events', 'none')
                        .style('z-index', '10')
                        .style('left', `${tickPosition * 100}%`)
                        .style('bottom', '0px')
                        .style('transform', 'translateX(-50%)')
                } else {
                    // Vertical tick marks
                    tickMark
                        .style('width', '3px')
                        .style('height', '1px')
                        .style('top', `${tickPosition * 100}%`)
                        .style('left', '0px')
                        .style('transform', 'translateY(-50%)')
                    
                    // Add a right tick mark for better visibility
                    gradient
                        .append('div')
                        .style('position', 'absolute')
                        .style('width', '3px')
                        .style('height', '1px')
                        .style('background', 'white')
                        .style('mix-blend-mode', 'difference')
                        .style('pointer-events', 'none')
                        .style('z-index', '10')
                        .style('top', `${tickPosition * 100}%`)
                        .style('right', '0px')
                        .style('transform', 'translateY(-50%)')
                }
            }
            
            // Add units label above the last tick mark for horizontal continuous legends
            if (orientation === 'horizontal') {
                // Extract units from all visible labels
                const values = visibleLabels.map(item => item.value)
                const { units } = extractUnits(values)
                
                if (units) {
                    // Calculate position of last tick mark
                    const lastIndex = visibleLabels.length - 1
                    const lastOriginalIndex = legendEntries.findIndex(item => 
                        item.value === visibleLabels[lastIndex].value && item.color === visibleLabels[lastIndex].color)
                    const lastTickPosition = lastOriginalIndex !== -1 ? 
                        lastOriginalIndex / (legendEntries.length - 1) : 
                        lastIndex / (visibleLabels.length - 1)
                    
                    // Add units label above the last tick mark
                    gradient
                        .append('div')
                        .style('position', 'absolute')
                        .style('right', '0px')
                        .style('top', '-20px')
                        .style('font-size', '12px')
                        .style('color', 'var(--color-f)')
                        .style('text-align', 'right')
                        .style('white-space', 'nowrap')
                        .style('z-index', '100')
                        .style('background', 'var(--color-k)')
                        .style('padding', '2px 4px')
                        .style('border-radius', '2px')
                        .text(units)
                }
            }
        }
        
        // Add units label for non-continuous horizontal legends
        if (orientation === 'horizontal' && (legendEntries.length === 0 || legendEntries[0].shape !== 'continuous')) {
            // Extract units from all visible labels
            const values = visibleLabels.map(item => item.value)
            const { units } = extractUnits(values)

            if (units) {
                const unitsLabel = r
                    .append('div')
                    .style('position', 'absolute')
                    .style('top', '-20px')
                    .style('right', '8px')
                    .style('font-size', '12px')
                    .style('color', 'var(--color-f)')
                    .style('text-align', 'right')
                    .style('white-space', 'nowrap')
                    .style('z-index', '100')
                    .style('background', 'var(--color-k)')
                    .style('padding', '2px 4px')
                    .style('border-radius', '2px')
                    .text(units)
            }
        }

        // Create labels using only the visible subset
        for (let i = 0; i < visibleLabels.length; i++) {
            // Determine if this is first or last label
            const isFirstOrLast = i === 0 || i === visibleLabels.length - 1
            
            // Extract number and units from the value
            const str = String(visibleLabels[i].value).trim()
            
            // Find where non-numeric characters start
            const match = str.match(/^([0-9.,\-\s]+)(.*)$/)
            let number, units
            if (match) {
                number = match[1].trim()
                units = match[2].trim()
            } else {
                // Fallback: no units found
                number = str
                units = ''
            }
            
            // For horizontal legends, show only numbers (units are displayed separately above)
            let displayText
            if (orientation === 'horizontal') {
                displayText = number
            } else {
                // For vertical legends, show numbers only except for the first and last labels which keep units
                if (i === 0 || i === visibleLabels.length - 1) {
                    displayText = visibleLabels[i].value // Keep full value with units for first and last labels
                } else {
                    displayText = number // Show only number for intermediate labels
                }
            }

            // Calculate the same position as the tick marks
            let labelPosition
            if (visibleLabels[i].shape === 'continuous') {
                // For continuous legends, find the index in legendEntries
                const originalIndex = legendEntries.findIndex(item => 
                    item.value === visibleLabels[i].value && item.color === visibleLabels[i].color)
                if (originalIndex !== -1) {
                    labelPosition = originalIndex / (legendEntries.length - 1)
                } else {
                    labelPosition = i / (visibleLabels.length - 1)
                }
            } else {
                labelPosition = i / (visibleLabels.length - 1)
            }

            let v = values
                .append('div')
                .style('margin', '0')
                .style('padding', '0')
                .style('height', '19px')
                .style('line-height', '19px')
                .style('font-size', `${fontSize}px`)
                .style('white-space', 'nowrap')
                .style('overflow', 'hidden')
                .style('text-overflow', 'ellipsis')
                .attr('title', visibleLabels[i].value) // Keep full value in tooltip
                .text(displayText)

            if (orientation === 'horizontal' && visibleLabels[i].shape === 'continuous') {
                // Position labels to align exactly with tick marks for continuous legends only
                // Adjust positioning to prevent leftmost labels from extending outside container
                let adjustedPosition = labelPosition
                let transform = 'translateX(-50%)'
                
                // For first label, shift it right to prevent left overflow
                if (i === 0 && labelPosition < 0.1) {
                    transform = 'translateX(0%)'
                }
                // Keep last label center-justified (no special transform)
                
                v.style('position', 'absolute')
                 .style('left', `${adjustedPosition * 100}%`)
                 .style('transform', transform)
                 .style('text-align', 'center')
                 .style('width', 'auto')
                 .style('max-width', '80px') // Prevent overlap
            } else if (orientation === 'horizontal') {
                // For non-continuous horizontal legends, use original layout
                v.style('position', 'relative')
                 .style('text-align', visibleLabels[i].shape === 'continuous' ? 
                     (i === 0 ? 'left' : i === visibleLabels.length - 1 ? 'right' : 'center') : 
                     'center')
                 .style('width', `${100/visibleLabels.length}%`)
            } else {
                // For vertical legends, keep original positioning
                v.style('position', 'relative')
                 .style('text-align', 'left')
                 .style('width', 'auto')
            }
        }

        gradient.style(
            'background',
            orientation === 'horizontal'
                ? 'linear-gradient(to right, ' + gradientArray.join(',') + ')'
                : 'linear-gradient(to bottom, ' + gradientArray.join(',') + ')'
        )

        // Add hover functionality for gradient legends
        const tooltip = gradient
            .append('div')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '4px 8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('visibility', 'hidden')
            .style('white-space', 'nowrap')

        gradient
            .on('mousemove', function(event) {
                const rect = this.getBoundingClientRect()
                let position, value
                
                if (orientation === 'horizontal') {
                    const x = event.clientX - rect.left
                    position = x / rect.width
                } else {
                    const y = event.clientY - rect.top
                    position = y / rect.height // Top = min (index 0), bottom = max (index max)
                }
                
                // Clamp position between 0 and 1
                position = Math.max(0, Math.min(1, position))
                
                // Calculate the value based on position
                if (legendEntries[0].shape === 'continuous') {
                    // For continuous legends, interpolate between values
                    const index = position * (legendEntries.length - 1)
                    const lowerIndex = Math.floor(index)
                    const upperIndex = Math.ceil(index)
                    const fraction = index - lowerIndex
                    
                    if (lowerIndex === upperIndex) {
                        // Prioritize propertyValue, if it exists, over value
                        value = legendEntries[lowerIndex].propertyValue || legendEntries[lowerIndex].value
                    } else {
                        // Interpolate between continuous values
                        const lowerValue = parseFloat(legendEntries[lowerIndex].propertyValue || legendEntries[lowerIndex].value) || 0
                        const upperValue = parseFloat(legendEntries[upperIndex].propertyValue || legendEntries[upperIndex].value) || 0
                        const interpolatedValue = lowerValue + (upperValue - lowerValue) * fraction
                        value = interpolatedValue.toFixed(3).replace(/\.?0+$/, '') // Remove trailing zeros
                    }
                } else {
                    // For discrete legends, map position to discrete bands
                    const bandIndex = Math.floor(position * legendEntries.length)
                    const clampedIndex = Math.min(bandIndex, legendEntries.length - 1)
                    value = legendEntries[clampedIndex].propertyValue || legendEntries[clampedIndex].value
                }
                
                tooltip
                    .style('visibility', 'visible')
                    .style('left', (event.clientX - rect.left - 15) + 'px')
                    .style('top', (event.clientY - rect.top - 30) + 'px')
                    .text(value)
            })
            .on('mouseleave', function() {
                tooltip.style('visibility', 'hidden')
            })
    }
}

//Other functions

export default LegendTool
