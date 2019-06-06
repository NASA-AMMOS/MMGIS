define(['Layers_', 'jquery', 'd3', 'Formulae_', 'Map_'], function(
    L_,
    $,
    d3,
    F_,
    Map_
) {
    var isDragging = false
    var dragThreshold = 0
    var threshold = 2
    var isMouseDown = false

    LayersTool = {
        height: 'threefourths',
        width: 230,
        //the tool div
        tools: null,
        layers: null,
        entryLayers: [],
        bread: null,
        crumbs: null,
        indents: null,
        toggled: null,
        depth: null,
        currentDepth: 0,
        layersDiv: null,
        indentDivs: [],
        headerIds: [],
        make: function() {
            d3.select('#tools')
                .selectAll('*')
                .remove()
            this.layers = L_.layersData
            this.indents = L_.indentArray
            this.toggled = L_.toggledArray

            this.indentDivs = []
            this.headerIds = []
            this.depth = Math.max.apply(Math, this.indents)
            this.currentDepth = 0

            this.entryLayers = []
            for (var i = 0; i < this.layers.length; i++) {
                if (this.indents[i] == 0) {
                    this.entryLayers.push(this.layers[i])
                }
            }
            this.bread = [
                { name: 'Home', sublayers: F_.clone(this.entryLayers) },
            ]
            this.crumbs = F_.clone(this.entryLayers)

            this.tools = d3
                .select('#tools')
                .append('div')
                .attr('class', 'mmgisScrollbar')
                .style('padding', '0')
                .style('overflow', 'hidden')
                .style('overflow-y', 'auto')
                .style('height', '100%')
                .style('display', 'block')
                .append('ul')
                .attr('class', 'LayersToolList')
                .style('list-style-type', 'none')
                .style('margin', '0')
                .style('padding', '0')

            //this.buildThese( this.bread, this.crumbs );
            this.buildThese2(this.bread, this.crumbs)
        },
        buildThese2: function(bread, crumbs) {
            LayersTool.tools.selectAll('*').remove()
            //console.log( bread, crumbs );
            depth(crumbs, 0)
            function depth(crumbs, deep) {
                for (var i = 0; i < crumbs.length; i++) {
                    makeCrumb(crumbs[i], deep)
                    if (
                        crumbs[i].hasOwnProperty('sublayers') &&
                        crumbs[i].sublayers.length > 0
                    ) {
                        depth(crumbs[i].sublayers, deep + 1)
                    }
                }
            }

            //Collapse everything first
            for (var i = 0; i < LayersTool.headerIds.length; i++)
                LayersTool.toggleHeader(LayersTool.headerIds[i])

            function makeCrumb(crumb, deep) {
                var name = crumb.name
                var id = name.replace(/[^\w]/gi, '_')

                var layerColor = 'black'
                switch (crumb.type) {
                    case 'header':
                        layerColor = '#2f8989'
                        break
                    case 'tile':
                        layerColor = '#558b2f'
                        break
                    case 'vector':
                        layerColor = '#895c2f'
                        break
                    case 'model':
                        layerColor = '#552f89'
                        break
                    default:
                        layerColor = 'black'
                        break
                }

                if (crumb.type != 'header') {
                    var layerElDiv = LayersTool.tools
                        .append('li')
                        .attr('id', id + '_layermain')
                        .attr('class', 'unselectable')
                        .attr('on', 'true')
                        .attr('depth', deep)
                        .attr('type', 'layer')
                        .style('height', '32px')
                        .style('max-width', '100%')
                        .style('margin', '0px')
                        .style('margin-left', deep * 20 + 'px')
                        .style('display', 'flex')
                        .style('padding', '0px')
                    var layerElDivLeft = layerElDiv.append('div')
                    layerElDivLeft
                        .append('div')
                        .style('width', '4px')
                        .style('height', '100%')
                        .style('background', layerColor)
                    var layerElDivRight = layerElDiv
                        .append('div')
                        .style('width', '100%')
                    layerElDivRight
                        .append('div')
                        .attr('id', id + '_layerslider')
                        .style('background-color', function() {
                            return L_.toggledArray[name] ? layerColor : '#001'
                        })
                        .style('height', '100%')
                        .style('width', function() {
                            return L_.opacityArray[name] * 100 + '%'
                        })
                        .style('padding', '0px')
                        .style('margin', '0px')
                    layerElDivRight
                        .append('div')
                        .attr('id', id + '_layercrumb')
                        .attr('class', 'mmgisButton4')
                        .attr('draggable', 'false')
                        .style('position', 'relative')
                        .style('top', '-28px')
                        .style('border', 'none')
                        .style('cursor', 'pointer')
                        .style('margin', '0px')
                        .style('border-radius', '0px')
                        .style('display', 'block')
                        .style('border-radius', '0')
                        .style('width', '100%')
                        .html(
                            "<div style='width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'>" +
                                name +
                                '</div>'
                        )

                    if (L_.toggledArray[name]) {
                        $('#' + id + '_layercrumb').addClass('active')
                    }

                    $('#' + id + '_layercrumb')
                        .mousedown(function() {
                            isDragging = false
                            isMouseDown = true
                        })
                        .mousemove(
                            (function(name) {
                                return function(e) {
                                    if (isMouseDown) {
                                        dragThreshold++
                                        if (dragThreshold > threshold) {
                                            isDragging = true
                                            var id = name.replace(
                                                /[^\w]/gi,
                                                '_'
                                            )
                                            d3.select(
                                                '#' + id + '_layerslider'
                                            ).style('width', function() {
                                                var currentOpacity =
                                                    e.offsetX /
                                                    ($(
                                                        '#' + id + '_layercrumb'
                                                    ).width() +
                                                        parseInt(
                                                            $(
                                                                '#' +
                                                                    id +
                                                                    '_layercrumb'
                                                            )
                                                                .css(
                                                                    'padding-left'
                                                                )
                                                                .replace(
                                                                    'px',
                                                                    ''
                                                                )
                                                        ) +
                                                        parseInt(
                                                            $(
                                                                '#' +
                                                                    id +
                                                                    '_layercrumb'
                                                            )
                                                                .css(
                                                                    'padding-right'
                                                                )
                                                                .replace(
                                                                    'px',
                                                                    ''
                                                                )
                                                        ))
                                                if (currentOpacity > 0.95)
                                                    currentOpacity = 1
                                                else if (currentOpacity < 0.05)
                                                    currentOpacity = 0
                                                L_.setLayerOpacity(
                                                    name,
                                                    currentOpacity
                                                )
                                                return (
                                                    currentOpacity *
                                                        $(
                                                            '#' +
                                                                id +
                                                                '_layermain'
                                                        ).width() +
                                                    'px'
                                                )
                                            })
                                        }
                                    }
                                }
                            })(name)
                        )
                        .mouseup(
                            (function(name) {
                                return function() {
                                    if (isMouseDown) {
                                        if (!isDragging) {
                                            L_.toggleLayer(L_.layersNamed[name])
                                            for (
                                                var i = 0;
                                                i < LayersTool.layers.length;
                                                i++
                                            ) {
                                                var name2 =
                                                    LayersTool.layers[i].name
                                                var id = name2.replace(
                                                    /[^\w]/gi,
                                                    '_'
                                                )
                                                var layerColor2 = 'black'
                                                switch (
                                                    LayersTool.layers[i].type
                                                ) {
                                                    case 'header':
                                                        layerColor2 = '#2f8989'
                                                        break
                                                    case 'tile':
                                                        layerColor2 = '#558b2f'
                                                        break
                                                    case 'vector':
                                                        layerColor2 = '#895c2f'
                                                        break
                                                    case 'model':
                                                        layerColor2 = '#552f89'
                                                        break
                                                    default:
                                                        layerColor2 = 'black'
                                                        break
                                                }
                                                if (L_.toggledArray[name2]) {
                                                    $(
                                                        '#' + id + '_layercrumb'
                                                    ).addClass('active')
                                                    $(
                                                        '#' +
                                                            id +
                                                            '_layerslider'
                                                    ).css({
                                                        'background-color': layerColor2,
                                                    })
                                                } else {
                                                    $(
                                                        '#' +
                                                            id +
                                                            '_layercrumb.active'
                                                    ).removeClass('active')
                                                    $(
                                                        '#' +
                                                            id +
                                                            '_layerslider'
                                                    ).css({
                                                        'background-color':
                                                            '#001',
                                                    })
                                                }
                                            }
                                        }
                                    }
                                    isDragging = false
                                    isMouseDown = false
                                    dragThreshold = 0
                                }
                            })(name)
                        )
                        .mouseleave(function() {
                            isDragging = false
                            isMouseDown = false
                            dragThreshold = 0
                        })
                } else {
                    //It's a header
                    var headerEl = LayersTool.tools
                        .append('li')
                        .attr('id', id + '_layerbread')
                        .attr('on', 'true')
                        .attr('childrenon', 'true')
                        .attr('depth', deep)
                        .attr('type', 'header')
                        .style('display', 'flex')
                        .style('margin-left', deep * 20 + 'px')

                    headerEl
                        .append('div')
                        .style('width', '4px')
                        .style('height', '28px')
                        .style('background', layerColor)
                    var headerElRight = headerEl
                        .append('div')
                        .style('flex', '1')

                    headerElRight
                        //.attr( 'id', id + '_layerbread' )
                        .attr('class', 'mmgisButton4')
                        .style('color', 'white')
                        .style('background', '#00264c')
                        .style('cursor', 'pointer')
                        .style('border', 'none')
                        .style('border-top', '1px solid black')
                        .style('margin', '0px')
                        .style('display', 'block')
                        .style('border-radius', '0')
                        .html(
                            "<div style='display: flex; justify-content: space-between;'><div " +
                                "style='width: " +
                                (170 - deep * 20) +
                                "px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'>" +
                                name +
                                '</div><div>' +
                                "<i class='mdi mdi-menu-down mdi-18px'></i>" +
                                '</div></div>'
                        )
                    $('#' + id + '_layerbread').on(
                        'click',
                        (function(id) {
                            return function() {
                                LayersTool.toggleHeader(id + '_layerbread')
                            }
                        })(id)
                    )

                    LayersTool.headerIds.push(id + '_layerbread')
                }
            }
        },
        toggleHeader: function(elmIndex) {
            var found = false
            var done = false
            var elmDepth = 0
            var wasOn = false
            $('.LayersToolList > li').each(function() {
                if (done) return
                var t = $(this)
                if (t.attr('id') == elmIndex) {
                    found = true
                    elmDepth = t.attr('depth')
                    wasOn = t.attr('childrenon') == 'true'
                    t.attr('childrenon', wasOn ? 'false' : 'true')
                } else if (found) {
                    if (
                        t.attr('type') == 'header' &&
                        t.attr('depth') <= elmDepth
                    ) {
                        done = true
                    } else if (t.attr('depth') <= elmDepth) {
                        done = true
                    } else {
                        var nextDepth =
                            parseInt(t.attr('depth')) == parseInt(elmDepth) + 1
                        if (wasOn) {
                            if (nextDepth) t.attr('on', 'false')
                            t.css('transition', 'height 0.5s ease-out')
                            t.css('overflow', 'hidden')
                            t.css(
                                'height',
                                wasOn
                                    ? '0'
                                    : t.attr('type') == 'header'
                                    ? '28px'
                                    : '32px'
                            )
                        } else {
                            if (t.attr('on') == 'true' || nextDepth) {
                                t.css(
                                    'height',
                                    t.attr('type') == 'header' ? '28px' : '32px'
                                )
                            }
                            if (nextDepth) t.attr('on', 'true')
                        }
                    }
                }
            })
        },
        buildThese: function(bread, crumbs) {
            console.log(bread, crumbs)
            for (var i = 0; i < bread.length; i++) {
                var name = bread[i].name
                var id = name.replace(/[^\w]/gi, '_')
                this.tools
                    .append('div')
                    .attr('id', id + '_layerbread')
                    .attr('class', 'mmgisButton')
                    .style('color', '#4CA865')
                    .style('cursor', 'pointer')
                    .style('margin', '2px 0px 0px 0px')
                    .html(name)
                this.tools
                    .append('div')
                    .style('padding', '4px 0px 0px 0px')
                    .append('i')
                    .attr('class', 'large angle right icon')
                    .style('color', '#999')

                $('#' + id + '_layerbread').on(
                    'click',
                    (function(i) {
                        return function() {
                            //Update the bread
                            //>.<
                            var bakingbread = []
                            for (var j = 0; j < bread.length; j++) {
                                if (bread[j].name != bread[i].name) {
                                    bakingbread.push(bread[j])
                                } else {
                                    bakingbread.push(bread[j])
                                    break
                                }
                            }
                            LayersTool.bread = bakingbread
                            LayersTool.crumbs = LayersTool.bread[i].sublayers
                            LayersTool.buildThese(
                                LayersTool.bread,
                                LayersTool.crumbs
                            )
                        }
                    })(i)
                )
            }

            for (var i = 0; i < crumbs.length; i++) {
                var name = crumbs[i].name
                var id = name.replace(/[^\w]/gi, '_')

                if (crumbs[i].type != 'header') {
                    var layerElDiv = this.tools
                        .append('div')
                        .attr('id', id + '_layermain')
                        .attr('class', 'unselectable')
                        .style('height', '32px')
                        .style('margin', '0px 16px 0px 0px')
                        .style('padding', '0px')
                    var opacitySlider = layerElDiv
                        .append('div')
                        .attr('id', id + '_layerslider')
                        .style('background-color', function() {
                            return L_.toggledArray[name] ? '#4c8fa8' : '#333'
                        })
                        .style('height', '100%')
                        .style('width', function() {
                            return L_.opacityArray[name] * 100 + '%'
                        })
                        .style('padding', '0px')
                        .style('margin', '0px')
                    layerElDiv
                        .append('div')
                        .attr('id', id + '_layercrumb')
                        .attr('class', 'mmgisButton')
                        .attr('draggable', 'false')
                        .style('position', 'relative')
                        .style('top', '-30px')
                        .style('cursor', 'pointer')
                        .style('margin', '0px')
                        .style('margin-left', '2px')
                        .style('margin-right', '2px')
                        .html(name)

                    if (L_.toggledArray[name]) {
                        $('#' + id + '_layercrumb').addClass('active')
                    }

                    $('#' + id + '_layercrumb')
                        .mousedown(function() {
                            isDragging = false
                            isMouseDown = true
                        })
                        .mousemove(
                            (function(name) {
                                return function(e) {
                                    if (isMouseDown) {
                                        dragThreshold++
                                        if (dragThreshold > threshold) {
                                            isDragging = true
                                            var id = name.replace(
                                                /[^\w]/gi,
                                                '_'
                                            )
                                            d3.select(
                                                '#' + id + '_layerslider'
                                            ).style('width', function() {
                                                var currentOpacity =
                                                    e.offsetX /
                                                    ($(
                                                        '#' + id + '_layercrumb'
                                                    ).width() +
                                                        parseInt(
                                                            $(
                                                                '#' +
                                                                    id +
                                                                    '_layercrumb'
                                                            )
                                                                .css(
                                                                    'padding-left'
                                                                )
                                                                .replace(
                                                                    'px',
                                                                    ''
                                                                )
                                                        ) +
                                                        parseInt(
                                                            $(
                                                                '#' +
                                                                    id +
                                                                    '_layercrumb'
                                                            )
                                                                .css(
                                                                    'padding-right'
                                                                )
                                                                .replace(
                                                                    'px',
                                                                    ''
                                                                )
                                                        ))
                                                if (currentOpacity > 0.95)
                                                    currentOpacity = 1
                                                else if (currentOpacity < 0.05)
                                                    currentOpacity = 0
                                                L_.setLayerOpacity(
                                                    name,
                                                    currentOpacity
                                                )
                                                return (
                                                    currentOpacity *
                                                        $(
                                                            '#' +
                                                                id +
                                                                '_layermain'
                                                        ).width() +
                                                    'px'
                                                )
                                            })
                                        }
                                    }
                                }
                            })(name)
                        )
                        .mouseup(
                            (function(name) {
                                return function() {
                                    if (isMouseDown) {
                                        if (!isDragging) {
                                            L_.toggleLayer(L_.layersNamed[name])
                                            for (
                                                var i = 0;
                                                i < LayersTool.layers.length;
                                                i++
                                            ) {
                                                var name2 =
                                                    LayersTool.layers[i].name
                                                var id = name2.replace(
                                                    /[^\w]/gi,
                                                    '_'
                                                )
                                                if (L_.toggledArray[name2]) {
                                                    $(
                                                        '#' + id + '_layercrumb'
                                                    ).addClass('active')
                                                    $(
                                                        '#' +
                                                            id +
                                                            '_layerslider'
                                                    ).css({
                                                        'background-color':
                                                            '#4c8fa8',
                                                    })
                                                } else {
                                                    $(
                                                        '#' +
                                                            id +
                                                            '_layercrumb.active'
                                                    ).removeClass('active')
                                                    $(
                                                        '#' +
                                                            id +
                                                            '_layerslider'
                                                    ).css({
                                                        'background-color':
                                                            '#333',
                                                    })
                                                }
                                            }
                                        }
                                    }
                                    isDragging = false
                                    isMouseDown = false
                                    dragThreshold = 0
                                }
                            })(name)
                        )
                        .mouseleave(function() {
                            isDragging = false
                            isMouseDown = false
                            dragThreshold = 0
                        })
                } else {
                    //It's a header
                    this.tools
                        .append('div')
                        .attr('id', id + '_layerbread')
                        .attr('class', 'mmgisButton')
                        .style('color', '#4CA865')
                        .style('cursor', 'pointer')
                        .style('margin', '2px 16px 0px 0px')
                        .html(name)
                    $('#' + id + '_layerbread').on(
                        'click',
                        (function(i) {
                            return function() {
                                bread.push(crumbs[i])
                                LayersTool.bread = bread
                                LayersTool.crumbs = crumbs[i].sublayers
                                LayersTool.buildThese(
                                    LayersTool.bread,
                                    LayersTool.crumbs
                                )
                            }
                        })(i)
                    )
                }
            }
        },
        //choose which directory to have open
        setHeader: function(header) {
            var preEntryLayers = []
            for (var i = 0; i < L_.layersData.length; i++) {
                if (L_.indentArray[i] == 0) {
                    preEntryLayers.push(L_.layersData[i])
                }
            }
            for (var i = 0; i < L_.layersData.length; i++) {
                if (
                    L_.layersData[i].type == 'header' &&
                    L_.layersData[i].name.toLowerCase() == header.toLowerCase()
                ) {
                    this.bread = []
                    //Assemble bread backwards from header
                    this.bread.push(L_.layersData[i])
                    var parent = L_.layersParent[L_.layersData[i].name]
                    while (parent != null) {
                        this.bread.push(L_.layersNamed[parent])
                        parent = L_.layersParent[parent]
                    }
                    this.bread.push({ name: 'Home', sublayers: preEntryLayers })

                    this.bread.reverse()

                    this.crumbs = L_.layersData[i].sublayers
                    return
                }
            }
        },
        destroy: function() {},
    }

    return LayersTool
})
