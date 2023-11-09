import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'
import Globe_ from '../../Basics/Globe_/Globe_'
import Login from '../../Ancillary/Login/Login'
import CursorInfo from '../../Ancillary/CursorInfo'
import shp from '../../../external/shpjs/shapefile'

var userfiles = {}

// prettier-ignore
var markup = [
    "<div id='fileManagerTool' style='display: inline-flex; white-space: nowrap; justify-content: flex-start; padding: 5px;'>",
      "<div id='fileManagerToolBar' style='width: 30px;'>",
        "<div id='fileManagerToolBarTools' class='mmgisRadioBarVertical'>",
          "<div id='fileManagerToolBarAllFiles' title='All Files' class='active'><i class='mdi mdi-folder mdi-24px' style='position: absolute;'></i></div>",
          "<div id='fileManagerToolBarMyFiles' title='My Files'><i class='mdi mdi-folder-account mdi-24px' style='position: absolute;'></i></div>",
        "</div>",
        "<div id='fileManagerToolBarTools' class='mmgisRadioBarVertical' style='padding-top: 25px;'>", 
          "<div id='fileManagerToolBarAdd' title='New File'><i class='mdi mdi-file-plus mdi-24px' style='position: absolute;'></i></div>",
          "<div id='fileManagerToolBarUpload' title='Upload'><i class='mdi mdi-upload mdi-24px' style='position: absolute;'></i></div>",
          "<input id='fileManagerUpload' title='Upload' type=file name='files[]' size=30 style='opacity: 0; height: 27px; width: 30px; position: relative; top: -33px;' multiple>",
          "<div id='fileManagerToolDownload' title='Download'><i class='mdi mdi-download mdi-24px' style='position: relative; top: -33px;'></i></div>",
        "</div>",
        "<div id='fileManagerToolBarTools' class='mmgisRadioBarVertical' style='margin-top: -13px;'>",
          "<div id='fileManagerToolBarRefresh' title='Refresh'><i class='mdi mdi-refresh mdi-24px' style='position: absolute;'></i></div>",
          "<div id='fileManagerToolBarAllOff' title='All Off'><i class='mdi mdi-layers-off mdi-24px' style='position: absolute;'></i></div>",
        "</div>",
      "</div>",
      "<div id='fileManagerContent' style='padding: 0px 5px; display: inline-flex;'>",
        "<div id='fileManagerContentFiles' style='width: 250px;'>",
          "<div id='fmcfHeader' class='ui action inverted input'>",
            "<input id='fileManagerContentSearch' type='text' placeholder='Search' style='padding: 0px 0px 6px 0px; font-size: 14px; background-color: transparent; color: white;' value=''></input>",
          "</div>",
          "<ul id='fmcfList' class='mmgisScrollbar' style='list-style-type: none; padding: 0; margin: 0; height: 220px; overflow-y: auto;'></ul>",
        "</div>",
        "<div id='fileManagerContentProperties' style='width: 250px; margin-left: 7px;'>",
        "</div>",
      "</div>",
    "</div>"
  ];

var FileManagerTool = {
    height: 250,
    width: 293,
    widths: [293, 552],
    lastShowUserFiles: true,
    filterString: '',
    activeFileId: null,
    container: null,
    buttonCont: null,
    userCont: null,
    fileCont: null,
    optionCont: null,
    activeoptions: { user: null, filename: null },
    init: function () {
        markup = markup.join('\n')
    },
    make: function (TC_) {
        this.T_ = TC_

        var tools = d3.select('#tools')
        tools.selectAll('*').remove()

        tools = tools
            .append('div')
            .attr('class', 'ui padded grid mmgisScrollbar')
            .style('height', '100%')
        tools.html(markup)

        setupInterface()
        //setupInterfaceOLD();

        $.ajax({
            type: 'POST',
            url: 'scripts/essence/Tools/FileManager/getalluserswithfiles.php',
            data: {
                master: L_.masterdb,
                mission: L_.mission,
                username: Login.username,
            },
            success: function (data) {
                userfiles = JSON.parse(data)
                if (Array.isArray(userfiles)) {
                    userfiles = {}
                }
                if (
                    Login.username &&
                    !userfiles.hasOwnProperty(Login.username)
                ) {
                    userfiles[Login.username] = {}
                }
                //buildFromUserFiles();
                showUsersFiles(true)
            },
        })
    },
    destroy: function () {},
    moveTo: function (div) {},
}

