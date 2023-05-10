import * as THREE from '../../../external/THREE/three152'
import { GUI } from './lil-gui.module.min.js'

import { VolumeRenderShader1 } from './VolumeShader.js'

export default function (domEl, lookupPath, options) {
    options = options || {}

    let camera,
        controls,
        scene,
        renderer,
        orbitControls,
        material,
        orientationControls,
        volconfig,
        cmtextures

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
        /*
        camera = new THREE.PerspectiveCamera(
            options.view || 75,
            domEl.offsetWidth / domEl.offsetHeight,
            0.0001,
            100
        )
        camera.position.x = 0
        camera.position.y = 10
        camera.position.z = 0
        */
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
        camera.up.set(0, 0, 1) // In our data, z is up

        if (webglSupport) {
            renderer = new THREE.WebGLRenderer()
            renderer.setPixelRatio(window.devicePixelRatio)
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
            renderer.setClearColor(0x000000)

            domEl.appendChild(renderer.domElement)

            orbitControls = new THREE.OrbitControls(camera, renderer.domElement)
            orbitControls.enablePan = true
            orbitControls.enableZoom = true
            orbitControls.autoRotate = false
            orbitControls.enableDamping = true
            orbitControls.dampingFactor = 0.13
            orbitControls.autoRotateSpeed = options.speed || 0.5
            orbitControls.flipPanUp = true
            orbitControls.panSpeed = 0.2
            orbitControls.rotateSpeed = 0.2

            orientationControls = new THREE.DeviceOrientationControls(camera)

            controls = orbitControls
            controls.target = new THREE.Vector3(0, 0, 0)

            controls.addEventListener('change', render)

            scene = new THREE.Scene()

            //Light
            const light = new THREE.AmbientLight(0xfefefe)
            scene.add(light)
        }

        /*
        scene = new THREE.Scene()

        // Create renderer
        renderer = new THREE.WebGLRenderer()
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
        domEl.appendChild(renderer.domElement)

        // Create camera (The volume renderer does not work very well with perspective yet)
        const h = 512 // frustum height
        const aspect = window.innerWidth / window.innerHeight
        camera = new THREE.OrthographicCamera(
            (-h * aspect) / 2,
            (h * aspect) / 2,
            h / 2,
            -h / 2,
            1,
            1000
        )
        camera.position.set(-64, -64, 128)
        camera.up.set(0, 0, 1) // In our data, z is up

        // Create controls
        controls = new THREE.OrbitControls(camera, renderer.domElement)
        controls.addEventListener('change', render)
        controls.target.set(64, 64, 128)
        controls.minZoom = 0.5
        controls.maxZoom = 4
        controls.enablePan = false
        controls.update()
        */
    }

    function render() {
        renderer.render(scene, camera)
    }

    function resize() {
        if (renderer != undefined) {
            camera.aspect = domEl.offsetWidth / domEl.offsetHeight
            camera.updateProjectionMatrix()
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
            render()
        }
    }

    function changeVolume() {
        // The gui for interaction
        volconfig = {
            clim1: 0,
            clim2: 1,
            renderstyle: 'mip',
            isothreshold: 0.15,
            colormap: 'viridis',
        }
        const gui = new GUI()
        gui.add(volconfig, 'clim1', 0, 1, 0.01).onChange(updateUniforms)
        gui.add(volconfig, 'clim2', 0, 1, 0.01).onChange(updateUniforms)
        gui.add(volconfig, 'colormap', {
            gray: 'gray',
            viridis: 'viridis',
        }).onChange(updateUniforms)
        gui.add(volconfig, 'renderstyle', { mip: 'mip', iso: 'iso' }).onChange(
            updateUniforms
        )
        gui.add(volconfig, 'isothreshold', 0, 1, 0.01).onChange(updateUniforms)

        // create a buffer with some data
        const volume = {
            sizeX: 32,
            sizeY: 32,
            sizeZ: 32,
            data: null,
        }

        //volume.data = new Uint8Array(volume.sizeX * volume.sizeY * volume.sizeZ)

        volume.data = new Float32Array(
            volume.sizeX * volume.sizeY * volume.sizeZ
        )
        let i = 0

        for (let z = 0; z < volume.sizeZ; z++) {
            for (let y = 0; y < volume.sizeY; y++) {
                for (let x = 0; x < volume.sizeX; x++) {
                    volume.data[i] = Math.random()
                    if (y > volume.sizeY / 1.5) volume.data[i] = 0.85
                    if (y > volume.sizeY / 2) volume.data[i] = 0.65
                    if (y > volume.sizeY / 3) volume.data[i] = 0.45
                    if (y > volume.sizeY / 4) volume.data[i] = 0.25
                    if (y > volume.sizeY / 8) volume.data[i] = 0.1
                    volume.data[i] = 0.85
                    i++
                }
            }
        }

        // Texture to hold the volume. We have scalars, so we put our data in the red channel.
        // THREEJS will select R32F (33326) based on the THREE.RedFormat and THREE.FloatType.
        // Also see https://www.khronos.org/registry/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
        // TODO: look the dtype up in the volume metadata

        const texture = new THREE.Data3DTexture(
            volume.data,
            volume.sizeX,
            volume.sizeY,
            volume.sizeZ
        )
        texture.format = THREE.RedFormat
        ;(texture.type = THREE.FloatType), THREE.UnsignedIntType
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.unpackAlignment = 1
        texture.needsUpdate = true

        // Colormap textures
        cmtextures = {
            viridis: new THREE.TextureLoader().load(
                './public/images/cm_viridis.png',
                render
            ),
        }

        // Material
        const shader = VolumeRenderShader1

        const uniforms = THREE.UniformsUtils.clone(shader.uniforms)

        uniforms['u_data'].value = texture
        uniforms['u_size'].value.set(
            volume.xLength,
            volume.yLength,
            volume.zLength
        )
        uniforms['u_clim'].value.set(volconfig.clim1, volconfig.clim2)
        uniforms['u_renderstyle'].value = volconfig.renderstyle == 'mip' ? 0 : 1 // 0: MIP, 1: ISO
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
    }

    function updateUniforms() {
        material.uniforms['u_clim'].value.set(volconfig.clim1, volconfig.clim2)
        material.uniforms['u_renderstyle'].value =
            volconfig.renderstyle == 'mip' ? 0 : 1 // 0: MIP, 1: ISO
        material.uniforms['u_renderthreshold'].value = volconfig.isothreshold // For ISO renderstyle
        material.uniforms['u_cmdata'].value = cmtextures[volconfig.colormap]

        render()
    }

    return {
        changeVolume: changeVolume,
        camera: camera,
        controls: controls,
        resize: resize,
    }
}
