//New Tool Template
//In the very least, each tool needs to be defined through require.js and return
// an object with 'make' and 'destroy' functions
import $ from 'jquery'
import F_ from '../Basics/Formulae_/Formulae_'
import L_ from '../Basics/Layers_/Layers_'
import Viewer_ from '../Basics/Viewer_/Viewer_'
import Map_ from '../Basics/Map_/Map_'
import Globe_ from '../Basics/Globe_/Globe_'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
    "<div id='swap' style='width: 100%; height: 100%; display: flex; flex-flow: column; border-left: 1px solid var(--color-b);'>",
      "<div style='display: flex; justify-content: space-between; border-bottom: 2px solid #3a3a3a; height: 30px; font-size: 14px; padding-left: 8px; line-height: 30px; background: var(--color-a);'>",
        "<div>Swap Mission</div>",
        "<div id='swapToHost' style='width: 28px; line-height: 28px; text-align: center; cursor: pointer;'></div>",
      "</div>",
      "<div style='display: flex; flex: 1; overflow-y: auto;'>",
        "<ul id='swapMissionsList' class='mmgisScrollbar' style='width: 100%; overflow-y: auto; list-style-type: none; margin: 0; padding: 0;'>",
        "</ul>",
      "</div>",
      "<div id='swapSearch' class='ui action inverted input'>",
        "<input id='swapSearch' type='text' placeholder='Search' style='margin-top: 3px; padding: 2px 0px 2px 5px; border-top: 2px solid #3a3a3a; border-bottom: 2px solid #3a3a3a; font-size: 14px; background-color: transparent; color: white;' value=''></input>",
      "</div>",
      "<div style='display: flex;'>",
        "<div id='swapAll' style='width: 50%; background: black; text-align: center; border-right: 1px solid #3a3a3a; cursor: pointer; color: white;'>",
          "All",
        "</div>",
        "<div id='swapRecent' style='width: 50%; text-align: center; border-left: 1px solid #3a3a3a; cursor: pointer; color: #777;'>",
          "Recent",
        "</div>",
      "</div>",
    "</div>"
  ].join('\n');

var Swap = {
    height: 220,
    width: 180,
    MMGISInterface: null,
    currentLi: null,
    usingMissionList: null,
    shown: false,
    s: null,
    make: function (essence) {
        this.s = essence
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
}

//
function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    $('#topBarTitleIcon').off('click')
    var swap = $('#mmgisUseSwap')
        //.attr( 'class', 'mdi mdi-menu-down mdi-24px' )
        .on('click', function () {
            Swap.shown = !Swap.shown
            setSwap()
        })

    if ($('#swapContainer').length === 0) {
        var swapCont = $('<div>')
            .attr('id', 'swapContainer')
            .css({
                position: 'fixed',
                background: '#001',
                'font-family': 'roboto, sans-serif',
                'font-size': '12px',
                width: Swap.width + 'px',
                height: Swap.height + 'px',
                top: -Swap.height + 'px',
                'box-shadow': '0px 0px 3px 0px rgba(0,0,0,0.3)',
                transition: 'top 0.2s cubic-bezier(0.445, 0.05, 0.55, 0.95)',
                left: '36px',
            })
        $('#topBar').append(swapCont)

        swapCont.html(markup)

        //Add event functions and whatnot
        $('#swapSearch input').on('input', function () {
            makeMissionList(Swap.usingMissionList, $(this).val())
        })

        $('#swapAll').on('click', function () {
            makeMissionList(L_.missionsList)
            $('#swapRecent')
                .css('background', 'transparent')
                .css('color', '#777')

            $(this).css('background', 'black').css('color', 'white')
        })

        $('#swapRecent').on('click', function () {
            makeMissionList(F_.uniqueArray(L_.recentMissions))
            $('#swapAll').css('background', 'transparent').css('color', '#777')

            $(this).css('background', 'black').css('color', 'white')
        })
    }

    function setSwap() {
        if (Swap.shown) {
            makeMissionList(L_.missionsList)
            $('#swapContainer').css('top', '0')
        } else {
            $('#swapContainer').css('top', -Swap.height + 'px')
        }
    }

    function makeMissionList(missionList, filterString) {
        Swap.usingMissionList = missionList

        $('#swapMissionsList').html('')

        for (var m in missionList) {
            if (
                !filterString ||
                filterString.length === 0 ||
                missionList[m]
                    .toLowerCase()
                    .includes(filterString.toLowerCase())
            ) {
                var li = $('<li>')
                    .css({
                        cursor: 'pointer',
                        display: 'flex',
                        height: '22px',
                        overflow: 'hidden',
                        color: '#bbb',
                        transition:
                            'color 0.1s cubic-bezier(0.445, 0.05, 0.55, 0.95)',
                        'justify-content': 'flex-start',
                    })
                    .on(
                        'click',
                        (function (missionName, m) {
                            return function () {
                                Swap.currentLi.css('opacity', '0')
                                Swap.currentLi = $('#swapMission_' + m)
                                Swap.currentLi.css('opacity', '1')

                                Swap.s.swapMission(missionName)
                            }
                        })(missionList[m], m)
                    )
                    .on('mouseenter', function () {
                        $(this).css('color', 'white')
                    })
                    .on('mouseleave', function () {
                        $(this).css('color', '#bbb')
                    })

                $('#swapMissionsList').append(li)

                li.append(
                    $('<div>')
                        .attr('id', 'swapMission_' + m)
                        .css({
                            opacity: '0',
                            'font-size': '12px',
                            'line-height': '15px',
                            width: '22px',
                            height: '22px',
                            'margin-right': '3px',
                            transition:
                                'opacity 0.2s cubic-bezier(0.445, 0.05, 0.55, 0.95)',
                        })
                        .html(
                            "<i class='mdi mdi-arrow-right-box mdi-24px' style='color: white; line-height: 22px;'></i>"
                        )
                )

                li.append(
                    $('<div>')
                        .attr('id', 'swapMissionName_' + m)
                        .css({
                            'font-size': '15px',
                            'line-height': '22px',
                            flex: '1',
                            'border-bottom': '1px solid #3a3a3a',
                        })
                        .text(missionList[m])
                )

                if (L_.mission === missionList[m]) {
                    Swap.currentLi = $('#swapMission_' + m)
                    Swap.currentLi.css('opacity', '1')
                }

                //mark
                if (typeof $('#swapMissionName_' + m).markRegExp === 'function')
                    $('#swapMissionName_' + m).markRegExp(
                        new RegExp(filterString, 'i'),
                        {}
                    )
            }
        }
    }

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default Swap
