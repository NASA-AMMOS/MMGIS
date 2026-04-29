import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import ToolController_ from '../../Basics/ToolController_/ToolController_'
import Help from '../../Basics/UserInterface_/components/Help/Help'

const helpKey = 'LegendTool'

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
        if (L_.UserInterface_.isMobile === true) {
            const mapRect = document.getElementById('map').getBoundingClientRect()
            this.width = 'full'
            this.height = Math.round(mapRect.height * 0.25)
        }

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

        let _event = new CustomEvent('madeLegendTool', {
            detail: {
                made: true,
            },
        })
        document.dispatchEvent(_event)
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
        const tools = $(
            LegendTool.targetId ? `#${LegendTool.targetId}` : '#toolPanel'
        )
        tools.css('background', 'var(--color-k)')
        //Clear it
        tools.empty()

        if (L_.UserInterface_.isMobile === true) {
            const mobileTools = $('#tools')
            //Clear it
            mobileTools.empty()
        }
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
    let divID = '#toolPanel'

    if (L_.UserInterface_.isMobile === true) {
        divID = '#tools'
    } else if (LegendTool.targetId) {
        divID = `#${LegendTool.targetId}`
    }

    const tools = $(divID)
    tools.css('background', 'var(--color-k)')
    //Clear it
    tools.empty()
    
    const legendHeader = $('<div>').attr('class', 'mmgisToolHeader')
        .css({
            'border-top-left-radius': '3px',
            'border-top-right-radius': '3px',
        })
        .html([
            "<div>",
                "<div>",
                    "<div class='mmgisToolTitle'>Legend</div>",
                    Help.getComponent(helpKey),
                "</div>",
            "</div>",
        ].join(''))
    tools.append(legendHeader)
    Help.finalize(helpKey)

    //Add a semantic container
    const legendContainer = $('<div>')
        .attr('id', 'LegendTool')
        .css({
            'color': '#dcdcdc',
            'height': 'calc(100% - 40px)',
            'max-height': 'calc(100vh - 185px)',
            'border-bottom-left-radius': '3px',
            'border-bottom-right-radius': '3px',
            'overflow-y': 'auto'
        })
    tools.append(legendContainer)

    return legendContainer
}

