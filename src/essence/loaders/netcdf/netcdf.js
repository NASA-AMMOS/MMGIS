//Adapted from https://github.com/umrlastig/netcdf-three
import * as THREE from '../../../external/THREE/three152'
import { NetCDFReader } from 'netcdfjs'
import { Volume } from './Volume.js'
import F_ from '../../Basics/Formulae_/Formulae_'

export default function (path, volumeName, callback) {
    fetch(
        //'./public/misc/A2003.1.WENO5.002.nc'
        './public/misc/marsYard4.nc'
    )
        .then(readNetcdfHeader)
        .then((header) => fetchVolume(header, volumeName))
        .then(normalizeVolume)
        .then(formatVolume)
        .then((volume) => callback(volume))
}

function formatVolume(volume) {
    const formattedVolume = new Volume()

    formattedVolume.data = volume.data

    formattedVolume.sizeX = volume.sizeX
    formattedVolume.sizeY = volume.sizeY
    formattedVolume.sizeZ = volume.sizeZ

    formattedVolume.xLength = formattedVolume.sizeX
    formattedVolume.yLength = formattedVolume.sizeY
    formattedVolume.zLength = formattedVolume.sizeZ

    formattedVolume.matrix = new THREE.Matrix4()
    formattedVolume.matrix.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)

    formattedVolume.inverseMatrix = new THREE.Matrix4()
    formattedVolume.inverseMatrix.copy(formattedVolume.matrix).invert()

    formattedVolume.RASDimensions = [
        Math.floor(formattedVolume.sizeX),
        Math.floor(formattedVolume.sizeY),
        Math.floor(formattedVolume.sizeZ),
    ]
    formattedVolume.dimensions = formattedVolume.RASDimensions

    formattedVolume.min = volume.min
    formattedVolume.max = volume.max
    formattedVolume.lowerThreshold = formattedVolume.min //volume.min
    formattedVolume.upperThreshold = formattedVolume.max //volume.max

    formattedVolume.windowLow = formattedVolume.min
    formattedVolume.windowHigh = formattedVolume.max

    formattedVolume.spacing = [1, 1, 1]

    formattedVolume.axisOrder = ['x', 'y', 'z']

    formattedVolume.cropData = (min, max) => {
        return cropData(formattedVolume.data, min, max)
    }

    return formattedVolume
}

function readNetcdfHeader(response) {
    var reader = response.body.getReader()
    var bytesReceived = 0
    var buffer = null
    return reader.read().then(function process(result) {
        // append new bytes to the buffer
        var received = bytesReceived + result.value.length
        if (!buffer) {
            buffer = result.value
        } else {
            var old = buffer.subarray(0, bytesReceived)
            buffer = new Uint8Array(received)
            buffer.set(old, 0, bytesReceived)
            buffer.set(result.value, bytesReceived)
        }
        bytesReceived = received

        // try reading the header
        try {
            const header = new NetCDFReader(buffer)
            header.url = response.url
            header.reader = reader
            header.bytesTotal = response.headers.get('Content-Length')
            header.acceptRanges =
                response.headers.get('Accept-Ranges') === 'bytes'
            header.bytesReceived = bytesReceived
            return header
        } catch (e) {
            // end is reached with no decodable header
            if (result.done) {
                console.log('eof, no valid netcdf header!')
                return
            }
            // keep reading
            return reader.read().then(process)
        }
    })
}

function getValue(view, offset, type) {
    switch (type) {
        case 'byte':
            return (i) => view.getInt8(offset + i, false)
        // case 'char' : // not supported
        case 'short':
            return (i) => view.getInt16(offset + i * 2, false)
        case 'int':
            return (i) => view.getInt32(offset + i * 4, false)
        case 'float':
            return (i) => view.getFloat32(offset + i * 4, false)
        case 'double':
            return (i) => view.getFloat64(offset + i * 8, false)
        default:
            console.error('unsupported type : ', type)
            return (i) => 0
    }
}

