import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'

import CursorInfo from '../../Ancillary/CursorInfo'
import Modal from '../../Ancillary/Modal'
import Dropy from '../../../external/Dropy/dropy'
import tippy from 'tippy.js'
import shp from '../../../external/shpjs/shapefile'

import DrawTool_Templater from './DrawTool_Templater'

import './DrawTool_FileModal.css'

const DrawTool_FileModal = {
    newFileModalTemplateIndex: 0,
    newFileModal: function (DrawTool, cb) {
        // prettier-ignore
        const modalContent = [
            "<div class='drawToolFileModal'>",
                "<div id='drawToolFileModalHeading'>",
                    "<div>",
                        "<i class='mdi mdi-file-plus mdi-24px'></i>",
                        "<div id='drawToolFileModalHeadingName'>",
                            "New File",
                        "</div>",
                    "</div>",
                    "<div id='drawToolFileUpload'>",
                        "Upload",
                        "<i class='mdi mdi-upload mdi-18px'></i>",
                        "<input title='Upload' type=file accept='.json, .geojson, .rksml, .shp, .dbf' multiple>",
                    "</div>",
                    "<div id='drawToolDrawFilesNewLoading'><div></div></div>",
                "</div>",
                "<div id='drawToolFileModalBody'>",
                    "<div class='flexbetween'>",
                        "<div id='drawToolFileModalBodyName'>",
                            "<div><div>File Name</div></div>",
                            "<input class='drawToolFileModalName' placeholder='Enter a new filename' type='text' value=''></input>",
                        "</div>",
                        "<div id='drawToolFileModalBodyTemplate'>",
                            "<div>Property Template<i id='drawToolFileModalBodyTemplateInfo' class='mdi mdi-information mdi-14px'></i></div>",
                            "<div>",
                                "<div id='drawToolFileModalTemplateDropdown' class='ui dropdown short'></div>",
                                "<span>or</span>",
                                "<div id='drawToolFileModalTemplateNew' class='drawToolButton1'>NEW</div>",
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div id='drawToolFileModelUploadedFrom'></div>",
                    "<div id='drawToolFileModalTemplateContainer'></div>",
                "</div>",
                "<div id='drawToolFileModalActions'>",
                    "<div id='drawToolFileModalActionsCancel' class='drawToolButton1'>Cancel</div>",
                    "<div id='drawToolFileModalActionsCreate' class='drawToolButton1'>CREATE</div>",
                "</div>",
            "</div>"
        ].join('\n')
        const templates = DrawTool.vars.templates || {}

        let allTemplates = {}
        if (DrawTool.files) {
            DrawTool.files.forEach((f) => {
                if (
                    f.template != null &&
                    f.template.name != null &&
                    f.template.template != null
                ) {
                    allTemplates[f.template.name] = f.template.template
                }
            })
        }

        const templateItems = ['NONE']
            .concat(Object.keys(templates))
            .concat(Object.keys(allTemplates).sort())

        allTemplates = {
            ...allTemplates,
            ...JSON.parse(JSON.stringify(templates || {})),
        }

        let body = false
        Modal.remove()
        Modal.set(modalContent, function () {
            tippy('#drawToolFileModalBodyTemplateInfo', {
                content: `Assign a form to this file that each feature's properties must conform to.`,
                placement: 'right',
                theme: 'blue',
            })

            //Upload
            $('#drawToolFileUpload > input').on('change', function (evt) {
                $('#drawToolDrawFilesNewLoading').css('opacity', '1')
                $('#drawToolFileUpload > i').css('color', '#1169d3')

                var files = evt.target.files // FileList object

                // use the 1st file from the list
                var f = files[0]
                var ext = F_.getExtension(f.name).toLowerCase()
                switch (ext) {
                    case 'shp':
                    case 'dbf':
                        var shpFile
                        var dbfFile
                        for (var i = 0; i < files.length; i++) {
                            if (
                                F_.getExtension(files[i].name).toLowerCase() ==
                                'shp'
                            )
                                shpFile = files[i]
                            if (
                                F_.getExtension(files[i].name).toLowerCase() ==
                                'dbf'
                            )
                                dbfFile = files[i]
                        }
                        if (shpFile && dbfFile) {
                            var shpBuffer
                            var dbfBuffer

                            var readerSHP = new FileReader()
                            readerSHP.onload = function (e) {
                                shpBuffer = e.target.result
                                var readerDBF = new FileReader()
                                readerDBF.onload = function (e) {
                                    dbfBuffer = e.target.result
                                    bothLoaded()
                                }
                                readerDBF.readAsArrayBuffer(dbfFile)
                            }
                            readerSHP.readAsArrayBuffer(shpFile)

                            function bothLoaded() {
                                var featureArray = []
                                shp.open(shpBuffer, dbfBuffer)
                                    .then((source) =>
                                        source
                                            .read()
                                            .then(function log(result) {
                                                if (result.done) {
                                                    var geojsonResult =
                                                        F_.getBaseGeoJSON()
                                                    geojsonResult.features =
                                                        featureArray
                                                    body = {
                                                        file_name: f.name,
                                                        intent: 'all',
                                                        geojson:
                                                            JSON.stringify(
                                                                geojsonResult
                                                            ),
                                                    }
                                                    uploaded(body, f)
                                                    return
                                                }

                                                featureArray.push(
                                                    F_.geoJSONFeatureMetersToDegrees(
                                                        result.value
                                                    )
                                                )
                                                return source.read().then(log)
                                            })
                                    )
                                    .catch((error) => {
                                        endLoad()
                                    })
                            }
                        } else {
                            CIU('Warning! FileManager - missing .shp or .dbf')
                        }
                        break
                    case 'json':
                    case 'geojson':
                        var reader = new FileReader()
                        // Closure to capture the file information.

                        reader.onload = (function (file) {
                            return function (e) {
                                body = {
                                    file_name: file.name,
                                    intent: 'all',
                                    geojson: e.target.result,
                                }
                                if (
                                    body.geojson &&
                                    JSON.parse(body.geojson).type !==
                                        'FeatureCollection'
                                ) {
                                    CIU(
                                        'Uploaded object has no type: "FeatureCollection". Are you sure this is geojson?'
                                    )
                                    return
                                }
                                uploaded(body, file)
                            }
                        })(f)

                        // Read in the image file as a data URL.
                        reader.readAsText(f)
                        break
                    case 'rksml':
                        const readerRKSML = new FileReader()
                        // Closure to capture the file information.

                        readerRKSML.onload = (function (file) {
                            return function (e) {
                                let rksmlBody = {
                                    to: 'geojson',
                                    abbreviated: true,
                                    rksml: e.target.result,
                                }

                                $.ajax({
                                    type: 'POST',
                                    url: `${
                                        window.mmgisglobal.ROOT_PATH
                                            ? window.mmgisglobal.ROOT_PATH + '/'
                                            : ''
                                    }API/rksml/convert`,
                                    data: rksmlBody,
                                    xhrFields: {
                                        withCredentials: true,
                                    },
                                    success: function (data) {
                                        if (
                                            data &&
                                            data.type !== 'FeatureCollection'
                                        ) {
                                            CIU(
                                                'RKSML failed to convert into GeoJSON.'
                                            )
                                            return
                                        }

                                        body = {
                                            file_name: file.name,
                                            intent: 'all',
                                            geojson: JSON.stringify(data),
                                        }

                                        uploaded(body, file)
                                    },
                                    error: function () {
                                        endLoad()
                                    },
                                })
                            }
                        })(f)

                        // Read in the image file as a data URL.
                        readerRKSML.readAsText(f)
                        break
                    default:
                        CIU(
                            'Only .json, .geojson, .rksml and .shp (with .dbf) files may be uploaded'
                        )
                }

                function uploaded(body, file) {
                    $('#drawToolFileModelUploadedFrom').text(
                        `Uploaded from: ${body.file_name} (${F_.humanFileSize(
                            file.size
                        )})`
                    )
                    $('.drawToolFileModalName').val(
                        (body.file_name || '').replace(/\.[^/.]+$/, '')
                    )
                    if (body?.geojson) {
                        try {
                            const geojson = JSON.parse(body.geojson)
                            const templateFromThisFeature =
                                geojson.features[0] || null
                            DrawTool_Templater.renderDesignTemplate(
                                'drawToolFileModalTemplateContainer',
                                null,
                                true,
                                templateFromThisFeature
                            )
                        } catch (err) {}
                    }
                    endLoad()
                }

                function endLoad() {
                    $('#drawToolDrawFilesNewLoading').css('opacity', '0')
                    $('#drawToolFileUpload > i').css('color', 'unset')
                }
                function CIU(message) {
                    CursorInfo.update(
                        message,
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    endLoad()
                }
            })

            DrawTool_FileModal.newFileModalTemplateIndex = 0
            $('#drawToolFileModalTemplateDropdown').html(
                Dropy.construct(
                    templateItems,
                    'Templates',
                    DrawTool_FileModal.newFileModalTemplateIndex,
                    {
                        openUp: false,
                        dark: true,
                    }
                )
            )
            Dropy.init($('#drawToolFileModalTemplateDropdown'), function (idx) {
                DrawTool_FileModal.newFileModalTemplateIndex = idx

                DrawTool_Templater.renderDesignTemplate(
                    'drawToolFileModalTemplateContainer',
                    {
                        name: templateItems[idx],
                        template: allTemplates[templateItems[idx]],
                    }
                )
            })

            $('#drawToolFileModalTemplateNew').on('click', function () {
                DrawTool_Templater.renderDesignTemplate(
                    'drawToolFileModalTemplateContainer'
                )
            })

            $('#drawToolFileModalActionsCreate').on('click', function () {
                const val = $('.drawToolFileModalName').val()
                const intent = 'all'
                //templateItems[DrawTool_FileModal.newFileModalTemplateIndex]
                if (val == null || val === '') {
                    CursorInfo.update(
                        'Please enter a file name.',
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    return
                }
                if (/[&\'\"<>]/g.test(val)) {
                    CursorInfo.update(
                        'Invalid file name.',
                        6000,
                        true,
                        { x: 305, y: 6 },
                        '#e9ff26',
                        'black'
                    )
                    return
                }
                let chosenTemplate =
                    templateItems[DrawTool_FileModal.newFileModalTemplateIndex]
                if (chosenTemplate === 'NONE') chosenTemplate = null
                else {
                    if (templates[chosenTemplate] != null)
                        chosenTemplate = JSON.stringify({
                            name: chosenTemplate,
                            template: templates[chosenTemplate],
                        })
                    else chosenTemplate = null
                }

                let finalBody
                if (body !== false) {
                    finalBody = body
                    finalBody.file_name = val || 'New File'
                    finalBody.template = chosenTemplate
                } else
                    finalBody = {
                        file_name: val || 'New File',
                        intent: intent,
                        template: chosenTemplate,
                    }

                const designedTemplate = DrawTool_Templater.getDesignedTemplate(
                    'drawToolFileModalTemplateContainer',
                    allTemplates
                )
                if (designedTemplate === true) {
                    // Do nothing and continue; user was not designing a new template
                } else if (designedTemplate === false) {
                    // User was designing, but it had errors
                    return
                } else {
                    finalBody.template = JSON.stringify(designedTemplate)
                }

                DrawTool.makeFile(finalBody, function (file_id) {
                    DrawTool.populateFiles(file_id)

                    Modal.remove()
                    $('.drawToolFileModalName').val('')
                })
            })

            $('#drawToolFileModalActionsCancel').on('click', function () {
                Modal.remove()
                $('.drawToolFileModalName').val('')
            })

            if (typeof cb === 'function') cb()
        })
    },
}

export default DrawTool_FileModal
