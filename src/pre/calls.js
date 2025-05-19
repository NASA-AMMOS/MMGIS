import $ from 'jquery'

const c = {
    get: {
        type: 'GET',
        url: 'api/configure/get',
    },
    get_generaloptions: {
        type: 'GET',
        url: 'api/configure/getGeneralOptions',
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
        url: 'api/draw/add',
    },
    draw_edit: {
        type: 'POST',
        url: 'api/draw/edit',
    },
    draw_remove: {
        type: 'POST',
        url: 'api/draw/remove',
    },
    draw_undo: {
        type: 'POST',
        url: 'api/draw/undo',
    },
    draw_merge: {
        type: 'POST',
        url: 'api/draw/merge',
    },
    draw_split: {
        type: 'POST',
        url: 'api/draw/split',
    },
    files_getfiles: {
        type: 'POST',
        url: 'api/files/getfiles',
    },
    files_getfile: {
        type: 'POST',
        url: 'api/files/getfile',
    },
    files_make: {
        type: 'POST',
        url: 'api/files/make',
    },
    files_remove: {
        type: 'POST',
        url: 'api/files/remove',
    },
    files_restore: {
        type: 'POST',
        url: 'api/files/restore',
    },
    files_change: {
        type: 'POST',
        url: 'api/files/change',
    },
    files_modifykeyword: {
        type: 'POST',
        url: 'api/files/modifykeyword',
    },
    files_compile: {
        type: 'GET',
        url: 'api/files/compile',
    },
    files_publish: {
        type: 'POST',
        url: 'api/files/publish',
    },
    files_gethistory: {
        type: 'POST',
        url: 'api/files/gethistory',
    },
    shortener_shorten: {
        type: 'POST',
        url: 'api/shortener/shorten',
    },
    shortener_expand: {
        type: 'POST',
        url: 'api/shortener/expand',
    },
    clear_test: {
        type: 'POST',
        url: 'api/draw/clear_test',
    },
    tactical_targets: {
        type: 'GET',
        url: 'api/tactical/targets',
    },
    datasets_get: {
        type: 'POST',
        url: 'api/datasets/get',
    },
    geodatasets_get: {
        type: 'GET',
        url: 'api/geodatasets/get',
    },
    geodatasets_intersect: {
        type: 'POST',
        url: 'api/geodatasets/intersect',
    },
    geodatasets_aggregations: {
        type: 'GET',
        url: 'api/geodatasets/aggregations',
    },
    geodatasets_search: {
        type: 'POST',
        url: 'api/geodatasets/search',
    },
    spatial_published: {
        type: 'POST',
        url: 'api/spatial/published',
    },
    query_tileset_times: {
        type: 'GET',
        url: 'api/utils/queryTilesetTimes',
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
