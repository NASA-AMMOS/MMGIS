import s from '../essence'
import $ from 'jquery'
import * as d3 from 'd3'
import QueryURL from '../Ancillary/QueryURL'
import calls from '../../pre/calls'
import { mmgisAPI_ } from '../mmgisAPI/mmgisAPI'
import attributions from '../../external/attributions'

import './LandingPage.css'

export default {
    init: function (missions, forceError, forceConfig) {
        if (forceError) {
            makeMissionNotFoundDiv()
            return
        }

        // Skip loading the landing page if the preview mode is controlling the config
        if (QueryURL.getSingleQueryVariable('_preview')) {
            if (typeof mmgisAPI_.onLoadCallback === 'function') {
                mmgisAPI_.onLoadCallback()
                mmgisAPI_.onLoadCallback = null
            }
            return
        }

        var missionUrl
        var forceLanding =
            QueryURL.getSingleQueryVariable('forcelanding') || false

        if (!forceConfig) {
            missionUrl = QueryURL.checkIfMission()

            //If there's only one mission, go straight to it
            if (missions.length == 1 && !forceLanding) missionUrl = missions[0]
        }

        if (
            missionUrl == false &&
            !forceLanding &&
            mmgisglobal.MAIN_MISSION != null &&
            mmgisglobal.MAIN_MISSION != '' &&
            mmgisglobal.MAIN_MISSION != 'undefined' &&
            typeof mmgisglobal.MAIN_MISSION === 'string' &&
            mmgisglobal.MAIN_MISSION.length > 0
        ) {
            missionUrl = mmgisglobal.MAIN_MISSION
        }

        if (missionUrl == false && !forceConfig) {
            var background = d3
                .select('body')
                .append('div')
                .attr('class', 'landingPage')
                .style('position', 'absolute')
                .style('top', '0')
                .style('left', '0')
                .style('width', '100%')
                .style('height', '100%')

            background.append('div').attr('class', 'gradient')

            let bottom = background.append('div').attr('class', 'landingBottom')
            var imageCredit = bottom.append('div').attr('class', 'imagecredit')
            imageCredit.append('div').text('Wind at Work')
            imageCredit
                .append('a')
                .attr('target', '__blank')
                .attr('rel', 'noreferrer')
                .attr(
                    'href',
                    'https://photojournal.jpl.nasa.gov/catalog/PIA20461' //Wind at Work
                )
                .attr(
                    'title',
                    'Splash Image Credit: NASA/JPL-Caltech/Univ. of Arizona'
                )
                .append('i')
                .attr('class', 'mdi mdi-information-outline mdi-14px')

            bottom
                .append('div')
                .attr('class', 'version')
                .style('cursor', 'pointer')
                .text(`v${window.mmgisglobal.version}`)

            $('.version').on('click', function () {
                window.location.href = `https://github.com/NASA-AMMOS/MMGIS/releases/tag/${window.mmgisglobal.version}`
            })

            if (
                window.mmgisglobal.CLEARANCE_NUMBER &&
                window.mmgisglobal.CLEARANCE_NUMBER != 'undefined'
            ) {
                bottom
                    .append('div')
                    .attr('class', 'clearance')
                    .text(window.mmgisglobal.CLEARANCE_NUMBER)
            }

            var mainDiv = background
                .append('div')
                .style('position', 'absolute')
                .style('top', '40%')
                .style('left', '50%')
                .style('transform', 'translate(-50%, -50%)')

            var mmgisLogoURL = 'public/images/logos/mmgis.png'
            var titleDiv = background
                .append('div')
                .attr('id', 'title')
                .style('z-index', '200')
                .append('p')
                .attr('class', 'unselectable')
                .style('font-size', '40px')
                .style('opacity', '1')
                //.style( 'text-shadow', '0px 4px white' )
                .style('cursor', 'default')
                .style('padding', '0px 10px')
                .html("<img src='" + mmgisLogoURL + "' alt='Full logo'/>")
            background.append('div').attr('id', 'landingPanel')

            var missionsDiv = background
                .append('div')
                .attr('id', 'landingMissionsWrapper')
            //.style( 'background-color', '#222526' )
            //.style( 'box-shadow', 'inset 0px 0px 10px #000' );
            var missionsUl = missionsDiv
                .append('ul')
                .style('margin', '0')
                .style('padding', '0')
                .style('height', 'calc( 100vh - 200px)')
                .style('overflow-y', 'auto')
                .style('padding-right', '20px')
            for (let m in missions) {
                missionsUl
                    .append('li')
                    .attr('class', 'landingPageMission')
                    .html(missions[m])
                    .on('click', function () {
                        var missionName = d3.select(this).html()
                        $('.landingPage').animate(
                            {
                                opacity: 0,
                            },
                            1000,
                            function () {
                                $(this).remove()
                                //Load the config file and initialize
                                if (window.mmgisglobal.SERVER == 'node') {
                                    calls.api(
                                        'get',
                                        {
                                            mission: missionName,
                                        },
                                        function (data) {
                                            s.init(data, missions)
                                        },
                                        function (e) {
                                            console.log(
                                                "Warning: Couldn't load: " +
                                                    missionName +
                                                    ' configuration.'
                                            )
                                            makeMissionNotFoundDiv()
                                        }
                                    )
                                } else {
                                    $.getJSON(
                                        'Missions/' +
                                            missionName +
                                            '/' +
                                            'config.json' +
                                            '?nocache=' +
                                            new Date().getTime(),
                                        function (data) {
                                            //Initialize
                                            s.init(data, missions)
                                        }
                                    ).fail(function () {
                                        console.log(
                                            "Warning: Couldn't load: " +
                                                'Missions/' +
                                                missionName +
                                                '/' +
                                                'config.json'
                                        )
                                        makeMissionNotFoundDiv()
                                    })
                                }
                            }
                        )
                    })
            }
            $('.landingPage').animate(
                {
                    opacity: 1,
                },
                1000
            )

            if (window.mmgisglobal.NODE_ENV == 'development') {
                var configIcon = background
                    .append('div')
                    .attr('id', 'configIcon')
                    .attr('class', 'mdi mdi-tune mdi-24px')
                    .attr('title', 'Configure')

                $('#configIcon').on('click', function () {
                    if (window.mmgisglobal.SERVER === 'node')
                        window.location.href =
                            window.location.href.split('?')[0] + 'configure'
                    else
                        window.location.href =
                            window.location.href.split('?')[0] + 'config'
                })

                var docsIcon = background
                    .append('div')
                    .attr('id', 'docsIcon')
                    .attr('class', 'mdi mdi-book-open mdi-24px')
                    .attr('title', 'Documentation')

                $('#docsIcon').on('click', function () {
                    window.location.href = 'https://nasa-ammos.github.io/MMGIS/'
                    //window.location.href.split('?')[0] + 'docs'
                })
            }

            //Attributions
            var attributionIcon = background
                .append('div')
                .attr('id', 'attributionIcon')
                .attr('class', 'mdi mdi-dna mdi-24px')
                .attr('title', 'Attributions')

            // prettier-ignore
            var markupAttributions = [
                    "<div id='attributions'>",
                        "<div id='attributionsContent'>",
                            "<div id='attributionsTitle'>",
                                '<div>',
                                    "<a class='attributionTitle_library' href='' target='_blank' rel='noreferrer'><img src='" + mmgisLogoURL + "' alt='Full logo' height='20px' alt='MMGIS logo'/></a>",
                                    "<div class='attributionTitle_version'>v" +
                                        window.mmgisglobal.version +
                                    '</div>',
                                    '</div>',
                                    '<div>',
                                    "<div class='attributionTitle_by'></div>",
                                    "<a class='attributionTitle_author' href='' target='_blank' rel='noreferrer'>NASA/JPL-Caltech</a>",
                                    "<div class='attributionTitle_under'>, under</div>",
                                    "<a class='attributionTitle_license' href='https://www.apache.org/licenses/LICENSE-2.0' target='_blank' rel='noreferrer'>" +
                                        'Apache-2.0' +
                                    '</a>',
                                    "<a class='attributionTitle_github mdi mdi-github-circle mdi-36px' href='https://github.com/NASA-AMMOS/MMGIS' target='_blank' rel='noreferrer'></a>",
                                '</div>',
                            '</div>',
                            '<ul>',
                            '</ul>',
                        '</div>',
                    '</div>',
                ].join('\n')
            $('.landingPage').append(markupAttributions)
            var attributionList = $('#attributions ul')
            for (var i = 0; i < attributions.length; i++) {
                var a = attributions[i]

                // prettier-ignore
                var markupAttribution = [
                        '<li>',
                            '<div>',
                                "<a class='attribution_library' href='" +
                                    a.librarylink +
                                    "' target='_blank' rel='noreferrer'>" +
                                    a.library +
                                    '</a>',
                                "<div class='attribution_version'>v" +
                                    a.version +
                                    '</div>',
                                '</div>',
                                '<div>',
                                "<div class='attribution_by'>by</div>",
                                "<a class='attribution_author' href='" +
                                    a.authorlink +
                                    "' target='_blank' rel='noreferrer'>" +
                                    a.author +
                                    '</a>',
                                "<div class='attribution_under'>, under</div>",
                                "<a class='attribution_license' href='" +
                                    a.licenselink +
                                    "' target='_blank' rel='noreferrer'>" +
                                    a.license +
                                    '</a>',
                                "<a class='attribution_github mdi mdi-github-circle mdi-18px' href='" +
                                    a.githublink +
                                    "' target='_blank' rel='noreferrer'></a>",
                            '</div>',
                        '</li>',
                    ].join('\n')

                attributionList.append(markupAttribution)
            }
            attributionList.append(
                '<li>And to all the node packages within package.json and a special thanks to every contributor.</li>'
            )

            $('#attributionIcon').on('click', function () {
                $('#attributions').toggleClass('active')
            })
        } else {
            //Load the config file and initialize
            var jsonUrl = 'Missions/' + missionUrl + '/' + 'config.json'
            if (forceConfig) {
                jsonUrl = forceConfig
                $.getJSON(
                    jsonUrl + '?nocache=' + new Date().getTime(),
                    function (data) {
                        //Initialize
                        s.init(data, missions)
                    }
                ).fail(function () {
                    console.error(
                        "Error: Couldn't load: " + jsonUrl + ' configuration.'
                    )
                    makeMissionNotFoundDiv()
                })
            } else {
                if (window.mmgisglobal.SERVER == 'node') {
                    calls.api(
                        'get',
                        {
                            mission: missionUrl,
                        },
                        function (data) {
                            s.init(data, missions)
                        },
                        function (e) {
                            console.error(
                                "Error: Couldn't load: " +
                                    missionUrl +
                                    ' configuration.'
                            )
                            makeMissionNotFoundDiv()
                        }
                    )
                } else {
                    $.getJSON(
                        jsonUrl + '?nocache=' + new Date().getTime(),
                        function (data) {
                            //Initialize
                            s.init(data, missions)
                        }
                    ).fail(function () {
                        console.warn("Warning: Couldn't load: " + jsonUrl)
                        makeMissionNotFoundDiv()
                    })
                }
            }
        }
    },
}

