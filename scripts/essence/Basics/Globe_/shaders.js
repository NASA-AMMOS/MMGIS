// prettier-ignore
define( [ 'jquery', 'three'],
function(    $    ,  THREE ) {
  Shaders = {
    init: function() {

    },
    simplePoint: function() {
      
      var baseShaderVert = 
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +

        "void main() {\n" +
          "gl_PointSize = 50.\n" +
          "gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.)\n" +
        "}";

      var baseShaderFrag = 
        "void main() {\n" +
          "gl_FragColor = vec4(0.0, 1.0, 1.0, 0.0)\n" +
        "}";
      //Now make the material
      return new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: baseShaderVert,
        fragmentShader: baseShaderFrag,
        transparent: true,
      });
    },
    // textures is  [{ texture: texture, opacity: opacity }, {}...]
    multiTexture: function( textures ) {
        var numberOfTextures = textures.length;
        var baseShaderVert =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +

        "varying vec2 vUv;\n" +
        "uniform float exag;\n" +
        "attribute vec3 customColor;\n" +
        "varying vec3 vColor;\n" +
        
        "attribute vec3 positionHigh;\n" +
        "attribute vec3 positionLow;\n" +
        "uniform vec3 eyeHigh;\n" +
        "uniform vec3 eyeLow;\n" +
        "uniform mat4 mvpRTE;\n" +

        /*
        "vec2 ds_set(float a) {\n" +
          "vec2 z;\n" +
          "z.x = a;\n" +
          "z.y = 0.0;\n" +
          "return z;\n" +
        "}\n" +

        "vec2 ds_add(vec2 dsa, vec2 dsb) {\n" +
          "vec2 dsc;\n" +
          "float t1, t2, e;\n" +

          "t1 = dsa.x + dsb.x;\n" +
          "e = t1 - dsa.x;\n" +
          "t2 = ((dsb.x - e) + (dsa.x - (t1 - e))) + dsa.y + dsb.y;\n" +

          "dsc.x = t1 + t2;\n" +
          "dsc.y = t2 - (dsc.x - t1);\n" +
          "return dsc;\n" +
        "}\n" +

        "vec2 ds_mul(vec2 dsa, vec2 dsb) {\n" +
          "vec2 dsc;\n" +
          "float c11, c21, c2, e, t1, t2;\n" +
          "float a1, a2, b1, b2, cona, cona2, conb, conb2, split = 8193.;\n" +

          "cona = dsa.x * split;\n" +
          "conb = dsb.x * split;\n" +
          "cona2 = cona;\n" +
          "conb2 = conb;\n" +
          "a1 = cona - (cona2 - dsa.x);\n" +
          "b1 = conb - (conb2 - dsb.x);\n" +
          "a2 = dsa.x - a1;\n" +
          "b2 = dsb.x - b1;\n" +

          "c11 = dsa.x * dsb.x;\n" +
          "c21 = a2 * b2 + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11)));\n" +

          "c2 = dsa.x * dsb.y + dsa.y * dsb.x;\n" +

          "t1 = c11 + c2;\n" +
          "e = t1 - c11;\n" +
          "t2 = dsa.y * dsb.y + ((c2 - e) + (c11 - (t1 - e))) + c21;\n" +

          "dsc.x = t1 + t2;\n" +
          "dsc.y = t2 - (dsc.x - t1);\n" +

          "return dsc;\n" +
        "}\n" +
      */

        "void main() {\n" +
          "vUv = uv;\n" +
          "vColor = customColor;\n" +
          /*
          "vec3 newPosition = position * vec3(1, 1, exag);\n" +
          //newPos
          "vec2 n0 = ds_set( newPosition.x );\n" +
          "vec2 n1 = ds_set( newPosition.y );\n" +
          "vec2 n2 = ds_set( newPosition.z );\n" +
          "vec2 n3 = ds_set( 1.0 );\n" +
          //viewMatrix
          "vec2 v00 = ds_set( viewMatrix[0][0] );\n" +
          "vec2 v01 = ds_set( viewMatrix[0][1] );\n" + 
          "vec2 v02 = ds_set( viewMatrix[0][2] );\n" + 
          "vec2 v03 = ds_set( viewMatrix[0][3] );\n" + 
          "vec2 v10 = ds_set( viewMatrix[1][0] );\n" + 
          "vec2 v11 = ds_set( viewMatrix[1][1] );\n" + 
          "vec2 v12 = ds_set( viewMatrix[1][2] );\n" + 
          "vec2 v13 = ds_set( viewMatrix[1][3] );\n" + 
          "vec2 v20 = ds_set( viewMatrix[2][0] );\n" + 
          "vec2 v21 = ds_set( viewMatrix[2][1] );\n" + 
          "vec2 v22 = ds_set( viewMatrix[2][2] );\n" + 
          "vec2 v23 = ds_set( viewMatrix[2][3] );\n" + 
          "vec2 v30 = ds_set( viewMatrix[3][0] );\n" + 
          "vec2 v31 = ds_set( viewMatrix[3][1] );\n" + 
          "vec2 v32 = ds_set( viewMatrix[3][2] );\n" +
          "vec2 v33 = ds_set( viewMatrix[3][3] );\n" +  
          //modelMatrix
          "vec2 m00 = ds_set( modelMatrix[0][0] );\n" +
          "vec2 m01 = ds_set( modelMatrix[0][1] );\n" + 
          "vec2 m02 = ds_set( modelMatrix[0][2] );\n" + 
          "vec2 m03 = ds_set( modelMatrix[0][3] );\n" + 
          "vec2 m10 = ds_set( modelMatrix[1][0] );\n" + 
          "vec2 m11 = ds_set( modelMatrix[1][1] );\n" + 
          "vec2 m12 = ds_set( modelMatrix[1][2] );\n" + 
          "vec2 m13 = ds_set( modelMatrix[1][3] );\n" + 
          "vec2 m20 = ds_set( modelMatrix[2][0] );\n" + 
          "vec2 m21 = ds_set( modelMatrix[2][1] );\n" + 
          "vec2 m22 = ds_set( modelMatrix[2][2] );\n" + 
          "vec2 m23 = ds_set( modelMatrix[2][3] );\n" + 
          "vec2 m30 = ds_set( modelMatrix[3][0] );\n" + 
          "vec2 m31 = ds_set( modelMatrix[3][1] );\n" + 
          "vec2 m32 = ds_set( modelMatrix[3][2] );\n" +
          "vec2 m33 = ds_set( modelMatrix[3][3] );\n" +
          //projectionMatrix
          "vec2 p00 = ds_set( projectionMatrix[0][0] );\n" +
          "vec2 p01 = ds_set( projectionMatrix[0][1] );\n" + 
          "vec2 p02 = ds_set( projectionMatrix[0][2] );\n" + 
          "vec2 p03 = ds_set( projectionMatrix[0][3] );\n" + 
          "vec2 p10 = ds_set( projectionMatrix[1][0] );\n" + 
          "vec2 p11 = ds_set( projectionMatrix[1][1] );\n" + 
          "vec2 p12 = ds_set( projectionMatrix[1][2] );\n" + 
          "vec2 p13 = ds_set( projectionMatrix[1][3] );\n" + 
          "vec2 p20 = ds_set( projectionMatrix[2][0] );\n" + 
          "vec2 p21 = ds_set( projectionMatrix[2][1] );\n" + 
          "vec2 p22 = ds_set( projectionMatrix[2][2] );\n" + 
          "vec2 p23 = ds_set( projectionMatrix[2][3] );\n" + 
          "vec2 p30 = ds_set( projectionMatrix[3][0] );\n" + 
          "vec2 p31 = ds_set( projectionMatrix[3][1] );\n" + 
          "vec2 p32 = ds_set( projectionMatrix[3][2] );\n" +
          "vec2 p33 = ds_set( projectionMatrix[3][3] );\n" +

          //t = viewMatrix * modelMatrix
          "vec2 t00 = ds_add(ds_add(ds_add(ds_mul(v00, m00), ds_mul(v10, m01)), ds_mul(v20, m02)), ds_mul(v30, m03));\n" +
          "vec2 t10 = ds_add(ds_add(ds_add(ds_mul(v00, m10), ds_mul(v10, m11)), ds_mul(v20, m12)), ds_mul(v30, m13));\n" + 
          "vec2 t20 = ds_add(ds_add(ds_add(ds_mul(v00, m20), ds_mul(v10, m21)), ds_mul(v20, m22)), ds_mul(v30, m23));\n" + 
          "vec2 t30 = ds_add(ds_add(ds_add(ds_mul(v00, m30), ds_mul(v10, m31)), ds_mul(v20, m32)), ds_mul(v30, m33));\n" + 
          "vec2 t01 = ds_add(ds_add(ds_add(ds_mul(v01, m00), ds_mul(v11, m01)), ds_mul(v21, m02)), ds_mul(v31, m03));\n" + 
          "vec2 t11 = ds_add(ds_add(ds_add(ds_mul(v01, m10), ds_mul(v11, m11)), ds_mul(v21, m12)), ds_mul(v31, m13));\n" + 
          "vec2 t21 = ds_add(ds_add(ds_add(ds_mul(v01, m20), ds_mul(v11, m21)), ds_mul(v21, m22)), ds_mul(v31, m23));\n" + 
          "vec2 t31 = ds_add(ds_add(ds_add(ds_mul(v01, m30), ds_mul(v11, m31)), ds_mul(v21, m32)), ds_mul(v31, m33));\n" + 
          "vec2 t02 = ds_add(ds_add(ds_add(ds_mul(v02, m00), ds_mul(v12, m01)), ds_mul(v22, m02)), ds_mul(v32, m03));\n" + 
          "vec2 t12 = ds_add(ds_add(ds_add(ds_mul(v02, m10), ds_mul(v12, m11)), ds_mul(v22, m12)), ds_mul(v32, m13));\n" + 
          "vec2 t22 = ds_add(ds_add(ds_add(ds_mul(v02, m20), ds_mul(v12, m21)), ds_mul(v22, m22)), ds_mul(v32, m23));\n" + 
          "vec2 t32 = ds_add(ds_add(ds_add(ds_mul(v02, m30), ds_mul(v12, m31)), ds_mul(v22, m32)), ds_mul(v32, m33));\n" + 
          "vec2 t03 = ds_add(ds_add(ds_add(ds_mul(v03, m00), ds_mul(v13, m01)), ds_mul(v23, m02)), ds_mul(v33, m03));\n" + 
          "vec2 t13 = ds_add(ds_add(ds_add(ds_mul(v03, m10), ds_mul(v13, m11)), ds_mul(v23, m12)), ds_mul(v33, m13));\n" + 
          "vec2 t23 = ds_add(ds_add(ds_add(ds_mul(v03, m20), ds_mul(v13, m21)), ds_mul(v23, m22)), ds_mul(v33, m23));\n" +
          "vec2 t33 = ds_add(ds_add(ds_add(ds_mul(v03, m30), ds_mul(v13, m31)), ds_mul(v23, m32)), ds_mul(v33, m33));\n" +
          //u = t * newPos
          "vec2 u0 = ds_add(ds_add(ds_add(ds_mul(t00, n0), ds_mul(t10, n1)), ds_mul(t20, n2)), ds_mul(t30, n3));\n" +
          "vec2 u1 = ds_add(ds_add(ds_add(ds_mul(t01, n0), ds_mul(t11, n1)), ds_mul(t21, n2)), ds_mul(t31, n3));\n" + 
          "vec2 u2 = ds_add(ds_add(ds_add(ds_mul(t02, n0), ds_mul(t12, n1)), ds_mul(t22, n2)), ds_mul(t32, n3));\n" + 
          "vec2 u3 = ds_add(ds_add(ds_add(ds_mul(t03, n0), ds_mul(t13, n1)), ds_mul(t23, n2)), ds_mul(t33, n3));\n" + 
          //g = projectionMatrix * u
          "vec2 g0 = ds_add(ds_add(ds_add(ds_mul(p00, u0), ds_mul(p10, u1)), ds_mul(p20, u2)), ds_mul(p30, u3));\n" +
          "vec2 g1 = ds_add(ds_add(ds_add(ds_mul(p01, u0), ds_mul(p11, u1)), ds_mul(p21, u2)), ds_mul(p31, u3));\n" + 
          "vec2 g2 = ds_add(ds_add(ds_add(ds_mul(p02, u0), ds_mul(p12, u1)), ds_mul(p22, u2)), ds_mul(p32, u3));\n" + 
          "vec2 g3 = ds_add(ds_add(ds_add(ds_mul(p03, u0), ds_mul(p13, u1)), ds_mul(p23, u2)), ds_mul(p33, u3));\n" + 
          */
          /*
          "vec3 difHigh = positionHigh - eyeHigh;\n" +
          "vec3 difLow = positionLow - eyeLow;\n" +
          "gl_Position = mvpRTE * vec4(difHigh + difLow, 1.0);\n" +
          */
          "vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);\n" +
          "gl_Position = projectionMatrix * mvPosition;\n" +
          
          //"gl_Position = vec4( gl_Position.r, gl_Position.g, gl_Position.b, gl_Position.a );\n" +
          //"mat4 vtm = viewMatrix * modelMatrix;\n" +
          //"vtm[0][0] = ds_add(ds_add(ds_add(ds_mul(v00, m00), ds_mul(v10, m01)), ds_mul(v20, m02)), ds_mul(v30, m03)).x;\n" +
          //"vtm[1][0] = ds_add(ds_add(ds_add(ds_mul(v00, m10), ds_mul(v10, m11)), ds_mul(v20, m12)), ds_mul(v30, m13)).x;\n" +
          //"vtm[0][2] = ds_add(ds_add(ds_add(ds_mul(v00, m20), ds_mul(v10, m21)), ds_mul(v20, m22)), ds_mul(v30, m23)).x;\n" +
          //"vtm[0][3] = ds_add(ds_add(ds_add(ds_mul(v00, m30), ds_mul(v10, m31)), ds_mul(v20, m32)), ds_mul(v30, m33)).x;\n" +
          //"vtm[1][0] = ds_add(ds_add(ds_add(ds_mul(v01, m00), ds_mul(v11, m01)), ds_mul(v21, m02)), ds_mul(v31, m03)).x;\n" +
          //"vec4 mvPosition = vtm * vec4(newPosition, 1.0);\n" +
          //"gl_Position = projectionMatrix * mvPosition;\n" +
          /*
          "mat4 tMatrix;\n" +
          "tMatrix[0][0] = t00.x;\n" +
          "tMatrix[0][1] = t01.x;\n" + 
          "tMatrix[0][2] = t02.x;\n" + 
          "tMatrix[0][3] = t03.x;\n" + 
          "tMatrix[1][0] = t10.x;\n" + 
          "tMatrix[1][1] = t11.x;\n" + 
          "tMatrix[1][2] = t12.x;\n" + 
          "tMatrix[1][3] = t13.x;\n" + 
          "tMatrix[2][0] = t20.x;\n" + 
          "tMatrix[2][1] = t21.x;\n" + 
          "tMatrix[2][2] = t22.x;\n" + 
          "tMatrix[2][3] = t23.x;\n" + 
          "tMatrix[3][0] = t30.x;\n" + 
          "tMatrix[3][1] = t31.x;\n" + 
          "tMatrix[3][2] = t32.x;\n" + 
          "tMatrix[3][3] = t33.x;\n" +
          "vec4 mvPosition = tMatrix * vec4(newPosition, 1.0);\n" +
          "gl_Position = projectionMatrix * mvPosition;\n" +
          */
          //"gl_Position = vec4( g0.x, g1.x, g2.x, g3.x );\n" +
          //"gl_Position = projectionMatrix * vec4( u0.x, u1.x, u2.x, u3.x );\n" +
        "}";

        var baseShaderFrag =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n";

        for( var i = 0; i < numberOfTextures; i++ ) {
          baseShaderFrag +=
          "uniform sampler2D t" + i + ";\n" +
          "uniform float tA" + i + ";\n" +
          "uniform float tVAT" + i + ";\n";
        }

        baseShaderFrag +=
        "varying vec2 vUv;\n" +
        "varying vec3 vColor;\n" +

        "void main(void)\n" +
        "{\n" +
          "vec4 C;\n" +
          "vec4 B = vec4(0,0,0,0);\n" + //transparent base layer
          "vec4 C0 = texture2D(t0, vUv);\n" +
          "float highestA = tA0;\n";

        baseShaderFrag +=
        "C = vec4( C0.rgb * (C0.a * tA0) + B.rgb * B.a * (1.0 - (C0.a * tA0)), 1);\n"; // blending equation
        for( var i = 1; i < numberOfTextures; i++ ) {
          baseShaderFrag +=
          "if ( tVAT" + i + " == 0.0 && tA" + i + " > highestA ){ highestA = tA" + i + "; }\n"+ 
          "vec4 C" + i + " = texture2D(t" + i + ", vUv);\n" +
          "C = vec4( C" + i + ".rgb * (C" + i + ".a * tA" + i + ") + C.rgb * C.a * (1.0 - (C" + i + ".a * tA" + i + ")), 1);\n";
        }

        baseShaderFrag +=
          "if (";
        for( var i = 0; i < numberOfTextures; i++ ) {
          baseShaderFrag += " C" + i + ".a == 0.0";
          if( i != numberOfTextures - 1 ) {
            baseShaderFrag += " && ";
          }
        }
        baseShaderFrag +=
          "){\n" +
            "discard;\n" +
          "}\n" +
          "if (vColor.r * vColor.g * vColor.b == 1.0){\n" +
            "discard;\n" +
          "}\n" +
          "if (!(vColor.r == 0.0 && vColor.g == 0.0 && vColor.b == 0.0)){\n" +
            "C = vec4(vColor, 1);\n" +
          "}\n" +
          "C.a = highestA;\n" +
          "gl_FragColor = C;\n" +
        "}";

        var uniforms = {
          /*
          exag: { type: 'f', value: 1 },
          eyeHigh: { type: 'v3', value: 1 },
          eyeLow: { type: 'v3', value: 1 },
          mvpRTE: { type: 'm4', value: 1 },
          */
        };

        for( var i = 0; i < numberOfTextures; i++ ) {
          uniforms[ 't' + i ] = { type: "t", value: textures[i].texture };
          uniforms[ 'tA' + i ] = { type: "f", value: textures[i].opacity };
          uniforms[ 'tVAT' + i ] = { type: "f", value: textures[i].isVAT };
        }
        //Now make the material
        return new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: baseShaderVert,
          fragmentShader: baseShaderFrag,
          transparent: true,
        });
    },
    atmosphere: function(color) {
      //From: https://github.com/jeromeetienne/threex.planets/blob/master/threex.atmospherematerial.js

      // prettier-ignore
      var vertexShader = [
        'varying vec3	vVertexWorldPosition;',
        'varying vec3	vVertexNormal;',

        'void main(){',
        '	vVertexNormal = normalize(normalMatrix * normal);',

        '	vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;',

        '	// set gl_Position',
        '	gl_Position	= projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',

        ].join('\n')

      // prettier-ignore
      var fragmentShader = [
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",

        'uniform vec3	glowColor;',
        'uniform float coeficient;',
        'uniform float opacity;',
        'uniform float power;',

        'varying vec3	vVertexNormal;',
        'varying vec3	vVertexWorldPosition;',

        'void main(){',
        '	vec3 worldCameraToVertex = vVertexWorldPosition - cameraPosition;',
        '	vec3 viewCameraToVertex	= (viewMatrix * vec4(worldCameraToVertex, 0.0)).xyz;',
        '	viewCameraToVertex = normalize(viewCameraToVertex);',
        '	float intensity = pow(coeficient + dot(vVertexNormal, viewCameraToVertex), power);',
        '	gl_FragColor = vec4(glowColor * intensity * opacity, 1.0);',
        ' if (intensity > 0.4) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }',
        '}',
      ].join('\n')

      // create custom material from the shader code above
      //   that is within specially labeled script tags
      return new THREE.ShaderMaterial({
        uniforms: { 
          coeficient: {
            type: "f", 
            value: 0.1
          },
          power: {
            type: "f",
            value: 6.0
          },
          opacity: {
            type: "f",
            value: 1.0
          },
          glowColor	: {
            type: "c",
            value: new THREE.Color(color || '#444444')
          },
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
    }
  };

  return Shaders;

} );
