import $ from 'jquery'
import Dropy from '../../external/Dropy/dropy'

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
            const df = shaderObj.defaults || {}
            // prettier-ignore
            return [
                '<li>',
                    '<div>',
                        '<div>Dynamic</div>',
                        `<input class="datacheckbox checkboxSmall" parameter="dynamic" layername="${name}" type="checkbox" checked>`,
                    '</div>',
                '</li>',
                '<li>',
                    '<div>',
                        '<div>Discrete</div>',
                        `<input class="datacheckbox checkboxSmall" parameter="discrete" layername="${name}" type="checkbox">`,
                    '</div>',
                '</li>',
                '<li>',
                    '<div>',
                        '<div>Color Ramp</div>',
                        `<div id="dataShader_${name}_colorize_ramps" style="width: 126px;"></div>`,
                    '</div>',
                '</li>',
                '<li>',
                    '<div style="display: block;">',
                        '<div style="display: flex; justify-content: space-between; font-weight: bold;"><div>Value</div><div>Stop</div><div>Color</div></div>',
                        `<ul id="dataShader_${name}_colorize_legend"></ul>`,
                    '</div>',
                '</li>',
            ].join('\n')
        },
        attachEvents: function (name, shaderObj) {
            const initialRampIdx = 0

            //RAMPS
            let ramps = []
            shaderObj.ramps.forEach((ramp) => {
                let newRamp = []
                ramp.forEach((color) => {
                    newRamp.push(
                        `<div style="width: ${
                            100 / ramp.length
                        }%; height: 18px; background: ${color};"></div>`
                    )
                })
                ramps.push(
                    `<div style="display: flex;">${newRamp.join('\n')}</div>`
                )
            })

            $(`#dataShader_${name}_colorize_ramps`).html(
                Dropy.construct(ramps, null, initialRampIdx)
            )
            $(`#dataShader_${name}_colorize_ramps ul`).css({
                background: 'var(--color-a)',
            })
            $(`#dataShader_${name}_colorize_ramps .dropy`).css({
                marginBottom: '0px',
            })
            $(`#dataShader_${name}_colorize_ramps .dropy__title span`).css({
                padding: '5px',
            })
            $(`#dataShader_${name}_colorize_ramps li > a`).css({
                marginBottom: '0px',
                padding: '5px',
            })
            Dropy.init($(`#dataShader_${name}_colorize_ramps`), function (idx) {
                setLegend(idx)
            })

            setLegend()
            //LEGEND
            function setLegend(rampIdx) {
                let legend = []
                if (shaderObj.ramps) {
                    const ramp =
                        shaderObj.ramps[
                            rampIdx != null ? rampIdx : initialRampIdx
                        ]
                    ramp.forEach((color, idx) => {
                        // prettier-ignore
                        legend.push(
                        `<li style="display: flex; justify-content: space-between; padding: 2px 0px;">`,
                            `<div>4500${shaderObj.units || ''}</div>`,
                            `<div>${idx / ramp.length * 100}%</div>`,
                            `<div style="width: 18px; height: 18px; background: ${color};"></div>`,
                        `</li>`
                    )
                    })
                }
                $(`#dataShader_${name}_colorize_legend`).html(legend.join('\n'))
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
            
                'vec4 colour;',
                'colour = vec4(1.0, 0.0, 0.0, linearScale(minvalue, maxvalue, 0.0, 1.0, pxValue));',

                // And compose the labels on top of everything
                'gl_FragColor = colour;',
                
                //'gl_FragColor = vec4(0.7, 0.6, 0.1, 1);',
            '}'
        ].join('\n'),
        settings: [
            {
                parameter: 'minvalue',
                value: 0,
            },
            {
                parameter: 'maxvalue',
                value: 1,
            },
            {
                parameter: 'ramp0',
                value: new Float32Array([1, 0, 0, 0]), // v4 isn't alpha, it's the color stop
            },
            {
                parameter: 'ramp1',
                value: new Float32Array([0, 0, 1, 1]),
            },
            {
                parameter: 'ramp2',
                value: new Float32Array([0, 0, 0, 0]),
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
