define([], function () {
    /*
    var rgba = { r: 92, g: 244, b: 12, a: 247 }

    var factor = 10000
    function decodeRGBA(rgba) {
        return (
            (rgba.r * 255.0 * 256.0 * 256.0 +
                rgba.g * 255.0 * 256.0 +
                rgba.b * 255.0 +
                rgba.a -
                2147483648) /
            factor
        )
    }
    function encodeRGBA(v) {
        var c = Math.round(v * factor + 2147483648)
        var r = parseInt(c / (255.0 * 256.0 * 256.0))
        c = c % (255.0 * 256.0 * 256.0)
        var g = parseInt(c / (255.0 * 256.0))
        c = c % (255.0 * 256.0)
        var b = parseInt(c / 255.0)
        c = c % 255.0
        var a = c

        return { r: r, g: g, b: b, a: a }
    }
    //console.log(128 - 2147483648 * 0.0001)
    var d = decodeRGBA(rgba)
    console.log(rgba)
    console.log(d)
    console.log(encodeRGBA(d))
    */
    return (DataShaders = {
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
            // prettier-ignore
            frag: [
                'void main(void) {',
                    // Fetch color from texture 2, which is the terrain-rgb tile
                    'highp vec4 texelColour = texture2D(uTexture0, vec2(vTextureCoords.s, vTextureCoords.t));',
                
                    // Height is represented in TENTHS of a meter
                    'highp float pxheight = (',
                        '(texelColour.r * 255.0 * 255.0 * 256.0 * 256.0 +',
                        'texelColour.g * 255.0 * 255.0 * 256.0 +',
                        'texelColour.b * 255.0 * 255.0 +',
                        'texelColour.a * 255.0 -',
                        '2147483648.0) / 10000.0',
                        ');',
                
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
                    min: -5000,
                    step: 1,
                    max: -4000,
                    value: -4500,
                    parameter: 'floodheight',
                },
            ],
        },
    })
})