function setupInterface() {
    FileManagerTool.fileCont = d3.select('#fmcfList')
    FileManagerTool.optionCont = d3.select('#fileManagerContentProperties')

    //All Files
    $('#fileManagerToolBarAllFiles').on('click', function () {
        $(this).addClass('active')
        $('#fileManagerToolBarMyFiles').removeClass('active')
        showUsersFiles(true)
    })

    //My Files
    $('#fileManagerToolBarMyFiles').on('click', function () {
        if (Login.username) {
            $(this).addClass('active')
            $('#fileManagerToolBarAllFiles').removeClass('active')
            showUsersFiles(Login.username)
        } else CursorInfo.update("You're not logged in.", 2500, true)
    })

    //Search
    $('#fileManagerContentSearch').on('input', function () {
        FileManagerTool.filterString = $(this).val()
        showUsersFiles(FileManagerTool.lastShowUserFiles)
    })

    //Upload
    $('#fileManagerUpload').on('change', function (evt) {
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
                    if (F_.getExtension(files[i].name).toLowerCase() == 'shp')
                        shpFile = files[i]
                    if (F_.getExtension(files[i].name).toLowerCase() == 'dbf')
                        dbfFile = files[i]
                }
                if (shpFile && dbfFile) {
                    var shpBuffer
                    var dbfBuffer

                    var readerSHP = new FileReader()
                    readerSHP.onload = function (e) {
                        shpBuffer = e.target.result
                        var readerDBF = new FileReader()
                        readerSHP.onload = function (e) {
                            dbfBuffer = e.target.result
                            bothLoaded()
                        }
                        readerSHP.readAsArrayBuffer(dbfFile)
                    }
                    readerSHP.readAsArrayBuffer(shpFile)

                    function bothLoaded() {
                        var featureArray = []
                        shp.open(shpBuffer, dbfBuffer)
                            .then((source) =>
                                source.read().then(function log(result) {
                                    if (result.done) {
                                        var geojsonResult = F_.getBaseGeoJSON()
                                        geojsonResult.Features = featureArray
                                        createFile(f.name, geojsonResult)
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
                            .catch((error) => console.error(error.stack))
                    }
                } else {
                    console.warn('Warning! FileManager - missing .shp or .dbf')
                }
                break
            default:
                var reader = new FileReader()
                // Closure to capture the file information.
                reader.onload = (function (theFile) {
                    return function (e) {
                        createFile(theFile.name, e.target.result)
                    }
                })(f)
                // Read in the image file as a data URL.
                reader.readAsText(f)
        }
    })

    //Other
    $('#fileManagerToolBarAdd').on('click', createFile)
    $('#fileManagerToolDownload').on('click', downloadThisFile)
    $('#fileManagerToolBarRefresh').on('click', refreshAllFiles)
    $('#fileManagerToolBarAllOff').on('click', removeAllFiles)
}

function setupInterfaceOLD() {
    FileManagerTool.container = d3
        .select('#tools')
        .append('div')
        .attr('class', 'ui padded grid unselectable')
        .style('padding-bottom', '12px')
        .style('height', '100%')

    FileManagerTool.buttonCont = FileManagerTool.container
        .append('div')
        .attr('class', 'two wide column')
        .style('border-right', '2px solid #00A3CC')
        .style('padding', '0px 7px 14px 7px')

    FileManagerTool.buttonCont = FileManagerTool.buttonCont
        .append('div')
        .style('text-align', 'center')

    FileManagerTool.buttonCont
        .append('div')
        .attr('id', 'fmMyFiles')
        .attr('class', 'mmgisButton')
        .style('width', '90%')
        .html('My Files')
    FileManagerTool.buttonCont
        .append('div')
        .attr('id', 'fmCreate')
        .attr('class', 'mmgisButton')
        .style('width', '90%')
        .html('Create')
    FileManagerTool.buttonCont
        .append('div')
        .attr('id', 'fmRefresh')
        .attr('class', 'mmgisButton')
        .style('width', '90%')
        .html('Refresh')
    FileManagerTool.buttonCont
        .append('div')
        .attr('id', 'fmRemoveAll')
        .attr('class', 'mmgisButton')
        .style('width', '90%')
        .html('Remove All')

    FileManagerTool.userCont = FileManagerTool.container
        .append('div')
        .attr('class', 'five wide column')
        .style('padding', '0px 7px 14px 7px')
    FileManagerTool.userCont
        .append('div')
        .style('font-size', '18px')
        .style('border-bottom', '2px solid #1f7493')
        .style('color', '#EEE')
        .html('Users')
    FileManagerTool.userCont = FileManagerTool.userCont
        .append('div')
        .attr('id', 'fmUserList')
        .attr('class', 'ui middle aligned selection list mmgisScrollbar')
        .style('margin-top', '0px')
        .style('overflow-y', 'auto')
        .style('height', '100%')

    FileManagerTool.fileCont = FileManagerTool.container
        .append('div')
        .attr('class', 'five wide column')
        .style('padding', '0px 7px 14px 7px')
    FileManagerTool.fileCont
        .append('div')
        .style('font-size', '18px')
        .style('border-bottom', '2px solid #1f7493')
        .style('color', '#EEE')
        .html('Files')
    FileManagerTool.fileCont = FileManagerTool.fileCont
        .append('div')
        .attr('id', 'fmFileList')
        .attr('class', 'ui middle aligned selection list mmgisScrollbar')
        .style('margin-top', '0px')
        .style('overflow-y', 'auto')
        .style('height', '100%')

    FileManagerTool.optionCont = FileManagerTool.container
        .append('div')
        .attr('class', 'four wide column')
        .style('padding', '0px 7px 14px 7px')
    FileManagerTool.optionCont
        .append('div')
        .style('font-size', '18px')
        .style('border-bottom', '2px solid #1f7493')
        .style('color', '#EEE')
        .html('Properties')
    FileManagerTool.optionCont = FileManagerTool.optionCont
        .append('div')
        .attr('class', 'mmgisScrollbar')
        .style('overflow-y', 'auto')
        .style('height', '100%')

    $('#fmCreate').on('click', createFile)
    $('#fmRefresh').on('click', refreshAllFiles)
    $('#fmRemoveAll').on('click', removeAllFiles)
}

function buildFromUserFiles() {
    for (var u in userfiles) {
        FileManagerTool.userCont
            .append('div')
            .attr('id', 'fmUser_' + u.replace(/[^\w\s]/gi, '_'))
            .attr('class', 'item customColor1')
            .style('border-bottom', '1px solid #666')
            .style('box-shadow', function () {
                return u == Login.username
                    ? 'inset 0px 0px 0px 2px rgb(0, 163, 204)'
                    : 'none'
            })
            .style('background-color', '#171717')
            .style('border-radius', '0px')
            .on(
                'click',
                (function (u) {
                    return function () {
                        $('#fmUserList .item').css({
                            'background-color': '#171717',
                        })
                        $(
                            '#fmUserList #fmUser_' + u.replace(/[^\w\s]/gi, '_')
                        ).css({
                            'background-color': 'rgba(18, 66, 84, 0.9)',
                        })
                        hideFilesOptions()
                        showUsersFiles(u)
                    }
                })(u)
            )
            .append('div')
            .attr('class', 'content')
            .append('div')
            .attr('class', 'header')
            .style('color', '#CCC')
            .html(u)
    }

    $('#fmMyFiles').on('click', function () {
        if (Login.username) {
            $('#fmUser_' + Login.username.replace(/[^\w\s]/gi, '_')).click()
        } else {
            CursorInfo.update("You're not logged in.", 2500, true)
        }
    })
}

//user is a user or is true for all users
function showUsersFiles(user) {
    FileManagerTool.lastShowUserFiles = user

    FileManagerTool.fileCont.selectAll('*').remove()
    var subsetUserfiles = userfiles

    if (user !== true) {
        if (userfiles.hasOwnProperty(user)) {
            subsetUserfiles = [subsetUserfiles[user]]
        } else {
            subsetUserfiles = []
            console.warn('User ' + user + ' not found!')
        }
    }

    for (var u in subsetUserfiles) {
        for (var f in subsetUserfiles[u]) {
            if (
                FileManagerTool.filterString.length == 0 ||
                subsetUserfiles[u][f].match(
                    new RegExp(FileManagerTool.filterString, 'i')
                )
            ) {
                var safeId = 'fmFile_' + (u + f).replace(/\w\s/gi, '_')
                var c = FileManagerTool.fileCont
                    .append('li')
                    .attr('id', safeId)
                    .attr('class', 'item customColor1')
                    .style('display', 'flex')
                    .style('border-bottom', '1px solid #333')
                    .style('background-color', 'rgba(0,0,0,0.25)')
                    .style('border-radius', '0px')
                    .style('height', '24px')
                    .style('line-height', '24px')
                    .style('cursor', 'pointer')

                c.append('div')
                    .attr('class', 'content')
                    .style('float', 'left')
                    .style('flex', '1')
                    .append('div')
                    .attr('class', 'header')
                    .style('max-width', '181px')
                    .attr('title', u)
                    .style('color', '#CCC')
                    .html(subsetUserfiles[u][f])
                    .on(
                        'click',
                        (function (u, f, safeId) {
                            return function () {
                                $('#fmcfList .item').css({
                                    'background-color': 'rgba(0,0,0,0.25)',
                                })
                                if (FileManagerTool.activeFileId != safeId) {
                                    $('#fmcfList #' + safeId).css({
                                        'background-color':
                                            'rgba(7,144,173,0.55)',
                                    })

                                    getFileOptions(u, f)
                                    FileManagerTool.activeFileId = safeId
                                } else {
                                    FileManagerTool.T_.setToolWidth(
                                        FileManagerTool.widths[0]
                                    )
                                    hideFilesOptions()
                                    FileManagerTool.activeFileId = null
                                }
                            }
                        })(user !== true ? user : u, f, safeId)
                    )

                //Mark
                $('#' + safeId).unmark({
                    done: function () {
                        if (FileManagerTool.filterString.length > 0)
                            $('#' + safeId).markRegExp(
                                new RegExp(FileManagerTool.filterString, 'i'),
                                {}
                            )
                    },
                })

                var b = c
                    .append('div')
                    .attr('class', 'mmgisRadioBar')
                    .style('height', '16px')
                    .style('float', 'right')
                b.append('div')
                    .attr('id', 'fmFileAdd_' + f.replace(/\w\s/gi, '_'))
                    .style('margin', '0')
                    .style('margin-top', '3px')
                    .style('height', '16px')
                    .style('line-height', '16px')
                    .style(
                        'background-color',
                        L_.addedfiles.hasOwnProperty(f) &&
                            L_.addedfiles[f]['layer'] != null
                            ? '#dfebef'
                            : '#111'
                    )
                    .html(
                        L_.addedfiles.hasOwnProperty(f) &&
                            L_.addedfiles[f]['layer'] != null
                            ? 'on'
                            : 'off'
                    )
                    .on(
                        'click',
                        (function (u, f) {
                            return function () {
                                if (
                                    L_.addedfiles.hasOwnProperty(f) &&
                                    L_.addedfiles[f]['layer'] != null
                                ) {
                                    removeFile(u, f)
                                } else {
                                    addFile(u, f)
                                }
                            }
                        })(user !== true ? user : u, f)
                    )
            }
        }
    }
}

function getFileOptions(u, f) {
    $.ajax({
        type: 'POST',
        url: 'scripts/essence/Tools/FileManager/getproperties.php',
        data: { master: L_.masterdb, mission: L_.mission, filename: f },
        success: function (data) {
            data = JSON.parse(data)[0]
            if (Login.username == u)
                userfiles[Login.username][data['filename']] = data['name']
            showFilesOptions(u, f, data)
        },
    })
}
function showFilesOptions(u, f, data) {
    hideFilesOptions()

    FileManagerTool.T_.setToolWidth(FileManagerTool.widths[1])

    FileManagerTool.activeoptions.user = u
    FileManagerTool.activeoptions.filename = f

    var defaultName = userfiles[u][f]
    var nameChanged = false
    var defaultPublicity = data['public']
    var publicityChanged = false
    var defaultDescription = data['description']
    var descriptionChanged = false

    var c = FileManagerTool.optionCont
        .append('div')
        .style('display', 'flex')
        .style('flex-flow', 'column')
        .style('width', '100%')

    var name = c
        .append('div')
        .attr('class', 'ui inverted input')
        .style('position', 'inherit')
        //.style( 'margin', function() { return ( u == Login.username ) ? '8px 0px 8px 0px' : '8px auto 8px auto'; } )
        .style('width', '100%')
        .style('display', 'inline-flex')
        .style('white-space', 'nowrap')
        .style('text-align', 'left')
    name.append('input')
        .attr('id', 'fmName')
        .attr('type', 'text')
        .attr('value', defaultName)
        .style('background-color', 'transparent')
        .style('width', '140px')
        .style('padding', '0px 0px 6px 0px')
        .style('font-size', '14px')
        .style('margin', '0')
        .style('color', 'white')
    name.append('div')
        .style('width', 'calc( 100% - 140px )')
        .style('padding', '0px 0px 6px 0px')
        .style('white-space', 'nowrap')
        .style('display', 'block')
        .style('overflow', 'hidden')
        .style('text-overflow', 'ellipsis')
        .style('text-align', 'right')
        .style('font-style', 'italic')
        .style('color', '#ddd')
        .attr('title', u)
        .html('by ' + u)

    var desc = c
        .append('div')
        .attr('class', 'field')
        .style('text-align', 'center')
    desc.append('textarea')
        .attr('id', 'fmDescription')
        .attr('class', 'mmgisScrollbar')
        .attr('rows', '7')
        .style('resize', 'vertical')
        .style('width', '100%')
        .style('background-color', '#111')
        .style('margin', '0')
        .style('border', '1px solid #666')
        .style('color', '#CCC')
        .html(defaultDescription)

    if (u == Login.username) {
        var pubdown = c.append('div').style('display', 'inline-block')

        var publicity = pubdown
            .append('div')
            .attr('id', 'fmPublicity')
            .attr('class', 'mmgisRadioBar')
            .style('display', 'inline-block')
            .style('white-space', 'nowrap')
            .style('margin', '0px 0px 4px 0px')
            .style('text-align', 'center')
        publicity
            .append('div')
            .attr('class', function () {
                return data['public'] == '1' ? 'active' : ''
            })
            .html('Public')
        publicity
            .append('div')
            .attr('class', function () {
                return data['public'] == '0' ? 'active' : ''
            })
            .html('Private')

        var savedel = c.append('div').style('display', 'inline-block')

        var save = savedel
            .append('div')
            .attr('id', 'fmSaveChanges')
            .attr('class', 'mmgisButton')
            .style('display', 'inline-block')
            .style('white-space', 'nowrap')
            .style('margin-left', '0px')
            .style('margin-right', '0px')
            .style('width', '180px')
            .style('text-align', 'center')
            .html('Save Changes')
        $('#fmSaveChanges').on('click', saveProperties)

        var del = savedel
            .append('div')
            .attr('id', 'fmDelete')
            .attr('class', 'mmgisButton')
            .style('display', 'inline-block')
            .style('white-space', 'nowrap')
            .style('margin-left', '0px')
            .style('margin-right', '0px')
            .style('width', 'calc( 100% - 184px )')
            .style('text-align', 'center')
            .html('Delete')

        var areyousure = c
            .append('div')
            .attr('id', 'fmDeletePopup')
            .attr('class', 'ui inverted popup transition hidden')
            .attr('data-variation', 'basic')
            .style(
                'background',
                'linear-gradient( to right, #5E1824, #1B1C1D )'
            )
            .html('Are you sure?  ')
        areyousure
            .append('div')
            .attr('class', 'mmgisButton')
            .html('yes')
            .on('click', deleteFile)
        areyousure
            .append('div')
            .attr('class', 'mmgisButton')
            .html('no')
            .on('click', function () {
                $('#fmDelete').popup('hide')
            })

        $('#fmDelete').popup({
            popup: $('#fmDeletePopup'),
            on: 'click',
            hoverable: true,
            position: 'left center',
        })
    }

    //highlight save changes if values are different than defaults
    $('#fmName').on('input', function () {
        if ($(this).val() != defaultName) {
            $('#fmSaveChanges').css({
                'border-color': '#33cc66',
                color: '#26d962',
            })
            nameChanged = true
        } else {
            nameChanged = false
            resetSaveColor()
        }
    })
    $('#fmDescription').on('input', function () {
        if ($(this).val() != defaultDescription) {
            $('#fmSaveChanges').css({
                'border-color': '#33cc66',
                color: '#26d962',
            })
            descriptionChanged = true
        } else {
            descriptionChanged = false
            resetSaveColor()
        }
    })

    $('.mmgisRadioBar#fmPublicity div').click(function () {
        $('.mmgisRadioBar#fmPublicity div').removeClass('active')
        $(this).addClass('active')
        if ($(this).html().toLowerCase() == 'public') {
            if (defaultPublicity == '0') {
                $('#fmSaveChanges').css({
                    'border-color': '#33cc66',
                    color: '#26d962',
                })
                publicityChanged = true
            } else {
                publicityChanged = false
                resetSaveColor()
            }
        } else {
            if (defaultPublicity == '0') {
                publicityChanged = false
                resetSaveColor()
            } else {
                $('#fmSaveChanges').css({
                    'border-color': '#33cc66',
                    color: '#26d962',
                })
                publicityChanged = true
            }
        }
    })

    function resetSaveColor() {
        if (!(nameChanged || descriptionChanged || publicityChanged)) {
            $('#fmSaveChanges').css({
                'border-color': '#666',
                color: '#999',
            })
        }
    }
}

function hideFilesOptions() {
    FileManagerTool.optionCont.selectAll('*').remove()
}

function saveProperties() {
    var propname = $('#fmName').val()
    var propdescription = $('#fmDescription').val()
    var proppublic = $('#fmPublicity .active').html()
    if (proppublic.toLowerCase() == 'private') proppublic = 0
    else proppublic = 1
    $.ajax({
        type: 'POST',
        url: 'scripts/essence/Tools/FileManager/saveproperties.php',
        data: {
            master: L_.masterdb,
            mission: L_.mission,
            username: Login.username,
            filename: FileManagerTool.activeoptions.filename,
            name: propname,
            description: propdescription,
            public: proppublic,
        },
        success: function (data) {
            if (data.toLowerCase().substring(0, 7) == 'success') {
                userfiles[Login.username][
                    FileManagerTool.activeoptions.filename
                ] = propname
                showUsersFiles(Login.username)
                $(
                    '#fmFileList #fmFile_' +
                        (
                            Login.username +
                            FileManagerTool.activeoptions.filename
                        ).replace(/ /g, '_')
                ).css({ 'background-color': 'rgba(18, 66, 84, 0.9)' })
                getFileOptions(
                    Login.username,
                    FileManagerTool.activeoptions.filename
                )
            }
        },
    })
}

//optional name, filedata
function createFile(name, filedata) {
    if (typeof name !== 'string') name = undefined
    name = name || 'New File'
    filedata = filedata || ''
    if (filedata != '') {
        if (typeof filedata == 'string') filedata = JSON.parse(filedata)
        //Force features
        if (filedata.hasOwnProperty('Features')) {
            filedata.features = filedata.Features
            delete filedata.Features
        }
        //Add initial feature
        filedata.features.unshift({
            type: 'Feature',
            properties: { boundingbox: [0, 0, 0, 0], fill: '#000' },
            geometry: { type: 'Polygon', coordinates: [] },
        })

        filedata = F_.GeoJSONStringify(filedata)
    }
    if (!Login.username) {
        CursorInfo.update('You must be logged in to create files.', 2500, true)
        return
    }
    if (canUserCreate(Login.username, name)) {
        $.ajax({
            type: 'POST',
            url: 'scripts/essence/Tools/FileManager/createfile.php',
            data: {
                master: L_.masterdb,
                mission: L_.mission,
                username: Login.username,
                name: name,
                filedata: filedata,
            },
            success: function (data) {
                data = JSON.parse(data)
                if (data['status'] == 'success') {
                    userfiles[Login.username][data['filename']] = name
                    showUsersFiles(Login.username)
                    $(
                        '#fmFileList #fmFile_' +
                            (Login.username + data['filename']).replace(
                                / /g,
                                '_'
                            )
                    ).css({ 'background-color': 'rgba(18, 66, 84, 0.9)' })
                    getFileOptions(Login.username, data['filename'])
                } else {
                    CursorInfo.update(
                        'Failed to create a new file.',
                        2500,
                        true
                    )
                }
            },
        })
    } else {
        CursorInfo.update("You already have a '" + name + ".'", 2500, true)
    }
}

function downloadThisFile() {
    if (
        !FileManagerTool.activeoptions.user ||
        !FileManagerTool.activeoptions.filename
    ) {
        CursorInfo.update('Select a file before downloading.', 2500, true)
        return
    }
    var name =
        userfiles[FileManagerTool.activeoptions.user][
            FileManagerTool.activeoptions.filename
        ]
    if (Login.username == FileManagerTool.activeoptions.user)
        $.ajax({
            type: 'POST',
            url: 'scripts/essence/Tools/FileManager/getfiledata.php',
            data: {
                master: L_.masterdb,
                mission: L_.mission,
                filename: FileManagerTool.activeoptions.filename,
            },
            success: function (data) {
                if (data.length < 3) {
                    delete L_.addedfiles[f]
                    CursorInfo.update('No file data found.', 2500, true)
                    return
                }
                //fine
                data = JSON.parse(JSON.parse(data))
                if (data.hasOwnProperty('Features')) {
                    Object.defineProperty(
                        data,
                        'features',
                        Object.getOwnPropertyDescriptor(data, 'Features')
                    )
                    delete data['Features']
                }

                F_.downloadObject(data, name)
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                delete L_.addedfiles[f]
                CursorInfo.update('Failed to get file data.', 2500, true)
            },
        })
    else CursorInfo.update('You can only download your own files.', 2500, true)
}

function canUserCreate(u, name) {
    if (userfiles.hasOwnProperty(u)) {
        for (f in userfiles[u]) {
            if (userfiles[u][f].toLowerCase() == name.toLowerCase()) {
                return false
            }
        }
    }
    return true
}

function deleteFile() {
    $.ajax({
        type: 'POST',
        url: 'scripts/essence/Tools/FileManager/deletefile.php',
        data: {
            master: L_.masterdb,
            mission: L_.mission,
            filename: FileManagerTool.activeoptions.filename,
        },
        success: function (data) {
            data = JSON.parse(data)
            if (data['status'] == 'success') {
                delete userfiles[Login.username][
                    FileManagerTool.activeoptions.filename
                ]
                hideFilesOptions()
                $('#fmDelete').popup('hide')
                showUsersFiles(Login.username)
            } else {
                CursorInfo.update('Failed to delete file.', 2500, true)
            }
        },
    })
}

function addFile(u, f) {
    L_.addedfiles[f] = {}
    L_.addedfiles[f]['layer'] = 0 //0 means were trying to add
    L_.addedfiles[f]['name'] = userfiles[u][f]
    L_.addedfiles[f]['username'] = u
    $.ajax({
        type: 'POST',
        url: 'scripts/essence/Tools/FileManager/getfiledata.php',
        data: { master: L_.masterdb, mission: L_.mission, filename: f },
        success: function (data) {
            if (data.length < 3) {
                delete L_.addedfiles[f]
                CursorInfo.update('No file data found.', 2500, true)
                return
            }
            //fine
            data = JSON.parse(JSON.parse(data))
            if (data.hasOwnProperty('Features')) {
                Object.defineProperty(
                    data,
                    'features',
                    Object.getOwnPropertyDescriptor(data, 'Features')
                )
                delete data['Features']
            }

            $('#fmFileAdd_' + f.replace(/ /g, '_'))
                .css({ 'background-color': '#dfebef' })
                .html('on')
            //sort data so point features are always on top of lines and lines always on top of polygons
            F_.sortGeoJSONFeatures(data)
            L_.addedfiles[f]['layer'] = L.geoJson(data, {
                style: function (feature) {
                    var props = feature.properties
                    if (!props) props = {}

                    return {
                        color: 'black',
                        radius: 6,
                        opacity: props.opacity || 1,
                        fillColor: props.fill || 'black',
                        fillOpacity: props.fillOpacity || 0.5,
                        color: props.stroke || 'black',
                        weight: props.weight || 2,
                        className: 'spePolygonLayer',
                        pointerEvents: null,
                    }
                },
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng)
                },
                onEachFeature: function (feature, layer) {
                    var props = feature.properties
                    if (!props) props = {}

                    var list =
                        '<dl><dt><b>' +
                        (props.name || '') +
                        '</b></dt><dt>' +
                        (props.description || '') +
                        "</dt><hr style='border: 1px solid #666; margin-bottom: 2px;'><dt style='color: #888; font-size: 14px;'><i>" +
                        userfiles[u][f] +
                        "</i></dt><dt style='color: #888; font-size: 12px; text-align: right;'>–<i>" +
                        u +
                        '</i></dt></dl>'
                    layer.bindPopup(list)
                },
            })
            L_.addedfiles[f]['layer'].addTo(Map_.map)
            Globe_.removeVectorTileLayer('addedfiles_' + f)
            Globe_.addVectorTileLayer({
                id: 'addedfiles_' + f,
                layers: L_.addedfiles[f]['layer']._layers,
            })
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            delete L_.addedfiles[f]
            CursorInfo.update('Failed to get file data.', 2500, true)
        },
    })
}

