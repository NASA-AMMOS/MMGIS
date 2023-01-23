import $ from 'jquery'
import Dropy from '../../external/Dropy/dropy'
import L_ from '../Basics/Layers_/Layers_'
import Map_ from '../Basics/Map_/Map_'
import F_ from '../Basics/Formulae_/Formulae_'

// Because 0 is a valid value in many datasets yet still special in images being fully transparent,
// we're going to encode zero's as 2^31  (2147483648) (79, 0, 0, 0) and have the reader parse it back to 0
const VALUE_ENCODED_AS_ZERO = 2147483648

// rgbaToGFloat from: https://github.com/ihmeuw/glsl-rgba-to-float
// License: BSD-3 Clause https://github.com/ihmeuw/glsl-rgba-to-float/blob/master/LICENSE.md
// prettier-ignore
const rgbaToFloat = [    
    'ivec4 floatsToBytes(vec4 inputFloats, bool littleEndian) {',
    'ivec4 bytes = ivec4(inputFloats * 255.0);',
    'return (',
        'littleEndian',
        '? bytes.abgr',
        ': bytes',
    ');',
    '}',

    // Break the four bytes down into an array of 32 bits.
    'void bytesToBits(const in ivec4 bytes, out bool bits[32]) {',
        'for (int channelIndex = 0; channelIndex < 4; ++channelIndex) {',
            'float acc = float(bytes[channelIndex]);',
            'for (int indexInByte = 7; indexInByte >= 0; --indexInByte) {',
            'float powerOfTwo = exp2(float(indexInByte));',
            'bool bit = acc >= powerOfTwo;',
            'bits[channelIndex * 8 + (7 - indexInByte)] = bit;',
            'acc = mod(acc, powerOfTwo);',
            '}',
        '}',
    '}',

    // Compute the exponent of the 32-bit float.
    'float getExponent(bool bits[32]) {',
        'const int startIndex = 1;',
        'const int bitStringLength = 8;',
        'const int endBeforeIndex = startIndex + bitStringLength;',
        'float acc = 0.0;',
        'int pow2 = bitStringLength - 1;',
        'for (int bitIndex = startIndex; bitIndex < endBeforeIndex; ++bitIndex) {',
            'acc += float(bits[bitIndex]) * exp2(float(pow2--));',
        '}',
        'return acc;',
    '}',

    // Compute the mantissa of the 32-bit float.
    'float getMantissa(bool bits[32], bool subnormal) {',
        'const int startIndex = 9;',
        'const int bitStringLength = 23;',
        'const int endBeforeIndex = startIndex + bitStringLength;',
        // Leading/implicit/hidden bit convention:
        // If the number is not subnormal (with exponent 0), we add a leading 1 digit.
        'float acc = float(!subnormal) * exp2(float(bitStringLength));',
        'int pow2 = bitStringLength - 1;',
        'for (int bitIndex = startIndex; bitIndex < endBeforeIndex; ++bitIndex) {',
            'acc += float(bits[bitIndex]) * exp2(float(pow2--));',
        '}',
        'return acc;',
    '}',

    // Parse the float from its 32 bits.
    'float bitsToFloat(bool bits[32]) {',
        'float signBit = float(bits[0]) * -2.0 + 1.0;',
        'float exponent = getExponent(bits);',
        'bool subnormal = abs(exponent - 0.0) < 0.01;',
        'float mantissa = getMantissa(bits, subnormal);',
        'float exponentBias = 127.0;',
        'return signBit * mantissa * exp2(exponent - exponentBias - 23.0);',
    '}',

    // Decode a 32-bit float from the RGBA color channels of a texel.
    'float rgbaToFloat(vec4 texelRGBA, bool littleEndian) {',
        'ivec4 rgbaBytes = floatsToBytes(texelRGBA, littleEndian);',
        'bool bits[32];',
        'bytesToBits(rgbaBytes, bits);',
        'return bitsToFloat(bits);',
    '}'
].join('\n')

// prettier-ignore
const linearScale = [
    'float linearScale(float domainStart, float domainEnd, float rangeStart, float rangeEnd, float value) {',
        'return ((rangeEnd - rangeStart) * (value - domainStart)) / (domainEnd - domainStart) + rangeStart;',
    '}',
].join('\n')

