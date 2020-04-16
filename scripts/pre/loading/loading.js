//Planet
startLoading()
function startLoading() {
    var loadingPage = document.createElement('div')
    loadingPage.className = 'LoadingPage'
    document.body.appendChild(loadingPage)

    var planet = document.createElement('div')
    planet.className = 'planet'
    loadingPage.appendChild(planet)

    var planet2 = document.createElement('div')
    planet2.className = 'planet2'
    loadingPage.appendChild(planet2)

    var planet3 = document.createElement('div')
    planet3.className = 'planet3'
    loadingPage.appendChild(planet3)

    var mmgisLogoURL =
        mmgisglobal.SERVER === 'node'
            ? '../resources/mmgis.png'
            : 'resources/mmgis.png'

    var loading = document.createElement('div')
    loading.id = 'title'
    var loadingp = document.createElement('p')
    loading.appendChild(loadingp)
    loadingp.innerHTML = "<img src='" + mmgisLogoURL + "' />"
    loadingPage.appendChild(loading)

    var loading2 = document.createElement('div')
    loading2.id = 'loading2'
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loading2.appendChild(document.createElement('span'))
    loadingPage.appendChild(loading2)
}
