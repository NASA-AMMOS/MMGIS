import $ from 'jquery'

const c = {
    get: {
        type: 'GET',
        url: 'api/configure/get',
    },
    missions: {
        type: 'GET',
        url: 'api/configure/missions',
    },
    login: {
        type: 'POST',
        url: 'api/users/login',
    },
    signup: {
        type: 'POST',
        url: 'api/users/signup',
    },
    logout: {
        type: 'POST',
        url: 'api/users/logout',
    },
    getbands: {
        type: 'POST',
        url: 'api/utils/getbands',
    },
    getprofile: {
        type: 'POST',
        url: 'api/utils/getprofile',
        pathprefix: '',
    },
    getminmax: {
        type: 'POST',
        url: 'api/utils/getminmax',
        pathprefix: '',
    },
    ll2aerll: {
        type: 'POST',
        url: 'api/utils/ll2aerll',
    },
    chronice: {
        type: 'POST',
        url: 'api/utils/chronice',
    },
    proj42wkt: {
        type: 'GET',
        url: 'api/utils/proj42wkt',
    },
    draw_add: {
        type: 'POST',
        url: 'API/draw/add',
    },
    draw_edit: {
        type: 'POST',
        url: 'API/draw/edit',
    },
    draw_remove: {
        type: 'POST',
        url: 'API/draw/remove',
    },
    draw_undo: {
        type: 'POST',
        url: 'API/draw/undo',
    },
    draw_merge: {
        type: 'POST',
        url: 'API/draw/merge',
    },
    draw_split: {
        type: 'POST',
        url: 'API/draw/split',
    },
    files_getfiles: {
        type: 'POST',
        url: 'API/files/getfiles',
    },
    files_getfile: {
        type: 'POST',
        url: 'API/files/getfile',
    },
    files_make: {
        type: 'POST',
        url: 'API/files/make',
    },
    files_remove: {
        type: 'POST',
        url: 'API/files/remove',
    },
    files_restore: {
        type: 'POST',
        url: 'API/files/restore',
    },
    files_change: {
        type: 'POST',
        url: 'API/files/change',
    },
    files_modifykeyword: {
        type: 'POST',
        url: 'API/files/modifykeyword',
    },
    files_compile: {
        type: 'GET',
        url: 'API/files/compile',
    },
    files_publish: {
        type: 'POST',
        url: 'API/files/publish',
    },
    files_gethistory: {
        type: 'POST',
        url: 'API/files/gethistory',
    },
    shortener_shorten: {
        type: 'POST',
        url: 'API/shortener/shorten',
    },
    shortener_expand: {
        type: 'POST',
        url: 'API/shortener/expand',
    },
    clear_test: {
        type: 'POST',
        url: 'API/draw/clear_test',
    },
    tactical_targets: {
        type: 'GET',
        url: 'API/tactical/targets',
    },
    datasets_get: {
        type: 'POST',
        url: 'API/datasets/get',
    },
    geodatasets_get: {
        type: 'GET',
        url: 'API/geodatasets/get',
    },
    geodatasets_search: {
        type: 'POST',
        url: 'API/geodatasets/search',
    },
    spatial_published: {
        type: 'POST',
        url: 'API/spatial/published',
    },
    query_tileset_times: {
        type: 'GET',
        url: 'API/utils/queryTilesetTimes',
    },
}

function api(call, data, success, error) {
    if (window.mmgisglobal.SERVER != 'node') {
        console.warn('calls.api is only for node servers')
        if (typeof error === 'function') error()
        return
    }
    if (c[call] == null) {
        console.warn('Unknown api call: ' + call)
        if (typeof error === 'function') error()
        return
    }

    if (window.mmgisglobal.test === true) data.test = true

    $.ajax({
        type: c[call].type,
        url: `${
            window.mmgisglobal.ROOT_PATH
                ? window.mmgisglobal.ROOT_PATH + '/'
                : ''
        }${c[call].url}`,
        data: data,
        xhrFields: {
            withCredentials: true,
        },
        success: function (data) {
            if (
                !data.hasOwnProperty('status') ||
                (data.hasOwnProperty('status') && data.status == 'success')
            ) {
                if (typeof success === 'function') success(data)
            } else {
                if (window.mmgisglobal.test && typeof success === 'function')
                    success(data)
                else if (typeof error === 'function') error(data)
            }
        },
        error: function () {
            console.warn('error')
            if (typeof error === 'function') error()
        },
    })
}

export default {
    ...c,
    api: api,
}
