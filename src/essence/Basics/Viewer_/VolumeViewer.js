import $ from 'jquery'

import * as THREE from '../../../external/THREE/three152'
import { GUI } from './lil-gui.module.min.js'

import { VolumeRenderShader1 } from './VolumeShader.js'
import loadNetcdf from '../../loaders/netcdf/netcdf'

import { NRRDLoader } from './temp/NRRDLoader.js'

export default function (domEl, lookupPath, options) {
    options = options || {}

    let camera,
        controls,
        scene,
        renderer,
        orbitControls,
        material,
        volconfig,
        cmtextures,
        gui,
        mode = 'volume' //'slicer'

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
        }
    }

    function render() {
        renderer.render(scene, camera)
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
            loadNetcdf(null, 'THT', (volume) => {
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

                gui.add(volume, 'lowerThreshold', volume.min, volume.max, 1)
                    .name('Lower Threshold')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
                gui.add(volume, 'upperThreshold', volume.min, volume.max, 1)
                    .name('Upper Threshold')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
                gui.add(volume, 'windowLow', volume.min, volume.max, 1)
                    .name('Window Low')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
                gui.add(volume, 'windowHigh', volume.min, volume.max, 1)
                    .name('Window High')
                    .onChange(function () {
                        volume.repaintAllSlices()
                        render()
                    })
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

    return {
        changeVolume: changeVolume,
        camera: camera,
        controls: controls,
        resize: resize,
    }
}
