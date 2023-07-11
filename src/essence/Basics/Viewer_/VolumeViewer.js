import $ from 'jquery'

import * as THREE from '../../../external/THREE/three152'
import { GUI } from './lil-gui.module.min.js'

import { VolumeRenderShader1 } from './VolumeShader.js'
import { LayeredShader } from './LayeredShader.js'
import loadNetcdf from '../../loaders/netcdf/netcdf'

import { NRRDLoader } from './temp/NRRDLoader.js'

export default function (domEl, lookupPath, options) {
    options = options || {}

    let camera,
        controls,
        scene,
        scene2,
        renderer,
        orbitControls,
        material,
        volconfig,
        cmtextures,
        gui,
        layeredVars = {},
        mode = 'layered' //'volume' //'slicer',// 'layered'

    const colorRamps = {
        blue: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
        'blue-orange': ['#ff6219', '#9c461e', '#3b312c', '#1f9787', '#00ffdc'],
        grayscale: ['#000000', '#323232', '#494949', '#8c8c8c', '#ffffff'],
        'green-centered': [
            '#2f4147',
            '#18a064',
            '#00ff78',
            '#18a064',
            '#2f4147',
        ],
        heatmap: [
            '#0022c8',
            '#2b1ca7',
            '#551785',
            '#801164',
            '#aa0b43',
            '#d50621',
            '#ff0000',
            '#ff3900',
            '#ff7100',
            '#ffaa00',
            '#ffc655',
            '#ffe3aa',
            '#ffffff',
        ],
        rainbow: ['#5813fc', '#1cc2fd', '#7dfd94', '#f5c926', '#ff2b18'],
    }

    const webglSupport = (function () {
        try {
            const canvas = document.createElement('canvas')
            return !!(
                window.WebGLRenderingContext &&
                (canvas.getContext('webgl') ||
                    canvas.getContext('experimental-webgl'))
            )
        } catch (e) {
            return false
        }
    })()

    init()

    function init() {
        scene = new THREE.Scene()
        scene2 = new THREE.Scene()

        // Create renderer
        renderer = new THREE.WebGLRenderer()
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
        domEl.appendChild(renderer.domElement)

        initScene()

        $('#viewerScreen').append(
            "<div id='volume-viewer-toggle' style='cursor: pointer; position: absolute; left: 0; bottom: 0;'>TOGGLE</div>"
        )
        $('#volume-viewer-toggle').on('click', () => {
            if (mode === 'slicer') mode = 'volume'
            else if (mode === 'volume') mode = 'slicer'

            initScene()
            changeVolume()
        })
    }

    function initScene() {
        if (mode === 'volume') {
            // Create camera (The volume renderer does not work very well with perspective yet)
            const h = 512 // frustum height
            const aspect = domEl.offsetWidth / domEl.offsetHeight
            camera = new THREE.OrthographicCamera(
                (-h * aspect) / 2,
                (h * aspect) / 2,
                h / 2,
                -h / 2,
                1,
                1000
            )
            camera.position.set(-64, -64, 128)
            camera.up.set(0, 0, -1) // In our data, z is up

            // Create controls
            controls = new THREE.OrbitControls(camera, renderer.domElement)
            controls.addEventListener('change', render)
            controls.target.set(64, 64, 128)
            controls.minZoom = 0.5
            controls.maxZoom = 8
            controls.enablePan = false
            controls.update()
        } else if (mode === 'slicer') {
            camera = new THREE.PerspectiveCamera(
                60,
                domEl.offsetWidth / domEl.offsetHeight,
                0.01,
                1e10
            )
            camera.position.z = 300
            camera.up.set(0, 0, -1) // In our data, z is up

            // Create controls
            controls = new THREE.OrbitControls(camera, renderer.domElement)
            controls.addEventListener('change', render)
            controls.target.set(0, 0, 0)
            controls.minZoom = 0.5
            controls.maxZoom = 8
            controls.enablePan = false
            controls.update()
        } else if (mode == 'layered') {
            camera = new THREE.PerspectiveCamera(
                60,
                domEl.offsetWidth / domEl.offsetHeight,
                0.01,
                1e10
            )
            camera.position.z = 2
            camera.up.set(0, 0, 1) // In our data, z is up

            // Create controls
            controls = new THREE.OrbitControls(camera, renderer.domElement)
            controls.addEventListener('change', render)
            controls.target.set(0, 0, 0)
            controls.minZoom = 0.5
            controls.maxZoom = 8
            controls.enablePan = false
            controls.update()
        }
    }

    function render() {
        if (mode === 'layered') {
            //Render first pass and store the world space coords of the back face fragments into the texture.
            renderer.setRenderTarget(layeredVars.rtTexture)
            renderer.render(scene, camera)
            renderer.setRenderTarget(null)

            //Render the second pass and perform the volume rendering.
            renderer.render(scene2, camera)

            layeredVars.materialSecondPass.uniforms.steps.value =
                layeredVars.guiControls.steps
            layeredVars.materialSecondPass.uniforms.alphaCorrection.value =
                layeredVars.guiControls.alphaCorrection
        } else {
            renderer.render(scene, camera)
        }
    }

    function resize() {
        if (renderer != undefined) {
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
            const aspect = domEl.offsetWidth / domEl.offsetHeight

            const frustumHeight = camera.top - camera.bottom

            camera.left = (-frustumHeight * aspect) / 2
            camera.right = (frustumHeight * aspect) / 2
            camera.updateProjectionMatrix()
            render()
        }
    }

    function animate() {
        requestAnimationFrame(animate)

        render()
    }

    function changeVolume() {
        if (mode === 'volume') {
            // The gui for interaction
            volconfig = {
                clim1: 0,
                clim2: 1,
                renderstyle: 'mip',
                isothreshold: 0.15,
                colormap: Object.keys(colorRamps)[0],
            }
            if (gui) gui.destroy()
            gui = new GUI()
            gui.add(volconfig, 'clim1', 0, 1, 0.01).onChange(updateUniforms)
            gui.add(volconfig, 'clim2', 0, 1, 0.01).onChange(updateUniforms)
            const colormap = {}
            Object.keys(colorRamps).forEach((key) => {
                colormap[key] = key
            })
            gui.add(volconfig, 'colormap', colormap).onChange(updateUniforms)
            gui.add(volconfig, 'renderstyle', {
                mip: 'mip',
                iso: 'iso',
            }).onChange(updateUniforms)
            gui.add(volconfig, 'isothreshold', 0, 1, 0.01).onChange(
                updateUniforms
            )

            loadNetcdf(null, 'gpr', (volume) => {
                //new NRRDLoader().load(
                //'https://threejs.org/examples/models/nrrd/stent.nrrd',
                //function (volume) {
                // Texture to hold the volume. We have scalars, so we put our data in the red channel.
                // THREEJS will select R32F (33326) based on the THREE.RedFormat and THREE.FloatType.
                // Also see https://www.khronos.org/registry/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
                // TODO: look the dtype up in the volume metadata
                //volume.sizeX = volume.xLength
                //volume.sizeY = volume.yLength
                //volume.sizeZ = volume.zLength

                console.log(volume)

                camera.position.set(
                    -volume.sizeX / 2,
                    -volume.sizeY / 2,
                    volume.sizeZ / 2
                )
                controls.target.set(
                    volume.sizeX / 2,
                    volume.sizeY / 2,
                    volume.sizeZ / 2
                )
                controls.update()

                const texture = new THREE.Data3DTexture(
                    volume.data,
                    volume.sizeX,
                    volume.sizeY,
                    volume.sizeZ
                )
                texture.format = THREE.RedFormat
                texture.type = THREE.FloatType // THREE.UnsignedIntType
                texture.minFilter = texture.magFilter = THREE.LinearFilter
                texture.unpackAlignment = 1
                texture.needsUpdate = true

                // Colormap textures
                cmtextures = {}
                Object.keys(colorRamps).forEach((key) => {
                    cmtextures[key] = new THREE.TextureLoader().load(
                        getColorRamp(key),
                        render
                    )
                })

                // Material
                const shader = VolumeRenderShader1

                const uniforms = THREE.UniformsUtils.clone(shader.uniforms)

                uniforms['u_data'].value = texture
                uniforms['u_size'].value.set(
                    volume.sizeX,
                    volume.sizeY,
                    volume.sizeZ
                )
                uniforms['u_clim'].value.set(volconfig.clim1, volconfig.clim2)
                uniforms['u_renderstyle'].value =
                    volconfig.renderstyle == 'mip' ? 0 : 1 // 0: MIP, 1: ISO
                uniforms['u_renderthreshold'].value = volconfig.isothreshold // For ISO renderstyle
                uniforms['u_cmdata'].value = cmtextures[volconfig.colormap]

                material = new THREE.ShaderMaterial({
                    uniforms: uniforms,
                    vertexShader: shader.vertexShader,
                    fragmentShader: shader.fragmentShader,
                    side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
                })

                // THREE.Mesh
                const geometry = new THREE.BoxGeometry(
                    volume.sizeX,
                    volume.sizeY,
                    volume.sizeZ
                )
                geometry.translate(
                    volume.sizeX / 2 - 0.5,
                    volume.sizeY / 2 - 0.5,
                    volume.sizeZ / 2 - 0.5
                )

                const mesh = new THREE.Mesh(geometry, material)
                scene.add(mesh)

                render()
            })
        } else if (mode === 'slicer') {
            loadNetcdf(null, 'gpr', (volume) => {
                //box helper to see the extend of the volume
                const geometry = new THREE.BoxGeometry(
                    volume.xLength,
                    volume.yLength,
                    volume.zLength
                )
                const material = new THREE.MeshBasicMaterial({
                    color: 0x00ff00,
                })
                const cube = new THREE.Mesh(geometry, material)
                cube.visible = false
                const box = new THREE.BoxHelper(cube)
                scene.add(box)
                box.applyMatrix4(volume.matrix)
                scene.add(cube)

                //z plane
                const sliceZ = volume.extractSlice(
                    'z',
                    Math.floor(volume.RASDimensions[2] / 4)
                )
                scene.add(sliceZ.mesh)

                //y plane
                const sliceY = volume.extractSlice(
                    'y',
                    Math.floor(volume.RASDimensions[1] / 2)
                )
                scene.add(sliceY.mesh)

                //x plane
                const sliceX = volume.extractSlice(
                    'x',
                    Math.floor(volume.RASDimensions[0] / 2)
                )
                scene.add(sliceX.mesh)

                if (gui) gui.destroy()
                gui = new GUI()

                gui.add(sliceX, 'index', 0, volume.RASDimensions[0], 1)
                    .name('indexX')
                    .onChange(function () {
                        sliceX.repaint.call(sliceX)
                        render()
                    })
                gui.add(sliceY, 'index', 0, volume.RASDimensions[1], 1)
                    .name('indexY')
                    .onChange(function () {
                        sliceY.repaint.call(sliceY)
                        render()
                    })
                gui.add(sliceZ, 'index', 0, volume.RASDimensions[2], 1)
                    .name('indexZ')
                    .onChange(function () {
                        sliceZ.repaint.call(sliceZ)
                        render()
                    })

                gui.add(volume, 'lowerThreshold', volume.min, volume.max, 0.01)
                    .name('Lower Threshold')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
                gui.add(volume, 'upperThreshold', volume.min, volume.max, 0.01)
                    .name('Upper Threshold')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
                gui.add(volume, 'windowLow', volume.min, volume.max, 0.01)
                    .name('Window Low')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
                gui.add(volume, 'windowHigh', volume.min, volume.max, 0.01)
                    .name('Window High')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
            })
        } else if (mode === 'layered') {
            loadNetcdf(null, 'gpr', (volume) => {
                layeredVars.guiControls = new (function () {
                    this.model = 'foot'
                    this.steps = 256.0
                    this.alphaCorrection = 1.0
                    this.color1 = '#00FA58'
                    this.stepPos1 = 0.1
                    this.color2 = '#FFDD00'
                    this.stepPos2 = 0.5
                    this.color3 = '#F00000'
                    this.stepPos3 = 1.0
                    this.min = 0
                    this.max = 1
                })()

                //Load the 2D texture containing the Z slices.
                const cubeTexture = new THREE.TextureLoader().load(
                    //'public/misc/foot.raw.png'
                    layered_makeCanvas(volume)
                )

                //Don't let it generate mipmaps to save memory and apply linear filtering to prevent use of LOD.
                cubeTexture.generateMipmaps = false
                cubeTexture.minFilter = THREE.LinearFilter
                cubeTexture.magFilter = THREE.LinearFilter

                const transferTexture = layered_updateTransferFunction()

                const screenSize = new THREE.Vector2(
                    domEl.offsetWidth,
                    domEl.offsetHeight
                )
                //Use NearestFilter to eliminate interpolation.  At the cube edges, interpolated world coordinates
                //will produce bogus ray directions in the fragment shader, and thus extraneous colors.
                layeredVars.rtTexture = new THREE.WebGLRenderTarget(
                    screenSize.x,
                    screenSize.y,
                    {
                        minFilter: THREE.NearestFilter,
                        magFilter: THREE.NearestFilter,
                        wrapS: THREE.ClampToEdgeWrapping,
                        wrapT: THREE.ClampToEdgeWrapping,
                        format: THREE.RGBAFormat,
                        type: THREE.FloatType,
                        generateMipmaps: false,
                        stencilBuffer: true,
                    }
                )

                const materialFirstPass = new THREE.ShaderMaterial({
                    vertexShader: LayeredShader.vertexShaderFirstPass,
                    fragmentShader: LayeredShader.fragmentShaderFirstPass,
                    side: THREE.BackSide,
                })
                layeredVars.materialSecondPass = new THREE.ShaderMaterial({
                    vertexShader: LayeredShader.vertexShaderSecondPass,
                    fragmentShader: LayeredShader.fragmentShaderSecondPass,
                    side: THREE.FrontSide,
                    uniforms: {
                        tex: {
                            type: 't',
                            value: layeredVars.rtTexture.texture,
                        },
                        cubeTex: { type: 't', value: cubeTexture },
                        transferTex: { type: 't', value: transferTexture },
                        steps: {
                            type: '1f',
                            value: layeredVars.guiControls.steps,
                        },
                        alphaCorrection: {
                            type: '1f',
                            value: layeredVars.guiControls.alphaCorrection,
                        },
                    },
                })
                layeredVars.materialSecondPass.needsUpdate = true

                const maxDimen = Math.max(
                    volume.sizeX,
                    volume.sizeY,
                    volume.sizeZ
                )
                const boxGeometry = new THREE.BoxGeometry(
                    volume.sizeY / maxDimen,
                    volume.sizeX / maxDimen,
                    volume.sizeZ / maxDimen
                )
                boxGeometry.doubleSided = true

                const meshFirstPass = new THREE.Mesh(
                    boxGeometry,
                    materialFirstPass
                )
                const meshSecondPass = new THREE.Mesh(
                    boxGeometry,
                    layeredVars.materialSecondPass
                )

                scene.add(meshFirstPass)
                scene2.add(meshSecondPass)

                ////

                var gui = new GUI()
                var modelSelected = gui.add(layeredVars.guiControls, 'model', [
                    'bonsai',
                    'foot',
                    'teapot',
                ])
                gui.add(layeredVars.guiControls, 'steps', 0.0, 512.0)
                gui.add(
                    layeredVars.guiControls,
                    'alphaCorrection',
                    0.01,
                    5.0
                ).step(0.01)

                modelSelected.onChange(function (value) {
                    layeredVars.materialSecondPass.uniforms.cubeTex.value =
                        cubeTexture
                })

                //Setup transfer function steps.
                var step1Folder = gui.addFolder('Step 1')
                var controllerColor1 = step1Folder.addColor(
                    layeredVars.guiControls,
                    'color1'
                )
                var controllerStepPos1 = step1Folder.add(
                    layeredVars.guiControls,
                    'stepPos1',
                    0.0,
                    1.0
                )
                controllerColor1.onChange(layered_updateTextures)
                controllerStepPos1.onChange(layered_updateTextures)

                var step2Folder = gui.addFolder('Step 2')
                var controllerColor2 = step2Folder.addColor(
                    layeredVars.guiControls,
                    'color2'
                )
                var controllerStepPos2 = step2Folder.add(
                    layeredVars.guiControls,
                    'stepPos2',
                    0.0,
                    1.0
                )
                controllerColor2.onChange(layered_updateTextures)
                controllerStepPos2.onChange(layered_updateTextures)

                var step3Folder = gui.addFolder('Step 3')
                var controllerColor3 = step3Folder.addColor(
                    layeredVars.guiControls,
                    'color3'
                )
                var controllerStepPos3 = step3Folder.add(
                    layeredVars.guiControls,
                    'stepPos3',
                    0.0,
                    1.0
                )
                controllerColor3.onChange(layered_updateTextures)
                controllerStepPos3.onChange(layered_updateTextures)

                var modifyFolder = gui.addFolder('Crop Data')
                var modifyMin = modifyFolder.add(
                    layeredVars.guiControls,
                    'min',
                    0.0,
                    1.0
                )
                var modifyMax = modifyFolder.add(
                    layeredVars.guiControls,
                    'max',
                    0.0,
                    1.0
                )
                modifyMin.onFinishChange(() => {
                    layered_cropData(volume)
                })
                modifyMax.onFinishChange(() => {
                    layered_cropData(volume)
                })

                step1Folder.open()
                step2Folder.open()
                step3Folder.open()
                modifyFolder.open()

                animate()
            })
        }
    }

    function updateUniforms() {
        material.uniforms['u_clim'].value.set(volconfig.clim1, volconfig.clim2)
        material.uniforms['u_renderstyle'].value =
            volconfig.renderstyle == 'mip' ? 0 : 1 // 0: MIP, 1: ISO
        material.uniforms['u_renderthreshold'].value = volconfig.isothreshold // For ISO renderstyle
        material.uniforms['u_cmdata'].value = cmtextures[volconfig.colormap]

        render()
    }

    function getColorRamp(rampName) {
        let colors = colorRamps[rampName] || []
        let canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 1
        let ctx = canvas.getContext('2d')
        let gradient = ctx.createLinearGradient(0, 0, 256, 0)
        colors.forEach((c, idx) => {
            gradient.addColorStop(idx / (colors.length - 1), c)
        })
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 255, 1)

        return canvas.toDataURL()
    }

    function layered_updateTextures(value) {
        layeredVars.materialSecondPass.uniforms.transferTex.value =
            layered_updateTransferFunction()
    }
    function layered_cropData(volume) {
        const cubeTexture = new THREE.TextureLoader().load(
            layered_makeCanvas(volume)
        )
        cubeTexture.generateMipmaps = false
        cubeTexture.minFilter = THREE.LinearFilter
        cubeTexture.magFilter = THREE.LinearFilter

        layeredVars.materialSecondPass.uniforms.cubeTex.value = cubeTexture
    }
    function layered_updateTransferFunction() {
        const canvas = document.createElement('canvas')
        document.body.appendChild(canvas)
        canvas.style.position = 'fixed'
        canvas.style.top = 0
        canvas.height = 20
        canvas.width = 256

        const ctx = canvas.getContext('2d')

        const grd = ctx.createLinearGradient(
            0,
            0,
            canvas.width - 1,
            canvas.height - 1
        )
        grd.addColorStop(
            layeredVars.guiControls.stepPos1,
            layeredVars.guiControls.color1
        )
        grd.addColorStop(
            layeredVars.guiControls.stepPos2,
            layeredVars.guiControls.color2
        )
        grd.addColorStop(
            layeredVars.guiControls.stepPos3,
            layeredVars.guiControls.color3
        )

        ctx.fillStyle = grd
        ctx.fillRect(0, 0, canvas.width - 1, canvas.height - 1)

        const transferTexture = new THREE.Texture(canvas)
        transferTexture.wrapS = transferTexture.wrapT =
            THREE.ClampToEdgeWrapping
        transferTexture.needsUpdate = true

        return transferTexture
    }
    function layered_makeCanvas(volume) {
        const width = volume.sizeX
        const height = volume.sizeY
        const depth = volume.sizeZ

        //To convert raw files larger than 256x256x256 you can tweak these values.
        const maxTilesWidth = 16
        const maxTilesHeight = 16
        const totalTiles = Math.min(depth, maxTilesWidth * maxTilesHeight)

        const newWidth = width * maxTilesWidth
        const newHeight = height * maxTilesHeight

        const canvas = document.createElement('canvas')

        //document.body.append(canvas)
        canvas.style.position = 'fixed'
        canvas.style.top = '100px'
        canvas.style.left = 0
        canvas.style.background = 'white'

        canvas.width = newWidth
        canvas.height = newHeight
        const ctx = canvas.getContext('2d')
        const imgData = ctx.createImageData(newWidth, newHeight)

        const flipY = true

        const length = volume.data.Length

        let realPosX, realPosY

        const croppedData = volume.cropData(
            layeredVars.guiControls.min,
            layeredVars.guiControls.max
        )

        let zPos = 0

        for (let z = 0; z < totalTiles; z++) {
            zPos = Math.round(((totalTiles - z) / totalTiles) * depth)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let value = croppedData[volume.access(x, y, zPos)] * 255

                    realPosX = x + (z % maxTilesWidth) * width

                    let yPos
                    if (flipY) {
                        yPos = height - y - 1
                    } else {
                        yPos = y
                    }

                    realPosY = yPos + parseInt(z / maxTilesWidth) * height
                    imgData.data[(realPosY * newWidth + realPosX) * 4] = value
                    imgData.data[(realPosY * newWidth + realPosX) * 4 + 1] =
                        value
                    imgData.data[(realPosY * newWidth + realPosX) * 4 + 2] =
                        value
                    imgData.data[(realPosY * newWidth + realPosX) * 4 + 3] =
                        value
                }
            }
        }

        ctx.putImageData(imgData, 0, 0)

        return canvas.toDataURL()
    }

    return {
        changeVolume: changeVolume,
        camera: camera,
        controls: controls,
        resize: resize,
    }
}
