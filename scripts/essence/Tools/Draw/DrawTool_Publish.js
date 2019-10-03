define([
    'jquery',
    'd3',
    'Formulae_',
    'Layers_',
    'Globe_',
    'Map_',
    'Viewer_',
    'UserInterface_',
    'CursorInfo',
    'leafletDraw',
    'turf',
    'leafletPolylineDecorator',
    'leafletSnap',
    'colorPicker',
    'shp',
    'shpwrite',
], function(
    $,
    d3,
    F_,
    L_,
    Globe_,
    Map_,
    Viewer_,
    UserInterface_,
    CursorInfo,
    leafletDraw,
    turf,
    leafletPolylineDecorator,
    leafletSnap,
    colorPicker,
    shp,
    shpwrite
) {
    var DrawTool = null
    var Publish = {
        init: function(tool) {
            DrawTool = tool
            DrawTool.showReview = Publish.showReview
        },
        showReview: function(switchContent) {
            DrawTool.isReviewOpen = true
            $('#drawToolReview').remove()

            if (switchContent !== false && DrawTool.activeContent != 'shapes')
                DrawTool.showContent('shapes')

            //Turn on all master files
            // and turn off all non master files
            for (var f in DrawTool.files) {
                var id = DrawTool.files[f].id
                if (
                    DrawTool.files[f].is_master &&
                    DrawTool.filesOn.indexOf(id) == -1
                ) {
                    DrawTool.toggleFile(id, null, true)
                    $('.drawToolFileCheckbox[file_id="' + id + '" ]').addClass(
                        'on'
                    )
                } else if (
                    !DrawTool.files[f].is_master &&
                    DrawTool.filesOn.indexOf(id) != -1
                ) {
                    DrawTool.toggleFile(id, null, true)
                    $(
                        '.drawToolFileCheckbox[file_id="' + id + '" ]'
                    ).removeClass('on')
                }
            }

            //Hide all non master files
            // prettier-ignore
            var markup = [
                "<div id='drawToolReview'>",
                    "<div id='drawToolReviewTopbar'>",
                        "<div id='drawToolReviewTopbarTitle'>",
                            "Review",
                            "<div id='drawToolReviewRefresh'>",
                                "<div>refresh</div>",
                                "<i class='mdi mdi-refresh mdi-18px'></i>",
                            "</div>",
                        "</div>",
                        "<div id='drawToolReviewTopbarClose'>",
                            "<i class='mdi mdi-close mdi-18px'></i>",
                        "</div>",
                    "</div>",
                    "<div id='drawToolReviewContent'>",
                        "<ul>",
                        "</ul>",
                    "</div>",
                "</div>"
            ].join('\n');

            $('#drawTool').append(markup)

            $('#drawToolReviewRefresh').on('click', function() {
                DrawTool.showReview()
            })
            $('#drawToolReviewTopbarClose').on('click', function() {
                $('#drawToolReview').animate(
                    {
                        opacity: 0,
                    },
                    250,
                    function() {
                        $('#drawToolReview').remove()
                        DrawTool.isReviewOpen = false
                    }
                )
            })

            DrawTool.compileFile({ verbose: true }, function(d) {
                $('#drawToolReviewContent ul *').remove()
                var noErrors = true
                for (var i = 0; i < d.body.issues.length; i++) {
                    var s = d.body.issues[i]
                    if (s.severity === 'error') noErrors = false
                    var message = s.message
                    if (s.hasOwnProperty('antecedent')) {
                        message = message.replace(
                            '{antecedent}',
                            "<span class='ante' shape_id='" +
                                s.antecedent.id +
                                "'>" +
                                (DrawTool.intentNameMapping[
                                    s.antecedent.intent
                                ] ||
                                    s.antecedent.intent.capitalizeFirstLetter()) +
                                '(' +
                                s.antecedent.id +
                                ')' +
                                '</span>'
                        )
                    }
                    if (s.hasOwnProperty('consequent'))
                        message = message.replace(
                            '{consequent}',
                            "<span class='cons' shape_id='" +
                                s.consequent.id +
                                "'>" +
                                (DrawTool.intentNameMapping[
                                    s.consequent.intent
                                ] ||
                                    s.consequent.intent.capitalizeFirstLetter()) +
                                '(' +
                                s.consequent.id +
                                ')' +
                                '</span>'
                        )

                    var liMarkup = [
                        '<li>',
                        "<div class='" + s.severity + "'>",
                        s.severity,
                        '</div>',
                        message,
                        '</li>',
                    ].join('\n')
                    $('#drawToolReviewContent ul').append(liMarkup)
                }
                if (noErrors) {
                    //We can show the publish button
                    var liMarkup = [
                        '<li id="drawToolReviewPublish">',
                        '<div>Publish</div>',
                        '</li>',
                    ].join('\n')
                    $('#drawToolReviewContent ul').append(liMarkup)
                } else {
                    //We can show the publish button
                    var liMarkup = [
                        '<li id="drawToolReviewPublish" class="force">',
                        '<div>Publish Anyway</div>',
                        '</li>',
                    ].join('\n')
                    $('#drawToolReviewContent ul').append(liMarkup)
                }

                $('#drawToolReviewContent ul li > span').on(
                    'mouseenter',
                    function() {
                        $(
                            '.drawToolShapeLi[shape_id="' +
                                $(this).attr('shape_id') +
                                '"] .drawToolShapeLiItem'
                        ).mouseenter()
                    }
                )
                $('#drawToolReviewContent ul li > span').on(
                    'mouseleave',
                    function() {
                        $(
                            '.drawToolShapeLi[shape_id="' +
                                $(this).attr('shape_id') +
                                '"] .drawToolShapeLiItem'
                        ).mouseleave()
                    }
                )
                $('#drawToolReviewContent ul li > span').on(
                    'click',
                    function() {
                        $(
                            '.drawToolShapeLi[shape_id="' +
                                $(this).attr('shape_id') +
                                '"] .drawToolShapeLiItem'
                        ).click()
                    }
                )

                //Publish
                var publishing = false
                $('#drawToolReviewPublish').on('click', function() {
                    if (!publishing) {
                        publishing = true
                        calls.api(
                            'files_publish',
                            {},
                            function() {
                                $('#drawToolReviewPublish').html(
                                    '<div>Published!</div>'
                                )
                                $('#drawToolReviewPublish').css({
                                    background: '#26ff2b',
                                })
                                $('#drawToolReviewPublish > div').css({
                                    color: '#001 !important',
                                })
                            },
                            function() {
                                $('#drawToolReviewPublish').html(
                                    '<div>Publish Failed</div>'
                                )
                                $('#drawToolReviewPublish').css({
                                    background: '#ff2626',
                                })
                                setTimeout(function() {
                                    publishing = false
                                    $('#drawToolReviewPublish').html(
                                        '<div>Publish</div>'
                                    )
                                    $('#drawToolReviewPublish').css({
                                        background: '#5d26ff',
                                    })
                                }, 4000)
                            }
                        )
                    }
                })
            })
        },
    }

    return Publish
})
