self.addEventListener('message', function(e) {
    loadBinaryResource(
        e.data,
        function(d) {
            postMessage({ status: 'done', data: d })
        },
        function(p) {
            postMessage({ status: 'progress', progress: p })
        }
    )
})

function loadBinaryResource(url, callback, progressCallback) {
    var oReq = new XMLHttpRequest()
    oReq.open('GET', url, true)
    oReq.responseType = 'arraybuffer'

    oReq.onload = function(oEvent) {
        var arrayBuffer = oReq.response // Note: not oReq.responseText
        if (arrayBuffer) {
            var byteArray = new Float64Array(arrayBuffer)
            callback(byteArray)
        }
    }

    if (typeof progressCallback === 'function') {
        oReq.addEventListener('progress', function(oEvent) {
            if (oEvent.lengthComputable) {
                var percentComplete = oEvent.loaded / oEvent.total
                progressCallback(percentComplete)
            }
        })
    }

    oReq.send(null)
}
