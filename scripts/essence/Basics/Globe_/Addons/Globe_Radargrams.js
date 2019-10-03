define(['three', 'Formulae_'], function(THREE, F_) {
    var Globe_Radargrams = {
        mesh: null,
        radargram: function(G_, layerName, geometry, url, length, depth) {
            if (Globe_Radargrams.mesh)
                G_.removeAddonMesh(0, Globe_Radargrams.mesh)

            var g = geometry.coordinates[0]
            if (geometry.type == 'LineString') g = geometry.coordinates

            depth = depth || 200 //m
            //Make radargram mesh

            var loader = new THREE.TextureLoader()
            loader.load(url, function(texture) {
                var geometryR = new THREE.Geometry()
                var materialR = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                })
                var lengthArray = []

                for (var i = 0; i < g.length; i++) {
                    var i0 = 1
                    var i1 = 0
                    if (true) {
                        i0 = 0
                        i1 = 1
                    }
                    var vSurface = G_.getProjection().lonLatToVector3(
                        g[i][i0],
                        g[i][i1],
                        g[i][2]
                    )
                    var vDepth = G_.getProjection().lonLatToVector3(
                        g[i][i0],
                        g[i][i1],
                        g[i][2] - depth
                    )

                    geometryR.vertices.push(vSurface)
                    geometryR.vertices.push(vDepth)

                    if (i > 0) {
                        lengthArray.push(
                            F_.lngLatDistBetween(
                                g[i - 1][i0],
                                g[i - 1][i1],
                                g[i][i0],
                                g[i][i1]
                            )
                        )
                    }
                }
                for (var i = 2; i < geometryR.vertices.length; i++) {
                    if (i % 2 == 0)
                        geometryR.faces.push(new THREE.Face3(i - 2, i - 1, i))
                    else geometryR.faces.push(new THREE.Face3(i, i - 1, i - 2))
                }
                assignRadargramUVs(geometryR, lengthArray)

                var meshR = new THREE.Mesh(geometryR, materialR)

                meshR.geometry.verticesNeedUpdate = true
                meshR.geometry.computeFaceNormals()
                meshR.geometry.computeVertexNormals()

                Globe_Radargrams.mesh = G_.addAddonMesh({}, 0, meshR)
            })
        },
    }

    function assignRadargramUVs(geometry, lengthArray) {
        //Get even triangle length array
        var totalLength = 0
        for (var i = 0; i < lengthArray.length; i++) {
            totalLength += lengthArray[i]
        }

        geometry.faceVertexUvs[0] = []

        var currentLength = 0
        for (var i = 0; i < geometry.faces.length; i++) {
            geometry.faceVertexUvs[0].push([
                new THREE.Vector2(currentLength / totalLength, 1),
                new THREE.Vector2(currentLength / totalLength, 0),
                new THREE.Vector2(
                    (currentLength + lengthArray[i]) / totalLength,
                    1
                ),
            ])
            geometry.faceVertexUvs[0].push([
                new THREE.Vector2(
                    (currentLength + lengthArray[i]) / totalLength,
                    0
                ),
                new THREE.Vector2(
                    (currentLength + lengthArray[i]) / totalLength,
                    1
                ),
                new THREE.Vector2(currentLength / totalLength, 0),
            ])
            currentLength += lengthArray[i]
        }

        geometry.uvsNeedUpdate = true
    }

    return Globe_Radargrams
})
