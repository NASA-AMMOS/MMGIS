import L_ from '@basics/Layers_/Layers_'
import QueryURL from '@essence/services/QueryURL'

const SearchUrl = {
    use(ctx) {
        const properties = ctx.feature?.properties
        if (properties == null) return

        const useKeyAsName =
            ctx.layer?.useKeyAsName || ctx.layerData?.useKeyAsName
        const keyAsName =
            useKeyAsName != null ? properties[useKeyAsName] : properties[0]

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
            for (var j = 0; j < sf.length; j++) {
                str += sf[j][1]
                str += ' '
            }
        }
        str = str.substring(0, str.length - 1)

        var searchFieldTokens = str.split(' ')
        var searchStr

        if (
            searchFieldTokens.length === 2 &&
            typeof useKeyAsName === 'string'
        ) {
            if (
                searchFieldTokens[0].toLowerCase() ===
                useKeyAsName.toLowerCase()
            ) {
                searchStr = keyAsName + ' ' + properties.Sol
            } else {
                searchStr = properties.Sol + ' ' + keyAsName
            }
        }

        QueryURL.writeSearchURL([searchStr], ctx.layerName)
    },
}

export default SearchUrl
