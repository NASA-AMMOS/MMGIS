/**
 * Restyles the site via the configure look tab.
 */
import $ from 'jquery'
import L_ from '../essence/Basics/Layers_/Layers_'
import F_ from '../essence/Basics/Formulae_/Formulae_'
import uiStore from '../essence/Basics/UserInterface_/store/uiStore'

export function stylize() {
    if (L_.configData.look) {
        if (L_.configData.look.pagename && L_.configData.look.pagename != '')
            document.title = L_.configData.look.pagename + ' - ' + L_.mission

        // Apply theme preset first if set in mission config
        if (L_.configData.look.theme && L_.configData.look.theme !== '') {
            uiStore.getState().setTheme(L_.configData.look.theme)
        }

        // Then apply individual color overrides on top (backward compat)
        const r = document.querySelector(':root')

        if (
            L_.configData.look.primarycolor &&
            L_.configData.look.primarycolor != ''
        )
            r.style.setProperty('--color-a', L_.configData.look.primarycolor)
        if (
            L_.configData.look.secondarycolor &&
            L_.configData.look.secondarycolor != ''
        )
            r.style.setProperty(
                '--color-a-5',
                L_.configData.look.secondarycolor
            )
        if (
            L_.configData.look.tertiarycolor &&
            L_.configData.look.tertiarycolor != ''
        )
            r.style.setProperty('--color-f', L_.configData.look.tertiarycolor)
        if (
            L_.configData.look.accentcolor &&
            L_.configData.look.accentcolor != ''
        )
            r.style.setProperty('--color-mmgis', L_.configData.look.accentcolor)

        if (L_.configData.look.bodycolor && L_.configData.look.bodycolor != '')
            $('body').css({ background: L_.configData.look.bodycolor })
        if (
            L_.configData.look.topbarcolor &&
            L_.configData.look.topbarcolor != ''
        ) {
            $('#topBar').css({
                background:
                    L_.configData.look.topbarcolor || 'rgb(0, 0, 0, 0.15)',
            })
            if (!L_.configData.look.topbarcolor.includes('rgba')) {
                $('#topBarTitle').css({ background: 'unset' })
            }
        }
        if (
            L_.configData.look.toolbarcolor &&
            L_.configData.look.toolbarcolor != ''
        ) {
            $('#toolbar').css({
                background: L_.configData.look.toolbarcolor,
            })
            var bodyRGB = $('#toolbar').css('backgroundColor')
            var bodyHEX = F_.rgb2hex(bodyRGB)
            bodyRGB = F_.rgbToArray(bodyRGB)
            var c =
                'rgba(' + bodyRGB[0] + ',' + bodyRGB[1] + ',' + bodyRGB[2] + ')'
            $('#toolsWrapper').css({ background: c })
        }
        if (L_.configData.look.mapcolor && L_.configData.look.mapcolor != '')
            $('#map').css({ background: L_.configData.look.mapcolor })
        if (L_.configData.look.logourl && L_.configData.look.logourl != '') {
            $('#mmgislogo').css({ padding: '7px 3px' })
            $('#mmgislogo').html(
                `<img src="${L_.configData.look.logourl}" alt="Logo" width="32px">`
            )
            $('#favicon').attr('href', L_.configData.look.logourl)
        }
        // Note: look.infourl and look.helpurl are now displayed in the About modal
        // (BottomBar.showAboutModal). The old #topBarInfo and #topBarHelp buttons
        // were removed — their jQuery click handlers are no longer needed.
    }
}
