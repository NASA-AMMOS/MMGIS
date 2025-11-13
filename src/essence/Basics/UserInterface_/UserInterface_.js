import $ from 'jquery'
import * as d3 from 'd3'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_'
import Login from '../../Ancillary/Login/Login'

import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'

let UserInterface = null
// Check useragent for now (FIXME use a better way to determine if mobile or not)
// https://gist.github.com/dalethedeveloper/1503252
let isMobile = window.navigator.userAgent.match(
    /Mobi|iP(hone|od|ad)|Android|BlackBerry/
)
if (isMobile) {
    UserInterface = () =>
        import('./UserInterfaceMobile_').then((module) => {
            module.default.isMobile = true
            return module.default
        })
} else {
    UserInterface = () =>
        import('./UserInterfaceDefault_').then((module) => module.default)
}

export default await UserInterface
