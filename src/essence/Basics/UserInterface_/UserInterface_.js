let UserInterface = null
// Check useragent for now (FIXME use a better way to determine if mobile or not)
// https://gist.github.com/dalethedeveloper/1503252
let isMobile = window.navigator.userAgent.match(
    /Mobi|iP(hone|od|ad)|Android|BlackBerry/
)

// Always use the React bridge that delegates to the Zustand store
UserInterface = () =>
    import('./UserInterfaceBridge').then((module) => {
        module.default.isMobile = !!isMobile
        return module.default
    })

export default await UserInterface
