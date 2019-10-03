define([
    'd3',
    'three',
    'Formulae_',
    'Layers_',
    'Cameras',
    'container',
    'scene',
    'renderer',
    'projection',
    'png',
    'shaders',
    'Sprites',
    'CursorInfo',
    'Globe_AR',
    'Globe_Compass',
    'Globe_Walk',
    'Globe_VectorsAsTiles',
    'Globe_Radargrams',
], function(
    d3,
    THREE,
    F_,
    L_,
    Cameras,
    container,
    scene,
    renderer,
    projection,
    png,
    shaders,
    Sprites,
    CursorInfo,
    Globe_AR,
    Globe_Compass,
    Globe_Walk,
    Globe_VectorsAsTiles,
    Globe_Radargrams
) {
    //Globe_AR = null;
    //array of current drawn xyz's of tiles
    var tilesDrawn = []
    //array of desired xyz's of tiles
    var tilesWanted = []
    //a stack of tiles to be drawn so we can don't have to process all at once
    var tilesToBeDrawn = []
    //array of tiles that are in the process of drawing
    var tilesBeingDrawn = []

    //Performance dev variables
    var overallTimer = 0
    var start, end

    var frameCounter = 0

    //These are so that if someone zooms in a lot, only the tiles at the zoom they
    // end on are loaded and not all of those in between
    //Counter of frames since last zoom movement
    var zoomedSince = 0
    //frames to wait between zoomend and zoom tile generation
    var zoomWait = 30
    var desiredZoom = null

    var Coordinates

    var northIndicator
    //PointPoles are translated when scaled. Save last one to revert when making a new one
    var lastPointTranslate = 0

    var mouseIsInDiv = false

    var raycaster = new THREE.Raycaster()
    var mouse = new THREE.Vector2()
    var loader = new THREE.TextureLoader()
    var intersectsZero = {}
    var lastIntersectsZero = {}
    //This is for comparing drags while panning the globe
    var prevMouse = { x: null, y: null }

    var texturesOrdered = []

    //higher index = on top
    var tileLayers = []
    var vectorTileLayers = []

    var vectorLayers = []
    var spriteGroup = [new THREE.Object3D(), new THREE.Object3D()]
    var lineGroup = [new THREE.Object3D(), new THREE.Object3D()]
    var vectorLayersMade = false

    var objLoader = new THREE.OBJLoader()
    var daeLoader = new THREE.ColladaLoader()

    var addonMeshGroup = [new THREE.Object3D(), new THREE.Object3D()]

    var overlayGroup = [new THREE.Object3D()]

    var Globe_ = {
        wasInitialized: false,
        wasOpened: false,
        sceneBack: new THREE.Scene(),
        scene2: new THREE.Scene(),
        //globe div
        globe: $('#globeScreen'),
        globeD3: d3.select('#globeScreen'),
        //How many THREE world units each tile is
        tileDimension: 6,
        //How many vertices wide each tile is
        tileResolution: 32,
        //How many pixel the dem data is
        trueTileResolution: 32,
        //How many tiles out from look at point
        radiusOfTiles: null,
        exaggeration: 1,
        zoom: null,
        minZoom: 0,
        minNativeZoom: 0,
        maxZoom: 0,
        yInvert: true,
        targetYOffset: 0,
        planetCenter: null, //THREE.Vector3
        rotation: null, //THREE.Vector3
        mouseLngLat: { Lng: null, Lat: null },
        toolbar: null,
        //Screen coordinates for center of globe div
        globeCenterPos: { x: null, y: null },
        centerTileXYZ: { x: null, y: null, z: null },
        LOD: { use: false, radiusOfTiles: 7, zoomsUp: 4 },
        zOff: 0, //-( projection.radiusOfPlanetMajor / projection.radiusScale ),
        shouldRaycastSprites: true,
        lastGoodCenterElevation: 0,
        link: {},
        nearPlaning: false,
        inVR: false,
        vrControls: null,
        inAR: false,
        lastCameraWasFirst: false,
        lastCameraY: null,
        firstFullLoad: false,
        firstUpdate: true,
        allVectorLayersLoaded: false,
        init: function() {
            if (renderer) {
                Globe_.wasInitialized = true
                renderer.listenVrTurnedOn(Globe_.vrTurnedOn)
                renderer.listenVrTurnedOff(Globe_.vrTurnedOff)
            } else return

            //Set Radii
            projection.setRadius('major', F_.radiusOfPlanetMajor)
            projection.setRadius('minor', F_.radiusOfPlanetMinor)

            projection.setTilemapResource(L_.configData.projection)

            //Light
            var light = new THREE.AmbientLight(0xfefefe)
            scene.add(light)

            //Set Sky
            var sky = new THREE.Sky()
            sky.scale.setScalar(450000)
            //this.sceneBack.add( sky );
            // Add Sun Helper
            var sunSphere = new THREE.Mesh(
                new THREE.SphereBufferGeometry(20000, 16, 8),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            )
            //this.sceneBack.add( sunSphere );

            var effectController = {
                turbidity: 10,
                rayleigh: 2,
                mieCoefficient: 0.005,
                mieDirectionalG: 0.8,
                luminance: 1,
                inclination: 0.49, // elevation / inclination
                azimuth: 0.25, // Facing front,
                sun: !true,
            }
            var distance = 400000
            var uniforms = sky.material.uniforms
            uniforms.turbidity.value = effectController.turbidity
            uniforms.rayleigh.value = effectController.rayleigh
            uniforms.luminance.value = effectController.luminance
            uniforms.mieCoefficient.value = effectController.mieCoefficient
            uniforms.mieDirectionalG.value = effectController.mieDirectionalG
            var theta = Math.PI * (effectController.inclination - 0.5)
            var phi = 2 * Math.PI * (effectController.azimuth - 0.5)
            sunSphere.position.x = distance * Math.cos(phi)
            sunSphere.position.y = distance * Math.sin(phi) * Math.sin(theta)
            sunSphere.position.z = distance * Math.sin(phi) * Math.cos(theta)
            sunSphere.visible = effectController.sun
            uniforms.sunPosition.value.copy(sunSphere.position)

            //Cameras
            Cameras.init()
            scene.add(Cameras.firstPerson.controls.getObject())
            //Cameras.firstPerson.controls.getObject().position.set( 0, -3000, 0 );
            Cameras.orbit.camera.up = new THREE.Vector3(0, -1, 0)

            Cameras.firstPerson.controls
                .getObject()
                .rotation.set(Math.PI, Math.PI, 0)

            Cameras.orbit.camera.position.set(
                0,
                10000000 / projection.radiusScale,
                -Globe_.zOff
            )
            Cameras.firstPerson.controls
                .getObject()
                .position.set(0, 10000000 / projection.radiusScale, 0)

            Cameras.orbit.controls.maxPolarAngle = Math.PI / 2
            Cameras.orbit.controls.enablePan = false

            this.radiusOfTiles = 8

            this.planetCenter = new THREE.Vector3(
                0,
                -(projection.radiusOfPlanetMajor / projection.radiusScale),
                0
            )
            //this.planetCenter = new THREE.Vector3( 0, 0, 0 );

            if (Globe_AR) {
                Globe_AR.setup(this, renderer, scene)
            }

            //VR/////////////////
            window.addEventListener('vr controller connected', function(event) {
                return

                //  Here it is, your VR controller instance.
                //  It’s really a THREE.Object3D so you can just add it to your scene:

                var controller = event.detail
                scene.add(controller)

                //document.getElementById( 'topBarTitle' ).style.color = 'lime';
                //  HEY HEY HEY! This is important. You need to make sure you do this.
                //  For standing experiences (not seated) we need to set the standingMatrix
                //  otherwise you’ll wonder why your controller appears on the floor
                //  instead of in your hands! And for seated experiences this will have no
                //  effect, so safe to do either way:

                controller.standingMatrix = renderer.vr.getStandingMatrix()

                //  And for 3DOF (seated) controllers you need to set the controller.head
                //  to reference your camera. That way we can make an educated guess where
                //  your hand ought to appear based on the camera’s rotation.

                controller.head = window.camera
                document.getElementById('topBarTitle').innerHtml = 'connected'

                //  Button events. How easy is this?!
                //  We’ll just use the “primary” button -- whatever that might be ;)
                //  Check out the THREE.VRController.supported{} object to see
                //  all the named buttons we’ve already mapped for you!

                controller.addEventListener('primary press began', function(
                    event
                ) {
                    document.getElementById('topBarTitle').innerHtml = event
                })
                controller.addEventListener('primary press ended', function(
                    event
                ) {
                    document.getElementById('topBarTitle').innerHtml = event
                })

                //  Remove controller on disconnect

                controller.addEventListener('disconnected', function(event) {
                    controller.parent.remove(controller)
                })
            })

            ////////////////
            //var geometry;
            //var material;

            //geometry = new THREE.BoxBufferGeometry( 1, 1, 1 );
            //material = new THREE.MeshNormalMaterial();
            //this.planet = new THREE.Mesh( geometry, material );
            //this.planetHeld = new THREE.Object3D();
            this.planet = new THREE.Object3D()
            this.planet.position.set(
                this.planetCenter.x,
                -this.planetCenter.y,
                this.planetCenter.z
            )
            scene.add(this.planet)

            this.planetLOD = new THREE.Object3D()
            matchPlanetLODToPlanet()
            this.sceneBack.add(this.planetLOD)

            //AXES - Uncomment for
            /*
      var materiall = new THREE.LineBasicMaterial({ color: 0xff0000 });
      var geometryl = new THREE.Geometry();
      geometryl.vertices.push(new THREE.Vector3(-projection.radiusOfPlanetMajor * 2, 0, 0));
      geometryl.vertices.push(new THREE.Vector3(projection.radiusOfPlanetMajor * 2, 0, 0));
      var line = new THREE.Line(geometryl, materiall);
      scene.add(line);
      var materiall = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      var geometryl = new THREE.Geometry();
      geometryl.vertices.push(new THREE.Vector3(0, -projection.radiusOfPlanetMajor * 2, 0));
      geometryl.vertices.push(new THREE.Vector3(0, projection.radiusOfPlanetMajor * 2, 0));
      var line = new THREE.Line(geometryl, materiall);
      scene.add(line);
      var materiall = new THREE.LineBasicMaterial({ color: 0x0000ff });
      var geometryl = new THREE.Geometry();
      geometryl.vertices.push(new THREE.Vector3(0, 0, -projection.radiusOfPlanetMajor * 2));
      geometryl.vertices.push(new THREE.Vector3(0, 0, projection.radiusOfPlanetMajor * 2));
      var line = new THREE.Line(geometryl, materiall);
      scene.add(line);
      */
            //END AXES

            //Set default view
            if (L_.FUTURES.globeView != null) {
                this.setCenter(L_.FUTURES.globeView)
            } else if (L_.FUTURES.mapView != null) {
                this.setCenter(L_.FUTURES.mapView)
            } else {
                this.setCenter(L_.view)
            }

            //document.getElementById( "zoomLevelIndicator" ).innerHTML = Globe_.zoom;
            this.globe = $('#globeScreen')
            //Event Listeners
            this.globe.on('mousewheel', onZoom)
            this.globe.on('DOMMouseScroll', onZoom)
            this.globe.on('wheel', onZoom)
            this.globe[0].addEventListener('touchend', onTouchZoom)

            this.globe.on('mouseenter', function() {
                mouseIsInDiv = true
            })
            this.globe.on('mouseleave', function() {
                mouseIsInDiv = false
                L_.Map_.hidePlayer()
            })
            //document.getElementById( "zoomLevelInc" ).addEventListener( "click", zoomIn );
            //document.getElementById( "zoomLevelDec" ).addEventListener( "click", zoomOut );
            container.addEventListener(
                'mousedown',
                rotateGlobe_MouseDown,
                false
            )
            container.addEventListener(
                'touchstart',
                rotateGlobe_MouseDown,
                false
            )
            container.addEventListener('mousemove', updateMouseCoords, false)
            container.addEventListener('click', onGlobeClick, false)
            document.addEventListener('click', onGlobeClickPointerLock, false)

            window.addEventListener('resize', updateGlobeCenterPos, false)

            buildToolBar()

            //Init Addons
            Globe_VectorsAsTiles.init(Globe_)

            Globe_.animate()
        },
        fina: function(coordinates) {
            if (Globe_.wasInitialized) {
                Coordinates = coordinates

                lineGroup[0].position.set(0, -Globe_.planetCenter.y, 0)
                scene.add(lineGroup[0])

                lineGroup[1].position.set(0, -Globe_.planetCenter.y, 0)
                this.scene2.add(lineGroup[1])

                spriteGroup[0].position.set(0, -Globe_.planetCenter.y, 0)
                scene.add(spriteGroup[0])

                spriteGroup[1].position.set(0, -Globe_.planetCenter.y, 0)
                this.scene2.add(spriteGroup[1])

                addonMeshGroup[0].position.set(0, -Globe_.planetCenter.y, 0)
                scene.add(addonMeshGroup[0])

                addonMeshGroup[1].position.set(0, -Globe_.planetCenter.y, 0)
                this.scene2.add(addonMeshGroup[1])

                overlayGroup[0].position.set(0, -Globe_.planetCenter.y, 0)
                this.scene2.add(overlayGroup[0])

                refreshVectorRotation()

                Globe_Walk.init(Globe_, Coordinates)
            }
        },
        //MAIN RENDER LOOP
        animate: function() {
            if (!Globe_.inAR) {
                window.requestAnimationFrame(Globe_.animate)
                if (L_.toolsLoaded) {
                    if ($('#globeScreen').width() > 0) Globe_.render()
                }
            } else {
                Globe_AR.vrDisplay.requestAnimationFrame(Globe_.animate)
                if (L_.toolsLoaded) {
                    if ($('#globeScreen').width() > 0) {
                        Globe_.update()
                        Globe_AR.update(scene)
                    }
                }
            }
        },
        render: function() {
            renderer.clear()
            Globe_.update()
            renderer.render(Globe_.sceneBack, Cameras.camera)
            renderer.clearDepth()
            renderer.render(scene, Cameras.camera)
            renderer.clearDepth()
            renderer.render(Globe_.scene2, Cameras.camera)
        },
        update: function() {
            if (!Globe_.wasInitialized) return
            frameCounter = (frameCounter + 1) % 5
            Globe_.wasOpened = true
            scene.rotation.x = 0
            scene.position.y = 0

            if (Globe_Compass) {
                Globe_Compass.setDirection(
                    Cameras.isFirstPerson,
                    Cameras.isFirstPerson ? Cameras.firstPerson : Cameras.orbit
                )
            }

            if (!Globe_.firstUpdate) {
                refreshTiles()
            }

            checkDesiredZoom()
            if (Cameras.isFirstPerson) {
                this.lastCameraWasFirst = true
                Cameras.firstPerson.controls.getObject().position.y =
                    Cameras.orbit.controls.target.y -
                    Cameras.firstPerson.height / projection.radiusScale
                var v2 = Cameras.update()
                rotateGlobe_(v2)
                mouse.x = 0
                mouse.y = 0
                updateMouseCoords()
                setPlayer()
            } else if (this.lastCameraWasFirst) {
                L_.Map_.hidePlayer()
                this.lastCameraWasFirst = false
            }
            //console.log( tilesDrawn.length );
            //Snap Cameras.camera lookat to Globe_
            if (tilesBeingDrawn.length == 0 && tilesToBeDrawn.length == 0) {
                var elevRaw = Globe_.getCenterElevationRaw()
                if (elevRaw != false) {
                    var newLookAtY = -(elevRaw + Globe_.planetCenter.y)
                    if (newLookAtY != 0 && newLookAtY != -10000) {
                        Globe_.lastGoodCenterElevation = newLookAtY
                        Cameras.orbit.controls.target.y =
                            newLookAtY - Globe_.targetYOffset
                        Cameras.orbit.controls.update()
                    }
                }
            }
            //console.log( Cameras.orbit.controls.target.y );
            if (
                frameCounter == 0 &&
                mouseIsInDiv &&
                Globe_.shouldRaycastSprites
            ) {
                raycastSprites()
            }
            if (!vectorLayersMade) {
                Globe_.makeVectorLayers(L_.layersData)
                Globe_.makeModelLayers(L_.layersData)
                refreshVectorRotation()
                vectorLayersMade = true
            }

            //Globe_.updateTileShaderVars();
            THREE.VRController.update()

            //set default camera from url if there is one
            if (L_.FUTURES.globeCamera != null) {
                var c = L_.FUTURES.globeCamera
                //console.log( c );
                Cameras.orbit.camera.position.set(c[0], c[1], c[2])
                Cameras.orbit.controls.target.x = c[3]
                Cameras.orbit.controls.target.y = c[4]
                Cameras.orbit.controls.target.z = c[5]
                Cameras.orbit.controls.update()
                L_.FUTURES.globeCamera = null
            }

            if (Globe_.firstUpdate && Globe_.allVectorLayersLoaded) {
                //Set default view
                if (L_.FUTURES.globeView != null) {
                    this.setCenter(L_.FUTURES.globeView, true)
                } else if (L_.FUTURES.mapView != null) {
                    this.setCenter(L_.FUTURES.mapView, true)
                } else {
                    this.setCenter(L_.view, true)
                }

                var o = Globe_.getCameras().orbit
                var cam = o.camera
                var con = o.controls

                var pos = cam.position
                var tar = con.target
                Globe_.globeCamera = [pos.x, pos.y, pos.z, tar.x, tar.y, tar.z]

                Globe_.firstUpdate = false
            }
        },
        vrTurnedOn(navi) {
            console.log('vr on')
            Globe_.inVR = true
            if (navi.getGamePads) {
                console.log(navi.getGamePads)
            }
            console.log(navi)
            console.log(scene)
        },
        vrTurnedOff(navi) {
            Globe_.inVR = false
            console.log('vr off')
        },
        setCenter: function(latlonzoom, ignoreZoom) {
            if (!Globe_.wasInitialized) return
            if (Globe_.linkPanned) return
            //Rotate globe
            //reset to 0, though its really only setting z to 0
            Globe_.planet.rotation.set(0, 0, 0)
            //lat is a rotation around x axis ( 90 - because top is 0 in world space)
            Globe_.planet.rotation.x = (90 - latlonzoom[0]) * (Math.PI / 180)
            //lon is a rotation around y axis
            Globe_.planet.rotation.y = latlonzoom[1] * (Math.PI / 180)
            matchPlanetLODToPlanet()
            //Change zoom
            if (latlonzoom[2] && ignoreZoom != true) {
                Globe_.zoom = latlonzoom[2]
                //Zoom globe
                Cameras.orbit.camera.position.y = -(
                    28000000 /
                    projection.radiusScale /
                    Math.pow(2, Globe_.zoom - 1)
                )
                Cameras.firstPerson.controls.getObject().position.y = -(
                    40000000 /
                    projection.radiusScale /
                    Math.pow(2, Globe_.zoom + 1)
                )
            }

            refreshVectorRotation()
        },
        setLink: function(latlng, style, spriteId) {
            if (!Globe_.wasInitialized) return

            if (Globe_.link.target != null)
                overlayGroup[0].remove(Globe_.link.target)
            if (latlng == 'off') return
            //var geometry = new THREE.SphereBufferGeometry( 0.01, 32, 32 );
            var geometry = new THREE.BufferGeometry()
            var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            Globe_.link.target = new THREE.Mesh(geometry, material)
            var elev = Globe_.getElevationAtLngLat(latlng.lng, latlng.lat)
            if (elev == 0) return
            var pos = projection.lonLatToVector3(
                latlng.lng,
                latlng.lat,
                (elev + 0.4) * Globe_.exaggeration
            )

            style = style || {
                radius: 64,
                fillColor: { r: 0, g: 255, b: 0, a: 0.7 },
                strokeWeight: 12,
                strokeColor: 'lime',
            }
            if (spriteId == null) spriteId = 'linktarget'

            var sprite = Sprites.makeMarkerSprite(style, spriteId)
            sprite.scale.set(2, 2, 2)
            Globe_.link.target.position.set(pos.x, pos.y, pos.z)
            Globe_.link.target.add(sprite)
            overlayGroup[0].add(Globe_.link.target)
            refreshVectorRotation()
            attenuate()
        },
        addTileLayer: function(layerObj) {
            if (!Globe_.wasInitialized) return

            killDrawingTiles()
            var alreadyExists = false
            if (
                layerObj.hasOwnProperty('name') &&
                layerObj.hasOwnProperty('on') &&
                layerObj.hasOwnProperty('path') &&
                layerObj.hasOwnProperty('opacity') &&
                layerObj.hasOwnProperty('minZoom') &&
                layerObj.hasOwnProperty('maxZoom')
            ) {
                for (var i = 0; i < tileLayers.length; i++) {
                    if (tileLayers[i].hasOwnProperty('name')) {
                        if (tileLayers[i].name == layerObj.name) {
                            tileLayers[i] = layerObj
                            alreadyExists = true
                            break
                        }
                    }
                }
                if (!alreadyExists) {
                    tileLayers.push(layerObj)
                    tileLayers.sort(function(a, b) {
                        return b.order - a.order
                    })
                }
                //Remove all tiles so that they'll be recreated
                if (
                    Globe_.zoom >= layerObj.minZoom &&
                    Globe_.zoom <= layerObj.maxZoom
                ) {
                    Globe_.removeAllTiles()
                }
                Globe_.maxZoom = findHighestMaxZoom()
                Globe_.minNativeZoom = findLowestMinZoom()
            } else {
                console.warn('Globe_: Attempted to add invalid layer.')
            }
        },
        //sI is scene Index
        addLayer: function(layerObj, type, sI) {
            if (!Globe_.wasInitialized) return

            if (sI == undefined) sI = 0
            if (type == 'tile') {
                this.addTileLayer(layerObj)
            } else {
                this.addVectorLayer(layerObj, 1)
            }
        },
        removeLayer: function(name, type) {
            if (!Globe_.wasInitialized) return

            if (type == 'tile') {
                this.removeTileLayer(name)
            } else {
                this.removeVectorLayer(name)
            }
        },
        removeTileLayer: function(name) {
            if (!Globe_.wasInitialized) return

            killDrawingTiles()
            for (var i = 0; i < tileLayers.length; i++) {
                if (tileLayers[i].hasOwnProperty('name')) {
                    if (tileLayers[i].name == name) {
                        if (
                            Globe_.zoom >= tileLayers[i].minZoom &&
                            Globe_.zoom <= tileLayers[i].maxZoom
                        ) {
                            var startingLength = tilesDrawn.length
                            for (var j = 0; j < startingLength; j++) {
                                removeTile(0)
                            }
                        }
                        tileLayers.splice(i, 1)
                        Globe_.maxZoom = findHighestMaxZoom()
                        Globe_.minNativeZoom = findLowestMinZoom()
                        return
                    }
                }
            }
        },
        reset: function() {
            this.removeAllLayers()

            texturesOrdered = []
            tileLayers = []
            vectorTileLayers = []

            vectorLayers = []
            spriteGroup = [new THREE.Object3D(), new THREE.Object3D()]
            lineGroup = [new THREE.Object3D(), new THREE.Object3D()]
            vectorLayersMade = false
        },
        removeAllTiles: function() {
            if (!Globe_.wasInitialized) return
            killDrawingTiles()
            //Remove all tiles so that they'll be recreated
            var startingLength = tilesDrawn.length
            for (var j = 0; j < startingLength; j++) {
                removeTile(0)
            }
        },
        removeAllLayers: function() {
            this.setCenter(L_.view)
            this.removeAllTiles()
            for (var i in tileLayers) {
                this.removeLayer(tileLayers[i].name, 'tile')
            }
            for (var i in vectorLayers) {
                this.removeLayer(vectorLayers[i].name, 'vector')
            }
        },
        setLayerOpacity: function(name, opacity) {
            if (!Globe_.wasInitialized) return

            for (t in tileLayers) {
                if (tileLayers[t].name == name) {
                    tileLayers[t].opacity = opacity
                }
            }
            for (m in tilesDrawn) {
                for (n in tilesDrawn[m].t.texturesOrdered) {
                    if (tilesDrawn[m].t.texturesOrdered[n].name == name) {
                        tilesDrawn[m].t.texturesOrdered[n].opacity = opacity
                        if (
                            tilesDrawn[m].t.material.hasOwnProperty('uniforms')
                        ) {
                            tilesDrawn[m].t.material.uniforms[
                                'tA' + n
                            ].value = opacity
                        }
                    }
                }
            }
        },
        updateTileShaderVars() {
            for (m in tilesDrawn) {
                if (tilesDrawn[m].t.material.hasOwnProperty('uniforms')) {
                    this.updateTileShaderVar(tilesDrawn[m].t)
                }
            }
        },
        updateTileShaderVar(t) {
            //eyeHigh and Low
            var eyeX = F_.doubleToTwoFloats(Cameras.camera.position.x)
            var eyeY = F_.doubleToTwoFloats(Cameras.camera.position.y)
            var eyeZ = F_.doubleToTwoFloats(Cameras.camera.position.z)
            t.material.uniforms['eyeHigh'].value = new THREE.Vector3(
                eyeX[0],
                eyeY[0],
                eyeZ[0]
            )
            t.material.uniforms['eyeLow'].value = new THREE.Vector3(
                eyeX[1],
                eyeY[1],
                eyeZ[1]
            )
            //mvpRTE
            var mvpRTE = new THREE.Matrix4()
            mvpRTE.copy(t.matrixWorld)
            mvpRTE.multiply(Cameras.camera.matrixWorld)
            //console.log( mvpRTE.elements );
            mvpRTE.elements[12] = 0
            mvpRTE.elements[13] = 0
            mvpRTE.elements[14] = 0
            //console.log( mvpRTE.elements );
            mvpRTE = mvpRTE.multiply(Cameras.camera.projectionMatrix)
            //console.log( mvpRTE.elements );
            t.material.uniforms['mvpRTE'].value = mvpRTE
        },
        makeModelLayers: function(layerObj) {
            if (!Globe_.wasInitialized) return
            //Make each layer (backwards to mantain draw order)
            for (var i = 0; i < layerObj.length; i++) {
                if (layerObj[i].type == 'model') {
                    var layerUrl = layerObj[i].url
                    var layerOpacity
                    if (!F_.isUrlAbsolute(layerUrl))
                        layerUrl = L_.missionPath + layerUrl
                    Globe_.anyToMesh(
                        layerUrl,
                        (function(i, layerUrl) {
                            return function(mesh) {
                                if (mesh)
                                    Globe_.addAddonMesh(layerObj[i], 0, mesh)
                                else
                                    console.warn(
                                        'WARNING - Error loading model layer from: ' +
                                            layerUrl
                                    )
                            }
                        })(i, layerUrl),
                        layerOpacity
                    )
                }
            }
        },
        makeVectorLayers: function(layerObj) {
            if (!Globe_.wasInitialized) return

            var totalNumber = 0
            var loaded = 0

            for (var i = 0; i < layerObj.length; i++) {
                if (layerObj[i].type == 'vector') {
                    totalNumber++
                }
            }

            if (totalNumber == 0) Globe_.allVectorLayersLoaded = true

            //Make each layer (backwards to maintain draw order)
            for (var i = layerObj.length - 1; i >= 0; i--) {
                //Decide what kind of layer it is
                //Headers do not need to be made
                if (layerObj[i].type == 'vector') {
                    var layerUrl = layerObj[i].url
                    if (layerUrl.substr(0, 4) != 'api:') {
                        if (!F_.isUrlAbsolute(layerUrl))
                            layerUrl = L_.missionPath + layerUrl
                        $.getJSON(
                            layerUrl + '?nocache=' + new Date().getTime(),
                            (function(l) {
                                return function(data) {
                                    data = data.features
                                    if (!data) {
                                        loaded++
                                        return
                                    }
                                    var sI = 0,
                                        canAdd = false
                                    for (var j = 0; j < data.length; j++) {
                                        if (!data[j].hasOwnProperty('geometry'))
                                            continue
                                        if (l.type == 'vector') {
                                            canAdd = false
                                            sI = 0

                                            //if( l.name == 'Traverse' ) console.log(data[j].geometry.coordinates[0]);
                                            if (
                                                !isNaN(
                                                    data[j].geometry
                                                        .coordinates[0]
                                                )
                                            ) {
                                                if (
                                                    data[j].geometry
                                                        .coordinates[0] < 180 &&
                                                    data[j].geometry
                                                        .coordinates[0] >
                                                        -180 &&
                                                    data[j].geometry
                                                        .coordinates[1] < 90 &&
                                                    data[j].geometry
                                                        .coordinates[1] > -90
                                                ) {
                                                    data[
                                                        j
                                                    ].geometry.coordinates = [
                                                        data[j].geometry
                                                            .coordinates,
                                                    ]
                                                    sI = 0
                                                    canAdd = true
                                                } else {
                                                    console.warn(
                                                        'Warning: Out of range latlngs for cector layer ' +
                                                            l.name
                                                    )
                                                }
                                            } else {
                                                canAdd = true
                                            }
                                            if (canAdd) {
                                                l.style.radius = l.radius
                                                Globe_.addLayer(
                                                    {
                                                        layers: data,
                                                        layerName: l.name,
                                                        type: l.type,
                                                        index: j,
                                                        name:
                                                            data[j].properties[
                                                                L_.layersNamed[
                                                                    l.name
                                                                ].useKeyAsName
                                                            ],
                                                        useKeyAsName:
                                                            L_.layersNamed[
                                                                l.name
                                                            ].useKeyAsName,
                                                        on:
                                                            L_.toggledArray[
                                                                l.name
                                                            ],
                                                        id: l.name + '_' + j,
                                                        geometry:
                                                            data[j].geometry,
                                                        style: l.style,
                                                        swapLL: true,
                                                    },
                                                    l.type,
                                                    sI
                                                )
                                                loaded++
                                                if (loaded == totalNumber)
                                                    Globe_.allVectorLayersLoaded = true
                                            }
                                        }
                                    }
                                    attenuate()
                                }
                            })(layerObj[i])
                        )
                    } else {
                        loaded++
                        if (loaded == totalNumber)
                            Globe_.allVectorLayersLoaded = true
                    }
                }
            }
        },
        addVectorTileLayer: function(layerObj, skip) {
            if (layerObj.id) {
                for (var i = 0; i < vectorTileLayers.length; i++)
                    if (vectorTileLayers[i].hasOwnProperty('id'))
                        if (vectorTileLayers[i].id == layerObj.id)
                            vectorTileLayers.splice(i, 1)
                vectorTileLayers.push(layerObj)
                if (skip !== true) {
                    for (var l in layerObj.layers) {
                        if (
                            !(
                                layerObj.layers[l].feature.geometry.type ==
                                    'Polygon' ||
                                layerObj.layers[l].feature.geometry.type ==
                                    'MultiPolygon'
                            )
                        ) {
                            //find style
                            var style = layerObj.layers[l].feature.properties

                            Globe_.addLayer(
                                {
                                    layerName: null,
                                    type: 'vector',
                                    index: l,
                                    name: null,
                                    useKeyAsName: null,
                                    on: true,
                                    id: l + '_' + layerObj.id,
                                    geometry:
                                        layerObj.layers[l].feature.geometry,
                                    style: style,
                                    swapLL: true,
                                },
                                'vector',
                                0
                            )
                        }
                    }
                    attenuate()
                }
                Globe_.removeAllTiles()
            } else
                console.warn(
                    'WARNING: Tried to add a Globe_ vector tile layer without an id.'
                )
        },
        removeVectorTileLayer: function(id) {
            if (!Globe_.wasInitialized) return

            if (id) {
                Globe_.removeVectorLayer(id, true)
                for (var i = 0; i < vectorTileLayers.length; i++)
                    if (vectorTileLayers[i].hasOwnProperty('id'))
                        if (vectorTileLayers[i].id == id) {
                            vectorTileLayers.splice(i, 1)
                            Globe_.removeAllTiles()
                            return
                        }
            }
        },
        //layerObj is { name: "", on: bool, geometry: [[lat,lng,elv],[lat,lng,elv]] style: {color: '', stroke: ''} }
        //(optional) bool key swapLL uses geometry as lng,lat
        //if geometry length is one, adds a point (cylinder) else a line
        //sI is scene index, sI = 1 is on top of tiles
        addVectorLayer: function(layerObj, sI) {
            if (!Globe_.wasInitialized) return
            //Ignore these for now
            if (
                true ||
                (layerObj.geometry.type &&
                    (layerObj.geometry.type.toLowerCase() == 'polygon' ||
                        layerObj.geometry.type.toLowerCase() == 'multipolygon'))
            ) {
                if (!layerObj.hasOwnProperty('layers')) return
                for (var i = 0; i < layerObj.layers.length; i++) {
                    layerObj.layers[i] = { feature: layerObj.layers[i] }
                    layerObj.layers[i].options = layerObj.style
                }
                Globe_.addVectorTileLayer(layerObj)
                return
            }

            if (!(sI == 0 || sI == 1)) sI = 0
            layerObj.sI = sI

            var alreadyExists = false
            if (
                layerObj.hasOwnProperty('name') &&
                layerObj.hasOwnProperty('id') &&
                layerObj.hasOwnProperty('on') &&
                layerObj.hasOwnProperty('geometry')
            ) {
                for (var i = 0; i < vectorLayers.length; i++) {
                    if (vectorLayers[i].hasOwnProperty('id')) {
                        if (vectorLayers[i].id == layerObj.id) {
                            if (
                                layerObj.geometry.type &&
                                (layerObj.geometry.type.toLowerCase() ==
                                    'linestring' ||
                                    layerObj.geometry.type.toLowerCase() ==
                                        'multilinestring')
                            ) {
                                lineGroup[sI].remove(vectorLayers[i].mesh)
                                layerObj.mesh = geometryToThickLine(
                                    layerObj.geometry.coordinates
                                )
                                lineGroup[sI].add(layerObj.mesh)
                            } else if (
                                (layerObj.geometry.coordinates &&
                                    layerObj.geometry.coordinates.length > 0) ||
                                layerObj.geometry.length > 0
                            ) {
                                console.log('A b')
                                spriteGroup[sI].remove(vectorLayers[i].mesh)
                                if (layerObj.geometry.coordinates)
                                    layerObj.mesh = geometryToSubbedSprite(
                                        layerObj.geometry.coordinates
                                    )
                                else
                                    layerObj.mesh = geometryToSubbedSprite(
                                        layerObj.geometry
                                    )
                                if (layerObj.mesh !== false)
                                    spriteGroup[sI].add(layerObj.mesh)
                            }
                            vectorLayers[i] = layerObj
                            alreadyExists = true
                            break
                        }
                    }
                }
                if (!alreadyExists) {
                    if (
                        layerObj.geometry.type &&
                        (layerObj.geometry.type.toLowerCase() == 'linestring' ||
                            layerObj.geometry.type.toLowerCase() ==
                                'multilinestring')
                    ) {
                        layerObj.mesh = geometryToThickLine(
                            layerObj.geometry.coordinates
                        )
                        lineGroup[sI].add(layerObj.mesh)
                    } else if (
                        (layerObj.geometry.coordinates &&
                            layerObj.geometry.coordinates.length > 0) ||
                        layerObj.geometry.length > 0
                    ) {
                        if (layerObj.geometry.coordinates)
                            layerObj.mesh = geometryToSubbedSprite(
                                layerObj.geometry.coordinates
                            )
                        else
                            layerObj.mesh = geometryToSubbedSprite(
                                layerObj.geometry
                            )
                        if (layerObj.mesh !== false)
                            spriteGroup[sI].add(layerObj.mesh)
                    }
                    if (layerObj.mesh !== false) vectorLayers.push(layerObj)
                }
            }

            function geometryToMeshLine(g) {
                var geometry = new THREE.Geometry()
                var i0 = 1
                var i1 = 0
                if (layerObj.swapLL) {
                    i0 = 0
                    i1 = 1
                }
                for (var i = 0; i < g.length; i++) {
                    if (isNaN(g[i][i0])) g = g[0]
                    var v = projection.lonLatToVector3(
                        g[i][i0],
                        g[i][i1],
                        (g[i][2] + 0.4) * Globe_.exaggeration
                    )
                    geometry.vertices.push(v)
                }
                var lineGeometry = new MeshLine()
                lineGeometry.setGeometry(geometry)
                var material = new MeshLineMaterial({
                    useMap: false,
                    color: new THREE.Color(
                        layerObj.style.color || layerObj.style.stroke
                    ),
                    opacity: 1,
                    resolution: new THREE.Vector2(
                        window.innerWidth,
                        window.innerHeight
                    ),
                    sizeAttenuation: false,
                    lineWidth: 20,
                    near: Cameras.orbit.camera.near,
                    far: Cameras.orbit.camera.far,
                })
                var mesh = new THREE.Mesh(lineGeometry.geometry, material)
                mesh.frustumCulled = false
                //mesh.position.set( 0, -Globe_.planetCenter.y, 0 );
                //mesh.rotation.set( Globe_.planet.rotation.x,
                //Globe_.planet.rotation.y,
                //Globe_.planet.rotation.z );
                mesh.geometry.attributes.position.needsUpdate = true
                mesh.geometry.verticesNeedUpdate = true
                mesh.geometry.computeFaceNormals()
                mesh.geometry.computeVertexNormals()
                mesh.layerName = layerObj.layerName
                mesh.strokeColor = layerObj.style.color || layerObj.style.stroke
                if (layerObj.on == false) {
                    mesh.visible = false
                }
                return mesh
            }
            function geometryToLine(g) {
                var path = []

                var geometry = new THREE.Geometry()
                var i0 = 1
                var i1 = 0
                if (layerObj.swapLL) {
                    i0 = 0
                    i1 = 1
                }
                for (var i = 0; i < g.length; i++) {
                    if (isNaN(g[i][i0])) g = g[0]
                    var v = projection.lonLatToVector3(
                        g[i][i0],
                        g[i][i1],
                        (g[i][2] + 0.4) * Globe_.exaggeration
                    )
                    geometry.vertices.push(new THREE.Vector3(v.x, v.y, v.z))
                }

                var mesh = new THREE.Line(
                    geometry,
                    new THREE.LineBasicMaterial({
                        color: layerObj.style.color || layerObj.style.stroke,
                    })
                )
                mesh.layerName = layerObj.layerName
                mesh.strokeColor = layerObj.style.color || layerObj.style.stroke
                if (layerObj.on == false) {
                    mesh.visible = false
                }
                return mesh
            }
            function geometryToThickLine(g) {
                var path = []
                var firstPos
                var i0 = 1
                var i1 = 0
                if (layerObj.swapLL) {
                    i0 = 0
                    i1 = 1
                }
                for (var i = 0; i < g.length; i++) {
                    if (isNaN(g[i][i0])) g = g[0]
                    var v = projection.lonLatToVector3(
                        g[i][i0],
                        g[i][i1],
                        (g[i][2] + 0.7) * Globe_.exaggeration
                    )
                    if (i == 0) {
                        firstPos = new THREE.Vector3(v.x, v.y, v.z)
                    }
                    path.push(
                        new THREE.Vector3(
                            v.x - firstPos.x,
                            v.y - firstPos.y,
                            v.z - firstPos.z
                        )
                    )
                    if (i != 0 || i != g.length - 1)
                        path.push(path[path.length - 1])
                }

                var positions = []
                var spline = new THREE.CatmullRomCurve3(path)
                var divisions = Math.round(1 * path.length)
                for (var i = 0, l = divisions; i < l; i++) {
                    var point = spline.getPoint(i / l)
                    positions.push(point.x, point.y, point.z)
                }
                var geometry = new THREE.LineGeometry()
                geometry.setPositions(positions)

                var material = new THREE.LineMaterial({
                    color:
                        layerObj.style.color ||
                        layerObj.style.stroke ||
                        'black',
                    linewidth: 0.01, // in pixels
                })

                var mesh = new THREE.Line2(geometry, material)
                mesh.position.set(firstPos.x, firstPos.y, firstPos.z)
                mesh.scale.set(1, 1, 1)
                mesh.layerName = layerObj.layerName
                mesh.strokeColor = layerObj.style.color || layerObj.style.stroke
                if (layerObj.on == false) {
                    mesh.visible = false
                }
                return mesh
            }
            function geometryToSubbedSprite(g) {
                if (typeof g[0] == 'number') g = [g]
                if (!g[0][2] && g[0][2] != 0) return false
                var i0 = 1
                var i1 = 0
                if (layerObj.swapLL) {
                    i0 = 0
                    i1 = 1
                }
                var v = projection.lonLatToVector3(
                    g[0][i0],
                    g[0][i1],
                    g[0][2] * Globe_.exaggeration + 1.3
                )
                var v2 = projection.lonLatToVector3(
                    g[0][i0],
                    g[0][i1] + 0.1,
                    g[0][2] * Globe_.exaggeration + 1.3
                )

                var p = new THREE.Object3D()
                p.position.set(v.x, v.y, v.z)
                p.lookAt(new THREE.Vector3(v2.x, v2.y, v2.z))
                p.layerName = layerObj.layerName
                p.useKeyAsName = layerObj.useKeyAsName
                p.name = layerObj.name
                p.strokeColor = layerObj.style.color || layerObj.style.stroke
                p.fillColor = layerObj.style.fillColor || layerObj.style.fill

                var geometry = new THREE.CylinderBufferGeometry(
                    0.15,
                    0.15,
                    2.6,
                    8
                )
                var mz = findHighestMaxZoom()
                var sf = 1
                /*
        if( mZ <= 16 )
          sf = ( ( ( 16 - mZ ) * 30) + 1 );
        */
                lastPointTranslate = -2.6 * sf * 0.65
                geometry.translate(0, -1.7, 0)
                var material = new THREE.MeshPhongMaterial({
                    color: layerObj.style.fillColor || layerObj.style.fill,
                    opacity: 0.55,
                    transparent: true,
                })
                var mesh = new THREE.Mesh(geometry, material)
                mesh.geometry.computeFaceNormals()
                mesh.geometry.computeVertexNormals()
                if (layerObj.on == false) {
                    p.visible = false
                }
                p.add(mesh)
                var sprite = geometryToInnerSprite(g)
                sprite.layerName = layerObj.layerName
                sprite.useKeyAsName = layerObj.useKeyAsName
                sprite.name = layerObj.name
                sprite.strokeColor =
                    layerObj.style.color || layerObj.style.stroke
                sprite.fillColor =
                    layerObj.style.fillColor || layerObj.style.fill
                p.add(sprite)

                return p
            }
            function geometryToCylinder(g) {
                var i0 = 1
                var i1 = 0
                if (layerObj.swapLL) {
                    i0 = 0
                    i1 = 1
                }
                var v = projection.lonLatToVector3(
                    g[0][i0],
                    g[0][i1],
                    (g[0][2] - 1) * Globe_.exaggeration
                )

                var geometry = new THREE.CylinderBufferGeometry(0.5, 0.5, 8, 8)
                var material = new THREE.MeshPhongMaterial({
                    color: layerObj.style.fillColor || layerObj.style.fill,
                })
                var mesh = new THREE.Mesh(geometry, material)

                mesh.position.set(v.x, v.y, v.z)
                mesh.up.set(new THREE.Vector3(0, 1, 0)) //!
                mesh.geometry.computeFaceNormals()
                mesh.geometry.computeVertexNormals()
                if (layerObj.on == false) {
                    mesh.visible = false
                }
                mesh.add(geometryToInnerSprite(g))
                return mesh
            }
            function geometryToInnerSprite() {
                var fillColor = layerObj.style.fillColor || layerObj.style.fill
                var strokeColor = layerObj.style.color || layerObj.style.stroke
                var sprite = Sprites.makeMarkerSprite(
                    {
                        radius: 64,
                        fillColor: fillColor,
                        strokeWeight: 12,
                        strokeColor: strokeColor,
                    },
                    layerObj.layerName
                )
                sprite.scale.set(0.5, 0.5, 0.5)
                sprite.strokeColor =
                    layerObj.style.color || layerObj.style.stroke
                sprite.fillColor =
                    layerObj.style.fillColor || layerObj.style.fill
                return sprite
            }
            function geometryToSprite(g) {
                var fillColor = layerObj.style.fillColor || layerObj.style.fill
                var strokeColor = layerObj.style.color || layerObj.style.stroke
                var sprite = Sprites.makeMarkerSprite(
                    {
                        radius: 64,
                        fillColor: fillColor,
                        strokeWeight: 12,
                        strokeColor: strokeColor,
                    },
                    layerObj.layerName
                )
                var i0 = 1
                var i1 = 0
                if (layerObj.swapLL) {
                    i0 = 0
                    i1 = 1
                }
                if (typeof g[0] == 'number') g = [g]
                var v = projection.lonLatToVector3(
                    g[0][i0],
                    g[0][i1],
                    (g[0][2] + 0.4) * Globe_.exaggeration
                )
                sprite.position.set(v.x, v.y, v.z)
                sprite.scale.set(0.5, 0.5, 0.5)
                sprite.renderOrder = layerObj.index
                if (layerObj.on == false) {
                    sprite.visible = false
                }
                sprite.layerName = layerObj.layerName
                sprite.useKeyAsName = layerObj.useKeyAsName
                sprite.name = layerObj.name
                sprite.strokeColor =
                    layerObj.style.color || layerObj.style.stroke
                sprite.fillColor =
                    layerObj.style.fillColor || layerObj.style.fill
                return sprite
            }
        },
        //substringed true would remove any layer with id as a substring of its id
        removeVectorLayer: function(id, substringed) {
            if (!Globe_.wasInitialized) return

            if (id) {
                for (var i = vectorLayers.length - 1; i >= 0; i--) {
                    if (vectorLayers[i].hasOwnProperty('id')) {
                        if (
                            (substringed &&
                                vectorLayers[i].id.indexOf(id) !== -1) ||
                            vectorLayers[i].id == id
                        ) {
                            spriteGroup[vectorLayers[i].sI].remove(
                                vectorLayers[i].mesh
                            )
                            lineGroup[vectorLayers[i].sI].remove(
                                vectorLayers[i].mesh
                            )
                            try {
                                vectorLayers[i].mesh.geometry.dipose()
                                vectorLayers[i].mesh.material.dipose()
                            } catch (e) {}
                            vectorLayers.splice(i, 1)
                        }
                    }
                }
            }
        },
        //lonlatelev, rotation, and scale optional
        //lonlatelev { lon:,lat:,elev: }
        //rotation and scale {x:,y:,z:}
        addAddonMesh: function(layerObj, sI, mesh) {
            layerObj = layerObj || {}

            var parentMesh = new THREE.Object3D()
            parentMesh.layerName = layerObj.name

            if (layerObj.position) {
                var pos = Globe_.getProjection().lonLatToVector3(
                    layerObj.position.longitude,
                    layerObj.position.latitude,
                    layerObj.position.elevation
                )
                mesh.position.set(pos.x, pos.y, pos.z)
                var quaternion = new THREE.Quaternion()
                quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    new THREE.Vector3(pos.x, pos.y, pos.z).normalize()
                )
                mesh.applyQuaternion(quaternion)
                mesh.rotateY(-layerObj.position.longitude * (Math.PI / 180))
            }
            if (layerObj.rotation) {
                mesh.rotateX(layerObj.rotation.x || 0)
                mesh.rotateY(layerObj.rotation.y || 0)
                mesh.rotateZ(layerObj.rotation.z || 0)
            }
            if (layerObj.scale != null) {
                var s = layerObj.scale
                mesh.scale.set(s || 1, s || 1, s || 1)
            }

            if (layerObj.on == false) {
                mesh.visible = false
            }

            parentMesh.add(mesh)
            addonMeshGroup[sI].add(parentMesh)
            return parentMesh
        },
        removeAddonMesh: function(sI, mesh) {
            addonMeshGroup[sI].remove(mesh)
        },
        anyToMesh: function(modelPath, callback, opacity) {
            var ext = F_.getExtension(modelPath).toLowerCase()
            switch (ext) {
                case 'obj':
                    Globe_.objToMesh(modelPath, callback)
                    break
                case 'dae':
                    Globe_.daeToMesh(modelPath, callback, false, opacity)
                    break
                default:
                    console.warn(
                        'WARNING - Unsupported model file type: ' + ext
                    )
            }
        },
        objToMesh: function(objPath, callback) {
            objLoader.load(
                objPath,
                function(mesh) {
                    //Done
                    console.log(mesh)
                    callback(mesh)
                },
                function(xhr) {
                    //Progress
                    console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
                },
                function(error) {
                    //Error
                    console.log('Failed to load .obj at: ' + objPath)
                }
            )
        },
        daeToMesh: function(daePath, callback, inAParent, opacity) {
            daeLoader.load(
                daePath,
                function(mesh) {
                    //Done
                    //care alphatest
                    if (!isNaN(opacity) && opacity >= 0 && opacity <= 1) {
                        for (let c = 0; c < mesh.scene.children.length; c++) {
                            mesh.scene.children[c].material.opacity = opacity
                            mesh.scene.children[c].material.transparent = true
                            for (let i in mesh.scene.children[c].material) {
                                if (mesh.scene.children[c].material[i]) {
                                    mesh.scene.children[c].material[
                                        i
                                    ].opacity = opacity
                                    mesh.scene.children[c].material[
                                        i
                                    ].transparent = true
                                }
                            }
                        }
                    }
                    if (inAParent) {
                        var dae = new THREE.Object3D()
                        dae.add(mesh.scene)
                        callback(dae)
                    } else {
                        callback(mesh.scene)
                    }
                },
                function(xhr) {},
                function(error) {
                    //Error
                    console.log('Failed to load .dae at: ' + daePath)
                }
            )
        },
        getCameras: function() {
            return Cameras
        },
        getContainer: function() {
            return container
        },
        //raycasted can be left blank
        getCenterXYZ: function(raycasted) {
            if (raycasted) {
                //Between planet center and straight up
                raycaster.set(
                    new THREE.Vector3(0, this.planetCenter.y, 0),
                    new THREE.Vector3(0, 1, 0)
                )
                //raycaster.setFromCamera( mouse, Cameras.camera );
                var planeArr = []
                for (var i = 0; i < tilesDrawn.length; i++) {
                    if (!tilesDrawn[i].t.isLOD) planeArr.push(tilesDrawn[i].t)
                }
                var intersects = raycaster.intersectObjects(planeArr)
                if (intersects.length > 0) {
                    intersects[intersects.length - 1].point.y +=
                        Globe_.planetCenter.y
                    if (
                        intersects[intersects.length - 1].point.x !== 0 ||
                        intersects[intersects.length - 1].point.z !== 0
                    )
                        return intersects[intersects.length - 1].point
                }
                return new THREE.Vector3(0, 0, 0)
            } else {
                //Just rotate the vector from planet center to Cameras.camera lookat(0,0,0)
                var centerPoint = {
                    x: this.planetCenter.x,
                    y: this.planetCenter.y,
                    z: this.planetCenter.z,
                }

                centerPoint = projection.rotatePoint3D(centerPoint, {
                    x: -Globe_.planet.rotation.x,
                    y: 0,
                    z: 0,
                })
                centerPoint = projection.rotatePoint3D(centerPoint, {
                    x: 0,
                    y: -Globe_.planet.rotation.y,
                    z: 0,
                })
                centerPoint = projection.rotatePoint3D(centerPoint, {
                    x: 0,
                    y: 0,
                    z: -Globe_.planet.rotation.z,
                })

                return new THREE.Vector3(
                    centerPoint.x,
                    centerPoint.y,
                    centerPoint.z
                )
            }
        },
        getCenter: function() {
            return projection.vector3ToLonLat(this.getCenterXYZ())
        },
        getCenterElevation: function() {
            return (
                this.getCenterXYZ(true).length() * projection.radiusScale -
                projection.radiusOfPlanetMajor
            )
        },
        getCenterElevationRaw: function() {
            var elev = this.getCenterXYZ(true).length()
            //If the height data hasn't loaded yet, we'll get a 0
            if (elev <= 0.1 && elev >= -0.1) return false //elev = projection.radiusOfPlanetMajor / projection.radiusScale;
            return elev
        },
        getElevationAtLngLat: function(lng, lat) {
            var v = projection.lonLatToVector3(
                lng,
                lat,
                100000 * Globe_.exaggeration
            )
            Globe_.tempObj = new THREE.Object3D()
            Globe_.tempObj.position.set(0, -Globe_.planetCenter.y, 0)
            Globe_.tempObj2 = new THREE.Object3D()
            var geometry = new THREE.SphereBufferGeometry(200, 32, 32)
            var material = new THREE.MeshBasicMaterial({ color: 0xffff00 })
            Globe_.tempObj2 = new THREE.Mesh(geometry, material)
            Globe_.tempObj2.position.set(v.x, v.y, v.z)
            Globe_.tempObj.rotation.set(
                Globe_.planet.rotation.x,
                Globe_.planet.rotation.y,
                Globe_.planet.rotation.z
            )
            Globe_.tempObj.add(Globe_.tempObj2)
            Globe_.tempObj.updateMatrixWorld()
            var vector = new THREE.Vector3()
            vector.setFromMatrixPosition(Globe_.tempObj2.matrixWorld)
            raycaster.set(
                vector,
                new THREE.Vector3(0, -this.planetCenter.y, 0).normalize()
            )

            var planeArr = []
            for (var i = 0; i < tilesDrawn.length; i++) {
                if (!tilesDrawn[i].t.isLOD) planeArr.push(tilesDrawn[i].t)
            }
            var intersects = raycaster.intersectObjects(planeArr)
            if (intersects.length > 0) {
                intersects[intersects.length - 1].point.y +=
                    Globe_.planetCenter.y
                return (
                    intersects[intersects.length - 1].point.length() *
                        projection.radiusScale -
                    projection.radiusOfPlanetMajor
                )
            }
            return 0
        },
        //Gets the lonlat of center tile
        getTileCenter: function() {
            //% Math.pow( 2, topLeft.z ) because of wrapping
            var tx = (topLeft.x + this.numXPlanes / 2) % Math.pow(2, topLeft.z)
            var ty = (topLeft.y + this.numYPlanes / 2) % Math.pow(2, topLeft.z)
            var tlat = projection.tile2lat(ty, topLeft.z, { x: tx })
            var tlon = projection.tile2long(tx, topLeft.z, { y: ty })

            return { lon: tlon, lat: tlat }
        },
        //return x y z of current center tile
        getCenterTile: function() {
            var centerll = Globe_.getCenter()
            return {
                x: projection.long2tile(
                    [centerll.lon, centerll.lat],
                    Globe_.zoom
                ),
                y: projection.lat2tile(
                    [centerll.lon, centerll.lat],
                    Globe_.zoom
                ),
                z: Globe_.zoom,
            }
        },
        //Useful for zoom
        getRadiansPerPixel: function() {
            return ((360 / Math.pow(2, Globe_.zoom)) * (Math.PI / 180)) / 256
        },
        setZoom: function(newZoom) {
            Globe_.zoom = newZoom
            if (Globe_.zoom < 0) Globe_.zoom = 0
            if (Globe_.zoom < Globe_.minNativeZoom)
                Globe_.zoom = Globe.minNativeZoom
            if (Globe_.zoom > Globe_.maxZoom) Globe_.zoom = Globe_.maxZoom
            //console.log( Globe_.zoom );
            //document.getElementById( "zoomLevelIndicator" ).innerHTML = Globe_.zoom;
        },
        toggleLayer: function(layerName, on) {
            for (s in spriteGroup) {
                for (i in spriteGroup[s].children) {
                    if (layerName == spriteGroup[s].children[i].layerName) {
                        spriteGroup[s].children[i].visible = on
                    }
                }
            }
            for (s in lineGroup) {
                for (i in lineGroup[s].children) {
                    if (layerName == lineGroup[s].children[i].layerName) {
                        lineGroup[s].children[i].visible = on
                    }
                }
            }
            for (s in addonMeshGroup) {
                for (i in addonMeshGroup[s].children) {
                    if (layerName == addonMeshGroup[s].children[i].layerName) {
                        addonMeshGroup[s].children[i].visible = on
                    }
                }
            }
            attenuate()

            //Toggle vector tiles if it happens to be that layer
            var vectorTileHit = false
            for (var i = 0; i < vectorTileLayers.length; i++) {
                if (vectorTileLayers[i].layerName == layerName) {
                    vectorTileLayers[i].on = on
                    vectorTileHit = true
                }
            }
            if (vectorTileHit) this.removeAllTiles()
        },
        findSpriteObject: function(layerName, name) {
            for (s in spriteGroup) {
                for (i in spriteGroup[s].children) {
                    if (layerName == spriteGroup[s].children[i].layerName) {
                        if (name == spriteGroup[s].children[i].name) {
                            return spriteGroup[s].children[i].children[1]
                        }
                    }
                }
            }
        },
        highlight: function(intersectsZeroObj, click) {
            if (!F_.isEmpty(intersectsZeroObj)) {
                var markers = L_.layersGroup[intersectsZeroObj.layerName]
                if (markers != undefined) {
                    markers.eachLayer(function(layer) {
                        if (
                            intersectsZeroObj.name ==
                            layer.feature.properties[
                                intersectsZeroObj.useKeyAsName
                            ]
                        ) {
                            //restore previously clicked point's material
                            if (!F_.isEmpty(lastIntersectsZero)) {
                                lastIntersectsZero.material = Sprites.makeMarkerMaterial(
                                    {},
                                    lastIntersectsZero.layerName
                                )
                                lastIntersectsZero.material.needsUpdate = true
                            }
                            //Emulate click on map
                            if (
                                click &&
                                typeof layer._events.click[0].fn === 'function'
                            )
                                layer.fireEvent('click')
                            //highlight
                            intersectsZeroObj.material = Sprites.makeMarkerMaterial(
                                {
                                    radius: 64,
                                    fillColor: '#F00',
                                    strokeWeight: 12,
                                    strokeColor: intersectsZeroObj.strokeColor,
                                },
                                'highlight_' + intersectsZeroObj.layerName
                            )
                            lastIntersectsZero = intersectsZeroObj
                            return
                        }
                    })
                }
            }
        },
        changeExaggeration: function(x) {
            this.removeAllTiles()
            //save the zoom distance
            var zoomDist = Cameras.orbit.camera.position.distanceTo(
                Cameras.orbit.controls.target
            )
            Cameras.orbit.controls.target.y *= x / this.exaggeration
            Cameras.orbit.controls.target.y -= Globe_.targetYOffset
            //match the saved zoom dist
            Cameras.orbit.camera.position.set(
                Cameras.orbit.camera.position.x,
                Cameras.orbit.controls.target.y - zoomDist,
                Cameras.orbit.camera.position.z
            )
            Cameras.orbit.controls.update()

            this.exaggeration = x
            vectorLayersMade = false
        },
        invalidateSize: function() {
            if (Globe_.wasInitialized) {
                renderer.setSize(container.offsetWidth, container.offsetHeight)
                Cameras.orbit.camera.aspect =
                    container.offsetWidth / container.offsetHeight
                Cameras.orbit.camera.updateProjectionMatrix()
                Cameras.firstPerson.camera.aspect =
                    container.offsetWidth / container.offsetHeight
                Cameras.firstPerson.camera.updateProjectionMatrix()
                updateGlobeCenterPos()
            }
        },
        getScene: function() {
            return scene
        },
        getVectorLayers: function() {
            return vectorLayers
        },
        getVectorLayerWithNameAndGeometry(name, geometry) {
            for (v in vectorLayers)
                if (vectorLayers[v].layerName == name)
                    if (vectorLayers[v].geometry == geometry)
                        return vectorLayers[v]
        },
        getVectorTileLayers() {
            return vectorTileLayers
        },
        getProjection: function() {
            return projection
        },
        //Addons
        radargram: function(layerName, geometry, url, length, depth) {
            Globe_Radargrams.radargram(
                Globe_,
                layerName,
                geometry,
                url,
                length,
                depth
            )
        },
    }

    function refreshTiles() {
        updateDesiredTiles()

        var matched = false

        var anyMatched = false

        //This clears any tiles that were to be drawn but are no longer wanted before it could be drawn
        tilesToBeDrawn = []
        //See what tiles we need to add and add them
        for (var i = 0; i < tilesWanted.length; i++) {
            matched = false
            for (var j = 0; j < tilesDrawn.length; j++) {
                //If they match, hence it already exists, don't redraw
                if (
                    tilesWanted[i].x == tilesDrawn[j].x &&
                    tilesWanted[i].y == tilesDrawn[j].y &&
                    tilesWanted[i].z == tilesDrawn[j].z
                ) {
                    matched = true
                    anyMatched = true
                    break
                }
            }
            for (var j = 0; j < tilesToBeDrawn.length; j++) {
                //If they match, hence it already exists, don't redraw
                if (
                    tilesWanted[i].x == tilesToBeDrawn[j].x &&
                    tilesWanted[i].y == tilesToBeDrawn[j].y &&
                    tilesWanted[i].z == tilesToBeDrawn[j].z
                ) {
                    matched = true
                    anyMatched = true
                    break
                }
            }
            //Not matched? Then we draw it
            if (!matched) {
                tilesToBeDrawn.push(tilesWanted[i])
            }
        }
        if (tilesToBeDrawn.length > 0) {
            //Should be wanted at time of pop
            let failCallback = function() {
                if (tilesToBeDrawn.length > 0) {
                    addTile(tilesToBeDrawn.pop(), failCallback)
                }
            }
            //addTile( tilesToBeDrawn.pop(), failCallback );
            addTile(tilesToBeDrawn.pop(), failCallback)
        }

        //See what tiles we need to remove and remove them
        if (tilesToBeDrawn.length == 0 && tilesBeingDrawn.length == 0) {
            for (var i = 0; i < tilesDrawn.length; i++) {
                matched = false
                for (var j = 0; j < tilesWanted.length; j++) {
                    //If they match, hence it already exists, don't redraw
                    if (
                        tilesDrawn[i].x == tilesWanted[j].x &&
                        tilesDrawn[i].y == tilesWanted[j].y &&
                        tilesDrawn[i].z == tilesWanted[j].z
                    ) {
                        matched = true
                        break
                    }
                }
                //Not matched? Then we remove it
                if (!matched) {
                    removeTile(i)
                }
            }
        }

        //Update Load spinner
        if (tilesToBeDrawn.length == 0) {
            $('#globeToolBarLoading').css({ opacity: 0 })

            if (!Globe_.firstFullLoad) {
                rotateGlobe_({ pageX: 0, pageY: 0 }, { x: 0.00001, y: 0.00001 })
            }
            Globe_.firstFullLoad = true
        } else if ($('#globeToolBarLoading').css('opacity') == 0) {
            $('#globeToolBarLoading').css({ opacity: 1 })
        }
        $('#globeToolBarLoadingTextAdding').text(tilesToBeDrawn.length)
    }
    function updateDesiredTiles() {
        tilesWanted = []
        var center = Globe_.getCenter()
        var xCenter = projection.long2tile(
            [center.lon, center.lat],
            Globe_.zoom
        )
        var yCenter = projection.lat2tile([center.lon, center.lat], Globe_.zoom)

        var r = Globe_.radiusOfTiles
        //sqrt(d) = tile distance from center
        // used for sorting by distance later
        var d
        //Radius over a 2d array
        //Simply goes over the square size r*2 and checks to see if a spot is inside
        for (var x = xCenter - r + 1; x < xCenter + r; x++) {
            for (var y = yCenter - r + 1; y < yCenter + r; y++) {
                d = Math.pow(x - xCenter, 2) + Math.pow(y - yCenter, 2)
                if (d <= r * r) {
                    tilesWanted.push({
                        x: mod(x, Math.pow(2, Globe_.zoom)),
                        y: mod(y, Math.pow(2, Globe_.zoom)),
                        z: Globe_.zoom,
                        d: d,
                        make: true,
                        isLOD: false,
                    })
                }
            }
        }
        //Now sort them based on distance
        tilesWanted.sort(function(a, b) {
            return b.d - a.d
        })

        //And now LOD tiles
        //LOD is simple -- it just renders a higher(lower in number) zoom layer on a lower scene
        if (Globe_.LOD.use) {
            var lr = Globe_.LOD.radiusOfTiles //LOD radius
            var zuZ = Math.max(
                Globe_.minNativeZoom,
                Globe_.zoom - Globe_.LOD.zoomsUp
            ) //zooms up zoom
            if (Math.abs(zuZ - Globe_.zoom) <= 1) return
            xCenter = projection.long2tile([center.lon, center.lat], zuZ)
            yCenter = projection.lat2tile([center.lon, center.lat], zuZ)
            for (var x = xCenter - lr + 1; x < xCenter + lr; x++) {
                for (var y = yCenter - lr + 1; y < yCenter + lr; y++) {
                    d = Math.pow(x - xCenter, 2) + Math.pow(y - yCenter, 2)
                    if (d <= lr * lr) {
                        tilesWanted.push({
                            x: mod(x, Math.pow(2, zuZ)),
                            y: mod(y, Math.pow(2, zuZ)),
                            z: zuZ,
                            d: d,
                            make: true,
                            isLOD: true,
                        })
                    }
                }
            }
        }
    }
    function addTile(xyz, failCallback) {
        if (xyz === undefined) return

        //[0] is whether the raster is done loading
        // and [1] is whether the dem is done loading
        var tileLoaded = [false, false]
        //-1 because Three js planes take in segments between vertices and not vertices
        //i.e. a dimension of 1 would be two vertices O ----- O
        var t = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(
                Globe_.tileDimension,
                Globe_.tileDimension,
                Globe_.tileResolution - 1,
                Globe_.tileResolution - 1
            )
        )

        tilesBeingDrawn.push({ x: xyz.x, y: xyz.y, z: xyz.z, make: xyz.make })
        tilesDrawn.push({ x: xyz.x, y: xyz.y, z: xyz.z, t: t, contents: [] })
        t.xyz = { x: xyz.x, y: xyz.y, z: xyz.z }
        t.name = 'tile_' + xyz.x + '_' + xyz.y + '_' + xyz.z
        t.isLOD = xyz.isLOD

        /*
    var positionHigh = new Float32Array( t.geometry.attributes.position.count * 3 );
    t.geometry.addAttribute( 'positionHigh', new THREE.BufferAttribute( positionHigh, 3 ) );
    var positionLow = new Float32Array( t.geometry.attributes.position.count * 3 );
    t.geometry.addAttribute( 'positionLow', new THREE.BufferAttribute( positionLow, 3 ) );
    */
        //Set position and add to scene
        //( projection.radiusOfPlanetMajor / projection.radiusScale ) offsets the whole
        // planet back so that the Cameras.camera lookat point is now longer at the center but on the surface
        //t.position.set( 0, -Globe_.planetCenter.y, 0 );
        //Invert y is needed
        var yI = xyz.y
        if (Globe_.yInvert) yI = projection.invertY(xyz.y, xyz.z) //Math.pow( 2, xyz.z ) - 1 - xyz.y;
        //console.log( xyz.y, yI );

        var textures = []
        var tileLayersComplete = []
        var tileValid = []

        for (var i = 0; i < tileLayers.length; i++) {
            tileLayersComplete[i] = false
            tileValid[i] = true
        }

        for (var i = 0; i < tileLayers.length; i++) {
            //Check if on and in right zoom range
            if (
                tileLayers[i].on &&
                ((xyz.z >= tileLayers[i].minZoom &&
                    xyz.z <= tileLayers[i].maxZoom &&
                    isInExtent(xyz, tileLayers[i].boundingBox)) ||
                    tileLayers[i].path == '_vectorsastile_')
            ) {
                //Load the tile
                //Closure to save the index
                var filledPath = tileLayers[i].path
                if (filledPath == '_vectorsastile_') {
                    filledPath = Globe_VectorsAsTiles.vectorsAsTile(
                        xyz.x,
                        xyz.y,
                        xyz.z
                    )
                } else {
                    filledPath = filledPath.replace('{z}', xyz.z)
                    filledPath = filledPath.replace('{x}', xyz.x)
                    filledPath = filledPath.replace('{y}', yI)
                }
                ;(function(i) {
                    loader.load(
                        filledPath,
                        function(texture) {
                            //on success
                            texture.magFilter = THREE.NearestFilter
                            texture.minFilter = THREE.NearestFilter

                            //Attach the index to it so we know then intended order later
                            if (tileLayers[i])
                                textures.push({
                                    name: tileLayers[i].name,
                                    texture: texture,
                                    opacity: tileLayers[i].opacity,
                                    i: i,
                                })
                            tileLayersComplete[i] = true
                            onceTexturesLoaded()
                        },
                        function() {}, //in progress
                        function() {
                            //on error
                            tileLayersComplete[i] = true
                            onceTexturesLoaded()
                        }
                    )
                })(i)
            } else {
                tileValid[i] = false
                tileLayersComplete[i] = true
                onceTexturesLoaded()
            }
        }
        function onceTexturesLoaded() {
            for (var i = 0; i < tileLayersComplete.length; i++) {
                if (tileLayersComplete[i] == false) return
            }
            if (textures.length == 0) {
                //Hide the tiles if no textures are found
                t.visible = false

                tileLoaded[0] = true
                onceTileLoaded(true)
                return
            } else {
                //Sort them by index attached
                textures.sort(function(a, b) {
                    return a.i - b.i
                })
                texturesOrdered = []
                for (var i = 0; i < textures.length; i++) {
                    var isVAT = tileLayers[i].name == 'Vectors As Tiles' ? 1 : 0
                    texturesOrdered.push({
                        name: textures[i].name,
                        texture: textures[i].texture,
                        opacity: textures[i].opacity,
                        isVAT: isVAT,
                    })
                }
                t['texturesOrdered'] = F_.clone(texturesOrdered)
                t.material = shaders.multiTexture(texturesOrdered)
                /*
        t.material = new THREE.MeshBasicMaterial({
           color: 0xffffff,
           wireframe: true
        });
        */

                t.material.needsUpdate = true
            }
            tileLoaded[0] = true
            onceTileLoaded()
        }

        //Load the DEM tile
        //PNG var stored in window
        var loadDemTile = false

        var filledDemPath
        for (var i = tileLayers.length - 1; i >= 0; i--) {
            filledDemPath = tileLayers[i].demPath
            if (filledDemPath != undefined && tileValid[i]) {
                loadDemTile = true
                break
            }
        }

        if (loadDemTile) {
            if (filledDemPath != undefined) {
                filledDemPath = filledDemPath.replace('{z}', xyz.z)
                filledDemPath = filledDemPath.replace('{x}', xyz.x)
                filledDemPath = filledDemPath.replace('{y}', yI)
            }

            if (
                filledDemPath &&
                F_.getExtension(filledDemPath).toLowerCase() == 'demt'
            ) {
                var oReq = new XMLHttpRequest()
                oReq.open('GET', filledDemPath, true)
                oReq.responseType = 'arraybuffer'

                oReq.onload = function(oEvent) {
                    if (oReq.status == 200) {
                        var arrayBuffer = oReq.response
                        var elevArray = new Float32Array(arrayBuffer)

                        var cnt = 0
                        var w = Globe_.trueTileResolution
                        var verts = Math.pow(Globe_.trueTileResolution, 2)
                        var colors = new Float32Array(verts * 3)
                        //4s because RGBA and 3s because xyz
                        //No resampling if the plane is already 64x64
                        if (
                            t.geometry.attributes.position.array.length / 3 ==
                            verts
                        ) {
                            var height
                            var xyzPos
                            for (
                                var p = 0;
                                p < t.geometry.attributes.position.array.length;
                                p += 3
                            ) {
                                height = elevArray[p / 3]

                                var tx =
                                    xyz.x +
                                    ((p / 3) % Globe_.tileResolution) /
                                        (Globe_.tileResolution - 1)
                                var ty =
                                    xyz.y +
                                    parseInt(p / 3 / Globe_.tileResolution) /
                                        (Globe_.tileResolution - 1)
                                var tlat = projection.tile2lat(ty, xyz.z, {
                                    x: tx,
                                })
                                var tlon = projection.tile2long(tx, xyz.z, {
                                    y: ty,
                                })

                                xyzPos = projection.lonLatToVector3(
                                    tlon,
                                    tlat,
                                    height * Globe_.exaggeration
                                )

                                t.geometry.attributes.position.array[p] =
                                    xyzPos.x
                                t.geometry.attributes.position.array[p + 1] =
                                    xyzPos.y
                                t.geometry.attributes.position.array[p + 2] =
                                    xyzPos.z + Globe_.zOff

                                //High Low
                                /*
                var twoFloatX = F_.doubleToTwoFloats( xyzPos.x );
                var twoFloatY = F_.doubleToTwoFloats( xyzPos.y );
                var twoFloatZ = F_.doubleToTwoFloats( xyzPos.z );
                positionHigh[p] = twoFloatX[0];
                positionHigh[p + 1] = twoFloatY[0];
                positionHigh[p + 2] = twoFloatZ[0];
                positionLow[p] = twoFloatX[1];
                positionLow[p + 1] = twoFloatY[1];
                positionLow[p + 2] = twoFloatZ[1];
                */
                                //move to next R value
                                cnt += 4
                            }

                            //Tell THREE that these verts need updating
                            t.geometry.attributes.position.needsUpdate = true
                            t.geometry.verticesNeedUpdate = true
                            t.geometry.computeFaceNormals()
                            t.geometry.computeVertexNormals()
                            t.geometry.computeBoundingSphere()
                            t.geometry.addAttribute(
                                'customColor',
                                new THREE.BufferAttribute(colors, 3)
                            )
                        }
                    }
                    tileLoaded[1] = true
                    onceTileLoaded()
                    overallTimer += window.performance.now() - start
                    //console.log( overallTimer );
                }
                start = window.performance.now()
                oReq.send()
            } else {
                start = window.performance.now()
                if (filledDemPath == L_.missionPath)
                    filledDemPath += 'undefined'
                PNG.load(filledDemPath, function(img) {
                    tileGeometry(img)
                })
            }
        } else {
            //Make a flat tile
            tileGeometry(false)

            tileLoaded[1] = true
            onceTileLoaded(true)
        }

        function tileGeometry(img) {
            var rgbaArr = null
            if (img !== false) {
                rgbaArr = img.decode()
            }
            var cnt = 0
            var w = Globe_.trueTileResolution
            var verts = Math.pow(Globe_.trueTileResolution, 2)
            var colors = new Float32Array(verts * 3)

            //Keep picking heights until we get one that isn't an obvious no data value
            var centerHeight = 0
            if (rgbaArr != null) {
                var centerCnt = Math.floor(rgbaArr.length / 8) * 4
                centerHeight = RGBAto32({
                    r: rgbaArr[centerCnt],
                    g: rgbaArr[centerCnt + 1],
                    b: rgbaArr[centerCnt + 2],
                    a: rgbaArr[centerCnt + 3],
                })
                var counter = 0
                while (
                    (centerHeight == null ||
                        centerHeight > projection.radiusOfPlanetMajor ||
                        centerHeight < -projection.radiusOfPlanetMajor) &&
                    counter < rgbaArr.length / 4
                ) {
                    centerCnt = Math.floor(counter) * 4
                    centerHeight = RGBAto32({
                        r: rgbaArr[centerCnt],
                        g: rgbaArr[centerCnt + 1],
                        b: rgbaArr[centerCnt + 2],
                        a: rgbaArr[centerCnt + 3],
                    })
                    counter++
                }
            }

            var centerP =
                Math.floor(t.geometry.attributes.position.array.length / 6) * 3

            var tx =
                xyz.x +
                ((centerP / 3) % Globe_.tileResolution) /
                    (Globe_.tileResolution - 1)
            var ty =
                xyz.y +
                parseInt(centerP / 3 / Globe_.tileResolution) /
                    (Globe_.tileResolution - 1)
            var tlat = projection.tile2lat(ty, xyz.z, { x: tx })
            var tlon = projection.tile2long(tx, xyz.z, { y: ty })

            var centerPos = projection.lonLatToVector3(
                tlon,
                tlat,
                centerHeight * Globe_.exaggeration
            )

            t.position.set(centerPos.x, centerPos.y, centerPos.z)
            //4s because RGBA and 3s because xyz
            //No resampling if the plane is already 64x64
            if (t.geometry.attributes.position.array.length / 3 == verts) {
                var height = 0
                var xyzPos
                for (
                    var p = 0;
                    p < t.geometry.attributes.position.array.length;
                    p += 3
                ) {
                    height = 0
                    if (rgbaArr != null) {
                        //console.time( 'R ' + xyz.x + ' ' + xyz.y + ' ' + xyz.z + ' ' + p );
                        height = RGBAto32({
                            r: rgbaArr[cnt],
                            g: rgbaArr[cnt + 1],
                            b: rgbaArr[cnt + 2],
                            a: rgbaArr[cnt + 3],
                        })
                        //console.timeEnd( 'R ' + xyz.x + ' ' + xyz.y + ' ' + xyz.z + ' ' + p );
                        colors[p] = 0
                        colors[p + 1] = 0
                        colors[p + 2] = 0
                        if (height < -100000) {
                            height = -100000
                        }
                        //if( logThis ) console.log( height );
                        /*
            if( height < -4950 ) {
              colors[p] = 0;
              colors[p + 1] = 0;
              colors[p + 2] = 0.5;
            }*/
                    }

                    //console.time( 'L ' + xyz.x + ' ' + xyz.y + ' ' + xyz.z + ' ' + p );
                    var tx =
                        xyz.x +
                        ((p / 3) % Globe_.tileResolution) /
                            (Globe_.tileResolution - 1)
                    var ty =
                        xyz.y +
                        parseInt(p / 3 / Globe_.tileResolution) /
                            (Globe_.tileResolution - 1)
                    var tlat = projection.tile2lat(ty, xyz.z, { x: tx })
                    var tlon = projection.tile2long(tx, xyz.z, { y: ty })

                    //if( tlat > 90 || tlat < -90 || tlon > 180 || tlon < -180 ) height = 0;

                    xyzPos = projection.lonLatToVector3(
                        tlon,
                        tlat,
                        height * Globe_.exaggeration
                    )

                    //console.timeEnd( 'L ' + xyz.x + ' ' + xyz.y + ' ' + xyz.z + ' ' + p );
                    t.geometry.attributes.position.array[p] =
                        xyzPos.x - centerPos.x
                    t.geometry.attributes.position.array[p + 1] =
                        xyzPos.y - centerPos.y
                    t.geometry.attributes.position.array[p + 2] =
                        xyzPos.z - centerPos.z

                    //High Low
                    /*
          var twoFloatX = F_.doubleToTwoFloats( xyzPos.x - centerPos.x );
          var twoFloatY = F_.doubleToTwoFloats( xyzPos.y - centerPos.z );
          var twoFloatZ = F_.doubleToTwoFloats( xyzPos.z - centerPos.x );
          positionHigh[p] = twoFloatX[0];
          positionHigh[p + 1] = twoFloatY[0];
          positionHigh[p + 2] = twoFloatZ[0];
          positionLow[p] = twoFloatX[1];
          positionLow[p + 1] = twoFloatY[1];
          positionLow[p + 2] = twoFloatZ[1];
          */
                    //move to next R value
                    cnt += 4
                }

                //Tell THREE that these verts need updating
                t.geometry.attributes.position.needsUpdate = true
                //t.geometry.attributes.positionHigh.needsUpdate = true;
                //t.geometry.attributes.positionLow.needsUpdate = true;
                t.geometry.verticesNeedUpdate = true
                t.geometry.computeFaceNormals()
                t.geometry.computeVertexNormals()
                t.geometry.computeBoundingSphere()
                //t.rotation.set( Globe_.planet.rotation.x,
                //                Globe_.planet.rotation.y,
                //                Globe_.planet.rotation.z );

                t.geometry.addAttribute(
                    'customColor',
                    new THREE.BufferAttribute(colors, 3)
                )

                tileLoaded[1] = true
                onceTileLoaded()

                overallTimer += window.performance.now() - start
                //console.log( overallTimer );
            }
        }

        function onceTileLoaded(destroy) {
            if (destroy) {
                t.geometry.dispose()
                t.material.dispose()
                if (typeof failCallback === 'function') failCallback()
            }
            //Make sure both parts loaded
            if (tileLoaded[0] && tileLoaded[1]) {
                var lowerZoomTileIRemove
                //If a lower zoom tile exists that this one covers, remove it
                for (var i = tilesDrawn.length - 1; i >= 0; i--) {
                    if (xyz.z < tilesDrawn[i].z) {
                        if (
                            F_.tileIsContained(
                                [xyz.x, xyz.y, xyz.z],
                                [
                                    tilesDrawn[i].x,
                                    tilesDrawn[i].y,
                                    tilesDrawn[i].z,
                                ],
                                true
                            )
                        ) {
                            removeTile(i)
                        }
                    } else if (xyz.z > tilesDrawn[i].z) {
                        if (
                            F_.tileIsContained(
                                [
                                    tilesDrawn[i].x,
                                    tilesDrawn[i].y,
                                    tilesDrawn[i].z,
                                ],
                                [xyz.x, xyz.y, xyz.z]
                            )
                        ) {
                            tilesDrawn[i].contents.push([xyz.x, xyz.y, xyz.z])
                            if (
                                tilesDrawn[i].contents.length >=
                                F_.tileContains(
                                    [
                                        tilesDrawn[i].x,
                                        tilesDrawn[i].y,
                                        tilesDrawn[i].z,
                                    ],
                                    xyz.z
                                ).length
                            ) {
                                lowerZoomTileIRemove = i
                            }
                        }
                    }
                }

                //Globe_.updateTileShaderVar( t );
                for (var i = 0; i < tilesBeingDrawn.length; i++) {
                    if (
                        tilesBeingDrawn[i].x == xyz.x &&
                        tilesBeingDrawn[i].y == xyz.y &&
                        tilesBeingDrawn[i].z == xyz.z
                    ) {
                        if (tilesBeingDrawn[i].make) {
                            if (t.isLOD) Globe_.planetLOD.add(t)
                            else Globe_.planet.add(t)
                            if (lowerZoomTileIRemove != undefined) {
                                removeTile(lowerZoomTileIRemove)
                            }
                        } else {
                            t.geometry.dispose()
                            t.material.dispose()
                            for (var j = 0; j < tilesDrawn.length; j++) {
                                if (
                                    tilesDrawn[j].x == xyz.x &&
                                    tilesDrawn[j].y == xyz.y &&
                                    tilesDrawn[j].z == xyz.z
                                ) {
                                    tilesDrawn.splice(j, 1)
                                }
                            }
                        }
                        tilesBeingDrawn.splice(i, 1)
                        return
                    }
                }
            }
        }
    }

    function removeTile(i) {
        tilesDrawn[i].t.geometry.dispose()
        tilesDrawn[i].t.material.dispose()
        if (tilesDrawn[i].t.isLOD) Globe_.planetLOD.remove(tilesDrawn[i].t)
        else Globe_.planet.remove(tilesDrawn[i].t)
        tilesDrawn.splice(i, 1)
    }

    function removeTileXYZ(xyz) {
        for (t in tilesDrawn) {
            if (
                tilesDrawn[t].x == xyz.x &&
                tilesDrawn[t].y == xyz.y &&
                tilesDrawn[t].z == xyz.z
            ) {
                tilesDrawn[t].t.geometry.dispose()
                tilesDrawn[t].t.material.dispose()
                if (tilesDrawn[i].t.isLOD)
                    Globe_.planetLOD.remove(tilesDrawn[i].t)
                else Globe_.planet.remove(tilesDrawn[i].t)
                tilesDrawn.splice(t, 1)
            }
        }
    }

    function killDrawingTiles() {
        for (t in tilesToBeDrawn) {
            tilesToBeDrawn[t].make = false
        }
        for (t in tilesBeingDrawn) {
            tilesBeingDrawn[t].make = false
        }
    }

    //This sets the zoom to the desired zoom if zoomedSince is high enough
    function checkDesiredZoom() {
        zoomedSince++
        if (desiredZoom != null) {
            //document.getElementById( "zoomLevelIndicator" ).innerHTML = desiredZoom;
            Cameras.setNearFarPlane(desiredZoom < 14)
            if (zoomedSince > zoomWait) {
                if (desiredZoom >= Globe_.minNativeZoom)
                    Globe_.setZoom(desiredZoom)
                desiredZoom = null
            }
        }
    }
    function onTouchZoom(e) {
        if (e.touches && e.touches.length == 1) onZoom(e)
    }
    function onZoom(e) {
        //2000 to 1000 units away from surface is zoom level 1
        //1000 to 500 is 2
        //500 to 250 is 3 and so on
        //We zoomed so reset the zoom counter
        zoomedSince = 0
        var zoomDist = Cameras.orbit.camera.position.distanceTo(
            Cameras.orbit.controls.target
        )
        //Calculate what the zoom should be
        //Inverse of ( 4000 / Math.pow( 2, Globe_.zoom + 1) ) //4000/ 2^(z+1)
        // (thanks wolfram alpha inverse function calculator)
        var nf = 8 - (projection.radiusScale.toString().length - 1)
        var dZoom =
            Math.ceil(
                (nf * Math.log(2) - Math.log(zoomDist / Math.pow(5, nf - 1))) /
                    Math.log(2)
            ) + 1
        if (Globe_.zoom != dZoom) {
            desiredZoom = dZoom
        }

        attenuate()
    }

    function attenuate() {
        var mZ = findHighestMaxZoom()
        mZ = Globe_.zoom
        //16 1
        //10 -2.5
        var sf = 0.5
        if (mZ <= 16) sf = (16 - mZ) * 2 + 1

        var distSphereStartAttenuating = 400
        var distSphereStopAttenuating = 30
        var distSpriteStartAttenuating = 400
        var distSpriteStopAttenuating = 30
        var scaleFactorSphere = 45
        var scaleFactorSprite = 35

        var distSphereStartAttenuating = 400
        var distSphereStopAttenuating = 30
        var distSpriteStartAttenuating = 400
        var distSpriteStopAttenuating = 30
        var scaleFactorSphere = 45 / sf
        var scaleFactorSprite = 35 / sf
        var attentuationFactorSphere =
            distSphereStartAttenuating / scaleFactorSphere
        var attentuationFactorSprite =
            distSpriteStartAttenuating / scaleFactorSprite

        var zoomDist = Cameras.camera.position.distanceTo(
            Cameras.controls.target
        )

        if (zoomDist < distSphereStartAttenuating) {
            attentuationFactorSphere =
                Math.max(zoomDist, distSphereStopAttenuating) /
                scaleFactorSphere
            attentuationFactorSprite =
                Math.max(zoomDist, distSphereStopAttenuating) /
                scaleFactorSprite
        }

        for (s in spriteGroup) {
            for (i in spriteGroup[s].children) {
                if (spriteGroup[s].children[i].visible) {
                    //spriteGroup[s].children[i].children[0].geometry.translate(0, -2.6 * sf * 0.65, 0);
                    spriteGroup[s].children[i].children[0].scale.set(
                        attentuationFactorSphere,
                        sf,
                        attentuationFactorSphere
                    )
                    //attentuationFactorSprite = 1000;
                    spriteGroup[s].children[i].children[1].scale.set(
                        attentuationFactorSprite,
                        attentuationFactorSprite,
                        attentuationFactorSprite
                    )
                }
            }
        }

        for (s in overlayGroup) {
            for (i in overlayGroup[s].children) {
                if (overlayGroup[s].children[i].visible) {
                    overlayGroup[s].children[i].scale.set(
                        attentuationFactorSprite,
                        attentuationFactorSprite,
                        attentuationFactorSprite
                    )
                }
            }
        }
    }

    function attentuateSprite(sprite) {
        var zoomDist = Cameras.camera.position.distanceTo(
            Cameras.controls.target
        )
        sprite.scale.x = sprite.scale.y = zoomDist / 20
    }

    function raycastSprites() {
        raycaster.setFromCamera(mouse, Cameras.camera)
        intersects = raycaster.intersectObjects(spriteGroup, true)

        if (intersects.length > 0) {
            intersectsZero = intersects[0]
            if (intersectsZero.object.useKeyAsName) {
                Globe_.globe.css({ cursor: 'pointer' })
                var pos = null
                if (Cameras.isFirstPerson) pos = Globe_.globeCenterPos
                CursorInfo.update(
                    intersectsZero.object.useKeyAsName.capitalizeFirstLetter() +
                        ': ' +
                        intersectsZero.object.name,
                    null,
                    false,
                    pos
                )
            }
        } else {
            intersectsZero = {}
            Globe_.globe.css({ cursor: 'default' })
            CursorInfo.hide()
        }
    }

    function onGlobeClickPointerLock(e) {
        if (Cameras.isFirstPerson) {
            onGlobeClick(e)
        }
    }
    function onGlobeClick(e) {
        Globe_.highlight(intersectsZero.object, true)
    }

    //slow
    function resetLayerFills(layerName) {
        if (
            L_.layersNamed[layerName] &&
            L_.layersNamed[layerName].type == 'point'
        ) {
            for (s in spriteGroup) {
                for (i in spriteGroup[s].children) {
                    spriteGroup[s].children[
                        i
                    ].children[1].material = Sprites.makeMarkerMaterial(
                        {},
                        spriteGroup[s].children[i].layerName
                    )
                    spriteGroup[s].children[
                        i
                    ].children[1].material.needsUpdate = true
                }
            }
        }
    }

    function rotateGlobe_MouseDown(e) {
        if (e.which === 3 || e.button === 2) {
            //Right click
            prevMouse.x = e.pageX
            prevMouse.y = e.pageY
            container.addEventListener('mousemove', rotateGlobe_, false)
            container.addEventListener('mouseup', rotateGlobe_MouseUp, false)
        } else if (e.touches && e.touches.length > 2) {
            //Multi touch
            prevMouse.x = F_.arrayAverage(e.touches, 'pageX')
            prevMouse.y = F_.arrayAverage(e.touches, 'pageY')
            container.addEventListener('touchmove', rotateGlobe_, false)
            container.addEventListener('touchend', rotateGlobe_MouseUp, false)
        }
    }
    function rotateGlobe_MouseUp(e) {
        container.removeEventListener('mousemove', rotateGlobe_)
        container.removeEventListener('mouseup', rotateGlobe_MouseUp)
        container.removeEventListener('touchmove', rotateGlobe_)
        container.removeEventListener('touchend', rotateGlobe_MouseUp)
    }
    function rotateGlobe_(e, prevXY) {
        if (prevXY) {
            prevMouse.x = prevXY.x
            prevMouse.y = prevXY.y
        }
        if (!e) return
        if (!e.pageX && e.touches) e.pageX = F_.arrayAverage(e.touches, 'pageX')
        if (!e.pageY && e.touches) e.pageY = F_.arrayAverage(e.touches, 'pageY')

        if (e instanceof THREE.Vector2 && Cameras.isFirstPerson) {
            prevMouse.x = 0
            prevMouse.y = 0
            e.pageX = e.x
            e.pageY = e.y
            if (Globe_.zoom > 16) {
                e.pageX *= 2
                e.pageY *= 2
            }
        }

        //rotation speed (radians per event call)
        var rotSpeed = Globe_.getRadiansPerPixel() / 1.6
        var pixelDif = 0

        //Find vectors perpendicular to Cameras.camera forward vector
        //Y is 0 because we're projecting the vector on a flat x,z plane because how
        // high our Cameras.camera is doesn't matter
        var cpX = new THREE.Vector3(
            Cameras.orbit.camera.position.x,
            0,
            Cameras.orbit.camera.position.z
        )
        //rotate vector around y axis 90deg
        cpX.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)

        var cpY = new THREE.Vector3(
            Cameras.orbit.camera.position.x,
            0,
            Cameras.orbit.camera.position.z
        )

        if (e.pageY < prevMouse.y) {
            //down
            pixelDif = Math.abs(e.pageY - prevMouse.y)
            //TODO: Don't rotate passed South pole
            rotateAroundArbAxis(cpX, rotSpeed * pixelDif)
        } else if (e.pageY > prevMouse.y) {
            //up
            pixelDif = Math.abs(e.pageY - prevMouse.y)
            //TODO: Don't rotate passed North pole
            rotateAroundArbAxis(cpX, -rotSpeed * pixelDif)
        }

        if (e.pageX > prevMouse.x) {
            //left
            pixelDif = Math.abs(e.pageX - prevMouse.x)
            rotateAroundArbAxis(cpY, -rotSpeed * pixelDif)
        } else if (e.pageX < prevMouse.x) {
            //right
            pixelDif = Math.abs(e.pageX - prevMouse.x)
            rotateAroundArbAxis(cpY, rotSpeed * pixelDif)
        }

        //Update prevMouse
        prevMouse.x = e.pageX
        prevMouse.y = e.pageY
        //Snap Cameras.camera lookat to Globe_
        var elevRaw = Globe_.getCenterElevationRaw()
        if (elevRaw != false) {
            var newLookAtY = -(elevRaw + Globe_.planetCenter.y)
            if (newLookAtY != 0 && newLookAtY != -10000)
                Cameras.orbit.controls.target.y =
                    newLookAtY - Globe_.targetYOffset
        }
        if (L_.mapAndGlobeLinked || mmgisglobal.ctrlDown) panEvent()
    }
    Globe_.rotateGlobe = rotateGlobe_
    // Rotate the globe around an axis in world space (the axis passes through the object's position)
    function rotateAroundArbAxis(axis, radians, noPremultiply) {
        var rotationMatrix = new THREE.Matrix4()
        rotationMatrix.makeRotationAxis(axis.normalize(), radians)
        if (noPremultiply !== true)
            rotationMatrix.multiply(Globe_.planet.matrix) // pre-multiply
        Globe_.planet.matrix = rotationMatrix
        Globe_.planet.rotation.setFromRotationMatrix(Globe_.planet.matrix)
        matchPlanetLODToPlanet()
        for (var i = 0; false && i < vectorLayers.length; i++) {
            vectorLayers[i].mesh.rotation.set(
                Globe_.planet.rotation.x,
                Globe_.planet.rotation.y,
                Globe_.planet.rotation.z
            )
        }
        refreshVectorRotation()
    }
    Globe_.rotateAroundArbAxis = rotateAroundArbAxis

    function refreshVectorRotation() {
        spriteGroup[0].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
        spriteGroup[1].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
        lineGroup[0].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
        lineGroup[1].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
        addonMeshGroup[0].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
        addonMeshGroup[1].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
        overlayGroup[0].rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
    }

    function updateMouseCoords(e) {
        if (!Cameras.isFirstPerson) {
            mouse.x =
                ((e.clientX -
                    renderer.domElement.getBoundingClientRect().left) /
                    renderer.domElement.clientWidth) *
                    2 -
                1
            mouse.y =
                -(
                    (e.clientY -
                        renderer.domElement.getBoundingClientRect().top) /
                    renderer.domElement.clientHeight
                ) *
                    2 +
                1
        }

        raycaster.setFromCamera(mouse, Cameras.camera)

        var planeArr = []
        for (var i = 0; i < tilesDrawn.length; i++) {
            if (!tilesDrawn[i].t.isLOD) planeArr.push(tilesDrawn[i].t)
        }
        var intersects = raycaster.intersectObjects(planeArr)

        if (intersects.length > 0) {
            var savedIntersectionPoint = intersects[0].point
            //Since we lowered the planet, we need to raise the intersection pt again for calculations
            intersects[0].point.y += Globe_.planetCenter.y
            //Since the planet was rotated during pans, rotate the intersection back
            intersects[0].point = projection.rotatePoint3D(
                intersects[0].point,
                { x: -Globe_.planet.rotation.x, y: 0, z: 0 }
            )
            intersects[0].point = projection.rotatePoint3D(
                intersects[0].point,
                { x: 0, y: -Globe_.planet.rotation.y, z: 0 }
            )
            intersects[0].point = projection.rotatePoint3D(
                intersects[0].point,
                { x: 0, y: 0, z: -Globe_.planet.rotation.z }
            )
            var intersectedLL = projection.vector3ToLonLat(intersects[0].point)

            //Find the elevation
            //Just distance to intersection from center of planet then rescaled then - radius
            var elevation =
                savedIntersectionPoint.length() * projection.radiusScale -
                projection.radiusOfPlanetMajor
            Globe_.mouseLngLat.Lng = intersectedLL.lon
            Globe_.mouseLngLat.Lat = intersectedLL.lat

            //Match map view
            if (L_.mapAndGlobeLinked || mmgisglobal.ctrlDown)
                L_.Map_.setPlayerLookat(
                    Globe_.mouseLngLat.Lng,
                    Globe_.mouseLngLat.Lat
                )

            var ll
            var unit = !F_.dam ? '&deg;' : 'm'
            var elev = elevation / Globe_.exaggeration
            if (F_.dam) elev /= (2 * Math.PI * L_.radius.major) / 360
            if (Coordinates.damCoordSwapped)
                ll =
                    (intersectedLL.lat + Coordinates.coordOffset[1]).toFixed(
                        8
                    ) +
                    unit +
                    ', ' +
                    (intersectedLL.lon + Coordinates.coordOffset[0]).toFixed(
                        8
                    ) +
                    unit +
                    ', '
            else
                ll =
                    (intersectedLL.lon + Coordinates.coordOffset[0]).toFixed(
                        8
                    ) +
                    unit +
                    ', ' +
                    (intersectedLL.lat + Coordinates.coordOffset[1]).toFixed(
                        8
                    ) +
                    unit +
                    ', '
            document.getElementById('mouseLngLat').innerHTML =
                ll + elev.toFixed(3) + 'm'
        } else {
            Globe_.mouseLngLat.Lng = null
            Globe_.mouseLngLat.Lat = null
            document.getElementById('mouseLngLat').innerHTML = 'Outer Space'
            L_.Map_.hidePlayer(false, true)
        }
    }

    function setPlayer() {
        var playerll = Globe_.getCenter()
        L_.Map_.setPlayerArrow(
            playerll.lon,
            playerll.lat,
            (Cameras.firstPerson.controls.getObject().rotation.y %
                (Math.PI * 2)) +
                Math.PI
        )
        L_.Map_.setPlayerLookat(Globe_.mouseLngLat.Lng, Globe_.mouseLngLat.Lat)
    }

    //Returns true if the tile at xyz in the bounding box bb
    // Checks to see if any corners of it fit inside
    function isInExtent(xyz, bb) {
        //return true;
        var inExtent = true
        if (bb) {
            var tx_ext = xyz.x + 0
            var ty_ext = xyz.y + 0
            var tlat_ext = projection.tile2lat(ty_ext, xyz.z, { x: tx_ext })
            var tlon_ext = projection.tile2long(tx_ext, xyz.z, { y: ty_ext })

            inExtent =
                tlat_ext < bb[3] &&
                tlat_ext > bb[1] &&
                tlon_ext < bb[2] &&
                tlon_ext > bb[0]

            tx_ext = xyz.x + 1
            ty_ext = xyz.y + 0
            tlat_ext = projection.tile2lat(ty_ext, xyz.z, { x: tx_ext })
            tlon_ext = projection.tile2long(tx_ext, xyz.z, { y: ty_ext })

            inExtent =
                inExtent ||
                (tlat_ext < bb[3] &&
                    tlat_ext > bb[1] &&
                    tlon_ext < bb[2] &&
                    tlon_ext > bb[0])

            tx_ext = xyz.x + 1
            ty_ext = xyz.y + 1
            tlat_ext = projection.tile2lat(ty_ext, xyz.z, { x: tx_ext })
            tlon_ext = projection.tile2long(tx_ext, xyz.z, { y: ty_ext })

            inExtent =
                inExtent ||
                (tlat_ext < bb[3] &&
                    tlat_ext > bb[1] &&
                    tlon_ext < bb[2] &&
                    tlon_ext > bb[0])

            tx_ext = xyz.x + 0
            ty_ext = xyz.y + 1
            tlat_ext = projection.tile2lat(ty_ext, xyz.z, { x: tx_ext })
            tlon_ext = projection.tile2long(tx_ext, xyz.z, { y: ty_ext })

            inExtent =
                inExtent ||
                (tlat_ext < bb[3] &&
                    tlat_ext > bb[1] &&
                    tlon_ext < bb[2] &&
                    tlon_ext > bb[0])
        }
        return inExtent
    }

    function buildToolBar() {
        d3.select('#globeToolBar').html('')
        Globe_.toolBar = d3
            .select('#globeToolBar')
            .append('div')
            .attr('class', 'ui padded grid')
            .style('height', '100%')
            .append('div')
            .attr('class', 'row childpointerevents')
            .style('padding', '0px')

        //HOME=============
        Globe_.toolBar
            .append('div')
            .attr('id', 'globeToolBarHome')
            .html(
                [
                    '<div>',
                    "<div id='Globe_HomeHome' class='mmgisButton3' title='Link' style='margin-right: 0; padding-right: 5px; border-radius: 0; border-left: 1px solid #26a8ff;'>",
                    "<i class='mdi mdi-home mdi-18px'></i>",
                    '</div>',
                    '<div>',
                ].join('')
            )

        $('#Globe_HomeHome').click(function() {
            Globe_.setCenter(L_.view)
            L_.FUTURES.globeCamera = Globe_.globeCamera
        })

        //LINK===============
        Globe_.toolBar
            .append('div')
            .attr('id', 'globeToolBarLink')
            .html(
                [
                    '<div>',
                    "<div id='Globe_LinkLink' class='mmgisButton3' title='Link' style='margin-right: 0; padding-right: 0px; border-radius: 0; border-left: 1px solid #26a8ff;'>",
                    "<i class='mdi mdi-link-variant-off mdi-18px'></i>",
                    '</div>',
                    "<div id='Globe_LinkSettings' class='mmgisButton3' style='margin-left: 0; padding: 0px; border-radius: 0;'>",
                    "<i class='mdi mdi-menu-down mdi-18px'></i>",
                    '</div>',
                    "<div id='Globe_LinkSettingsPanel' style='display: none; position: absolute; top: 36px; background: #001; width: 42px; margin-left: 8px; border-left: 1px solid #26a8ff;'>",
                    "<ul style='list-style-type: none; padding: 0; margin: 0; font-size: 13px; text-align: center;'>",
                    "<li class='globeToolBarLinkOption' value='on' style='cursor: pointer;'>On</li>",
                    "<li class='globeToolBarLinkOption' value='off' style='cursor: pointer; background: #26a8ff; color: white;'>Off</li>",
                    '</ul>',
                    '</div>',
                    '<div>',
                ].join('')
            )

        $('#Globe_LinkSettings').click(function() {
            var display = $('#Globe_LinkSettingsPanel').css('display')
            if (display == 'none')
                $('#Globe_LinkSettingsPanel').css('display', 'inherit')
            else $('#Globe_LinkSettingsPanel').css('display', 'none')
        })
        $('#Globe_LinkLink').click(function() {
            $('.globeToolBarLinkOption').css({
                background: 'none',
                color: '#cfcfcf',
            })
            if (L_.mapAndGlobeLinked)
                $('.globeToolBarLinkOption:last-child').click()
            else $('.globeToolBarLinkOption:first-child').click()
        })
        $('.globeToolBarLinkOption').click(function() {
            $('.globeToolBarLinkOption').css({
                background: 'none',
                color: '#cfcfcf',
            })
            $(this).css({ background: '#26a8ff', color: 'white' })
            var val = $(this).attr('value')
            if (val == 'on') {
                $('#Globe_LinkLink').html(
                    "<i class='mdi mdi-link-variant mdi-18px'></i>"
                )
                L_.mapAndGlobeLinked = true
            } else {
                $('#Globe_LinkLink').html(
                    "<i class='mdi mdi-link-variant-off mdi-18px'></i>"
                )
                L_.mapAndGlobeLinked = false
            }
        })

        //COMPASS==============
        if (Globe_Compass) {
            Globe_.globeD3
                .append('div')
                .style('position', 'absolute')
                .style('bottom', '2px')
                .style('left', '2px')
                .html(Globe_Compass.getElement())
            Globe_Compass.attachEvents()
        }

        //WALK==============
        if (Globe_Walk) {
            var walkToolbar = Globe_.toolBar
                .append('div')
                .style('margin-left', '-7px')
                .html(Globe_Walk.getElement())
            Globe_Walk.attachEvents()
        }

        //EXAG===================
        // prettier-ignore
        Globe_.toolBar.append( 'div' )
      .attr( 'id', 'globeToolBarExaggeration' )
      .html(
        ["<div style='margin-left: -7px;'>",
          "<div id='Globe_ExagExag' class='mmgisButton3' title='Exaggeration'style='margin-right: 0; padding-right: 0px; border-radius: 0; border-left: 1px solid #26a8ff;'>",
            "<i class='mdi mdi-debug-step-out mdi-18px'></i>",
          "</div>",
          "<div id='Globe_ExagSettings' class='mmgisButton3' style='margin-left: 0; padding: 0px; border-radius: 0;'>",
              "<i class='mdi mdi-menu-down mdi-18px'></i>",
          "</div>",
          "<div id='Globe_ExagSettingsPanel' style='display: none; position: absolute; top: 36px; background: #001; width: 42px; margin-left: 8px; border-left: 1px solid #26a8ff;'>",
              "<ul style='list-style-type: none; padding: 0; margin: 0; font-size: 13px; text-align: center;'>",
                  "<li class='globeToolBarExaggerationOption' value='1' style='cursor: pointer; background: #26a8ff; color: white;'>1x</li>",
                  "<li class='globeToolBarExaggerationOption' value='2' style='cursor: pointer;'>2x</li>",
                  "<li class='globeToolBarExaggerationOption' value='5' style='cursor: pointer;'>5x</li>",
              "</ul>",
          "</div>",
        "<div>"].join('')
      );

        $('#Globe_ExagSettings').click(function() {
            var display = $('#Globe_ExagSettingsPanel').css('display')
            if (display == 'none')
                $('#Globe_ExagSettingsPanel').css('display', 'inherit')
            else $('#Globe_ExagSettingsPanel').css('display', 'none')
        })
        $('#Globe_ExagExag').click(function() {
            $('.globeToolBarExaggerationOption').css({
                background: 'none',
                color: '#cfcfcf',
            })
            $('.globeToolBarExaggerationOption:first-child').css({
                background: '#26a8ff',
                color: 'white',
            })
            Globe_.changeExaggeration(1)
        })
        $('.globeToolBarExaggerationOption').click(function() {
            $('.globeToolBarExaggerationOption').css({
                background: 'none',
                color: '#cfcfcf',
            })
            $(this).css({ background: '#26a8ff', color: 'white' })
            Globe_.changeExaggeration(parseInt($(this).attr('value')))
        })

        //NEAR======================
        // prettier-ignore
        Globe_.toolBar.append( 'div' )
      .attr( 'id', 'globeToolBarNear' )
      .style( 'margin-left', '-7px' )
      .html(
        ["<div>",
          "<div id='Globe_NearNear' class='mmgisButton3' title='Adjust Near Plane' style='margin-right: 0; padding-right: 0px; border-radius: 0; border-left: 1px solid #26a8ff;'>",
            "<i class='mdi mdi-crop mdi-18px'></i>",
          "</div>",
          "<div id='Globe_NearSettings' class='mmgisButton3' style='margin-left: 0; padding: 0px; border-radius: 0;'>",
              "<i class='mdi mdi-menu-down mdi-18px'></i>",
          "</div>",
          "<div id='Globe_NearSettingsPanel' style='display: none; position: absolute; top: 36px; background: #001; width: 42px; margin-left: 8px; border-left: 1px solid #26a8ff;'>",
              "<ul style='list-style-type: none; padding: 0; margin: 0; font-size: 13px; text-align: center;'>",
                  "<li class='globeToolBarNearOption' value='on' style='cursor: pointer;'>On</li>",
                  "<li class='globeToolBarNearOption' value='off' style='cursor: pointer; background: #26a8ff; color: white;'>Off</li>",
                  "<li class='globeToolBarNearInput' value='on' style='cursor: pointer;'>",
                    "<input id='globeToolbarNearNearness' type='number' step='1' min='1' placeholder='Near m' style='width: 37px; background-color: transparent; color: white; border: none; text-align: end; border-bottom: 1px solid #777; margin: 0px 2px 0px auto;'/>",
                  "</li>",
              "</ul>",
            "</div>",
        "<div>"].join('')
      );

        $('#globeToolbarNearNearness').val(20)
        $('#Globe_NearSettings').click(function() {
            var display = $('#Globe_NearSettingsPanel').css('display')
            if (display == 'none')
                $('#Globe_NearSettingsPanel').css('display', 'inherit')
            else $('#Globe_NearSettingsPanel').css('display', 'none')
        })
        $('#Globe_NearNear').click(function() {
            $('.globeToolBarNearOption').css({
                background: 'none',
                color: '#cfcfcf',
            })
            if (Globe_.nearPlaning)
                $('.globeToolBarNearOption:nth-child(2)').click()
            else $('.globeToolBarNearOption:nth-child(1)').click()
        })
        $('#globeToolbarNearNearness').on('input', function() {
            var near = parseInt($(this).val())

            if (Globe_.nearPlaning) {
                Cameras.setNearFarPlane(null, near)
            }
        })
        $('.globeToolBarNearOption').click(function() {
            $('.globeToolBarNearOption').css({
                background: 'none',
                color: '#cfcfcf',
            })
            $(this).css({ background: '#26a8ff', color: 'white' })
            var val = $(this).attr('value')
            var near = 0.1
            if (val == 'on') {
                $('#Globe_NearNear').html(
                    "<i class='mdi mdi-knife mdi-18px'></i>"
                )
                Globe_.nearPlaning = true
                near = parseInt($('#globeToolbarNearNearness').val())
            } else {
                $('#Globe_NearNear').html(
                    "<i class='mdi mdi-crop mdi-18px'></i>"
                )
                Globe_.nearPlaning = false
                near = 0.1
            }
            Cameras.setNearFarPlane(null, near, null, Globe_.nearPlaning)
        })

        //Altitude====================
        // prettier-ignore
        Globe_.toolBar.append( 'div' )
    .attr( 'id', 'globeToolBarAltitude' )
    .style( 'margin-left', '-7px' )
    .html(
      ["<div>",
        "<div id='Globe_AltitudeAltitude' class='mmgisButton3' title='Adjust Near Plane' style='margin-right: 0; padding-right: 0px; border-radius: 0; border-left: 1px solid #26a8ff;'>",
          "<i class='mdi mdi-elevator mdi-18px'></i>",
        "</div>",
        "<div id='Globe_AltitudeSettings' class='mmgisButton3' style='margin-left: 0; padding: 0px; border-radius: 0;'>",
            "<i class='mdi mdi-menu-down mdi-18px'></i>",
        "</div>",
        "<div id='Globe_AltitudeSettingsPanel' style='display: none; position: absolute; top: 36px; background: #001; width: 42px; height: 100px; margin-left: 8px; border-left: 1px solid #26a8ff;'>",
            "<div id='Globe_AltitudeSettingsInputValue' style='position: absolute; width: 41px; text-align: center; font-size: 12px; top: 41px;'>+0</div>",
        "</div>",
      "<div>"].join('')
    );
        d3.select('#Globe_AltitudeSettingsPanel')
            .append('div')
            .attr('id', 'Globe_AltitudeSettingsInput')
            .style('position', 'absolute')
            .style('left', '-5px')
            .style('top', '-46px')
            .style('transform', 'rotate(90deg)')
            .style('transform-origin', '0 100%')
            .append('input')
            .attr('id', '')
            .attr('class', 'verticalSlider')
            .attr('type', 'range')

        $('#Globe_AltitudeSettings').click(function() {
            var display = $('#Globe_AltitudeSettingsPanel').css('display')
            if (display == 'none')
                $('#Globe_AltitudeSettingsPanel').css('display', 'inherit')
            else $('#Globe_AltitudeSettingsPanel').css('display', 'none')
        })

        $('#Globe_AltitudeSettingsInput input').on('input', function() {
            var v = $(this).val()
            $('#Globe_AltitudeSettingsInputValue').css(
                'top',
                v - (v / 100) * 18 + 'px'
            )
            v -= 50
            v *= -1
            $('#Globe_AltitudeSettingsInputValue').text((v >= 0 ? '+' : '') + v)
            Cameras.orbit.camera.position.y -= v - Globe_.targetYOffset
            Globe_.targetYOffset = v
        })
        $('#Globe_AltitudeSettingsInput input').on('dblclick', function() {
            var v = 50
            $(this).val(v)
            $('#Globe_AltitudeSettingsInputValue').css(
                'top',
                v - (v / 100) * 18 + 'px'
            )
            v -= 50
            v *= -1
            $('#Globe_AltitudeSettingsInputValue').text((v >= 0 ? '+' : '') + v)
            Cameras.orbit.camera.position.y -= v - Globe_.targetYOffset
            Globe_.targetYOffset = v
        })

        //Loading
        var loadingToolbar = Globe_.toolBar
            .append('div')
            .attr('id', 'globeToolBarLoading')
            .style('position', 'absolute')
            .style('top', '24px')
            .style('right', '4px')
            .style(
                'transition',
                'opacity 0.5s cubic-bezier(0.445, 0.05, 0.55, 0.95)'
            )
        var loaderToolbar = loadingToolbar
            .append('div')
            .style('text-align', 'center')
            .style('margin-top', '4px')
            .append('div')
            .attr('id', 'globeToolBarLoadingLoader')
            .attr('class', 'mmgisLoading')
        var loaderTextToolbar = loadingToolbar
            .append('div')
            .attr('id', 'globeToolBarLoadingText')
            .style('font-size', '12px')
            .style('line-height', '13px')
        loaderTextToolbar
            .append('div')
            .attr('id', 'globeToolBarLoadingTextAdding')
            .style('text-align', 'center')
    }

    function matchPlanetLODToPlanet() {
        Globe_.planetLOD.matrix = Globe_.planet.matrix
        Globe_.planetLOD.position.set(
            Globe_.planet.position.x,
            Globe_.planet.position.y,
            Globe_.planet.position.z
        )
        Globe_.planetLOD.rotation.set(
            Globe_.planet.rotation.x,
            Globe_.planet.rotation.y,
            Globe_.planet.rotation.z
        )
    }

    function updateGlobeCenterPos() {
        Globe_.globeCenterPos.x =
            Globe_.globe.offset().left + Globe_.globe.width() / 2
        Globe_.globeCenterPos.y =
            Globe_.globe.offset().top + Globe_.globe.height() / 2
    }

    function findHighestMaxZoom() {
        var highest = 0
        for (var l in tileLayers) {
            if (tileLayers[l].name != 'Vectors As Tiles')
                if (tileLayers[l].maxZoom > highest) {
                    highest = tileLayers[l].maxZoom
                }
        }
        return highest
    }
    function findLowestMinZoom() {
        var lowest = Infinity
        for (var l in tileLayers) {
            if (tileLayers[l].path !== '_vectorsastile_') {
                if (tileLayers[l].minZoom < lowest) {
                    lowest = tileLayers[l].minZoom
                }
            }
        }
        return lowest
    }

    //A mod that works with negatives. a true modulo and not remainder
    function mod(n, m) {
        var remain = n % m
        return Math.floor(remain >= 0 ? remain : remain + m)
    }

    function getImageData(image) {
        var canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height

        var context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)

        return context.getImageData(0, 0, image.width, image.height)
    }

    function getPixel(imagedata, x, y) {
        var position = (x + imagedata.width * y) * 4,
            data = imagedata.data
        return {
            r: data[position],
            g: data[position + 1],
            b: data[position + 2],
            a: data[position + 3],
        }
    }

    function RGBAto32(rgba) {
        return decodeFloat(
            asByteString(rgba.r.toString(2)) +
                asByteString(rgba.g.toString(2)) +
                asByteString(rgba.b.toString(2)) +
                asByteString(rgba.a.toString(2))
        )
    }
    function asByteString(byte) {
        byteString = byte
        while (byteString.length < 8) {
            byteString = '0' + byteString
        }
        return byteString
    }
    function decodeFloat(binary) {
        if (binary.length < 32)
            binary = ('00000000000000000000000000000000' + binary).substr(
                binary.length
            )
        var sign = binary.charAt(0) == '1' ? -1 : 1
        var exponent = parseInt(binary.substr(1, 8), 2) - 127
        var significandBase = binary.substr(9)
        var significandBin = '1' + significandBase
        var i = 0
        var val = 1
        var significand = 0

        if (exponent == -127) {
            if (significandBase.indexOf('1') == -1) return 0
            else {
                exponent = -126
                significandBin = '0' + significandBase
            }
        }

        while (i < significandBin.length) {
            significand += val * parseInt(significandBin.charAt(i))
            val = val / 2
            i++
        }

        return sign * significand * Math.pow(2, exponent)
    }

    function range(start, end) {
        var r = []
        for (var i = start; i <= end; i++) {
            r.push(i)
        }
        return r
    }

    function panEvent(deltaX, deltaY) {
        Globe_.linkPanned = true
        var c = Globe_.getCenter()
        L_.Map_.resetView([c.lat, c.lon], true)
        clearTimeout(Globe_.linkPannedTimeout)
        Globe_.linkPannedTimeout = setTimeout(function() {
            Globe_.linkPanned = false
        }, 500)
    }

    return Globe_
})
