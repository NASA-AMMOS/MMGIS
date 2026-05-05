/**
 * Restyles the site via the configure look tab.
 */
import $ from 'jquery'
import L_ from '../essence/Basics/Layers_/Layers_'
import uiStore from '../essence/Basics/UserInterface_/store/uiStore'
import { refreshThemeDOM } from './themeApplier'

export function stylize() {
    if (L_.configData.look) {
        if (L_.configData.look.pagename && L_.configData.look.pagename != '')
            document.title = L_.configData.look.pagename + ' - ' + L_.mission

        // Apply the selected preset theme.
        if (L_.configData.look.theme && L_.configData.look.theme !== '') {
            uiStore.getState().setTheme(L_.configData.look.theme)
        }

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

        // Re-apply theme to DOM elements so inline styles reflect CSS variable overrides
        refreshThemeDOM()
    }
}