let DataShaders = {
    image: {
        // prettier-ignore
        frag: [
                'void main(void) {',
                    // Fetch color from texture
                    'highp vec4 texelColour = texture2D(uTexture0, vec2(vTextureCoords.s, vTextureCoords.t));',     
                    'gl_FragColor = texelColour;',
                '}'
            ].join('\n'),
        settings: [],
    },
    colorize: {
        getHTML: function (name, shaderObj) {
            //const df = shaderObj.defaults || {}
            const cname = name.replace(/ /g, '_')
            // prettier-ignore
            return [
                `<li class="dataShader_${cname}_colorize">`,
                    '<div>',
                        '<div title="Whether to animate range changes.">Animated</div>',
                        `<select class="dropdown" parameter="animated" layername="${name}">`,
                            '<option value="true" selected>On</option>',
                            '<option value="false">Off</option>',
                        '</select>',
                    '</div>',
                '</li>',
                `<li class="dataShader_${cname}_colorize">`,
                    '<div>',
                        '<div>Mode</div>',
                        `<select class="dropdown" parameter="discrete" layername="${name}">`,
                            '<option value="continuous" selected>Continuous</option>',
                            '<option value="discrete">Discrete</option>',
                        '</select>',
                    '</div>',
                '</li>',
                `<li class="dataShader_${cname}_colorize">`,
                    '<div>',
                        '<div title="Whether to refit the minmax range when the viewport changes.">Dynamic</div>',
                        `<select class="dropdown" parameter="dynamic" layername="${name}">`,
                            '<option value="true" selected>On</option>',
                            '<option value="false">Off</option>',
                        '</select>',
                    '</div>',
                '</li>',
                `<li class="dataShader_${cname}_colorize_minValue">`,
                    '<div>',
                        '<div>Min Value</div>',
                        `<input style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${name}" parameter="min" type="number" value="0" default="0">`,
                    '</div>',
                '</li>',
                `<li class="dataShader_${cname}_colorize_maxValue">`,
                    '<div>',
                        '<div>Max Value</div>',
                        `<input style="width: 120px; border: none; height: 28px; margin: 1px 0px;" layername="${name}" parameter="max" type="number" value="0" default="0">`,
                    '</div>',
                '</li>',
                `<li class="dataShader dataShader_${cname}_colorize">`,
                    '<div style="padding: 2px 0px;">',
                        `<div id="dataShader_${cname}_colorize_ramps" style="width: 100%;"></div>`,
                    '</div>',
                '</li>',
                `<li class="dataShader_${cname}_colorize" style="height: auto; min-height: 120px; padding: 4px 0px;">`,
                    '<div style="display: block;">',
                        `<div style="display: flex; justify-content: space-between; font-weight: bold;"><div>Value ${shaderObj.units ? ` (${shaderObj.units})`: ''}</div><div>Color</div></div>`,
                        `<ul id="dataShader_${cname}_colorize_legend" style="position: relative;"></ul>`,
                    '</div>',
                '</li>',
            ].join('\n')
        },
        sourceTargets: {},
        // Like attach events but included on layer add
        attachImmediateEvents: function (name, shaderObj) {
            DataShaders.colorize.refreshRamp(name, shaderObj, 0)

            // Get minmax
            const getMinMax = (e) => {
                if (!L_.layers.layer[name]) return
                if (
                    L_.layers.layer[name].minValue != null &&
                    L_.layers.layer[name].maxValue != null &&
                    L_.layers.layer[name].isDynamic === false
                ) {
                    return
                }

                if (e.type === 'tileload') {
                    DataShaders.colorize.sourceTargets[name] = e.sourceTarget
                }
                if (DataShaders.colorize.sourceTargets[name] == null) return

                const currentXYZs = L_.Map_.getCurrentTileXYZs()
                const activeTiles = []
                currentXYZs.forEach((xyz) => {
                    activeTiles.push(`${xyz.x}:${xyz.y}:${xyz.z}`)
                })

                let min = Infinity
                let max = -Infinity
                const noDataValues = shaderObj.noDataValues || []
                const histo = {}
                activeTiles.forEach((c) => {
                    if (
                        DataShaders.colorize.sourceTargets[name]
                            ._fetchedTextures[c] &&
                        DataShaders.colorize.sourceTargets[name]
                            ._fetchedTextures[c][0].pixelPerfect
                    ) {
                        const data =
                            DataShaders.colorize.sourceTargets[name]
                                ._fetchedTextures[c][0].pixelPerfect.imgData
                        let oldValue

                        for (let i = 0; i < data.length; i += 4) {
                            let value = F_.RGBAto32({
                                r: data[i + 0],
                                g: data[i + 1],
                                b: data[i + 2],
                                a: data[i + 3],
                            })
                            if (noDataValues.includes(value)) continue

                            // Because 0 is a valid value in many datasets yet still special in images being fully transparent,
                            // we're going to encode zero's as 2^31  (2147483648) (79, 0, 0, 0) and have the reader parse it back to 0
                            if (value === VALUE_ENCODED_AS_ZERO) {
                                value = 0
                                oldValue = VALUE_ENCODED_AS_ZERO
                            } else {
                                oldValue = null
                            }

                            const valR = Math.round(value)
                            if (!histo[valR]) histo[valR] = 1
                            else histo[valR]++

                            if (value < min) {
                                min = value
                            }
                            if (value > max) {
                                max = value
                            }
                        }
                    }
                })
                L_.layers.layer[name].histogram = histo

                if (noDataValues) {
                    if (noDataValues[0] != null)
                        L_.layers.layer[name].setUniform(
                            'nodatavalue0',
                            noDataValues[0]
                        )
                    if (noDataValues[1] != null)
                        L_.layers.layer[name].setUniform(
                            'nodatavalue1',
                            noDataValues[1]
                        )
                    if (noDataValues[2] != null)
                        L_.layers.layer[name].setUniform(
                            'nodatavalue2',
                            noDataValues[2]
                        )
                }

                DataShaders.colorize.setMinMaxAnimated(
                    name,
                    shaderObj,
                    min,
                    max
                )
            }

            Map_.map.on('moveend', getMinMax)
            Map_.map.on('zoomend', getMinMax)
            L_.layers.layer[name].on('tileload', getMinMax)
        },
        lastMinMax: { min: null, max: null },
        intervalMinMax: null,
        setMinMaxAnimated(name, shaderObj, min, max) {
            if (!Number.isFinite(min) || !Number.isFinite(max)) return
            DataShaders.colorize.updateLegendMinMax(name, shaderObj, min, max)
            if (
                DataShaders.colorize.lastMinMax.min == null ||
                DataShaders.colorize.lastMinMax.max == null ||
                L_.layers.layer[name].isAnimated === false
            ) {
                DataShaders.colorize.lastMinMax.min = min
                DataShaders.colorize.lastMinMax.max = max
                L_.layers.layer[name].setUniform('minvalue', min)
                L_.layers.layer[name].setUniform('maxvalue', max)
                L_.layers.layer[name].reRender()
                return
            }
            if (DataShaders.colorize.intervalMinMax)
                clearInterval(DataShaders.colorize.intervalMinMax)
            DataShaders.colorize.intervalMinMax = setInterval(() => {
                if (
                    Math.abs(min - DataShaders.colorize.lastMinMax.min) < 1 &&
                    Math.abs(max - DataShaders.colorize.lastMinMax.max) < 1
                ) {
                    clearInterval(DataShaders.colorize.intervalMinMax)
                    L_.layers.layer[name].setUniform('minvalue', min)
                    L_.layers.layer[name].setUniform('maxvalue', max)
                    L_.layers.layer[name].reRender()

                    DataShaders.colorize.updateLegendMinMax(
                        name,
                        shaderObj,
                        min,
                        max
                    )
                }
                const minRate =
                    Math.abs(DataShaders.colorize.lastMinMax.min - min) / 10
                const maxRate =
                    Math.abs(DataShaders.colorize.lastMinMax.max - max) / 10
                if (DataShaders.colorize.lastMinMax.min > min)
                    DataShaders.colorize.lastMinMax.min -= minRate
                else if (DataShaders.colorize.lastMinMax.min < min)
                    DataShaders.colorize.lastMinMax.min += minRate
                if (DataShaders.colorize.lastMinMax.max > max)
                    DataShaders.colorize.lastMinMax.max -= maxRate
                else if (DataShaders.colorize.lastMinMax.min < max)
                    DataShaders.colorize.lastMinMax.max += maxRate

                L_.layers.layer[name].setUniform(
                    'minvalue',
                    DataShaders.colorize.lastMinMax.min
                )
                L_.layers.layer[name].setUniform(
                    'maxvalue',
                    DataShaders.colorize.lastMinMax.max
                )
                L_.layers.layer[name].reRender()
            }, 50)
        },
        // Like attach immediate events but on layer tool open
        attachEvents: function (name, shaderObj) {
            const cname = name.replace(/ /g, '_')
            $(`.dataShader_${cname}_colorize select[parameter=dynamic]`).on(
                'change',
                function () {
                    const layerName = $(this).attr('layername')
                    const val = $(this).val()
                    L_.layers.layer[layerName].isDynamic = val === 'true'
                }
            )
            //MODE
            $(`.dataShader_${cname}_colorize select[parameter=discrete]`).on(
                'change',
                function () {
                    const layerName = $(this).attr('layername')
                    const parameter = $(this).attr('parameter')
                    const val = $(this).val()
                    L_.layers.layer[layerName].isDiscrete = val === 'discrete'
                    DataShaders.colorize.setLegend(
                        name,
                        shaderObj,
                        $(`#dataShader_${cname}_colorize_legend`).attr(
                            'rampIdx'
                        )
                    )
                    L_.layers.layer[layerName].setUniform(
                        parameter,
                        L_.layers.layer[layerName].isDiscrete ? 1 : 0
                    )
                    L_.layers.layer[layerName].reRender()
                }
            )
            //Animated
            $(`.dataShader_${cname}_colorize select[parameter=animated]`).on(
                'change',
                function () {
                    const layerName = $(this).attr('layername')
                    const val = $(this).val()
                    L_.layers.layer[layerName].isAnimated = val === 'true'
                }
            )

            //Min Max
            $(`.dataShader_${cname}_colorize_minValue input[parameter=min]`).on(
                'change',
                function () {
                    const min = parseFloat($(this).val())
                    DataShaders.colorize.setMinMaxAnimated(
                        name,
                        shaderObj,
                        min,
                        L_.layers.layer[name].maxValue
                    )
                }
            )
            $(`.dataShader_${cname}_colorize_maxValue input[parameter=max]`).on(
                'change',
                function (e) {
                    const max = parseFloat($(this).val())
                    DataShaders.colorize.setMinMaxAnimated(
                        name,
                        shaderObj,
                        L_.layers.layer[name].minValue,
                        max
                    )
                }
            )

            //RAMPS
            let ramps = []
            shaderObj.ramps.forEach((ramp) => {
                let newRamp = []
                ramp.forEach((color) => {
                    newRamp.push(
                        `<div ${
                            color === 'transparent'
                                ? 'class="checkeredTransparent"'
                                : ''
                        }style="width: ${100 / ramp.length}%; height: 22px; ${
                            color !== 'transparent'
                                ? `background: ${color};`
                                : ''
                        }"></div>`
                    )
                })
                ramps.push(
                    `<div style="display: flex;">${newRamp.join('\n')}</div>`
                )
            })
            $(`#dataShader_${cname}_colorize_ramps`).html(
                Dropy.construct(ramps, null, 0)
            )
            $(`#dataShader_${cname}_colorize_ramps ul`).css({
                background: 'var(--color-a)',
            })
            $(`#dataShader_${cname}_colorize_ramps .dropy`).css({
                marginBottom: '0px',
            })
            $(`#dataShader_${cname}_colorize_ramps .dropy__title span`).css({
                padding: '2px 0px',
            })
            $(`#dataShader_${cname}_colorize_ramps li > a`).css({
                marginBottom: '0px',
                padding: '2px 0px',
            })
            Dropy.init(
                $(`#dataShader_${cname}_colorize_ramps`),
                function (rampIdx) {
                    DataShaders.colorize.refreshRamp(name, shaderObj, rampIdx)
                },
                function () {
                    $(`#dataShader_${cname}_colorize_ramps .dropy.open ul`).css(
                        {
                            maxHeight: '140px',
                        }
                    )
                },
                function () {
                    $(`#dataShader_${cname}_colorize_ramps .dropy ul`).css({
                        maxHeight: '',
                    })
                }
            )

            DataShaders.colorize.setLegend(name, shaderObj)
        },
        refreshRamp: function (name, shaderObj, rampIdx) {
            rampIdx = rampIdx || 0
            DataShaders.colorize.setLegend(name, shaderObj, rampIdx)
            if (shaderObj.ramps) {
                const ramp = shaderObj.ramps[rampIdx != null ? rampIdx : 0]
                L_.layers.layer[name].ramp = ramp
                ramp.forEach((color, idx) => {
                    let rgb
                    // Hacky easy transparency support
                    if (color === 'transparent') rgb = { r: 1, g: 1, b: 1 }
                    else {
                        rgb = F_.hexToRGB(color)
                        if (rgb.r == 1 && rgb.g == 1 && rgb.b == 1)
                            rgb = { r: 0, g: 0, b: 0 }
                    }

                    L_.layers.layer[name].setUniform(
                        `ramp${idx}`,
                        new Float32Array([
                            rgb.r / 255,
                            rgb.g / 255,
                            rgb.b / 255,
                            idx / (ramp.length - 1),
                        ])
                    )
                })
                L_.layers.layer[name].reRender()
            }
        },
        setLegend: function (name, shaderObj, rampIdx) {
            const cname = name.replace(/ /g, '_')

            let legend = []

            const isDiscrete = L_.layers.layer[name].isDiscrete
            if (shaderObj.ramps) {
                const ramp = shaderObj.ramps[rampIdx != null ? rampIdx : 0]
                ramp.forEach((color, idx) => {
                    // prettier-ignore
                    legend.push(
                        `<li style="display: flex; justify-content: space-between; padding: 2px 0px; height: 24px; line-height: 24px;">`,
                            isDiscrete ? [
                                `<div class="dataShader_${cname}_colorize_legend_value_${idx}">`,
                                    idx === 0 ? `<i class='mdi mdi-less-than mdi-12px' style="font-size: 12px; padding-right: 2px;"></i><div class="dataShader_${cname}_colorize_legend_value_min dataShader_${cname}_colorize_legend_value_${idx}_low" type="number" style="color: white;"></div>`
                                    : idx === ramp.length - 1 ? `<i class='mdi mdi-greater-than mdi-12px' style="font-size: 12px; padding-right: 2px;"></i><div class="dataShader_${cname}_colorize_legend_value_max dataShader_${cname}_colorize_legend_value_${idx}_high" type="number" style="color: white;"></div>`
                                    : [
                                        `<div class="dataShader_${cname}_colorize_legend_value_${idx}_low" style="color: white;"></div>`,
                                        `<i class='mdi mdi-arrow-right mdi-12px' style="font-size: 12px;  padding: 0px 2px;"></i>`,
                                        `<div class="dataShader_${cname}_colorize_legend_value_${idx}_high" style="color: white;"></div>`
                                    ].join('\n'),
                                `</div>`
                                ].join('\n') :
                                idx === 0 ? `<div class="dataShader_${cname}_colorize_legend_value_${idx} dataShader_${cname}_colorize_legend_value_min" type="number" style="color: white;"></div>`
                                    : idx === ramp.length - 1 ? `<div class="dataShader_${cname}_colorize_legend_value_${idx} dataShader_${cname}_colorize_legend_value_max" type="number" style="color: white;"></div>`
                                       : `<div class="dataShader_${cname}_colorize_legend_value_${idx}" style="color: white;"></div>`,
                            `<div ${color === 'transparent' ? 'class="checkeredTransparent"' : ''} style="width: 24px; height: 23px; ${ color !== 'transparent' ? `background: ${color};` : ''}"></div>`,
                        `</li>`
                    )
                })
            }

            // Histogram
            // prettier-ignore
            legend.push([
                `<div class="dataShader_${cname}_colorize_legend_histogram" style="position: absolute; right: 24px; top: 2px; width: 32px;">`,
                `</div>`
            ].join('\n'))

            $(`#dataShader_${cname}_colorize_legend`).html(legend.join('\n'))
            $(`#dataShader_${cname}_colorize_legend`).attr('rampIdx', rampIdx)
            $(`#dataShader_${cname}_colorize_legend`).attr(
                'isdiscrete',
                isDiscrete === true
            )
            DataShaders.colorize.updateLegendMinMax(name, shaderObj)
        },
        updateLegendMinMax: function (
            name,
            shaderObj,
            min,
            max,
            dontUpdateMinMix
        ) {
            const cname = name.replace(/ /g, '_')
            if (min == null) min = L_.layers.layer[name].minValue
            if (max == null) max = L_.layers.layer[name].maxValue
            const isDiscrete =
                $(`#dataShader_${cname}_colorize_legend`).attr('isdiscrete') ==
                'true'
            if (shaderObj.ramps && min != null && max != null) {
                const rampIdx = $(`#dataShader_${cname}_colorize_legend`).attr(
                    'rampIdx'
                )
                const sigfigs =
                    shaderObj.sigfigs != null ? shaderObj.sigfigs : 3
                const ramp = shaderObj.ramps[rampIdx != null ? rampIdx : 0]
                const v0 = F_.linearScale([0, ramp.length - 1], [min, max], 0)
                const v1 = F_.linearScale([0, ramp.length - 1], [min, max], 1)
                const valueGap = v1 - v0
                const valueGapHalf = valueGap / 2
                ramp.forEach((color, idx) => {
                    let value = F_.linearScale(
                        [0, ramp.length - 1],
                        [min, max],
                        idx
                    )
                    if (isDiscrete) {
                        $(
                            `div.dataShader_${cname}_colorize_legend_value_${idx}_low`
                        ).html(
                            idx === 0
                                ? (value + valueGapHalf).toFixed(sigfigs)
                                : (value - valueGapHalf).toFixed(sigfigs)
                        )
                        $(
                            `div.dataShader_${cname}_colorize_legend_value_${idx}_high`
                        ).html(
                            idx === ramp.length - 1
                                ? (value - valueGapHalf).toFixed(sigfigs)
                                : (value + valueGapHalf).toFixed(sigfigs)
                        )
                    } else {
                        if (!isNaN(value)) value = value.toFixed(sigfigs)
                        else value = '--'
                        $(
                            `div.dataShader_${cname}_colorize_legend_value_${idx}`
                        ).html(value)
                        $(
                            `input.dataShader_${cname}_colorize_legend_value_${idx}`
                        ).val(value)
                    }
                })

                // Histogram
                if (L_.layers.layer[name].histogram) {
                    const histogram = []
                    const binSize =
                        (Math.max(min, max) - Math.min(min, max)) / ramp.length
                    const histoKeys = Object.keys(
                        L_.layers.layer[name].histogram
                    )
                    for (
                        let v = Math.min(min, max);
                        v < Math.max(min, max);
                        v += binSize
                    ) {
                        let binValue = 0
                        histoKeys
                            .filter(
                                (val) =>
                                    parseFloat(val) >= v &&
                                    parseFloat(val) <= v + binSize
                            )
                            .forEach((value) => {
                                binValue +=
                                    L_.layers.layer[name].histogram[value]
                            })
                        histogram.push(binValue)
                    }
                    if (histogram.length > 0) {
                        const histoMin = Math.min(...histogram)
                        const histoMax = Math.max(...histogram)

                        const total = histogram.reduce((a, b) => a + b)

                        const histoDivs = []
                        histogram.forEach((value, idx) => {
                            const width = F_.linearScale(
                                [histoMin, histoMax],
                                [0, 30],
                                value
                            )
                            histoDivs.push(
                                `<div title="${((value / total) * 100).toFixed(
                                    2
                                )}%" style="background: ${
                                    ramp[idx]
                                }; width: ${width}px; height: 10px; position: absolute; right: 1px; top: ${
                                    idx * 24 + 7
                                }px;"></div>`
                            )
                        })

                        $(
                            `.dataShader_${cname}_colorize_legend_histogram`
                        ).html(histoDivs.join('\n'))
                    }
                }

                if (!dontUpdateMinMix) {
                    L_.layers.layer[name].minValue = min
                    L_.layers.layer[name].maxValue = max

                    $(
                        `.dataShader_${cname}_colorize_minValue input[parameter=min]`
                    ).val(min.toFixed(sigfigs))
                    $(
                        `.dataShader_${cname}_colorize_maxValue input[parameter=max]`
                    ).val(max.toFixed(sigfigs))
                }
            }
        },
        // prettier-ignore
        frag: [
            rgbaToFloat,
            linearScale,
            'void main(void) {',
                // Fetch color from texture 2, which is the terrain-rgb tile
                'highp vec4 texelColour = texture2D(uTexture0, vec2(vTextureCoords.s, vTextureCoords.t));',
            
                'highp float pxValue = rgbaToFloat(texelColour, false);',
                'highp float pxValueOrig = pxValue;',
                `if (pxValue == ${VALUE_ENCODED_AS_ZERO}.0) { pxValue = 0.0; }`,
            
                'vec4 colour = vec4(0.0, 0.0, 0.0, 0.0);',

                'float valuePercent = linearScale(minvalue, maxvalue, 0.0, 1.0, pxValue);',

                new Array(13).fill('').map((v, i) => {
                    if( i === 0 )
                        // prettier-ignore
                        return [
                            `if (valuePercent < ramp${i}[3]) {`,
                                `float alphaI = 1.0;`,
                                `if ( ramp${i}[0] * 255.0 == 1.0 && ramp${i}[1] * 255.0 == 1.0 && ramp${i}[2] * 255.0 == 1.0) { alphaI = 0.0; }`,
                                `colour = vec4(ramp${i}[0], ramp${i}[1], ramp${i}[2], alphaI);`,
                            '}'
                        ].join('\n')
                    // prettier-ignore
                    return [
                        `else if (valuePercent <= ramp${i}[3] || ramp${i}[3] == 1.0) {`,
                            `if (discrete > 0.0) {`,
                                `if (valuePercent - ramp${i-1}[3] < ramp${i}[3] - valuePercent) {`,     
                                    `valuePercent = ramp${i-1}[3];`,
                                '} else {',
                                    `valuePercent = ramp${i}[3];`,
                                '}',
                            `}`,
                            `float alphaI = 1.0;`,
                            `float alphaIm1 = 1.0;`,
                            `if ( ramp${i}[0] * 255.0 == 1.0 && ramp${i}[1] * 255.0 == 1.0 && ramp${i}[2] * 255.0 == 1.0) { alphaI = 0.0; }`,
                            `if ( ramp${i-1}[0] * 255.0 == 1.0 && ramp${i-1}[1] * 255.0 == 1.0 && ramp${i-1}[2] * 255.0 == 1.0) { alphaIm1 = 0.0; }`,
                            `colour = vec4(linearScale(ramp${i-1}[3], ramp${i}[3], ramp${i-1}[0], ramp${i}[0], valuePercent), linearScale(ramp${i-1}[3], ramp${i}[3], ramp${i-1}[1], ramp${i}[1], valuePercent), linearScale(ramp${i-1}[3], ramp${i}[3], ramp${i-1}[2], ramp${i}[2], valuePercent), linearScale(ramp${i-1}[3], ramp${i}[3], alphaIm1, alphaI, valuePercent));`,
                        `}`
                    ].join('\n')
                }).join('\n'),

                // And compose the labels on top of everything
                `if (pxValueOrig == nodatavalue0) { colour = vec4(0.0, 0.0, 0.0, 0.0); }`,
                `else if (pxValueOrig == nodatavalue1) { colour = vec4(0.0, 0.0, 0.0, 0.0); }`,
                `else if (pxValueOrig == nodatavalue2) { colour = vec4(0.0, 0.0, 0.0, 0.0); }`,
                `gl_FragColor = colour;`,
            '}'
        ].join('\n'),
        settings: [
            {
                parameter: 'discrete',
                value: 0,
            },
            {
                parameter: 'minvalue',
                value: 0,
            },
            {
                parameter: 'maxvalue',
                value: 1,
            },
            {
                parameter: 'nodatavalue0',
                value: -4294967296,
            },
            {
                parameter: 'nodatavalue1',
                value: -4294967296,
            },
            {
                parameter: 'nodatavalue2',
                value: -4294967296,
            },
            {
                parameter: 'ramp0',
                value: new Float32Array([1, 0, 0, 0]), // v4 isn't alpha, it's the color stop
            },
            {
                parameter: 'ramp1',
                value: new Float32Array([0, 1, 0, 0.5]), // if the stop is 1 (100%), we stop the whole color scale
            },
            {
                parameter: 'ramp2',
                value: new Float32Array([0, 0, 1, 1]),
            },
            {
                parameter: 'ramp3',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp4',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp5',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp6',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp7',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp8',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp9',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp10',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp11',
                value: new Float32Array([0, 0, 0, 0]),
            },
            {
                parameter: 'ramp12',
                value: new Float32Array([0, 0, 0, 0]),
            },
        ],
    },
}

export default DataShaders
