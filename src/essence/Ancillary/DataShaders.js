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
    flood: {
        getHTML: function (name, shaderObj) {
            const df = shaderObj.defaults || {}
            // prettier-ignore
            return [ '<li>',
                '<div>',
                    '<div>Height<span></span></div>',
                    `<input class="dataslider slider2" parameter="floodheight" unit="m" layername="${name}" type="range" min="${ df.minValue ? df.minValue : -100 }" max="${ df.maxValue ? df.maxValue : 100 }" step="${ df.stepValue ? df.stepValue : 1}" value="${df.defaultValue ? df.defaultValue : 0}">`,
                '</div>',
            '</li>',
        ].join('\n')
        },
        // prettier-ignore
        frag: [
            rgbaToFloat,
            'void main(void) {',
                // Fetch color from texture 2, which is the terrain-rgb tile
                'highp vec4 texelColour = texture2D(uTexture0, vec2(vTextureCoords.s, vTextureCoords.t));',
            
                'highp float pxheight = rgbaToFloat(texelColour, false);',
            
                'vec4 floodColour;',
                'if (pxheight > floodheight) {',
                    'floodColour = vec4(0, 0, 0, 0.0);',
                '} else {',
                    // Water, some semiopaque blue
                    'floodColour = vec4(0.05, 0.2, 0.7, 0.6);',
                '}',
            
                // And compose the labels on top of everything
                'gl_FragColor = floodColour;',
                
                //'gl_FragColor = vec4(0.7, 0.6, 0.1, 1);',
            '}'
        ].join('\n'),
        settings: [
            {
                name: 'Height',
                type: 'range',
                min: -10000,
                step: 100,
                max: 4000,
                value: -4500,
                parameter: 'floodheight',
            },
        ],
    },
}

export default DataShaders
