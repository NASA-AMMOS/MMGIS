define(['three', 'camera', 'container'], function(THREE, camera, container) {
    controls = new THREE.OrbitControls(camera, container)
    controls.enabled = true
    controls.enableDamping = false
    controls.dampingFactor = 0.05
    //controls.enableZoom = false;
    //controls.enableRotate = false;
    //controls.maxPolarAngle = Math.PI/2;

    return controls
})
