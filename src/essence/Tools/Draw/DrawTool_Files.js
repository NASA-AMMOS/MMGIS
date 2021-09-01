import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Modal from '../../Ancillary/Modal'

import '../../../external/JQuery/jquery.autocomplete'

var DrawTool = null
var Files = {
    init: function (tool) {
        DrawTool = tool
        DrawTool.populateFiles = Files.populateFiles
        DrawTool.refreshFile = Files.refreshFile
        DrawTool.toggleFile = Files.toggleFile
        DrawTool.toggleLabels = Files.toggleLabels
        DrawTool.maintainLayerOrder = Files.maintainLayerOrder
        DrawTool.removePopupsFromLayer = Files.removePopupsFromLayer
        DrawTool.refreshNoteEvents = Files.refreshNoteEvents
        DrawTool.refreshMasterCheckbox = Files.refreshMasterCheckbox
    },
    prevFilterString: '',
    populateFiles: function () {
        $('#drawToolDrawFilesListMaster *').remove()
        $('#drawToolDrawFilesList *').remove()

        for (var i = 0; i < DrawTool.files.length; i++) {
            addFileToList(DrawTool.files[i])
        }

        //Master Header
        $('.drawToolMasterHeaderLeftLeft').off('click')
        $('.drawToolMasterHeaderLeftLeft').on('click', function () {
            $('#drawToolDrawFilesListMaster').toggleClass('active')
            var isActive = $('#drawToolDrawFilesListMaster').hasClass('active')
            if (isActive) {
                $('.drawToolMasterHeaderLeftLeft i').removeClass(
                    'mdi-chevron-right'
                )
                $('.drawToolMasterHeaderLeftLeft i').addClass(
                    'mdi-chevron-down'
                )
            } else {
                $('.drawToolMasterHeaderLeftLeft i').removeClass(
                    'mdi-chevron-down'
                )
                $('.drawToolMasterHeaderLeftLeft i').addClass(
                    'mdi-chevron-right'
                )
            }
        })
        $('.drawToolFileMasterCheckbox').off('click')
        $('.drawToolFileMasterCheckbox').on('click', function () {
            $('.drawToolFileMasterCheckbox').toggleClass('on')
            var isActive = $('.drawToolFileMasterCheckbox').hasClass('on')
            if (isActive) {
                //Turn on all master files
                for (var f in DrawTool.files) {
                    var id = DrawTool.files[f].id
                    if (
                        DrawTool.files[f].is_master &&
                        DrawTool.filesOn.indexOf(id) == -1
                    ) {
                        DrawTool.toggleFile(id)
                        $(
                            '.drawToolFileCheckbox[file_id="' + id + '" ]'
                        ).addClass('on')
                    }
                }
            } else {
                //Turn off all master files
                for (var f in DrawTool.files) {
                    var id = DrawTool.files[f].id
                    if (
                        DrawTool.files[f].is_master &&
                        DrawTool.filesOn.indexOf(id) != -1
                    ) {
                        DrawTool.toggleFile(id)
                        $(
                            '.drawToolFileCheckbox[file_id="' + id + '" ]'
                        ).removeClass('on')
                    }
                }
            }
        })

        //Draw type
        $('#drawToolDrawingTypeDiv > div').off('click')
        $('#drawToolDrawingTypeDiv > div').on('click', function (e) {
            if (DrawTool.intentType == 'all') {
                $('#drawToolDrawingTypeDiv > div').removeClass('active')
                $('#drawToolDrawingTypeDiv > div').css('border-radius', 0)
                $('#drawToolDrawingTypeDiv > div').css(
                    'background',
                    'var(--color-a)'
                )
                $(this).addClass('active')
                $(this).css(
                    'background',
                    $('#drawToolDrawingTypeDiv').css('background')
                )

                DrawTool.setDrawingType($(this).attr('draw'))
            }
        })

        //Filter
        let keepFocus = false
        $('#drawToolDrawFilterByTag').off('click')
        $('#drawToolDrawFilterByTag').on('click', function (e) {
            const currentFilterString = $('#drawToolDrawFilter').val()
            const newFilterString =
                currentFilterString +
                (currentFilterString.length !== 0 &&
                currentFilterString[currentFilterString.length - 1] !== ' '
                    ? ' #'
                    : '#')
            if (
                currentFilterString.length === 0 ||
                currentFilterString[currentFilterString.length - 1] !== '#'
            )
                $('#drawToolDrawFilter').val(newFilterString)
            $('#drawToolDrawFilter').focus()
        })
        $('#drawToolDrawFilterClear').off('click')
        $('#drawToolDrawFilterClear').on('click', function () {
            $('#drawToolDrawFilter').val('')
            fileFilter()
        })
        $('#drawToolDrawFilter').off('input')
        $('#drawToolDrawFilter').on('input', fileFilter)
        $('#drawToolDrawSortDiv > div').off('click')
        $('#drawToolDrawSortDiv > div').on('click', function () {
            $(this).toggleClass('active')
            fileFilter()
        })
        $('#drawToolDrawFilter').off('keydown')
        $('#drawToolDrawFilter').on('keydown', function (e) {
            if (e.which === 13)
                // Enter key
                $(this).blur()
        })
        $('#drawToolDrawFilter').off('focus')
        $('#drawToolDrawFilter').on('focus', function () {
            const currentFilterString = $('#drawToolDrawFilter').val()
            // Just care about the last #string without the #
            let tagFilterString = currentFilterString.split(' ')
            tagFilterString = tagFilterString[tagFilterString.length - 1]

            if (
                tagFilterString[0] === '#' &&
                currentFilterString[currentFilterString.length - 1] != ' '
            ) {
                tagFilterString = tagFilterString.substring(1)

                let sortedTags = JSON.parse(JSON.stringify(DrawTool.tags))
                switch ($('#drawToolDrawFilterByTagAutocompleteSort').val()) {
                    case 'alphabetical':
                        sortedTags = sortedTags.sort((a, b) =>
                            a.localeCompare(b)
                        )
                        break
                    case 'count':
                        sortedTags = Object.keys(DrawTool.allTags)
                            .map((t) => {
                                return { tag: t, count: DrawTool.allTags[t] }
                            })
                            .sort((a, b) => b.count - a.count)
                            .map((t) => t.tag)
                        break
                    default:
                        break
                }
                sortedTags = sortedTags.filter(
                    (t) => tagFilterString === '' || t.includes(tagFilterString)
                )

                $('#drawToolDrawFilterByTagAutocompleteList').html(
                    sortedTags
                        .map(
                            (tag) =>
                                `<li tag='${tag}' class='${
                                    DrawTool.vars.preferredTags &&
                                    DrawTool.vars.preferredTags.includes(tag)
                                        ? 'pinned'
                                        : ''
                                }'><div>${tag}${
                                    DrawTool.vars.preferredTags &&
                                    DrawTool.vars.preferredTags.includes(tag)
                                        ? "<div class='drawToolDrawFilterByTagAutocompleteLiPin'><i class='mdi mdi-pin mdi-14px'></i></div>"
                                        : ''
                                }</div><div>(${
                                    DrawTool.allTags[tag]
                                })</div></li>`
                        )
                        .join('\n')
                )
                $('#drawToolDrawFilterByTagAutocomplete li').on(
                    'mousedown',
                    function () {
                        const clickedTag = $(this).attr('tag')
                        let value = $('#drawToolDrawFilter').val()
                        value = value.split(' ')
                        value.pop()
                        value.push('#' + clickedTag)
                        value = value.join(' ')
                        $('#drawToolDrawFilter').val(value)
                        $('#drawToolDrawFilter').blur()
                        fileFilter()
                    }
                )
                $('#drawToolDrawFilterByTagAutocomplete').css({
                    display: 'flex',
                    height: `calc(100vh - ${
                        $('#drawToolDrawFilterDiv2').position().top + 70
                    }px)`,
                })
            }
        })
        $('#drawToolDrawFilter').off('blur')
        $('#drawToolDrawFilter').on('blur', function () {
            if (!keepFocus) {
                $('#drawToolDrawFilterByTagAutocomplete').css({
                    display: 'none',
                })
                // Remove final # if any
                let value = $('#drawToolDrawFilter').val()
                if (value[value.length - 1] == '#') value = value.slice(0, -1)
                $('#drawToolDrawFilter').val(value)
            }
        })
        $('#drawToolDrawFilterByTagAutocompleteSort').off('mousedown')
        $('#drawToolDrawFilterByTagAutocompleteSort').on(
            'mousedown',
            function () {
                keepFocus = true
                $('#drawToolDrawFilterByTagAutocomplete').css({
                    display: 'flex',
                    height: `calc(100vh - ${
                        $('#drawToolDrawFilterDiv2').position().top + 70
                    }px)`,
                })
            }
        )
        $('#drawToolDrawFilterByTagAutocompleteSort').off('input')
        $('#drawToolDrawFilterByTagAutocompleteSort').on('input', function () {
            keepFocus = false
            $('#drawToolDrawFilter').focus()
        })
        $('.drawToolFilterDropdown li').off('click')
        $('.drawToolFilterDropdown li').on('click', function () {
            $(this).toggleClass('active')
            $(this).find('.drawToolFilterCheckbox').toggleClass('on')
            fileFilter()
        })
        $('#drawToolDrawIntentFilterDiv > div').off('mouseenter')
        $('#drawToolDrawIntentFilterDiv > div').on('mouseenter', function () {
            var that = this
            clearTimeout(DrawTool.tooltipTimeout1)
            DrawTool.tooltipTimeout1 = setTimeout(function () {
                $('#drawToolDrawFilterDivToolTip').css(
                    'background',
                    DrawTool.categoryStyles[$(that).attr('intent')].color
                )
                $('#drawToolDrawFilterDivToolTip').addClass('active')
                $('#drawToolDrawFilterDivToolTip').text($(that).attr('tooltip'))
            }, 500)
        })
        $('#drawToolDrawIntentFilterDiv > div').off('mouseleave')
        $('#drawToolDrawIntentFilterDiv > div').on('mouseleave', function () {
            clearTimeout(DrawTool.tooltipTimeout1)
            $('#drawToolDrawFilterDivToolTip').css(
                'background',
                'rgba(255,255,255,0)'
            )
            $('#drawToolDrawFilterDivToolTip').removeClass('active')
            $('#drawToolDrawFilterDivToolTip').text('')
        })

        fileFilter()
        function fileFilter() {
            //filter over name, intent, id, description and keywords for now
            var on = 0
            var off = 0

            var string = $('#drawToolDrawFilter').val()
            if (string != null && string != '') string = string.toLowerCase()
            string = string.trim()
            string = string.split(' ')
            // ignore empty tags
            string = string.filter((s) => s != '#')
            const tags = string.filter((s) => s.length > 1 && s[0] === '#')

            var intents = []
            $('.drawToolFilterDropdown .active').each(function () {
                intents.push($(this).attr('intent'))
            })

            var sorts = []
            $('#drawToolDrawSortDiv .active').each(function () {
                sorts.push($(this).attr('type'))
            })

            $('.drawToolDrawFilesListElem').each(function () {
                var fileId = parseInt($(this).attr('file_id'))
                var file = F_.objectArrayIndexOfKeyWithValue(
                    DrawTool.files,
                    'id',
                    parseInt(fileId)
                )
                if (file != null) file = DrawTool.files[file]
                const fileNameLower = $(this).attr('file_name').toLowerCase()
                const fileOwnerLower = $(this).attr('file_owner').toLowerCase()
                let fileDescLower = ''
                if (file)
                    fileDescLower = file.file_description
                        .toLowerCase()
                        .split(' ')

                var show = false
                if (
                    (string.length === 0 ||
                        string.some((s) => fileNameLower.includes(s)) ||
                        string.some((s) => fileOwnerLower.includes(s)) ||
                        (fileDescLower &&
                            string.some(
                                (s) => s[0] != '#' && fileDescLower.includes(s)
                            )) ||
                        (fileDescLower &&
                            tags.length > 0 &&
                            tags.every((t) => fileDescLower.includes(t)))) &&
                    (sorts.indexOf('on') == -1 ||
                        DrawTool.filesOn.indexOf(fileId) != -1) &&
                    (sorts.indexOf('owned') == -1 ||
                        (file != null &&
                            file.file_owner === mmgisglobal.user)) &&
                    (sorts.indexOf('public') == -1 ||
                        (file != null && file.public == '1')) &&
                    (intents.length == 0 ||
                        (file != null && intents.indexOf(file.intent) != -1))
                )
                    show = true

                if (file.is_master) show = true

                if (show) {
                    $(this).css('opacity', 1)
                    $(this).css('height', '30px')
                    $(this).css(
                        'border-bottom',
                        '1px solid rgba(171, 171, 171, 0.25);'
                    )
                    on++
                } else {
                    $(this).css('opacity', 0)
                    $(this).css('height', '0px')
                    $(this).css('border-bottom', 'none')
                    off++
                }
            })

            $('#drawToolDrawFilterCount').text(on + '/' + (on + off))
            $('#drawToolDrawFilterCount').css('padding-right', '7px')

            const string2 = $('#drawToolDrawFilter').val()
            if (
                (string2 == '' || string2[string2.length - 1] == ' ') &&
                $('#drawToolDrawFilterByTagAutocomplete').css('display') !=
                    'none'
            )
                $('#drawToolDrawFilter').blur()
            else if (Files.prevFilterString != string2)
                $('#drawToolDrawFilter').focus()

            Files.prevFilterString = string2
        }

        function addFileToList(file) {
            var checkState = '-blank-outline'
            var onState = ' on'
            var shieldState = ''
            var ownedByUser = false

            if (DrawTool.currentFileId == file.id) checkState = '-intermediate'

            if (DrawTool.filesOn.indexOf(file.id) == -1) onState = ''

            if (file.public == 1) shieldState = '-outline'

            if (
                mmgisglobal.user == file.file_owner ||
                (file.file_owner_group &&
                    F_.diff(file.file_owner_group, DrawTool.userGroups).length >
                        0)
            )
                ownedByUser = true

            // prettier-ignore
            var markup = [
                    "<div class='flexbetween' style='height: 30px; line-height: 30px;'>",
                        "<div class='drawToolFileSelector flexbetween' file_id='" + file.id + "' file_owner='" + file.file_owner + "' file_intent='" + file.intent + "'>",
                        "<div class='drawToolIntentColor' style='height: 100%; width: 7px; background: " + DrawTool.categoryStyles[file.intent].color + "'></div>",
                        "<div class='drawToolFileInfo flexbetween'>",
                            `<div class='drawToolFileName' title='${file.file_name}\nIntent: ${file.intent}\nAuthor: ${file.file_owner}\nSelect to draw in,\nInfo button for information,\nCheck-box to toggle on,\nRight-Click for actions'>${file.file_name}</div>`,
                        "</div>",
                        "</div>",
                        "<div class='flexbetween'>",
                            "<div class='flexbetween'>",
                                "<i title='Private' class='drawToolFilePublicity mdi mdi-shield" + shieldState + " mdi-18px' style='display: " + ((shieldState == '') ? 'inherit' : 'none') + "'></i>",
                                "<i title='Owned by you!' class='drawToolFileOwner mdi" + ( (ownedByUser) ? ((file.is_master) ? ' mdi-account-tie' : ' mdi-account') : '' ) + " mdi-18px " + ( (ownedByUser) ? 'alwaysShow' : '' )  + "' style='display: " + ( (ownedByUser) ? 'inherit' : 'none' ) + "' file_id='" + file.id + "'></i>",
                            "</div>",
                            (!file.is_master) ? "<i class='drawToolFileEdit mdi mdi-information-outline mdi-18px' file_id='" + file.id + "'></i>" : '',
                            "<div class='drawToolFileCheckbox" + onState + "' file_id='" + file.id + "'></div>",
                        "</div>",
                    "</div>",
                    ].join('\n');
            if (file.is_master) {
                d3.select('#drawToolDrawFilesListMaster')
                    .append('li')
                    .attr('class', 'drawToolDrawFilesListElem')
                    .attr('file_id', file.id)
                    .attr('file_name', file.file_name)
                    .attr('file_owner', file.file_owner)
                    .html(markup)

                var lastMasterName = $(
                    '#drawToolDrawFilesListMaster li:last-child .drawToolFileName'
                ).text()
                $(
                    '#drawToolDrawFilesListMaster li:last-child .drawToolFileName'
                ).text(
                    DrawTool.intentNameMapping[lastMasterName.toLowerCase()]
                        ? DrawTool.intentNameMapping[
                              lastMasterName.toLowerCase()
                          ] + 's'
                        : lastMasterName
                )
            } else {
                d3.select('#drawToolDrawFilesList')
                    .append('li')
                    .attr('class', 'drawToolDrawFilesListElem')
                    .attr('file_id', file.id)
                    .attr('file_name', file.file_name)
                    .attr('file_owner', file.file_owner)
                    .html(markup)
            }
        }

        $('.drawToolDrawFilesListElem').on('mouseout', function () {
            clearTimeout(DrawTool.fileTooltipTimeout)
            clearTimeout(DrawTool.fileTooltipTimeout2)
            $('.drawToolFileDescriptionTooltip').removeClass('active')
        })

        //Li Elem Context Menu
        $('#drawToolDrawPublished').off('contextmenu')
        $('.drawToolDrawFilesListElem, #drawToolDrawPublished').on(
            'contextmenu',
            function (e) {
                e.preventDefault()
                var elm = $(this)
                var isPub = elm.attr('id') === 'drawToolDrawPublished'
                hideContextMenu(true)
                elm.css('background', '#e8e8e8')
                elm.find('.drawToolIntentColor').css({
                    width: '17px',
                })
                var rect = $(this).get(0).getBoundingClientRect()

                var markup = [
                    "<div id='drawToolDrawFilesListElemContextMenu' style='top: " +
                        (rect.y + rect.height - 1) +
                        'px; left: ' +
                        40 +
                        'px; width: ' +
                        rect.width +
                        "px; z-index: 2000; font-size: 14px;'>",
                    '<ul>',
                    "<li id='cmExportGeoJSON'>Export as .geojson</li>",
                    //"<li id='cmExportShp'>Export as .shp</li>",
                    "<li id='cmToggleLabels'" +
                        (isPub ? "style='display: none;'" : '') +
                        '>Toggle Labels</li>',
                    '</ul>',
                    '</div>',
                ].join('\n')

                $('body').append(markup)

                var body = {
                    id: elm.attr('file_id'),
                }
                if (isPub) {
                    body = {
                        id: '[1,2,3,4,5]',
                        published: true,
                    }
                }
                $('#cmExportGeoJSON').on(
                    'click',
                    (function (body, isPub) {
                        return function () {
                            DrawTool.getFile(body, function (d) {
                                let geojson = d.geojson
                                let filename = ''
                                if (isPub) {
                                    filename = 'CAMP_Latest_Map'
                                    geojson._metadata = d.file
                                } else {
                                    filename =
                                        d.file[0].file_name +
                                        '_' +
                                        d.file[0].id +
                                        '_' +
                                        d.file[0].file_owner
                                    geojson._metadata = [d.file[0]]
                                }

                                //Genericize it to a map/all type
                                if (geojson._metadata[0].intent != 'all') {
                                    for (
                                        var i = 0;
                                        i < geojson.features.length;
                                        i++
                                    ) {
                                        var newIntent = null
                                        var t =
                                            geojson.features[
                                                i
                                            ].geometry.type.toLowerCase()
                                        if (
                                            t == 'polygon' ||
                                            t == 'multipolygon'
                                        )
                                            newIntent = 'polygon'
                                        else if (
                                            t == 'linestring' ||
                                            t == 'multilinestring'
                                        )
                                            newIntent = 'line'
                                        else newIntent = 'point'
                                        geojson.features[
                                            i
                                        ].properties._.intent = newIntent
                                    }
                                    geojson._metadata[0].intent = 'all'
                                }

                                DrawTool.expandPointprops(geojson)
                                F_.downloadObject(geojson, filename, '.geojson')
                            })
                        }
                    })(body, isPub)
                )

                $('#cmExportShp').on(
                    'click',
                    (function (body, isPub) {
                        return function () {
                            DrawTool.getFile(body, function (d) {
                                let geojson = d.geojson
                                ///geojson._metadata = d.file[0];
                                shpwrite.download(geojson, {
                                    folder:
                                        d.file[0].file_name +
                                        '_' +
                                        d.file[0].id +
                                        '_' +
                                        d.file[0].file_owner,
                                    types: {},
                                })
                            })
                        }
                    })(body, isPub)
                )

                $('#drawToolDrawFilesListElemContextMenu #cmToggleLabels').on(
                    'click',
                    (function (isPub) {
                        return function () {
                            if (isPub) return
                            DrawTool.toggleLabels(elm.attr('file_id'))
                        }
                    })(isPub)
                )

                var count = 1 //It has to start in one
                $('#drawToolDrawFilesListElemContextMenu').on(
                    'mouseenter',
                    function () {
                        count++
                    }
                )
                $('#drawToolDrawFilesListElemContextMenu').on(
                    'mouseleave',
                    function () {
                        count--
                        setTimeout(function () {
                            if (count <= 0) hideContextMenu()
                        }, 50)
                    }
                )
                function enter() {
                    count++
                }
                function leave() {
                    count--
                    setTimeout(function () {
                        if (count <= 0) {
                            hideContextMenu()
                            elm.off('mouseenter', enter)
                            elm.off('mouseleave', leave)
                        }
                    }, 50)
                }
                elm.on('mouseenter', enter)
                elm.on('mouseleave', leave)

                function hideContextMenu(immediately) {
                    $('.drawToolDrawFilesListElem').css('background', '')
                    $('.drawToolIntentColor').css({
                        width: '7px',
                    })
                    if (immediately) {
                        $('#drawToolDrawFilesListElemContextMenu').remove()
                    } else
                        $('#drawToolDrawFilesListElemContextMenu').animate(
                            {
                                opacity: 0,
                            },
                            250,
                            function () {
                                $(
                                    '#drawToolDrawFilesListElemContextMenu'
                                ).remove()
                            }
                        )
                }
            }
        )

        $('.drawToolFileEdit').off('click')
        $('.drawToolFileEdit').on('click', function () {
            var elm = $(this).parent().parent().parent()
            const ownedByUser = mmgisglobal.user == elm.attr('file_owner')

            const fileId = $(this).attr('file_id')
            const file = DrawTool.getFileObjectWithId(fileId)
            if (file == null) return

            var top = elm.offset().top + 22 + 'px'
            elm = elm.find('.drawToolFileEditOn')
            elm.css('top', top)
            var display = elm.css('display')
            if (display == 'none') elm.css('display', 'inherit')

            const existingTags = DrawTool.getTagsFromFileDescription(
                file.file_description
            )
            let tagsHtml = existingTags
                .map(
                    (tag, i) =>
                        `<div tag='${tag}' class='drawToolFileEditOnTag'><div class='drawToolFileEditOnTagName'>${tag}<div title='Times tag used' ${
                            ownedByUser
                                ? ''
                                : "style='line-height: 15px; padding-right: 6px;'"
                        }>(${DrawTool.allTags[tag] || 0})</div></div>${
                            ownedByUser
                                ? `<div class='drawToolFileEditOnTagClose' title='Delete Tag'><i class='mdi mdi-close mdi-14px'></i></div>`
                                : ''
                        }</div>`
                )
                .join('\n')

            // prettier-ignore
            const modalContentEditable = [
                "<div class='drawToolFileEditOn' file_id='" + fileId + "'  file_owner='" + file.file_owner + "' file_name='" + file.file_name + "'>",
                    "<div id='drawToolFileEditOnHeading'>",
                        "<div>",
                            "<i class='mdi mdi-file mdi-36px'></i>",
                            "<div id='drawToolFileEditOnHeadingName'>",
                                "<input class='drawToolFileNameInput' type='text' value='" + file.file_name + "'></input>",
                            "</div>",
                        "</div>",
                        "<div>",
                            `<div id="drawToolFileEditOnHeadingOwner">by ${file.file_owner} (you)</div>`,
                            "<select id='drawToolFileEditOnPublicityDropdown' class='ui dropdown dropdown_2 unsetMaxWidth'>",
                                `<option value='public' ${file.public == '1' ? 'selected' : ''}>Public</option>`,
                                `<option value='private' ${file.public != '1' ? 'selected' : ''}>Private</option>`,
                            "</select>",
                        "</div>",
                    "</div>",
                    "<div class='drawToolFileEditOnDates'>",
                        "<div>",
                            "<div>Created:</div>",
                            `<div>${file.created_on.split('T')[0]}</div>`,
                        "</div>",
                        "<div>",
                            "<div>Last Modified:</div>",
                            `<div>${file.updated_on.split('T')[0]}</div>`,
                        "</div>",
                    "</div>",
                    "<div class='drawToolFileEditOnDescription'>",
                        "<textarea class='drawToolFileDesc' rows='9' placeholder='Description...'>" + DrawTool.stripTagsFromDescription(file.file_description) + "</textarea>",
                    "</div>",
                    "<div id='drawToolFileEditOnTags'>",
                        "<div id='drawToolFileEditOnTagsNewCont'>",
                            "<input id='drawToolFileEditOnTagsNew' type='text' placeholder='Add a new tag...'></input>",
                            "<div id='drawToolFileEditOnTagsNewAdd'><i class='mdi mdi-tag-text mdi-18px'></i><div>Add Tag</div></div>",
                        "</div>",
                        "<div id='drawToolFileEditOnTagsList'>",
                            tagsHtml,
                        "</div>",
                    "</div>",
                    "<div id='drawToolFileEditOnActions'>",
                        "<div id='drawToolFileEditOnDelete' title='Delete File'><i class='drawToolFileDelete mdi mdi-delete-forever mdi-18px'></i></div>",
                        "<div class='flexbetween'>",
                            "<div class='drawToolFileCancel drawToolButton1'>Cancel</div>",
                            "<div class='drawToolFileSave drawToolButton1'>Save</div>",
                        "</div>",
                    "</div>",
                "</div>"
                ].join('\n')

            // prettier-ignore
            const modalContent = [
                "<div class='drawToolFileEditOn' file_id='" + fileId + "'  file_owner='" + file.file_owner + "' file_name='" + file.file_name + "'>",
                    "<div id='drawToolFileEditOnHeading'>",
                        "<div>",
                            "<i class='mdi mdi-file mdi-36px'></i>",
                            "<div id='drawToolFileEditOnHeadingName'>",
                                `<div class='drawToolFileNameInput'>${file.file_name}</div>`,
                            "</div>",
                        "</div>",
                        "<div>",
                            `<div id="drawToolFileEditOnHeadingOwner">by ${file.file_owner}</div>`,
                        "</div>",
                    "</div>",
                    "<div class='drawToolFileEditOnDates'>",
                        "<div>",
                            "<div>Created:</div>",
                            `<div>${file.created_on.split('T')[0]}</div>`,
                        "</div>",
                        "<div>",
                            "<div>Last Modified:</div>",
                            `<div>${file.updated_on.split('T')[0]}</div>`,
                        "</div>",
                    "</div>",
                    "<div class='drawToolFileEditOnDescription'>",
                        "<textarea class='drawToolFileDesc' rows='9' placeholder='No description...' disabled>" + DrawTool.stripTagsFromDescription(file.file_description) + "</textarea>",
                    "</div>",
                    "<div id='drawToolFileEditOnTags'>",
                        "<div id='drawToolFileEditOnTagsList' style='margin-top: 8px; min-height: 28px;'>",
                            tagsHtml,
                        "</div>",
                    "</div>",
                    "<div id='drawToolFileEditOnActions'>",
                        "<div></div>",
                        "<div class='drawToolFileCancel drawToolButton1'>Cancel</div>",
                    "</div>",
                "</div>"
                ].join('\n')

            Modal.set(
                ownedByUser ? modalContentEditable : modalContent,
                function () {
                    // Set up events
                    $('#drawToolFileEditOnTagsNew').autocomplete({
                        lookup: DrawTool.tags,
                    })
                    $('.autocomplete-suggestions')
                        .css({
                            'max-height': '60vh',
                            'overflow-y': 'auto',
                            'overflow-x': 'hidden',
                            border: '1px solid var(--color-mmgis)',
                            'border-top': 'none',
                            'background-color': 'var(--color-a)',
                            'z-index': 1000000,
                        })
                        .addClass('mmgisScrollbar')

                    $('#drawToolFileEditOnTagsNewAdd').on('click', function () {
                        const newTag = $('#drawToolFileEditOnTagsNew')
                            .val()
                            .toLowerCase()

                        // empty
                        if (newTag.length === 0) return

                        // not alphanumeric
                        if (newTag.match(/^[a-z0-9_]+$/i) == null) {
                            CursorInfo.update(
                                'Tags may only contain alphanumerics and underscores!',
                                3500,
                                true,
                                {
                                    x: 295,
                                    y: 6,
                                }
                            )
                            return
                        }

                        // duplicate
                        if (existingTags.includes(newTag)) return

                        $('#drawToolFileEditOnTagsList').append(
                            `<div tag='${newTag}' class='drawToolFileEditOnTag'><div class='drawToolFileEditOnTagName'>${newTag}<div title='Times tag used'>(${
                                DrawTool.allTags[newTag] || 0
                            })</div></div><div class='drawToolFileEditOnTagClose' title='Delete Tag'><i class='mdi mdi-close mdi-14px'></i></div></div>`
                        )
                        $('.drawToolFileEditOnTagClose').off('click')
                        $('.drawToolFileEditOnTagClose').on(
                            'click',
                            function () {
                                const removedTag = $(this).parent().attr('tag')
                                $(this).parent().remove()
                                const index = existingTags.indexOf(removedTag)
                                existingTags.splice(index, 1)
                            }
                        )
                        $('#drawToolFileEditOnTagsNew').val('')
                        existingTags.push(newTag)
                    })
                    $('.drawToolFileEditOnTagClose').on('click', function () {
                        const removedTag = $(this).parent().attr('tag')
                        $(this).parent().remove()
                        const index = existingTags.indexOf(removedTag)
                        existingTags.splice(index, 1)
                    })

                    //cancel
                    $('.drawToolFileCancel').on('click', function () {
                        Modal.remove()
                    })

                    //save
                    $('.drawToolFileSave').on('click', function () {
                        const elm = $(this).parent().parent().parent()

                        //Only select files you own
                        if (mmgisglobal.user !== elm.attr('file_owner')) return

                        var fileid = elm.attr('file_id')
                        var filename = elm.find('.drawToolFileNameInput').val()
                        var description = elm
                            .find('.drawToolFileDesc')
                            .val()
                            .trimStart()
                            .trimEnd()
                        if (!description.replace(/\s/g, '').length) {
                            description = ''
                        }
                        var body = {
                            id: fileid,
                            file_name: filename,
                            file_description:
                                description +
                                existingTags.map((t) => ' #' + t).join(''),
                            public:
                                elm
                                    .find(
                                        '#drawToolFileEditOnPublicityDropdown'
                                    )
                                    .val() == 'public'
                                    ? 1
                                    : 0,
                        }

                        DrawTool.changeFile(
                            body,
                            function (d) {
                                Modal.remove()
                                CursorInfo.update(
                                    'Successfully saved changes to file!',
                                    3500,
                                    false,
                                    {
                                        x: 295,
                                        y: 6,
                                    },
                                    '#009eff'
                                )
                                elm.find('.drawToolFileName').text(filename)
                                var files_i = F_.objectArrayIndexOfKeyWithValue(
                                    DrawTool.files,
                                    'id',
                                    parseInt(fileid)
                                )
                                if (files_i !== -1)
                                    DrawTool.files[files_i].file_name = filename

                                DrawTool.getFiles(function () {
                                    DrawTool.populateFiles()
                                })
                            },
                            function () {
                                CursorInfo.update(
                                    'Failed to save changes to file!',
                                    3500,
                                    true,
                                    {
                                        x: 295,
                                        y: 6,
                                    }
                                )
                            }
                        )
                    })

                    $('.drawToolFilePublic').on('click', function () {
                        var icon = $(this).find('i')
                        var publicVal = icon.attr('public')
                        if (publicVal == '0') {
                            icon.removeClass('mdi-shield')
                            icon.addClass('mdi-shield-outline')
                            icon.attr('public', '1')
                            $(this)
                                .find('.drawToolFilePublicName')
                                .text('Public')
                        } else {
                            icon.removeClass('mdi-shield-outline')
                            icon.addClass('mdi-shield')
                            icon.attr('public', '0')
                            $(this)
                                .find('.drawToolFilePublicName')
                                .text('Private')
                        }
                    })

                    $('#drawToolFileEditOnDelete').on('click', function () {
                        const filenameToDelete = $(this)
                            .parent()
                            .parent()
                            .attr('file_name')
                        let response = prompt(
                            'Are you sure you want to delete ' +
                                filenameToDelete +
                                ' (Y/N)?'
                        )
                        if (response == null) return
                        response = response.toLowerCase()
                        if (!(response == 'yes' || response == 'y')) return

                        var body = {
                            id: $(this).parent().parent().attr('file_id'),
                        }
                        var layerId = 'DrawTool_' + body.id

                        DrawTool.removeFile(
                            body,
                            (function (layerId, id) {
                                return function (d) {
                                    //Remove each feature in its group
                                    if (
                                        L_.layersGroup.hasOwnProperty(layerId)
                                    ) {
                                        for (
                                            var i = 0;
                                            i < L_.layersGroup[layerId].length;
                                            i++
                                        ) {
                                            Map_.rmNotNull(
                                                L_.layersGroup[layerId][i]
                                            )
                                            //And from the Globe
                                            Globe_.litho.removeLayer(
                                                'camptool_' + layerId + '_' + i
                                            )
                                        }
                                    }
                                    //Remove from filesOn
                                    let f = DrawTool.filesOn.indexOf(
                                        parseInt(id)
                                    )
                                    if (f != -1) DrawTool.filesOn.splice(f, 1)
                                }
                            })(layerId, body.id)
                        )
                        $(
                            `.drawToolDrawFilesListElem[file_id="${body.id}"]`
                        ).remove()
                        Modal.remove()
                    })
                },
                function () {
                    // on close
                    // Just incase this gets stuck
                    $('.autocomplete-suggestions').remove()
                }
            )
            return false
        })

        //Highlight layer if on
        $('.drawToolDrawFilesListElem').off('mouseenter')
        $('.drawToolDrawFilesListElem').on('mouseenter', function () {
            $(this).find('.drawToolFileEdit').addClass('shown')
            var fileId = parseInt($(this).attr('file_id'))
            var l = L_.layersGroup['DrawTool_' + fileId]
            if (!l) return
            for (var i = 0; i < l.length; i++) {
                if (l[i] != null) {
                    if (typeof l[i].setStyle === 'function')
                        l[i].setStyle({ color: '#7fff00' })
                    else if (l[i].hasOwnProperty('_layers')) {
                        //Arrow
                        var layers = l[i]._layers
                        layers[Object.keys(layers)[0]].setStyle({
                            color: '#7fff00',
                        })
                        layers[Object.keys(layers)[1]].setStyle({
                            color: '#7fff00',
                        })
                    } else
                        $('.DrawToolAnnotation_' + fileId).addClass('highlight')
                }
            }
        })
        $('.drawToolDrawFilesListElem').off('mouseleave')
        $('.drawToolDrawFilesListElem').on('mouseleave', function () {
            $(this).find('.drawToolFileEdit').removeClass('shown')
            var fileId = parseInt($(this).attr('file_id'))
            var l = L_.layersGroup['DrawTool_' + fileId]
            if (!l) return
            for (var i = 0; i < l.length; i++) {
                var style
                if (l[i] != null) {
                    if (
                        !l[i].hasOwnProperty('feature') &&
                        l[i].hasOwnProperty('_layers')
                    )
                        style =
                            l[i]._layers[Object.keys(l[i]._layers)[0]].feature
                                .properties.style
                    else style = l[i].feature.properties.style

                    let color = style.color
                    // Keep the active feature highlighted after mouseleave
                    if (Map_.activeLayer) {
                        if (
                            typeof l[i].setStyle === 'function' &&
                            ((l[i].hasOwnProperty('_layers') &&
                                l[i].hasLayer(Map_.activeLayer)) ||
                                Map_.activeLayer === l[i])
                        ) {
                            color =
                                (L_.configData.look &&
                                    L_.configData.look.highlightcolor) ||
                                'red'
                        } else if (
                            l[i].hasOwnProperty('_layers') &&
                            Map_.activeLayer === l[i]
                        ) {
                            color =
                                (L_.configData.look &&
                                    L_.configData.look.highlightcolor) ||
                                'red'
                        }
                    }

                    if (typeof l[i].setStyle === 'function')
                        l[i].setStyle({ ...style, color })
                    else if (l[i].hasOwnProperty('_layers')) {
                        //Arrow
                        var layers = l[i]._layers
                        layers[Object.keys(layers)[0]].setStyle({ color })
                        layers[Object.keys(layers)[1]].setStyle({ color })
                    } else {
                        $('.DrawToolAnnotation_' + fileId).removeClass(
                            'highlight'
                        )
                        if (Map_.activeLayer === l[i]) {
                            $('.DrawToolAnnotation_' + fileId).addClass(
                                'hovered'
                            )
                        }
                    }
                }
            }
        })
        //Select file
        $('.drawToolFileSelector').off('click')
        $('.drawToolFileSelector').on('click', function () {
            //Only select files you own
            var fileFromId = DrawTool.getFileObjectWithId(
                $(this).attr('file_id')
            )
            if (
                mmgisglobal.user !== $(this).attr('file_owner') &&
                fileFromId &&
                F_.diff(fileFromId.file_owner_group, DrawTool.userGroups)
                    .length == 0
            )
                return

            var checkbox = $(this).parent().find('.drawToolFileCheckbox')
            $('.drawToolFileCheckbox').removeClass('checked')
            $('.drawToolDrawFilesListElem').removeClass('checked')
            checkbox.addClass('checked')
            checkbox.parent().parent().parent().addClass('checked')

            var intent = $(this).attr('file_intent')
            if (DrawTool.intentType != intent) {
                DrawTool.intentType = intent
                DrawTool.setDrawing(true)
            }

            DrawTool.currentFileId = parseInt(checkbox.attr('file_id'))
            if (DrawTool.filesOn.indexOf(DrawTool.currentFileId) == -1)
                checkbox.click()
        })

        //Visible File
        $('.drawToolFileCheckbox').off('click')
        $('.drawToolFileCheckbox').on('click', DrawTool.toggleFile)
    },
    refreshFile: function (
        id,
        time,
        populateShapesAfter,
        selectedFeatureIds,
        asPublished,
        cb
    ) {
        let parsedId =
            typeof parseInt(id) === 'number' && !Array.isArray(id)
                ? parseInt(id)
                : 'master'
        //Can't refresh what isn't there
        if (
            parsedId != 'master' &&
            L_.layersGroup.hasOwnProperty('DrawTool_' + parsedId) == false
        )
            return

        var body = {
            id: JSON.stringify(id),
            time: time,
        }
        if (asPublished == true) body.published = true

        DrawTool.getFile(
            body,
            (function (index, selectedFeatureIds) {
                return function (data) {
                    var layerId = 'DrawTool_' + index
                    //Remove it first
                    if (L_.layersGroup.hasOwnProperty(layerId)) {
                        for (
                            var i = 0;
                            i < L_.layersGroup[layerId].length;
                            i++
                        ) {
                            //Close any popups/labels
                            var popupLayer = L_.layersGroup[layerId][i]
                            DrawTool.removePopupsFromLayer(popupLayer)

                            Map_.rmNotNull(L_.layersGroup[layerId][i])
                            L_.layersGroup[layerId][i] = null
                            //And from the Globe
                            Globe_.litho.removeLayer(
                                'camptool_' + layerId + '_' + i
                            )
                        }
                    }

                    let features = data.geojson.features
                    let coreFeatures = JSON.parse(JSON.stringify(data.geojson))
                    coreFeatures.features = []

                    for (var i = 0; i < features.length; i++) {
                        if (!features[i].properties.hasOwnProperty('style')) {
                            features[i].properties.style = F_.clone(
                                DrawTool.defaultStyle
                            )
                            if (
                                features[i].geometry.type.toLowerCase() ==
                                'point'
                            )
                                features[i].properties.style.fillOpacity = 1
                        }
                        if (features[i].properties.arrow === true) {
                            var c = features[i].geometry.coordinates
                            var start = new L.LatLng(c[0][1], c[0][0])
                            var end = new L.LatLng(c[1][1], c[1][0])

                            DrawTool.addArrowToMap(
                                layerId,
                                start,
                                end,
                                features[i].properties.style,
                                features[i]
                            )
                        } else if (features[i].properties.annotation === true) {
                            //Remove previous annotation if any
                            $(
                                '#DrawToolAnnotation_' +
                                    id +
                                    '_' +
                                    features[i].properties._.id
                            )
                                .parent()
                                .parent()
                                .parent()
                                .parent()
                                .remove()

                            var s = features[i].properties.style
                            var styleString =
                                (s.color != null
                                    ? 'text-shadow: ' +
                                      F_.getTextShadowString(
                                          s.color,
                                          s.strokeOpacity,
                                          s.weight
                                      ) +
                                      '; '
                                    : '') +
                                (s.fillColor != null
                                    ? 'color: ' + s.fillColor + '; '
                                    : '') +
                                (s.fontSize != null
                                    ? 'font-size: ' + s.fontSize + '; '
                                    : '')
                            L_.layersGroup[layerId].push(
                                L.popup({
                                    className: 'leaflet-popup-annotation',
                                    closeButton: false,
                                    autoClose: false,
                                    closeOnEscapeKey: false,
                                    closeOnClick: false,
                                    autoPan: false,
                                    offset: new L.point(0, 3),
                                })
                                    .setLatLng(
                                        new L.LatLng(
                                            features[i].geometry.coordinates[1],
                                            features[i].geometry.coordinates[0]
                                        )
                                    )
                                    .setContent(
                                        '<div>' +
                                            "<div id='DrawToolAnnotation_" +
                                            id +
                                            '_' +
                                            features[i].properties._.id +
                                            "' class='drawToolAnnotation DrawToolAnnotation_" +
                                            id +
                                            "  blackTextBorder' layer='" +
                                            id +
                                            "' index='" +
                                            L_.layersGroup[layerId].length +
                                            "' style='" +
                                            styleString +
                                            "'>" +
                                            '</div>' +
                                            '</div>'
                                    )
                                    .addTo(Map_.map)
                            )
                            L_.layersGroup[layerId][
                                L_.layersGroup[layerId].length - 1
                            ].feature = features[i]
                            $(
                                '#DrawToolAnnotation_' +
                                    id +
                                    '_' +
                                    features[i].properties._.id
                            ).text(features[i].properties.name)

                            DrawTool.refreshNoteEvents()
                        } else if (features[i].geometry.type === 'Point') {
                            L_.layersGroup[layerId].push(
                                L.circleMarker(
                                    new L.LatLng(
                                        features[i].geometry.coordinates[1],
                                        features[i].geometry.coordinates[0]
                                    ),
                                    features[i].properties.style
                                ).addTo(Map_.map)
                            )
                            L_.layersGroup[layerId][
                                L_.layersGroup[layerId].length - 1
                            ].feature = features[i]
                        } else {
                            L_.layersGroup[layerId].push(
                                L.geoJson(
                                    {
                                        type: 'FeatureCollection',
                                        features: [features[i]],
                                    },
                                    {
                                        style: function (feature) {
                                            return feature.properties.style
                                        },
                                    }
                                ).addTo(Map_.map)
                            )
                        }

                        if (
                            features[i].properties.annotation !== true &&
                            features[i].properties.arrow !== true
                        ) {
                            var last = L_.layersGroup[layerId].length - 1
                            var llast = L_.layersGroup[layerId][last]
                            var layer

                            if (llast.hasOwnProperty('_layers'))
                                layer =
                                    llast._layers[Object.keys(llast._layers)[0]]
                            else {
                                layer = Object.assign({}, llast)
                            }

                            coreFeatures.features.push(layer.feature)
                        }
                    }
                    if (coreFeatures.features.length > 0) {
                        Globe_.litho.addLayer('clamped', {
                            name: 'camptool_' + layerId + '_' + last,
                            on: true,
                            geojson: coreFeatures,
                            opacity: 1,
                            minZoom: 0,
                            maxZoom: 30,
                            style: {
                                // Prefer feature[f].properties.style values
                                letPropertiesStyleOverride: true,
                            },
                        })
                    }

                    if (populateShapesAfter)
                        DrawTool.populateShapes(id, selectedFeatureIds)

                    DrawTool.maintainLayerOrder()

                    DrawTool.refreshMasterCheckbox()

                    //Keep labels on if they were on before
                    let indexOf = DrawTool.labelsOn.indexOf(index + '')
                    if (indexOf != -1) {
                        DrawTool.labelsOn.splice(indexOf, 1)
                        DrawTool.toggleLabels(index + '')
                    }

                    if (typeof cb === 'function') {
                        cb()
                    }
                }
            })(parsedId, selectedFeatureIds)
        )
    },
    /**
     * Adds or removes a file
     * if fileId is not define, expects an element with a file_id attr
     * @param {int} fileId *optional*
     * @param {'on' || 'off'} forceToggle *optional*
     */
    toggleFile: function (
        fileId,
        forceToggle,
        populateShapesAfter,
        asPublished
    ) {
        var argumented = typeof fileId === 'number' || fileId === 'master'

        var id = parseInt($(this).attr('file_id'))
        if (argumented) id = fileId

        var layerId = 'DrawTool_' + id

        if (
            forceToggle == 'off' ||
            (forceToggle != 'on' && DrawTool.filesOn.indexOf(id) != -1)
        ) {
            //OFF
            // Don't allow turning files off that are being drawn in
            if (DrawTool.currentFileId == id) return

            DrawTool.filesOn = DrawTool.filesOn.filter(function (v) {
                return v !== id
            })

            if (!argumented) {
                DrawTool.populateShapes()
                //Change icon
                $(this).removeClass('on')
                $(this).parent().parent().parent().removeClass('on')
            }
            //Remove each feature in its group
            if (L_.layersGroup.hasOwnProperty(layerId)) {
                for (var i = 0; i < L_.layersGroup[layerId].length; i++) {
                    Map_.rmNotNull(L_.layersGroup[layerId][i])
                    //And from the Globe
                    Globe_.litho.removeLayer('camptool_' + layerId + '_' + i)
                }
            }

            DrawTool.refreshMasterCheckbox()
        } else {
            //ON
            DrawTool.filesOn.push(id)

            if (!argumented) {
                //Change icon
                $(this).addClass('on')
                $(this).parent().parent().parent().addClass('on')
            }
            //Get the file if we don't already have it
            L_.layersGroup[layerId] = []
            DrawTool.refreshFile(
                id == 'master' ? DrawTool.masterFileIds : id,
                null,
                populateShapesAfter != null ? populateShapesAfter : !argumented,
                null,
                asPublished
            )
        }
    },
    toggleLabels: function (file_id) {
        var l = L_.layersGroup['DrawTool_' + file_id]
        let indexOf = DrawTool.labelsOn.indexOf(file_id)
        var isOn = indexOf != -1
        if (isOn) DrawTool.labelsOn.splice(indexOf, 1)
        else DrawTool.labelsOn.push(file_id)

        if (l) {
            for (var i = 0; i < l.length; i++) {
                if (l[i] != null) {
                    if (l[i]._layers) {
                        var p = l[i]._layers[Object.keys(l[i]._layers)[0]]
                        if (isOn) p.closePopup()
                        else p.openPopup()
                    } else if (l[i].feature.properties.annotation != true) {
                        var p = l[i]
                        if (isOn) p.closePopup()
                        else p.openPopup()
                    }
                }
            }
        }
    },
    maintainLayerOrder: function () {
        for (var i = 0; i < DrawTool.intentOrder.length; i++) {
            for (var j = 0; j < DrawTool.filesOn.length; j++) {
                var file = DrawTool.getFileObjectWithId(DrawTool.filesOn[j])
                if (file.intent === DrawTool.intentOrder[i]) {
                    for (var e of L_.layersGroup[
                        'DrawTool_' + DrawTool.filesOn[j]
                    ])
                        if (e != null && typeof e.bringToFront === 'function')
                            e.bringToFront()
                }
            }
        }
    },
    removePopupsFromLayer: function (popupLayer) {
        if (popupLayer != null) {
            if (popupLayer._layers) {
                var p = popupLayer._layers[Object.keys(popupLayer._layers)[0]]

                let wasOpen = p.getPopup() ? p.getPopup().isOpen() : false
                if (wasOpen) return wasOpen
                p.closePopup()
                p.unbindPopup()
            } else if (
                !popupLayer.feature ||
                popupLayer.feature.properties.annotation != true
            ) {
                let wasOpen = popupLayer.getPopup()
                    ? popupLayer.getPopup().isOpen()
                    : false
                if (wasOpen) return wasOpen
                popupLayer.closePopup()
                popupLayer.unbindPopup()
            }
        }
        return false
    },
    refreshNoteEvents() {
        $('.drawToolAnnotation').off('mouseover')
        $('.drawToolAnnotation').on('mouseover', function () {
            var layer = 'DrawTool_' + $(this).attr('layer')
            var index = $(this).attr('index')
            $('.drawToolShapeLi').removeClass('hovered')
            $('.drawToolShapeLi .drawToolShapeLiItem').mouseleave()
            $('#drawToolShapeLiItem_' + layer + '_' + index).addClass('hovered')
            $(
                '#drawToolShapeLiItem_' +
                    layer +
                    '_' +
                    index +
                    ' .drawToolShapeLiItem'
            ).mouseenter()
        })
        $('.drawToolAnnotation').off('mouseout')
        $('.drawToolAnnotation').on('mouseout', function () {
            $('.drawToolShapeLi').removeClass('hovered')
            $('.drawToolShapeLi .drawToolShapeLiItem').mouseleave()
        })
        $('.drawToolAnnotation').off('click')
        $('.drawToolAnnotation').on('click', function () {
            var layer = 'DrawTool_' + $(this).attr('layer')
            var index = $(this).attr('index')
            var shape = L_.layersGroup[layer][index]
            if (!mmgisglobal.shiftDown) {
                if (typeof shape.getBounds === 'function')
                    Map_.map.fitBounds(shape.getBounds())
                else Map_.map.panTo(shape._latlng)
            }

            shape.fireEvent('click')
        })
    },
    refreshMasterCheckbox: function () {
        //Have master file checkbox on only when all master files are on too
        var masterCheckShouldBeOn = true
        for (var f in DrawTool.files) {
            if (
                DrawTool.files[f].is_master &&
                DrawTool.filesOn.indexOf(DrawTool.files[f].id) == -1
            ) {
                masterCheckShouldBeOn = false
                break
            }
        }
        if (masterCheckShouldBeOn)
            $('.drawToolFileMasterCheckbox').addClass('on')
        else $('.drawToolFileMasterCheckbox').removeClass('on')
    },
}

export default Files
