//Json to info tab
// #info-tab
define(['jquery', 'd3', 'Formulae_', 'Viewer_', 'Map_', 'Globe_'], function(
    $,
    d3,
    F_,
    Viewer_,
    Map_,
    Globe_
) {
    var InfoTool = {
        height: 200,
        featuresDiv: null,
        imagesDiv: null,
        infoDiv: null,
        contentDiv: null,
        info: null,
        variables: null,
        imageInfo: null,
        numOfImages: null,
        on: false,
        make: function() {
            this.on = true

            var tools = d3.select('#tools')

            tools.selectAll('*').remove()
            //d3.select( '#tools' ).html( markup );
            tools = tools
                .append('div')
                .attr('class', 'ui padded grid')
                .style('height', '100%')

            this.featuresDiv = tools
                .append('div')
                .attr('id', 'infofeaturesdiv')
                .attr('class', 'row')
                .style('padding', '0px 0px 5px 0px')
                .append('div')
                .attr('class', 'sixteen wide column')
                .style('height', 'auto')
            this.contentDiv = tools
                .append('div')
                .attr('class', 'row')
                .style('padding', '0px')
                .style('height', '100%')
            this.infoDiv = this.contentDiv
                .append('div')
                .attr('class', 'eight wide column')
                .attr('height', 'auto')

            this.infoDiv = this.infoDiv
                .append('div')
                .attr('class', 'ui padded grid mmgisScrollbar')
                .style('overflow-y', 'auto')
                .style('height', 'calc( 100% - 49px )')
            this.imagesDiv = this.contentDiv
                .append('div')
                .attr('class', 'eight wide column')
            this.imagesDiv = this.imagesDiv
                .append('div')
                .attr('class', 'ui padded grid')
                .style('height', 'auto')

            this.use(this.info)
        },
        //We might get multiple features if vector layers overlap
        use: function(features, variables) {
            //In the very least, update the info
            this.info = features
            this.variables = variables
            //and reset our image info
            this.imageInfo = []

            //If we have info and the tool is on, fill the tool
            if (this.info != null && this.on) {
                this.featuresDiv.selectAll('*').remove()
                this.infoDiv.selectAll('*').remove()
                this.imagesDiv.selectAll('*').remove()

                //Do we have multiple features?
                if (Array.isArray(this.info) && this.info.length > 0) {
                } else {
                    this.info = [{ feature: this.info }]
                }

                for (var i = 0; i < this.info.length; i++) {
                    var propInfo = this.info[i].feature.properties
                    this.featuresDiv
                        .append('div')
                        .attr('id', i + '_infofeaturesdiv')
                        .attr('class', 'mmgisButton infofeaturesdivel')
                        .html(propInfo[Object.keys(propInfo)[0]])
                    $('#' + i + '_infofeaturesdiv').on(
                        'click',
                        (function(i, propInfo) {
                            return function(e) {
                                e.stopPropagation()
                                e.preventDefault()
                                $(
                                    '#infofeaturesdiv div .infofeaturesdivel.active'
                                ).removeClass('active')
                                $('#' + i + '_infofeaturesdiv').addClass(
                                    'active'
                                )
                                //Reset our image info
                                InfoTool.imageInfo = []
                                InfoTool.numOfImages = 0
                                //and our divs
                                InfoTool.imagesDiv.selectAll('*').remove()
                                InfoTool.infoDiv.selectAll('*').remove()

                                var masterImg
                                if (
                                    InfoTool.variables != null &&
                                    InfoTool.variables.hasOwnProperty(
                                        'viewer'
                                    ) &&
                                    InfoTool.variables['viewer'].hasOwnProperty(
                                        'masterImageProp'
                                    )
                                ) {
                                    masterImg =
                                        propInfo[
                                            InfoTool.variables['viewer'][
                                                'masterImageProp'
                                            ]
                                        ]
                                }

                                for (var p in propInfo) {
                                    if (propInfo.hasOwnProperty(p)) {
                                        //Find any images in the properties and give them buttons
                                        if (
                                            typeof propInfo[p] === 'string' &&
                                            (propInfo[p]
                                                .toLowerCase()
                                                .match(
                                                    /\.(jpeg|jpg|gif|png|xml)$/
                                                ) != null ||
                                                propInfo[p].indexOf('/') !=
                                                    -1 ||
                                                propInfo[p].indexOf('\\') != -1)
                                        ) {
                                            var obj = {}

                                            //if we have a file
                                            if (
                                                propInfo[p]
                                                    .toLowerCase()
                                                    .match(
                                                        /\.(jpeg|jpg|gif|png|xml)$/
                                                    ) != null
                                            ) {
                                                addImageBar(
                                                    p.capitalizeFirstLetter(),
                                                    propInfo[p],
                                                    null,
                                                    masterImg
                                                )
                                            } else {
                                                //we have a directory
                                                //Find if it has a corresponding extension defined
                                                if (
                                                    InfoTool.variables !=
                                                        null &&
                                                    InfoTool.variables.hasOwnProperty(
                                                        'viewer'
                                                    ) &&
                                                    InfoTool.variables[
                                                        'viewer'
                                                    ].hasOwnProperty(
                                                        'extensions'
                                                    )
                                                ) {
                                                    var e =
                                                        InfoTool.variables[
                                                            'viewer'
                                                        ]['extensions']
                                                    var exts = []
                                                    for (
                                                        var v = 0;
                                                        v < e.length;
                                                        v++
                                                    ) {
                                                        if (
                                                            e[v].hasOwnProperty(
                                                                'key'
                                                            ) &&
                                                            e[v].hasOwnProperty(
                                                                'exts'
                                                            ) &&
                                                            p == e[v]['key']
                                                        ) {
                                                            exts = e[v]['exts']
                                                            break
                                                        }
                                                    }
                                                    if (exts.length > 0) {
                                                        addImageBar(
                                                            p.capitalizeFirstLetter(),
                                                            propInfo[p],
                                                            exts,
                                                            masterImg
                                                        )
                                                    } else {
                                                        addPropBar(
                                                            p,
                                                            propInfo[p]
                                                        )
                                                    }
                                                }
                                            }
                                        } else {
                                            addPropBar(p, propInfo[p])
                                        }
                                    }
                                }
                                function addPropBar(p, propInfo) {
                                    var prop = InfoTool.infoDiv
                                        .append('div')
                                        .attr('class', 'five wide column')
                                        .style('padding-top', '2px')
                                        .style('padding-bottom', '2px')
                                        .style('padding-left', '5%')
                                    var shrunkProp = String(propInfo)
                                    if (shrunkProp.length > 17) {
                                        shrunkProp =
                                            shrunkProp.substr(0, 17) + '...'
                                    }
                                    prop.append('div')
                                        .style('float', 'left')
                                        .html(p.capitalizeFirstLetter() + ':  ')
                                    prop.append('div')
                                        .style('float', 'right')
                                        .attr('title', propInfo)
                                        .html(shrunkProp)
                                }
                                function addImageBar(
                                    imgKey,
                                    imgUrl,
                                    imgExts,
                                    imgMaster
                                ) {
                                    var image = InfoTool.imagesDiv
                                        .append('div')
                                        .attr(
                                            'id',
                                            InfoTool.numOfImages +
                                                '_infoimagebutton'
                                        )
                                        .attr(
                                            'class',
                                            'sixteen wide column mmgisButton'
                                        )
                                        .style('width', '100%')
                                        .style('padding-top', '2px')
                                        .style('padding-bottom', '2px')
                                        .style('margin-top', '0px')
                                    image
                                        .append('div')
                                        .style('float', 'left')
                                        .html(imgKey + ':  ')
                                    image
                                        .append('div')
                                        .style('float', 'right')
                                        .attr('title', propInfo[p])
                                        .html(imgUrl)
                                    image.on(
                                        'click',
                                        (function(imgUrl) {
                                            return function(e) {
                                                $(this)
                                                    .siblings()
                                                    .removeClass('active')
                                                $(this).addClass('active')
                                                $('.imgRadio div.active').each(
                                                    function(index) {
                                                        if (
                                                            $(this).html() ==
                                                            'V'
                                                        ) {
                                                            Viewer_.changeImage(
                                                                {
                                                                    url: imgUrl,
                                                                    isPanoramic: false,
                                                                    exts: imgExts,
                                                                    masterImg: imgMaster,
                                                                }
                                                            )
                                                        } else if (
                                                            $(this).html() ==
                                                            'v'
                                                        )
                                                            Viewer_.changeImage(
                                                                {
                                                                    url: imgUrl,
                                                                    isPanoramic: true,
                                                                }
                                                            )
                                                        else if (
                                                            $(this).html() ==
                                                            'M'
                                                        )
                                                            Map_.changeTempTileLayer(
                                                                imgUrl
                                                            )
                                                        else if (
                                                            $(this).html() ==
                                                            'G'
                                                        )
                                                            Globe_.addTileLayer(
                                                                {
                                                                    name:
                                                                        'temp',
                                                                    on: true,
                                                                    path: imgUrl,
                                                                    opacity: 1,
                                                                    minZoom: 3,
                                                                    maxZoom: 8,
                                                                }
                                                            )
                                                    }
                                                )
                                            }
                                        })(imgUrl)
                                    )
                                    InfoTool.numOfImages++
                                }
                                $('#0_infoimagebutton').click()
                            }
                        })(i, propInfo)
                    )
                }

                var imgRadio = this.featuresDiv
                    .append('div')
                    .attr('class', 'mmgisRadioBar imgRadio')
                    .style('float', 'right')
                var irVb = imgRadio
                    .append('div')
                    .attr('class', 'active')
                    .html('V')
                var irVm = imgRadio.append('div').html('v')
                var irM = imgRadio.append('div').html('M')
                var irG = imgRadio.append('div').html('G')

                $('.mmgisRadioBar.imgRadio div').click(function(e) {
                    if ($(this).hasClass('active')) {
                        $(this).removeClass('active')
                    } else {
                        $(this).addClass('active')
                    }
                })

                //Automatically select first feature first image
                $('#0_infofeaturesdiv').click()
            }
        },
        destroy: function() {
            this.on = false
        },
    }

    return InfoTool
})