export const makeMissionNotFoundDiv = () => {
    var notfounddiv = d3
        .select('body')
        .append('div')
        .attr('id', 'notfound')
        .style('position', 'absolute')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100%')
        .style('height', '100%')
        .style('background', '#efefef')
        .style('color', '#757575')
        .style('opacity', 0)
        .style('cursor', 'pointer')
        .style('z-index', 1000)
        .on('click', function () {
            document.location.href = window.location.href.split('?')[0]
        })

    notfounddiv
        .append('p')
        .attr('id', 'mnfmmgis')
        .style('font-family', 'lato')
        .style('font-size', '20px')
        .style('margin', '90px 0')
        .style('text-align', 'center')
        .style('position', 'absolute')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translateX(-50%)')
        .text(window.mmgisglobal.name || 'MMGIS')

    notfounddiv
        .append('p')
        .attr('id', 'returnmmgis')
        .style('font-family', 'lato')
        .style('font-size', '14px')
        .style('margin', '125px 0 90px 0')
        .style('text-align', 'center')
        .style('position', 'absolute')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translateX(-50%)')
        .text('Click anywhere to return home...')

    notfounddiv
        .append('div')
        .attr('id', 'nf404')
        .style('font-family', 'monospace')
        .style('font-size', '200px')
        .style('margin-top', '5px')
        .style('position', 'absolute')
        .style('top', '50%')
        .style('left', '50%')
        .style('transform', 'translateX(-50%) translateY(-50%)')
        .style('color', 'var(--color-b)')
        .html('404')

    $('#notfound').animate(
        {
            opacity: 1,
        },
        1500
    )
}
