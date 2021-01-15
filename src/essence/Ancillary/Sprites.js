//Just a 'class' for building THREE.js sprites
let THREE = window.THREE

var Sprites = {
    //id -> spriteMaterial
    spriteMaterials: {},
    makeMarkerSprite: function (parameters, id) {
        var sprite = new THREE.Sprite(
            Sprites.makeMarkerMaterial(parameters, id)
        )
        sprite.scale.set(3, 3, 1)
        return sprite
    },
    makeMarkerMaterial: function (parameters, id) {
        if (id && this.spriteMaterials.hasOwnProperty(id)) {
            return this.spriteMaterials[id]
        } else {
            if (parameters === undefined) parameters = {}

            //Ideally a power of 2
            var radius = parameters.hasOwnProperty('radius')
                ? parameters['radius']
                : 16

            var fillColor = parameters.hasOwnProperty('fillColor')
                ? parameters['fillColor']
                : { r: 255, g: 255, b: 255, a: 1.0 }

            var strokeWeight = parameters.hasOwnProperty('strokeWeight')
                ? parameters['strokeWeight']
                : 4

            var strokeColor = parameters.hasOwnProperty('strokeColor')
                ? parameters['strokeColor']
                : { r: 0, g: 0, b: 0, a: 1.0 }

            var canvas = document.createElement('canvas')
            var context = canvas.getContext('2d')
            var width = radius * 2
            var height = radius * 2
            canvas.width = width
            canvas.height = height

            context.beginPath()
            context.arc(
                canvas.width / 2,
                canvas.height / 2,
                radius - strokeWeight,
                0,
                2 * Math.PI,
                false
            )
            //fill color
            if (typeof fillColor === 'object') {
                context.fillStyle =
                    'rgba(' +
                    fillColor.r +
                    ',' +
                    fillColor.g +
                    ',' +
                    fillColor.b +
                    ',' +
                    fillColor.a +
                    ')'
            } else {
                context.fillStyle = fillColor
            }
            context.fill()
            context.lineWidth = strokeWeight
            // border color
            if (typeof strokeColor === 'object') {
                context.strokeStyle =
                    'rgba(' +
                    strokeColor.r +
                    ',' +
                    strokeColor.g +
                    ',' +
                    strokeColor.b +
                    ',' +
                    strokeColor.a +
                    ')'
            } else {
                context.strokeStyle = strokeColor
            }
            context.stroke()

            // canvas contents will be used for a texture
            var texture = new THREE.Texture(canvas)
            texture.needsUpdate = true

            var spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.5,
                //depthTest: true,
                //depthWrite: false
            })

            //save spriteMaterials with id so they don't need to be recreated
            if (id) {
                this.spriteMaterials[id] = spriteMaterial
            }

            return spriteMaterial
        }
    },
    makeTextSprite: function (message, parameters) {
        if (parameters === undefined) parameters = {}

        var fontface = parameters.hasOwnProperty('fontface')
            ? parameters['fontface']
            : 'Arial'

        var fontsize = parameters.hasOwnProperty('fontsize')
            ? parameters['fontsize']
            : 18

        var strokeWeight = parameters.hasOwnProperty('strokeWeight')
            ? parameters['strokeWeight']
            : 4

        var strokeColor = parameters.hasOwnProperty('strokeColor')
            ? parameters['strokeColor']
            : { r: 0, g: 0, b: 0, a: 1.0 }

        var fontColor = parameters.hasOwnProperty('fontColor')
            ? parameters['fontColor']
            : { r: 255, g: 255, b: 255, a: 1.0 }

        var canvas = document.createElement('canvas')
        var context = canvas.getContext('2d')
        var width = 1024
        var height = 64
        canvas.width = width
        canvas.height = height
        context.font = 'Bold ' + fontsize + 'px ' + fontface

        // get size data (height depends only on font size)
        var metrics = context.measureText(message)
        var textWidth = metrics.width
        // background color

        // border color
        context.strokeStyle =
            'rgba(' +
            strokeColor.r +
            ',' +
            strokeColor.g +
            ',' +
            strokeColor.b +
            ',' +
            strokeColor.a +
            ')'

        context.lineWidth = strokeWeight

        //text color
        context.fillStyle =
            'rgba(' +
            fontColor.r +
            ',' +
            fontColor.g +
            ',' +
            fontColor.b +
            ',' +
            fontColor.a +
            ')'
        context.textAlign = 'left'
        context.strokeText(
            message,
            width / 2 + fontsize,
            height - fontsize / 1.8
        )
        context.fillText(message, width / 2 + fontsize, height - fontsize / 1.8)

        // canvas contents will be used for a texture
        var texture = new THREE.Texture(canvas)
        texture.needsUpdate = true

        var spriteMaterial = new THREE.SpriteMaterial({ map: texture })
        var sprite = new THREE.Sprite(spriteMaterial)
        sprite.scale.set(64, 4, 1)
        return sprite
    },
}

export default Sprites
