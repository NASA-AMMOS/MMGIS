define(['d3', 'Formulae_', 'three', 'container'], function (
    d3,
    F_,
    THREE,
    container
) {
    var isShift = false
    var moveForward = null
    var moveBackward = null
    var moveLeft = null
    var moveRight = null
    var canJump = null
    var prevTime = null
    var velocity = null

    var Cameras = {
        camera: null,
        controls: null,
        orbit: {
            camera: null,
            controls: null,
            near: 0.1,
            far: 15000000000,
        },
        firstPerson: {
            camera: null,
            controls: null,
            lockControls: false,
            height: 3, //m
        },
        isFirstPerson: false, //false is orbit
        keepNear: false,
        crosshair: null,
        init: function () {
            this.orbit.camera = new THREE.PerspectiveCamera(
                60,
                container.offsetWidth / container.offsetHeight,
                this.orbit.near,
                this.orbit.far
            )
            this.orbit.camera.up = new THREE.Vector3(0, -1, 0)
            this.orbit.controls = new THREE.OrbitControls(
                this.orbit.camera,
                container
            )
            this.orbit.controls.enabled = true
            this.orbit.controls.enableDamping = true
            this.orbit.controls.dampingFactor = 0.2
            this.orbit.controls.target.y = 1
            this.orbit.controls.mouseButtons.ORBIT = THREE.MOUSE.RIGHT
            this.orbit.controls.mouseButtons.PAN = THREE.MOUSE.LEFT

            this.firstPerson.camera = new THREE.PerspectiveCamera(
                60,
                container.offsetWidth / container.offsetHeight,
                0.1,
                150000000
            )
            this.firstPerson.controls = new THREE.PointerLockControls(
                this.firstPerson.camera
            )

            if (this.isFirstPerson) {
                requestPointerLocking()
            } else {
                this.camera = this.orbit.camera
                this.controls = this.orbit.controls
            }

            updateSize()
            setupEvents()

            this.orbit.controls.update()
        },
        setAsFirstPerson: function () {
            this.isFirstPerson = true
            this.firstPerson.lockControls = lockControls || false
            requestPointerLocking()
        },
        swap: function (lockControls, skipLock) {
            this.isFirstPerson = !this.isFirstPerson
            if (this.isFirstPerson) {
                this.firstPerson.lockControls = lockControls || false
                if (skipLock) {
                    inToFirstPerson()
                } else requestPointerLocking()
            } else {
                outFromFirstPerson()
                this.camera = this.orbit.camera
                this.controls = this.orbit.controls
            }
        },
        update: function () {
            if (this.isFirstPerson) {
                var time = performance.now()
                var delta = (time - prevTime) / 1000
                prevTime = time

                velocity.x -= velocity.x * 10.0 * delta
                velocity.z -= velocity.z * 10.0 * delta

                velocity.y -= 9.8 * 100.0 * delta // 100.0 = mass

                if (moveForward) velocity.z -= 400.0 * delta
                if (moveBackward) velocity.z += 400.0 * delta

                if (moveLeft) velocity.x -= 400.0 * delta
                if (moveRight) velocity.x += 400.0 * delta
                var rp = F_.rotatePoint(
                    { x: velocity.x * delta, y: velocity.z * delta },
                    [0, 0],
                    -Cameras.firstPerson.controls.getObject().rotation.y
                )
                if (isShift) {
                    rp.x *= 3
                    rp.y *= 3
                }
                return new THREE.Vector2(rp.x, rp.y)
            }
            return false
        },
        toggleCrosshair: function (on) {
            //Make it if it's unmade
            if (Cameras.crosshair == null) {
                Cameras.crosshair = d3.select('#globeScreen').append('div')
                Cameras.crosshair
                    .style('position', 'absolute')
                    .style('left', 'calc(50% - 10px)')
                    .style('top', 'calc(50% - 10px)')
                    .style('width', '18px')
                    .style('height', '18px')
                    .style('border-radius', '15px')
                    .style('border', '3px solid lime')
            }
            if (on) Cameras.crosshair.style('display', 'inherit')
            else Cameras.crosshair.style('display', 'none')
        },
        //in degrees
        setCameraAzimuthElevation(az, el, cameraIsFirstPerson) {
            Cameras.firstPerson.controls.getObject().rotation.y =
                (-az + 180) * (Math.PI / 180)
            Cameras.firstPerson.controls.getPitchObject().rotation.x =
                el * (Math.PI / 180)
        },
        setFirstPersonHeight(height) {
            Cameras.firstPerson.height = height || 3
        },
        setFirstPersonFOV(fov) {
            Cameras.firstPerson.camera.fov = fov
            Cameras.firstPerson.camera.updateProjectionMatrix()
        },
        setFirstPersonAspect(aspect) {
            Cameras.firstPerson.camera.aspect = aspect
            Cameras.firstPerson.camera.updateProjectionMatrix()
        },
        getFirstPersonFOV() {
            return Cameras.firstPerson.camera.fov
        },
        getFirstPersonAspect() {
            return Cameras.firstPerson.camera.aspect
        },
        setFirstPersonFocalLength(focalLength) {
            Cameras.firstPerson.camera.setFocalLength(focalLength)
        },
        getFirstPersonFocalLength() {
            return Cameras.firstPerson.camera.getFocalLength()
        },
        setNearFarPlane(farther, near, far, keepNear) {
            if (keepNear === true) Cameras.keepNear = true
            if (keepNear === false) Cameras.keepNear = false

            if (farther) {
                if (!Cameras.keepNear)
                    Cameras.orbit.camera.near = Cameras.orbit.near * 10000
                //Cameras.orbit.camera.far = Cameras.orbit.far / 100
            } else {
                if (!Cameras.keepNear)
                    Cameras.orbit.camera.near = Cameras.orbit.near
                Cameras.orbit.camera.far = Cameras.orbit.far
            }
            if (near != null) Cameras.orbit.camera.near = near
            if (far != null) Cameras.orbit.camera.far = far

            Cameras.orbit.camera.updateProjectionMatrix()
        },
    }

    function inToFirstPerson() {
        Cameras.isFirstPerson = true
        Cameras.toggleCrosshair(true)
        Cameras.camera = Cameras.firstPerson.camera
        Cameras.firstPerson.controls.enabled = !Cameras.firstPerson.lockControls
        Cameras.controls = Cameras.firstPerson.controls
        Cameras.orbit.controls.resetPosition()
    }
    function outFromFirstPerson() {
        Cameras.isFirstPerson = false
        Cameras.toggleCrosshair(false)
        Cameras.firstPerson.controls.enabled = false
        Cameras.camera = Cameras.orbit.camera
        Cameras.controls = Cameras.orbit.controls
    }

    function requestPointerLocking() {
        var havePointerLock =
            'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document

        if (havePointerLock) {
            var element = document.body
            var pointerlockchange = function (event) {
                if (
                    document.pointerLockElement === element ||
                    document.mozPointerLockElement === element ||
                    document.webkitPointerLockElement === element
                ) {
                    inToFirstPerson()
                } else {
                    outFromFirstPerson()
                }
            }
            var pointerlockerror = function (event) {
                alert('Pointer Lock Error')
            }

            // Hook pointer lock state change events
            document.addEventListener(
                'pointerlockchange',
                pointerlockchange,
                false
            )
            document.addEventListener(
                'mozpointerlockchange',
                pointerlockchange,
                false
            )
            document.addEventListener(
                'webkitpointerlockchange',
                pointerlockchange,
                false
            )

            document.addEventListener(
                'pointerlockerror',
                pointerlockerror,
                false
            )
            document.addEventListener(
                'mozpointerlockerror',
                pointerlockerror,
                false
            )
            document.addEventListener(
                'webkitpointerlockerror',
                pointerlockerror,
                false
            )

            // Ask the browser to lock the pointer
            element.requestPointerLock =
                element.requestPointerLock ||
                element.mozRequestPointerLock ||
                element.webkitRequestPointerLock

            if (/Firefox/i.test(navigator.userAgent)) {
                var fullscreenchange = function (event) {
                    if (
                        document.fullscreenElement === element ||
                        document.mozFullscreenElement === element ||
                        document.mozFullScreenElement === element
                    ) {
                        document.removeEventListener(
                            'fullscreenchange',
                            fullscreenchange
                        )
                        document.removeEventListener(
                            'mozfullscreenchange',
                            fullscreenchange
                        )

                        element.requestPointerLock()
                    }
                }
                document.addEventListener(
                    'fullscreenchange',
                    fullscreenchange,
                    false
                )
                document.addEventListener(
                    'mozfullscreenchange',
                    fullscreenchange,
                    false
                )

                element.requestFullscreen =
                    element.requestFullscreen ||
                    element.mozRequestFullscreen ||
                    element.mozRequestFullScreen ||
                    element.webkitRequestFullscreen

                element.requestFullscreen()
            } else {
                element.requestPointerLock()
            }
        } else {
            Cameras.isFirstPerson = false
            alert('This browser does not support Pointer Locking.')
        }
    }

    function setupEvents() {
        moveForward = false
        moveBackward = false
        moveLeft = false
        moveRight = false
        canJump = false

        prevTime = performance.now()
        velocity = new THREE.Vector3()

        var onKeyDown = function (event) {
            if (Cameras.firstPerson.lockControls) return

            isShift = event.shiftKey
            switch (event.keyCode) {
                case 38: // up
                case 87: // w
                    moveForward = true
                    break
                case 37: // left
                case 65: // a
                    moveLeft = true
                    break
                case 40: // down
                case 83: // s
                    moveBackward = true
                    break
                case 39: // right
                case 68: // d
                    moveRight = true
                    break
                case 32: // space
                    if (canJump === true) velocity.y += 350
                    canJump = false
                    break
            }
        }
        var onKeyUp = function (event) {
            if (Cameras.firstPerson.lockControls) return

            isShift = event.shiftKey
            switch (event.keyCode) {
                case 38: // up
                case 87: // w
                    moveForward = false
                    break
                case 37: // left
                case 65: // a
                    moveLeft = false
                    break
                case 40: // down
                case 83: // s
                    moveBackward = false
                    break
                case 39: // right
                case 68: // d
                    moveRight = false
                    break
            }
        }
        document.addEventListener('keydown', onKeyDown, false)
        document.addEventListener('keyup', onKeyUp, false)

        window.addEventListener('resize', updateSize, false)
    }

    var updateSize = function () {
        Cameras.orbit.camera.aspect =
            container.offsetWidth / container.offsetHeight
        Cameras.orbit.camera.updateProjectionMatrix()
        Cameras.firstPerson.camera.aspect =
            container.offsetWidth / container.offsetHeight
        Cameras.firstPerson.camera.updateProjectionMatrix()
    }

    return Cameras
})