function drawLegends(tools, _legend, layerUUID, display_name, opacity, shift) {
    if (tools == null) return

    const layerConfig  = L_.layers.data[layerUUID]

    const isHeader = layerConfig.type === 'header'

    // Orientation of the legend, 'vertical' (default) or 'horizontal'
    const orientation = layerConfig.variables?.legendOrientation || 'vertical'

    // If option to hide layer name in legend is checked in the configuration
    const hideLegendLayerName = layerConfig.variables?.hideLegendLayerName || false

    var c = $('<div>')
        .attr('class', 'mmgisScrollbar')
        .css({
            'width': '100%',
            'display': 'inline-block',
            'padding-top': '5px',
            'padding-right': '12px',
            'padding-left': shift > 0 ? `${shift * 16}px` : '',
            'border-bottom': isHeader ? '' : '1px solid var(--color-i)'
        })
    tools.append(c)

    const rowDiv = $('<div>').attr('class', 'row')
    const legendTitle = $('<p>')
        .css({
            'font-size': '13px',
            'color': 'var(--color-f)',
            'margin-bottom': isHeader ? '' : '5px',
            'padding-left': '8px',
            'font-weight': isHeader ? 'bold' : ''
        })
        .text(hideLegendLayerName ? '' : display_name)
    rowDiv.append(legendTitle)
    c.append(rowDiv)

    if (isHeader) return

    let legendEntries = []
    let lastShape = ''

    // Check if _legend is an image URL (string)
    if (typeof _legend === 'string') {
        // Render image directly
        const imageContainer = $('<div>')
            .attr('class', 'legend-image-container')
            .css({
                'display': 'flex',
                'justify-content': 'center',
                'margin': '4px',
                'padding': '4px',
                'overflow-x': 'hidden'
            })
        c.append(imageContainer)

        const legendImage = $('<img>')
            .attr('src', _legend.startsWith('http') ? _legend : L_.missionPath + _legend)
            .attr('alt', `Legend for ${display_name}`)
            .css({
                'max-width': '300px',
                'max-height': '220px',
                'height': 'auto',
                'background-color': 'white',
                'border': '1px solid var(--color-i)',
                'border-radius': '3px',
                'opacity': opacity
            })
            .on('load', function() {
                // Set container max-width to image width (capped at 300px)
                const maxImageWidth = Math.min(this.naturalWidth, 300)
                imageContainer
                    .css('max-width', maxImageWidth + 'px')
                    .css('width', 'fit-content')
            })
        imageContainer.append(legendImage)
            .on('error', function() {
                // Handle image load error
                const errorDiv = $('<div>')
                    .css({
                        'color': '#ff6b6b',
                        'padding': '8px',
                        'text-align': 'center',
                        'font-size': '12px'
                    })
                    .text('Failed to load legend.')
                $(this.parentNode).append(errorDiv)
                $(this).remove()
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
            var r = $('<div>')
                .attr('class', 'row')
                .css({
                    'display': 'flex',
                    'margin': orientation === 'horizontal' ? '0px 8px 8px 0px' : '0px 0px 8px 9px',
                    'flex-direction': orientation === 'horizontal' ? 'row' : 'row'
                })
            c.append(r)

            if (
                shape == 'circle' ||
                shape == 'square' ||
                shape == 'rect'
            ) {
                switch (shape) {
                    case 'circle':
                        const circleShape = $('<div>')
                            .attr('class', layerUUID + '_legendshape')
                            .css({
                                'width': '18px',
                                'height': '18px',
                                'background': _legend[d].color,
                                'opacity': opacity,
                                'border': `1px solid ${_legend[d].strokecolor}`,
                                'border-radius': '50%',
                                'position': 'relative',
                                'cursor': 'crosshair'
                            })
                            .attr('title', _legend[d].value)
                        r.append(circleShape)
                        break
                    case 'square':
                        const squareShape = $('<div>')
                            .attr('class', layerUUID + '_legendshape')
                            .css({
                                'width': '18px',
                                'height': '18px',
                                'background': _legend[d].color,
                                'opacity': opacity,
                                'border': `1px solid ${_legend[d].strokecolor}`,
                                'position': 'relative',
                                'cursor': 'crosshair'
                            })
                            .attr('title', _legend[d].value)
                        r.append(squareShape)
                        break
                    case 'rect':
                        const rectShape = $('<div>')
                            .attr('class', layerUUID + '_legendshape')
                            .css({
                                'width': '18px',
                                'height': '8px',
                                'margin': '5px 0px 5px 0px',
                                'background': _legend[d].color,
                                'opacity': opacity,
                                'border': `1px solid ${_legend[d].strokecolor}`,
                                'position': 'relative',
                                'cursor': 'crosshair'
                            })
                            .attr('title', _legend[d].value)
                        r.append(rectShape)
                        break
                    default:
                }
            } else if (String(shape).toLowerCase().match(/\.(jpeg|jpg|gif|png|svg|webp)$/) != null) {
                // Image markers
                const imageMarker = $('<div>')
                    .attr('class', layerUUID + '_legendcustom')
                    .css({
                        'width': '24px',
                        'height': '24px',
                        'background': _legend[d].color,
                        'opacity': opacity,
                        'border': `1px solid ${_legend[d].strokecolor}`,
                        'background-image': `url(${shape.startsWith("http")
                            ? shape : L_.missionPath + shape})`,
                        'background-size': 'contain',
                        'background-repeat': 'no-repeat',
                        'position': 'relative',
                        'cursor': 'crosshair'
                    })
                    .attr('title', _legend[d].value)
                r.append(imageMarker)
            } else { // try using shape from Material Design Icon (mdi) library    
                const iconContainer = $('<div>')
                    .attr('class', layerUUID + '_legendicon')
                    .css({
                        'width': '18px',
                        'height': '18px',
                        'position': 'relative',
                        'cursor': 'crosshair'
                    })
                    .attr('title', _legend[d].value)
                r.append(iconContainer)

                const iconElement = $('<i>')
                    .attr('class', 'mdi mdi-18px mdi-' + shape)
                    .css({
                        'color': _legend[d].color,
                        'opacity': opacity,
                        'border': `1px solid ${_legend[d].strokecolor}`
                    })
                iconContainer.append(iconElement)
            }

            const legendLabel = $('<div>')
                .css({
                    'margin-left': orientation === 'horizontal' ? '8px' : '5px',
                    'height': '100%',
                    'line-height': '19px',
                    'font-size': '14px',
                    'overflow': 'hidden',
                    'white-space': 'nowrap',
                    'max-width': orientation === 'horizontal' ? 'none' : '270px',
                    'text-overflow': 'ellipsis'
                })
                .attr('title', _legend[d].value)
                .text(_legend[d].value)
            r.append(legendLabel)
        }
    }
    if (legendEntries.length > 0) {
        pushScale(legendEntries)
        legendEntries = []
    }

    function pushScale(legendEntries) {
        var r = $('<div>')
            .attr('class', 'row')
            .css({
                'display': 'flex',
                'flex-direction': 'column',
                'margin': orientation === 'horizontal' ? '8px 0px 8px 0px' : '0px 0px 8px 8px',
                'width': '100%', // Ensure full width
                'position': 'relative' // Add relative positioning for absolute positioned children
            })
        c.append(r)

        // Container for gradient and labels
        var legendContainer = $('<div>')
            .css({
                'display': 'flex',
                'flex-direction': orientation === 'horizontal' ? 'column' : 'row',
                'align-items': orientation === 'horizontal' ? 'flex-start' : 'center',
                'gap': orientation === 'horizontal' ? '4px' : '8px',
                'width': orientation === 'horizontal' ? '320px' : 'auto', // Set to 320px for horizontal legends
                'max-width': orientation === 'horizontal' ? '320px' : 'none', // Ensure it doesn't exceed 320px
                'padding-left': orientation === 'horizontal' ? '8px' : '0px' // Add left padding to align with vertical legends
            })
        r.append(legendContainer)

        // Calculate gradient width based on container width and number of sections
        const gradientWidth = orientation === 'horizontal' ? '100%' : '19px'

        var gradient = $('<div>')
            .css({
                'width': gradientWidth,
                'height': orientation === 'horizontal' ? '19px' : (19 * legendEntries.length + 'px'),
                'border': '1px solid black',
                'flex-shrink': '0',
                'position': 'relative',
                'cursor': 'crosshair'
            })
        legendContainer.append(gradient)

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

        var values = $('<div>')
            .css({
                'display': (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? 'block' : 'flex',
                'flex-direction': orientation === 'horizontal' ? 'row' : 'column',
                'justify-content': 'flex-start', // Left justify
                'width': orientation === 'horizontal' ? '100%' : 'auto',
                'height': orientation === 'horizontal' ? 'auto' : (19 * visibleLabels.length + 'px'),
                'gap': orientation === 'horizontal' ? '0' : '0',
                'position': 'relative',
                'padding-left': (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? '8px' : '0px',
                'padding-right': (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? '8px' : '0px',
                'padding-bottom': (orientation === 'horizontal' && legendEntries[0].shape === 'continuous') ? '12px' : '0px'
            })
        legendContainer.append(values)

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
                const tickMark = $('<div>')
                    .css({
                        'position': 'absolute',
                        'background': 'white',
                        'mix-blend-mode': 'difference',
                        'pointer-events': 'none',
                        'z-index': '10'
                    })
                gradient.append(tickMark)

                if (orientation === 'horizontal') {
                    // Horizontal tick marks
                    tickMark.css({
                        'width': '1px',
                        'height': '3px',
                        'left': `${tickPosition * 100}%`,
                        'top': '0px',
                        'transform': 'translateX(-50%)'
                    })

                    // Add a bottom tick mark for better visibility
                    const bottomTickMark = $('<div>')
                        .css({
                            'position': 'absolute',
                            'width': '1px',
                            'height': '3px',
                            'background': 'white',
                            'mix-blend-mode': 'difference',
                            'pointer-events': 'none',
                            'z-index': '10',
                            'left': `${tickPosition * 100}%`,
                            'bottom': '0px',
                            'transform': 'translateX(-50%)'
                        })
                    gradient.append(bottomTickMark)
                } else {
                    // Vertical tick marks
                    tickMark.css({
                        'width': '3px',
                        'height': '1px',
                        'top': `${tickPosition * 100}%`,
                        'left': '0px',
                        'transform': 'translateY(-50%)'
                    })

                    // Add a right tick mark for better visibility
                    const rightTickMark = $('<div>')
                        .css({
                            'position': 'absolute',
                            'width': '3px',
                            'height': '1px',
                            'background': 'white',
                            'mix-blend-mode': 'difference',
                            'pointer-events': 'none',
                            'z-index': '10',
                            'top': `${tickPosition * 100}%`,
                            'right': '0px',
                            'transform': 'translateY(-50%)'
                        })
                    gradient.append(rightTickMark)
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
                    const unitsLabelContinuous = $('<div>')
                        .css({
                            'position': 'absolute',
                            'right': '0px',
                            'top': '-20px',
                            'font-size': '12px',
                            'color': 'var(--color-f)',
                            'text-align': 'right',
                            'white-space': 'nowrap',
                            'z-index': '100',
                            'background': 'var(--color-k)',
                            'padding': '2px 4px',
                            'border-radius': '2px'
                        })
                        .text(units)
                    gradient.append(unitsLabelContinuous)
                }
            }
        }
        
        // Add units label for non-continuous horizontal legends
        if (orientation === 'horizontal' && (legendEntries.length === 0 || legendEntries[0].shape !== 'continuous')) {
            // Extract units from all visible labels
            const values = visibleLabels.map(item => item.value)
            const { units } = extractUnits(values)

            if (units) {
                const unitsLabel = $('<div>')
                    .css({
                        'position': 'absolute',
                        'top': '-20px',
                        'right': '8px',
                        'font-size': '12px',
                        'color': 'var(--color-f)',
                        'text-align': 'right',
                        'white-space': 'nowrap',
                        'z-index': '100',
                        'background': 'var(--color-k)',
                        'padding': '2px 4px',
                        'border-radius': '2px'
                    })
                    .text(units)
                r.append(unitsLabel)
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

            let v = $('<div>')
                .css({
                    'margin': '0',
                    'padding': '0',
                    'height': '19px',
                    'line-height': '19px',
                    'font-size': `${fontSize}px`,
                    'white-space': 'nowrap',
                    'overflow': 'hidden',
                    'text-overflow': 'ellipsis'
                })
                .attr('title', visibleLabels[i].value) // Keep full value in tooltip
                .text(displayText)
            values.append(v)

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

                v.css({
                    'position': 'absolute',
                    'left': `${adjustedPosition * 100}%`,
                    'transform': transform,
                    'text-align': 'center',
                    'width': 'auto',
                    'max-width': '80px' // Prevent overlap
                })
            } else if (orientation === 'horizontal') {
                // For non-continuous horizontal legends, use original layout
                v.css({
                    'position': 'relative',
                    'text-align': visibleLabels[i].shape === 'continuous' ?
                        (i === 0 ? 'left' : i === visibleLabels.length - 1 ? 'right' : 'center') :
                        'center',
                    'width': `${100/visibleLabels.length}%`
                })
            } else {
                // For vertical legends, keep original positioning
                v.css({
                    'position': 'relative',
                    'text-align': 'left',
                    'width': 'auto'
                })
            }
        }

        gradient.css(
            'background',
            orientation === 'horizontal'
                ? 'linear-gradient(to right, ' + gradientArray.join(',') + ')'
                : 'linear-gradient(to bottom, ' + gradientArray.join(',') + ')'
        )

        // Add hover functionality for gradient legends
        const tooltip = $('<div>')
            .css({
                'position': 'absolute',
                'background': 'rgba(0, 0, 0, 0.8)',
                'color': 'white',
                'padding': '4px 8px',
                'border-radius': '4px',
                'font-size': '12px',
                'pointer-events': 'none',
                'z-index': '1000',
                'visibility': 'hidden',
                'white-space': 'nowrap'
            })
        gradient.append(tooltip)

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
                    .css({
                        'visibility': 'visible',
                        'left': (event.clientX - rect.left - 15) + 'px',
                        'top': (event.clientY - rect.top - 30) + 'px'
                    })
                    .text(value)
            })
            .on('mouseleave', function() {
                tooltip.css('visibility', 'hidden')
            })
    }
}

//Other functions

export default LegendTool
