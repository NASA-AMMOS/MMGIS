//Assumes mmgisglobal set
var calls = {}

if (mmgisglobal.SERVER == 'apache') {
    calls = {
        getbands: {
            type: 'POST',
            url: 'scripts/essence/Tools/Measure/get_profile.php',
        },
        getprofile: {
            type: 'POST',
            url: 'scripts/essence/Tools/Measure/get_profile.php',
            pathprefix: '../../../../',
        },
    }
} else if (mmgisglobal.SERVER == 'node') {
    calls = {
        getbands: {
            type: 'POST',
            url: 'api/utils/getbands',
        },
        getprofile: {
            type: 'POST',
            url: 'api/utils/getprofile',
            pathprefix: '',
        },
        draw_add: {
            type: 'POST',
            url: '/API/draw/add',
        },
        draw_edit: {
            type: 'POST',
            url: '/API/draw/edit',
        },
        draw_remove: {
            type: 'POST',
            url: '/API/draw/remove',
        },
        draw_undo: {
            type: 'POST',
            url: '/API/draw/undo',
        },
        files_getfiles: {
            type: 'POST',
            url: '/API/files/getfiles',
        },
        files_getfile: {
            type: 'POST',
            url: '/API/files/getfile',
        },
        files_make: {
            type: 'POST',
            url: '/API/files/make',
        },
        files_remove: {
            type: 'POST',
            url: '/API/files/remove',
        },
        files_restore: {
            type: 'POST',
            url: '/API/files/restore',
        },
        files_change: {
            type: 'POST',
            url: '/API/files/change',
        },
        files_gethistory: {
            type: 'POST',
            url: '/API/files/gethistory',
        },
        shortener_shorten: {
            type: 'POST',
            url: '/API/shortener/shorten',
        },
        shortener_expand: {
            type: 'POST',
            url: '/API/shortener/expand',
        },
        clear_test: {
            type: 'POST',
            url: '/API/draw/clear_test',
        },
    }
} else {
    console.warn('Unknown SERVER: ' + mmgisglobal.SERVER)
}

calls.api = function(call, data, success, error) {
    if (mmgisglobal.SERVER != 'node') {
        console.warn('calls.api is only for node servers')
        if (typeof error === 'function') error()
        return
    }
    if (calls[call] == null) {
        console.warn('Unknown api call: ' + call)
        if (typeof error === 'function') error()
        return
    }

    if (mmgisglobal.test === true) data.test = true

    $.ajax({
        type: calls[call].type,
        url: calls[call].url,
        data: data,
        success: function(data) {
            if (
                !data.hasOwnProperty('status') ||
                (data.hasOwnProperty('status') && data.status == 'success')
            ) {
                if (typeof success === 'function') success(data)
            } else {
                if (mmgisglobal.test && typeof success === 'function') success()
                else if (typeof error === 'function') error()
            }
        },
        error: function() {
            console.warn('error')
            if (typeof error === 'function') error()
        },
    })
}
