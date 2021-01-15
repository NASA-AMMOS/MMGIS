import F_ from './Formulae_'

describe('getBaseGeoJSON', () => {
    it('returns valid geojson', () => {
        const baseGeoJSON = F_.getBaseGeoJSON()

        expect(baseGeoJSON).toHaveProperty('type', 'FeatureCollection')
        expect(baseGeoJSON).toHaveProperty('features', [])
    })
})

describe('getExtension', () => {
    it('returns the extension of the filepath string', () => {
        expect(F_.getExtension('image.png')).toBe('png')
        expect(F_.getExtension('image.jpeg.png')).toBe('png')
        expect(F_.getExtension('image')).toBeFalsy()
    })
})

describe('pad', () => {
    it('front pads a number with a string of zeroes', () => {
        expect(F_.pad(2, 5)).toBe('00002')
        expect(F_.pad(10, 3)).toBe('010')
        expect(F_.pad(586, 3)).toBe('586')
    })
})
