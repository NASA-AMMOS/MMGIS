import $ from 'jquery'
import F_ from '../../../../../../src/essence/Basics/Formulae_/Formulae_'
import L_ from '../../../../../../src/essence/Basics/Layers_/Layers_'
import Map_ from '../../../../../../src/essence/Basics/Map_/Map_'
import CursorInfo from '../../../../../../src/essence/Basics/UserInterface_/components/CursorInfo/CursorInfo'
import Toast from '../../../../../../src/design-system/components/Toast/Toast'
import 'markjs'

import calls from '../../../../../../src/pre/calls'

import './DrawTool_SetOperations.css'

var DrawTool = null
var SetOperations = {
    activeTab: null,
    lastSplitLine: null,
    init: function (tool) {
        DrawTool = tool

        DrawTool.plugins.SetOperations = {
            getUI: SetOperations.getSetOperationsUI,
            addEvents: SetOperations.addSetOperationsEvents,
            custom: {
                endSplitDrawing: SetOperations.endSplitDrawing,
            },
        }

        DrawTool.endSplitDrawing = SetOperations.endSplitDrawing
        DrawTool.getSetOperationsUI = SetOperations.getSetOperationsUI
        DrawTool.addSetOperationsEvents = SetOperations.addSetOperationsEvents
    },
    getSetOperationsUI: function () {
        // prettier-ignore
        return [
                "<div class='drawToolContextMenuSetOperations'>",

                    "<div class='drawToolContextMenuSetOperationsBar'>",
                        "<div class='drawToolContextMenuSetOperationsTabButtons'>",
                            "<div class='drawToolContextMenuTabButtonSO' tab='drawToolContextMenuTabSOMerge' title='Merge'>",
                                "Merge",
                            "</div>",
                            "<div class='drawToolContextMenuTabButtonSO' tab='drawToolContextMenuTabSOSplit' title='Split'>",
                                "Split",
                            "</div>",
                        "</div>",
                    "</div>",

                    "<div class='drawToolContextMenuTabs'>",

                        "<div class='drawToolContextMenuTabSO drawToolContextMenuTabSOMerge'>",
                            "<ul>",
                                "<li>",
                                    "<div>Name</div>",
                                    "<div>Persist Properties</div>",
                                "</li>",
                                SetOperations._makeMerge(),
                            "</ul>",
                            "<div class='drawToolContextMenuTabSOFooter'>",
                                "<div class='drawToolButton1 drawToolContextMenuTabSOCancel'>Cancel</div>",
                                "<div class='drawToolButton1 drawToolContextMenuTabSOMergeMerge'>Merge</div>",
                            "</div>",
                        "</div>",

                        "<div class='drawToolContextMenuTabSO drawToolContextMenuTabSOSplit'>",
                            SetOperations._makeSplit(),
                            "<div class='drawToolContextMenuTabSOFooter'>",
                                "<div class='drawToolButton1 drawToolContextMenuTabSOCancel'>Cancel</div>",
                                "<div class='drawToolButton1 drawToolContextMenuTabSOSplitRedraw'>Redraw</div>",
                                "<div class='drawToolButton1 drawToolContextMenuTabSOSplitSplit'>Split</div>",
                            "</div>",
                        "</div>",

                    "</div>",

                "</div>",
            ].join('\n')
    },
    _makeMerge: function () {
        var lis = []
        for (var i = 0; i < DrawTool.contextMenuLayers.length; i++) {
            // prettier-ignore
            lis.push(
                [
                    "<li shape_id='" + DrawTool.contextMenuLayers[i].properties._.id + "'>",
                        "<div>" + F_.sanitize(DrawTool.contextMenuLayers[i].properties.name || 'No Name') + "</div>",
                        "<div class='drawToolContextMenuTabSOMergeCheckbox'></div>",
                    "</li>"
                ].join('\n')
            )
        }
        return lis.join('\n')
    },
    _makeSplit: function () {
        var lis = ['<div>Draw a line to split selected shapes.</div>']
        return lis.join('\n')
    },
    beginSplitDrawing: function () {
        SetOperations.endSplitDrawing()
        DrawTool.drawing.line.begin(
            'line',
            {
                color: 'rgb(255, 40, 0)',
                weight: 3,
                opacity: 1,
                dashArray: '10 10',
            },
            function (s) {
                SetOperations.lastSplitLine = s
                Map_.tempDrawToolSOSplit = L.geoJson(s, {
                    style: function (feature) {
                        return s.properties.style
                    },
                })
                Map_.tempDrawToolSOSplit.addTo(Map_.map)
                DrawTool.drawing.line.end()
            }
        )
    },
    endSplitDrawing: function () {
        DrawTool.drawing.line.end()
        Map_.rmNotNull(Map_.tempDrawToolSOSplit)
        SetOperations.lastSplitLine = null
    },
    addSetOperationsEvents: function () {
        $('.drawToolContextMenuTabButtonSO').on('click', function () {
            $('.drawToolContextMenuTabButtonSO.active').removeClass('active')
            $('.drawToolContextMenuTabSO.active').removeClass('active')
            $(this).addClass('active')
            let tab = $(this).attr('tab')
            $('.' + tab).addClass('active')
            $('.drawToolContextMenuSetOperationsTabTitle').text(
                $(this).attr('title')
            )

            if (tab == 'drawToolContextMenuTabSOSplit')
                SetOperations.beginSplitDrawing()
            else SetOperations.endSplitDrawing()
            SetOperations.activeTab = tab
        })

        $('.drawToolContextMenuTabSOMergeCheckbox').on('click', function () {
            $('.drawToolContextMenuTabSOMergeCheckbox').removeClass('on')
            $(this).addClass('on')
        })

        $('.drawToolContextMenuTabSOMerge ul li').on('mouseenter', function () {
            let sI = $(this).attr('shape_id')
            if (sI == null) return
            $(
                '.drawToolShapeLi[shape_id="' + sI + '"] .drawToolShapeLiItem'
            ).mouseenter()
        })
        $('.drawToolContextMenuTabSOMerge ul li').on('mouseleave', function () {
            let sI = $(this).attr('shape_id')
            if (sI == null) return
            $(
                '.drawToolShapeLi[shape_id="' + sI + '"] .drawToolShapeLiItem'
            ).mouseleave()
        })

        //MERGE
        $('.drawToolContextMenuTabSOMergeMerge').on('click', function () {
            var ids = []
            var file_id = DrawTool.contextMenuLayers[0].properties._.file_id
            for (let i = 0; i < DrawTool.contextMenuLayers.length; i++) {
                ids.push(DrawTool.contextMenuLayers[i].properties._.id)
                if (
                    file_id !=
                    DrawTool.contextMenuLayers[i].properties._.file_id
                ) {
                    Toast.warning("Warning! Can't merge shapes from separate files.", 6000)
                    return
                }
            }

            //Put persist property id at the end
            let propertyId = $('.drawToolContextMenuTabSOMergeCheckbox.on')
                .parent()
                .attr('shape_id')

            if (propertyId == null) {
                Toast.warning('Merge: Select a shape whose properties will persist through the merge.', 6000)
                return
            }

            calls.api(
                'draw_merge',
                {
                    file_id: file_id,
                    prop_id: propertyId,
                    ids: ids,
                },
                function (d) {
                    DrawTool.refreshFile(file_id, null, true, d.body.ids)
                },
                function () {}
            )
        })

        //Split
        $('.drawToolContextMenuTabSOSplitSplit').on('click', function () {
            if (SetOperations.lastSplitLine == null) {
                Toast.warning('Split: Draw a line to split against first.', 6000)
                return
            }

            var ids = []
            var file_id = DrawTool.contextMenuLayers[0].properties._.file_id
            for (let i = 0; i < DrawTool.contextMenuLayers.length; i++) {
                ids.push(DrawTool.contextMenuLayers[i].properties._.id)
                if (
                    file_id !=
                    DrawTool.contextMenuLayers[i].properties._.file_id
                ) {
                    Toast.warning("Warning! Can't split shapes from separate files.", 6000)
                    SetOperations.endSplitDrawing()
                    return
                }
            }

            calls.api(
                'draw_split',
                {
                    file_id: file_id,
                    split: JSON.stringify(SetOperations.lastSplitLine),
                    ids: ids,
                },
                function (d) {
                    DrawTool.refreshFile(file_id, null, true, d.body.ids)
                },
                function () {}
            )

            SetOperations.endSplitDrawing()
        })
        $('.drawToolContextMenuTabSOSplitRedraw').on('click', function () {
            SetOperations.beginSplitDrawing()
        })

        //Cancel
        $('.drawToolContextMenuTabSOCancel').on('click', function () {
            SetOperations.endSplitDrawing()
            $('.drawToolContextMenuTabButtonSO.active').removeClass('active')
            $('.drawToolContextMenuTabSO.active').removeClass('active')
        })
    },
}

export default SetOperations
