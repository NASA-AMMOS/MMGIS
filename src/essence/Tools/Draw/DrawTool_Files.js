import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import LayerGeologic from '../../Basics/Layers_/LayerGeologic/LayerGeologic'
import Globe_ from '../../Basics/Globe_/Globe_'
import Map_ from '../../Basics/Map_/Map_'
import CursorInfo from '../../Ancillary/CursorInfo'
import Modal from '../../Ancillary/Modal'

import DrawTool_Templater from './DrawTool_Templater'

import '../../../external/JQuery/jquery.autocomplete'
import * as tokml from '@maphubs/tokml'
import shpwrite from '@mapbox/shp-write'
import { saveAs } from 'file-saver'

import calls from '../../../pre/calls'

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
    currentOpenFolderName: null,
    prevFilterString: '',
    populateFiles: function (activeFileId) {
        $('#drawToolDrawFilesListMaster *').remove()
        $('#drawToolDrawFilesList *').remove()

        // To ensure tag/folders are alphabetical, we're going to sort the files first
        const groupingType = $('#drawToolDrawGroupingDiv > .active').attr(
            'type'
        )
        const filesInGroupOrder = JSON.parse(JSON.stringify(DrawTool.files))
        if (groupingType != 'none') {
            filesInGroupOrder.sort((a, b) => {
                if (
                    a._tagFolders[groupingType][0] === 'untagged' ||
                    a._tagFolders[groupingType][0] === 'unassigned'
                )
                    return 1
                return a._tagFolders[groupingType][0].localeCompare(
                    b._tagFolders[groupingType][0]
                )
            })
            if (groupingType === 'folders') {
                // Then add elevated folders at the top
                const filesInGroupOrderEFolder = JSON.parse(
                    JSON.stringify(filesInGroupOrder)
                )
                filesInGroupOrderEFolder.sort((a, b) => {
                    if (
                        a._tagFolders['efolders'][0] &&
                        a._tagFolders['efolders'][0] !== 'unassigned'
                    )
                        return a._tagFolders['efolders'][0].localeCompare(
                            b._tagFolders['efolders'][0]
                        )
                    return 0
                })
                for (var i = 0; i < filesInGroupOrderEFolder.length; i++) {
                    addFileToList(filesInGroupOrderEFolder[i], 'efolders')
                }
            }
        }
        for (var i = 0; i < filesInGroupOrder.length; i++) {
            addFileToList(filesInGroupOrder[i])
        }

        Files.recalculateFolderCounts()

        //Master Header
        $('.drawToolMasterHeaderLeftLeft').off('click')
        $('.drawToolMasterHeaderLeftLeft').on('click', function () {
            $('#drawToolDrawFilesListMaster').toggleClass('active')
            var isActive = $('#drawToolDrawFilesListMaster').hasClass('active')
            if (isActive) {
                $('.drawToolMasterHeaderLeftLeft i').removeClass(
                    'mdi-folder-star'
                )
                $('.drawToolMasterHeaderLeftLeft i').addClass('mdi-folder-open')
            } else {
                $('.drawToolMasterHeaderLeftLeft i').removeClass(
                    'mdi-folder-open'
                )
                $('.drawToolMasterHeaderLeftLeft i').addClass('mdi-folder-star')
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
            const drawType = $(this).attr('draw')
            if (
                DrawTool.intentType == 'all' ||
                ((DrawTool.intentType === 'roi' ||
                    DrawTool.intentType === 'campaign' ||
                    DrawTool.intentType === 'campsite') &&
                    (drawType === 'polygon' ||
                        drawType === 'circle' ||
                        drawType === 'rectangle'))
            ) {
                $('#drawToolDrawingTypeDiv > div').removeClass('active')
                $('#drawToolDrawingTypeDiv > div').css('border-radius', 0)
                $('#drawToolDrawingTypeDiv > div').css(
                    'background',
                    'var(--color-a2)'
                )
                $(this).addClass('active')
                $(this).css(
                    'background',
                    $('#drawToolDrawingTypeDiv').css('background')
                )

                DrawTool.setDrawingType(drawType)
            } else {
                CursorInfo.update(
                    `Please select a file from the list below (by clicking on its name). If none exist, make one with the create button below.`,
                    6000,
                    false,
                    {
                        x: 305,
                        y: 6,
                    }
                )
            }
        })

        //Grouping
        $('#drawToolDrawGroupingDiv > div').off('click')
        $('#drawToolDrawGroupingDiv > div').on('click', function (e) {
            $('#drawToolDrawGroupingDiv > div').each(function (idx, val) {
                $(val).removeClass('active')
            })
            $(this).addClass('active')
            DrawTool.populateFiles()
        })

        //Filter
        $('#drawToolDrawFilterClear').off('click')
        $('#drawToolDrawFilterClear').on('click', function () {
            $('#drawToolDrawFilter').val('')
            fileFilter()
        })
        $('#drawToolDrawFilter').off('input')
        $('#drawToolDrawFilter').on('input', fileFilter)
        $('#drawToolDrawSortDiv > div').off('click')
        $('#drawToolDrawSortDiv > div').on('click', function (e) {
            $(this).toggleClass('active')
            fileFilter()
        })
        $('#drawToolDrawFilter').off('keydown')
        $('#drawToolDrawFilter').on('keydown', function (e) {
            if (e.which === 13)
                // Enter key
                $(this).blur()
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
                    $(this).attr('visible', 'true')
                    on++
                } else {
                    $(this).css('opacity', 0)
                    $(this).css('height', '0px')
                    $(this).css('border-bottom', 'none')
                    $(this).attr('visible', 'false')
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

            Files.recalculateFolderCounts()
        }

        function addFileToList(file, groupingType) {
            const efoldersOnly = groupingType === 'efolders' ? true : false
            groupingType =
                groupingType ||
                $('#drawToolDrawGroupingDiv > .active').attr('type')
            var checkState = ''
            var onState = ' on'
            var shieldState = ''
            var ownedByUser = false

            if (DrawTool.currentFileId == file.id) checkState = ' checked'

            if (DrawTool.filesOn.indexOf(file.id) == -1) onState = ''

            if (file.public == 1) shieldState = '-outline'

            if (
                mmgisglobal.user == file.file_owner ||
                (file.file_owner_group &&
                    F_.diff(file.file_owner_group, DrawTool.userGroups).length >
                        0)
            )
                ownedByUser = true

            const isListEdit =
                file.public == '1' &&
                file.publicity_type == 'list_edit' &&
                typeof file.public_editors?.includes === 'function' &&
                (file.public_editors.includes(mmgisglobal.user) || ownedByUser)
            const isAllEdit =
                file.public == '1' && file.publicity_type == 'all_edit'

            // prettier-ignore
            var markup = [
                "<div class='flexbetween' style='height: 30px; line-height: 30px;'>",
                    "<div class='drawToolFileSelector flexbetween' file_id='" + file.id + "' file_owner='" + file.file_owner + "' file_intent='" + file.intent + "'>",
                    "<div class='drawToolIntentColor' style='height: 100%; width: 7px; background: " + DrawTool.categoryStyles[file.intent].color + "'></div>",
                    "<div class='drawToolFileInfo'>",
                        "<i title='Owned by you!' class='drawToolFileOwner mdi" + (file.is_master ? ' mdi-account-tie' : isAllEdit ? ' mdi-account-group' : isListEdit ? ' mdi-account-multiple' : (ownedByUser) ? ' mdi-account' : '' ) + " mdi-18px " + ( (file.is_master || ownedByUser || isAllEdit || isListEdit) ? 'alwaysShow' : '' )  + "' style='pointer-events: " + ( (ownedByUser) ? 'all' : 'none' ) + "' file_id='" + file.id + "'></i>",
                        `<div class='drawToolFileName' title='${file.file_name}\nIntent: ${file.intent}\nAuthor: ${file.file_owner}\nId: ${file.id}\nSelect to draw in,\nInfo button for information,\nCheck-box to toggle on,\nRight-Click for actions'>${file.file_name}</div>`,
                    "</div>",
                    "</div>",
                    "<div class='flexbetween'>",
                        "<div class='flexbetween'>",
                            "<i title='Private' class='drawToolFilePublicity mdi mdi-shield" + shieldState + " mdi-18px' style='display: " + ((shieldState == '') ? 'inherit' : 'none') + "'></i>",
                        "</div>",
                        (!file.is_master) ? "<i class='drawToolFileEdit mdi mdi-information-outline mdi-18px' file_id='" + file.id + "'></i>" : '',
                        "<div class='drawToolFileCheckbox" + onState + "' file_id='" + file.id + "'></div>",
                    "</div>",
                "</div>",
                ].join('\n');
            if (file.is_master && !efoldersOnly) {
                d3.select('#drawToolDrawFilesListMaster')
                    .append('li')
                    .attr('class', `drawToolDrawFilesListElem${checkState}`)
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
                if (file._tagFolders[groupingType]) {
                    file._tagFolders[groupingType].forEach((g) => {
                        const group = d3.select(
                            `#drawToolDrawFilesList > .drawToolDrawFilesGroupElem[group_name="${g}"]`
                        )

                        let iconClass =
                            Files.getGroupingIcons(groupingType).closed

                        if (group.size() === 0) {
                            // prettier-ignore
                            d3.select('#drawToolDrawFilesList')
                            .append('div')
                            .attr('class', `drawToolDrawFilesGroupElem`)
                            .attr('group_name', g)
                            .html(
                                [
                                    `<div class='drawToolDrawFilesGroupElemHead' state='off' group_name='${g}' groupingtype='${groupingType}'>`,
                                        `<div class='${g === 'unassigned' || g === 'untagged' ? 'drawToolDrawFilesGroupElemUn' : ''}'>`,
                                            `<div class='drawToolDrawFilesGroupElemChevron'><i class='mdi ${iconClass} mdi-18px'></i></div>`,
                                            `<div>${groupingType === 'alphabetical' ? g.substring(1) : g}</div>`,
                                        `</div>`,
                                        `<div class='drawToolDrawFilesGroupElemCount' count='0'></div>`,
                                    `</div>`,
                                    '<div class="drawToolDrawFilesGroupListElem" style="display: none;"></div>',
                                ].join('\n')
                            )
                        }
                        if (
                            $(
                                `.drawToolDrawFilesGroupElem[group_name="${g}"] .drawToolDrawFilesGroupListElem > .drawToolDrawFilesListElem[file_id="${file.id}"]`
                            ).length === 0
                        ) {
                            d3.select(
                                `.drawToolDrawFilesGroupElem[group_name="${g}"] .drawToolDrawFilesGroupListElem`
                            )
                                .append('li')
                                .attr(
                                    'class',
                                    `drawToolDrawFilesListElem${checkState}`
                                )
                                .attr('file_id', file.id)
                                .attr('file_name', file.file_name)
                                .attr('file_owner', file.file_owner)
                                .html(markup)
                        }
                    })
                } else if (!efoldersOnly) {
                    d3.select(`#drawToolDrawFilesList`)
                        .append('li')
                        .attr('class', `drawToolDrawFilesListElem${checkState}`)
                        .attr('file_id', file.id)
                        .attr('file_name', file.file_name)
                        .attr('file_owner', file.file_owner)
                        .html(markup)
                }
            }
        }

        $('.drawToolDrawFilesListElem').on('mouseout', function () {
            clearTimeout(DrawTool.fileTooltipTimeout)
            clearTimeout(DrawTool.fileTooltipTimeout2)
            $('.drawToolFileDescriptionTooltip').removeClass('active')
        })

        $('.drawToolDrawFilesGroupElemHead').on('click', function () {
            const elm = $(this)
            const elmg = elm.attr('groupingtype')
            const isOpen = elm.attr('state') === 'on'
            const li = elm.parent().find('.drawToolDrawFilesGroupListElem')

            const icons = Files.getGroupingIcons(elmg)
            if (isOpen) {
                elm.attr('state', 'off')
                Files.currentOpenFolderName = null
                li.css({ display: 'none' })
                elm.find('i').removeClass(icons.open)
                elm.find('i').addClass(icons.closed)
            } else {
                // First turn all off
                $('.drawToolDrawFilesGroupElemHead').each(function (idx, val) {
                    const elm2 = $(val)
                    const elmg2 = elm2.attr('groupingtype')
                    const li2 = elm2
                        .parent()
                        .find('.drawToolDrawFilesGroupListElem')
                    elm2.attr('state', 'off')
                    li2.css({ display: 'none' })

                    const icons2 = Files.getGroupingIcons(elmg2)
                    elm2.find('i').removeClass(icons2.open)
                    elm2.find('i').addClass(icons2.closed)
                })
                elm.attr('state', 'on')
                Files.currentOpenFolderName = elm.attr('group_name')
                li.css({ display: 'block' })
                elm.find('i').removeClass(icons.closed)
                elm.find('i').addClass(icons.open)
            }
        })

        if (Files.currentOpenFolderName != null)
            $(
                `.drawToolDrawFilesGroupElemHead[group_name=${Files.currentOpenFolderName}]`
            ).trigger('click')

        //Li Elem Context Menu
        $(
            '.drawToolDrawFilesListElem, #drawToolDrawPublished, .drawToolDrawFilesGroupElemHead'
        ).off('contextmenu')
        $(
            '.drawToolDrawFilesListElem, #drawToolDrawPublished, .drawToolDrawFilesGroupElemHead'
        ).on('contextmenu', function (e) {
            e.preventDefault()
            let elm = $(this)
            const isPub = elm.attr('id') === 'drawToolDrawPublished'
            const activeTagFolType = $(
                '#drawToolDrawGroupingDiv > div.active'
            ).attr('type')
            const isHead = elm.hasClass('drawToolDrawFilesGroupElemHead')
            const headGroup = elm.attr('group_name')

            const isLead = DrawTool.userGroups.indexOf('mmgis-group') != -1
            const leadIsEdit =
                isLead && DrawTool.vars.leadsCanEditFileInfo === true

            if (
                isHead &&
                (!(
                    activeTagFolType === 'tags' ||
                    activeTagFolType === 'folders'
                ) ||
                    !leadIsEdit)
            )
                return

            hideContextMenu(true)

            const fileId = elm.attr('file_id')
            const file = DrawTool.getFileObjectWithId(fileId)

            const hasTemplate = file?.template?.template != null

            let rect = $(this).get(0).getBoundingClientRect()
            // Export GeoJSON
            // Export GeoJSON [Forced Template]
            const topStyle = rect.y + rect.height - 1
            // prettier-ignore
            let markup = [
                `<div id='drawToolDrawFilesListElemContextMenu' style='top: ${topStyle}px; left: 40px; width: ${rect.width}px; z-index: 2000; font-size: 14px; ${topStyle > window.innerHeight / 1.5 ? 'transform: translateY(calc(-100% - 29px));': ''}'>`,
                    '<ul>',
                        !isHead ? [
                        `<li id="cmExport">`,
                            `<div><i class='mdi mdi-download mdi-14px'></i><div>Export</div></div>`,
                            '<div>',
                                '<div>Format</div>',
                                '<select id="cmExportFormat" class="dropdown">',
                                    '<option value="geojson" selected>GeoJSON</option>',
                                    '<option value="kml">KML</option>',
                                    '<option value="shp">SHP</option>',
                                '</select>',
                            '</div>',
                            L_.Coordinates.mainType != 'll' ? [
                            '<div>',
                                '<div>Coords</div>',
                                '<select id="cmExportCoords" class="cmExportCoords dropdown">',
                                    '<option value="source" selected>Source</option>',
                                    `<option value="${L_.Coordinates.mainType}">Converted (${L_.Coordinates.mainType})</option>`,
                                '</select>',
                            '</div>'] .join('\n') : '',
                            hasTemplate ? [
                            '<div>',
                                '<div>Force Template</div>',
                                '<select class="cmExportTemplateForced dropdown">',
                                    '<option value="false" selected>False</option>',
                                    '<option value="true">True</option>',
                                '</select>',
                            '</div>'].join('\n') : '',
                            '<div><div id="cmExportGo" class="mmgisButton5">Export</div></div>',
                        `</li>`].join('\n') : '',
                        // Other
                        (!isHead && !isPub) ? `<li id='cmToggleLabels'><i class='mdi mdi-label-outline mdi-14px'></i>Toggle Labels</li>` : "",
                        isHead ? `<li id='drawToolcmRenameTagFol'><i class='mdi mdi-rename-box mdi-14px'></i>Rename ${activeTagFolType === 'tags' ? "Tag" : "Folder"}</li>` : "",
                        isHead ? `<li id='drawToolcmRemoveTagFol'><i class='mdi mdi-delete-forever mdi-14px'></i>Remove ${activeTagFolType === 'tags' ? "Tag" : "Folder"}</li>` : "",
                    '</ul>',
                '</div>',
            ].join('\n')

            $('body').append(markup)

            let body = {
                id: elm.attr('file_id'),
            }
            if (isPub) {
                body = {
                    id: '[1,2,3,4,5]',
                    published: true,
                }
            }

            $('#cmExportGo').on('click', () => {
                let format = $('#cmExportFormat')
                if (format) format = format.val() || 'geojson'
                else format = 'geojson'
                let coords = $('#cmExportCoords')
                if (coords) coords = coords.val() || 'source'
                else coords = 'source'
                let templateForced = $('#cmExportTemplateForced')
                if (templateForced)
                    templateForced = templateForced.val() || 'false'
                else templateForced = 'false'

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
                        for (var i = 0; i < geojson.features.length; i++) {
                            var newIntent = null
                            var t =
                                geojson.features[i].geometry.type.toLowerCase()
                            if (t == 'polygon' || t == 'multipolygon')
                                newIntent = 'polygon'
                            else if (
                                t == 'linestring' ||
                                t == 'multilinestring'
                            )
                                newIntent = 'line'
                            else newIntent = 'point'
                            geojson.features[i].properties._.intent = newIntent
                        }
                        geojson._metadata[0].intent = 'all'
                    }

                    DrawTool.expandPointprops(geojson)
                    if (coords != 'source')
                        geojson =
                            L_.convertGeoJSONLngLatsToPrimaryCoordinates(
                                geojson
                            )
                    if (templateForced === 'true')
                        geojson = DrawTool.enforceTemplate(
                            geojson,
                            d?.file?.[0]?.template,
                            templateForced
                        )

                    switch (format) {
                        case 'geojson':
                            F_.downloadObject(geojson, filename, '.geojson')
                            break
                        case 'kml':
                            let kmlTimestampField = null
                            if (d?.file?.[0]?.template?.template) {
                                d.file[0].template.template.forEach((f) => {
                                    if (f.type === 'date' && f.isEnd === true)
                                        kmlTimestampField = f.field
                                })
                            }

                            const kml = tokml(
                                F_.geoJSONForceSimpleStyleSpec(geojson, true),
                                {
                                    name: filename,
                                    description: 'description',
                                    timestamp: kmlTimestampField,
                                    documentName: d.file[0].file_name,
                                    documentDescription: 'Generated by MMGIS',
                                    simplestyle: true,
                                }
                            )
                            F_.downloadObject(kml, filename, '.kml', 'xml')
                            break
                        case 'shp':
                            const folder =
                                d.file[0].file_name +
                                '_' +
                                d.file[0].id +
                                '_' +
                                d.file[0].file_owner
                            calls.api(
                                'proj42wkt',
                                {
                                    proj4: window.mmgisglobal.customCRS
                                        .projString,
                                },
                                (data) => {
                                    shpwrite
                                        .zip(geojson, {
                                            outputType: 'blob',
                                            prj: data,
                                        })
                                        .then((content) => {
                                            saveAs(content, `${folder}.zip`)
                                        })
                                },
                                function (err) {
                                    CursorInfo.update(
                                        `Failed to generate shapefile's .prj.`,
                                        6000,
                                        true,
                                        { x: 305, y: 6 },
                                        '#e9ff26',
                                        'black'
                                    )
                                }
                            )
                            break
                        default:
                    }
                })
            })

            $('#drawToolDrawFilesListElemContextMenu #cmToggleLabels').on(
                'click',
                (function (isPub) {
                    return function () {
                        if (isPub) return
                        DrawTool.toggleLabels(elm.attr('file_id'))
                    }
                })(isPub)
            )

            $('#drawToolcmRenameTagFol').on(
                'click',
                (function (activeTagFolType, headGroup) {
                    return function () {
                        const newKeyword = prompt(
                            `RENAME - Enter a new name for the '${headGroup}' ${
                                activeTagFolType === 'tags' ? 'tag' : 'folder'
                            }.`
                        )
                        if (newKeyword && newKeyword.length > 0) {
                            calls.api(
                                'files_modifykeyword',
                                {
                                    keyword: headGroup,
                                    type: activeTagFolType,
                                    newKeyword: newKeyword.toLowerCase(),
                                },
                                function () {
                                    CursorInfo.update(
                                        `Successfully renamed the '${headGroup}' ${
                                            activeTagFolType === 'tags'
                                                ? 'tag'
                                                : 'folder'
                                        } to '${newKeyword}'!`,
                                        3500,
                                        false,
                                        {
                                            x: 305,
                                            y: 6,
                                        },
                                        '#009eff',
                                        'black',
                                        null,
                                        true
                                    )
                                    DrawTool.getFiles(function () {
                                        DrawTool.populateFiles()
                                    })
                                },
                                function () {
                                    CursorInfo.update(
                                        `Failed to remove ${
                                            activeTagFolType === 'tags'
                                                ? 'tag'
                                                : 'folder'
                                        }!`,
                                        3500,
                                        true,
                                        {
                                            x: 305,
                                            y: 6,
                                        }
                                    )
                                }
                            )
                        } else {
                            CursorInfo.update(
                                `No new name entered. Nothing to do.`,
                                3500,
                                true,
                                {
                                    x: 305,
                                    y: 6,
                                }
                            )
                        }
                    }
                })(activeTagFolType, headGroup)
            )

            $('#drawToolcmRemoveTagFol').on(
                'click',
                (function (activeTagFolType, headGroup) {
                    return function () {
                        const newKeyword = prompt(
                            `REMOVE - Re-enter this ${
                                activeTagFolType === 'tags'
                                    ? "tag's"
                                    : "folder's"
                            } name ('${headGroup}') to remove it. This operation does not remove user's files — it only unassigns all files from this ${
                                activeTagFolType === 'tags' ? 'tag' : 'folder'
                            }.`
                        )
                        if (newKeyword === headGroup) {
                            calls.api(
                                'files_modifykeyword',
                                {
                                    keyword: headGroup,
                                    type: activeTagFolType,
                                },
                                function () {
                                    CursorInfo.update(
                                        `Successfully removed the '${headGroup}' ${
                                            activeTagFolType === 'tags'
                                                ? 'tag'
                                                : 'folder'
                                        }!`,
                                        3500,
                                        false,
                                        {
                                            x: 305,
                                            y: 6,
                                        },
                                        '#009eff',
                                        'black',
                                        null,
                                        true
                                    )
                                    DrawTool.getFiles(function () {
                                        DrawTool.populateFiles()
                                    })
                                },
                                function () {
                                    CursorInfo.update(
                                        `Failed to remove ${
                                            activeTagFolType === 'tags'
                                                ? 'tag'
                                                : 'folder'
                                        }!`,
                                        3500,
                                        true,
                                        {
                                            x: 305,
                                            y: 6,
                                        }
                                    )
                                }
                            )
                        } else {
                            CursorInfo.update(
                                `Check failed. Names don't match. Entered '${newKeyword}'. Required: '${headGroup}'`,
                                3500,
                                true,
                                {
                                    x: 305,
                                    y: 6,
                                }
                            )
                        }
                    }
                })(activeTagFolType, headGroup)
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
                if (immediately) {
                    $('#drawToolDrawFilesListElemContextMenu').remove()
                } else
                    $('#drawToolDrawFilesListElemContextMenu').animate(
                        {
                            opacity: 0,
                        },
                        250,
                        function () {
                            $('#drawToolDrawFilesListElemContextMenu').remove()
                            $('.drawToolFileOwner').css({
                                color: 'white',
                            })
                            $('.drawToolFileName').css({
                                color: 'unset',
                            })
                        }
                    )
            }
        })

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

            const isLead = DrawTool.userGroups.indexOf('mmgis-group') != -1
            const leadIsEdit =
                isLead && DrawTool.vars.leadsCanEditFileInfo === true

            const existingTagFol = DrawTool.getTagsFoldersFromFileDescription(
                file,
                true
            )
            let efoldersHtml =
                existingTagFol.efolders.length > 0
                    ? existingTagFol.efolders
                          .map(
                              (tag, i) =>
                                  `<div tag='${tag}' type='efolders' class='drawToolFileEditOnEFolder'><div class='drawToolFileEditOnTagName'>${tag}</div>${
                                      leadIsEdit
                                          ? `<div class='drawToolFileEditOnTagClose' title='Delete Tag'><i class='mdi mdi-close mdi-14px'></i></div>`
                                          : `<span style="width: 6px;"></span>`
                                  }</div>`
                          )
                          .join('\n')
                    : null
            let foldersHtml =
                existingTagFol.folders.length > 0
                    ? existingTagFol.folders
                          .map(
                              (tag, i) =>
                                  `<div tag='${tag}' type='folders' class='drawToolFileEditOnFolder'><div class='drawToolFileEditOnTagName'>${tag}</div>${
                                      ownedByUser || leadIsEdit
                                          ? `<div class='drawToolFileEditOnTagClose' title='Delete Tag'><i class='mdi mdi-close mdi-14px'></i></div>`
                                          : `<span style="width: 6px;"></span>`
                                  }</div>`
                          )
                          .join('\n')
                    : null
            let tagsHtml = existingTagFol.tags
                .map(
                    (tag, i) =>
                        `<div tag='${tag}' type='tags' class='drawToolFileEditOnTag'><div class='drawToolFileEditOnTagName'>${tag}</div>${
                            ownedByUser || leadIsEdit
                                ? `<div class='drawToolFileEditOnTagClose' title='Delete Tag'><i class='mdi mdi-close mdi-14px'></i></div>`
                                : `<span style="width: 6px;"></span>`
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
                            `<div id="drawToolFileEditOnHeadingOwner">by ${file.file_owner}${ownedByUser ? ' (you)' : ''}</div>`,
                            "<select id='drawToolFileEditOnPublicityDropdown' class='ui dropdown dropdown_2 unsetMaxWidth'>",
                                `<option value='private' ${file.public == '0' ? 'selected' : ''}>Private</option>`,
                                `<option value='public read_only' ${file.public == '1' && file.publicity_type != 'list_edit' && file.publicity_type != 'all_edit' ? 'selected' : ''}>Public - Read-Only</option>`,
                                `<option value='public list_edit' ${file.public == '1' && file.publicity_type == 'list_edit' ? 'selected' : ''}>Public - List-Editors</option>`,
                                `<option value='public all_edit' ${file.public == '1' && file.publicity_type == 'all_edit' ? 'selected' : ''}>Public - All-Edit</option>`,
                            "</select>",
                        "</div>",
                    "</div>",
                    `<div class='drawToolFileEditListEditors' style='display: ${file.public == '1' && file.publicity_type == 'list_edit' ? 'flex' : 'none'}'>`,
                        "<div>File Editors:</div>",
                        `<input id='drawToolFileEditListEditors' type='text' placeholder='Comma-separated names of users who can edit this file...' value='${file.public_editors && typeof file.public_editors.join === 'function' ? file.public_editors.join(',') : ''}'></input>`,
                    "</div>",
                    "<div class='drawToolFileEditOnDates'>",
                        "<div>",
                            "<div>Created:</div>",
                            `<div>${file.created_on.split('T')[0]}</div>`,
                        "</div>",
                        "<div>",
                            "<div>Modified:</div>",
                            `<div>${file.updated_on.split('T')[0]}</div>`,
                        "</div>",
                        "<div class='drawToolFileTemplate' id='drawToolFileTemplateEdit'>",
                            "<div>Template:</div>",
                            `<div><div>${file.template?.name || 'NONE'}</div><i class='mdi mdi-pencil mdi-14px'></i></div>`,
                        "</div>",
                    "</div>",
                    "<div class='drawToolFileEditOnDescription'>",
                        "<textarea class='drawToolFileDesc' rows='9' placeholder='Description...'>" + DrawTool.stripTagsFromDescription(file.file_description) + "</textarea>",
                    "</div>",
                    "<div id='drawToolFileEditOnTags'>",

                        "<div id='drawToolFileEditOnTagsNewCont'>",
                            "<input id='drawToolFileEditOnTagsNew' type='text' placeholder='Add a tag, add to folder...'></input>",
                            "<div>",
                                isLead ? "<div id='drawToolFileEditOnEFoldersNewAdd' title='Add to Elevated Folder'><i class='mdi mdi-subdirectory-arrow-right mdi-18px'></i><i class='mdi mdi-folder-upload mdi-18px'></i></div>" : "",
                                "<div id='drawToolFileEditOnFoldersNewAdd' title='Add to Folder'><i class='mdi mdi-subdirectory-arrow-right mdi-18px'></i><i class='mdi mdi-folder mdi-18px'></i></div>",
                                "<div id='drawToolFileEditOnTagsNewAdd' title='Add Tag'><i class='mdi mdi-plus mdi-18px'></i><i class='mdi mdi-tag-text mdi-18px'></i></div>",
                            "</div>",
                        "</div>",
                        "<div id='drawToolFileEditOnTagFolHead'><i class='mdi mdi-folder-upload mdi-14px'></i> Elevated Folders</div>",
                        "<div id='drawToolFileEditOnEFoldersList'>",
                            efoldersHtml || "<div class='drawToolNoTagFol'>None</div>",
                        "</div>",
                        "<div id='drawToolFileEditOnTagFolHead'><i class='mdi mdi-folder mdi-14px'></i> Folders</div>",
                        "<div id='drawToolFileEditOnFoldersList'>",
                            foldersHtml || "<div class='drawToolNoTagFol'>None</div>",
                        "</div>",
                        "<div id='drawToolFileEditOnTagFolHead'><i class='mdi mdi-tag-text mdi-14px'></i> Tags</div>",
                        "<div id='drawToolFileEditOnTagsList'>",
                            tagsHtml || "<div class='drawToolNoTagFol'>None</div>",
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

            let template = file.template || null

            // prettier-ignore
            const modalContent = [
                "<div class='drawToolFileEditOn' file_id='" + fileId + "' file_owner='" + file.file_owner + "' file_name='" + file.file_name + "'>",
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
                            "<div>Modified:</div>",
                            `<div>${file.updated_on.split('T')[0]}</div>`,
                        "</div>",
                        "<div class='drawToolFileTemplate'>",
                            "<div>Template:</div>",
                            `<div><div>${template?.name || 'NONE'}</div></div>`,
                        "</div>",
                    "</div>",
                    "<div class='drawToolFileEditOnDescription'>",
                        "<textarea class='drawToolFileDesc' rows='9' placeholder='No description...' disabled>" + DrawTool.stripTagsFromDescription(file.file_description) + "</textarea>",
                    "</div>",
                    "<div id='drawToolFileEditOnTags' style='padding-top: 10px;'>",
                        "<div id='drawToolFileEditOnTagFolHead'><i class='mdi mdi-folder-upload mdi-14px'></i> Elevated Folders</div>",
                        "<div id='drawToolFileEditOnEFoldersList'>",
                            efoldersHtml || "<div class='drawToolNoTagFol'>None</div>",
                        "</div>",
                        "<div id='drawToolFileEditOnTagFolHead'><i class='mdi mdi-folder mdi-14px'></i> Folders</div>",
                        "<div id='drawToolFileEditOnFoldersList'>",
                            foldersHtml || "<div class='drawToolNoTagFol'>None</div>",
                        "</div>",
                        "<div id='drawToolFileEditOnTagFolHead'><i class='mdi mdi-tag-text mdi-14px'></i> Tags</div>",
                        "<div id='drawToolFileEditOnTagsList'>",
                            tagsHtml || "<div class='drawToolNoTagFol'>None</div>",
                        "</div>",
                    "</div>",
                    "<div id='drawToolFileEditOnActions'>",
                        "<div></div>",
                        "<div class='drawToolFileCancel drawToolButton1'>Cancel</div>",
                    "</div>",
                "</div>"
                ].join('\n')

            Modal.set(
                ownedByUser ||
                    (DrawTool.userGroups.indexOf('mmgis-group') != -1 &&
                        DrawTool.vars.leadsCanEditFileInfo)
                    ? modalContentEditable
                    : modalContent,
                function () {
                    //
                    $('#drawToolFileTemplateEdit').on('click', () => {
                        // prettier-ignore
                        const templateEditMarkup = [
                            `<div id='drawToolFileTemplateEditModal'>`,
                                `<div id='drawToolFileTemplateEditModalTitle'>`,
                                    `<div><i class='mdi mdi-form-select mdi-18px'></i><div>Template</div></div>`,
                                    `<div id='drawToolFileTemplateEditModalClose'><i class='mmgisHoverBlue mdi mdi-close mdi-18px'></i></div>`,
                                `</div>`,
                                `<div id='drawToolFileTemplateContainer'>`,
                                `</div>`,
                                `<div id='drawToolFileTemplateEditModalActions'>`,
                                    `<div id='drawToolFileTemplateEditModalActionsCancel' class='drawToolButton1'>Cancel</div>`,
                                    `<div id='drawToolFileTemplateEditModalActionsDone' class='drawToolButton1'>Done</div>`,
                                `</div>`,
                            `</div>`
                        ].join('\n')
                        Modal.set(
                            templateEditMarkup,
                            function () {
                                $(`#drawToolFileTemplateEditModalClose`).on(
                                    'click',
                                    function () {
                                        Modal.remove(false, 1)
                                    }
                                )
                                $(
                                    `#drawToolFileTemplateEditModalActionsCancel`
                                ).on('click', function () {
                                    Modal.remove(false, 1)
                                })
                                DrawTool_Templater.renderDesignTemplate(
                                    'drawToolFileTemplateContainer',
                                    {
                                        name: template?.name,
                                        template: template?.template,
                                    },
                                    template?.name == null
                                )
                                $(
                                    `#drawToolFileTemplateEditModalActionsDone`
                                ).on('click', function () {
                                    let allTemplates = {}
                                    if (DrawTool.files) {
                                        DrawTool.files.forEach((f) => {
                                            if (
                                                f.template != null &&
                                                f.template.name != null &&
                                                f.template.template != null
                                            ) {
                                                allTemplates[f.template.name] =
                                                    f.template.template
                                            }
                                        })
                                    }
                                    allTemplates = {
                                        ...allTemplates,
                                        ...JSON.parse(
                                            JSON.stringify(
                                                DrawTool.vars.templates || {}
                                            )
                                        ),
                                    }
                                    const designedTemplate =
                                        DrawTool_Templater.getDesignedTemplate(
                                            'drawToolFileTemplateContainer',
                                            allTemplates
                                        )
                                    if (designedTemplate === true) {
                                        template = null
                                        $(
                                            `#drawToolFileTemplateEdit > div > div`
                                        )
                                            .text('NONE')
                                            .css({
                                                color: 'var(--color-green)',
                                            })
                                        // Do nothing and continue; user was not designing a new template
                                    } else if (designedTemplate === false) {
                                        // User was designing, but it had errors
                                        return
                                    } else {
                                        template = JSON.parse(
                                            JSON.stringify(designedTemplate)
                                        )
                                        $(
                                            `#drawToolFileTemplateEdit > div > div`
                                        )
                                            .text(template.name)
                                            .css({
                                                color: 'var(--color-green)',
                                            })
                                    }
                                    Modal.remove(false, 1)
                                })
                            },
                            function () {},
                            1
                        )
                    })
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

                    const tagFolderAdd = (type) => {
                        let rawNewTag = $('#drawToolFileEditOnTagsNew')
                            .val()
                            .toLowerCase()

                        let newTag = rawNewTag
                            .replace('tag:', '')
                            .replace('elevated-folder:', '')
                            .replace('folder:', '')

                        if (existingTagFol[type] == null) return
                        // empty
                        if (newTag.length === 0) return

                        // not alphanumeric
                        if (newTag.match(/^[a-z0-9_]+$/i) == null) {
                            CursorInfo.update(
                                `${
                                    type === 'tag' ? 'Tags' : 'Folders'
                                } may only contain alphanumerics and underscores!`,
                                3500,
                                true,
                                {
                                    x: 305,
                                    y: 6,
                                }
                            )
                            return
                        }

                        // duplicate
                        if (existingTagFol[type].includes(newTag)) return
                        let listId = null
                        let itemClass = null
                        switch (type) {
                            case 'tags':
                                listId = 'drawToolFileEditOnTagsList'
                                itemClass = 'drawToolFileEditOnTag'
                                break
                            case 'folders':
                                listId = 'drawToolFileEditOnFoldersList'
                                itemClass = 'drawToolFileEditOnFolder'
                                break

                            case 'efolders':
                                listId = 'drawToolFileEditOnEFoldersList'
                                itemClass = 'drawToolFileEditOnEFolder'
                                break
                            default:
                                break
                        }

                        // Remove 'None' if any
                        $(`#${listId} .drawToolNoTagFol`).remove()

                        // prettier-ignore
                        $(`#${listId}`).append(
                            `<div tag='${newTag}'type='${type}' class=${itemClass}>
                                <div class='drawToolFileEditOnTagName'>${newTag}</div>
                                <div class='drawToolFileEditOnTagClose' title='${
                                    type === 'tags'
                                        ? 'Delete Tag'
                                        : 'Remove from Folder'
                                }'>
                                    <i class='mdi mdi-close mdi-14px'></i>
                                </div>
                            </div>`
                        )
                        $('.drawToolFileEditOnTagClose').off('click')
                        $('.drawToolFileEditOnTagClose').on(
                            'click',
                            function (e) {
                                e.stopPropagation()
                                if (
                                    $(this).parent().parent().children()
                                        .length === 1
                                )
                                    $(this)
                                        .parent()
                                        .parent()
                                        .append(
                                            '<div class="drawToolNoTagFol">None</div>'
                                        )
                                const removedTag = $(this).parent().attr('tag')
                                const removedType = $(this)
                                    .parent()
                                    .attr('type')
                                $(this).parent().remove()

                                const index =
                                    existingTagFol[removedType].indexOf(
                                        removedTag
                                    )
                                existingTagFol[removedType].splice(index, 1)
                            }
                        )
                        $('#drawToolFileEditOnTagsNew').val('')
                        existingTagFol[type].push(newTag)
                    }
                    $('#drawToolFileEditOnPublicityDropdown').on(
                        'change',
                        function () {
                            $('.drawToolFileEditListEditors').css({
                                display:
                                    $(this).val() === 'public list_edit'
                                        ? 'flex'
                                        : 'none',
                            })
                        }
                    )
                    $('#drawToolFileEditOnTagsNewAdd').on('click', function () {
                        tagFolderAdd('tags')
                    })
                    $('#drawToolFileEditOnFoldersNewAdd').on(
                        'click',
                        function () {
                            tagFolderAdd('folders')
                        }
                    )
                    $('#drawToolFileEditOnEFoldersNewAdd').on(
                        'click',
                        function () {
                            tagFolderAdd('efolders')
                        }
                    )

                    $('.drawToolFileEditOnTagClose').on('click', function (e) {
                        e.stopPropagation()
                        const removedTag = $(this).parent().attr('tag')
                        const removedType = $(this).parent().attr('type')
                        $(this).parent().remove()
                        const index =
                            existingTagFol[removedType].indexOf(removedTag)
                        existingTagFol[removedType].splice(index, 1)
                    })

                    //cancel
                    $('.drawToolFileCancel').on('click', function () {
                        Modal.remove()
                    })

                    //save
                    $('.drawToolFileSave').on('click', function () {
                        const elm = $(this).parent().parent().parent()
                        //Only select files you own
                        if (
                            !(
                                mmgisglobal.user === elm.attr('file_owner') ||
                                (DrawTool.userGroups.indexOf('mmgis-group') !=
                                    -1 &&
                                    DrawTool.vars.leadsCanEditFileInfo)
                            )
                        )
                            return

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
                                existingTagFol['efolders']
                                    .map((t) => ' ~^' + t)
                                    .join('') +
                                existingTagFol['folders']
                                    .map((t) => ' ~@' + t)
                                    .join('') +
                                existingTagFol['tags']
                                    .map((t) => ' ~#' + t)
                                    .join(''),
                            public:
                                elm
                                    .find(
                                        '#drawToolFileEditOnPublicityDropdown'
                                    )
                                    .val()
                                    .indexOf('public') != -1
                                    ? 1
                                    : 0,
                            template: JSON.stringify(template),
                            publicity_type: elm
                                .find('#drawToolFileEditOnPublicityDropdown')
                                .val()
                                .includes('public')
                                ? elm
                                      .find(
                                          '#drawToolFileEditOnPublicityDropdown'
                                      )
                                      .val()
                                      .replace('public ', '')
                                : null,
                            public_editors: elm
                                .find('#drawToolFileEditListEditors')
                                .val(),
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
                                        x: 305,
                                        y: 6,
                                    },
                                    '#009eff',
                                    'black',
                                    null,
                                    true
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
                                        x: 305,
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
                                        L_.layers.layer.hasOwnProperty(layerId)
                                    ) {
                                        for (
                                            var i = 0;
                                            i < L_.layers.layer[layerId].length;
                                            i++
                                        ) {
                                            Map_.rmNotNull(
                                                L_.layers.layer[layerId][i]
                                            )
                                        }
                                        //And from the Globe
                                        Globe_.litho.removeLayer(
                                            'camptool_' + layerId
                                        )
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
            if (DrawTool.timeToggledOn) return
            $(this).find('.drawToolFileEdit').addClass('shown')
            var fileId = parseInt($(this).attr('file_id'))
            var l = L_.layers.layer['DrawTool_' + fileId]
            if (!l) return
            for (var i = 0; i < l.length; i++) {
                if (l[i] != null && l[i].temporallyHidden != true) {
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
            if (DrawTool.timeToggledOn) return

            $(this).find('.drawToolFileEdit').removeClass('shown')
            var fileId = parseInt($(this).attr('file_id'))
            var l = L_.layers.layer['DrawTool_' + fileId]
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
                        if (l[i].isLinework) {
                            const geoColor = F_.getIn(
                                style,
                                'geologic.color',
                                null
                            )
                            color =
                                geoColor != null
                                    ? F_.colorCodeToColor(geoColor)
                                    : color
                        }
                        layers[Object.keys(layers)[0]].setStyle({ color })
                        layers[Object.keys(layers)[1]].setStyle({ color })
                    } else
                        $('.DrawToolAnnotation_' + fileId).removeClass(
                            'highlight'
                        )
                    if (Map_.activeLayer === l[i]) {
                        $('.DrawToolAnnotation_' + fileId).addClass('hovered')
                    }
                }
            }
        })
        // Select file
        $('.drawToolFileSelector').off('click')
        $('.drawToolFileSelector').on('click', function () {
            // Only select files you own
            const fileId = $(this).attr('file_id')
            var fileFromId = DrawTool.getFileObjectWithId(fileId)

            if (
                mmgisglobal.user !== fileFromId.file_owner &&
                fileFromId &&
                F_.diff(fileFromId.file_owner_group, DrawTool.userGroups)
                    .length == 0
            ) {
                // Now check public list_edit
                if (
                    !(
                        (fileFromId.public == '1' &&
                            fileFromId.publicity_type == 'all_edit') ||
                        (fileFromId.public == '1' &&
                            fileFromId.publicity_type == 'list_edit' &&
                            fileFromId.public_editors != null &&
                            typeof fileFromId.public_editors.includes ===
                                'function' &&
                            fileFromId.public_editors.includes(
                                mmgisglobal.user
                            ))
                    )
                )
                    return
            }

            const wasOn = $(this).parent().parent().hasClass('checked')

            $('.drawToolFileCheckbox').removeClass('checked')
            $('.drawToolDrawFilesListElem').removeClass('checked')

            let once = false

            $(`.drawToolFileSelector[file_id=${fileId}]`).each((idx, that) => {
                var checkbox = $(that).parent().find('.drawToolFileCheckbox')
                if (!wasOn) {
                    checkbox.addClass('checked')
                    checkbox.addClass('on')
                    checkbox.parent().parent().parent().addClass('checked')

                    if (!once) {
                        var intent = $(that).attr('file_intent')
                        if (DrawTool.intentType != intent) {
                            DrawTool.intentType = intent
                            DrawTool.setDrawing(true)
                        }

                        DrawTool.currentFileId = parseInt(
                            checkbox.attr('file_id')
                        )
                        if (
                            DrawTool.filesOn.indexOf(DrawTool.currentFileId) ==
                            -1
                        )
                            checkbox.click()
                        once = true
                    }
                } else if (!once) {
                    DrawTool.intentType = null
                    DrawTool.switchDrawingType(null)
                    DrawTool.setDrawing(false)
                    DrawTool.currentFileId = null
                    DrawTool.toggleFile(fileId, 'off')
                    once = true
                }
            })
        })

        //Visible File
        $('.drawToolFileCheckbox').off('click')
        $('.drawToolFileCheckbox').on('click', DrawTool.toggleFile)

        if (activeFileId != null) {
            $(`.drawToolFileSelector[file_id=${activeFileId}]`).first().click()
        }
    },
    refreshFile: function (
        id,
        time,
        populateShapesAfter,
        selectedFeatureIds,
        asPublished,
        cb,
        forceGeoJSON,
        dontUpdateSourceGeoJSON
    ) {
        let parsedId =
            typeof parseInt(id) === 'number' && !Array.isArray(id)
                ? parseInt(id)
                : 'master'
        //Can't refresh what isn't there
        if (
            parsedId != 'master' &&
            L_.layers.layer.hasOwnProperty('DrawTool_' + parsedId) == false
        )
            return

        var body = {
            id: JSON.stringify(id),
            time: time,
        }
        if (asPublished == true) body.published = true

        if (forceGeoJSON) {
            keepGoing(
                {
                    geojson: forceGeoJSON,
                },
                parsedId,
                selectedFeatureIds,
                dontUpdateSourceGeoJSON
            )
        } else {
            DrawTool.getFile(
                body,
                (function (index, selectedFeatureIds) {
                    return function (data) {
                        keepGoing(data, index, selectedFeatureIds)
                    }
                })(parsedId, selectedFeatureIds)
            )
        }

        function keepGoing(
            data,
            index,
            selectedFeatureIds,
            dontUpdateSourceGeoJSON
        ) {
            var layerId = 'DrawTool_' + index
            //Remove it first
            if (L_.layers.layer.hasOwnProperty(layerId)) {
                for (var i = 0; i < L_.layers.layer[layerId].length; i++) {
                    //Close any popups/labels
                    var popupLayer = L_.layers.layer[layerId][i]
                    DrawTool.removePopupsFromLayer(popupLayer)
                    Map_.rmNotNull(L_.layers.layer[layerId][i])
                    L_.layers.layer[layerId][i] = null
                }
                //And from the Globe
                Globe_.litho.removeLayer('camptool_' + layerId)
            }

            let features = data.geojson.features
            if (dontUpdateSourceGeoJSON != true)
                DrawTool.fileGeoJSONFeatures[index] = features

            let coreFeatures = JSON.parse(JSON.stringify(data.geojson))
            coreFeatures.features = []

            for (var i = 0; i < features.length; i++) {
                if (!features[i].properties.hasOwnProperty('style')) {
                    features[i].properties.style = F_.clone(
                        DrawTool.defaultStyle
                    )
                    if (features[i].geometry.type.toLowerCase() == 'point')
                        features[i].properties.style.fillOpacity = 1
                }
                const style = features[i].properties.style

                if (features[i].properties.arrow === true) {
                    const c = features[i].geometry.coordinates
                    const start = new L.LatLng(c[0][1], c[0][0])
                    const end = new L.LatLng(c[1][1], c[1][0])

                    L_.addArrowToMap(
                        layerId,
                        start,
                        end,
                        features[i].properties.style,
                        features[i]
                    )
                } else if (features[i].properties.annotation === true) {
                    L_.createAnnotation(
                        features[i],
                        'DrawToolAnnotation',
                        layerId,
                        id,
                        features[i].properties._.id,
                        true
                    )

                    DrawTool.refreshNoteEvents()
                } else if (features[i].geometry.type === 'Point') {
                    L_.layers.layer[layerId].push(
                        LayerGeologic.createSymbolMarker(
                            features[i].geometry.coordinates[1],
                            features[i].geometry.coordinates[0],
                            features[i].properties.style
                        ).addTo(Map_.map)
                    )
                    L_.layers.layer[layerId][
                        L_.layers.layer[layerId].length - 1
                    ].feature = features[i]
                } else if (features[i].geometry.type === 'LineString') {
                    L_.layers.layer[layerId].push(
                        LayerGeologic.createLinework(features[i], style).addTo(
                            Map_.map
                        )
                    )
                } else {
                    L_.layers.layer[layerId].push(
                        L.geoJson(
                            {
                                type: 'FeatureCollection',
                                features: [features[i]],
                            },
                            {
                                // eslint-disable-next-line
                                style: function (feature) {
                                    if (
                                        feature.properties.style?.geologic &&
                                        typeof LayerGeologic.getUrl ===
                                            'function'
                                    ) {
                                        const style = feature.properties.style
                                        const g = style.geologic

                                        const fillImage =
                                            LayerGeologic.getFillPattern(
                                                LayerGeologic.getUrl(
                                                    g.type,
                                                    LayerGeologic.getTag(
                                                        g.tag,
                                                        g.color
                                                    )
                                                ),
                                                g.size,
                                                g.fillColor
                                                    ? g.fillColor[0] === '#'
                                                        ? F_.hexToRGBA(
                                                              g.fillColor,
                                                              g.fillOpacity ==
                                                                  null
                                                                  ? 1
                                                                  : g.fillOpacity
                                                          )
                                                        : g.fillColor || 'none'
                                                    : 'none',
                                                L_.Map_.map
                                            )

                                        return {
                                            ...feature.properties.style,
                                            fillPattern: fillImage,
                                        }
                                    }
                                    return feature.properties.style
                                },
                            }
                        ).addTo(Map_.map)
                    )
                }

                if (features[i].properties.arrow !== true) {
                    var last = L_.layers.layer[layerId].length - 1
                    var llast = L_.layers.layer[layerId][last]
                    var layer

                    if (llast.hasOwnProperty('_layers'))
                        layer = llast._layers[Object.keys(llast._layers)[0]]
                    else {
                        layer = Object.assign({}, llast)
                    }
                    coreFeatures.features.push(layer.feature)
                }
            }

            if (coreFeatures.features.length > 0) {
                // 3D doesn't support patterns yet so we'll reset their polygon fills to 0
                const coreFeaturesNormalized = []
                coreFeatures.features.forEach((f) => {
                    const feat = JSON.parse(JSON.stringify(f))
                    if (feat.properties?.style?.geologic?.type === 'pattern')
                        feat.properties.style.fillOpacity = 0
                    coreFeaturesNormalized.push(feat)
                })
                Globe_.litho.addLayer('clamped', {
                    name: 'camptool_' + layerId,
                    on: true,
                    geojson: F_.getBaseGeoJSON(coreFeaturesNormalized),
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

            L_.enforceVisibilityCutoffs([layerId])
            DrawTool.maintainLayerOrder()
            DrawTool.timeFilterDrawingLayer(index)

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
        asPublished,
        forcePopulateShapes
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
            if (DrawTool.currentFileId == id) {
                $(`.drawToolFileSelector[file_id=${id}]`).click()
            }

            DrawTool.filesOn = DrawTool.filesOn.filter(function (v) {
                return v !== id
            })

            if (!argumented) {
                DrawTool.populateShapes()
                //Change icon
                $(`.drawToolFileCheckbox[file_id=${id}]`).removeClass('on')
                $(`.drawToolFileCheckbox[file_id=${id}]`)
                    .parent()
                    .parent()
                    .parent()
                    .removeClass('on')
            }
            //Remove each feature in its group
            if (L_.layers.layer.hasOwnProperty(layerId)) {
                for (var i = 0; i < L_.layers.layer[layerId].length; i++) {
                    Map_.rmNotNull(L_.layers.layer[layerId][i])
                }
                //And from the Globe
                Globe_.litho.removeLayer('camptool_' + layerId)
            }

            DrawTool.refreshMasterCheckbox()

            if (forcePopulateShapes) {
                $(`.drawToolContextMenuHeaderClose[file_id=${id}]`).click()
                DrawTool.populateShapes()
            }
        } else {
            //ON
            DrawTool.filesOn.push(id)

            if (!argumented) {
                //Change icon
                $(`.drawToolFileCheckbox[file_id=${id}]`).addClass('on')
                $(`.drawToolFileCheckbox[file_id=${id}]`)
                    .parent()
                    .parent()
                    .parent()
                    .addClass('on')
            }
            //Get the file if we don't already have it
            L_.layers.layer[layerId] = []
            DrawTool.refreshFile(
                id == 'master' ? DrawTool.masterFileIds : id,
                null,
                populateShapesAfter != null ? populateShapesAfter : !argumented,
                null,
                asPublished
            )
        }
        DrawTool.lastToggledFileId = id
    },
    toggleLabels: function (file_id) {
        var l = L_.layers.layer['DrawTool_' + file_id]
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
                if (file && file.intent === DrawTool.intentOrder[i]) {
                    for (var e of L_.layers.layer[
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
            var shape = L_.layers.layer[layer][index]
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
    getGroupingIcons: function (groupingType) {
        let iconClassOpen = ''
        let iconClassClosed = ''
        switch (groupingType) {
            case 'folders':
                iconClassOpen = 'mdi-folder-open'
                iconClassClosed = 'mdi-folder-outline'
                break
            case 'efolders':
                iconClassOpen = 'mdi-folder-open'
                iconClassClosed = 'mdi-folder-upload-outline'
                break
            case 'tags':
                iconClassOpen = 'mdi-tag-text'
                iconClassClosed = 'mdi-tag-text-outline'
                break
            case 'author':
                iconClassOpen = 'mdi-folder-open'
                iconClassClosed = 'mdi-folder-account'
                break
            case 'alphabetical':
                iconClassOpen = 'mdi-alphabetical-variant'
                iconClassClosed = 'mdi-alphabetical'
                break
            default:
                iconClassOpen = 'mdi-folder-open'
                iconClassClosed = 'mdi-folder-outline'
                break
        }

        return { open: iconClassOpen, closed: iconClassClosed }
    },
    recalculateFolderCounts: function () {
        $(`.drawToolDrawFilesGroupElem`).each(function (idx, item) {
            let count = 0
            $(item)
                .find(`.drawToolDrawFilesGroupListElem > li`)
                .each(function (idx2, item2) {
                    if ($(item2).attr('visible') === 'true') count++
                })
            const countElm = $(item).find(`.drawToolDrawFilesGroupElemCount`)
            countElm.attr('count', count)
            countElm.text(`${count === 0 ? '' : count}`)

            if (count === 0) {
                $(item).addClass('drawToolHideEmptyGroup')
            } else $(item).removeClass('drawToolHideEmptyGroup')
        })
    },
}

export default Files
