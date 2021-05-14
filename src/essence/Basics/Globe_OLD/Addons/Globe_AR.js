import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../../Formulae_/Formulae_'
import UserInterface_ from '../../UserInterface_/UserInterface_'
import nipple from 'nipplejs'
var Globe_AR = {
    G_: null,
    scene: null,
    overscene: null,
    renderer: null,
    isOn: false,
    vrDisplay: null,
    arCamera: null,
    vrControls: null,
    arView: null,
    reticle: null,
    placeOnSurfaceMode: true,
    hit: null,
    pos: { x: null, y: null, z: null },
    sceneHeight: 0,
    test: null,
    scenescale: 50000,
    helperPlacement: null,
    nipples: {
        rotate: null,
        pan: null,
    },
    rotation: 0,
    rotationLast: 0,
    scaleFactor: 0,
    scale: 1,
    heightFactor: 70,
    setup: function (G, renderer, scene) {
        this.G_ = G
        this.renderer = renderer
        this.scene = scene
        this.overscene = new THREE.Scene()

        this.placeOnSurfaceMode = true

        THREE.ARUtils.getARDisplay().then(function (display) {
            if (display) {
                Globe_AR.vrDisplay = display
                addEnterButton()
            } else {
                THREE.ARUtils.displayUnsupportedMessage()
                //addEnterButton();
            }
        })

        function addEnterButton() {
            var button = document.createElement('button')
            button.className = '_WEBAR_Button'
            button.style.cursor = 'pointer'
            button.style.width = '45px'
            button.style.height = '35px'
            button.style.backgroundImage =
                'url("data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzQ1MScgd2lkdGg9JzQ1MScgIGZpbGw9IiNGRkZGRkYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHZlcnNpb249IjEuMSIgeD0iMHB4IiB5PSIwcHgiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCAxMDAgMTAwIiB4bWw6c3BhY2U9InByZXNlcnZlIj48Zz48cGF0aCBkPSJNNDUuMTcsNTMuMzExTDQyLjksNTBsMi4yNy0zLjMxMWMwLjMwMi0wLjQ0LDIuNzIyLTMuOTE2LDYuNzkzLTguNTJjLTEuNzM4LTAuNzgzLTMuNjcxLTEuMjMzLTUuNzE2LTEuMjMzICAgQzM5Ljc5NywzNi45MzcsMzIuNyw0Mi43ODcsMzIuNyw1MGMwLDcuMjE1LDcuMjU5LDEzLjA2MywxMy41NDcsMTMuMDYzYzIuMDQ1LDAsMy45NzgtMC40NSw1LjcxNi0xLjIzMyAgIEM0Ny44OTIsNTcuMjI3LDQ1LjQ3Miw1My43NTEsNDUuMTcsNTMuMzExeiI+PC9wYXRoPjxnPjxwYXRoIGQ9Ik02Mi45MjIsNzIuNjA4QzU4Ljc0MSw3NC4zNjksNTQuMzg5LDc1LjQ1LDUwLDc1LjQ1Yy0xOC4wNzksMC0zNC4zNjYtMTcuNDAyLTQwLjk1Ny0yNS40ODcgICAgQzE2Ljg2LDQwLjMyNywzMy4xODksMjQuNTUsNTAsMjQuNTVjNC40NzUsMCw4LjgzOSwxLjA2OCwxMi45NzUsMi43OTZjMS45OTctMS42OTMsNC4xMjktMy4zNjMsNi4zODktNC45NDkgICAgQzYzLjQwNywxOS4zNjMsNTYuODY2LDE3LjM0Myw1MCwxNy4zNDNDMjIuMzg2LDE3LjM0MywwLDUwLDAsNTBzMjIuMzg2LDMyLjY1Nyw1MCwzMi42NTdjNi44NjYsMCwxMy40MDctMi4wMjEsMTkuMzYzLTUuMDU0ICAgIEM2Ny4wODMsNzYuMDAzLDY0LjkzNCw3NC4zMTcsNjIuOTIyLDcyLjYwOHoiPjwvcGF0aD48L2c+PGc+PHBhdGggZD0iTTc1LDI1LjY2OUM2MC4wNiwzNS4zNDUsNTAsNTAsNTAsNTBzMTAuMDYsMTQuNjU1LDI1LDI0LjMzMUM4OS45NCw2NC42NTUsMTAwLDUwLDEwMCw1MFM4OS45NCwzNS4zNDUsNzUsMjUuNjY5eiAgICAgTTc0LjU5Myw1OC4xMDhjLTQuNDczLDAtOC4xMDgtMy42My04LjEwOC04LjEwOGMwLTQuNDczLDMuNjM2LTguMTA4LDguMTA4LTguMTA4YzQuNDc4LDAsOC4xMDgsMy42MzYsOC4xMDgsOC4xMDggICAgQzgyLjcwMSw1NC40NzksNzkuMDcsNTguMTA4LDc0LjU5Myw1OC4xMDh6IE04Ny43NjIsNTguMTA4Yy0xLjQ5MSwwLTIuNzAxLTEuMjA5LTIuNzAxLTIuNzA1YzAtMS40OSwxLjIxLTIuNywyLjcwMS0yLjcgICAgYzEuNDkyLDAsMi43MDQsMS4yMSwyLjcwNCwyLjdDOTAuNDY2LDU2Ljg5OSw4OS4yNTQsNTguMTA4LDg3Ljc2Miw1OC4xMDh6Ij48L3BhdGg+PC9nPjwvZz48L3N2Zz4=")'
            button.style.backgroundRepeat = 'no-repeat'
            button.style.backgroundSize = '35px 35px'
            button.style.backgroundPosition = 'right center'
            button.style.backgroundColor = 'transparent'
            button.style.position = 'absolute'
            button.style.right = '5px'
            button.style.bottom = '73px'
            button.style.border = 'none'
            button.style.borderRadius = '4px'
            button.style.color = '#fff'
            button.style.font = 'normal 13px sans-serif'
            button.style.textAlign = 'left'
            button.style.opacity = '0.25'
            button.style.outline = 'none'
            button.style.zIndex = '999'
            button.style.whiteSpace = 'nowrap'
            button.style.transition = 'opacity 0.2s ease-out'

            button.onmouseenter = function () {
                button.style.opacity = '1.0'
            }
            button.onmouseleave = function () {
                button.style.opacity = '0.25'
            }

            document.getElementById('globeScreen').appendChild(button)

            button.onclick = function () {
                if (Globe_AR.isOn) {
                    Globe_AR.exit()
                } else {
                    Globe_AR.enter()
                }
            }
        }
    },
    enter: function () {
        /* Uncomment ME!!
        //fullscreen globe panel
        UserInterface_.setPanelPercents(0, 0, 100)
        UserInterface_.fullHide(true)
        d3.select('#globeToolBar').style('display', 'none')
        d3.select('._WEBVR_Button').style('display', 'none')
        d3.select('._WEBAR_Button').style('bottom', '3px')
        d3.select('#globe').style('pointer-events', 'inherit')
        Globe_AR.makeUI()

        Globe_AR.G_.radiusOfTiles = 3

        Globe_AR.isOn = true
        Globe_AR.G_.inAR = Globe_AR.isOn

        Globe_AR.arView =
            Globe_AR.arView ||
            new THREE.ARView(Globe_AR.vrDisplay, Globe_AR.renderer)

        Globe_AR.camera =
            Globe_AR.camera ||
            new THREE.ARPerspectiveCamera(
                Globe_AR.vrDisplay,
                60,
                window.innerWidth / window.innerHeight,
                Globe_AR.vrDisplay.depthNear,
                Globe_AR.vrDisplay.depthFar
            )

        Globe_AR.vrControls =
            Globe_AR.vrControls || new THREE.VRControls(Globe_AR.camera)

        // Create our ARReticle, which will continuously fire `hitTest` to trace
        // the detected surfaces
        Globe_AR.reticle = new THREE.ARReticle(
            Globe_AR.vrDisplay,
            0.04, // innerRadius
            0.052, // outerRadius
            0xff00cc, // color
            10
        ) // easing
        Globe_AR.overscene.add(Globe_AR.reticle)

        //AXES - Uncomment for
        /*
            var materiall = new THREE.LineBasicMaterial({ color: 0xff0000 });
            var geometryl = new THREE.Geometry();
            geometryl.vertices.push(new THREE.Vector3(-1, 0, 0));
            geometryl.vertices.push(new THREE.Vector3(1, 0, 0));
            var line = new THREE.Line(geometryl, materiall);
            Globe_AR.overscene.add(line);
            var materiall = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            var geometryl = new THREE.Geometry();
            geometryl.vertices.push(new THREE.Vector3(0, -1, 0));
            geometryl.vertices.push(new THREE.Vector3(0, 1, 0));
            var line = new THREE.Line(geometryl, materiall);
            Globe_AR.overscene.add(line);
            var materiall = new THREE.LineBasicMaterial({ color: 0x0000ff });
            var geometryl = new THREE.Geometry();
            geometryl.vertices.push(new THREE.Vector3(0, 0, -1));
            geometryl.vertices.push(new THREE.Vector3(0, 0, 1));
            var line = new THREE.Line(geometryl, materiall);
            Globe_AR.overscene.add(line);
            */
        //END AXES
        /* This ONE TOO!!

        var geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05)
        var material = new THREE.MeshNormalMaterial()
        Globe_AR.helperPlacement = new THREE.Mesh(geometry, material)
        Globe_AR.helperPlacement.position.set(0, 0, 0)
        //Globe_AR.overscene.add( Globe_AR.helperPlacement );

        if (Globe_AR.placeOnSurfaceMode) {
            Globe_AR.renderer.domElement.addEventListener(
                'touchstart',
                placeOnSurface,
                false
            )
        }
        */
    },
    update: function () {
        //Globe_AR.vrControls
        if (Globe_AR.hit != null) {
            // THREE.ARUtils.placeObjectAtHit(Globe_AR.test,  // The object to place
            //   Globe_AR.hit,   // The VRHit object to move the cube to
            //   1,     // Easing value from 0 to 1; we want to move
            //         // the cube directly to the hit position
            //   true); // Whether or not we also apply orientation
        }

        var s = 1
        if (Globe_AR.scaleFactor !== 0) {
            s = Globe_AR.scene.scale.x * Globe_AR.scaleFactor
            Globe_AR.scene.scale.set(s, s, s)
            Globe_AR.scale = s
            console.log(s)
        }
        //console.log( Globe_AR.helperPlacement.position.y, Globe_AR.G_.planet.position.y, Globe_AR.G_.lastGoodCenterElevation );
        Globe_AR.scene.rotation.x = Math.PI
        let y = Globe_AR.scene.position.y
        //Globe_AR.scene.position.y = Globe_AR.G_.lastGoodCenterElevation - 70;
        Globe_AR.G_.planet.position.y =
            -Globe_AR.G_.planetCenter.y -
            (Globe_AR.G_.lastGoodCenterElevation - Globe_AR.heightFactor)
        //console.log( Globe_AR.scene.scale.x );

        Globe_AR.scenescale = s * Math.pow(2, Globe_AR.G_.zoom + 1)
        Globe_AR.scene.position.x =
            Globe_AR.scenescale * (Globe_AR.pos.x - Globe_AR.camera.position.x)
        Globe_AR.scene.position.y =
            Globe_AR.scenescale * (Globe_AR.pos.y - Globe_AR.camera.position.y)
        Globe_AR.scene.position.z =
            Globe_AR.scenescale * (Globe_AR.pos.z - Globe_AR.camera.position.z)
        //console.log( Globe_AR.pos.x, Globe_AR.camera.position.x, -( Globe_AR.pos.x + Globe_AR.camera.position.x ) )
        //a b
        //b == 0 => a = a
        //
        //console.log( Globe_AR.pos.x, Globe_AR.camera.position.x );
        //Globe_AR.scene.position.y = Globe_AR.G_.getCenterElevation();
        //console.log( Globe_AR.scene.position.y );
        //console.log(  Globe_AR.camera.position );
        Globe_AR.arView.render()
        Globe_AR.camera.updateProjectionMatrix()
        Globe_AR.reticle.update(0.5, 0.5)
        Globe_AR.vrControls.update()
        Globe_AR.renderer.clearDepth()
        Globe_AR.renderer.render(Globe_AR.scene, Globe_AR.camera)
        if (Globe_AR.placeOnSurfaceMode)
            Globe_AR.renderer.render(Globe_AR.overscene, Globe_AR.camera)
    },
    exit: function () {
        UserInterface_.fullHide(false)
        d3.select('#globeToolBar').style('display', 'inherit')
        d3.select('._WEBVR_Button').style('display', 'inherit')
        d3.select('._WEBAR_Button').style('bottom', '73px')
        d3.select('#globe').style('pointer-events', 'inherit')
        Globe_AR.removeUI()

        Globe_AR.isOn = false
        Globe_AR.G_.inAR = Globe_AR.isOn
        Globe_AR.G_.radiusOfTiles = 7

        Globe_AR.renderer.domElement.removeEventListener(
            'touchstart',
            placeOnSurface
        )
    },
    makeUI: function () {
        var UIScreen = d3
            .select('#globeScreen')
            .append('div')
            .attr('id', '_AR_UIScreen')
            .style('width', '100%')
            .style('height', '100%')
        UIScreen.append('div')
            .attr('id', '_AR_nippleScreenLeft')
            .style('width', '50%')
            .style('height', '100%')
            .style('position', 'absolute')
            .style('left', '0')
            .style('pointer-events', 'none')
        UIScreen.append('div')
            .attr('id', '_AR_nippleScreenRight')
            .style('width', '50%')
            .style('height', '100%')
            .style('position', 'absolute')
            .style('right', '0')
            .style('pointer-events', 'none')

        Globe_AR.nipples.rotate = nipple.create({
            zone: document.getElementById('_AR_nippleScreenLeft'),
            color: 'white',
        })
        Globe_AR.nipples.rotate.on('added', function (evt, nipple) {
            nipple.on('start move end dir plain', function (evt, data) {
                if (data.angle) {
                    Globe_AR.rotation = data.angle.radian
                    Globe_AR.G_.rotateAroundArbAxis(
                        new THREE.Vector3(0, 1, 0),
                        Globe_AR.rotation - Globe_AR.rotationLast
                    )
                    Globe_AR.rotationLast = data.angle.radian
                }
            })
        })

        Globe_AR.nipples.pan = nipple.create({
            zone: document.getElementById('_AR_nippleScreenRight'),
            color: 'white',
        })
        Globe_AR.nipples.pan.on('added', function (evt, nipple) {
            nipple.on('start move end dir plain', function (evt, data) {
                if (data.angle)
                    Globe_AR.G_.rotateGlobe(
                        {
                            pageX:
                                Math.cos(data.angle.radian - Math.PI) *
                                data.force *
                                50,
                            pageY:
                                Math.sin(data.angle.radian - Math.PI) *
                                data.force *
                                50,
                        },
                        {
                            x: 0,
                            y: 0,
                        }
                    )
            })
        })

        //Height Slider
        var slider = UIScreen.append('div')
            .attr('id', '_AR_sliderLeft')
            .style('position', 'absolute')
            .style('left', '-6px')
            .style('top', '34px')
            .style('transform', 'rotate(90deg)')
            .style('transform-origin', '0 100%')
            .append('input')
            .attr('class', 'ar_slider')
            .attr('type', 'range')

        $('.ar_slider').on('input', function () {
            Globe_AR.heightFactor =
                ($(this).val() / 10) *
                (-Globe_AR.G_.planetCenter.y / Math.pow(2, Globe_AR.G_.zoom))
        })

        //Scales
        var scale = UIScreen.append('div')
            .attr('id', '_AR_scaleLeft')
            .style('position', 'absolute')
            .style('left', '0')
            .style('top', '0')
            .style('display', 'flex')
            .style('flex-flow', 'column')
            .style('opacity', '0')
            .style('pointer-events', 'none')
            .style('transition', 'opacity 0.3s ease-in-out')
        scale
            .append('div')
            .attr('id', '_AR_scaleUp')
            .style('width', '40px')
            .style('height', '40px')
            .style('padding', '8px')
            .style('line-height', '24px')
            .style('background', 'rgba(255,255,255,0.1)')
            .append('i')
            .attr('class', 'mdi mdi-plus mdi-24px')
        scale
            .append('div')
            .attr('id', '_AR_scaleDown')
            .style('width', '40px')
            .style('height', '40px')
            .style('padding', '8px')
            .style('line-height', '24px')
            .style('background', 'rgba(255,255,255,0.1)')
            .append('i')
            .attr('class', 'mdi mdi-minus mdi-24px')

        $('#_AR_scaleUp').on('touchstart', function () {
            Globe_AR.scaleFactor = 1.01
        })
        $('#_AR_scaleDown').on('touchstart', function () {
            Globe_AR.scaleFactor = 0.99
        })
        $('#_AR_scaleUp').on('touchend', function () {
            Globe_AR.scaleFactor = 0
        })
        $('#_AR_scaleDown').on('touchend', function () {
            Globe_AR.scaleFactor = 0
        })

        //Zooms
        var zoom = UIScreen.append('div')
            .attr('id', '_AR_zoomRight')
            .style('position', 'absolute')
            .style('right', '0')
            .style('top', '0')
            .style('display', 'flex')
            .style('flex-flow', 'column')
            .style('opacity', '0')
            .style('pointer-events', 'none')
            .style('transition', 'opacity 0.3s ease-in-out')
        zoom.append('div')
            .attr('id', '_AR_zoomIn')
            .style('width', '40px')
            .style('height', '40px')
            .style('padding', '8px')
            .style('line-height', '24px')
            .style('background', 'rgba(255,255,255,0.1)')
            .append('i')
            .attr('class', 'mdi mdi-plus mdi-24px')
        zoom.append('div')
            .attr('id', '_AR_zoomOut')
            .style('width', '40px')
            .style('height', '40px')
            .style('padding', '8px')
            .style('line-height', '24px')
            .style('background', 'rgba(255,255,255,0.1)')
            .append('i')
            .attr('class', 'mdi mdi-minus mdi-24px')

        $('#_AR_zoomIn').on('click', function () {
            Globe_AR.G_.setZoom(Globe_AR.G_.zoom + 1)
        })
        $('#_AR_zoomOut').on('click', function () {
            Globe_AR.G_.setZoom(Globe_AR.G_.zoom - 1)
        })

        //Placement
        var place = UIScreen.append('div')
            .attr('id', '_AR_placeLeft')
            .style('position', 'absolute')
            .style('left', '0')
            .style('bottom', '0')
            .style('display', 'flex')
            .style('flex-flow', 'column')
        var placeButton = place
            .append('div')
            .style('width', '40px')
            .style('height', '40px')
            .style('padding', '11px 3px 3px 3px')
            .style('line-height', '24px')
            .append('div')
            .attr('id', '_AR_placeButton')
            .style('width', '24px')
            .style('height', '24px')
            .style('border', '3px solid white')
            .style('border-bottom-left-radius', '24px')
            .style('border-bottom', '2px solid white')
            .style('border-left', '2px solid white')
            .style('background', 'white')
            .style('transition', 'background 0.1s ease-in-out')

        placeButton.on('click', function () {
            /*
            var frameData = new VRFrameData();
            Globe_AR.vrDisplay.getFrameData( frameData );
            console.log( frameData );
            */
            Globe_AR.placeOnSurfaceMode = !Globe_AR.placeOnSurfaceMode
            if (Globe_AR.placeOnSurfaceMode) {
                Globe_AR.renderer.domElement.addEventListener(
                    'touchstart',
                    placeOnSurface,
                    false
                )
                d3.select('#_AR_placeButton').style('background', 'white')
                d3.select('#_AR_nippleScreenLeft').style(
                    'pointer-events',
                    'none'
                )
                d3.select('#_AR_nippleScreenRight').style(
                    'pointer-events',
                    'none'
                )
                d3.select('#globe').style('pointer-events', 'inherit')
                d3.select('#_AR_scaleLeft').style('pointer-events', 'none')
                d3.select('#_AR_scaleLeft').style('opacity', '0')
                d3.select('#_AR_zoomRight').style('pointer-events', 'none')
                d3.select('#_AR_zoomRight').style('opacity', '0')
            } else {
                Globe_AR.renderer.domElement.removeEventListener(
                    'touchstart',
                    placeOnSurface
                )
                d3.select('#_AR_placeButton').style('background', 'transparent')
                d3.select('#_AR_nippleScreenLeft').style(
                    'pointer-events',
                    'inherit'
                )
                d3.select('#_AR_nippleScreenRight').style(
                    'pointer-events',
                    'inherit'
                )
                d3.select('#globe').style('pointer-events', 'none')
                d3.select('#_AR_scaleLeft').style('pointer-events', 'inherit')
                d3.select('#_AR_scaleLeft').style('opacity', '1')
                d3.select('#_AR_zoomRight').style('pointer-events', 'inherit')
                d3.select('#_AR_zoomRight').style('opacity', '1')
            }
        })
    },
    removeUI: function () {
        Globe_AR.nipples.rotate.destroy()
        Globe_AR.nipples.pan.destroy()

        while (Globe_AR.overscene.children.length > 0) {
            Globe_AR.overscene.remove(Globe_AR.overscene.children[0])
        }

        d3.select('#globeScreen #_AR_UIScreen').remove()
    },
    getElement: function () {
        var markup = [
            "<div class='mmgisButton3' id='Globe_AR_placeOnSurface'>Choose a surface</div>",
            "<input id='Globe_AR_sceneHeight' type='range' min=0 max=5000 value=0 step=10 />",
        ].join('\n')
        return markup
    },
    attachEvents: function () {
        $('#Globe_AR_placeOnSurface').on('click', function () {
            Globe_AR.placeOnSurfaceMode = !Globe_AR.placeOnSurfaceMode
            if (Globe_AR.placeOnSurfaceMode) {
                Globe_AR.renderer.domElement.addEventListener(
                    'touchstart',
                    placeOnSurface,
                    false
                )
                $(this).text('Done')
            } else {
                Globe_AR.renderer.domElement.removeEventListener(
                    'touchstart',
                    placeOnSurface
                )
                $(this).text('Choose a surface')
            }
        })
        $('#Globe_AR_sceneHeight').on('change', function () {
            Globe_AR.sceneHeight = $('#Globe_AR_sceneHeight').val()
        })
    },
}

