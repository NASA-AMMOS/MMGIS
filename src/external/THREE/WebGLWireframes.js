'use strict'
;(function (factory) {
    // attach your plugin to the global 'L' variable
    if (typeof window !== 'undefined' && window.THREE) {
        factory(window.THREE)
    }
})(function (THREE) {
    THREE.WebGLWireframes = {}
    //Vert Shader
    THREE.WebGLWireframes.wireVERT =
        'attribute vec3 barycentric;\n' +
        'attribute float even;\n' +
        'varying vec3 vBarycentric;\n' +
        'varying vec3 vPosition;\n' +
        'varying float vEven;\n' +
        'varying vec2 vUv;\n' +
        'void main () {\n' +
        'gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);\n' +
        'vBarycentric = barycentric;\n' +
        'vPosition = position.xyz;\n' +
        'vEven = even;\n' +
        'vUv = uv;\n' +
        '}'

    //Frag Shader
    THREE.WebGLWireframes.wireFRAG =
        'varying vec3 vBarycentric;\n' +
        'varying float vEven;\n' +
        'varying vec2 vUv;\n' +
        'varying vec3 vPosition;\n' +
        'uniform float time;\n' +
        'uniform float thickness;\n' +
        'uniform float secondThickness;\n' +
        'uniform float dashRepeats;\n' +
        'uniform float dashLength;\n' +
        'uniform bool dashOverlap;\n' +
        'uniform bool dashEnabled;\n' +
        'uniform bool dashAnimate;\n' +
        'uniform bool seeThrough;\n' +
        'uniform bool insideAltColor;\n' +
        'uniform bool dualStroke;\n' +
        'uniform bool noiseA;\n' +
        'uniform bool noiseB;\n' +
        'uniform bool squeeze;\n' +
        'uniform float squeezeMin;\n' +
        'uniform float squeezeMax;\n' +
        'uniform vec3 stroke;\n' +
        'uniform vec3 fill;\n' +
        'uniform float opacityStroke;\n' +
        'uniform float opacityFill;\n' +
        //"#pragma glslify: noise = require('glsl-noise/simplex/4d');\n" +
        //"#pragma glslify: PI = require('glsl-pi');\n" +

        // This is like
        'float aastep (float threshold, float dist) {\n' +
        'float afwidth = fwidth(dist) * 0.5;\n' +
        'return smoothstep(threshold - afwidth, threshold + afwidth, dist);\n' +
        '}\n' +
        // This function is not currently used, but it can be useful
        // to achieve a fixed width wireframe regardless of z-depth
        'float computeScreenSpaceWireframe (vec3 barycentric, float lineWidth) {\n' +
        'vec3 dist = fwidth(barycentric);\n' +
        'vec3 smoothed = smoothstep(dist * ((lineWidth * 0.5) - 0.5), dist * ((lineWidth * 0.5) + 0.5), barycentric);\n' +
        'return 1.0 - min(min(smoothed.x, smoothed.y), smoothed.z);\n' +
        '}\n' +
        // This function returns the fragment color for our styled wireframe effect
        // based on the barycentric coordinates for this fragment
        'vec4 getStyledWireframe (vec3 barycentric) {\n' +
        // this will be our signed distance for the wireframe edge
        'float d = min(min(barycentric.x, barycentric.y), barycentric.z);\n' +
        // we can modify the distance field to create interesting effects & masking
        /*
  "float noiseOff = 0.0;\n" +
  "if (noiseA) noiseOff += noise(vec4(vPosition.xyz * 1.0, time * 0.35)) * 0.15;\n" +
  "if (noiseB) noiseOff += noise(vec4(vPosition.xyz * 80.0, time * 0.5)) * 0.12;\n" +
  "d += noiseOff;\n" +
*/
        // for dashed rendering, we can use this to get the 0 .. 1 value of the line length
        'float positionAlong = max(barycentric.x, barycentric.y);\n' +
        'if (barycentric.y < barycentric.x && barycentric.y < barycentric.z) {\n' +
        'positionAlong = 1.0 - positionAlong;\n' +
        '}\n' +
        // the thickness of the stroke
        'float computedThickness = thickness;\n' +
        // if we want to shrink the thickness toward the center of the line segment

        'if (squeeze) {\n' +
        'computedThickness *= mix(squeezeMin, squeezeMax, (1.0 - sin(positionAlong * 3.14159265)));\n' +
        '}\n' +
        // if we should create a dash pattern
        'if (dashEnabled) {\n' +
        // here we offset the stroke position depending on whether it
        // should overlap or not
        'float offset = 1.0 / dashRepeats * dashLength / 2.0;\n' +
        'if (!dashOverlap) {\n' +
        'offset += 1.0 / dashRepeats / 2.0;\n' +
        '}\n' +
        // if we should animate the dash or not
        'if (dashAnimate) {\n' +
        'offset += time * 0.22;\n' +
        '}\n' +
        // create the repeating dash pattern
        'float pattern = fract((positionAlong + offset) * dashRepeats);\n' +
        'computedThickness *= 1.0 - aastep(dashLength, pattern);\n' +
        '}\n' +
        // compute the anti-aliased stroke edge
        'float edge = 1.0 - aastep(computedThickness, d);\n' +
        // now compute the final color of the mesh
        'vec4 outColor = vec4(0.0);\n' +
        'if (seeThrough) {\n' +
        'outColor = vec4(stroke, edge);\n' +
        'if (insideAltColor && !gl_FrontFacing) {\n' +
        'outColor.rgb = fill;\n' +
        'if( outColor.a == 1.0 ) outColor.a = opacityFill;\n' +
        '} else {\n' +
        'if( outColor.a == 1.0 ) outColor.a = opacityStroke;\n' +
        '}\n' +
        '} else {\n' +
        'vec3 mainStroke = mix(fill, stroke, edge);\n' +
        'outColor.a = 1.0;\n' +
        'if (dualStroke) {\n' +
        'float inner = 1.0 - aastep(secondThickness, d);\n' +
        'vec3 wireColor = mix(fill, stroke, abs(inner - edge));\n' +
        'outColor.rgb = wireColor;\n' +
        '} else {\n' +
        'outColor.rgb = mainStroke;\n' +
        '}\n' +
        '}\n' +
        'return outColor;\n' +
        '}\n' +
        'void main () {\n' +
        'gl_FragColor = getStyledWireframe(vBarycentric);\n' +
        '}'

    //Main
    THREE.WebGLWireframes.makeMaterial = function (options) {
        options = options || {}

        var stroke = options.stroke || new THREE.Color(0x000000)
        var hsl = stroke.getHSL()
        var fill = new THREE.Color(0x000000)
        fill.setHSL(hsl.h, hsl.s, hsl.l / 2)

        var material = new THREE.ShaderMaterial({
            extensions: {
                // needed for anti-alias smoothstep, aastep()
                derivatives: true,
            },
            transparent: true,
            side: THREE.DoubleSide,
            uniforms: {
                // some parameters for the shader
                time: { value: 0 },
                stroke: { value: stroke },
                fill: { value: fill },
                noiseA: { value: false },
                noiseB: { value: false },
                dualStroke: { value: false },
                seeThrough: { value: options.seeThrough || false },
                insideAltColor: { value: true },
                thickness: { value: 0.075 },
                secondThickness: { value: 0.05 },
                dashEnabled: { value: true },
                dashRepeats: { value: 10.0 },
                dashOverlap: { value: false },
                dashLength: { value: 0.8 },
                dashAnimate: { value: false },
                squeeze: { value: true },
                squeezeMin: { value: 0.25 },
                squeezeMax: { value: 1.0 },
                opacityStroke: { value: 1.0 },
                opacityFill: { value: 1.0 },
            },
            // use glslify here to bring in the GLSL code
            fragmentShader: THREE.WebGLWireframes.wireFRAG,
            vertexShader: THREE.WebGLWireframes.wireVERT,
        })

        return material
    }

    THREE.WebGLWireframes.addBarycentricCoordinates = function (
        bufferGeometry,
        removeEdge = false
    ) {
        const attrib =
            bufferGeometry.getIndex() || bufferGeometry.getAttribute('position')
        const count = attrib.count / 3
        const barycentric = []

        // for each triangle in the geometry, add the barycentric coordinates
        for (let i = 0; i < count; i++) {
            const even = i % 2 === 0
            const Q = removeEdge ? 1 : 0
            if (even) {
                barycentric.push(0, 0, 1, 0, 1, 0, 1, 0, Q)
            } else {
                barycentric.push(0, 1, 0, 0, 0, 1, 1, 0, Q)
            }
        }

        // add the attribute to the geometry
        const array = new Float32Array(barycentric)
        const attribute = new THREE.BufferAttribute(array, 3)
        bufferGeometry.addAttribute('barycentric', attribute)
    }

    THREE.WebGLWireframes.unindexBufferGeometry = function (bufferGeometry) {
        // un-indices the geometry, copying all attributes like position and uv
        const index = bufferGeometry.getIndex()
        if (!index) return // already un-indexed

        const indexArray = index.array
        const triangleCount = indexArray.length / 3

        const attributes = bufferGeometry.attributes
        const newAttribData = Object.keys(attributes).map((key) => {
            return {
                array: [],
                attribute: bufferGeometry.getAttribute(key),
            }
        })

        for (let i = 0; i < triangleCount; i++) {
            // indices into attributes
            const a = indexArray[i * 3 + 0]
            const b = indexArray[i * 3 + 1]
            const c = indexArray[i * 3 + 2]
            const indices = [a, b, c]

            // for each attribute, put vertex into unindexed list
            newAttribData.forEach((data) => {
                const attrib = data.attribute
                const dim = attrib.itemSize
                // add [a, b, c] vertices
                for (let i = 0; i < indices.length; i++) {
                    const index = indices[i]
                    for (let d = 0; d < dim; d++) {
                        const v = attrib.array[index * dim + d]
                        data.array.push(v)
                    }
                }
            })
        }
        index.array = null
        bufferGeometry.setIndex(null)

        // now copy over new data
        newAttribData.forEach((data) => {
            const newArray = new data.attribute.array.constructor(data.array)
            data.attribute.setArray(newArray)
        })
    }
})
