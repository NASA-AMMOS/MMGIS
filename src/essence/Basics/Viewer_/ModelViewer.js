import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import Hammer from 'hammerjs'
import WebVR from '../../../external/THREE/WebVR'

import * as THREE from '../../../external/THREE/three118'

export default function (domEl, lookupPath, options) {
    options = options || {}

    var camera,
        controls,
        scene,
        renderer,
        sphere,
        sphereRadius = 100,
        sphereRot = 0,
        loader
    var raycaster = new THREE.Raycaster()
    var mouse = new THREE.Vector2()
    var layers = {}
    var wasInitialized = false
    var isOrbitControls = true
    var orbitControls, orientationControls
    var hammer
    var lastPinchScale
    var model

    var webglSupport = (function () {
        try {
            var canvas = document.createElement('canvas')
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
        camera = new THREE.PerspectiveCamera(
            options.view || 75,
            domEl.offsetWidth / domEl.offsetHeight,
            0.0001,
            100
        )
        camera.position.x = 0
        camera.position.y = 10
        camera.position.z = 0

        if (webglSupport) {
            renderer = new THREE.WebGLRenderer()
            renderer.setPixelRatio(window.devicePixelRatio)
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
            renderer.setClearColor(0x000000)

            renderer.vr.enabled = true
            domEl.appendChild(WebVR.createButton(renderer))

            domEl.appendChild(renderer.domElement)

            orbitControls = new THREE.OrbitControls(camera, renderer.domElement)
            orbitControls.enablePan = true
            orbitControls.enableZoom = true
            orbitControls.autoRotate = false
            orbitControls.autoRotateSpeed = options.speed || 0.5
            orbitControls.flipPanUp = true

            orientationControls = new THREE.DeviceOrientationControls(camera)

            controls = orbitControls
            controls.target = new THREE.Vector3(0, 0, 0)

            controls.addEventListener('change', render)

            scene = new THREE.Scene()

            //Light
            var light = new THREE.AmbientLight(0xfefefe)
            scene.add(light)

            animate()

            wasInitialized = true
        }
    }

    function render() {
        renderer.render(scene, camera)
    }

    function animate() {
        //requestAnimationFrame(animate);
        controls.update()
        render()
    }

    function resize() {
        if (renderer != undefined) {
            camera.aspect = domEl.offsetWidth / domEl.offsetHeight
            camera.updateProjectionMatrix()
            renderer.setSize(domEl.offsetWidth, domEl.offsetHeight)
            render()
        }
    }

    function setTarget(posX, posY, posZ, tarX, tarY, tarZ) {
        if (posX != undefined && posY != undefined && posZ != undefined) {
            camera.position.set(posX, posY, posZ)
        }
        if (tarX != undefined && tarY != undefined && tarZ != undefined) {
            controls.target.x = tarX
            controls.target.y = tarY
            controls.target.z = tarZ
        }
        animate()
    }

    function changeModel(modelFile, textureFile, callback, progressCalback) {
        //Remove old model
        scene.remove(model)

        //Texture
        var ext = F_.getExtension(modelFile).toLowerCase()
        if (ext === 'obj') {
            var textureFile = textureFile //findTexture(modelFile, allFiles)

            var manager = new THREE.LoadingManager()
            manager.onProgress = function (item, loaded, total) {
                return
                console.log(item, loaded, total)
            }
            var textureLoader = new THREE.TextureLoader(manager)
            var texture = textureLoader.load(textureFile)
            //Model
            var onProgress = function (xhr) {
                if (xhr.lengthComputable) {
                    var percentComplete = (xhr.loaded / xhr.total) * 100
                    progressCalback(Math.round(percentComplete, 2))
                }
            }
            var onError = function (xhr) {}
            var loader = new THREE.OBJLoader(manager)
            loader.load(
                modelFile,
                function (object) {
                    var model = object
                    model.traverse(function (child) {
                        if (child instanceof THREE.Mesh) {
                            child.material.map = texture
                        }
                    })
                    model.rotation.x = -Math.PI / 2
                    scene.add(model)
                    animate()
                },
                onProgress,
                onError
            )
        } else if (ext == 'dae') {
            var daeLoader = new THREE.ColladaLoader()
            daeLoader.load(
                modelFile,
                function (mesh) {
                    //Done
                    scene.add(mesh.scene)
                    //ugly as it waits for image to load
                    setTimeout(function () {
                        progressCalback(100)
                        animate()
                    }, 2000)
                },
                onProgress,
                function (error) {
                    //Error
                    console.log('Failed to load .dae at: ' + modelFile)
                }
            )
        }

        if (typeof callback === 'function') {
            callback()
        }
    }

    function findTexture(file, allFiles) {
        for (var i = 0; i < allFiles.length; i++) {
            if (file != allFiles[i].url) {
                //don't find its self
                if (
                    file.replace(/\.[^/.]+$/, '') ==
                    allFiles[i].url.replace(/\.[^/.]+$/, '')
                ) {
                    return allFiles[i].url
                }
            }
        }
        return null
    }

    return {
        changeModel: changeModel,
        camera: camera,
        controls: controls,
        setTarget: setTarget,
        resize: resize,
    }
}
