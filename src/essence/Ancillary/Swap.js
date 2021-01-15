//New Tool Template
//In the very least, each tool needs to be defined through require.js and return
// an object with 'make' and 'destroy' functions
import $ from 'jquery'
import * as d3 from 'd3'
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
    /*
    //MMGIS should always have a div with id 'tools'
    var tools = d3.select( '#tools' );
    //Clear it
    tools.selectAll( '*' ).remove();
    //Add a semantic container
    tools = tools.append( 'div' )
      .attr('class', 'ui padded grid' )
      .style( 'height', '100%' );
    //Add the markup to tools or do it manually
    tools.html( markup );
    */
    $('#topBarTitleIcon').off('click')
    var swap = d3
        .select('#mmgisUseSwap')
        //.attr( 'class', 'mdi mdi-menu-down mdi-24px' )
        .on('click', function () {
            Swap.shown = !Swap.shown
            setSwap()
        })

    if (d3.select('#swapContainer')._groups[0][0] === null) {
        var swapCont = d3
            .select('#topBar')
            .append('div')
            .attr('id', 'swapContainer')
            .style('position', 'fixed')
            .style('background', '#001')
            .style('font-family', 'roboto, sans-serif')
            .style('font-size', '12px')
            .style('width', Swap.width + 'px')
            .style('height', Swap.height + 'px')
            .style('top', -Swap.height + 'px')
            .style('box-shadow', '0px 0px 3px 0px rgba(0,0,0,0.3)')
            .style(
                'transition',
                'top 0.2s cubic-bezier(0.445, 0.05, 0.55, 0.95)'
            )
            .style('left', '36px')

        swapCont.html(markup)

        //Add event functions and whatnot
        $('#swapSearch input').on('input', function () {
            makeMissionList(Swap.usingMissionList, $(this).val())
        })

        d3.select('#swapAll').on('click', function () {
            makeMissionList(L_.missionsList)
            d3.select('#swapRecent')
                .style('background', 'transparent')
                .style('color', '#777')

            d3.select(this).style('background', 'black').style('color', 'white')
        })

        d3.select('#swapRecent').on('click', function () {
            makeMissionList(F_.uniqueArray(L_.recentMissions))
            d3.select('#swapAll')
                .style('background', 'transparent')
                .style('color', '#777')

            d3.select(this).style('background', 'black').style('color', 'white')
        })
    }

    function setSwap() {
        if (Swap.shown) {
            makeMissionList(L_.missionsList)
            d3.select('#swapContainer').style('top', '0')
        } else {
            d3.select('#swapContainer').style('top', -Swap.height + 'px')
        }
    }

    function makeMissionList(missionList, filterString) {
        Swap.usingMissionList = missionList

        d3.select('#swapMissionsList').html('')

        for (var m in missionList) {
            if (
                !filterString ||
                filterString.length === 0 ||
                missionList[m]
                    .toLowerCase()
                    .includes(filterString.toLowerCase())
            ) {
                var li = d3
                    .select('#swapMissionsList')
                    .append('li')
                    .style('cursor', 'pointer')
                    .style('display', 'flex')
                    .style('height', '22px')
                    .style('overflow', 'hidden')
                    .style('color', '#bbb')
                    .style(
                        'transition',
                        'color 0.1s cubic-bezier(0.445, 0.05, 0.55, 0.95)'
                    )
                    .style('justify-content', 'flex-start')
                    .on(
                        'click',
                        (function (missionName, m) {
                            return function () {
                                Swap.currentLi.style('opacity', '0')
                                Swap.currentLi = d3.select('#swapMission_' + m)
                                Swap.currentLi.style('opacity', '1')

                                Swap.s.swapMission(missionName)
                            }
                        })(missionList[m], m)
                    )
                    .on('mouseenter', function () {
                        d3.select(this).style('color', 'white')
                    })
                    .on('mouseleave', function () {
                        d3.select(this).style('color', '#bbb')
                    })

                li.append('div')
                    .attr('id', 'swapMission_' + m)
                    .style('opacity', '0')
                    .style('font-size', '12px')
                    .style('line-height', '15px')
                    .style('width', '22px')
                    .style('height', '22px')
                    .style('margin-right', '3px')
                    .style(
                        'transition',
                        'opacity 0.2s cubic-bezier(0.445, 0.05, 0.55, 0.95)'
                    )
                    .html(
                        "<i class='mdi mdi-arrow-right-box mdi-24px' style='color: white; line-height: 22px;'></i>"
                    )

                li.append('div')
                    .attr('id', 'swapMissionName_' + m)
                    .style('font-size', '15px')
                    .style('line-height', '22px')
                    .style('flex', '1')
                    .style('border-bottom', '1px solid #3a3a3a')
                    .text(missionList[m])

                if (L_.mission === missionList[m]) {
                    Swap.currentLi = d3.select('#swapMission_' + m)
                    Swap.currentLi.style('opacity', '1')
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
