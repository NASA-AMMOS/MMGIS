startLoading()
//Planet
function startLoading() {
    var loadingPage = document.createElement('div')
    loadingPage.className = 'LoadingPage'
    document.body.appendChild(loadingPage)

    var planet = document.createElement('div')
    planet.className = 'planet'
    loadingPage.appendChild(planet)

    var mmgisLogoURL =
        mmgisglobal.SERVER === 'node'
            ? '../resources/mmgis.png'
            : 'resources/mmgis.png'

    var loading = document.createElement('div')
    loading.id = 'title'
    var loadingp = document.createElement('p')
    loading.appendChild(loadingp)
    loadingp.innerHTML = "<img src='" + mmgisLogoURL + "' height='26px' />"
    loadingp.style.fontSize = '26px'
    loadingp.style.margin = '58px 0'
    loadingp.style.opacity = '1'
    loadingp.style.textAlign = 'center'
    loadingp.style.cursor = 'default'
    loadingPage.appendChild(loading)
}
