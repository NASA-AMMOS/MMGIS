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
    var History = {
        init: function(tool) {
            DrawTool = tool
            DrawTool.populateHistory = History.populateHistory
        },
        populateHistory() {
            clearInterval(DrawTool.historyTimeout)
            DrawTool.historyTimeout = setInterval(function() {
                $('#drawToolHistoryTime').val(
                    F_.timestampToDate(Date.now() / 1000)
                )
            }, 1000)

            $('#drawToolHistorySequenceList ul *').remove()

            var file = DrawTool.getFileObjectWithId(DrawTool.currentFileId)
            if (file == null) {
                $('#drawToolHistoryFile')
                    .css({ background: '#ac0404', color: 'white' })
                    .text('No File Selected!')
                return
            }
            $('#drawToolHistoryFile')
                .css({ background: 'white', color: 'black' })
                .text(file.file_name)

            DrawTool.getHistoryFile(
                file.id,
                function(history) {
                    DrawTool.currentHistory = history
                    DrawTool.timeInHistory = F_.timestampToDate(
                        Date.now() / 1000
                    )
                    for (var i = 0; i < history.length; i++) {
                        addHistoryToList(history[i])
                    }
                    if (history[i - 1])
                        addHistoryToList({
                            time: history[i - 1].time - 1,
                            message: 'Begin',
                        })
                    $('#drawToolHistorySequenceList > ul > li').on(
                        'click',
                        function() {
                            var time = parseInt(
                                $(this)
                                    .find('div')
                                    .attr('time')
                            )
                            DrawTool.timeInHistory = time
                            $(this)
                                .prevAll()
                                .addClass('inactive')
                            $(this).removeClass('inactive')
                            $(this)
                                .nextAll()
                                .removeClass('inactive')
                            $('#drawToolHistoryTime').val(
                                F_.timestampToDate(time / 1000)
                            )

                            var toUndo = $(this).prevAll().length
                            $('#drawToolHistorySave').removeClass('active')
                            if (toUndo > 0)
                                $('#drawToolHistorySave').addClass('active')
                            $('#drawToolHistorySave').text(
                                toUndo === 0
                                    ? 'Nothing to Undo'
                                    : 'Undo ' + toUndo + ' Actions'
                            )

                            clearInterval(DrawTool.historyTimeout)
                            DrawTool.refreshFile(file.id, time, false)
                        }
                    )
                    $('#drawToolHistoryNow').on('click', function() {
                        $(
                            '#drawToolHistorySequenceList > ul > li:first-child'
                        ).click()
                    })
                },
                function() {}
            )

            function addHistoryToList(h) {
                // prettier-ignore
                var markup = [
                    "<div class='flexbetween' time=" + h.time + ">",
                        "<span>" + h.message + "</span>",
                        "<span>" + F_.timestampToDate(h.time / 1000) + "</span>",
                    "</div>"
                ].join('\n');

                d3.select('#drawToolHistorySequenceList ul')
                    .append('li')
                    .html(markup)
            }
        },
    }

    return History
})