//Other functions
function placeOnSurface(e) {
    //On Reticle
    Globe_AR.hit = { modelMatrix: Globe_AR.reticle.matrix.elements }
    var savedY = Globe_AR.G_.planet.position.y

    THREE.ARUtils.placeObjectAtHit(
        Globe_AR.G_.planet, // The object to place
        Globe_AR.hit, // The VRHit object to move the cube to
        1, // Easing value from 0 to 1; we want to move
        // the cube directly to the hit position
        false
    ) // Whether or not we also apply orientation
    Globe_AR.pos.x = Globe_AR.G_.planet.position.x
    Globe_AR.pos.y = Globe_AR.G_.planet.position.y
    Globe_AR.pos.z = Globe_AR.G_.planet.position.z

    Globe_AR.G_.planet.position.y += savedY
    Globe_AR.G_.planet.position.x = 0
    Globe_AR.G_.planet.position.z = 0

    //Place the invisible helperPlacement
    // The planet is weird (position modifed each update) and this object helps find where
    // a non-weird object in the same position would land
    THREE.ARUtils.placeObjectAtHit(
        Globe_AR.helperPlacement, // The object to place
        Globe_AR.hit, // The VRHit object to move the cube to
        1, // Easing value from 0 to 1; we want to move
        // the cube directly to the hit position
        false
    ) // Whether or not we also apply orientation

    return
    /*
      if (!e.touches[0]) {
        return;
      }
    
      // Inspect the event object and generate normalize screen coordinates
      // (between 0 and 1) for the screen position.
      var x = e.touches[0].pageX / window.innerWidth;
      var y = e.touches[0].pageY / window.innerHeight;
    
      // Send a ray from the point of click to the real world surface
      // and attempt to find a hit. `hitTest` returns an array of potential
      // hits.
      var hits = Globe_AR.vrDisplay.hitTest(x, y);
    
      // If a hit is found, just use the first one
      if (hits && hits.length) {
        
        Globe_AR.hit = hits[0];
        console.log( Globe_AR.hit );
        console.log( Globe_AR.reticle );
        THREE.ARUtils.placeObjectAtHit(Globe_AR.test,  // The object to place
          Globe_AR.hit,   // The VRHit object to move the cube to
          1,     // Easing value from 0 to 1; we want to move
                // the cube directly to the hit position
          true); // Whether or not we also apply orientation
      }
      */
}

export default Globe_AR
