import L_ from '@basics/Layers_/Layers_'
import QueryURL from '@essence/services/QueryURL'

const SearchUrl = {
    use(ctx) {
        var keyAsName
        if (ctx.layer != null && ctx.layer.hasOwnProperty('options')) {
            if (ctx.layer.hasOwnProperty('useKeyAsName')) {
                keyAsName = ctx.layer.feature.properties[ctx.layer.useKeyAsName]
            } else {
                keyAsName = ctx.layer.feature.properties[0]
            }
        }

        var searchToolVars = L_.getToolVars('search')
        var searchfields = {}
        if (searchToolVars.hasOwnProperty('searchfields')) {
            for (var layerfield in searchToolVars.searchfields) {
                var fieldString = searchToolVars.searchfields[layerfield]
                fieldString = fieldString.split(')')
                for (var i = 0; i < fieldString.length; i++) {
                    fieldString[i] = fieldString[i].split('(')
                    var li = fieldString[i][0].lastIndexOf(' ')
                    if (li !== -1) {
                        fieldString[i][0] = fieldString[i][0].substring(li + 1)
                    }
                }
                fieldString.pop()
                searchfields[layerfield] = fieldString
            }
        }

        var str = ''
        if (searchfields.hasOwnProperty(ctx.layerName)) {
            var sf = searchfields[ctx.layerName]
            for (var i = 0; i < sf.length; i++) {
                str += sf[i][1]
                str += ' '
            }
        }
        str = str.substring(0, str.length - 1)

        var searchFieldTokens = str.split(' ')
        var searchStr

        if (searchFieldTokens.length === 2) {
            if (
                searchFieldTokens[0].toLowerCase() ===
                ctx.layer.useKeyAsName.toLowerCase()
            ) {
                searchStr = keyAsName + ' ' + ctx.layer.feature.properties.Sol
            } else {
                searchStr = ctx.layer.feature.properties.Sol + ' ' + keyAsName
            }
        }

        QueryURL.writeSearchURL([searchStr], ctx.layerName)
    },
}

export default SearchUrl