function refreshAllFiles() {
    var addedfilesClone = {}
    for (f in L_.addedfiles) {
        addedfilesClone[f] = L_.addedfiles[f].username
    }
    for (f in addedfilesClone) {
        removeFile(addedfilesClone[f], f)
        addFile(addedfilesClone[f], f)
    }
}

function removeFile(u, f) {
    if (L_.addedfiles[f]['layer'] != 0) {
        $('#fmFileAdd_' + f.replace(/ /g, '_'))
            .css({ 'background-color': '#111' })
            .html('off')
        if (Map_.map.hasLayer(L_.addedfiles[f]['layer'])) {
            Map_.map.removeLayer(L_.addedfiles[f]['layer'])
        }
        Globe_.removeVectorTileLayer('addedfiles_' + f)
        delete L_.addedfiles[f]
    }
}

function removeAllFiles() {
    for (f in L_.addedfiles) {
        if (L_.addedfiles[f]['layer'] != 0) {
            $('#fmFileAdd_' + f.replace(/ /g, '_'))
                .css({ 'background-color': '#111' })
                .html('off')
            if (Map_.map.hasLayer(L_.addedfiles[f]['layer'])) {
                Map_.map.removeLayer(L_.addedfiles[f]['layer'])
            }
            delete L_.addedfiles[f]
        }
    }
}

FileManagerTool.init()

export default FileManagerTool