function getGLtype(type) {
    switch (type) {
        case 'byte':
            return THREE.UnsignedByteType
        // case 'char' : // not supported
        case 'short':
            return THREE.FloatType
        case 'int':
            return THREE.FloatType
        case 'float':
            return THREE.FloatType
        case 'double':
            return THREE.FloatType // no double format
        default:
            console.error('unsupported type : ', type)
            return undefined
    }
}

function getTypedArray(volume) {
    switch (volume.type) {
        case 'byte':
            return new Uint8Array(volume.size)
        // case 'char' : // not supported
        case 'short':
            return new Float32Array(volume.size)
        case 'int':
            return new Float32Array(volume.size)
        case 'float':
            return new Float32Array(volume.size)
        case 'double':
            return new Float32Array(volume.size) // no double format
        default:
            console.error('unsupported type : ', volume.type)
            return (i) => 0
    }
}

function decodeVolume(buffer, volume, offset = 0) {
    const view = new DataView(buffer)
    const getVal = getValue(view, offset, volume.type)
    volume.data = getTypedArray(volume)
    volume.min = Infinity
    volume.max = -Infinity

    if (volume.record) {
        console.warn(
            'decoding of record data is not fully supported yet',
            volume.record
        )
    }

    for (var i = 0; i < volume.size; i++) {
        const v = getVal(i)
        volume.data[i] = v
        if (volume.min > v) volume.min = v
        if (volume.max < v) volume.max = v
    }
    return volume
}

function getDimension(header, variable, i) {
    if (i >= variable.dimensions.length) return 1
    const dim = variable.dimensions[i]
    const rec = header.recordDimension
    return dim == rec.id ? rec.length : header.dimensions[dim].size
}

function fetchVolume(header, variableName, forceRangeRequest = false) {
    if (header.bytesReceived === undefined)
        header.bytesReceived = header.buffer.byteLength
    const rangeRequest = forceRangeRequest || header.acceptRanges
    var variable = header.variables.find((val) => val.name === variableName)
    var volume = {
        variable: variableName,
        sizeX: getDimension(header, variable, 0),
        sizeY: getDimension(header, variable, 1),
        sizeZ: getDimension(header, variable, 2),
        type: variable.type,
    }
    if (variable.record) volume.record = header.recordDimension
    volume.size = volume.sizeX * volume.sizeY * volume.sizeZ
    const first = variable.offset
    const last = first + variable.size - 1
    // Data is missing and ranges are not accepted
    if (!rangeRequest && last >= header.bytesReceived) {
        // TODO, use reader if present
        if (header.reader) {
            // TODO, use reader if present
        }

        // TODO, stop if enough bytes are read
        return fetch(header.url)
            .then((response) => response.arrayBuffer())
            .then((buffer) => decodeVolume(buffer, volume, first))
    }

    if (header.reader) {
        header.reader.cancel()
        header.reader = undefined
    }

    if (last < header.bytesReceived)
        return Promise.resolve(
            decodeVolume(header.buffer.buffer, volume, first)
        )

    // Data is missing, get it using a range request
    const headers = new Headers({ Range: `bytes=${first}-${last}` })
    return fetch(header.url, { headers })
        .then((response) => response.arrayBuffer())
        .then((buffer) => decodeVolume(buffer, volume))
}

function normalizeVolume(volume) {
    if (getGLtype(volume.type) != THREE.FloatType) return volume
    volume.min = Infinity
    volume.max = -Infinity
    for (var i = 0; i < volume.size; i++) {
        volume.min = Math.min(volume.data[i], volume.min)
        volume.max = Math.max(volume.data[i], volume.max)
    }
    for (var i = 0; i < volume.size; i++) {
        volume.data[i] = F_.linearScale(
            [volume.min, volume.max],
            [0, 1],
            volume.data[i]
        )
    }

    volume.min = 0
    volume.max = 1
    return volume
}

function cropData(data, min, max) {
    const stretchedData = new Float32Array(data)
    for (var i = 0; i < stretchedData.length; i++) {
        if (stretchedData[i] < min) stretchedData[i] = min
        else if (stretchedData[i] > max) stretchedData[i] = max
        stretchedData[i] = F_.linearScale([min, max], [0, 1], stretchedData[i])
    }
    return stretchedData
}
