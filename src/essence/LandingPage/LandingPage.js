import s from '../essence'
import $ from 'jquery'
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
            var background = $('<div>')
                .attr('class', 'landingPage')
                .css({
                    'position': 'absolute',
                    'top': '0',
                    'left': '0',
                    'width': '100%',
                    'height': '100%'
                })
            $('body').append(background)

            background.append($('<div>').attr('class', 'gradient'))

            let bottom = $('<div>').attr('class', 'landingBottom')
            background.append(bottom)
            var imageCredit = $('<div>').attr('class', 'imagecredit')
            bottom.append(imageCredit)
            imageCredit.append($('<div>').text('Wind at Work'))
            const imageCreditLink = $('<a>')
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
            imageCreditLink.append($('<i>').attr('class', 'mdi mdi-information-outline mdi-14px'))
            imageCredit.append(imageCreditLink)

            bottom
                .append($('<div>')
                .attr('class', 'version')
                .css('cursor', 'pointer')
                .text(`v${window.mmgisglobal.version}`))

            $('.version').on('click', function () {
                window.location.href = `https://github.com/NASA-AMMOS/MMGIS/releases/tag/${window.mmgisglobal.version}`
            })

            if (
                window.mmgisglobal.CLEARANCE_NUMBER &&
                window.mmgisglobal.CLEARANCE_NUMBER != 'undefined'
            ) {
                bottom
                    .append($('<div>')
                    .attr('class', 'clearance')
                    .text(window.mmgisglobal.CLEARANCE_NUMBER))
            }

            var mainDiv = $('<div>')
                .css({
                    'position': 'absolute',
                    'top': '40%',
                    'left': '50%',
                    'transform': 'translate(-50%, -50%)'
                })
            background.append(mainDiv)

            var mmgisLogoURL = 'public/images/logos/mmgis.png'
            var titleDiv = $('<div>')
                .attr('id', 'title')
                .css('z-index', '200')
            const titleP = $('<p>')
                .attr('class', 'unselectable')
                .css({
                    'font-size': '40px',
                    'opacity': '1',
                    'cursor': 'default',
                    'padding': '0px 10px'
                })
                //.css( 'text-shadow', '0px 4px white' )
                .html("<img src='" + mmgisLogoURL + "' alt='Full logo'/>")
            titleDiv.append(titleP)
            background.append(titleDiv)
            background.append($('<div>').attr('id', 'landingPanel'))

            var missionsDiv = $('<div>')
                .attr('id', 'landingMissionsWrapper')
            background.append(missionsDiv)
            //.css( 'background-color', '#222526' )
            //.css( 'box-shadow', 'inset 0px 0px 10px #000' );
            var missionsUl = $('<ul>')
                .css({
                    'margin': '0',
                    'padding': '0',
                    'height': 'calc( 100vh - 200px)',
                    'overflow-y': 'auto',
                    'padding-right': '20px'
                })
            missionsDiv.append(missionsUl)
            for (let m in missions) {
                const missionLi = $('<li>')
                    .attr('class', 'landingPageMission')
                    .html(missions[m])
                    .on('click', function () {
                        var missionName = $(this).html()
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
                                            full: true,
                                        },
                                        function (response) {
                                            // Extract DB mission name and attach to config
                                            const config = response.config || response
                                            if (response.mission) {
                                                config._dbMissionName = response.mission
                                            }
                                            s.init(config, missions)
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
                missionsUl.append(missionLi)
            }
            $('.landingPage').animate(
                {
                    opacity: 1,
                },
                1000
            )

            if (window.mmgisglobal.NODE_ENV == 'development') {
                var configIcon = $('<div>')
                    .attr('id', 'configIcon')
                    .attr('class', 'mdi mdi-tune mdi-24px')
                    .attr('title', 'Configure')
                background.append(configIcon)

                $('#configIcon').on('click', function () {
                    if (window.mmgisglobal.SERVER === 'node')
                        window.location.href =
                            window.location.href.split('?')[0] + 'configure'
                    else
                        window.location.href =
                            window.location.href.split('?')[0] + 'config'
                })

                var docsIcon = $('<div>')
                    .attr('id', 'docsIcon')
                    .attr('class', 'mdi mdi-book-open mdi-24px')
                    .attr('title', 'Documentation')
                background.append(docsIcon)

                $('#docsIcon').on('click', function () {
                    window.location.href = 'https://nasa-ammos.github.io/MMGIS/'
                    //window.location.href.split('?')[0] + 'docs'
                })
            }

            //Attributions
            var attributionIcon = $('<div>')
                .attr('id', 'attributionIcon')
                .attr('class', 'mdi mdi-dna mdi-24px')
                .attr('title', 'Attributions')
            background.append(attributionIcon)

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
                            full: true,
                        },
                        function (response) {
                            // Extract DB mission name and attach to config
                            const config = response.config || response
                            if (response.mission) {
                                config._dbMissionName = response.mission
                            }
                            s.init(config, missions)
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
    var notfounddiv = $('<div>')
        .attr('id', 'notfound')
        .css({
            'position': 'absolute',
            'top': '0',
            'left': '0',
            'width': '100%',
            'height': '100%',
            'background': '#efefef',
            'color': '#757575',
            'opacity': 0,
            'cursor': 'pointer',
            'z-index': 1000
        })
        .on('click', function () {
            document.location.href = window.location.href.split('?')[0]
        })
    $('body').append(notfounddiv)

    notfounddiv
        .append($('<p>')
        .attr('id', 'mnfmmgis')
        .css({
            'font-family': 'lato',
            'font-size': '20px',
            'margin': '90px 0',
            'text-align': 'center',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'transform': 'translateX(-50%)'
        })
        .text(window.mmgisglobal.name || 'MMGIS'))

    notfounddiv
        .append($('<p>')
        .attr('id', 'returnmmgis')
        .css({
            'font-family': 'lato',
            'font-size': '14px',
            'margin': '125px 0 90px 0',
            'text-align': 'center',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'transform': 'translateX(-50%)'
        })
        .text('Click anywhere to return home...'))

    notfounddiv
        .append($('<div>')
        .attr('id', 'nf404')
        .css({
            'font-family': 'monospace',
            'font-size': '200px',
            'margin-top': '5px',
            'position': 'absolute',
            'top': '50%',
            'left': '50%',
            'transform': 'translateX(-50%) translateY(-50%)',
            'color': 'var(--color-b)'
        })
        .html('404'))

    $('#notfound').animate(
        {
            opacity: 1,
        },
        1500
    )
}
