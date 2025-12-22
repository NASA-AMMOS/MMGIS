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
